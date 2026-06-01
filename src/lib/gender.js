// Gender helpers (owner side) — render a candidate's gendered Hebrew words
// from their profile.gender ("male" | "female" | "other" | null) instead of
// presuming female.

const BEGINNER = new Set(["מתחילה", "מתחיל", "מתחיל/ה", "אין ניסיון"]);

export function beginnerLabel(gender) {
  return gender === "male" ? "מתחיל" : gender === "female" ? "מתחילה" : "מתחיל/ה";
}

// Render an experience value with the correct gender for the beginner level.
export function expLabel(experience, gender) {
  if (!experience) return experience || "";
  return BEGINNER.has(String(experience).trim()) ? beginnerLabel(gender) : experience;
}
