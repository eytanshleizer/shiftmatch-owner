import { useState, useEffect, useRef } from "react";
import {
  Settings, Store, MapPin, Phone, MessageCircle, Image as ImageIcon,
  Clock, Gift, ListChecks, FileText, Check, Loader2, LogOut, CreditCard, X, Users, HelpCircle
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { normalizePhoneInput, isValidIsraeliPhone } from "../lib/phone";

const TYPES = [
  "מסעדת שף", "ים-תיכוני", "איטלקי", "אסייתי", "סושי", "מזון מהיר",
  "בשרייה", "פאב", "קפה", "ברסרי", "פיצה", "המבורגרים", "מזרחי", "ישראלי"
];

const SHIFTS = ["בוקר", "צהריים", "ערב", "לילה", "סופש"];

const BENEFITS = [
  "טיפים", "טיפים גבוהים", "ארוחת עובד", "נסיעות", "מונית הביתה",
  "חנייה", "בונוסים", "שעות גמישות", "ביגוד", "קידום פנימי", "הכשרה"
];

// Vibe / atmosphere tags used by the matching engine.
const VIBE_OPTIONS = [
  "יוקרתי", "משפחתי", "רומנטי", "עסקי", "ספורט-בר",
  "פאב", "בית קפה", "בוהמי", "מינימליסטי", "תוסס"
];

// Kosher options (single-select).
const KOSHER_OPTIONS = [
  { key: "rabbinate", label: "כשר (רבנות)" },
  { key: "badatz",    label: "כשר (בד\"ץ)" },
  { key: "non",       label: "לא כשר" },
  { key: "vegan",     label: "טבעוני" },
];

// Size (single-select).
const SIZE_OPTIONS = [
  { key: "xs", label: "עד 30 מקומות" },
  { key: "s",  label: "30–80" },
  { key: "m",  label: "80–150" },
  { key: "l",  label: "150+" },
];

// Soft attributes ("style of work" — multi-select preferences).
const SOFT_OPTIONS = [
  { key: "experienced",     label: "מעדיף ניסיון רב" },
  { key: "long_term",       label: "מעדיף עובד לטווח ארוך (6+ חודשים)" },
  { key: "beginners_ok",    label: "פתוח גם למתחילים" },
  { key: "hebrew_native",   label: "דורש עברית שפת אם" },
  { key: "english_required",label: "דורש אנגלית עסקית" },
  { key: "students_pref",   label: "מעדיף סטודנטים" },
  { key: "car_required",    label: "מעדיף עם רכב" },
];

export default function SettingsTab({ restaurant, onUpdate, onSignOut, onOpenPlans, onOpenTeam, onOpenQuestionnaire, role }) {
  // Local form state mirrors the DB row but allows un-saved edits.
  const [form, setForm] = useState({
    name:        restaurant?.name || "",
    type:        restaurant?.type || "",
    city:        restaurant?.city || "",
    area:        restaurant?.area || "",
    address:     restaurant?.address || "",
    description: restaurant?.description || "",
    image_url:   restaurant?.image_url || "",
    recruitment_whatsapp: restaurant?.recruitment_whatsapp || "",
    phone:       restaurant?.phone || "",
    contact_name: restaurant?.contact_name || "",
    shifts:      restaurant?.shifts || [],
    benefits:    restaurant?.benefits || [],
    requirements: restaurant?.requirements || [],
    attributes:  restaurant?.attributes || {},
    soft_attributes: restaurant?.soft_attributes || [],
  });

  // Refresh form when restaurant prop changes (after parent save).
  useEffect(() => {
    setForm({
      name:        restaurant?.name || "",
      type:        restaurant?.type || "",
      city:        restaurant?.city || "",
      area:        restaurant?.area || "",
      address:     restaurant?.address || "",
      description: restaurant?.description || "",
      image_url:   restaurant?.image_url || "",
      recruitment_whatsapp: restaurant?.recruitment_whatsapp || "",
      phone:       restaurant?.phone || "",
      contact_name: restaurant?.contact_name || "",
      shifts:      restaurant?.shifts || [],
      benefits:    restaurant?.benefits || [],
      requirements: restaurant?.requirements || [],
      attributes:  restaurant?.attributes || {},
      soft_attributes: restaurant?.soft_attributes || [],
    });
  }, [restaurant?.id]);

  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [newReq, setNewReq] = useState("");
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Has anything actually changed?  Compares form values to restaurant snapshot.
  const dirty =
    form.name !== (restaurant?.name || "") ||
    form.type !== (restaurant?.type || "") ||
    form.city !== (restaurant?.city || "") ||
    form.area !== (restaurant?.area || "") ||
    form.address !== (restaurant?.address || "") ||
    form.description !== (restaurant?.description || "") ||
    form.image_url !== (restaurant?.image_url || "") ||
    form.recruitment_whatsapp !== (restaurant?.recruitment_whatsapp || "") ||
    form.phone !== (restaurant?.phone || "") ||
    form.contact_name !== (restaurant?.contact_name || "") ||
    JSON.stringify(form.shifts) !== JSON.stringify(restaurant?.shifts || []) ||
    JSON.stringify(form.benefits) !== JSON.stringify(restaurant?.benefits || []) ||
    JSON.stringify(form.requirements) !== JSON.stringify(restaurant?.requirements || []) ||
    JSON.stringify(form.attributes) !== JSON.stringify(restaurant?.attributes || {}) ||
    JSON.stringify(form.soft_attributes) !== JSON.stringify(restaurant?.soft_attributes || []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const toggle = (key, val) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
    }));
  };

  const addRequirement = () => {
    const v = newReq.trim();
    if (!v) return;
    set({ requirements: [...form.requirements, v] });
    setNewReq("");
  };

  const removeRequirement = (i) => {
    set({ requirements: form.requirements.filter((_, idx) => idx !== i) });
  };

  const save = async () => {
    if (!dirty) return;
    setSaving(true); setSaveError("");
    const { data, error } = await supabase
      .from("restaurants")
      .update(form)
      .eq("id", restaurant.id)
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      onUpdate?.(data);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } else if (error) {
      // Show inline error instead of native alert (works better on mobile)
      setSaveError(error.message || "שגיאה בשמירה — נסה/י שוב");
      setTimeout(() => setSaveError(""), 5000);
    }
  };

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-black text-xl flex items-center gap-2">
            <Settings size={20} className="text-brand-400" />
            הגדרות
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">עריכת פרטי המסעדה</p>
        </div>
        {dirty && !saving && !savedFlash && (
          <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-full">
            לא נשמר
          </span>
        )}
      </div>

      <div className="px-4 space-y-4">

        {/* ── Cover image preview ── */}
        <div className="relative h-44 rounded-2xl overflow-hidden bg-[#161616] border border-white/5">
          {form.image_url ? (
            <img src={form.image_url} alt={form.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = "none"; }} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600">
              <ImageIcon size={40} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-3 right-3 left-3">
            <p className="text-white text-xl font-black drop-shadow">{form.name || "שם המסעדה"}</p>
            <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
              <MapPin size={11} />
              {form.city}{form.area ? ` · ${form.area}` : ""}{form.type ? ` · ${form.type}` : ""}
            </p>
          </div>
        </div>

        {/* ── Basic Info ── */}
        <Section icon={Store} title="פרטי מסעדה">
          <Field label="שם המסעדה">
            <input type="text" value={form.name} onChange={(e) => set({ name: e.target.value })}
              className={inputCls} placeholder="לדוגמה: מסה" />
          </Field>

          <Field label="סוג מטבח">
            <button onClick={() => setShowTypePicker(true)}
              className={`${inputCls} text-right flex items-center justify-between`}>
              <span className={form.type ? "text-white" : "text-gray-500"}>
                {form.type || "בחר סוג מטבח"}
              </span>
              <span className="text-gray-500">›</span>
            </button>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="עיר">
              <input type="text" value={form.city} onChange={(e) => set({ city: e.target.value })}
                className={inputCls} placeholder="תל אביב" />
            </Field>
            <Field label="שכונה / אזור">
              <input type="text" value={form.area} onChange={(e) => set({ area: e.target.value })}
                className={inputCls} placeholder="שרונה" />
            </Field>
          </div>

          <Field label="כתובת מלאה">
            <input type="text" value={form.address} onChange={(e) => set({ address: e.target.value })}
              className={inputCls} placeholder="הארבעה 19, תל אביב" />
          </Field>

          <Field label="קישור לתמונת כריכה">
            <input type="url" dir="ltr" value={form.image_url} onChange={(e) => set({ image_url: e.target.value })}
              className={`${inputCls} text-left`} placeholder="https://images.unsplash.com/..." />
          </Field>
        </Section>

        {/* ── Description ── */}
        <Section icon={FileText} title="תיאור המסעדה">
          <textarea value={form.description} onChange={(e) => set({ description: e.target.value })}
            rows={5}
            className={`${inputCls} resize-none leading-relaxed`}
            placeholder="ספר/י קצת על המסעדה — האווירה, התפריט, הקונספט..." />
          <p className="text-gray-500 text-[10px] mt-1.5">
            {form.description.length} תווים · מומלץ 100–300
          </p>
        </Section>

        {/* ── Contact ── */}
        <Section icon={Phone} title="פרטי קשר לגיוס">
          <Field label="שם איש קשר">
            <input type="text" value={form.contact_name} onChange={(e) => set({ contact_name: e.target.value })}
              className={inputCls} placeholder="מנהל משמרת" />
          </Field>

          <Field
            label="וואטסאפ לגיוס"
            hint={form.recruitment_whatsapp && !isValidIsraeliPhone(form.recruitment_whatsapp)
              ? "מספר חייב להיות בין 9 ל-10 ספרות"
              : "המספר שמופיע למלצרים — מומלץ ייעודי"}
          >
            <input
              type="tel" inputMode="numeric" dir="ltr"
              maxLength={10}
              value={form.recruitment_whatsapp}
              onChange={(e) => set({ recruitment_whatsapp: normalizePhoneInput(e.target.value) })}
              className={`${inputCls} text-left`} placeholder="0501234567"
            />
          </Field>

          <Field label="טלפון">
            <input
              type="tel" inputMode="numeric" dir="ltr"
              maxLength={10}
              value={form.phone}
              onChange={(e) => set({ phone: normalizePhoneInput(e.target.value) })}
              className={`${inputCls} text-left`} placeholder="0312345678"
            />
          </Field>
        </Section>

        {/* ── Shifts ── */}
        <Section icon={Clock} title="משמרות זמינות">
          <p className="text-gray-500 text-xs mb-3">בחר/י את כל המשמרות שבהן יש משרות</p>
          <div className="flex flex-wrap gap-2">
            {SHIFTS.map((s) => {
              const on = form.shifts.includes(s);
              return (
                <button key={s} onClick={() => toggle("shifts", s)}
                  className={chipCls(on)}>{s}{on && <Check size={12} className="mr-1" />}</button>
              );
            })}
          </div>
        </Section>

        {/* ── Benefits ── */}
        <Section icon={Gift} title="הטבות לעובד">
          <p className="text-gray-500 text-xs mb-3">מה המסעדה מציעה לעובדים</p>
          <div className="flex flex-wrap gap-2">
            {BENEFITS.map((b) => {
              const on = form.benefits.includes(b);
              return (
                <button key={b} onClick={() => toggle("benefits", b)}
                  className={chipCls(on)}>{b}{on && <Check size={12} className="mr-1" />}</button>
              );
            })}
          </div>
        </Section>

        {/* ── Attributes (vibe / kosher / size) ── */}
        <Section icon={Store} title="מאפייני המסעדה">
          <p className="text-gray-500 text-[11px] mb-3">משמש לשיוך מועמדים מתאימים יותר</p>

          {/* Vibe — multiselect */}
          <Field label="אווירה">
            <div className="flex flex-wrap gap-2">
              {VIBE_OPTIONS.map((v) => {
                const arr = form.attributes.vibe || [];
                const on = arr.includes(v);
                return (
                  <button key={v} onClick={() => {
                    const next = on ? arr.filter((x) => x !== v) : [...arr, v];
                    set({ attributes: { ...form.attributes, vibe: next } });
                  }} className={chipCls(on)}>{v}{on && <Check size={12} className="mr-1" />}</button>
                );
              })}
            </div>
          </Field>

          {/* Kosher — single select */}
          <Field label="כשרות">
            <div className="grid grid-cols-2 gap-2">
              {KOSHER_OPTIONS.map((k) => {
                const on = form.attributes.kosher === k.key;
                return (
                  <button key={k.key} onClick={() =>
                    set({ attributes: { ...form.attributes, kosher: on ? null : k.key } })
                  }
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                      on
                        ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                        : "bg-white/5 text-gray-400 border border-white/10"
                    }`}>{k.label}</button>
                );
              })}
            </div>
          </Field>

          {/* Size — single select */}
          <Field label="גודל המסעדה">
            <div className="grid grid-cols-2 gap-2">
              {SIZE_OPTIONS.map((s) => {
                const on = form.attributes.size === s.key;
                return (
                  <button key={s.key} onClick={() =>
                    set({ attributes: { ...form.attributes, size: on ? null : s.key } })
                  }
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                      on
                        ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                        : "bg-white/5 text-gray-400 border border-white/10"
                    }`}>{s.label}</button>
                );
              })}
            </div>
          </Field>
        </Section>

        {/* ── Soft attributes — work-style preferences ── */}
        <Section icon={ListChecks} title="סגנון עבודה מועדף">
          <p className="text-gray-500 text-[11px] mb-3">מעלה מועמדים תואמים יותר בחיפושים</p>
          <div className="space-y-2">
            {SOFT_OPTIONS.map((s) => {
              const on = form.soft_attributes.includes(s.key);
              return (
                <button key={s.key} onClick={() => toggle("soft_attributes", s.key)}
                  className={`w-full p-3 rounded-xl border text-right flex items-center justify-between transition-all ${
                    on
                      ? "bg-brand-500/15 border-brand-500/40"
                      : "bg-white/5 border-white/10"
                  }`}>
                  <span className={`text-sm font-semibold ${on ? "text-white" : "text-gray-400"}`}>{s.label}</span>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                    on ? "bg-brand-500" : "border border-white/20"
                  }`}>
                    {on && <Check size={12} className="text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Requirements ── */}
        <Section icon={ListChecks} title="דרישות מהמועמדים">
          <p className="text-gray-500 text-xs mb-3">דרישות חופשיות — כל שורה זו דרישה אחת</p>
          <div className="space-y-2 mb-3">
            {form.requirements.map((req, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <span className="flex-1 text-white text-sm">{req}</span>
                <button onClick={() => removeRequirement(i)}
                  className="w-6 h-6 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center active:bg-red-500/20">
                  <X size={12} />
                </button>
              </div>
            ))}
            {form.requirements.length === 0 && (
              <p className="text-gray-600 text-xs text-center py-3">אין דרישות עדיין</p>
            )}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newReq}
              onChange={(e) => setNewReq(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRequirement()}
              className={`${inputCls} flex-1`}
              placeholder="לדוגמה: ניסיון של שנה לפחות" />
            <button onClick={addRequirement} disabled={!newReq.trim()}
              className="bg-brand-500 text-white font-bold px-4 rounded-xl text-sm active:bg-brand-600 disabled:opacity-40">
              הוסף
            </button>
          </div>
        </Section>

        {/* ── Actions ── */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {onOpenTeam && (
            <button onClick={onOpenTeam}
              className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-white/5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                <Users size={16} />
              </div>
              <span className="flex-1 text-right text-white font-bold text-sm">ניהול צוות</span>
              <span className="text-gray-600">›</span>
            </button>
          )}
          {onOpenQuestionnaire && (
            <button onClick={onOpenQuestionnaire}
              className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-white/5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <HelpCircle size={16} />
              </div>
              <span className="flex-1 text-right text-white font-bold text-sm">
                שאלון סינון
                {restaurant?.screening_questions?.length > 0 && (
                  <span className="text-gray-500 text-[10px] font-normal mr-1">· {restaurant.screening_questions.length} שאלות</span>
                )}
              </span>
              <span className="text-gray-600">›</span>
            </button>
          )}
          {onOpenPlans && (
            <button onClick={onOpenPlans}
              className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-white/5">
              <div className="w-9 h-9 rounded-xl bg-brand-500/15 text-brand-400 flex items-center justify-center">
                <CreditCard size={16} />
              </div>
              <span className="flex-1 text-right text-white font-bold text-sm">תוכניות ומחירים</span>
              <span className="text-gray-600">›</span>
            </button>
          )}
          <button onClick={onSignOut}
            className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-white/5">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center">
              <LogOut size={16} />
            </div>
            <span className="flex-1 text-right text-red-400 font-bold text-sm">התנתקות</span>
          </button>
        </div>
      </div>

      {/* ── Sticky save bar + inline error ── */}
      <div className="fixed bottom-[68px] right-0 left-0 px-4 pointer-events-none z-40 space-y-2">
        {saveError && (
          <div className="pointer-events-auto bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-semibold rounded-2xl px-4 py-3 text-center shadow-xl shadow-red-500/20 backdrop-blur">
            ⚠ {saveError}
          </div>
        )}
        <div className={`pointer-events-auto transition-all duration-300 ${
          dirty || savedFlash ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}>
          <button onClick={save} disabled={saving || !dirty}
            className={`w-full font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-2xl ${
              savedFlash
                ? "bg-green-500 text-white shadow-green-500/40"
                : "bg-brand-500 text-white active:bg-brand-600 shadow-brand-500/40"
            }`}>
            {saving ? (
              <><Loader2 size={18} className="animate-spin" />שומר...</>
            ) : savedFlash ? (
              <><Check size={18} />נשמר!</>
            ) : (
              <>שמור שינויים</>
            )}
          </button>
        </div>
      </div>

      {/* ── Type picker modal ── */}
      {showTypePicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-end justify-center"
          onClick={() => setShowTypePicker(false)}>
          <div className="bg-[#161616] border-t border-white/10 rounded-t-3xl w-full max-w-md p-6 pb-8 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black text-lg">בחר סוג מטבח</h3>
              <button onClick={() => setShowTypePicker(false)}
                className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button key={t}
                  onClick={() => { set({ type: t }); setShowTypePicker(false); }}
                  className={`py-3 rounded-xl text-sm font-bold transition-all ${
                    form.type === t
                      ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                      : "bg-white/5 text-gray-300 border border-white/10 active:bg-white/10"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Local presentational helpers ───────────────────────────────────

const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none focus:border-brand-500 placeholder:text-gray-600";

const chipCls = (on) =>
  `inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
    on
      ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
      : "bg-white/5 text-gray-400 border border-white/10"
  }`;

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} className="text-brand-400" />
        <h3 className="text-white font-bold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-gray-500 text-[11px] font-bold uppercase tracking-wide block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-gray-600 text-[10px] mt-1">{hint}</p>}
    </div>
  );
}
