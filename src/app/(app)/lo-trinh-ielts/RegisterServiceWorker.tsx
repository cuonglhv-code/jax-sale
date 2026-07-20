"use client";

import { useEffect } from "react";

/**
 * Registers the summit precache service worker (T039, research D-OFFLINE). Fire-and-forget: a
 * registration failure (unsupported browser, dev-mode HTTP) must never block the presentation —
 * the tool already works fully offline once the page has loaded via ordinary browser caching;
 * this only extends that guarantee to a cold start with zero prior connectivity.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
