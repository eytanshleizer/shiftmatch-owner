// Admin dashboard data — fetches all waiters + restaurants with last login + activity
// Uses SUPABASE_SERVICE_KEY to bypass RLS

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  // Simple admin password gate
  const adminKey = req.query.key || req.headers["x-admin-key"];
  if (adminKey !== "shiftmatch-admin-2026") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SUPABASE_URL = "https://huwcyedlbcrugpbdcsdo.supabase.co";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const PUBLIC_KEY  = "sb_publishable_dCKeIk55LDrkrmVE6rb7Bg_6Zjv1zWt";
  const key = SERVICE_KEY || PUBLIC_KEY;

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  try {
    // Fetch all profiles (waiters + restaurant owners)
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=*&order=created_at.desc`,
      { headers }
    );
    const profiles = await profilesRes.json();

    // Fetch ALL restaurants (including seeded with owner_id IS NULL)
    const restaurantsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/restaurants?select=*&order=created_at.desc`,
      { headers }
    );
    const restaurants = await restaurantsRes.json();

    // Fetch applications (legacy)
    const appsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/applications?select=user_id,restaurant_id,status,created_at&order=created_at.desc`,
      { headers }
    );
    const appsJson = await appsRes.json();
    const applications = Array.isArray(appsJson) ? appsJson : [];

    // Fetch restaurant_events (new fine-grained tracking)
    const eventsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/restaurant_events?select=user_id,restaurant_id,event_type,source,created_at&order=created_at.desc`,
      { headers }
    );
    const eventsJson = await eventsRes.json();
    const events = Array.isArray(eventsJson) ? eventsJson : [];

    // Aggregate per-restaurant stats
    const clicksByR    = {}; // 'click' events (opened restaurant)
    const waClicksByR  = {}; // 'whatsapp' events
    const callsByR     = {}; // 'call' events
    const uniqueByR    = {}; // unique users (across all event types)
    const lastByR      = {}; // most recent event time

    events.forEach(e => {
      const rid = e.restaurant_id;
      if (!rid) return;
      if (e.event_type === "click")    clicksByR[rid]   = (clicksByR[rid] || 0) + 1;
      if (e.event_type === "whatsapp") waClicksByR[rid] = (waClicksByR[rid] || 0) + 1;
      if (e.event_type === "call")     callsByR[rid]    = (callsByR[rid] || 0) + 1;
      uniqueByR[rid] = uniqueByR[rid] || new Set();
      if (e.user_id) uniqueByR[rid].add(e.user_id);
      if (!lastByR[rid] || e.created_at > lastByR[rid]) lastByR[rid] = e.created_at;
    });

    // Also count legacy applications as whatsapp clicks (backwards compat)
    applications.forEach(app => {
      const rid = app.restaurant_id;
      if (!rid) return;
      waClicksByR[rid] = (waClicksByR[rid] || 0) + 1;
      uniqueByR[rid] = uniqueByR[rid] || new Set();
      if (app.user_id) uniqueByR[rid].add(app.user_id);
    });

    // Fetch auth users for last_sign_in_at (requires service key)
    let authUsers = [];
    if (SERVICE_KEY) {
      const authRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?per_page=200`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const authData = await authRes.json();
      authUsers = authData?.users || [];
    }

    // Build waiter records
    const waiters = (Array.isArray(profiles) ? profiles : [])
      .filter(p => p.role === "waitress")
      .map(p => {
        const auth = authUsers.find(u => u.id === p.id);
        const myApps = applications.filter(a => a.user_id === p.id);
        const lastApp = myApps[0];
        return {
          user_id: p.id,
          name: p.name || "—",
          email: auth?.email || p.email || "",
          phone: p.phone || "",
          city: p.city || "",
          address: p.address || "",
          max_distance: p.max_distance,
          position_types: p.position_types || [],
          experience: p.experience || "",
          min_hourly_rate: p.min_hourly_rate,
          shifts: p.shifts || [],
          signed_up_at: p.created_at,
          last_login_at: auth?.last_sign_in_at || p.created_at,
          total_messages_sent: myApps.length,
          last_message_at: lastApp?.created_at || null,
          onboarded: !!p.onboarded,
        };
      });

    // Build restaurant records — owned + seeded — all show WhatsApp click stats
    const restaurantRecords = (Array.isArray(restaurants) ? restaurants : [])
      .map(r => {
        const profile = r.owner_id ? (profiles.find(p => p.id === r.owner_id) || {}) : {};
        const auth = r.owner_id ? authUsers.find(u => u.id === r.owner_id) : null;
        const views     = clicksByR[r.id] || 0;
        const wa        = waClicksByR[r.id] || 0;
        const calls     = callsByR[r.id] || 0;
        const unique    = uniqueByR[r.id]?.size || 0;
        return {
          restaurant_id: r.id,
          is_seeded: !r.owner_id,
          user_id: r.owner_id || null,
          owner_name: profile.name || (r.owner_id ? "—" : "(seeded)"),
          email: auth?.email || profile.email || "",
          restaurant_name: r.name,
          city: r.city || "",
          address: r.address || "",
          type: r.type || "",
          phone: r.phone || "",
          hourly_rate: r.hourly_rate,
          open_positions: r.open_positions,
          urgent: !!r.urgent,
          active: !!r.active,
          signed_up_at: profile.created_at,
          last_login_at: auth?.last_sign_in_at || profile.created_at,
          last_published_at: r.created_at,
          position_types: r.position_types || [],
          total_views: views,
          total_whatsapp_clicks: wa,
          total_call_clicks: calls,
          total_interactions: views + wa + calls,
          unique_waiters_clicked: unique,
          last_click_at: lastByR[r.id] || null,
        };
      })
      .sort((a, b) => (b.total_interactions - a.total_interactions));

    // Top contacted restaurants (popular among waiters)
    const topRestaurants = [...restaurantRecords]
      .filter(r => r.total_interactions > 0)
      .slice(0, 10);

    return res.status(200).json({
      ok: true,
      counts: {
        waiters: waiters.length,
        restaurants: restaurantRecords.length,
        owned_restaurants: restaurantRecords.filter(r => !r.is_seeded).length,
        total_views: events.filter(e => e.event_type === "click").length,
        total_whatsapp_clicks: events.filter(e => e.event_type === "whatsapp").length + applications.length,
        total_call_clicks: events.filter(e => e.event_type === "call").length,
        unique_active_waiters: new Set([
          ...events.filter(e => e.user_id).map(e => e.user_id),
          ...applications.map(a => a.user_id),
        ]).size,
      },
      waiters,
      restaurants: restaurantRecords,
      top_restaurants: topRestaurants,
      using_service_key: !!SERVICE_KEY,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
