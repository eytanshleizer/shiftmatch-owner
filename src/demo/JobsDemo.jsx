import { useState } from "react";
import { supabase } from "../lib/supabase";
import JobsTab from "../components/JobsTab";
import JobsSetupWizard from "../components/JobsSetupWizard";

// ─────────────────────────────────────────────────────────────────────────────
// DEMO HARNESS — preview-only. Renders the real JobsTab against an in-memory
// mock of the Supabase client so the jobs flow can be demoed without a login or
// any production data. Reached via ?demo=jobs. Not imported in production paths.
// ─────────────────────────────────────────────────────────────────────────────

let idc = 1000;
const uid = () => "demo-" + idc++;

const store = {
  position_templates: [
    { id: "t-waiter",    name: "מלצר/ית",   icon: "🍽️", sort_order: 1 },
    { id: "t-bartender", name: "ברמן/ית",   icon: "🍸", sort_order: 2 },
    { id: "t-host",      name: "מארח/ת",    icon: "🛎️", sort_order: 3 },
    { id: "t-runner",    name: "ראנר/ית",   icon: "🏃", sort_order: 4 },
    { id: "t-chef",      name: "טבח/ית",    icon: "👨‍🍳", sort_order: 5 },
    { id: "t-dish",      name: "שטיפת כלים", icon: "🧽", sort_order: 6 },
  ],
  restaurant_positions: [
    {
      id: "p-waiter", restaurant_id: "demo-rest", template_id: "t-waiter",
      name: "מלצר/ית", hourly_rate: 50, open_count: 2, is_open: true,
      reveal_salary: true, shifts: ["ערב", 'סופ"ש'],
      requirements: { experience: "1_plus", weekends: true }, created_at: "2026-01-01",
    },
    {
      id: "p-bartender", restaurant_id: "demo-rest", template_id: "t-bartender",
      name: "ברמן/ית", hourly_rate: 0, open_count: 1, is_open: true,
      reveal_salary: false, shifts: ["ערב"],
      requirements: {}, created_at: "2026-01-02",
    },
  ],
  position_screening_questions: [
    {
      id: "q-1", position_id: "p-waiter", template_id: null,
      question: "מה ניסיונך הקודם במלצרות?", answer_type: "text",
      options: [], enabled: true, is_required: false, sort_order: 1,
    },
  ],
  restaurants: [{ id: "demo-rest", name: "מסעדת הדגמה", mandatory_shifts: ["weekend"] }],
};

// Minimal chainable query builder that mimics the subset of the supabase-js API
// that JobsTab uses (select/eq/in/order/insert/update/delete/single/maybeSingle).
function makeBuilder(table) {
  const s = { op: "select", filters: [], inFilter: null, payload: null, single: false };
  const rows = () => {
    let r = store[table] || [];
    r = r.filter((row) => s.filters.every(([c, v]) => row[c] === v));
    if (s.inFilter) { const [c, vals] = s.inFilter; r = r.filter((row) => vals.includes(row[c])); }
    return r;
  };
  const exec = async () => {
    if (s.op === "select") {
      const data = rows();
      return { data: s.single ? data[0] || null : data, error: null };
    }
    if (s.op === "insert") {
      const arr = Array.isArray(s.payload) ? s.payload : [s.payload];
      const ins = arr.map((x) => ({ id: uid(), created_at: new Date().toISOString(), ...x }));
      store[table] = [...(store[table] || []), ...ins];
      return { data: s.single ? ins[0] : ins, error: null };
    }
    if (s.op === "update") {
      const ids = new Set(rows().map((r) => r.id));
      store[table] = store[table].map((r) => (ids.has(r.id) ? { ...r, ...s.payload } : r));
      return { data: null, error: null };
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
    order() { return b; },
    update(p) { s.op = "update"; s.payload = p; return b; },
    insert(p) { s.op = "insert"; s.payload = p; return b; },
    delete() { s.op = "delete"; return b; },
    single() { s.single = true; return exec(); },
    maybeSingle() { s.single = true; return exec(); },
    then(res, rej) { return exec().then(res, rej); },
  };
  return b;
}

// Patch the shared singleton (mutating in place so JobsTab's import resolves to
// the mock). Demo-only — never runs in production routing.
supabase.from = (table) => makeBuilder(table);

export default function JobsDemo() {
  const [restaurant, setRestaurant] = useState(store.restaurants[0]);
  const [done, setDone] = useState(false);
  const view = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("demo")
    : "jobs";

  // First-time wizard demo (?demo=wizard) — fresh restaurant with no positions.
  if (view === "wizard") {
    if (done) {
      return (
        <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-8" dir="rtl">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-black text-gray-900">המשרות פורסמו!</h1>
          <p className="text-gray-500 text-sm mt-2">(דמו) האשף סיים — כאן היינו עוברים למסך המשרות.</p>
        </div>
      );
    }
    return (
      <div className="max-w-md mx-auto h-screen bg-white">
        <JobsSetupWizard
          restaurant={{ id: "demo-rest", hourly_rate: 50, shifts: ["ערב"] }}
          onDone={() => setDone(true)}
          onClose={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50">
      <JobsTab
        restaurant={restaurant}
        role="owner"
        onUpdate={(r) => { store.restaurants[0] = { ...store.restaurants[0], ...r }; setRestaurant((prev) => ({ ...prev, ...r })); }}
      />
    </div>
  );
}
