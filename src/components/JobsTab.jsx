import { useState, useEffect, useRef } from "react";
import {
  Plus, X, Check, Calendar, Moon, Sun, PartyPopper,
  Loader2, ChevronDown, ChevronUp, Trash2, HelpCircle, AlertCircle, Sparkles, CheckCheck
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { can } from "../lib/permissions";

// ─────────────────────────────────────────────────────────────────────────────
// JobsTab — each position is a row in `restaurant_positions` with its own pay,
// count, shifts, requirements, and screening questions. Positions are adopted
// from the system catalog (`position_templates`) or created custom.
//
// The legacy `restaurants.position_*` JSON columns are kept in sync on every
// change (parallel run) so HomeTab / SearchOverlay / matching keep working until
// they're migrated too.
// ─────────────────────────────────────────────────────────────────────────────

const EXPERIENCE_OPTIONS = [
  { key: "none",   label: "ללא" },
  { key: "1_plus", label: "1+" },
  { key: "2_plus", label: "2+" },
  { key: "3_plus", label: "3+" },
  { key: "5_plus", label: "5+" },
];

const MILITARY_OPTIONS = [
  { key: "required",     label: "חובה" },
  { key: "not_required", label: "לא חובה" },
  { key: "irrelevant",   label: "לא רלוונטי" },
];

const SHIFTS_WEEK_OPTIONS = [
  { key: "1_2", label: "1–2", min: 1, max: 2 },
  { key: "3_4", label: "3–4", min: 3, max: 4 },
  { key: "5_p", label: "5+",  min: 5, max: 7 },
];

const DAY_SHIFTS = ["בוקר", "צהריים", "ערב", "לילה", 'סופ"ש'];

const MANDATORY_SHIFTS = [
  { key: "weekend",       label: "סופי שבוע", icon: PartyPopper },
  { key: "nights",        label: "לילות",      icon: Moon },
  { key: "holidays",      label: "חגים",       icon: Calendar },
  { key: "early_morning", label: "בוקר מוקדם", icon: Sun },
];

const ANSWER_TYPE_LABEL = {
  boolean:       "כן / לא",
  single_choice: "בחירה",
  multi_choice:  "בחירה מרובה",
  scale:         "דירוג",
  text:          "טקסט חופשי",
};

export default function JobsTab({ restaurant, onUpdate, role = "owner" }) {
  const canEdit = can(role, "edit_jobs");

  const [positions, setPositions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [expandedPos, setExpandedPos] = useState(null);
  const [showAdd,   setShowAdd]   = useState(false);

  // Live mirror of `positions` so optimistic updates read the freshest array
  // (not the value captured at render time) — this is what stops rapid shift
  // toggles from racing and overwriting each other.
  const positionsRef = useRef([]);
  const writeState = (list) => { positionsRef.current = list; setPositions(list); };

  // Guards the "add positions" commit against rapid double-presses creating
  // duplicate rows before the first insert+refetch completes.
  const addingRef = useRef(false);

  // Per-position debounce timers so quick taps coalesce into one DB write.
  const shiftTimers = useRef({});
  useEffect(() => () => {
    Object.values(shiftTimers.current).forEach((t) => clearTimeout(t));
  }, []);

  const mandatoryShifts = restaurant?.mandatory_shifts || [];

  // ── Data layer ──────────────────────────────────────────────────────────────
  const fetchPositions = async () => {
    const { data: pos } = await supabase
      .from("restaurant_positions")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at");
    const list = pos || [];
    const ids = list.map((p) => p.id);
    let questions = [];
    if (ids.length) {
      const { data: q } = await supabase
        .from("position_screening_questions")
        .select("*")
        .in("position_id", ids)
        .order("sort_order");
      questions = q || [];
    }
    return list.map((p) => ({
      ...p,
      questions: questions.filter((q) => q.position_id === p.id),
    }));
  };

  const load = async () => {
    setLoading(true);
    const [list, { data: tmpl }] = await Promise.all([
      fetchPositions(),
      supabase.from("position_templates").select("*").order("sort_order"),
    ]);
    writeState(list);
    setTemplates(tmpl || []);
    setLoading(false);
  };

  useEffect(() => { if (restaurant?.id) load(); }, [restaurant?.id]);

  // Keep the legacy restaurant JSON columns in sync so other screens still work.
  const syncLegacy = async (list) => {
    const position_types = list.map((p) => p.name);
    const position_open = {}, position_salaries = {}, position_counts = {}, position_requirements = {};
    list.forEach((p) => {
      position_open[p.name]         = p.is_open;
      position_salaries[p.name]     = p.hourly_rate;
      position_counts[p.name]       = p.open_count;
      position_requirements[p.name] = p.requirements || {};
    });
    const patch = { position_types, position_open, position_salaries, position_counts, position_requirements };
    await supabase.from("restaurants").update(patch).eq("id", restaurant.id);
    onUpdate?.({ ...restaurant, ...patch });
  };

  // Run a mutation that changes structure (add/remove/questions), then refresh
  // state + legacy sync. Used for things that aren't simple field edits.
  const mutate = async (fn) => {
    if (!canEdit) return;
    setSaving(true);
    await fn();
    const list = await fetchPositions();
    writeState(list);
    await syncLegacy(list);
    setSaving(false);
  };

  // ── Position-level mutations ──────────────────────────────────────────────────
  // Optimistic field update — apply to the live array immediately (snappy, no
  // refetch), then persist in the background. Reading from positionsRef.current
  // means concurrent edits build on each other instead of clobbering.
  const patchPosition = (id, patch, persist = true) => {
    if (!canEdit) return;
    const next = positionsRef.current.map((p) =>
      p.id === id ? { ...p, ...patch } : p);
    writeState(next);
    if (persist) {
      setSaving(true);
      supabase.from("restaurant_positions").update(patch).eq("id", id)
        .then(() => syncLegacy(next))
        .finally(() => setSaving(false));
    }
  };

  const setReqs = (p, patch) =>
    patchPosition(p.id, { requirements: { ...(positionsRef.current.find((x) => x.id === p.id)?.requirements || {}), ...patch } });

  const togglePosition = (p) => patchPosition(p.id, { is_open: !p.is_open });
  const setSalary = (p, val) => patchPosition(p.id, { hourly_rate: parseInt(val) || 0 });
  const setCount  = (p, val) => patchPosition(p.id, { open_count: Math.max(1, parseInt(val) || 1) });

  // Toggle a single day-shift. Updates the UI instantly off the freshest array,
  // then debounces the DB write per-position so a burst of taps collapses into
  // one update with the final array (no races, no flicker).
  const persistShifts = (id) => {
    const cur = positionsRef.current.find((x) => x.id === id);
    if (!cur) return;
    setSaving(true);
    supabase.from("restaurant_positions").update({ shifts: cur.shifts || [] }).eq("id", id)
      .then(() => syncLegacy(positionsRef.current))
      .finally(() => setSaving(false));
  };

  const queueShiftPersist = (id) => {
    clearTimeout(shiftTimers.current[id]);
    shiftTimers.current[id] = setTimeout(() => persistShifts(id), 400);
  };

  const toggleDayShift = (p, shift) => {
    if (!canEdit) return;
    const cur = positionsRef.current.find((x) => x.id === p.id)?.shifts || [];
    const next = cur.includes(shift) ? cur.filter((s) => s !== shift) : [...cur, shift];
    patchPosition(p.id, { shifts: next }, false);  // optimistic only
    queueShiftPersist(p.id);
  };

  const setAllShifts = (p) => {
    if (!canEdit) return;
    const cur = positionsRef.current.find((x) => x.id === p.id)?.shifts || [];
    const allOn = DAY_SHIFTS.every((s) => cur.includes(s));
    patchPosition(p.id, { shifts: allOn ? [] : [...DAY_SHIFTS] }, false);
    queueShiftPersist(p.id);
  };

  const removePosition = (p) => {
    if (!confirm(`להסיר את המשרה "${p.name}" לחלוטין?`)) return;
    mutate(() => supabase.from("restaurant_positions").delete().eq("id", p.id));
    if (expandedPos === p.id) setExpandedPos(null);
  };

  // Add several catalog positions at once (multi-select in the modal).
  // Fast: one bulk insert for the positions + one bulk insert for their default
  // screening questions. Guarded by addingRef so rapid double-presses can't
  // fire a second insert before the first finishes (which is what created
  // duplicate rows before).
  const addTemplates = (tmpls) => {
    if (addingRef.current) return;          // already committing — ignore re-press
    if (!tmpls.length) { setShowAdd(false); return; }
    addingRef.current = true;
    setShowAdd(false);                       // close immediately so it feels instant

    // Dedupe against what's already there, by name and template_id.
    const haveNames = new Set(positionsRef.current.map((p) => p.name));
    const haveTids  = new Set(positionsRef.current.map((p) => p.template_id).filter(Boolean));
    const toAdd = tmpls.filter((t) => !haveTids.has(t.id) && !haveNames.has(t.name));

    let lastId = null;
    mutate(async () => {
      if (!toAdd.length) return;
      // 1) Bulk-insert the positions in a single round-trip.
      const { data: inserted } = await supabase
        .from("restaurant_positions")
        .insert(toAdd.map((t) => ({
          restaurant_id: restaurant.id,
          template_id:   t.id,
          name:          t.name,
          hourly_rate:   restaurant.hourly_rate || 0,
          open_count:    1,
          is_open:       true,
          shifts:        restaurant.shifts || [],
          requirements:  {},
        })))
        .select();
      if (!inserted?.length) return;
      lastId = inserted[inserted.length - 1].id;

      // 2) Pull all default screening questions for these templates at once,
      //    then bulk-insert one row per (position × question).
      const { data: defs } = await supabase
        .from("screening_question_templates")
        .select("*")
        .in("position_template_id", toAdd.map((t) => t.id))
        .order("sort_order");
      if (defs?.length) {
        const rows = [];
        inserted.forEach((pos) => {
          defs.filter((d) => d.position_template_id === pos.template_id).forEach((d) => {
            rows.push({
              position_id: pos.id,
              template_id: d.id,
              question:    d.question,
              answer_type: d.answer_type,
              options:     d.options,
              enabled:     true,
              is_required: false,
              sort_order:  d.sort_order,
            });
          });
        });
        if (rows.length) await supabase.from("position_screening_questions").insert(rows);
      }
    }).then(() => {
      if (lastId) setExpandedPos(lastId);
      addingRef.current = false;
    });
  };

  const addCustomPosition = (name) => {
    const n = name.trim();
    if (!n) return;
    if (positionsRef.current.some((p) => p.name === n)) {
      alert(`כבר קיימת משרה בשם "${n}".`);
      return;
    }
    mutate(async () => {
      const { data: inserted } = await supabase
        .from("restaurant_positions")
        .insert({
          restaurant_id: restaurant.id,
          template_id:   null,
          name:          n,
          hourly_rate:   restaurant.hourly_rate || 0,
          open_count:    1,
          is_open:       true,
          shifts:        restaurant.shifts || [],
          requirements:  {},
        })
        .select().single();
      if (inserted) setExpandedPos(inserted.id);
    }).then(() => setShowAdd(false));
  };

  // ── Screening-question mutations ────────────────────────────────────────────
  const toggleQuestion = (q) => mutate(() =>
    supabase.from("position_screening_questions").update({ enabled: !q.enabled }).eq("id", q.id));

  const deleteQuestion = (q) => mutate(() =>
    supabase.from("position_screening_questions").delete().eq("id", q.id));

  const addQuestion = (p, draft) => mutate(() =>
    supabase.from("position_screening_questions").insert({
      position_id: p.id,
      template_id: null,
      question:    draft.question,
      answer_type: draft.answer_type,
      options:     draft.options,
      enabled:     true,
      is_required: false,
      sort_order:  (p.questions?.length || 0) + 1,
    }));

  const toggleMandatoryShift = (key) => {
    if (!canEdit) return;
    const next = mandatoryShifts.includes(key)
      ? mandatoryShifts.filter((s) => s !== key)
      : [...mandatoryShifts, key];
    supabase.from("restaurants").update({ mandatory_shifts: next }).eq("id", restaurant.id)
      .then(() => onUpdate?.({ ...restaurant, mandatory_shifts: next }));
  };

  const availableTemplates = templates.filter(
    (t) => !positions.some((p) => p.template_id === t.id)
  );
  const openCount = positions.filter((p) => p.is_open).length;

  // Setup nudge — open positions still missing pay or worker requirements.
  // This data flows to the waiter app, so flag it until it's filled in.
  const needSalary = positions.filter((p) => p.is_open && !(p.hourly_rate > 0));
  const needReqs   = positions.filter((p) => p.is_open && countSetReqs(p.requirements || {}) === 0);
  const posNeedsSetup = (p) =>
    p.is_open && (!(p.hourly_rate > 0) || countSetReqs(p.requirements || {}) === 0);

  // Current onboarding step — drives the "game guide" pulses. Computed from live
  // state so it advances the moment the owner adds a position / fills in pay.
  const guideStep = !loading && canEdit
    ? (positions.length === 0 ? "add"
      : needSalary.length > 0 ? "salary"
      : needReqs.length   > 0 ? "reqs"
      : null)
    : null;

  return (
    <div className="bg-gray-50 min-h-full pb-24 text-gray-900" dir="rtl">

      {/* Header */}
      <div className="px-5 pt-20 pb-3 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">משרות</h1>
          <p className="text-gray-500 text-sm mt-1">
            {openCount} פתוחות · {positions.length} בסך הכל
          </p>
        </div>
        {saving && <Loader2 size={16} className="text-gray-400 animate-spin" />}
      </div>

      <div className="px-4 pt-2 space-y-3">

        {!canEdit && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-2xl px-4 py-3">
            🔒 התפקיד שלך אינו מאפשר עריכת משרות — צפייה בלבד.
          </div>
        )}

        {/* ── Step 1 of the guide: welcome the owner & point them to "+ הוספת משרה". ── */}
        {guideStep === "add" && (
          <div className="bg-gray-900 text-white rounded-2xl p-4">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">👋 בואו נתחיל</p>
                <p className="text-gray-300 text-xs mt-0.5 leading-relaxed">
                  הוסיפו את המשרות שאתם מגייסים. אחר כך נגדיר יחד שכר ודרישות לכל משרה —
                  כך מלצרים יראו בדיוק מה אתם מציעים.
                </p>
                <button onClick={() => setShowAdd(true)}
                  className="mt-3 bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 active:bg-gray-100">
                  <Plus size={14} />הוספת משרה ראשונה
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Setup nudge — guides owners to fill pay + requirements so the data
            flows to the waiter app and listings stop showing "לפי סיכום". ── */}
        {canEdit && !loading && (needSalary.length > 0 || needReqs.length > 0) && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={16} className="text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-red-900 font-bold text-sm">השלמת פרטי המשרות</p>
                <p className="text-red-700 text-xs mt-0.5 leading-relaxed">
                  כדי שהמלצרים יראו את המשרות שלך כמו שצריך, יש למלא לכל משרה:
                </p>
                <div className="flex flex-col gap-1 mt-2">
                  {needSalary.length > 0 && (
                    <span className="text-red-800 text-xs font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      שכר לשעה חסר ב־{needSalary.length} {needSalary.length === 1 ? "משרה" : "משרות"}
                    </span>
                  )}
                  {needReqs.length > 0 && (
                    <span className="text-red-800 text-xs font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      דרישות מהעובד חסרות ב־{needReqs.length} {needReqs.length === 1 ? "משרה" : "משרות"}
                    </span>
                  )}
                </div>
                <p className="text-red-600 text-[11px] mt-2">
                  לחצ/י על משרה עם נקודה אדומה כדי להשלים את הפרטים ↓
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── General mandatory shifts (restaurant-level) ── */}
        <SectionCard title="משמרות חובה לכל המסעדה"
          sub="מועמדים שאינם זמינים למשמרות אלה לא יוצגו">
          <div className="flex flex-wrap gap-2 mt-3">
            {MANDATORY_SHIFTS.map(({ key, label, icon: Icon }) => {
              const on = mandatoryShifts.includes(key);
              return (
                <button key={key} onClick={() => toggleMandatoryShift(key)}
                  disabled={!canEdit}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${
                    on ? "bg-gray-900 text-white border-gray-900"
                       : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
                  } disabled:opacity-50`}>
                  <Icon size={12} />{label}
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Positions list ── */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">משרות</p>
            {canEdit && (
              <button onClick={() => setShowAdd(true)}
                className="relative text-gray-900 text-xs font-bold flex items-center gap-1">
                <Plus size={13} />הוספת משרה
                {guideStep === "add" && (
                  <span className="absolute -top-1.5 -left-1.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 attn-ring" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                  </span>
                )}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 size={26} className="text-gray-300 animate-spin" />
            </div>
          ) : positions.length === 0 ? (
            <SectionCard center>
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mx-auto mb-3">💼</div>
              <p className="text-gray-900 font-bold text-sm">אין משרות עדיין</p>
              <p className="text-gray-500 text-xs mt-1">הוסיפו את המשרות שאתם מגייסים כדי להתחיל</p>
              {canEdit && (
                <button onClick={() => setShowAdd(true)}
                  className="relative mt-4 mx-auto bg-gray-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 active:bg-gray-800">
                  <Plus size={14} />הוספת משרה
                  <span className="absolute -top-1.5 -left-1.5 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 attn-ring" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
                  </span>
                </button>
              )}
            </SectionCard>
          ) : (
            <div className="space-y-2">
              {positions.map((p) => {
                const open     = p.is_open;
                const expanded = expandedPos === p.id;
                const reqs     = p.requirements || {};
                const reqCount = countSetReqs(reqs);
                const qCount   = (p.questions || []).filter((q) => q.enabled).length;
                const tmpl     = templates.find((t) => t.id === p.template_id);
                const emoji    = tmpl?.icon || "💼";

                return (
                  <div key={p.id}
                    className={`rounded-2xl border bg-white shadow-sm transition-opacity ${open ? "" : "opacity-60"}`}>

                    {/* ── Card header ── */}
                    <div className="p-4 flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center text-xl">
                          {emoji}
                        </div>
                        {posNeedsSetup(p) && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 attn-ring" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-bold text-sm">
                          {p.name}
                          {!p.template_id && (
                            <span className="text-gray-400 text-[10px] font-semibold mr-1.5">· מותאם</span>
                          )}
                        </p>
                        <p className="text-gray-500 text-[11px] mt-0.5">
                          {p.hourly_rate > 0 ? `₪${p.hourly_rate}/שעה · ` : ""}
                          {p.open_count} {p.open_count > 1 ? "משרות" : "משרה"}
                          {reqCount > 0 && ` · ${reqCount} דרישות`}
                          {qCount > 0 && ` · ${qCount} שאלות`}
                          {!open && " · סגורה"}
                        </p>
                      </div>
                      <button onClick={() => togglePosition(p)} disabled={!canEdit}
                        className={`w-11 h-7 rounded-full flex items-center transition-colors flex-shrink-0 ${
                          open ? "bg-gray-900" : "bg-gray-200"
                        } disabled:opacity-50`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform mx-1 ${
                          open ? "translate-x-4" : "translate-x-0"
                        }`} />
                      </button>
                      <button onClick={() => setExpandedPos(expanded ? null : p.id)}
                        className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200 flex-shrink-0">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {canEdit && (
                        <button onClick={() => removePosition(p)}
                          title="מחיקת המשרה"
                          className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-500 active:bg-red-100 flex-shrink-0">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    {/* ── Expanded details ── */}
                    {expanded && (
                      <div className="border-t border-gray-100 px-4 pb-5 pt-4 space-y-5">

                        {/* ─ Pay & count ─ */}
                        <ReqSection label="פרטי המשרה">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <FieldLabel>
                                שכר לשעה (₪)
                                {!(p.hourly_rate > 0) && (
                                  <span className="text-red-500 mr-1 normal-case">· חסר</span>
                                )}
                              </FieldLabel>
                              <input type="number" min="0" disabled={!canEdit}
                                defaultValue={p.hourly_rate || ""}
                                onBlur={(e) => setSalary(p, e.target.value)}
                                placeholder="50"
                                className={`w-full rounded-xl px-3 py-2.5 text-gray-900 text-sm outline-none focus:bg-white disabled:opacity-50 text-center font-bold border ${
                                  p.hourly_rate > 0
                                    ? "bg-gray-50 border-gray-200 focus:border-gray-900"
                                    : "bg-red-50 border-red-300 focus:border-red-500"
                                }`} />
                            </div>
                            <div>
                              <FieldLabel>כמות משרות פתוחות</FieldLabel>
                              <div className="flex items-center gap-1">
                                <button onClick={() => setCount(p, p.open_count - 1)}
                                  disabled={!canEdit || p.open_count <= 1}
                                  className="w-8 h-9 rounded-lg bg-gray-100 text-gray-700 font-bold flex items-center justify-center disabled:opacity-30 active:bg-gray-200 text-lg">−</button>
                                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900 text-sm text-center font-bold">
                                  {p.open_count}
                                </div>
                                <button onClick={() => setCount(p, p.open_count + 1)} disabled={!canEdit}
                                  className="w-8 h-9 rounded-lg bg-gray-100 text-gray-700 font-bold flex items-center justify-center active:bg-gray-200 disabled:opacity-50 text-lg">+</button>
                              </div>
                            </div>
                          </div>
                        </ReqSection>

                        {/* ─ Shifts for this position ─ */}
                        <ReqSection label="משמרות למשרה זו">
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button onClick={() => setAllShifts(p)} disabled={!canEdit}
                              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1 ${
                                DAY_SHIFTS.every((s) => (p.shifts || []).includes(s))
                                  ? "bg-gray-900 text-white border-gray-900"
                                  : "bg-gray-100 text-gray-700 border-gray-200 active:bg-gray-200"
                              } disabled:opacity-50`}>
                              <CheckCheck size={12} />
                              {DAY_SHIFTS.every((s) => (p.shifts || []).includes(s)) ? "בטל הכל" : "בחר הכל"}
                            </button>
                            {DAY_SHIFTS.map((s) => (
                              <SmallChip key={s} on={(p.shifts || []).includes(s)} disabled={!canEdit}
                                onClick={() => toggleDayShift(p, s)}>
                                {s}
                              </SmallChip>
                            ))}
                          </div>
                        </ReqSection>

                        {/* ─ Experience ─ */}
                        <ReqSection label="ניסיון נדרש">
                          <div className="flex flex-wrap gap-2 mt-2">
                            {EXPERIENCE_OPTIONS.map(({ key, label }) => {
                              const on = reqs.experience === key;
                              return (
                                <SmallChip key={key} on={on} disabled={!canEdit}
                                  onClick={() => setReqs(p, { experience: on ? null : key })}>
                                  {label === "ללא" ? "ללא ניסיון" : `${label} שנים`}
                                </SmallChip>
                              );
                            })}
                          </div>
                        </ReqSection>

                        {/* ─ Age ─ */}
                        <ReqSection label="טווח גיל">
                          <div className="flex items-center gap-2 mt-2">
                            <input type="number" min="16" max="80" disabled={!canEdit}
                              defaultValue={reqs.age_min ?? ""}
                              onBlur={(e) => setReqs(p, { age_min: parseInt(e.target.value) || null })}
                              placeholder="מינ׳"
                              className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm text-center outline-none focus:bg-white focus:border-gray-900 disabled:opacity-50" />
                            <span className="text-gray-400 font-bold">–</span>
                            <input type="number" min="16" max="80" disabled={!canEdit}
                              defaultValue={reqs.age_max ?? ""}
                              onBlur={(e) => setReqs(p, { age_max: parseInt(e.target.value) || null })}
                              placeholder="מקס׳"
                              className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm text-center outline-none focus:bg-white focus:border-gray-900 disabled:opacity-50" />
                            <span className="text-gray-500 text-xs">שנים</span>
                          </div>
                        </ReqSection>

                        {/* ─ Military service ─ */}
                        <ReqSection label="שירות צבאי">
                          <div className="flex flex-wrap gap-2 mt-2">
                            {MILITARY_OPTIONS.map(({ key, label }) => {
                              const on = reqs.military === key;
                              return (
                                <SmallChip key={key} on={on} disabled={!canEdit}
                                  onClick={() => setReqs(p, { military: on ? null : key })}>
                                  {label}
                                </SmallChip>
                              );
                            })}
                          </div>
                        </ReqSection>

                        {/* ─ High school ─ */}
                        <ReqSection label="תעודת בגרות">
                          <div className="flex flex-wrap gap-2 mt-2">
                            <SmallChip on={reqs.high_school === true} disabled={!canEdit}
                              onClick={() => setReqs(p, { high_school: reqs.high_school === true ? null : true })}>
                              חובה
                            </SmallChip>
                            <SmallChip on={reqs.high_school === false} disabled={!canEdit}
                              onClick={() => setReqs(p, { high_school: reqs.high_school === false ? null : false })}>
                              לא נדרש
                            </SmallChip>
                          </div>
                        </ReqSection>

                        {/* ─ Shifts per week ─ */}
                        <ReqSection label="משמרות בשבוע">
                          <div className="flex flex-wrap gap-2 mt-2">
                            {SHIFTS_WEEK_OPTIONS.map(({ key, label, min, max }) => {
                              const on = reqs.shifts_key === key;
                              return (
                                <SmallChip key={key} on={on} disabled={!canEdit}
                                  onClick={() => setReqs(p, on
                                    ? { shifts_key: null, shifts_min: null, shifts_max: null }
                                    : { shifts_key: key, shifts_min: min, shifts_max: max }
                                  )}>
                                  {label}
                                </SmallChip>
                              );
                            })}
                          </div>
                        </ReqSection>

                        {/* ─ Weekends ─ */}
                        <ReqSection label='זמינות לסופ"ש'>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <SmallChip on={reqs.weekends === true} disabled={!canEdit}
                              onClick={() => setReqs(p, { weekends: reqs.weekends === true ? null : true })}>
                              חובה
                            </SmallChip>
                            <SmallChip on={reqs.weekends === false} disabled={!canEdit}
                              onClick={() => setReqs(p, { weekends: reqs.weekends === false ? null : false })}>
                              לא נדרש
                            </SmallChip>
                          </div>
                        </ReqSection>

                        {/* ─ Screening questions (per position) ─ */}
                        <ScreeningSection
                          position={p} canEdit={canEdit}
                          onToggle={toggleQuestion}
                          onDelete={deleteQuestion}
                          onAdd={(draft) => addQuestion(p, draft)} />

                        {/* ─ Remove ─ */}
                        {canEdit && (
                          <button onClick={() => removePosition(p)}
                            className="w-full bg-red-50 border border-red-100 text-red-700 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:bg-red-100">
                            <Trash2 size={13} />הסרת משרה
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Add position modal ── */}
      {showAdd && (
        <AddPositionModal
          templates={availableTemplates}
          onClose={() => setShowAdd(false)}
          onAddTemplates={addTemplates}
          onAddCustom={addCustomPosition} />
      )}
    </div>
  );
}

// ── Add position modal ──────────────────────────────────────────────────────
// Multi-select: tap as many catalog roles as you want (they highlight with a
// checkmark), then press the "הוספה" button at the bottom to add them all at
// once. Custom positions can be added alongside via the text field.
function AddPositionModal({ templates, onClose, onAddTemplates, onAddCustom }) {
  const [customName, setCustomName] = useState("");
  const [selected, setSelected]     = useState([]); // array of template ids
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const commit = () => {
    if (submitting || selected.length === 0) return;  // ignore double-press
    setSubmitting(true);
    const picked = templates.filter((t) => selected.includes(t.id));
    onAddTemplates(picked);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
      onClick={onClose}>
      <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6 pb-6 max-h-[82vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-gray-900 font-black text-lg">הוספת משרה</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <X size={16} />
          </button>
        </div>
        <p className="text-gray-500 text-xs mb-4">בחר/י משרה אחת או יותר ואז לחצ/י "הוספה".</p>

        {/* Catalog positions — multi-select */}
        {templates.length > 0 && (
          <>
            <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-2">תפקידים נפוצים</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {templates.map((t) => {
                const on = selected.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggle(t.id)}
                    className={`relative rounded-2xl p-4 text-center shadow-sm border-2 transition-colors ${
                      on ? "bg-gray-900 border-gray-900" : "bg-white border-gray-200 active:bg-gray-50"
                    }`}>
                    {on && (
                      <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                        <Check size={13} className="text-gray-900" />
                      </span>
                    )}
                    <div className="text-3xl mb-1">{t.icon || "💼"}</div>
                    <p className={`text-sm font-bold ${on ? "text-white" : "text-gray-900"}`}>{t.name}</p>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Custom position */}
        <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-2">משרה מותאמת</p>
        <div className="flex gap-2 mb-4">
          <input
            type="text" value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { onAddCustom(customName); setCustomName(""); } }}
            placeholder="שם המשרה"
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900" />
          <button onClick={() => { onAddCustom(customName); setCustomName(""); }}
            disabled={!customName.trim()}
            className="bg-gray-100 text-gray-900 px-4 py-2.5 rounded-xl text-sm font-bold active:bg-gray-200 disabled:opacity-30 flex items-center gap-1">
            <Plus size={14} />הוספה
          </button>
        </div>

        {/* Commit selected catalog roles */}
        <button onClick={commit} disabled={selected.length === 0 || submitting}
          className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-full text-sm active:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center gap-2 mt-1">
          {submitting
            ? <><Loader2 size={16} className="animate-spin" />מוסיף…</>
            : <>
                <Check size={16} />
                {selected.length === 0 ? "בחר/י משרות להוספה"
                  : selected.length === 1 ? "הוספת משרה אחת"
                  : `הוספת ${selected.length} משרות`}
              </>}
        </button>
      </div>
    </div>
  );
}

// ── Screening questions section (per position) ───────────────────────────────
function ScreeningSection({ position, canEdit, onToggle, onDelete, onAdd }) {
  const [adding,   setAdding]   = useState(false);
  const [text,     setText]     = useState("");
  const [type,     setType]     = useState("boolean");
  const [optsText, setOptsText] = useState("");

  const questions = position.questions || [];

  const submit = () => {
    const q = text.trim();
    if (!q) return;
    let options = [];
    if (type === "single_choice" || type === "multi_choice") {
      options = optsText.split(",").map((s) => s.trim()).filter(Boolean);
      if (options.length < 2) return;
    } else if (type === "scale") {
      options = { min: 1, max: 5 };
    }
    onAdd({ question: q, answer_type: type, options });
    setText(""); setOptsText(""); setType("boolean"); setAdding(false);
  };

  return (
    <ReqSection label="שאלות סינון למשרה זו">
      <div className="space-y-2 mt-2">
        {questions.length === 0 && !adding && (
          <p className="text-gray-400 text-xs">אין שאלות עדיין למשרה זו.</p>
        )}

        {questions.map((q) => (
          <div key={q.id}
            className={`flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 ${q.enabled ? "" : "opacity-50"}`}>
            <HelpCircle size={13} className="text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-xs font-semibold truncate">{q.question}</p>
              <p className="text-gray-400 text-[10px]">
                {ANSWER_TYPE_LABEL[q.answer_type] || q.answer_type}
                {!q.template_id && " · מותאמת"}
              </p>
            </div>
            {canEdit && (
              <>
                <button onClick={() => onToggle(q)}
                  className={`w-9 h-6 rounded-full flex items-center transition-colors flex-shrink-0 ${q.enabled ? "bg-gray-900" : "bg-gray-300"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${q.enabled ? "translate-x-3" : "translate-x-0"}`} />
                </button>
                <button onClick={() => onDelete(q)}
                  className="text-gray-400 active:text-red-500 flex-shrink-0">
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        ))}

        {/* Add custom question */}
        {canEdit && (adding ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <input
              type="text" value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="נסח/י שאלה…"
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm outline-none focus:border-gray-900" />
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ANSWER_TYPE_LABEL).map(([key, label]) => (
                <SmallChip key={key} on={type === key} onClick={() => setType(key)}>
                  {label}
                </SmallChip>
              ))}
            </div>
            {(type === "single_choice" || type === "multi_choice") && (
              <input
                type="text" value={optsText}
                onChange={(e) => setOptsText(e.target.value)}
                placeholder="אפשרויות, מופרדות בפסיק"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm outline-none focus:border-gray-900" />
            )}
            <div className="flex gap-2">
              <button onClick={submit}
                className="flex-1 bg-gray-900 text-white text-xs font-bold py-2 rounded-lg active:bg-gray-800 flex items-center justify-center gap-1">
                <Check size={13} />שמירה
              </button>
              <button onClick={() => { setAdding(false); setText(""); setOptsText(""); }}
                className="px-4 bg-gray-100 text-gray-600 text-xs font-bold py-2 rounded-lg active:bg-gray-200">
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full border border-dashed border-gray-300 text-gray-600 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:bg-gray-50">
            <Plus size={13} />שאלת סינון
          </button>
        ))}
      </div>
    </ReqSection>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Count how many requirement fields are filled for a position */
function countSetReqs(reqs) {
  let n = 0;
  if (reqs.experience)                                n++;
  if (reqs.age_min || reqs.age_max)                   n++;
  if (reqs.military)                                  n++;
  if (reqs.high_school !== null && reqs.high_school !== undefined) n++;
  if (reqs.shifts_key)                                n++;
  if (reqs.weekends !== null && reqs.weekends !== undefined)       n++;
  if ((reqs.custom || []).length > 0)                 n++;
  return n;
}

// ── Presentational ────────────────────────────────────────────────────────────

function SectionCard({ children, title, sub, center }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl p-4 shadow-sm ${center ? "text-center py-8" : ""}`}>
      {title && <p className="text-gray-900 font-bold text-sm">{title}</p>}
      {sub   && <p className="text-gray-500 text-[11px] mt-0.5">{sub}</p>}
      {children}
    </div>
  );
}

function ReqSection({ label, children }) {
  return (
    <div>
      <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-1.5">{children}</p>
  );
}

function SmallChip({ children, on, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1 ${
        on
          ? "bg-gray-900 text-white border-gray-900"
          : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
      } disabled:opacity-50`}>
      {children}
      {on && <Check size={11} />}
    </button>
  );
}
