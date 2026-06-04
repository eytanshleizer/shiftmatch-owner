// Setup-completeness helper — after signup, owners often skip filling in pay
// per position and the worker requirements, which leaves the waiter app showing
// "₪0 / לפי סיכום" and no real screening. This computes what's still missing so
// the UI can nudge them (red dot on the משרות tab + an in-tab banner).
//
// Reads the legacy mirror columns on `restaurants` (kept in sync by JobsTab):
//   position_types        – array of position names
//   position_open         – { name: bool }
//   position_salaries     – { name: hourly_rate }
//   position_requirements – { name: reqsObject }
// so callers only need the `restaurant` row (no extra fetch).

/** How many requirement fields are filled for one position (mirror of JobsTab). */
export function countSetReqs(reqs = {}) {
  let n = 0;
  if (reqs.experience) n++;
  if (reqs.age_min || reqs.age_max) n++;
  if (reqs.military) n++;
  if (reqs.high_school !== null && reqs.high_school !== undefined) n++;
  if (reqs.shifts_key) n++;
  if (reqs.weekends !== null && reqs.weekends !== undefined) n++;
  if ((reqs.custom || []).length > 0) n++;
  return n;
}

/**
 * Returns the open positions that still need pay and/or requirements.
 * Only open positions count — a closed position isn't shown to waiters.
 */
export function getSetupTasks(restaurant) {
  const types     = restaurant?.position_types || [];
  const open      = restaurant?.position_open || {};
  const salaries  = restaurant?.position_salaries || {};
  const reqs      = restaurant?.position_requirements || {};

  // A position counts as active unless explicitly closed.
  const active = types.filter((name) => open[name] !== false);

  const needSalary = active.filter((name) => !(Number(salaries[name]) > 0));
  const needReqs   = active.filter((name) => countSetReqs(reqs[name] || {}) === 0);

  const hasPositions = types.length > 0;

  return {
    hasPositions,
    needSalary,                                  // names missing pay
    needReqs,                                    // names missing requirements
    needsSalary:    needSalary.length > 0,
    needsReqs:      needReqs.length > 0,
    // Nudge from the very first step now — guide the owner end-to-end. A brand-new
    // account with no positions yet is the *first* thing we want to push them to do.
    needsAttention: !hasPositions || needSalary.length > 0 || needReqs.length > 0,
  };
}

/**
 * The current onboarding step for the guided walkthrough — a little "game guide"
 * that walks the owner through setup in order:
 *   "add"    – no positions yet → add the positions you're hiring for
 *   "salary" – positions exist but some open one is missing pay
 *   "reqs"   – pay is set but some open one is missing worker requirements
 *   null     – everything's set up, nothing to nudge
 */
export function getGuideStep(restaurant) {
  const t = getSetupTasks(restaurant);
  if (!t.hasPositions) return "add";
  if (t.needsSalary)   return "salary";
  if (t.needsReqs)     return "reqs";
  return null;
}

/** Quick boolean for the bottom-nav badge. */
export function needsSetup(restaurant) {
  return getSetupTasks(restaurant).needsAttention;
}
