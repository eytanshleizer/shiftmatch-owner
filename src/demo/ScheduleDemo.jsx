import { useMemo, useState } from "react";
import {
  ChevronRight, ChevronLeft, Sun, Sunset, Moon, Users, Clock,
  Coins, Plus, X, Check, Send, AlertTriangle, CalendarDays, Sparkles,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// DEMO HARNESS — preview-only. A TabitShift-style weekly schedule builder
// ("סידור עבודה") for the manager: a roster of employees who submit their
// availability for the week, a day×shift grid the manager fills, live staffing
// /cost stats, and a publish action. Fully in-memory — no login, no Supabase.
// Reached via ?demo=schedule. Not imported in production routing.
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = [
  { key: 0, full: "ראשון",  short: "א'" },
  { key: 1, full: "שני",    short: "ב'" },
  { key: 2, full: "שלישי",  short: "ג'" },
  { key: 3, full: "רביעי",  short: "ד'" },
  { key: 4, full: "חמישי",  short: "ה'" },
  { key: 5, full: "שישי",   short: "ו'" },
  { key: 6, full: "שבת",    short: "ש'" },
];

const SHIFTS = [
  { key: "morning", label: "בוקר",  time: "09:00–16:00", hours: 7, icon: Sun,    tint: "amber"  },
  { key: "evening", label: "ערב",   time: "16:00–23:00", hours: 7, icon: Sunset, tint: "orange" },
  { key: "night",   label: "לילה",  time: "22:00–03:00", hours: 5, icon: Moon,   tint: "indigo" },
];

const ROLES = {
  waiter:    { label: "מלצר/ית", color: "#009DE0" },
  bartender: { label: "ברמן/ית", color: "#7c3aed" },
  host:      { label: "מארח/ת",  color: "#0d9488" },
  runner:    { label: "ראנר/ית", color: "#db2777" },
};

// Roster — each employee carries their hourly rate and the availability they
// submitted for the week, keyed by `${dayKey}-${shiftKey}`:
//   "want" = ביקש/ה (prefers), "ok" = יכול/ה, (missing) = לא הגיש/ה / לא זמין/ה
const EMPLOYEES = [
  { id: "e1", name: "נועה לוי",     role: "waiter",    rate: 52,
    avail: { "0-morning": "want", "0-evening": "ok", "1-evening": "want", "3-evening": "want", "4-evening": "ok", "5-evening": "want" } },
  { id: "e2", name: "איתי כהן",     role: "waiter",    rate: 50,
    avail: { "1-morning": "ok", "2-morning": "want", "3-morning": "want", "4-evening": "want", "5-evening": "ok", "6-evening": "want" } },
  { id: "e3", name: "מאיה ברק",     role: "waiter",    rate: 48,
    avail: { "0-evening": "want", "2-evening": "want", "4-evening": "want", "5-evening": "want", "6-morning": "ok" } },
  { id: "e4", name: "יותם פרץ",     role: "bartender", rate: 58,
    avail: { "3-evening": "want", "4-evening": "want", "5-evening": "want", "5-night": "want", "6-night": "want" } },
  { id: "e5", name: "שירה אבני",    role: "bartender", rate: 56,
    avail: { "0-evening": "ok", "1-evening": "want", "2-evening": "ok", "4-night": "want", "6-evening": "want" } },
  { id: "e6", name: "דניאל מור",    role: "host",      rate: 46,
    avail: { "4-evening": "want", "5-evening": "want", "6-evening": "want", "5-morning": "ok" } },
  { id: "e7", name: "רוני שמש",     role: "runner",    rate: 42,
    avail: { "0-morning": "ok", "1-morning": "ok", "5-evening": "want", "6-evening": "want", "4-evening": "ok" } },
  { id: "e8", name: "עומר טל",      role: "waiter",    rate: 50,
    avail: { "0-morning": "want", "1-morning": "want", "2-morning": "ok", "5-morning": "want", "6-morning": "want" } },
];

const EMP = Object.fromEntries(EMPLOYEES.map((e) => [e.id, e]));

// How many people each (day,shift) needs. Weekends + evenings are busier.
function required(dayKey, shiftKey) {
  if (shiftKey === "night") return dayKey >= 4 ? 2 : 0;          // nights only Thu–Sat
  const weekend = dayKey === 4 || dayKey === 5 || dayKey === 6;  // Thu/Fri/Sat
  if (shiftKey === "evening") return weekend ? 4 : 3;
  return weekend ? 3 : 2;                                        // morning
}

const slotId = (d, s) => `${d}-${s}`;

// A seeded starting schedule so the demo opens looking "half built".
const SEED = {
  "0-morning": ["e8", "e1"],
  "0-evening": ["e3", "e5"],
  "1-evening": ["e1", "e5"],
  "4-evening": ["e2", "e3", "e6"],
  "5-evening": ["e2", "e3", "e4", "e6"],
  "5-night":   ["e4"],
  "6-evening": ["e3", "e4", "e5", "e6"],
};

function fmtRange(start) {
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const f = (d) => `${d.getDate()}.${d.getMonth() + 1}`;
  return `${f(start)} – ${f(end)}`;
}

export default function ScheduleDemo() {
  // Week starting Sunday (demo anchor).
  const weekStart = useMemo(() => new Date(2026, 5, 14), []); // 14.6.2026 (Sun)
  const [assign, setAssign] = useState(SEED);
  const [sel, setSel] = useState(slotId(5, "evening")); // open on busiest slot
  const [published, setPublished] = useState(false);

  const [selDay, selShift] = sel.split("-");
  const selDayKey = Number(selDay);
  const selShiftDef = SHIFTS.find((s) => s.key === selShift);
  const selReq = required(selDayKey, selShift);
  const selAssigned = assign[sel] || [];

  const toggle = (slot, empId) => {
    setPublished(false);
    setAssign((prev) => {
      const cur = prev[slot] || [];
      const next = cur.includes(empId) ? cur.filter((x) => x !== empId) : [...cur, empId];
      return { ...prev, [slot]: next };
    });
  };

  // ── Week-wide stats ──
  const stats = useMemo(() => {
    let shiftsCount = 0, hours = 0, cost = 0, openSlots = 0;
    DAYS.forEach((d) => SHIFTS.forEach((s) => {
      const req = required(d.key, s.key);
      const have = (assign[slotId(d.key, s.key)] || []).length;
      if (req > 0 && have < req) openSlots += req - have;
      have && (shiftsCount += have);
      (assign[slotId(d.key, s.key)] || []).forEach((id) => {
        hours += s.hours;
        cost += s.hours * (EMP[id]?.rate || 0);
      });
    }));
    return { shiftsCount, hours, cost, openSlots };
  }, [assign]);

  const date = new Date(weekStart); date.setDate(date.getDate() + selDayKey);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 pb-28 pt-5 lg:pt-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-bold text-brand-600 mb-0.5">מסעדת הדגמה · ShiftMatch</p>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <CalendarDays size={24} className="text-gray-900" /> סידור עבודה
            </h1>
          </div>
          <button
            onClick={() => setPublished(true)}
            disabled={published}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-sm transition-colors ${
              published ? "bg-green-100 text-green-700" : "bg-brand-500 text-white active:bg-brand-600 shadow-brand-500/30"
            }`}>
            {published ? <><Check size={16} /> פורסם</> : <><Send size={15} /> פרסום הסידור</>}
          </button>
        </div>

        {/* Week nav */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-3 py-2.5 mb-3 shadow-sm">
          <button className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500"><ChevronRight size={20} /></button>
          <div className="text-center">
            <p className="text-sm font-black text-gray-900">{fmtRange(weekStart)}</p>
            <p className="text-[11px] text-gray-400 font-semibold">שבוע נוכחי</p>
          </div>
          <button className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500"><ChevronLeft size={20} /></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Stat icon={Users}  label="שיבוצים" value={stats.shiftsCount} />
          <Stat icon={Clock}  label="שעות"    value={stats.hours} />
          <Stat icon={Coins}  label="עלות"    value={`₪${stats.cost.toLocaleString()}`} />
          <Stat icon={AlertTriangle} label="חוסרים" value={stats.openSlots}
            tone={stats.openSlots > 0 ? "warn" : "ok"} />
        </div>

        {published && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-2xl px-4 py-3 mb-4 text-sm font-semibold">
            <Sparkles size={16} /> הסידור פורסם — כל העובדים קיבלו התראה והמשמרות שלהם מופיעות באפליקציה.
          </div>
        )}

        {/* Week grid */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Day header row */}
              <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-100 bg-gray-50/60">
                <div className="px-3 py-2.5 text-[11px] font-bold text-gray-400">משמרת</div>
                {DAYS.map((d) => {
                  const dd = new Date(weekStart); dd.setDate(dd.getDate() + d.key);
                  const weekend = d.key >= 4;
                  return (
                    <div key={d.key} className={`px-2 py-2.5 text-center ${weekend ? "bg-brand-50/50" : ""}`}>
                      <p className="text-xs font-black text-gray-900">{d.full}</p>
                      <p className="text-[10px] text-gray-400 font-semibold">{dd.getDate()}.{dd.getMonth() + 1}</p>
                    </div>
                  );
                })}
              </div>

              {/* Shift rows */}
              {SHIFTS.map((s) => (
                <div key={s.key} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-50 last:border-0">
                  <div className="px-3 py-3 flex flex-col items-center justify-center gap-1 bg-gray-50/40">
                    <s.icon size={16} className="text-gray-400" />
                    <span className="text-[11px] font-bold text-gray-600">{s.label}</span>
                  </div>
                  {DAYS.map((d) => {
                    const id = slotId(d.key, s.key);
                    const req = required(d.key, s.key);
                    const have = (assign[id] || []).length;
                    return (
                      <button
                        key={id}
                        onClick={() => setSel(id)}
                        className={`m-1 rounded-xl p-1.5 min-h-[58px] flex flex-col items-center justify-center gap-1 border transition-all ${
                          sel === id ? "ring-2 ring-brand-500 border-transparent" : "border-gray-100"
                        } ${cellTone(req, have)}`}>
                        {req === 0 ? (
                          <span className="text-[10px] text-gray-300 font-semibold">—</span>
                        ) : (
                          <>
                            <span className="text-xs font-black">{have}/{req}</span>
                            <div className="flex -space-x-1.5 space-x-reverse">
                              {(assign[id] || []).slice(0, 3).map((eid) => (
                                <Avatar key={eid} emp={EMP[eid]} size={18} ring />
                              ))}
                            </div>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Slot editor */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {selShiftDef && <selShiftDef.icon size={18} className="text-gray-500" />}
              <h2 className="text-base font-black text-gray-900">
                {DAYS[selDayKey].full}, {date.getDate()}.{date.getMonth() + 1} · {selShiftDef?.label}
              </h2>
            </div>
            <span className="text-xs font-bold text-gray-400">{selShiftDef?.time}</span>
          </div>

          {selReq === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">אין צורך בעובדים במשמרת זו.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                  selAssigned.length >= selReq ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {selAssigned.length}/{selReq} מאוישים
                </span>
                {selAssigned.length < selReq && (
                  <span className="text-xs text-amber-600 font-semibold">חסרים {selReq - selAssigned.length} עובדים</span>
                )}
              </div>

              {/* Assigned chips */}
              {selAssigned.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selAssigned.map((eid) => (
                    <button key={eid} onClick={() => toggle(sel, eid)}
                      className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 rounded-full pr-1 pl-2.5 py-1 transition-colors group">
                      <Avatar emp={EMP[eid]} size={22} />
                      <span className="text-xs font-bold text-gray-800">{EMP[eid].name}</span>
                      <X size={13} className="text-gray-400 group-hover:text-red-500" />
                    </button>
                  ))}
                </div>
              )}

              {/* Roster — sorted: people who asked for this slot first */}
              <p className="text-[11px] font-bold text-gray-400 mb-2 flex items-center gap-1">
                <Plus size={12} /> הוספת עובד/ת (לפי הזמינות שהגישו לשבוע)
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {[...EMPLOYEES]
                  .filter((e) => !selAssigned.includes(e.id))
                  .sort((a, b) => availRank(b, sel) - availRank(a, sel))
                  .map((e) => {
                    const av = e.avail[sel];
                    return (
                      <button key={e.id} onClick={() => toggle(sel, e.id)}
                        className="flex items-center gap-2.5 p-2 rounded-2xl border border-gray-100 hover:border-brand-300 hover:bg-brand-50/40 transition-colors text-right">
                        <Avatar emp={e} size={34} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{e.name}</p>
                          <p className="text-[11px] font-semibold" style={{ color: ROLES[e.role].color }}>
                            {ROLES[e.role].label} · ₪{e.rate}/שעה
                          </p>
                        </div>
                        <AvailBadge state={av} />
                      </button>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-6">
          תצוגת הדגמה · נתונים לדוגמה · כך מנהל/ת המשמרות בונה את הסידור השבועי
        </p>
      </div>
    </div>
  );
}

// ── helpers / sub-components ──────────────────────────────────────────────────

function availRank(e, slot) {
  const a = e.avail[slot];
  return a === "want" ? 2 : a === "ok" ? 1 : 0;
}

function cellTone(req, have) {
  if (req === 0) return "bg-gray-50/40";
  if (have === 0) return "bg-red-50 text-red-600 hover:bg-red-100";
  if (have < req) return "bg-amber-50 text-amber-700 hover:bg-amber-100";
  return "bg-green-50 text-green-700 hover:bg-green-100";
}

function Stat({ icon: Icon, label, value, tone }) {
  const warn = tone === "warn";
  return (
    <div className={`rounded-2xl border p-2.5 ${warn ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"}`}>
      <Icon size={15} className={warn ? "text-amber-500" : "text-brand-500"} />
      <p className={`text-lg font-black mt-1 leading-none ${warn ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
      <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function Avatar({ emp, size = 28, ring }) {
  if (!emp) return null;
  const initials = emp.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-black flex-shrink-0 ${ring ? "ring-2 ring-white" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.38, background: ROLES[emp.role].color }}
      title={`${emp.name} · ${ROLES[emp.role].label}`}>
      {initials}
    </span>
  );
}

function AvailBadge({ state }) {
  if (state === "want") return <span className="text-[10px] font-black text-green-700 bg-green-100 px-2 py-1 rounded-lg whitespace-nowrap">ביקש/ה ✓</span>;
  if (state === "ok")   return <span className="text-[10px] font-black text-brand-700 bg-brand-50 px-2 py-1 rounded-lg whitespace-nowrap">זמין/ה</span>;
  return <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg whitespace-nowrap">לא הגיש/ה</span>;
}
