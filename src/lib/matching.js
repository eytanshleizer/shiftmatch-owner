// Lightweight per-candidate scoring helper.
//
// For each screening question we infer an "ideal" answer based on
// the restaurant's settings (mandatory shifts, soft attributes, etc).
// The score is just the % of answered questions whose answer matched
// the inference.  Conservative: questions without an inferable ideal
// are scored as neutral (don't hurt, don't help).
//
// Returns { score: 0–100, perAnswer: { [questionId]: 'match'|'miss'|'neutral'|'unanswered' } }

const BOOLEAN_LIBRARY_PREFERENCES = {
  // For these library questions, "true" is the preferred answer
  available_weekends: "any-true-if-mandatory:weekend",
  available_nights:   "any-true-if-mandatory:nights",
  health_card:        true,
  has_car:            null, // soft attr based
  fine_dining_exp:    null, // soft attr based
  bar_course:         null,
  cocktail_knowledge: null,
};

export function computeMatch(restaurant, questions = [], answers = {}) {
  if (!questions.length) return { score: null, perAnswer: {} };

  const mandShifts = new Set(restaurant?.mandatory_shifts || []);
  const softAttrs  = new Set(restaurant?.soft_attributes || []);

  let scored = 0; // questions that contribute to score
  let matches = 0;
  const perAnswer = {};

  for (const q of questions) {
    const a = answers?.[q.id];
    const isAnswered = a !== undefined && a !== null && a !== "" &&
      !(Array.isArray(a) && a.length === 0);

    if (!isAnswered) {
      perAnswer[q.id] = "unanswered";
      if (q.required) {
        // Required + unanswered counts against the candidate
        scored++;
      }
      continue;
    }

    let ideal = null;

    // Booleans from the library: derive preference from restaurant
    if (q.type === "boolean") {
      if (q.library_key === "available_weekends") {
        if (mandShifts.has("weekend")) ideal = true;
      } else if (q.library_key === "available_nights") {
        if (mandShifts.has("nights")) ideal = true;
      } else if (q.library_key === "health_card") {
        ideal = true;
      } else if (q.library_key === "has_car" && softAttrs.has("car_required")) {
        ideal = true;
      } else if (q.library_key === "fine_dining_exp" && softAttrs.has("experienced")) {
        ideal = true;
      } else if (q.library_key === "bar_course" || q.library_key === "cocktail_knowledge") {
        // Bar role: prefer true.  We can't know the role here, so it's neutral.
        ideal = null;
      }
    }

    if (q.type === "select" && q.library_key === "hebrew_level") {
      if (softAttrs.has("hebrew_native")) ideal = "שפת אם";
    }
    if (q.type === "select" && q.library_key === "english_level") {
      if (softAttrs.has("english_required")) ideal = "שוטף"; // or "שפת אם"
    }
    if (q.type === "select" && q.library_key === "experience_years") {
      if (softAttrs.has("experienced"))   ideal = "5+";
      if (softAttrs.has("beginners_ok"))  ideal = null;
    }

    // No ideal → neutral (don't count toward score)
    if (ideal === null) {
      perAnswer[q.id] = "neutral";
      continue;
    }

    scored++;
    const isMatch =
      (typeof ideal === "boolean") ? Boolean(a) === ideal :
      (Array.isArray(a))           ? a.includes(ideal) :
                                      String(a) === String(ideal);
    if (isMatch) { matches++; perAnswer[q.id] = "match"; }
    else { perAnswer[q.id] = "miss"; }
  }

  const score = scored === 0 ? null : Math.round((matches / scored) * 100);
  return { score, perAnswer };
}

export function scoreColor(score) {
  if (score == null) return { bg: "bg-white/8", text: "text-gray-400" };
  if (score >= 75)   return { bg: "bg-green-500/15", text: "text-green-400" };
  if (score >= 50)   return { bg: "bg-amber-500/15", text: "text-amber-400" };
  return { bg: "bg-red-500/15", text: "text-red-400" };
}
