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
 * Returns true for any 9-10 digit Israeli phone (mobile or landline).
 */
export function isValidIsraeliPhone(digits) {
  const d = normalizePhoneInput(digits);
  return d.length === 9 || d.length === 10;
}
