import { useSearch } from "wouter";

// Thin wrapper over wouter's own useSearch so the rest of the app
// gets a `?key=value` style search string (with leading "?") that
// updates whenever wouter navigates. Wouter's hook returns the
// search WITHOUT the leading "?", so we normalize here.
//
// Earlier this hook tried to monkey-patch history.pushState /
// replaceState to fire a synthetic event. That fought with wouter's
// own internal patching and broke navigation on the Accounting page
// (and crashed the runtime overlay). Delegating to wouter is both
// shorter and bug-free.
export function useUrlSearch(): string {
  const raw = useSearch();
  if (!raw) return "";
  return raw.startsWith("?") ? raw : `?${raw}`;
}
