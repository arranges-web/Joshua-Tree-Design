// Phone normalization to E.164. Inputs are typed by humans on a phone
// keypad — strip everything but digits + a leading "+", then apply a
// US default if no country code was provided. Returning null keeps the
// caller responsible for presenting "that doesn't look like a phone".
export function normalizeToE164(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return null;

  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  // No "+" — assume US/Canada (NANP). 10 digits → prepend +1, 11 with
  // leading 1 → prepend +. Anything else: too ambiguous to normalize.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// Pretty format for display: "+12395550101" → "(239) 555-0101".
// Falls back to the raw E.164 string for non-US numbers.
export function formatE164ForDisplay(e164: string): string {
  if (e164.startsWith("+1") && e164.length === 12) {
    const d = e164.slice(2);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return e164;
}
