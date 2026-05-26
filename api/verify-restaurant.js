// POST /api/verify-restaurant
//   body: { name: string, city: string }
//   returns: { ok, already_taken, exists_on_web, verification_source, ... }
//
// We avoid the @supabase/supabase-js import to keep this function lean —
// PostgREST + anon key is enough for a simple "already claimed?" lookup.

const SUPA_URL  = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPA_KEY  = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ ok: false, error: "POST only" });

  const { name, city } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "missing name" });

  const cleanName = String(name).trim();
  const cleanCity = String(city || "").trim();

  // ── 1. DB check via PostgREST ─────────────────────────────────────
  let already_taken = false;
  try {
    if (SUPA_URL && SUPA_KEY) {
      const q = new URL(`${SUPA_URL}/rest/v1/restaurants`);
      q.searchParams.set("select", "id,owner_id");
      q.searchParams.set("name",   `ilike.${cleanName}`);
      q.searchParams.set("city",   `ilike.${cleanCity}`);
      q.searchParams.set("owner_id", "not.is.null");
      q.searchParams.set("active", "eq.true");
      q.searchParams.set("limit", "1");
      const r = await fetch(q.toString(), {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      });
      if (r.ok) {
        const rows = await r.json();
        already_taken = Array.isArray(rows) && rows.length > 0;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("verify-restaurant db check failed:", e?.message);
  }

  // ── 2. Google Places existence check (optional) ───────────────────
  let exists_on_web        = null;
  let verification_source  = "db_only";
  let google_place_id, suggested_address, lat, lng;

  if (PLACES_KEY) {
    try {
      const q = encodeURIComponent(`${cleanName} ${cleanCity} restaurant`);
      const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
                  `?input=${q}&inputtype=textquery` +
                  `&fields=place_id,formatted_address,geometry,name` +
                  `&language=he&key=${PLACES_KEY}`;
      const r = await fetch(url);
      const j = await r.json();
      const candidate = j?.candidates?.[0];
      if (candidate) {
        exists_on_web        = true;
        verification_source  = "google_places";
        google_place_id      = candidate.place_id;
        suggested_address    = candidate.formatted_address;
        lat                  = candidate.geometry?.location?.lat;
        lng                  = candidate.geometry?.location?.lng;
      } else {
        exists_on_web = false;
        verification_source = "google_places";
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("places api call failed:", e?.message);
    }
  }

  return res.status(200).json({
    ok: true,
    already_taken,
    exists_on_web,
    verification_source,
    google_place_id,
    suggested_address,
    lat, lng,
  });
}
