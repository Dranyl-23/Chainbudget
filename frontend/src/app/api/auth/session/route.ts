/**
 * /api/auth/session/route.ts
 *
 * CRIT-2 FIX: Secure session proxy for Asgardeo authentication.
 *
 * Eliminates the localStorage JWT vulnerability by storing the token in an
 * HttpOnly, Secure, SameSite=Strict cookie — inaccessible to JavaScript.
 *
 * POST   /api/auth/session  — Establish session (called after Asgardeo login)
 * GET    /api/auth/session  — Restore session on page reload
 * DELETE /api/auth/session  — Destroy session (logout)
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_API_URL?.replace("/:path*", "") ||
  "https://chainbudget-api.fly.dev/api";

const COOKIE_NAME = "cb_session";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  // 24-hour max-age matches the backend HS256 JWT TTL for mobile,
  // and gives Asgardeo sessions a consistent server-side expiry.
  maxAge: 60 * 60 * 24,
};

// ── POST /api/auth/session — Establish session ───────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    // Validate the Asgardeo token by hitting the backend /auth/me
    const backendRes = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!backendRes.ok) {
      const errData = await backendRes.json().catch(() => ({})) as { error?: string };
      return NextResponse.json(
        { error: errData.error || "Authentication failed" },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json() as { user?: object };
    const user = data.user || data;

    // Set the HttpOnly session cookie — never readable by client JavaScript
    const res = NextResponse.json({ user }, { status: 200 });
    res.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("[session/POST] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── GET /api/auth/session — Restore session on page load ────────────────────
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Verify the stored token is still valid against backend /users/me
    const backendRes = await fetch(`${BACKEND_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!backendRes.ok) {
      // Token expired — clear the stale cookie
      const res = NextResponse.json({ user: null }, { status: 200 });
      res.cookies.delete(COOKIE_NAME);
      return res;
    }

    const data = await backendRes.json() as { user?: object };
    const user = data.user || data;
    return NextResponse.json({ user }, { status: 200 });
  } catch (err) {
    console.error("[session/GET] Error:", err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

// ── DELETE /api/auth/session — Destroy session (logout) ─────────────────────
export async function DELETE() {
  const res = NextResponse.json({ success: true }, { status: 200 });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
