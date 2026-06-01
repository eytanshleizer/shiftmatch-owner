// Location display helpers — turn raw geocoded values into clean, human labels.
//
// Background: free reverse-geocoding (OpenStreetMap / Nominatim) sometimes
// returns administrative names like "נפת תל אביב" (sub-district) or
// "מחוז תל אביב" (district) instead of a city. We never want to show those.
// We also bucket Tel Aviv into north / center / south by latitude.

// Names that all mean "Tel Aviv".
const TLV_ALIASES = [
  "תל אביב", "תל אביב-יפו", "תל אביב יפו", "נפת תל אביב", "מחוז תל אביב",
  "tel aviv", "tel aviv-yafo", "tel-aviv", "tel aviv yafo",
];

// Strip administrative prefixes and normalize obvious variants to a clean city.
export function cleanCity(raw) {
  if (!raw) return "";
  let c = String(raw).trim();
  // Drop "נפת " (sub-district) / "מחוז " (district) prefixes.
  c = c.replace(/^נפת\s+/, "").replace(/^מחוז\s+/, "");
  if (isTelAviv(c)) return "תל אביב";
  return c;
}

export function isTelAviv(city) {
  if (!city) return false;
  const c = String(city).trim().toLowerCase();
  return TLV_ALIASES.some((a) => a.toLowerCase() === c) || c.includes("תל אביב");
}

// Tel Aviv north / center / south by latitude.
// North of the Yarkon (~Ramat Aviv) ≳ 32.105; Florentin/Jaffa south ≲ 32.06.
export function telAvivZone(lat) {
  if (lat == null || Number.isNaN(Number(lat))) return "תל אביב";
  const y = Number(lat);
  if (y >= 32.105) return "צפון תל אביב";
  if (y <= 32.06)  return "דרום תל אביב";
  return "מרכז תל אביב";
}

// The label to actually show. For Tel Aviv we return the zone (using lat, or a
// pre-stored area if it already looks like a zone). Every other city shows its
// clean name.
export function locationLabel({ city, area, lat, lng } = {}) {
  const clean = cleanCity(city);
  if (isTelAviv(clean)) {
    // If an explicit zone was stored as area, trust it.
    if (area && /תל אביב/.test(area)) return area;
    if (lat != null) return telAvivZone(lat);
    return "תל אביב";
  }
  return clean;
}
