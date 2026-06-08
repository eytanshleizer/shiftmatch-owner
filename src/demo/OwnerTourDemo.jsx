import { useState } from "react";
import { supabase } from "../lib/supabase";
import Dashboard from "../components/Dashboard";

// ─────────────────────────────────────────────────────────────────────────────
// OWNER TOUR DEMO — preview-only (?demo=ownertour). Mounts the REAL Dashboard
// (with the real JobsTab / SettingsTab / JobsSetupWizard) against an in-memory
// Supabase mock, so the integrated new-owner flow can be exercised without a
// login: open משרות → guided wizard → land on jobs (no red errors) → coach-mark
// tour across משרות + הגדרות. Not imported by any production route.
// ─────────────────────────────────────────────────────────────────────────────

let idc = 7000;
const uid = () => "demo-" + idc++;

const store = {
  position_templates: [
    { id: "t-waiter",    name: "מלצר/ית",    icon: "🍽️", sort_order: 1 },
    { id: "t-bartender", name: "ברמן/ית",    icon: "🍸", sort_order: 2 },
    { id: "t-host",      name: "מארח/ת",     icon: "🛎️", sort_order: 3 },
    { id: "t-runner",    name: "ראנר/ית",    icon: "🏃", sort_order: 4 },
    { id: "t-chef",      name: "טבח/ית",     icon: "👨‍🍳", sort_order: 5 },
    { id: "t-dish",      name: "שטיפת כלים", icon: "🧽", sort_order: 6 },
  ],
  restaurant_positions: [],
  position_screening_questions: [],
  restaurants: [{
    id: "demo-rest", name: "מסעדת הדגמה", city: "תל אביב", type: "מסעדת שף",
    hourly_rate: 50, shifts: ["ערב"], mandatory_shifts: [], position_types: [],
  }],
};

function makeBuilder(table) {
  const s = { op: "select", filters: [], inFilter: null, payload: null, single: false };
  const rows = () => {
    let r = store[table] || [];
    r = r.filter((row) => s.filters.every(([c, v]) => row[c] === v));
    if (s.inFilter) { const [c, vals] = s.inFilter; r = r.filter((row) => vals.includes(row[c])); }
    return r;
  };
  const exec = async () => {
    if (s.op === "select") { const d = rows(); return { data: s.single ? d[0] || null : d, error: null }; }
    if (s.op === "insert") {
      const arr = Array.isArray(s.payload) ? s.payload : [s.payload];
      const ins = arr.map((x) => ({ id: uid(), created_at: new Date().toISOString(), ...x }));
      store[table] = [...(store[table] || []), ...ins];
      return { data: s.single ? ins[0] : ins, error: null };
    }
    if (s.op === "update") {
      const ids = new Set(rows().map((r) => r.id));
      store[table] = store[table].map((r) => (ids.has(r.id) ? { ...r, ...s.payload } : r));
      return { data: s.single ? store[table].find((r) => ids.has(r.id)) || null : null, error: null };
    }
    if (s.op === "delete") {
      const ids = new Set(rows().map((r) => r.id));
      store[table] = store[table].filter((r) => !ids.has(r.id));
      return { data: null, error: null };
    }
  };
  const b = {
    select() { return b; },
    eq(c, v) { s.filters.push([c, v]); return b; },
    in(c, v) { s.inFilter = [c, v]; return b; },
    ilike() { return b; },
    is() { return b; },
    gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; },
    neq() { return b; }, not() { return b; }, or() { return b; }, contains() { return b; },
    range() { return exec(); },
    order() { return b; },
    limit() { return b; },
    update(p) { s.op = "update"; s.payload = p; return b; },
    insert(p) { s.op = "insert"; s.payload = p; return b; },
    delete() { s.op = "delete"; return b; },
    single() { s.single = true; return exec(); },
    maybeSingle() { s.single = true; return exec(); },
    then(res, rej) { return exec().then(res, rej); },
  };
  return b;
}
supabase.from = (table) => makeBuilder(table);
// Stub auth so Dashboard's signOut etc. don't blow up in the demo.
supabase.auth = {
  ...supabase.auth,
  signOut: async () => ({ error: null }),
};

export default function OwnerTourDemo() {
  // Fresh start each load: no positions, wizard + tour unseen.
  try {
    localStorage.removeItem("jobsWizardSeen_demo-rest");
    localStorage.removeItem("jobsTourSeen_demo-rest");
    localStorage.removeItem("jobsTourActive_demo-rest");
    localStorage.removeItem("jobsTourStep_demo-rest");
    localStorage.removeItem("settingsSeen_demo-rest");
  } catch { /* ignore */ }

  const [restaurant, setRestaurant] = useState(store.restaurants[0]);

  return (
    <div className="h-screen w-full">
      <Dashboard
        restaurant={restaurant}
        user={{ id: "demo-owner", email: "demo@demo.co", user_metadata: { name: "בעל הדגמה" } }}
        role="owner"
        onUpdate={(r) => {
          store.restaurants[0] = { ...store.restaurants[0], ...r };
          setRestaurant((prev) => ({ ...prev, ...r }));
        }}
      />
    </div>
  );
}
