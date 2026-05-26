// POST /api/verify-restaurant
//   body: { name: string, city: string }
//   returns: {
//     ok: true,
//     already_taken: boolean,      // someone already owns this name+city in our DB
//     exists_on_web: boolean | null,  // null = couldn't check
//     verification_source: "google_places" | "db_only",
//     google_place_id?: string,
//     suggested_address?: string,
//     lat?: number, lng?: number
//   }
//
// Strategy:
//   1. ALWAYS check our DB for a claimed restaurant with the same name+city
//      (case-insensitive).  Cheap and reliable.
//   2. If GOOGLE_PLACES_API_KEY is set, also query Places to confirm the
//      restaurant exists in the real world.  Without the key we return
//      exists_on_web: null (UI handles this gracefully).

import { createClient } from "@supabase/supabase-js";

const SUPA_URL  = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPA_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

export default async function handler(req, res) {
  // CORS — same convention as our other api/ routes.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ ok: false, error: "POST only" });

  const { name, city } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "missing name" });

  const cleanName = String(name).trim();
  const cleanCity = String(city || "").trim();

  // ── 1. DB check (always runs) ───────────────────────────────────────
  let already_taken = false;
  try {
    if (SUPA_URL && SUPA_KEY) {
      const supa = createClient(SUPA_URL, SUPA_KEY);
      const { data } = await supa
        .from("restaurants")
        .select("id, owner_id")
        .ilike("name", cleanName)
        .ilike("city", cleanCity)
        .not("owner_id", "is", null)
        .eq("active", true)
        .limit(1);
      already_taken = (data || []).length > 0;
    }
  } catch (e) {
    // Non-fatal — keep going so signup isn't blocked by infra hiccups.
    // eslint-disable-next-line no-console
    console.error("verify-restaurant db check failed:", e?.message);
  }

  // ── 2. Google Places existence check (optional) ─────────────────────
  let exists_on_web        = null;     // null = unknown (no key or call failed)
  let verification_source  = "db_only";
  let google_place_id, suggested_address, lat, lng;

  if (PLACES_KEY) {
    try {
      const q = encodeURIComponent(`${cleanName} ${cleanCity} restaurant`);
      const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
                  `?input=${q}` +
                  `&inputtype=textquery` +
                  `&fields=place_id,formatted_address,geometry,name` +
                  `&language=he` +
                  `&key=${PLACES_KEY}`;
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
      }
    } catch (e) {
      // Network/quota error — leave exists_on_web as null.
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
