// Fix lat/lng for all seeded restaurants by querying real Google Maps via Perplexity
// Usage: OPENROUTER_API_KEY=sk-or-... SUPABASE_URL=... SUPABASE_KEY=... node fix-restaurant-locations.mjs

const SUPABASE_URL = process.env.SUPABASE_URL || "https://huwcyedlbcrugpbdcsdo.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_dCKeIk55LDrkrmVE6rb7Bg_6Zjv1zWt";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_KEY) {
  console.error("Missing OPENROUTER_API_KEY");
  process.exit(1);
}

// Step 1: Fetch all seeded restaurants
const fetchRestaurants = async () => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/restaurants?select=id,name,city,address,lat,lng&owner_id=is.null`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return res.json();
};

// Step 2: For each restaurant, ask Perplexity for its exact Google Maps lat/lng
const findCoords = async (name, address, city) => {
  const prompt = `Find the EXACT Google Maps coordinates (latitude, longitude) for this restaurant:

Restaurant: "${name}"
Address: ${address}
City: ${city}

Search Google Maps right now. Return ONLY a JSON object like this — no text, no markdown:
{"lat": 32.0712, "lng": 34.7898, "verified_address": "actual address from Google Maps"}

If you cannot find the exact location, return: {"lat": null, "lng": null, "verified_address": ""}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "https://restaurant-owner-app.vercel.app",
        "X-Title": "ShiftMatch",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          { role: "system", content: "You return only valid JSON with exact coordinates from Google Maps." },
          { role: "user", content: prompt },
        ],
        temperature: 0,
      }),
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    return null;
  }
};

// Main
const main = async () => {
  console.log("🔍 Fetching restaurants...");
  const restaurants = await fetchRestaurants();
  console.log(`Found ${restaurants.length} seeded restaurants\n`);

  const sqlStatements = [];

  for (const r of restaurants) {
    process.stdout.write(`Looking up: ${r.name}... `);
    const result = await findCoords(r.name, r.address, r.city);

    if (result?.lat && result?.lng) {
      const oldDist = r.lat && r.lng
        ? Math.round(
            Math.sqrt(
              Math.pow((result.lat - r.lat) * 111, 2) +
              Math.pow((result.lng - r.lng) * 88, 2)
            ) * 1000
          )
        : null;

      const status = oldDist != null && oldDist < 100 ? "✓ accurate" : `📍 fix (was ${oldDist}m off)`;
      console.log(`${result.lat}, ${result.lng} ${status}`);

      sqlStatements.push(
        `UPDATE restaurants SET lat=${result.lat}, lng=${result.lng}` +
        (result.verified_address ? `, address='${result.verified_address.replace(/'/g, "''")}'` : "") +
        ` WHERE id='${r.id}'; -- ${r.name}`
      );
    } else {
      console.log("❌ not found");
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 800));
  }

  console.log("\n\n═══════════════════════════════════════════════");
  console.log("SQL — run this in Supabase SQL Editor:");
  console.log("═══════════════════════════════════════════════\n");
  console.log(sqlStatements.join("\n"));
};

main().catch(e => { console.error(e); process.exit(1); });
