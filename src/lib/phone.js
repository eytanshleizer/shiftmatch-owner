// Israeli phone helpers.  We accept either a 10-digit local number (05X-XXX-XXXX)
// or an international format (+972-5X-XXX-XXXX) and normalize on save.

/**
 * Strip everything except digits, then cap at 10.  Use as input onChange filter.
 * Returns the trimmed digits-only string.
 */
export function normalizePhoneInput(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.slice(0, 10);
}

/**
 * Format 10 digits as 050-123-4567 for display.
 */
export function formatPhoneDisplay(digits) {
  const d = normalizePhoneInput(digits);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
}

/**
 * Returns true if the digits look like a valid Israeli mobile (05X-XXXXXXX).
 */
export function isValidIsraeliMobile(digits) {
  const d = normalizePhoneInput(digits);
  return /^05\d{8}$/.test(d);
}

/**
 * Strict validator used by the recruitment WhatsApp field across the app —
 * a number MUST be an Israeli mobile (05X + 8 more digits = 10 total).
 * Per user request: phone must start with "05" and be exactly 10 digits.
 */
export function isValidIsraeliPhone(digits) {
  return isValidIsraeliMobile(digits);
}
