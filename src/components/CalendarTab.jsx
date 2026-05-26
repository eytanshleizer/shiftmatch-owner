import { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalIcon, Plus, MapPin, Phone, X, Check, Loader2,
  ChevronLeft, ChevronRight, MoreVertical, List as ListIcon, Grid3x3
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { can } from "../lib/permissions";
import { normalizePhoneInput, isValidIsraeliPhone } from "../lib/phone";

// ─────────────────────────────────────────────────────────────────────────────
// CalendarTab — full month grid + agenda below.
// Grid view shows a real calendar with day cells; dots indicate the count
// of scheduled interviews on each day.  Tap a day to filter the agenda.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META = {
  scheduled: { label: "מתוכנן",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
  done:      { label: "בוצע",     cls: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "בוטל",     cls: "bg-gray-100 text-gray-500 border-gray-200" },
  no_show:   { label: "לא הגיע",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const DAYS_HE = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

export default function CalendarTab({ restaurant, user, role = "owner" }) {
  const canSchedule = can(role, "contact_candidates");

  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [actionFor, setActionFor] = useState(null);

  // Calendar navigation: currently displayed month + selected day.
  const today = useMemo(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getTime()); // selected day timestamp (midnight)

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

  // ── Group items by day-key for grid lookup ───────────────────────────
  const byDayKey = useMemo(() => {
    const m = {};
    items.forEach((it) => {
      const dt = new Date(it.scheduled_at);
      const k = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      (m[k] ||= []).push(it);
    });
    return m;
  }, [items]);

  // ── Build month grid (always 6 rows for stable layout) ──────────────
  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const offset = first.getDay(); // 0=Sun
    const start = new Date(first); start.setDate(start.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return d;
    });
  }, [viewYear, viewMonth]);

  const setStatus = async (id, status) => {
    await supabase.from("interviews").update({ status }).eq("id", id);
    load(); setActionFor(null);
  };

  const remove = async (id) => {
    if (!confirm("למחוק את הראיון?")) return;
    await supabase.from("interviews").delete().eq("id", id);
    load(); setActionFor(null);
  };

  const prevMonth = () => {
    let m = viewMonth - 1, y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    setViewMonth(m); setViewYear(y);
  };
  const nextMonth = () => {
    let m = viewMonth + 1, y = viewYear;
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  };

  // ── Items for the selected day ──
  const selDate = new Date(selectedDay);
  const selKey  = `${selDate.getFullYear()}-${selDate.getMonth()}-${selDate.getDate()}`;
  const dayItems = (byDayKey[selKey] || []).slice().sort((a, b) =>
    new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const upcomingCount = items.filter((it) =>
    new Date(it.scheduled_at) >= new Date() && it.status === "scheduled").length;

  return (
    <div className="bg-gray-50 min-h-full pb-24 text-gray-900">

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

      {/* ── Month calendar grid ── */}
      <div className="px-4 pt-2">
        <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth}
              className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center active:bg-gray-100">
              <ChevronRight size={14} className="text-gray-700" />
            </button>
            <button onClick={() => {
              setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDay(today.getTime());
            }} className="font-black text-gray-900 text-base">
              {MONTHS_HE[viewMonth]} {viewYear}
            </button>
            <button onClick={nextMonth}
              className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center active:bg-gray-100">
              <ChevronLeft size={14} className="text-gray-700" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_HE.map((d) => (
              <div key={d} className="text-center text-gray-400 text-[10px] font-bold py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d, idx) => {
              const inMonth = d.getMonth() === viewMonth;
              const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
              const dayItemsCount = (byDayKey[dayKey] || []).length;
              const isToday  = d.getTime() === today.getTime();
              const isSelected = d.getTime() === selectedDay;
              return (
                <button key={idx} onClick={() => setSelectedDay(d.getTime())}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-colors ${
                    isSelected
                      ? "bg-gray-900 text-white shadow-md"
                      : isToday
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : inMonth
                          ? "bg-white text-gray-900 active:bg-gray-50"
                          : "bg-transparent text-gray-300"
                  }`}>
                  <span className={`text-sm font-bold ${isSelected ? "text-white" : ""}`}>{d.getDate()}</span>
                  {dayItemsCount > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {Array.from({ length: Math.min(dayItemsCount, 3) }).map((_, i) => (
                        <span key={i} className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-brand-500"}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Agenda for the selected day ── */}
      <div className="px-4 pt-4 space-y-2">
        <div className="flex items-center justify-between px-1 mb-1">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">
            {selDate.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <span className="text-gray-400 text-[11px] font-semibold">{dayItems.length} ראיונות</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-gray-400" /></div>
        ) : dayItems.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
              <CalIcon size={20} className="text-gray-400" />
            </div>
            <p className="text-gray-900 font-bold text-sm">אין ראיונות ביום זה</p>
            {canSchedule && (
              <button onClick={() => setShowAdd(true)}
                className="mt-3 text-gray-900 text-xs font-bold underline">קבע ראיון חדש</button>
            )}
          </div>
        ) : (
          dayItems.map((it) => (
            <InterviewCard key={it.id} it={it}
              onAction={() => canSchedule && setActionFor(it)} />
          ))
        )}
      </div>

      {showAdd && (
        <ScheduleModal
          restaurant={restaurant} user={user}
          defaultDate={new Date(selectedDay)}
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
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-center min-w-[60px] flex-shrink-0">
          <p className="text-gray-900 font-black text-base leading-none">{time}</p>
          <p className="text-gray-500 text-[10px] mt-0.5">{it.duration_min || 30} ד׳</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-gray-900 font-bold text-sm truncate">{it.candidate_name || "מועמד/ת"}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${sMeta.cls}`}>
              {sMeta.label}
            </span>
          </div>
          {it.location && (
            <p className="text-gray-500 text-xs flex items-center gap-1 mt-1"><MapPin size={11} />{it.location}</p>
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

// ── Modals (unchanged from previous version) ──────────────────────────────

function ScheduleModal({ restaurant, user, defaultDate, onClose, onSaved }) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate]   = useState("");
  const [time, setTime]   = useState("");
  const [dur,  setDur]    = useState(30);
  const [loc,  setLoc]    = useState("המסעדה");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!date) {
      const d = defaultDate || new Date();
      setDate(d.toISOString().slice(0, 10));
    }
    if (!time) setTime("17:00");
  }, []);

  const submit = async () => {
    setErr("");
    if (!name.trim()) return setErr("חסר שם מועמד");
    if (phone && !isValidIsraeliPhone(phone)) return setErr("המספר חייב להתחיל ב-05 ולכלול 10 ספרות");
    if (!date || !time) return setErr("חסר תאריך/שעה");

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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
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

        <FormField label="טלפון (אופציונלי)" hint="חייב להתחיל ב-05 ולכלול 10 ספרות">
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
                  dur === m ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
                }`}>{m} ד׳</button>
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
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl px-4 py-2.5 text-center mb-3">{err}</div>
        )}

        <button onClick={submit} disabled={saving}
          className="w-full bg-gray-900 text-white font-bold py-4 rounded-full active:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2 shadow-md">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          קביעת הראיון
        </button>
      </div>
    </div>
  );
}

function FormField({ label, hint, children }) {
  return (
    <div className="mb-4">
      <label className="text-gray-600 text-[11px] font-bold uppercase tracking-wide block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-gray-400 text-[10px] mt-1">{hint}</p>}
    </div>
  );
}

function ActionSheet({ interview, onClose, onStatus, onDelete }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl p-4 pb-8 max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
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
        <button onClick={onClose} className="w-full py-3 text-gray-500 font-semibold mt-1">ביטול</button>
      </div>
    </div>
  );
}
