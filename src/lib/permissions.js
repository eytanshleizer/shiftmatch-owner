// Central source of truth for what each restaurant role can do.
// Mirrors SPECS.md §2.2 — UI uses these to hide/disable controls.
// (Postgres RLS still enforces the same rules server-side.)

const CAPS = {
  owner:     ["invite", "approve", "remove", "change_role", "edit_jobs",
              "edit_whatsapp", "view_candidates", "contact_candidates",
              "edit_screening", "delete_restaurant"],
  admin:     ["invite", "approve", "remove_non_owner", "change_role_non_owner",
              "edit_jobs", "edit_whatsapp", "view_candidates",
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

export const ROLE_LABEL = {
  owner:     "בעלים",
  admin:     "מנהל ראשי",
  manager:   "מנהל",
  recruiter: "מגייס",
  viewer:    "צפייה בלבד",
};
