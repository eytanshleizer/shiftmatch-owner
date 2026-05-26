import { useState, useEffect } from "react";
import {
  Calendar, Plus, Clock, MapPin, Phone, X, Check, Loader2, ChevronLeft, ChevronRight, MoreVertical
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { can } from "../lib/permissions";
import { normalizePhoneInput, isValidIsraeliPhone } from "../lib/phone";

// ─────────────────────────────────────────────────────────────────────────────
// CalendarTab — interview scheduler.
// White card layout, month strip at top, agenda below.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META = {
  scheduled: { label: "מתוכנן",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  done:      { label: "בוצע",    cls: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "בוטל",    cls: "bg-gray-100 text-gray-500 border-gray-200" },
  no_show:   { label: "לא הגיע", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function CalendarTab({ restaurant, user, role = "owner" }) {
  const canSchedule = can(role, "contact_candidates"); // recruiter+ can schedule
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [actionFor, setActionFor] = useState(null);

  const load = async () => {
    if (!restaurant?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("interviews")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("scheduled_at", { ascending: true });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant?.id]);

  // Group by day-bucket
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups = items.reduce((acc, it) => {
    const dt = new Date(it.scheduled_at);
    const dayKey = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
    if (!acc[dayKey]) acc[dayKey] = { date: dt, items: [] };
    acc[dayKey].items.push(it);
    return acc;
  }, {});
  const sortedDays = Object.values(groups).sort((a, b) => a.date - b.date);

  const upcomingCount = items.filter((it) => new Date(it.scheduled_at) >= now && it.status === "scheduled").length;

  const setStatus = async (id, status) => {
    await supabase.from("interviews").update({ status }).eq("id", id);
    load(); setActionFor(null);
  };

  const remove = async (id) => {
    if (!confirm("למחוק את הראיון?")) return;
    await supabase.from("interviews").delete().eq("id", id);
    load(); setActionFor(null);
  };

  return (
    <div className="pb-24 bg-white min-h-full text-gray-900">
      {/* Header */}
      <div className="px-5 pt-20 pb-3 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">ראיונות</h1>
          <p className="text-gray-500 text-sm mt-1">
            {upcomingCount > 0 ? `${upcomingCount} ראיונות קרובים` : "אין ראיונות מתוכננים"}
          </p>
        </div>
        {canSchedule && (
          <button onClick={() => setShowAdd(true)}
            className="bg-gray-900 text-white font-bold text-sm px-4 py-2.5 rounded-full active:bg-gray-800 flex items-center gap-1.5 shadow-md shadow-gray-900/10">
            <Plus size={14} />ראיון חדש
          </button>
        )}
      </div>

      <div className="px-4 pt-3">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin text-gray-400" /></div>
        ) : sortedDays.length === 0 ? (
          <EmptyState canSchedule={canSchedule} onAdd={() => setShowAdd(true)} />
        ) : (
          <div className="space-y-6 mt-2">
            {sortedDays.map((g) => (
              <DayGroup key={g.date.toISOString()} date={g.date} today={today} items={g.items}
                onAction={(it) => canSchedule && setActionFor(it)} />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <ScheduleModal
          restaurant={restaurant} user={user}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}

      {actionFor && (
        <ActionSheet
          interview={actionFor}
          onClose={() => setActionFor(null)}
          onStatus={(s) => setStatus(actionFor.id, s)}
          onDelete={() => remove(actionFor.id)}
        />
      )}
    </div>
  );
}

// ── Day group card ──
function DayGroup({ date, today, items }) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const isToday = dayStart === today;
  const isPast  = dayStart < today;
  const heb = date.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5 px-1">
        <p className={`text-sm font-bold ${isToday ? "text-gray-900" : isPast ? "text-gray-400" : "text-gray-700"}`}>
          {isToday ? "היום · " : ""}{heb}
        </p>
        {isToday && <span className="text-[10px] font-bold text-white bg-gray-900 px-2 py-0.5 rounded-full">היום</span>}
      </div>
      <div className="space-y-2">
        {items.map((it) => <InterviewCard key={it.id} it={it} />)}
      </div>
    </div>
  );
}

function InterviewCard({ it, onAction }) {
  const dt = new Date(it.scheduled_at);
  const time = dt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const sMeta = STATUS_META[it.status] || STATUS_META.scheduled;
  const wa = it.candidate_phone
    ? `https://wa.me/972${it.candidate_phone.replace(/\D/g,"").replace(/^0/,"")}?text=${encodeURIComponent(`היי ${it.candidate_name || ""}, מזכיר לך את הראיון אצלנו בשעה ${time} 🙂`)}`
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Time pill */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-center min-w-[60px] flex-shrink-0">
          <p className="text-gray-900 font-black text-base leading-none">{time}</p>
          <p className="text-gray-500 text-[10px] mt-0.5">{it.duration_min || 30} ד׳</p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-gray-900 font-bold text-sm truncate">
              {it.candidate_name || "מועמד/ת"}
            </p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${sMeta.cls}`}>
              {sMeta.label}
            </span>
          </div>
          {it.location && (
            <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
              <MapPin size={11} />{it.location}
            </p>
          )}
          {it.notes && (
            <p className="text-gray-600 text-xs mt-1.5 line-clamp-2">{it.notes}</p>
          )}
          <div className="flex items-center gap-2 mt-2.5">
            {it.candidate_phone && (
              <>
                <a href={`tel:${it.candidate_phone}`} className="text-gray-700 text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1 rounded-full active:bg-gray-100 flex items-center gap-1">
                  <Phone size={11} />{it.candidate_phone}
                </a>
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer"
                    className="text-green-700 text-xs font-bold bg-green-50 border border-green-200 px-3 py-1 rounded-full active:bg-green-100">
                    💬 WhatsApp
                  </a>
                )}
              </>
            )}
            {onAction && (
              <button onClick={onAction} className="mr-auto w-8 h-8 rounded-full bg-gray-50 border border-gray-200 text-gray-500 flex items-center justify-center active:bg-gray-100">
                <MoreVertical size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ canSchedule, onAdd }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-3xl p-10 text-center mt-6">
      <div className="w-16 h-16 mx-auto rounded-3xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
        <Calendar size={26} className="text-gray-400" />
      </div>
      <p className="text-gray-900 font-bold text-base">אין ראיונות עדיין</p>
      <p className="text-gray-500 text-sm mt-1.5 leading-relaxed max-w-xs mx-auto">
        תזמן/י את הראיון הראשון שלך — אנחנו נשמור הכל מסודר במקום אחד.
      </p>
      {canSchedule && (
        <button onClick={onAdd}
          className="mt-5 bg-gray-900 text-white font-bold text-sm px-5 py-2.5 rounded-full active:bg-gray-800 inline-flex items-center gap-1.5">
          <Plus size={14} />קבע ראיון
        </button>
      )}
    </div>
  );
}

// ── Schedule new interview modal ──
function ScheduleModal({ restaurant, user, onClose, onSaved }) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate]   = useState("");
  const [time, setTime]   = useState("");
  const [dur,  setDur]    = useState(30);
  const [loc,  setLoc]    = useState("המסעדה");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Default to today 17:00 if empty
  useEffect(() => {
    if (!date) {
      const d = new Date();
      setDate(d.toISOString().slice(0, 10));
    }
    if (!time) setTime("17:00");
  }, []);

  const submit = async () => {
    setErr("");
    if (!name.trim())                    return setErr("חסר שם מועמד");
    if (phone && !isValidIsraeliPhone(phone)) return setErr("מספר טלפון לא תקין");
    if (!date || !time)                  return setErr("חסר תאריך/שעה");

    const scheduled_at = new Date(`${date}T${time}:00`).toISOString();

    setSaving(true);
    const { error } = await supabase.from("interviews").insert({
      restaurant_id: restaurant.id,
      candidate_name: name.trim(),
      candidate_phone: phone || null,
      scheduled_at,
      duration_min: dur,
      location: loc,
      notes: notes.trim() || null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-gray-900 font-black text-lg">קביעת ראיון</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200">
            <X size={16} />
          </button>
        </div>

        <FormField label="שם מועמד/ת">
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="שם מלא"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900" />
        </FormField>

        <FormField label="טלפון (אופציונלי)">
          <input value={phone} onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
            type="tel" inputMode="numeric" maxLength={10} dir="ltr"
            placeholder="0501234567"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900 text-left" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="תאריך">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900" />
          </FormField>
          <FormField label="שעה">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900" />
          </FormField>
        </div>

        <FormField label="משך">
          <div className="flex gap-2">
            {[15, 30, 45, 60].map((m) => (
              <button key={m} onClick={() => setDur(m)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors border ${
                  dur === m
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
                }`}>
                {m} ד׳
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="מיקום">
          <input value={loc} onChange={(e) => setLoc(e.target.value)}
            placeholder="המסעדה / וידאו / כתובת"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900" />
        </FormField>

        <FormField label="הערות">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="נושאים לדבר עליהם, התרשמות מהשיחה הראשונית..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900 resize-none" />
        </FormField>

        {err && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl px-4 py-2.5 text-center mb-3">
            {err}
          </div>
        )}

        <button onClick={submit} disabled={saving}
          className="w-full bg-gray-900 text-white font-bold py-4 rounded-full text-base active:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2 shadow-md shadow-gray-900/10">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          קביעת הראיון
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div className="mb-4">
      <label className="text-gray-600 text-[11px] font-bold uppercase tracking-wide block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ── Action sheet for an existing interview ──
function ActionSheet({ interview, onClose, onStatus, onDelete }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl p-4 pb-8 max-w-md mx-auto"
        onClick={(e) => e.stopPropagation()}>
        <p className="text-center text-gray-500 text-xs py-2 border-b border-gray-100">
          {interview.candidate_name || "ראיון"}
        </p>
        {interview.status !== "done" && (
          <button onClick={() => onStatus("done")}
            className="w-full py-3 text-green-700 font-bold text-right px-3 active:bg-green-50 flex items-center gap-2">
            <Check size={16} />סמן כבוצע
          </button>
        )}
        {interview.status !== "no_show" && (
          <button onClick={() => onStatus("no_show")}
            className="w-full py-3 text-amber-700 font-semibold text-right px-3 active:bg-amber-50">
            סמן "לא הגיע"
          </button>
        )}
        {interview.status !== "cancelled" && (
          <button onClick={() => onStatus("cancelled")}
            className="w-full py-3 text-gray-500 font-semibold text-right px-3 active:bg-gray-50">
            ביטול הראיון
          </button>
        )}
        <button onClick={onDelete}
          className="w-full py-3 text-red-600 font-semibold text-right px-3 active:bg-red-50 border-t border-gray-100">
          מחיקה
        </button>
        <button onClick={onClose}
          className="w-full py-3 text-gray-500 font-semibold mt-1">ביטול</button>
      </div>
    </div>
  );
}
