"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portal — renders children directly under <body>, bypassing any parent
 * overflow/transform/backdrop-filter that would clip position:fixed modals.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const elRef = useRef<HTMLDivElement | null>(null);

  if (!elRef.current && typeof window !== "undefined") {
    elRef.current = document.createElement("div");
  }

  useEffect(() => {
    const el = elRef.current!;
    document.body.appendChild(el);
    setMounted(true);
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  if (!mounted || !elRef.current) return null;
  return createPortal(children, elRef.current);
}
