"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portal — renders children directly under <body>, bypassing any parent
 * overflow/transform/backdrop-filter that would clip position:fixed modals.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    setContainer(el);
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  if (!container) return null;
  return createPortal(children, container);
}
