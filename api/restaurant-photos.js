// GET /api/restaurant-photos?name=Benedict&city=Tel+Aviv&type=בית+קפה
//
// Returns up to 4 photo URLs for a restaurant.
// Strategy 1: Google Places API (if GOOGLE_PLACES_API_KEY is set) → real photos.
// Strategy 2: Curated Unsplash CDN URLs per restaurant type (always works, no key needed).

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Verified Unsplash photo IDs — direct CDN, no API key, permanent URLs.
const PHOTOS_BY_TYPE = {
  "סושי":       ["1617196034183-421b4040ed20","1553621042-f6e147245754","1583623025817-d180a2221d0a","1414235077428-338989a2e8c0"],
  "איטלקי":     ["1551183053-bf91798d047e","1565299624946-b28f40a0ae38","1555396273-367ea4eb4db5","1414235077428-338989a2e8c0"],
  "פיצה":       ["1565299624946-b28f40a0ae38","1551183053-bf91798d047e","1555396273-367ea4eb4db5","1517248135467-4c7edcad34c4"],
  "בר":         ["1514362545857-3bc16c4c7d1b","1517248135467-4c7edcad34c4","1428515613728-6b4607e44363","1555396273-367ea4eb4db5"],
  "בית קפה":    ["1495474472287-4d71bcdd2085","1509042239860-f550ce710b93","1517248135467-4c7edcad34c4","1414235077428-338989a2e8c0"],
  "מזון מהיר":  ["1568901346375-23c9450c58cd","1586190848861-99aa4a171e90","1555243896-1b23741d0d30","1517248135467-4c7edcad34c4"],
  "המבורגרים":  ["1568901346375-23c9450c58cd","1586190848861-99aa4a171e90","1555243896-1b23741d0d30","1517248135467-4c7edcad34c4"],
  "בשרייה":     ["1544025162-d76538407164","1558618666-fcd25c85cd64","1529193591184-b1d58069ecdd","1428515613728-6b4607e44363"],
  "מסעדת שף":   ["1414235077428-338989a2e8c0","1517248135467-4c7edcad34c4","1555396273-367ea4eb4db5","1428515613728-6b4607e44363"],
  "ים-תיכוני":  ["1555396273-367ea4eb4db5","1414235077428-338989a2e8c0","1517248135467-4c7edcad34c4","1428515613728-6b4607e44363"],
  "אסייתי":     ["1617196034183-421b4040ed20","1553621042-f6e147245754","1555396273-367ea4eb4db5","1414235077428-338989a2e8c0"],
  "ישראלי":     ["1555396273-367ea4eb4db5","1517248135467-4c7edcad34c4","1414235077428-338989a2e8c0","1428515613728-6b4607e44363"],
};

const DEFAULT_PHOTO_IDS = [
  "1517248135467-4c7edcad34c4",
  "1414235077428-338989a2e8c0",
  "1555396273-367ea4eb4db5",
  "1428515613728-6b4607e44363",
];

function unsplashUrl(id) {
  return `https://images.unsplash.com/photo-${id}?w=600&q=80&fit=crop`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const { name = "", city = "", type = "" } = req.query;

  // ── Strategy 1: Google Places photos ──────────────────────────────────────
  if (PLACES_KEY && name.trim()) {
    try {
      const q = encodeURIComponent(`${name.trim()} ${city.trim()} restaurant`);
      const findRes  = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
        `?input=${q}&inputtype=textquery&fields=place_id&language=he&key=${PLACES_KEY}`
      );
      const findData = await findRes.json();
      const placeId  = findData?.candidates?.[0]?.place_id;

      if (placeId) {
        const detailRes  = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json` +
          `?place_id=${placeId}&fields=photos&key=${PLACES_KEY}`
        );
        const detailData = await detailRes.json();
        const refs = (detailData?.result?.photos || [])
          .slice(0, 4)
          .map((p) => p.photo_reference);

        if (refs.length > 0) {
          const photos = [];
          for (const ref of refs) {
            try {
              const r = await fetch(
                `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${ref}&key=${PLACES_KEY}`,
                { redirect: "follow" }
              );
              if (r.ok && r.url && !r.url.includes("googleapis.com/maps/api/place/photo")) {
                photos.push(r.url);
              }
            } catch { /* skip */ }
          }
          if (photos.length > 0) {
            return res.status(200).json({ photos, source: "google_places" });
          }
        }
      }
    } catch (e) {
      console.error("[restaurant-photos] Google Places failed:", e.message);
    }
  }

  // ── Strategy 2: Curated Unsplash by type (always works) ───────────────────
  const ids    = PHOTOS_BY_TYPE[type.trim()] || DEFAULT_PHOTO_IDS;
  const photos = ids.map(unsplashUrl);

  return res.status(200).json({ photos, source: "unsplash_curated" });
}
