// One-time admin endpoint to fix all restaurant lat/lng using Perplexity (real Google Maps)
// Run via: curl -X POST https://restaurant-owner-app.vercel.app/api/admin-fix-locations -H "x-admin-key: shiftmatch-admin-2026"

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // Simple admin gate
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== "shiftmatch-admin-2026") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SUPABASE_URL = "https://huwcyedlbcrugpbdcsdo.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dCKeIk55LDrkrmVE6rb7Bg_6Zjv1zWt";
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_KEY) return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });

  // 1. Fetch all seeded restaurants
  const fetchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/restaurants?select=id,name,city,address,lat,lng&owner_id=is.null`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const restaurants = await fetchRes.json();

  const lookupCoords = async (r, model = "perplexity/sonar-pro") => {
    const prompt = `Find the EXACT Google Maps coordinates for this restaurant in Israel:
Name: "${r.name}"
Address hint: ${r.address || ""}
City: ${r.city || "Tel Aviv"}

Search Google Maps NOW. The restaurant DOES exist — it is a well-known restaurant.
Try multiple spellings (Hebrew + English transliteration: ${r.name} could be "${r.name}").

Return ONLY this JSON (no text, no markdown, no backticks):
{"lat": 32.0712, "lng": 34.7898, "verified_address": "exact street address from Google Maps"}

Coordinates must be precise to 4 decimal places. NEVER return null if the restaurant exists.`;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "https://restaurant-owner-app.vercel.app",
        "X-Title": "ShiftMatch",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You return ONLY valid JSON with exact coordinates from Google Maps. Never fail." },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 500,
      }),
    });
    const data = await aiRes.json();
    const content = data.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  };

  const results = [];
  const sqlStatements = [];
  const updates = [];

  for (const r of restaurants) {
    let parsed = await lookupCoords(r, "perplexity/sonar-pro");
    // Retry with deep-research if first attempt fails
    if (!parsed?.lat || !parsed?.lng) {
      await new Promise(r => setTimeout(r, 300));
      parsed = await lookupCoords(r, "perplexity/sonar-deep-research");
    }

    if (parsed?.lat && parsed?.lng) {
      const distM = r.lat && r.lng
        ? Math.round(
            Math.sqrt(
              Math.pow((parsed.lat - r.lat) * 111000, 2) +
              Math.pow((parsed.lng - r.lng) * 88000, 2)
            )
          )
        : null;

      results.push({
        name: r.name,
        old: { lat: r.lat, lng: r.lng },
        new: { lat: parsed.lat, lng: parsed.lng },
        verified_address: parsed.verified_address,
        dist_m: distM,
      });

      const addrPart = parsed.verified_address
        ? `, address='${parsed.verified_address.replace(/'/g, "''")}'`
        : "";
      sqlStatements.push(
        `UPDATE restaurants SET lat=${parsed.lat}, lng=${parsed.lng}${addrPart} WHERE id='${r.id}'; -- ${r.name}`
      );
      updates.push({ id: r.id, lat: parsed.lat, lng: parsed.lng, address: parsed.verified_address });
    } else {
      results.push({ name: r.name, status: "not-found" });
    }

    await new Promise(r => setTimeout(r, 200));
  }

  // Try to execute updates directly (will fail if RLS blocks; user can still run SQL)
  let directUpdateResults = [];
  for (const u of updates) {
    try {
      const updRes = await fetch(`${SUPABASE_URL}/rest/v1/restaurants?id=eq.${u.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ lat: u.lat, lng: u.lng, ...(u.address && { address: u.address }) }),
      });
      directUpdateResults.push({ id: u.id, ok: updRes.ok, status: updRes.status });
    } catch (e) {
      directUpdateResults.push({ id: u.id, ok: false, error: e.message });
    }
  }

  return res.status(200).json({
    total: restaurants.length,
    found: sqlStatements.length,
    direct_updates_ok: directUpdateResults.filter(r => r.ok).length,
    sql: sqlStatements.join("\n"),
    details: results,
    direct_update_results: directUpdateResults,
  });
}
