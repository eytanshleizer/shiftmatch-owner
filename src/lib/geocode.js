// geocode.js — turn a typed address into EXACT coordinates.
//
// Prefers Google Maps (far more accurate for Israeli addresses) and falls back
// to free OpenStreetMap / Nominatim when no key is configured or Google fails.
// Google is loaded through the Maps JavaScript SDK so a website-restricted key
// (the recommended, safe kind) works straight from the browser.

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const hasGoogleMaps = !!GOOGLE_KEY;

let mapsPromise = null;
function loadGoogleMaps() {
  if (!GOOGLE_KEY) return Promise.reject(new Error("no key"));
  if (window.google?.maps?.Geocoder) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places&language=he&region=IL`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google.maps);
    s.onerror = () => reject(new Error("maps load failed"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

function pickCity(components = []) {
  const find = (t) => components.find((c) => c.types.includes(t));
  const c = find("locality") || find("administrative_area_level_2") || find("postal_town");
  return c?.long_name || "";
}

async function googleGeocode(address) {
  const maps = await loadGoogleMaps();
  const geocoder = new maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address, region: "IL" }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const r = results[0];
        const loc = r.geometry.location;
        resolve({
          lat: loc.lat(),
          lng: loc.lng(),
          city: pickCity(r.address_components),
          formatted: r.formatted_address,
          source: "google",
        });
      } else {
        resolve(null);
      }
    });
  });
}

async function osmGeocode(address) {
  const q = encodeURIComponent(`${address}, Israel`);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${q}&limit=1&accept-language=he`,
    { headers: { Accept: "application/json" } }
  );
  const arr = await res.json();
  if (!arr?.[0]) return null;
  const a = arr[0].address || {};
  const city =
    a.city || a.town || a.village || a.municipality || a.suburb ||
    arr[0].display_name.split(",")[0];
  return {
    lat: Number(arr[0].lat),
    lng: Number(arr[0].lon),
    city: city || "",
    formatted: arr[0].display_name,
    source: "osm",
  };
}

// Resolve to `fallback` if `p` doesn't settle within `ms` — so a hung SDK load
// or a slow/blocked geocoding request can never freeze the caller (e.g. the
// Settings "save" button spinning forever).
function withTimeout(p, ms, fallback = null) {
  return Promise.race([
    p,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Returns { lat, lng, city, formatted, source } or null.
// Hard-capped so it never blocks a save: at most ~5s on Google, ~5s on OSM.
export async function geocodeAddress(address) {
  if (!address || !String(address).trim()) return null;
  const q = `${String(address).trim()}, ישראל`;
  if (GOOGLE_KEY) {
    try {
      const g = await withTimeout(googleGeocode(q), 5000);
      if (g) return g;
    } catch { /* fall back to OSM below */ }
  }
  try { return await withTimeout(osmGeocode(address), 5000); } catch { return null; }
}
