// Central source of truth for what each restaurant role can do.
// Mirrors SPECS.md §2.2 — UI uses these to hide/disable controls.
// (Postgres RLS still enforces the same rules server-side.)

// Only the OWNER can add or remove user accounts (user explicit override of spec §2.2).
// Admins can still do everything else but cannot touch the team.
const CAPS = {
  owner:     ["invite", "approve", "remove", "change_role", "edit_jobs",
              "edit_whatsapp", "view_candidates", "contact_candidates",
              "edit_screening", "delete_restaurant"],
  admin:     ["edit_jobs", "edit_whatsapp", "view_candidates",
              "contact_candidates", "edit_screening"],
  manager:   ["edit_jobs", "edit_whatsapp", "view_candidates",
              "contact_candidates", "edit_screening"],
  recruiter: ["view_candidates", "contact_candidates"],
  viewer:    ["view_candidates"],
};

export function can(role, action) {
  const list = CAPS[role] || CAPS.viewer;
  return list.includes(action);
}

// Gender-inclusive role labels (Hebrew nouns conjugate for gender; the
// slash form is the standard inclusive convention).
export const ROLE_LABEL = {
  owner:     "בעל/ת המסעדה",
  admin:     "מנהל/ת ראשי/ת",
  manager:   "מנהל/ת",
  recruiter: "מגייס/ת",
  viewer:    "צפייה בלבד",
};
