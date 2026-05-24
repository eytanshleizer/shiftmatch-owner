// Geocode a restaurant address — used by ChatOnboarding to get accurate lat/lng
// Returns exact Google Maps coordinates by querying Perplexity with web search

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { name, address, city } = req.body || {};
  if (!name && !address) return res.status(400).json({ error: "name or address required" });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Fallback: try OpenStreetMap Nominatim (no key needed)
    try {
      const q = encodeURIComponent(`${address || ""}, ${city || "Israel"}`);
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`,
        { headers: { Accept: "application/json" } }
      );
      const arr = await nomRes.json();
      if (arr?.[0]) {
        return res.status(200).json({
          lat: Number(arr[0].lat),
          lng: Number(arr[0].lon),
          verified_address: arr[0].display_name,
          source: "nominatim",
        });
      }
    } catch {}
    return res.status(200).json({ lat: null, lng: null });
  }

  const prompt = `Find the EXACT Google Maps coordinates for this restaurant in Israel:
Name: "${name || ""}"
Address: ${address || ""}
City: ${city || "Tel Aviv"}

Search Google Maps NOW. Return ONLY this JSON (no text, no markdown, no backticks):
{"lat": 32.0712, "lng": 34.7898, "verified_address": "exact street address from Google Maps"}

Coordinates must be precise to 4 decimal places. If you can't find the specific restaurant by name, geocode the address.`;

  try {
    // Try Perplexity sonar-pro first
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://restaurant-owner-app.vercel.app",
        "X-Title": "ShiftMatch",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          { role: "system", content: "You return ONLY valid JSON with exact coordinates from Google Maps." },
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
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.lat && parsed.lng) {
        return res.status(200).json({
          lat: parsed.lat,
          lng: parsed.lng,
          verified_address: parsed.verified_address || address || "",
          source: "perplexity",
        });
      }
    }
  } catch (e) {
    console.error("Geocode AI error:", e);
  }

  // Fallback to Nominatim if Perplexity failed
  try {
    const q = encodeURIComponent(`${address || ""}, ${city || "Israel"}`);
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`,
      { headers: { Accept: "application/json" } }
    );
    const arr = await nomRes.json();
    if (arr?.[0]) {
      return res.status(200).json({
        lat: Number(arr[0].lat),
        lng: Number(arr[0].lon),
        verified_address: arr[0].display_name,
        source: "nominatim",
      });
    }
  } catch {}

  return res.status(200).json({ lat: null, lng: null });
}
