# Restaurant Location Protocol

## Goal
Every restaurant in the database must have **accurate Google Maps coordinates** (`lat`, `lng`) so the waiter app's distance filtering and map view work correctly.

## How Locations Are Set

### 1. New restaurants (automatic — no manual work)
When a restaurant owner completes the AI chat onboarding (`ChatOnboarding.jsx`):
1. AI researches the restaurant via Perplexity and proposes address candidates
2. Owner picks one (or confirms the auto-detected one)
3. Before saving, the app calls `/api/geocode-address` which:
   - Queries Perplexity (`sonar-pro` model) for the exact Google Maps lat/lng
   - Falls back to OpenStreetMap Nominatim if Perplexity fails
4. The verified coordinates are saved to the `restaurants` table

This means every restaurant added via the AI flow gets accurate coordinates automatically — no manual intervention.

### 2. Seeded / existing restaurants (one-time fix)
For restaurants added manually or imported, run the admin endpoint:

```bash
curl -X POST https://restaurant-owner-app.vercel.app/api/admin-fix-locations \
  -H "x-admin-key: shiftmatch-admin-2026"
```

This:
- Fetches all restaurants where `owner_id IS NULL` (seeded ones)
- For each, queries Perplexity to find the real Google Maps location
- Retries with `sonar-deep-research` model if the first lookup fails
- Updates the `lat`, `lng`, and `address` columns directly in Supabase
- Returns a summary + the SQL statements (in case direct update is blocked)

## Verification Checklist
After any bulk update, verify accuracy:
- [ ] Open the waiter app's map view
- [ ] Check that restaurant markers appear on the correct streets
- [ ] Verify a few well-known restaurants by clicking them
- [ ] Check the distance shown to a candidate's home address looks reasonable

## When Restaurant Owners Update Their Address
If an owner edits their address later, the same geocoding endpoint runs:
- Re-geocodes the new address
- Updates `lat`, `lng`, and `address`

This is currently triggered only on initial setup. To re-geocode on edit, call `/api/geocode-address` from the edit form.

## API Endpoints

### `POST /api/geocode-address`
Public — used by ChatOnboarding.
- **Body:** `{ name, address, city }`
- **Returns:** `{ lat, lng, verified_address, source: "perplexity" | "nominatim" }`

### `POST /api/admin-fix-locations`
Admin-only — bulk-fix all seeded restaurants.
- **Header:** `x-admin-key: shiftmatch-admin-2026`
- **Returns:** summary + SQL statements + direct-update results

## Models Used
- **Primary:** `perplexity/sonar-pro` (web search, fastest)
- **Fallback:** `perplexity/sonar-deep-research` (more thorough, slower)
- **Last resort:** OpenStreetMap Nominatim (free, no key)

## Maintenance
- If many restaurants show wrong locations, run `/api/admin-fix-locations` again
- Add a `geocoded_at` timestamp column if you want to track when each was last verified
- Re-geocode any restaurant that doesn't have `lat`/`lng` set or has very old coordinates
