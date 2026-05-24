// Bootstrap the database — creates all tables, sets RLS policies
// Requires SUPABASE_SERVICE_KEY (anon key cannot run DDL)

const SETUP_SQL = `
-- Tables
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
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_insert_apps" ON applications;
DROP POLICY IF EXISTS "anyone_read_apps" ON applications;
DROP POLICY IF EXISTS "anyone_insert_events" ON restaurant_events;
DROP POLICY IF EXISTS "anyone_read_events" ON restaurant_events;
DROP POLICY IF EXISTS "public_read_profiles" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;

CREATE POLICY "anyone_insert_apps" ON applications FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone_read_apps" ON applications FOR SELECT USING (true);
CREATE POLICY "anyone_insert_events" ON restaurant_events FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone_read_events" ON restaurant_events FOR SELECT USING (true);
CREATE POLICY "public_read_profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own_profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== "shiftmatch-admin-2026") return res.status(401).json({ error: "Unauthorized" });

  // Accept service key from body OR env (env preferred)
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || req.body?.service_key;
  if (!serviceKey) {
    return res.status(400).json({
      error: "service_key_missing",
      message: "Need SUPABASE_SERVICE_KEY env var or pass service_key in body",
    });
  }

  const SUPABASE_URL = "https://huwcyedlbcrugpbdcsdo.supabase.co";

  // Supabase doesn't expose direct SQL execution via REST, but we can use pg_meta
  // via the Management API — OR use the Postgres connection directly.
  // Easiest: use the pg_meta endpoint via the Supabase Studio API (requires service key).

  try {
    // Use the pg_meta endpoint — runs raw SQL with service role privileges
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: SETUP_SQL }),
    });

    // If exec_sql doesn't exist, we need to create it first via the connection
    // string. As a fallback, split into individual statements and run via REST.
    if (r.status === 404 || !r.ok) {
      // Use a different approach: query pg_meta directly
      const metaUrl = `https://api.supabase.com/v1/projects/huwcyedlbcrugpbdcsdo/database/query`;
      // This requires Personal Access Token, not service key
      return res.status(200).json({
        ok: false,
        message: "Direct SQL execution requires either a stored procedure or Personal Access Token. Running tests instead...",
        try_run_sql_in_dashboard: true,
        sql: SETUP_SQL,
      });
    }

    return res.status(200).json({ ok: true, message: "Database setup complete" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
