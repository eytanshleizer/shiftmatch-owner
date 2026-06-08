import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import {
  ChevronLeft, Loader2, Check, X, Plus, Eye, EyeOff,
  Briefcase, HelpCircle, Trash2, Sparkles,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// JobsSetupWizard — the FIRST-TIME, step-by-step jobs setup (shown instead of
// the JobsTab editor the very first time an owner opens "משרות").
//
// Flow (one screen at a time, like the signup wizard):
//   1. pick            → which roles are you hiring? (toggle on/off + custom)
//   2. salary:<job>    → reveal the salary to waiters? yes/no (+ amount if yes)
//   3. reqs:<job>      → requirements for the role (experience / age / military /
//                        weekly shifts / weekends) + free-text open questions
//   4. review          → summary, then "פרסום" creates everything
//
// On finish it bulk-creates restaurant_positions rows, inserts the open
// questions as answer_type="text" screening rows, and syncs the legacy
// restaurants.position_* JSON columns so the rest of the app keeps working.
// ─────────────────────────────────────────────────────────────────────────────

const EXPERIENCE_OPTIONS = [
  { key: "none",   label: "ללא ניסיון" },
  { key: "1_plus", label: "1+ שנים" },
  { key: "2_plus", label: "2+ שנים" },
  { key: "3_plus", label: "3+ שנים" },
  { key: "5_plus", label: "5+ שנים" },
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

// Fallback role catalog if position_templates can't be fetched.
const FALLBACK_TEMPLATES = [
  { id: "f-waiter",    name: "מלצר/ית",   icon: "🍽️" },
  { id: "f-bartender", name: "ברמן/ית",   icon: "🍸" },
  { id: "f-host",      name: "מארח/ת",    icon: "🛎️" },
  { id: "f-runner",    name: "ראנר/ית",   icon: "🏃" },
  { id: "f-chef",      name: "טבח/ית",    icon: "👨‍🍳" },
  { id: "f-barista",   name: "בריסטה",    icon: "☕" },
];

export default function JobsSetupWizard({ restaurant, onDone, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loadingTmpl, setLoadingTmpl] = useState(true);

  // Selected jobs keyed by template id (custom roles get a synthetic id).
  // Each: { id, templateId, name, icon, reveal, salary, reqs:{}, questions:[] }
  const [jobs, setJobs] = useState({});
  const [customName, setCustomName] = useState("");

  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    supabase.from("position_templates").select("*").order("sort_order").then(({ data }) => {
      if (!alive) return;
      setTemplates(data?.length ? data : FALLBACK_TEMPLATES);
      setLoadingTmpl(false);
    });
    return () => { alive = false; };
  }, []);

  const selected = useMemo(() => Object.values(jobs), [jobs]);

  // Dynamic step list: pick → one salary step per job → one reqs step per job → review.
  const steps = useMemo(() => {
    const list = ["pick"];
    selected.forEach((j) => list.push(`salary:${j.id}`));
    selected.forEach((j) => list.push(`reqs:${j.id}`));
    list.push("review");
    return list;
  }, [selected]);

  // Keep the index in range when the job list shrinks.
  useEffect(() => {
    if (stepIdx > steps.length - 1) setStepIdx(steps.length - 1);
  }, [steps.length]); // eslint-disable-line

  const stepId = steps[stepIdx] || "pick";
  const [stepKind, stepJobId] = stepId.split(":");
  const curJob = stepJobId ? jobs[stepJobId] : null;

  const setJob = (id, patch) =>
    setJobs((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const setReqs = (id, patch) =>
    setJobs((prev) => ({ ...prev, [id]: { ...prev[id], reqs: { ...prev[id].reqs, ...patch } } }));

  const toggleTemplate = (t) =>
    setJobs((prev) => {
      const nx = { ...prev };
      if (nx[t.id]) delete nx[t.id];
      else nx[t.id] = {
        id: t.id, templateId: t.id.startsWith("f-") ? null : t.id,
        name: t.name, icon: t.icon || "💼",
        reveal: false, salary: restaurant?.hourly_rate || "",
        reqs: {}, questions: [],
      };
      return nx;
    });

  const addCustom = () => {
    const n = customName.trim();
    if (!n) return;
    if (selected.some((j) => j.name === n)) { setCustomName(""); return; }
    const id = "c-" + Date.now();
    setJobs((prev) => ({
      ...prev,
      [id]: { id, templateId: null, name: n, icon: "💼", reveal: false,
        salary: restaurant?.hourly_rate || "", reqs: {}, questions: [] },
    }));
    setCustomName("");
  };

  const next = () => setStepIdx((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStepIdx((s) => Math.max(s - 1, 0));

  // Guided tour — nothing is forced. The primary CTA is enabled once there's at
  // least one job to talk about; every step also offers a skip.
  const canAdvance = stepKind === "pick" ? selected.length > 0 : true;

  // ── Persist everything ──────────────────────────────────────────────────────
  // Used both by "פרסום המשרות" (review) and by "עריכה בהמשך" (save what's been
  // picked so far and drop the owner into the dashboard). Handles the empty case
  // gracefully so an early exit with no jobs just leaves.
  const save = async () => {
    if (saving) return;
    if (!selected.length) { onDone?.(); return; }
    setSaving(true); setErr("");
    try {
      const rows = selected.map((j) => ({
        restaurant_id: restaurant.id,
        template_id:   j.templateId,
        name:          j.name,
        hourly_rate:   j.reveal ? (Number(j.salary) || 0) : 0,
        open_count:    1,
        is_open:       true,
        reveal_salary: !!j.reveal,
        shifts:        restaurant?.shifts || [],
        requirements:  j.reqs || {},
      }));

      const { data: inserted, error } = await supabase
        .from("restaurant_positions").insert(rows).select();
      if (error) throw error;

      // Open questions → answer_type "text", matched back to inserted rows by name.
      const qRows = [];
      selected.forEach((j) => {
        const row = (inserted || []).find((r) => r.name === j.name);
        if (!row) return;
        (j.questions || []).forEach((q, i) => qRows.push({
          position_id: row.id, template_id: null, question: q,
          answer_type: "text", options: [], enabled: true,
          is_required: false, sort_order: i + 1,
        }));
      });
      if (qRows.length) await supabase.from("position_screening_questions").insert(qRows);

      // Sync legacy mirror columns so listings/matching keep working.
      const position_types = [], position_open = {}, position_salaries = {},
            position_counts = {}, position_requirements = {};
      (inserted || []).forEach((p) => {
        position_types.push(p.name);
        position_open[p.name]         = p.is_open;
        position_salaries[p.name]     = p.reveal_salary === false ? 0 : p.hourly_rate;
        position_counts[p.name]       = p.open_count;
        position_requirements[p.name] = p.requirements || {};
      });
      await supabase.from("restaurants").update({
        position_types, position_open, position_salaries, position_counts, position_requirements,
      }).eq("id", restaurant.id);

      onDone?.();
    } catch (e) {
      setErr(e.message || "שגיאה בשמירה");
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full bg-white flex flex-col text-gray-900" dir="rtl">
      {/* Header */}
      <div className="px-5 pt-4 flex items-center gap-3 safe-top">
        {onClose && stepIdx === 0 && (
          <button onClick={onClose} aria-label="סגירה"
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
            <X size={18} className="text-gray-700" />
          </button>
        )}
        {stepIdx > 0 && (
          <button onClick={back}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
            <ChevronLeft size={20} className="text-gray-700 -scale-x-100" />
          </button>
        )}
        <Progress idx={stepIdx} total={steps.length} />
        {/* Always-available escape: save whatever is picked and go to dashboard. */}
        {stepKind !== "review" && (
          <button onClick={save} disabled={saving}
            className="text-gray-500 text-xs font-bold whitespace-nowrap active:text-gray-700 disabled:opacity-50">
            עריכה בהמשך
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4">

        {/* ── Step 1: pick roles ── */}
        {stepKind === "pick" && (
          <Step title="אילו משרות אתם מגייסים?"
            sub="בחרו את התפקידים שאתם צריכים. נגדיר יחד שכר ודרישות לכל אחד.">
            {loadingTmpl ? (
              <div className="flex justify-center py-10">
                <Loader2 size={26} className="text-gray-300 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  {templates.map((t) => {
                    const on = !!jobs[t.id];
                    return (
                      <button key={t.id} onClick={() => toggleTemplate(t)}
                        className={`relative rounded-2xl p-4 text-center border-2 transition-colors ${
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

                {/* Custom roles already added */}
                {selected.filter((j) => String(j.id).startsWith("c-")).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selected.filter((j) => String(j.id).startsWith("c-")).map((j) => (
                      <span key={j.id}
                        className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs font-bold pr-3 pl-2 py-2 rounded-full">
                        {j.name}
                        <button onClick={() => setJobs((p) => { const n = { ...p }; delete n[j.id]; return n; })}>
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add custom */}
                <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wide mt-5 mb-2">
                  משרה מותאמת
                </p>
                <div className="flex gap-2">
                  <input value={customName} onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
                    placeholder="שם המשרה"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-gray-900" />
                  <button onClick={addCustom} disabled={!customName.trim()}
                    className="bg-gray-100 text-gray-900 px-4 rounded-xl text-sm font-bold active:bg-gray-200 disabled:opacity-30 flex items-center gap-1">
                    <Plus size={14} />הוספה
                  </button>
                </div>
              </>
            )}
          </Step>
        )}

        {/* ── Step 2: reveal salary per job ── */}
        {stepKind === "salary" && curJob && (
          <Step title={`שכר עבור ${curJob.name}`}
            sub="האם להציג את השכר למלצרים? הצגת השכר עוזרת לגייס מהר יותר.">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-2xl">{curJob.icon}</span>
              <span className="font-bold text-gray-900">{curJob.name}</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => setJob(curJob.id, { reveal: true })}
                className={`rounded-2xl p-4 border-2 text-center transition-colors ${
                  curJob.reveal ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-900 active:bg-gray-50"
                }`}>
                <Eye size={22} className="mx-auto mb-1.5" />
                <p className="text-sm font-bold">להציג שכר</p>
                <p className={`text-[11px] mt-0.5 ${curJob.reveal ? "text-gray-300" : "text-gray-400"}`}>גיוס מהיר יותר</p>
              </button>
              <button onClick={() => setJob(curJob.id, { reveal: false })}
                className={`rounded-2xl p-4 border-2 text-center transition-colors ${
                  !curJob.reveal ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-900 active:bg-gray-50"
                }`}>
                <EyeOff size={22} className="mx-auto mb-1.5" />
                <p className="text-sm font-bold">לפי סיכום</p>
                <p className={`text-[11px] mt-0.5 ${!curJob.reveal ? "text-gray-300" : "text-gray-400"}`}>השכר לא יוצג</p>
              </button>
            </div>

            {curJob.reveal && (
              <div className="mt-5">
                <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-1.5">
                  שכר לשעה (₪)
                </p>
                <input type="number" min="0" inputMode="numeric"
                  value={curJob.salary}
                  onChange={(e) => setJob(curJob.id, { salary: e.target.value })}
                  placeholder="50" autoFocus
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center font-bold text-lg outline-none focus:bg-white focus:border-gray-900" />
                {!(Number(curJob.salary) > 0) && (
                  <p className="text-gray-400 text-xs mt-2">אפשר להזין עכשיו או להשלים בהמשך</p>
                )}
              </div>
            )}
          </Step>
        )}

        {/* ── Step 3: requirements + open questions per job ── */}
        {stepKind === "reqs" && curJob && (
          <Step title={`דרישות עבור ${curJob.name}`}
            sub="בחרו רק מה שרלוונטי — אפשר להשאיר ריק ולעדכן בהמשך.">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="text-2xl">{curJob.icon}</span>
              <span className="font-bold text-gray-900">{curJob.name}</span>
            </div>

            <div className="space-y-5">
              <ReqSection label="ניסיון נדרש">
                <ChipRow>
                  {EXPERIENCE_OPTIONS.map(({ key, label }) => (
                    <SmallChip key={key} on={curJob.reqs.experience === key}
                      onClick={() => setReqs(curJob.id, { experience: curJob.reqs.experience === key ? null : key })}>
                      {label}
                    </SmallChip>
                  ))}
                </ChipRow>
              </ReqSection>

              <ReqSection label="טווח גיל">
                <div className="flex items-center gap-2 mt-2">
                  <input type="number" min="16" max="80" placeholder="מינ׳"
                    value={curJob.reqs.age_min ?? ""}
                    onChange={(e) => setReqs(curJob.id, { age_min: parseInt(e.target.value) || null })}
                    className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center outline-none focus:bg-white focus:border-gray-900" />
                  <span className="text-gray-400 font-bold">–</span>
                  <input type="number" min="16" max="80" placeholder="מקס׳"
                    value={curJob.reqs.age_max ?? ""}
                    onChange={(e) => setReqs(curJob.id, { age_max: parseInt(e.target.value) || null })}
                    className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center outline-none focus:bg-white focus:border-gray-900" />
                  <span className="text-gray-500 text-xs">שנים</span>
                </div>
              </ReqSection>

              <ReqSection label="שירות צבאי">
                <ChipRow>
                  {MILITARY_OPTIONS.map(({ key, label }) => (
                    <SmallChip key={key} on={curJob.reqs.military === key}
                      onClick={() => setReqs(curJob.id, { military: curJob.reqs.military === key ? null : key })}>
                      {label}
                    </SmallChip>
                  ))}
                </ChipRow>
              </ReqSection>

              <ReqSection label="משמרות בשבוע">
                <ChipRow>
                  {SHIFTS_WEEK_OPTIONS.map(({ key, label, min, max }) => (
                    <SmallChip key={key} on={curJob.reqs.shifts_key === key}
                      onClick={() => setReqs(curJob.id, curJob.reqs.shifts_key === key
                        ? { shifts_key: null, shifts_min: null, shifts_max: null }
                        : { shifts_key: key, shifts_min: min, shifts_max: max })}>
                      {label}
                    </SmallChip>
                  ))}
                </ChipRow>
              </ReqSection>

              <ReqSection label='זמינות לסופ"ש'>
                <ChipRow>
                  <SmallChip on={curJob.reqs.weekends === true}
                    onClick={() => setReqs(curJob.id, { weekends: curJob.reqs.weekends === true ? null : true })}>
                    חובה
                  </SmallChip>
                  <SmallChip on={curJob.reqs.weekends === false}
                    onClick={() => setReqs(curJob.id, { weekends: curJob.reqs.weekends === false ? null : false })}>
                    לא נדרש
                  </SmallChip>
                </ChipRow>
              </ReqSection>

              {/* Open questions */}
              <ReqSection label="שאלות פתוחות">
                <p className="text-gray-400 text-[11px] mt-1 leading-relaxed">
                  שאלות שהמלצר יענה עליהן בחופשי בעת ההגשה — למשל "מה ניסיונך הקודם?"
                </p>
                <OpenQuestions
                  questions={curJob.questions}
                  onChange={(qs) => setJob(curJob.id, { questions: qs })} />
              </ReqSection>
            </div>
          </Step>
        )}

        {/* ── Step 4: review ── */}
        {stepKind === "review" && (
          <Step title="סיכום מהיר" sub="הנה המשרות שעומדות להתפרסם.">
            {selected.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
                <p className="text-gray-900 font-bold text-sm">לא נבחרו משרות עדיין</p>
                <p className="text-gray-500 text-xs mt-1">אפשר לחזור ולבחור, או להמשיך ולהוסיף משרות מאוחר יותר.</p>
              </div>
            )}
            <div className="space-y-2.5">
              {selected.map((j) => (
                <div key={j.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{j.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{j.name}</p>
                      <p className="text-gray-500 text-[11px] mt-0.5">
                        {j.reveal && Number(j.salary) > 0 ? `₪${j.salary}/שעה` : "שכר לפי סיכום"}
                        {countReqs(j.reqs) > 0 && ` · ${countReqs(j.reqs)} דרישות`}
                        {(j.questions || []).length > 0 && ` · ${j.questions.length} שאלות`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {err && (
              <div className="bg-red-50 border border-red-100 rounded-xl py-3 px-4 text-red-700 text-sm text-center mt-4">
                {err}
              </div>
            )}
          </Step>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-8 safe-bottom border-t border-gray-100 pt-4 bg-white">
        <button onClick={stepKind === "review" ? save : next}
          disabled={!canAdvance || saving}
          className="w-full bg-gray-900 text-white font-bold py-4 rounded-full text-base active:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10">
          {saving && <Loader2 size={18} className="animate-spin" />}
          {stepKind === "review" ? (selected.length > 0 ? "פרסום המשרות 🚀" : "מעבר לדאשבורד")
            : stepKind === "pick" ? (selected.length > 0 ? `המשך · ${selected.length} משרות` : "בחרו משרה אחת לפחות")
            : "המשך"}
        </button>
        {/* Guided-tour skip — advances to the next step without choosing. */}
        {stepKind !== "review" && (
          <button onClick={next}
            className="w-full text-gray-400 text-xs font-semibold py-3 underline">
            {stepKind === "reqs" ? "דלג/י — אגדיר דרישות בהמשך"
              : stepKind === "salary" ? "דלג/י — אגדיר שכר בהמשך"
              : "דלג/י לשלב הבא"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Open questions editor ─────────────────────────────────────────────────────
function OpenQuestions({ questions, onChange }) {
  const [text, setText] = useState("");
  const add = () => { const q = text.trim(); if (!q) return; onChange([...(questions || []), q]); setText(""); };
  const remove = (i) => onChange(questions.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2 mt-2">
      {(questions || []).map((q, i) => (
        <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
          <HelpCircle size={13} className="text-gray-400 flex-shrink-0" />
          <p className="flex-1 min-w-0 text-gray-900 text-xs font-semibold truncate">{q}</p>
          <button onClick={() => remove(i)} className="text-gray-400 active:text-red-500 flex-shrink-0">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="נסח/י שאלה…"
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-gray-900" />
        <button onClick={add} disabled={!text.trim()}
          className="bg-gray-100 text-gray-900 px-4 rounded-xl text-sm font-bold active:bg-gray-200 disabled:opacity-30 flex items-center gap-1">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Helpers / presentational ──────────────────────────────────────────────────
function countReqs(reqs = {}) {
  let n = 0;
  if (reqs.experience) n++;
  if (reqs.age_min || reqs.age_max) n++;
  if (reqs.military) n++;
  if (reqs.shifts_key) n++;
  if (reqs.weekends !== null && reqs.weekends !== undefined) n++;
  return n;
}

function Progress({ idx, total }) {
  return (
    <div className="flex-1 flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
          i < idx ? "bg-gray-900" : i === idx ? "bg-gray-900/60" : "bg-gray-200"
        }`} />
      ))}
    </div>
  );
}

function Step({ title, sub, children }) {
  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 leading-tight">{title}</h1>
      {sub && <p className="text-gray-500 text-sm mt-2 mb-6 leading-relaxed">{sub}</p>}
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

function ChipRow({ children }) {
  return <div className="flex flex-wrap gap-2 mt-2">{children}</div>;
}

function SmallChip({ children, on, onClick }) {
  return (
    <button onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1 ${
        on ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
      }`}>
      {children}
      {on && <Check size={11} />}
    </button>
  );
}
