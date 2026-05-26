import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { ChevronLeft, Loader2, Check, Plus, Minus, X } from "lucide-react";
import { logEvent } from "../lib/tracking";
import { normalizePhoneInput, isValidIsraeliPhone } from "../lib/phone";

// Local storage key for the wizard draft — scoped per user.
const draftKey = (uid) => `shiftmatch:wizard_draft:${uid}`;

// ─────────────────────────────────────────────────────────────────────────────
// WizardOnboarding — Fireberry-inspired wizard.
// One question per screen, light theme, chip selectors, full-width black CTA.
// Replaces the older chat-style onboarding.
// ─────────────────────────────────────────────────────────────────────────────

const TYPES = [
  "סושי", "איטלקי", "ים-תיכוני", "אסייתי", "מסעדת שף",
  "בר", "בית קפה", "מזון מהיר", "ישראלי", "המבורגרים",
  "פיצה", "בשרייה", "אחר",
];

const SIZE_OPTIONS = [
  { key: "small",  label: "1–10 עובדים" },
  { key: "med",    label: "11–25 עובדים" },
  { key: "large",  label: "26–50 עובדים" },
  { key: "xl",     label: "50+ עובדים" },
];

const POSITIONS = [
  { id: "מלצרים/ות",   emoji: "🧑‍🍳" },
  { id: "ברמנים/יות",  emoji: "🍸" },
  { id: "מארחות/ים",   emoji: "💁" },
  { id: "מנהלי משמרת", emoji: "📋" },
  { id: "עוזרי מלצר",  emoji: "🙋" },
  { id: "קופאים/ות",   emoji: "💰" },
  { id: "מזון מהיר",   emoji: "🍔" },
];

const SHIFTS = ["בוקר", "צהריים", "ערב", "לילה", "סופ\"ש"];

const BENEFITS = [
  "טיפים", "ארוחת עובד", "נסיעות", "בונוסים",
  "חנייה", "קידום פנימי", "הכשרה", "ביגוד",
  "טיפים גבוהים", "שעות גמישות", "מונית הביתה",
];

// Wizard step order — driven by index, with optional skip-on-first-step
// if we already have the restaurant name from signup.
const STEPS = ["name", "type", "size", "city", "positions", "salary", "shifts", "benefits", "whatsapp", "review"];

export default function WizardOnboarding({ user, onDone, onClose }) {
  const presetName = user?.user_metadata?.restaurant_name?.trim() || "";
  const presetCity = user?.user_metadata?.restaurant_city?.trim() || "";

  // Try to restore a draft if one exists for this user.
  const restored = (() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(draftKey(user?.id));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  })();

  const initialD = restored?.d || {
    name:  presetName,
    type:  "",
    size:  "",
    city:  presetCity,
    area:  "",
    positions: [],
    positionSalaries: {},
    positionCounts: {},
    shifts: [],
    benefits: [],
    whatsapp: "",
    urgent: false,
  };

  // First incomplete step: name (if blank) → otherwise jump to where they left off.
  const initialStep = restored?.step ?? (initialD.name ? 1 : 0);

  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [d, setD] = useState(initialD);

  // Persist a draft on every change so the wizard can resume cleanly.
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;
    try {
      window.localStorage.setItem(draftKey(user.id), JSON.stringify({ step, d }));
    } catch { /* quota — ignore */ }
  }, [step, d, user?.id]);

  const clearDraft = () => {
    if (typeof window === "undefined" || !user?.id) return;
    try { window.localStorage.removeItem(draftKey(user.id)); } catch {}
  };

  // Helpers
  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const stepId = STEPS[step];

  // Can we advance from the current step?  Each step's "ready" rule.
  const canAdvance = (() => {
    switch (stepId) {
      case "name":      return d.name.trim().length > 1;
      case "type":      return d.type.length > 0;
      case "size":      return d.size.length > 0;
      case "city":      return d.city.trim().length > 1;
      case "positions": return d.positions.length > 0;
      case "salary":    return d.positions.every((p) => (d.positionSalaries[p] || 0) > 0);
      case "shifts":    return d.shifts.length > 0;
      case "benefits":  return true; // optional
      case "whatsapp":  return isValidIsraeliPhone(d.whatsapp);
      case "review":    return true;
      default:          return false;
    }
  })();

  const save = async () => {
    if (saving) return;
    setSaving(true); setErr("");

    // Avg hourly_rate from per-position salaries (for legacy column).
    const vals = Object.values(d.positionSalaries);
    const avg  = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;

    // Sum total open positions from per-position counts.
    const totalOpen = Object.values(d.positionCounts).reduce((a, b) => a + (parseInt(b) || 0), 0) || d.positions.length;

    const payload = {
      owner_id: user.id,
      name: d.name,
      type: d.type,
      city: d.city,
      area: d.area || "",
      description: `${d.name} — ${d.type} ב${d.city}`,
      image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
      phone: d.whatsapp,
      recruitment_whatsapp: d.whatsapp,
      contact_name: user.user_metadata?.name || user.email,
      hourly_rate: avg,
      position_types: d.positions,
      position_salaries: d.positionSalaries,
      position_counts: d.positionCounts,
      position_open: Object.fromEntries(d.positions.map((p) => [p, true])),
      open_positions: totalOpen,
      shifts: d.shifts,
      benefits: d.benefits,
      active: true,
    };

    const { data: saved, error } = await supabase
      .from("restaurants")
      .upsert(payload, { onConflict: "owner_id" })
      .select()
      .single();

    if (error) {
      // Friendly message when the unique (name, city) index trips.
      const friendly = error.code === "23505" || /unique|duplicate/i.test(error.message || "")
        ? "מסעדה בשם הזה בעיר הזו כבר רשומה. נסה/י שם אחר או פנה/י לתמיכה."
        : (error.message || "שגיאה בשמירה");
      setErr(friendly);
      setSaving(false);
      return;
    }

    // Successful save — clean up the draft so a future re-entry is fresh.
    clearDraft();

    logEvent("restaurant", "published", {
      user_id: user.id, restaurant_name: d.name,
      type: d.type, city: d.city,
    });

    // Loading transition for the warm "almost there" moment, then hand off.
    setStep(STEPS.length); // beyond review → triggers loading screen
    setTimeout(() => onDone?.(saved), 1500);
  };

  // ── Loading transition (after save) ────────────────────────────────────
  if (step >= STEPS.length) {
    return (
      <Frame>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center mb-6 shadow-2xl shadow-brand-500/30">
            <span className="text-3xl">🍽️</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900">אנחנו כמעט שם!</h1>
          <p className="text-gray-500 text-sm mt-2">מקימים את החשבון של {d.name}…</p>
          <div className="mt-8 w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full" style={{ width: "100%", animation: "fillBar 1.4s ease-out" }} />
          </div>
        </div>
        <style>{`@keyframes fillBar { from { width: 0% } to { width: 100% } }`}</style>
      </Frame>
    );
  }

  // ── Step UIs ──────────────────────────────────────────────────────────

  return (
    <Frame>
      {/* Header: close + back + progress */}
      <div className="px-5 pt-4 flex items-center gap-3 safe-top">
        {onClose && (
          <button onClick={onClose}
            aria-label="סגור הגדרה"
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
            <X size={18} className="text-gray-700" />
          </button>
        )}
        {step > 0 && (
          <button onClick={back}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
            <ChevronLeft size={20} className="text-gray-700 -scale-x-100" />
          </button>
        )}
        <Progress idx={step} total={STEPS.length} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4">
        {stepId === "name" && (
          <Step title="מה שם המסעדה?" sub="זה השם שמועמדים יראו בכרטיס המודעה.">
            <TextInput value={d.name} onChange={(v) => set({ name: v })}
              placeholder="לדוגמה: סטודיו, פורט סעיד..." autoFocus />
          </Step>
        )}

        {stepId === "type" && (
          <TypeStep value={d.type} onChange={(v) => set({ type: v })} />
        )}

        {stepId === "size" && (
          <Step title="כמה עובדים יש לכם?" sub="הערכה גסה — אפשר לשנות מאוחר יותר.">
            <Chips options={SIZE_OPTIONS.map((o) => o.label)}
              value={SIZE_OPTIONS.find((o) => o.key === d.size)?.label || ""}
              onChange={(label) => set({ size: SIZE_OPTIONS.find((o) => o.label === label)?.key })} />
          </Step>
        )}

        {stepId === "city" && (
          <Step title="באיזו עיר?" sub="אופציה לציין גם שכונה / אזור.">
            <TextInput value={d.city} onChange={(v) => set({ city: v })}
              placeholder="תל אביב, ירושלים, חיפה..." autoFocus />
            <div className="h-3" />
            <TextInput value={d.area} onChange={(v) => set({ area: v })}
              placeholder="שכונה / אזור (אופציונלי)" />
          </Step>
        )}

        {stepId === "positions" && (
          <Step title="אילו תפקידים אתם מגייסים?" sub="ניתן לבחור כמה.">
            <PositionPicker
              options={POSITIONS}
              selected={d.positions}
              onChange={(arr) => set({ positions: arr })}
            />
          </Step>
        )}

        {stepId === "salary" && (() => {
          const missing = d.positions.filter((p) => !(d.positionSalaries[p] > 0));
          return (
            <Step title="כמה משלמים לשעה?" sub="מלא/י שכר לכל תפקיד כדי להמשיך.">
              <SalaryGrid
                positions={d.positions}
                counts={d.positionCounts}
                salaries={d.positionSalaries}
                onCounts={(c) => set({ positionCounts: c })}
                onSalaries={(s) => set({ positionSalaries: s })}
              />
              {missing.length > 0 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3 flex items-start gap-2">
                  <span className="text-base">⚠️</span>
                  <p className="text-xs leading-relaxed">
                    כדי להמשיך, מלא/י שכר לשעה עבור: <b>{missing.join(" · ")}</b>
                  </p>
                </div>
              )}
            </Step>
          );
        })()}

        {stepId === "shifts" && (
          <Step title="אילו משמרות צריך לכסות?" sub="ניתן לבחור כמה.">
            <Chips options={SHIFTS} value={d.shifts} onChange={(v) => set({ shifts: v })} multi />
          </Step>
        )}

        {stepId === "benefits" && (
          <Step title="מה ההטבות שאתם מציעים?" sub="אופציונלי — דלגו אם אין.">
            <Chips options={BENEFITS} value={d.benefits} onChange={(v) => set({ benefits: v })} multi />
          </Step>
        )}

        {stepId === "whatsapp" && (
          <Step title="מספר וואטסאפ לגיוס" sub="כל מועמד שיתעניין יצור איתך קשר דרך המספר הזה.">
            <TextInput
              value={d.whatsapp}
              onChange={(v) => set({ whatsapp: normalizePhoneInput(v) })}
              placeholder="0501234567"
              type="tel" inputMode="numeric" maxLength={10} dir="ltr" autoFocus
            />
            {d.whatsapp && !isValidIsraeliPhone(d.whatsapp) && (
              <p className="text-amber-600 text-xs mt-2">המספר חייב להתחיל ב-05 ולכלול 10 ספרות בסך הכל</p>
            )}
          </Step>
        )}

        {stepId === "review" && (
          <Step title="סיכום מהיר" sub="הנה מה שאנחנו עומדים לפרסם.">
            <ReviewCard d={d} />
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
        <button
          onClick={stepId === "review" ? save : next}
          disabled={!canAdvance || saving}
          className="w-full bg-gray-900 text-white font-bold py-4 rounded-full text-base active:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10">
          {saving && <Loader2 size={18} className="animate-spin" />}
          {stepId === "review" ? "פרסום המודעה 🚀" : "המשך"}
        </button>
        {(stepId === "benefits" || stepId === "city") && d.area === "" && stepId === "city" && (
          <button onClick={() => { set({ area: "" }); next(); }}
            className="w-full text-gray-500 text-xs font-semibold py-3 underline">
            דלג/י
          </button>
        )}
      </div>
    </Frame>
  );
}

// ── Type step with free-text "Other" support ─────────────────────────────
//
// The preset types are chips; selecting "אחר" replaces the value with empty
// string and reveals an input.  Picking any other chip clears the free text.
function TypeStep({ value, onChange }) {
  // "Other" mode = the current value isn't one of the preset (non-other) labels.
  const PRESETS = TYPES.slice(0, -1);            // everything except "אחר"
  const isOther = value !== "" && !PRESETS.includes(value);
  const [otherMode, setOtherMode] = useState(isOther);

  const selectedChip = otherMode ? "אחר" : (PRESETS.includes(value) ? value : "");

  return (
    <Step title="איזה סוג מסעדה?" sub="עוזר לנו להציע מועמדים מתאימים.">
      <Chips
        options={TYPES}
        value={selectedChip}
        onChange={(v) => {
          if (v === "אחר") { setOtherMode(true); onChange(""); }
          else             { setOtherMode(false); onChange(v); }
        }}
      />
      {otherMode && (
        <div className="mt-4">
          <TextInput
            value={value}
            onChange={onChange}
            placeholder="פרט/י סוג מסעדה..."
            autoFocus
          />
        </div>
      )}
    </Step>
  );
}

// ── Small presentational components ───────────────────────────────────────

function Frame({ children }) {
  return (
    <div className="h-full bg-white flex flex-col text-gray-900" dir="rtl">
      {children}
    </div>
  );
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

function TextInput({ value, onChange, placeholder, type = "text", maxLength, inputMode, dir, autoFocus }) {
  return (
    <input
      type={type} value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} maxLength={maxLength} inputMode={inputMode}
      dir={dir} autoFocus={autoFocus}
      className={`w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 placeholder-gray-400 text-base outline-none focus:bg-white focus:border-gray-900 transition-colors ${dir === "ltr" ? "text-left" : ""}`}
    />
  );
}

// Chips: single or multi-select with light pill style.
function Chips({ options, value, onChange, multi = false }) {
  const isOn = (o) => multi ? value.includes(o) : value === o;
  const toggle = (o) => {
    if (multi) onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
    else onChange(o);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = isOn(o);
        return (
          <button key={o} onClick={() => toggle(o)}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-all border ${
              on
                ? "bg-gray-900 text-white border-gray-900 shadow-md"
                : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
            }`}>
            {o}{on && multi && <Check size={12} className="inline mr-1.5" />}
          </button>
        );
      })}
    </div>
  );
}

function PositionPicker({ options, selected, onChange }) {
  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button key={p.id} onClick={() => toggle(p.id)}
            className={`p-4 rounded-2xl text-center transition-all border ${
              on
                ? "bg-gray-900 text-white border-gray-900 shadow-md"
                : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
            }`}>
            <div className="text-2xl mb-1">{p.emoji}</div>
            <div className="text-sm font-bold">{p.id}</div>
          </button>
        );
      })}
    </div>
  );
}

function SalaryGrid({ positions, counts, salaries, onCounts, onSalaries }) {
  const setCount   = (p, v) => onCounts({ ...counts, [p]: Math.max(1, parseInt(v) || 1) });
  const setSalary  = (p, v) => onSalaries({ ...salaries, [p]: Math.max(0, parseInt(v) || 0) });

  return (
    <div className="space-y-3">
      {positions.map((p) => (
        <div key={p} className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <p className="text-gray-900 font-bold text-sm mb-3">{p}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide block mb-1.5">משרות</label>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1">
                <button onClick={() => setCount(p, (counts[p] || 1) - 1)}
                  className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 font-bold flex items-center justify-center">
                  <Minus size={14} />
                </button>
                <span className="flex-1 text-center text-gray-900 font-bold">{counts[p] || 1}</span>
                <button onClick={() => setCount(p, (counts[p] || 1) + 1)}
                  className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 font-bold flex items-center justify-center">
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide block mb-1.5">₪ לשעה</label>
              <input type="number" min="0" value={salaries[p] || ""}
                onChange={(e) => setSalary(p, e.target.value)}
                placeholder="50"
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm outline-none focus:border-gray-900 text-center font-bold" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewCard({ d }) {
  const Row = ({ label, value }) => value ? (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-gray-900 font-semibold text-sm text-end">{value}</span>
    </div>
  ) : null;

  const totalPositions = Object.values(d.positionCounts).reduce((a, b) => a + (parseInt(b) || 0), 0) || d.positions.length;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2">
      <Row label="שם" value={d.name} />
      <Row label="סוג" value={d.type} />
      <Row label="עיר" value={d.city + (d.area ? ` · ${d.area}` : "")} />
      <Row label="תפקידים" value={d.positions.join(" · ") + ` (${totalPositions} משרות)`} />
      <Row label="משמרות" value={d.shifts.join(" · ")} />
      <Row label="הטבות" value={d.benefits.join(" · ") || "—"} />
      <Row label="וואטסאפ" value={d.whatsapp} />
    </div>
  );
}
