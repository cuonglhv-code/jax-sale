"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "jax-theme";

function subscribe(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Sun/moon toggle in the top bar. Flips `.dark` on <html>, persists to localStorage (read
 *  pre-hydration by ThemeScript, so no flash on load).
 *
 *  Uses useSyncExternalStore rather than useState+useEffect to read the DOM's `.dark` class — the
 *  class is genuinely external mutable state (ThemeScript sets it before hydration, this component
 *  only reflects it), which is exactly what useSyncExternalStore exists for; a useEffect that calls
 *  setState to sync from an external source on mount is the anti-pattern react-hooks/
 *  set-state-in-effect flags. `getServerSnapshot` defaults to false (light) — matches the server's
 *  markup, which never sees the class ThemeScript adds client-side pre-hydration. */
export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const toggle = useCallback(() => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // localStorage unavailable (private mode, disabled) — theme just won't persist.
    }
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={toggle}
      title="Chế độ sáng / tối"
      className="flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-field)] border border-border bg-surface-2 text-text-muted transition-colors hover:border-border-strong hover:bg-surface-3"
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
        </svg>
      )}
    </button>
  );
}
