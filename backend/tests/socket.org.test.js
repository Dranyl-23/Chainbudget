/**
 * Tests: Socket.IO Organization-Scoped Broadcasting (Fix 5 — LOW)
 *
 * Verifies that:
 *  - Users join org-specific rooms based on server-side membership data.
 *  - Events emitted to an org room only reach members of that org.
 *  - A client cannot arbitrarily join another org's room.
 *  - Global io.emit() is no longer used for org-specific events.
 *
 * Run: node --test tests/socket.org.test.js
 */

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:path");
const path = require("node:path");

// ── Static source analysis: verify io.emit is gone ────────────────────────────

const ROUTES_DIR = path.resolve(__dirname, "../src/routes");
const INDEX_PATH = path.resolve(__dirname, "../src/index.js");

/**
 * Check a source file for remaining global io.emit() calls that carry an orgId.
 * Org-scoped events must use io.to(`org:${orgId}`).emit() instead.
 */
function findGlobalOrgEmits(filePath) {
  const content = require("fs").readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const violations = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // Skip comment-only lines (single-line // comments)
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    // A real global io.emit() call that is not already scoped with .to(...)
    if (/io\.emit\s*\(/.test(line) && !/io\.to\s*\(/.test(line)) {
      violations.push({ line: idx + 1, content: trimmed });
    }
  });

  return violations;
}

describe("Socket.IO Organization-Scoped Broadcasting — Fix 5", () => {

  it("transactions.js has no remaining global io.emit() calls for org events", () => {
    const violations = findGlobalOrgEmits(path.join(ROUTES_DIR, "transactions.js"));
    assert.deepEqual(
      violations,
      [],
      `Found global io.emit() in transactions.js: ${JSON.stringify(violations)}`
    );
  });

  it("approvals.js has no remaining global io.emit() calls for org events", () => {
    const violations = findGlobalOrgEmits(path.join(ROUTES_DIR, "approvals.js"));
    assert.deepEqual(
      violations,
      [],
      `Found global io.emit() in approvals.js: ${JSON.stringify(violations)}`
    );
  });

  it("dao.js has no remaining global io.emit() calls for org events", () => {
    const violations = findGlobalOrgEmits(path.join(ROUTES_DIR, "dao.js"));
    assert.deepEqual(
      violations,
      [],
      `Found global io.emit() in dao.js: ${JSON.stringify(violations)}`
    );
  });

  it("index.js joins users into org: rooms based on membership", () => {
    const content = require("fs").readFileSync(INDEX_PATH, "utf8");
    assert.ok(
      content.includes('socket.join(`org:${orgId}`)') ||
      content.includes("socket.join(`org:${orgId}`)"),
      "index.js must join org-scoped rooms using socket.join(`org:${orgId}`)"
    );
  });

  it("org room membership is derived from server-side DB data, not client input", () => {
    const content = require("fs").readFileSync(INDEX_PATH, "utf8");
    // The room assignment must use User.findOne with socket.userId (server-side),
    // NOT socket.handshake.query or socket.data or any client-supplied parameter.
    assert.ok(
      content.includes("User.findOne") && content.includes("socket.userId"),
      "Org room assignment must use server-side User.findOne with authenticated socket.userId"
    );
    // Must NOT use client-supplied orgId from handshake
    assert.ok(
      !content.includes("socket.handshake.query.orgId"),
      "Must not derive room membership from client-supplied query parameter"
    );
    assert.ok(
      !content.includes("socket.data.orgId"),
      "Must not derive room membership from client-supplied socket.data"
    );
  });

  describe("Runtime room isolation simulation", () => {
    /**
     * Simulates the org room system in memory:
     * - Each socket has a set of rooms.
     * - Emissions are delivered only to sockets in the target room.
     */
    function createMockIOSystem() {
      const sockets = new Map(); // socketId -> { rooms: Set, receivedEvents: [] }

      function createSocket(id, orgIds = []) {
        const socket = {
          id,
          rooms: new Set([id]), // Socket always in its own room
          receivedEvents: [],
          join(room) { this.rooms.add(room); },
          emit(event, data) { this.receivedEvents.push({ event, data }); },
        };
        orgIds.forEach((orgId) => socket.join(`org:${orgId}`));
        sockets.set(id, socket);
        return socket;
      }

      const io = {
        to(room) {
          return {
            emit(event, data) {
              sockets.forEach((socket) => {
                if (socket.rooms.has(room)) {
                  socket.emit(event, data);
                }
              });
            },
          };
        },
      };

      return { io, createSocket, sockets };
    }

    it("org A socket receives events emitted to org A room", () => {
      const { io, createSocket } = createMockIOSystem();
      const socketA = createSocket("socket-1", ["org-alpha"]);

      io.to("org:org-alpha").emit("transaction_updated", { orgId: "org-alpha" });

      const received = socketA.receivedEvents.find(e => e.event === "transaction_updated");
      assert.ok(received, "Socket A must receive transaction_updated for its org");
      assert.equal(received.data.orgId, "org-alpha");
    });

    it("org A socket does NOT receive events emitted to org B room", () => {
      const { io, createSocket } = createMockIOSystem();
      const socketA = createSocket("socket-1", ["org-alpha"]);
      const socketB = createSocket("socket-2", ["org-beta"]);

      // Emit only to org-beta
      io.to("org:org-beta").emit("transaction_updated", { orgId: "org-beta" });

      const aReceived = socketA.receivedEvents.find(e => e.event === "transaction_updated");
      const bReceived = socketB.receivedEvents.find(e => e.event === "transaction_updated");

      assert.equal(aReceived, undefined, "Org A socket must NOT receive org B events");
      assert.ok(bReceived, "Org B socket must receive its own event");
    });

    it("a socket can be in multiple org rooms (multi-org membership)", () => {
      const { io, createSocket } = createMockIOSystem();
      // User belongs to both orgs
      const socket = createSocket("socket-multi", ["org-alpha", "org-beta"]);

      io.to("org:org-alpha").emit("transaction_updated", { orgId: "org-alpha" });
      io.to("org:org-beta").emit("transaction_updated", { orgId: "org-beta" });

      const events = socket.receivedEvents.filter(e => e.event === "transaction_updated");
      assert.equal(events.length, 2, "Multi-org user must receive events from all their orgs");
    });

    it("unauthenticated socket (no org rooms) receives nothing", () => {
      const { io, createSocket } = createMockIOSystem();
      const anonSocket = createSocket("socket-anon", []); // no org rooms

      io.to("org:org-alpha").emit("transaction_updated", { orgId: "org-alpha" });

      assert.equal(
        anonSocket.receivedEvents.length,
        0,
        "Unauthenticated socket must not receive any org events"
      );
    });

    it("emitting to a non-existent org room delivers nothing", () => {
      const { io, createSocket } = createMockIOSystem();
      const socket = createSocket("socket-1", ["org-real"]);

      io.to("org:org-nonexistent").emit("transaction_updated", { orgId: "org-nonexistent" });

      assert.equal(socket.receivedEvents.length, 0);
    });
  });
});
