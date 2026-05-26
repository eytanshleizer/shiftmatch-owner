import { useState, useEffect } from "react";
import {
  ArrowRight, Plus, X, GripVertical, ListChecks, ChevronUp, ChevronDown,
  Type, ToggleLeft, Hash, ListFilter, Loader2, Sparkles, Check
} from "lucide-react";
import { supabase } from "../lib/supabase";

// ── Built-in question library ────────────────────────────────────
// Curated set of common screening questions per position type.
// Each can be added with one tap; owners can also create custom ones.
const QUESTION_LIBRARY = [
  // Generic
  { library_key: "experience_years",  type: "select",
    label: "כמה שנות ניסיון יש לך בתפקיד?",
    options: ["0", "1–2", "3–5", "5+"], applies_to: "any" },
  { library_key: "available_weekends", type: "boolean",
    label: "זמין/ה לעבוד בסופי שבוע?", applies_to: "any" },
  { library_key: "available_nights",   type: "boolean",
    label: "זמין/ה לעבוד במשמרות לילה?", applies_to: "any" },
  { library_key: "shifts_per_week",    type: "select",
    label: "כמה משמרות בשבוע את/ה זמין/ה?",
    options: ["1–2", "3–4", "5+"], applies_to: "any" },
  { library_key: "health_card",        type: "boolean",
    label: "יש לך תעודת בריאות בתוקף?", applies_to: "any" },
  { library_key: "hebrew_level",       type: "select",
    label: "רמת עברית",
    options: ["שפת אם", "שוטף", "טוב", "בסיסי"], applies_to: "any" },
  { library_key: "english_level",      type: "select",
    label: "רמת אנגלית",
    options: ["שפת אם", "שוטף", "טוב", "בסיסי", "אין"], applies_to: "any" },
  { library_key: "has_car",            type: "boolean",
    label: "יש לך רכב?", applies_to: "any" },
  // Waiter-specific
  { library_key: "pos_systems",        type: "multiselect",
    label: "אילו מערכות POS את/ה מכיר/ה?",
    options: ["Tabit", "Restigo", "Bynet", "אחר"], applies_to: "waiter" },
  { library_key: "fine_dining_exp",    type: "boolean",
    label: "ניסיון במסעדת שף או יוקרה?", applies_to: "waiter" },
  // Bartender-specific
  { library_key: "bar_course",         type: "boolean",
    label: "יש לך קורס ברמנים?", applies_to: "bartender" },
  { library_key: "cocktail_knowledge", type: "boolean",
    label: "יודע/ת להכין קוקטיילים קלאסיים?", applies_to: "bartender" },
];

const TYPE_META = {
  text:        { label: "טקסט חופשי",  icon: Type },
  select:      { label: "בחירה יחידה", icon: ListFilter },
  multiselect: { label: "בחירה מרובה", icon: ListChecks },
  boolean:     { label: "כן / לא",       icon: ToggleLeft },
  number:      { label: "מספר",           icon: Hash },
};

export default function QuestionnaireEditor({ restaurant, onBack, onSaved }) {
  const [questions, setQuestions] = useState(() => restaurant?.screening_questions || []);
  const [saving, setSaving] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);

  const dirty = JSON.stringify(questions) !== JSON.stringify(restaurant?.screening_questions || []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("restaurants")
      .update({ screening_questions: questions })
      .eq("id", restaurant.id);
    setSaving(false);
    if (!error) { onSaved?.(questions); onBack(); }
  };

  const move = (idx, dir) => {
    const next = [...questions];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setQuestions(next);
  };

  const remove = (idx) => setQuestions((qs) => qs.filter((_, i) => i !== idx));

  const toggleRequired = (idx) =>
    setQuestions((qs) => qs.map((q, i) => i === idx ? { ...q, required: !q.required } : q));

  const addFromLibrary = (q) => {
    const used = questions.some((x) => x.library_key === q.library_key);
    if (used) return;
    setQuestions((qs) => [...qs, {
      id: crypto.randomUUID(),
      ...q,
      required: false,
      source: "library",
    }]);
  };

  const addCustom = (q) => {
    setQuestions((qs) => [...qs, { id: crypto.randomUUID(), ...q, source: "custom" }]);
  };

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-14 pb-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={onBack}
          className="w-9 h-9 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center active:bg-white/10">
          <ArrowRight size={16} className="text-gray-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-white font-black text-lg flex items-center gap-2">
            <ListChecks size={18} className="text-brand-400" />שאלון סינון
          </h2>
          <p className="text-gray-500 text-[11px] mt-0.5">{questions.length} שאלות</p>
        </div>
        {dirty && (
          <button onClick={save} disabled={saving}
            className="bg-brand-500 text-white text-xs font-bold px-4 py-2 rounded-xl active:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-brand-500/30">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            שמור
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-32">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setShowLibrary(true)}
            className="bg-gradient-to-br from-brand-500/15 to-purple-500/10 border border-brand-500/30 rounded-2xl p-3.5 text-right active:opacity-80">
            <Sparkles size={16} className="text-brand-400 mb-1.5" />
            <p className="text-white font-bold text-sm">מהמאגר</p>
            <p className="text-gray-500 text-[10px] mt-0.5">שאלות מוכנות</p>
          </button>
          <button onClick={() => setShowAdd(true)}
            className="bg-[#161616] border border-white/10 rounded-2xl p-3.5 text-right active:bg-white/5">
            <Plus size={16} className="text-gray-400 mb-1.5" />
            <p className="text-white font-bold text-sm">שאלה משלי</p>
            <p className="text-gray-500 text-[10px] mt-0.5">בנייה מותאמת</p>
          </button>
        </div>

        {/* Questions list */}
        {questions.length === 0 ? (
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-8 text-center mt-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-3xl mx-auto mb-3">📝</div>
            <p className="text-white font-bold text-sm">אין שאלות עדיין</p>
            <p className="text-gray-500 text-xs mt-1">הוסף שאלות כדי לסנן מועמדים אוטומטית</p>
          </div>
        ) : (
          <div className="space-y-2 mt-1">
            {questions.map((q, idx) => {
              const meta = TYPE_META[q.type] || TYPE_META.text;
              const Icon = meta.icon;
              return (
                <div key={q.id} className="bg-[#161616] border border-white/5 rounded-2xl p-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex flex-col gap-1 pt-1 flex-shrink-0">
                      <button onClick={() => move(idx, -1)} disabled={idx === 0}
                        className="w-6 h-6 rounded-lg bg-white/5 text-gray-400 flex items-center justify-center disabled:opacity-30">
                        <ChevronUp size={12} />
                      </button>
                      <button onClick={() => move(idx, 1)} disabled={idx === questions.length - 1}
                        className="w-6 h-6 rounded-lg bg-white/5 text-gray-400 flex items-center justify-center disabled:opacity-30">
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon size={11} className="text-brand-400" />
                        <span className="text-brand-400 text-[10px] font-bold uppercase tracking-wide">{meta.label}</span>
                        {q.required && <span className="text-amber-400 text-[10px] font-bold">חובה</span>}
                      </div>
                      <p className="text-white text-sm font-semibold leading-snug">{q.label}</p>
                      {(q.type === "select" || q.type === "multiselect") && q.options && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {q.options.map((o) => (
                            <span key={o} className="bg-white/5 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{o}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => toggleRequired(idx)}
                        className={`w-7 h-7 rounded-lg text-[9px] font-bold flex items-center justify-center ${
                          q.required
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-white/5 text-gray-500"
                        }`}>
                        חובה
                      </button>
                      <button onClick={() => remove(idx)}
                        className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center active:bg-red-500/20">
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Library modal */}
      {showLibrary && (
        <LibraryModal
          existing={questions}
          onAdd={addFromLibrary}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {/* Custom question modal */}
      {showAdd && (
        <CustomQuestionModal
          onAdd={(q) => { addCustom(q); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

// ── Library modal ──
function LibraryModal({ existing, onAdd, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-[#161616] border-t border-white/10 rounded-t-3xl w-full max-w-md p-5 pb-8 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-black text-lg flex items-center gap-2">
            <Sparkles size={16} className="text-brand-400" />ספריית שאלות
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
            <X size={14} />
          </button>
        </div>
        <p className="text-gray-500 text-xs mb-3">לחץ/י על שאלה כדי להוסיף לשאלון</p>
        <div className="space-y-2">
          {QUESTION_LIBRARY.map((q) => {
            const used = existing.some((x) => x.library_key === q.library_key);
            return (
              <button key={q.library_key} onClick={() => !used && onAdd(q)} disabled={used}
                className={`w-full text-right p-3 rounded-xl border transition-all ${
                  used
                    ? "bg-white/[0.02] border-white/5 opacity-50"
                    : "bg-white/5 border-white/10 active:bg-white/10"
                }`}>
                <p className="text-white text-sm font-semibold">{q.label}</p>
                <p className="text-gray-500 text-[10px] mt-1 flex items-center gap-1.5">
                  <span>{TYPE_META[q.type]?.label}</span>
                  {used && <span className="text-brand-400 mr-auto">· כבר נוספה</span>}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Custom question modal ──
function CustomQuestionModal({ onAdd, onClose }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [opts, setOpts] = useState("");
  const [required, setRequired] = useState(false);

  const submit = () => {
    if (!label.trim()) return;
    const q = { type, label: label.trim(), required };
    if (type === "select" || type === "multiselect") {
      q.options = opts.split(",").map((s) => s.trim()).filter(Boolean);
      if (!q.options.length) return;
    }
    onAdd(q);
  };

  const needsOpts = type === "select" || type === "multiselect";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-[#161616] border-t border-white/10 rounded-t-3xl w-full max-w-md p-5 pb-8"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-black text-lg">שאלה מותאמת</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
            <X size={14} />
          </button>
        </div>

        <label className="text-gray-500 text-[11px] font-bold uppercase tracking-wide block mb-1.5">השאלה</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="לדוגמה: יש לך ניסיון עם תנור עצים?"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-brand-500 mb-4" />

        <label className="text-gray-500 text-[11px] font-bold uppercase tracking-wide block mb-1.5">סוג תשובה</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {Object.entries(TYPE_META).map(([k, m]) => {
            const Icon = m.icon;
            const on = type === k;
            return (
              <button key={k} onClick={() => setType(k)}
                className={`p-3 rounded-xl border flex items-center gap-2 text-right ${
                  on ? "bg-brand-500/15 border-brand-500/40" : "bg-white/5 border-white/10"
                }`}>
                <Icon size={14} className={on ? "text-brand-400" : "text-gray-500"} />
                <span className={`text-xs font-bold ${on ? "text-white" : "text-gray-400"}`}>{m.label}</span>
              </button>
            );
          })}
        </div>

        {needsOpts && (
          <>
            <label className="text-gray-500 text-[11px] font-bold uppercase tracking-wide block mb-1.5">
              אפשרויות (מופרדות בפסיק)
            </label>
            <input value={opts} onChange={(e) => setOpts(e.target.value)}
              placeholder="אפשרות 1, אפשרות 2, אפשרות 3"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-brand-500 mb-4" />
          </>
        )}

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)}
            className="w-4 h-4 accent-brand-500" />
          <span className="text-white text-sm">שדה חובה</span>
        </label>

        <button onClick={submit} disabled={!label.trim() || (needsOpts && !opts.trim())}
          className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl active:bg-brand-600 disabled:opacity-50">
          הוסף לשאלון
        </button>
      </div>
    </div>
  );
}
