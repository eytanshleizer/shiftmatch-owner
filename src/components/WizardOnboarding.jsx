import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { ChevronLeft, Loader2, Check, X, ImageOff } from "lucide-react";
import { logEvent } from "../lib/tracking";
import { normalizePhoneInput, isValidIsraeliPhone } from "../lib/phone";

// Local storage key for the wizard draft — scoped per user.
const draftKey = (uid) => `shiftmatch:wizard_draft:${uid}`;

// ─────────────────────────────────────────────────────────────────────────────
// WizardOnboarding — restaurant details only.
// Steps: name → type → size → city → kosher → whatsapp → photo → review
// Positions / shifts / benefits are configured later in the Jobs tab.
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

const KOSHER_OPTIONS = [
  { key: "rabbinate", label: "כשר (רבנות)" },
  { key: "badatz",    label: 'כשר (בד"ץ)' },
  { key: "non",       label: "לא כשר" },
  { key: "vegan",     label: "טבעוני" },
];

const STEPS = ["name", "type", "size", "city", "kosher", "whatsapp", "photo", "review"];

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
    name:     presetName,
    type:     "",
    size:     "",
    city:     presetCity,
    area:     "",
    kosher:   null,
    whatsapp: "",
    imageUrl: null,
  };

  // Clamp restored step so stale drafts from old wizard don't go out of bounds.
  const initialStep = Math.min(
    restored?.step ?? (initialD.name ? 1 : 0),
    STEPS.length - 1
  );

  const [step,   setStep]   = useState(initialStep);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const [d,      setD]      = useState(initialD);

  // Persist draft on every change.
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

  const set  = (patch) => setD((x) => ({ ...x, ...patch }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const stepId = STEPS[step];

  const canAdvance = (() => {
    switch (stepId) {
      case "name":     return d.name.trim().length > 1;
      case "type":     return d.type.length > 0;
      case "size":     return d.size.length > 0;
      case "city":     return d.city.trim().length > 1;
      case "kosher":   return true; // optional
      case "whatsapp": return isValidIsraeliPhone(d.whatsapp);
      case "photo":    return true; // optional — skip = no photo
      case "review":   return true;
      default:         return false;
    }
  })();

  const save = async () => {
    if (saving) return;
    setSaving(true); setErr("");

    const payload = {
      owner_id:             user.id,
      name:                 d.name,
      type:                 d.type,
      city:                 d.city,
      area:                 d.area || "",
      description:          `${d.name} — ${d.type} ב${d.city}`,
      image_url:            d.imageUrl || null,          // null = no photo (skipped)
      phone:                d.whatsapp,
      recruitment_whatsapp: d.whatsapp,
      contact_name:         user.user_metadata?.name || user.email,
      // kosher + size stored in the JSONB attributes column (same as SettingsTab)
      attributes: {
        kosher: d.kosher || null,
        size:   d.size   || null,
      },
      // Positions / shifts / benefits start empty — user configures via Jobs tab
      position_types:    [],
      position_salaries: {},
      position_counts:   {},
      position_open:     {},
      open_positions:    0,
      shifts:            [],
      benefits:          [],
      active:            true,
    };

    const { data: saved, error } = await supabase
      .from("restaurants")
      .upsert(payload, { onConflict: "owner_id" })
      .select()
      .single();

    if (error) {
      const friendly =
        error.code === "23505" || /unique|duplicate/i.test(error.message || "")
          ? "מסעדה בשם הזה בעיר הזו כבר רשומה. נסה/י שם אחר או פנה/י לתמיכה."
          : (error.message || "שגיאה בשמירה");
      setErr(friendly);
      setSaving(false);
      return;
    }

    clearDraft();

    logEvent("restaurant", "published", {
      user_id: user.id, restaurant_name: d.name,
      type: d.type, city: d.city,
    });

    setStep(STEPS.length); // beyond review → triggers loading screen
    setTimeout(() => onDone?.(saved), 1500);
  };

  // ── Loading transition (after save) ──────────────────────────────────────
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
            <div className="h-full bg-gray-900 rounded-full"
              style={{ width: "100%", animation: "fillBar 1.4s ease-out" }} />
          </div>
        </div>
        <style>{`@keyframes fillBar { from { width: 0% } to { width: 100% } }`}</style>
      </Frame>
    );
  }

  // ── Step UIs ──────────────────────────────────────────────────────────────
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
            <Chips
              options={SIZE_OPTIONS.map((o) => o.label)}
              value={SIZE_OPTIONS.find((o) => o.key === d.size)?.label || ""}
              onChange={(label) =>
                set({ size: SIZE_OPTIONS.find((o) => o.label === label)?.key })
              }
            />
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

        {stepId === "kosher" && (
          <Step title="מה סטטוס הכשרות?" sub="עוזר למועמדים להבין את אופי המקום.">
            <Chips
              options={KOSHER_OPTIONS.map((o) => o.label)}
              value={KOSHER_OPTIONS.find((o) => o.key === d.kosher)?.label || ""}
              onChange={(label) =>
                set({ kosher: KOSHER_OPTIONS.find((o) => o.label === label)?.key || null })
              }
            />
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
              <p className="text-amber-600 text-xs mt-2">
                המספר חייב להתחיל ב-05 ולכלול 10 ספרות בסך הכל
              </p>
            )}
          </Step>
        )}

        {stepId === "photo" && (
          <PhotoStep
            name={d.name}
            city={d.city}
            type={d.type}
            value={d.imageUrl}
            onChange={(url) => set({ imageUrl: url })}
          />
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
          {stepId === "review"
            ? "פרסום המודעה 🚀"
            : stepId === "photo" && d.imageUrl
              ? "אשר תמונה והמשך"
              : "המשך"}
        </button>

        {/* Optional steps — skip links */}
        {(stepId === "kosher" || stepId === "photo") && (
          <button onClick={() => { if (stepId === "photo") set({ imageUrl: null }); next(); }}
            className="w-full text-gray-400 text-xs font-semibold py-3 underline">
            {stepId === "photo" ? "המשך ללא תמונה" : "דלג/י על שלב זה"}
          </button>
        )}
      </div>
    </Frame>
  );
}

// ── Photo step — searches Google Places / falls back to Unsplash ──────────────
function PhotoStep({ name, city, type, value, onChange }) {
  const [photos,  setPhotos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [source,  setSource]  = useState(null);

  useEffect(() => {
    if (!name) return;
    setLoading(true);
    setPhotos([]);

    const params = new URLSearchParams({
      name: name || "",
      city: city || "",
      type: type || "",
    });

    fetch(`/api/restaurant-photos?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPhotos(data.photos || []);
        setSource(data.source || null);
      })
      .catch(() => {
        setPhotos([]);
      })
      .finally(() => setLoading(false));
  }, [name, city, type]);

  const subtitle = source === "google_places"
    ? `תמונות אמיתיות של ${name} ממפות גוגל`
    : `תמונות לפי סוג המסעדה`;

  if (loading) {
    return (
      <Step title="מחפשים תמונה..." sub={`מחפשים תמונות של ${name}...`}>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={32} className="animate-spin text-gray-400" />
          <p className="text-gray-400 text-sm">זה לוקח כמה שניות</p>
        </div>
      </Step>
    );
  }

  if (!photos.length) {
    return (
      <Step title="תמונה למסעדה" sub="לא נמצאו תמונות. ניתן להוסיף מאוחר יותר דרך ההגדרות.">
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-10 flex flex-col items-center gap-3">
          <ImageOff size={32} className="text-gray-300" />
          <p className="text-gray-400 text-sm text-center">לא נמצאו תמונות עבור {name}</p>
        </div>
      </Step>
    );
  }

  return (
    <Step title="בחר/י תמונה" sub={subtitle}>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((url, i) => {
          const selected = value === url;
          return (
            <button
              key={i}
              onClick={() => onChange(selected ? null : url)}
              className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-200 ${
                selected
                  ? "border-gray-900 shadow-lg"
                  : "border-transparent active:scale-[0.97]"
              }`}
              style={{ aspectRatio: "1 / 1" }}
            >
              <img
                src={url}
                alt={`תמונה ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Checkmark overlay when selected */}
              {selected && (
                <div className="absolute inset-0 bg-gray-900/25 flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-gray-900 border-2 border-white flex items-center justify-center shadow-lg">
                    <Check size={18} className="text-white" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {value && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-2xl p-3 flex items-center gap-2">
          <img src={value} alt="נבחרה" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
          <p className="text-gray-700 text-xs font-semibold flex-1">תמונה נבחרה ✓</p>
          <button onClick={() => onChange(null)}
            className="text-gray-400 text-xs underline active:text-gray-700">
            בטל
          </button>
        </div>
      )}
    </Step>
  );
}

// ── Type step with free-text "Other" support ──────────────────────────────────
function TypeStep({ value, onChange }) {
  const PRESETS = TYPES.slice(0, -1); // everything except "אחר"
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

// ── Presentational components ─────────────────────────────────────────────────

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

// Chips: single-select with light pill style.
function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o;
        return (
          <button key={o} onClick={() => onChange(o)}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-all border ${
              on
                ? "bg-gray-900 text-white border-gray-900 shadow-md"
                : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
            }`}>
            {o}{on && <Check size={12} className="inline mr-1.5" />}
          </button>
        );
      })}
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

  const kosherLabel = KOSHER_OPTIONS.find((o) => o.key === d.kosher)?.label;
  const sizeLabel   = SIZE_OPTIONS.find((o) => o.key === d.size)?.label;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
      {/* Photo preview at top of review card */}
      {d.imageUrl && (
        <div className="w-full h-36 relative">
          <img src={d.imageUrl} alt="תמונת המסעדה" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 to-transparent" />
          <p className="absolute bottom-2 right-3 text-white text-xs font-semibold drop-shadow">
            {d.name}
          </p>
        </div>
      )}
      <div className="px-4 py-2">
        <Row label="שם"      value={d.name} />
        <Row label="סוג"     value={d.type} />
        <Row label="עיר"     value={d.city + (d.area ? ` · ${d.area}` : "")} />
        <Row label="גודל"    value={sizeLabel} />
        <Row label="כשרות"   value={kosherLabel} />
        <Row label="תמונה"   value={d.imageUrl ? "✓ נבחרה" : "ללא תמונה"} />
        <Row label="וואטסאפ" value={d.whatsapp} />
      </div>
    </div>
  );
}
