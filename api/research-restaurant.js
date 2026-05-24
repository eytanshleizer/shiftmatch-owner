// Restaurant research using Perplexity sonar-pro (real-time web search)
// Returns multiple candidates with REAL data — no fabrication

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { name, city, isChain, branchLocation } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "Restaurant name required" });

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(200).json({ found: false, candidates: [], fallback: true });

  const locationHint = branchLocation || city || "Israel";

  const systemPrompt = `You are an elite restaurant researcher with real-time web search.
Your task: find REAL restaurants on Google, TripAdvisor, rest.co.il, zap.co.il, Wolt, Mishlohim, Tabit, and Instagram.
You search aggressively in BOTH Hebrew (e.g., אבא, פופינה, מסעדת אבא) AND English (Abba, Popina).
You NEVER invent data. If a field is not in your search results, leave it empty.
Output: valid JSON only, no markdown, no commentary, no citation footnotes.`;

  const userPrompt = `Search the web RIGHT NOW for the restaurant "${name}" in ${locationHint}, Israel.

Search aggressively with these queries (try ALL of them):
1. "${name}" restaurant Israel site:google.com/maps
2. "${name}" מסעדה ${locationHint} site:rest.co.il OR site:zap.co.il
3. "${name}" ${locationHint} site:wolt.com OR site:mishloha.co.il
4. "${name}" instagram restaurant Israel
5. "${name}" tripadvisor Israel
${isChain ? `6. "${name}" chain branches Israel
7. "${name}" סניפים ישראל` : ""}

Also try TRANSLITERATIONS:
- Hebrew name → English (e.g. אבא → Abba, פופינה → Popina)
- English name → Hebrew (e.g. Abraxas → אבראקסס, BBB → ביבי בי)

And SIMILAR spellings (in case of typo):
- Try removing/adding common letters
- Try the name with/without "מסעדת" prefix

For EACH real restaurant you find on the web (up to 5), extract REAL information.

Output this exact JSON shape (no markdown, no text outside the JSON):

{
  "candidates": [
    {
      "name": "exact name as found on Google/Wolt",
      "type": "סוג בעברית (שף / איטלקי / אסייתי / סטייקייה / בר / בית קפה / מזון מהיר / ים תיכוני)",
      "cuisine": "מטבח עיקרי בעברית",
      "city": "עיר בעברית",
      "area": "שכונה בעברית (אם ידוע)",
      "address": "כתובת מדויקת כפי שהיא ב-Google Maps",
      "description": "תיאור של 1-2 משפטים בעברית על המסעדה לפי ביקורות אמיתיות",
      "vibe": "high-end | casual | family | nightlife | cafe | fast",
      "price_range": "₪ | ₪₪ | ₪₪₪ | ₪₪₪₪",
      "phone": "טלפון מ-Google או מהאתר הרשמי",
      "instagram": "@username מהאינסטגרם הרשמי",
      "website": "URL של האתר הרשמי",
      "known_for": ["מנה/דבר מפורסם 1", "מפורסם 2", "מפורסם 3"],
      "typical_hourly_wage_range": "₪40-₪55",
      "typical_requirements": ["דרישה ריאלית 1", "2", "3"],
      "typical_benefits": ["הטבה אופיינית 1", "2", "3"],
      "shifts_typical": ["בוקר", "ערב"]
    }
  ]
}

STRICT RULES:
- Every restaurant MUST be one you actually found on the web — no inventing
- Address, phone, Instagram, website: only include if you actually found them in your search (leave empty "" if not)
- For typical_hourly_wage_range, typical_requirements, typical_benefits, shifts_typical: ALWAYS fill these in based on the restaurant TYPE (e.g., a high-end chef restaurant pays ₪50-₪70, requires experience+English; a fast food place pays ₪35-₪45). These are industry estimates, not lookups.
- If you find 0 real matches, return: {"candidates": []}
- Output ONLY the JSON object, nothing else`;

  const callAI = async (model) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://restaurant-owner-app.vercel.app",
        "X-Title": "ShiftMatch",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });
    const data = await response.json();

    if (data.error) throw new Error(`API error: ${JSON.stringify(data.error)}`);

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(`No content from ${model}`);

    // Robust JSON extraction — handle markdown, citations, extra text
    let clean = content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/\[\d+\]/g, "")    // remove [1], [2] citations
      .replace(/\[citation:.*?\]/g, "") // remove citation markers
      .trim();

    // Extract the JSON object
    const start = clean.indexOf("{");
    const end   = clean.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON found in response");
    clean = clean.slice(start, end + 1);

    return JSON.parse(clean);
  };

  // Try models in order of effectiveness for web search
  const models = [
    "perplexity/sonar-pro",          // best web search
    "perplexity/sonar-deep-research", // deeper but slower
    "perplexity/sonar",               // basic fallback
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log(`[research-restaurant] Trying ${model} for "${name}"`);
      const result = await callAI(model);
      const candidates = Array.isArray(result.candidates) ? result.candidates : [];
      console.log(`[research-restaurant] ${model} returned ${candidates.length} candidates`);

      // Filter: must have name + at least one useful detail (address or phone or website)
      const valid = candidates.filter(c => {
        if (!c || !c.name || c.name.trim().length < 2) return false;
        const hasDetails = (c.address && c.address.trim()) ||
                           (c.phone && c.phone.trim()) ||
                           (c.website && c.website.trim()) ||
                           (c.instagram && c.instagram.trim());
        return hasDetails;
      });

      if (valid.length > 0) {
        return res.status(200).json({
          found: true,
          candidates: valid,
          model_used: model,
        });
      }
      // If no candidates from this model, try next
      lastError = `No valid candidates from ${model}`;
    } catch (err) {
      console.error(`[research-restaurant] ${model} failed:`, err.message);
      lastError = err.message;
    }
  }

  return res.status(200).json({
    found: false,
    candidates: [],
    error: lastError || "All models failed",
  });
}
