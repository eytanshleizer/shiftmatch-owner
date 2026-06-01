// Shared job-requirements helpers — keep IDENTICAL in waiter-app and
// restaurant-owner-app. These turn a restaurant's hard requirements
// (mandatory shifts + weekly commitment) into a small, formal checklist that
// the waiter confirms BEFORE applying, so the owner sees a real willingness
// match instead of just "preferred shifts".
//
// Answers are stored on applications.answers under stable, namespaced keys:
//   req_weekend / req_nights / req_holidays / req_early_morning  → boolean
//   req_commitment                                               → boolean
// (Screening-question answers use the question UUID as the key, so there's no
//  collision with these `req_` keys.)

// The four hard shift requirements an owner can mark as mandatory.
// Keys MUST match the owner app's JobsTab MANDATORY_SHIFTS keys.
export const MANDATORY_SHIFTS = [
  { key: "weekend",       label: "סופי שבוע",  emoji: "🎉", question: "מוכן/ה לעבוד בסופי שבוע?" },
  { key: "nights",        label: "לילות",      emoji: "🌙", question: "מוכן/ה לעבוד במשמרות לילה?" },
  { key: "holidays",      label: "חגים",       emoji: "📅", question: "מוכן/ה לעבוד בחגים?" },
  { key: "early_morning", label: "בוקר מוקדם", emoji: "🌅", question: "מוכן/ה למשמרות בוקר מוקדם?" },
];

export const REQ_PREFIX = "req_";
export const COMMIT_KEY = "req_commitment";

// Human label for the weekly-shift commitment range.
export function commitmentLabel(min, max) {
  if (min == null && max == null) return "";
  if (min != null && max != null) {
    if (min >= 5) return "5+ משמרות בשבוע";
    if (min === max) return `${min} משמרות בשבוע`;
    return `${min}–${max} משמרות בשבוע`;
  }
  if (min != null) return `לפחות ${min} משמרות בשבוע`;
  return `עד ${max} משמרות בשבוע`;
}

// Build the list of requirements a restaurant imposes.
// Returns { shiftReqs: [...], commitment: {...}|null, list: [...] }
// where `list` is the flat ordered list of all requirement items.
export function getJobRequirements(restaurant) {
  const mand = restaurant?.mandatory_shifts || [];
  const shiftReqs = MANDATORY_SHIFTS
    .filter((s) => mand.includes(s.key))
    .map((s) => ({ ...s, type: "shift", answerKey: REQ_PREFIX + s.key }));

  const min = restaurant?.shift_commitment_min;
  const max = restaurant?.shift_commitment_max;
  let commitment = null;
  if (min != null || max != null) {
    const label = commitmentLabel(min, max);
    commitment = {
      key: "commitment",
      type: "commitment",
      label,
      emoji: "🗓️",
      answerKey: COMMIT_KEY,
      question: `המשרה דורשת ${label} — תוכל/י לעמוד בזה?`,
      min, max,
    };
  }

  const list = [...shiftReqs, ...(commitment ? [commitment] : [])];
  return { shiftReqs, commitment, list };
}

export function hasRequirements(restaurant) {
  return getJobRequirements(restaurant).list.length > 0;
}

// Score the candidate's stored answers against the restaurant's requirements.
// Returns { score: 0–100|null, perReq: { [key]: 'match'|'miss'|'unanswered' }, met, total }
export function computeReqMatch(restaurant, answers = {}) {
  const { list } = getJobRequirements(restaurant);
  if (!list.length) return { score: null, perReq: {}, met: 0, total: 0 };

  let met = 0;
  const perReq = {};
  for (const r of list) {
    const a = answers?.[r.answerKey];
    if (a === undefined || a === null) perReq[r.key] = "unanswered";
    else if (a === true) { perReq[r.key] = "match"; met++; }
    else perReq[r.key] = "miss";
  }
  return { score: Math.round((met / list.length) * 100), perReq, met, total: list.length };
}

export function reqScoreColor(score) {
  if (score == null) return { bg: "bg-gray-100", text: "text-gray-400" };
  if (score >= 75)   return { bg: "bg-green-50",  text: "text-green-600" };
  if (score >= 50)   return { bg: "bg-amber-50",  text: "text-amber-600" };
  return { bg: "bg-red-50", text: "text-red-500" };
}
