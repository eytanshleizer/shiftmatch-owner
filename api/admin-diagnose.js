// Diagnostic endpoint — checks if everything is set up correctly
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const key = req.query.key || req.headers["x-admin-key"];
  if (key !== "shiftmatch-admin-2026") return res.status(401).json({ error: "Unauthorized" });

  const SUPABASE_URL = "https://huwcyedlbcrugpbdcsdo.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dCKeIk55LDrkrmVE6rb7Bg_6Zjv1zWt";
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

  const checks = [];

  const checkTable = async (name) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${name}?select=count&limit=1`, {
        method: "HEAD",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: "count=exact" },
      });
      if (r.status === 404) return { exists: false, count: 0, status: r.status };
      const range = r.headers.get("content-range") || "";
      const count = Number((range.split("/")[1] || "0").trim());
      return { exists: true, count, status: r.status };
    } catch (e) { return { exists: false, error: e.message }; }
  };

  const checkInsert = async (table, body) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      return { ok: r.ok, status: r.status, message: text.slice(0, 200) };
    } catch (e) { return { ok: false, error: e.message }; }
  };

  // 1. Tables exist?
  for (const t of ["profiles", "restaurants", "applications", "restaurant_events"]) {
    const result = await checkTable(t);
    checks.push({
      step: `Table '${t}' exists`,
      pass: result.exists,
      details: result.exists ? `${result.count} rows visible to anon` : `404 — table not created (run the SQL)`,
    });
  }

  // 2. Get a restaurant ID for test
  const restRes = await fetch(`${SUPABASE_URL}/rest/v1/restaurants?select=id&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const rests = await restRes.json();
  const sampleRestId = rests?.[0]?.id;

  // 3. Try to insert into restaurant_events
  if (sampleRestId) {
    const r = await checkInsert("restaurant_events", {
      restaurant_id: sampleRestId,
      event_type: "click",
      source: "diagnostic",
    });
    checks.push({
      step: "Insert into restaurant_events (anon)",
      pass: r.ok,
      details: r.ok ? "Insert works ✓" : `Failed: ${r.status} ${r.message}`,
    });
  }

  // 4. Try to insert into applications
  if (sampleRestId) {
    const r = await checkInsert("applications", {
      restaurant_id: sampleRestId,
      status: "new",
    });
    checks.push({
      step: "Insert into applications (anon)",
      pass: r.ok,
      details: r.ok ? "Insert works ✓" : `Failed: ${r.status} ${r.message}`,
    });
  }

  // 5. Service key present?
  checks.push({
    step: "SUPABASE_SERVICE_KEY env var",
    pass: !!SERVICE_KEY,
    details: SERVICE_KEY ? "Set ✓" : "Missing — emails/last_login won't show",
  });

  // 6. OpenRouter key
  checks.push({
    step: "OPENROUTER_API_KEY env var",
    pass: !!process.env.OPENROUTER_API_KEY,
    details: process.env.OPENROUTER_API_KEY ? "Set ✓" : "Missing — AI search won't work",
  });

  const failed = checks.filter(c => !c.pass);

  return res.status(200).json({
    ok: failed.length === 0,
    summary: failed.length === 0 ? "All systems go ✓" : `${failed.length} issues found`,
    checks,
    fix_sql: failed.some(c => c.step.includes("Table") || c.step.includes("Insert")) ? FIX_SQL : null,
  });
}

const FIX_SQL = `-- Run in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('click','whatsapp','call')),
  source text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS recruitment_whatsapp TEXT;

CREATE INDEX IF NOT EXISTS idx_events_restaurant ON restaurant_events(restaurant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_apps_restaurant ON applications(restaurant_id);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_insert_apps" ON applications;
DROP POLICY IF EXISTS "users_read_own_apps" ON applications;
DROP POLICY IF EXISTS "anyone_insert_events" ON restaurant_events;
DROP POLICY IF EXISTS "anyone_read_events" ON restaurant_events;

CREATE POLICY "anyone_insert_apps" ON applications FOR INSERT WITH CHECK (true);
CREATE POLICY "users_read_own_apps" ON applications FOR SELECT USING (true);
CREATE POLICY "anyone_insert_events" ON restaurant_events FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone_read_events" ON restaurant_events FOR SELECT USING (true);

-- Profiles RLS — let anon read for admin dashboard (or remove this if privacy concern)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_profiles" ON profiles;
CREATE POLICY "public_read_profiles" ON profiles FOR SELECT USING (true);`;
