"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};

/**
 * Portal — renders children directly under <body>, bypassing any parent
 * overflow/transform/backdrop-filter that would clip position:fixed modals.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isMounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}
