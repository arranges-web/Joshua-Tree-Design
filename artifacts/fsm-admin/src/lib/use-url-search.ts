import { useEffect, useState } from "react";

// wouter's useLocation only tracks the pathname; we deep-link the
// accounting sub-pages (and potentially other pages) via `?tab=...`
// query strings, so we need a hook that re-renders when *only* the
// query changes. This module patches history.pushState /
// replaceState exactly once so that wouter's Link clicks (which use
// pushState directly) emit a synthetic "locationchange" event we can
// subscribe to. Anyone calling useUrlSearch gets the current search
// string and re-renders on every history change.

let patched = false;

function ensurePatched(): void {
  if (patched) return;
  if (typeof window === "undefined") return;
  patched = true;
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) {
    origPush.apply(this, args);
    window.dispatchEvent(new Event("locationchange"));
  };
  history.replaceState = function (...args) {
    origReplace.apply(this, args);
    window.dispatchEvent(new Event("locationchange"));
  };
  window.addEventListener("popstate", () =>
    window.dispatchEvent(new Event("locationchange")),
  );
}

export function useUrlSearch(): string {
  const [search, setSearch] = useState(() =>
    typeof window === "undefined" ? "" : window.location.search,
  );
  useEffect(() => {
    ensurePatched();
    if (typeof window === "undefined") return;
    const update = () => setSearch(window.location.search);
    window.addEventListener("locationchange", update);
    return () => {
      window.removeEventListener("locationchange", update);
    };
  }, []);
  return search;
}
