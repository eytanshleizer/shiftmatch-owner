import { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalIcon, Plus, MapPin, Phone, X, Check, Loader2,
  ChevronLeft, ChevronRight, MoreVertical, Clock
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { can } from "../lib/permissions";
import { normalizePhoneInput, isValidIsraeliPhone } from "../lib/phone";

// ─────────────────────────────────────────────────────────────────────────────
// CalendarTab — redesigned for comfort.
//
// • Compact month grid (fixed-height cells, not aspect-square)
// • Colored dots per status (blue=scheduled, green=done, amber=no_show)
// • Agenda below shows ALL upcoming interviews grouped by date by default.
//   Tap a day in the grid to filter to just that day; tap it again to clear.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META = {
  scheduled: { label: "מתוכנן",  cls: "bg-blue-50 text-blue-700 border-blue-200",   dot: "bg-blue-500"  },
  done:      { label: "בוצע",    cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  cancelled: { label: "בוטל",    cls: "bg-gray-100 text-gray-400 border-gray-200",   dot: "bg-gray-300"  },
  no_show:   { label: "לא הגיע", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
};

const DAYS_HE   = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}
function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function CalendarTab({ restaurant, user, role = "owner" }) {
  const canSchedule = can(role, "contact_candidates");

  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [actionFor, setActionFor] = useState(null);

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const [viewYear,    setViewYear]    = useState(today.getFullYear());
  const [viewMonth,   setViewMonth]   = useState(today.getMonth());
  // null = show all upcoming; a Date object = filter to that day
  const [selectedDay, setSelectedDay] = useState(null);

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

  // ── Index items by dayKey for the grid dots ────────────────────────────
  const byDayKey = useMemo(() => {
    const m = {};
    items.forEach((it) => {
      const k = dayKey(new Date(it.scheduled_at));
      (m[k] ||= []).push(it);
    });
    return m;
  }, [items]);

  // ── 6-row month grid ──────────────────────────────────────────────────
  const grid = useMemo(() => {
    const first  = new Date(viewYear, viewMonth, 1);
    const offset = first.getDay();
    const start  = new Date(first);
    start.setDate(start.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [viewYear, viewMonth]);

  // ── Agenda groups ─────────────────────────────────────────────────────
  // Default: all upcoming (today + future). When a day is selected: only that day.
  const agendaGroups = useMemo(() => {
    let filtered;
    if (selectedDay) {
      const k = dayKey(selectedDay);
      filtered = (byDayKey[k] || []).slice();
    } else {
      filtered = items.filter((it) => new Date(it.scheduled_at) >= today);
    }
    filtered.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

    const groups = {};
    filtered.forEach((it) => {
      const k = dayKey(new Date(it.scheduled_at));
      (groups[k] ||= []).push(it);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [items, selectedDay, today, byDayKey]);

  const groupLabel = (k) => {
    const [y, m, d] = k.split("-").map(Number);
    const dt = new Date(y, m, d);
    if (sameDay(dt, today)) return "היום";
    const tom = new Date(today); tom.setDate(today.getDate() + 1);
    if (sameDay(dt, tom)) return "מחר";
    return dt.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  };

  const upcomingCount = items.filter(
    (it) => new Date(it.scheduled_at) >= today && it.status === "scheduled"
  ).length;

  const prevMonth = () => {
    let m = viewMonth - 1, y = viewYear;
    if (m < 0) { m = 11; y--; }
    setViewMonth(m); setViewYear(y);
  };
  const nextMonth = () => {
    let m = viewMonth + 1, y = viewYear;
    if (m > 11) { m = 0; y++; }
    setViewMonth(m); setViewYear(y);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(null);
  };

  const setStatus = async (id, status) => {
    await supabase.from("interviews").update({ status }).eq("id", id);
    load(); setActionFor(null);
  };
  const remove = async (id) => {
    if (!confirm("למחוק את הראיון?")) return;
    await supabase.from("interviews").delete().eq("id", id);
    load(); setActionFor(null);
  };

  const isViewingOtherMonth =
    viewMonth !== today.getMonth() || viewYear !== today.getFullYear();

  return (
    <div className="bg-gray-50 min-h-full pb-24 text-gray-900" dir="rtl">

      {/* ── Header ── */}
      <div className="px-5 pt-20 pb-3 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">ראיונות</h1>
          <p className="text-gray-500 text-sm mt-1">
            {upcomingCount > 0
              ? `${upcomingCount} ראיונות קרובים`
              : "אין ראיונות מתוכננים"}
          </p>
        </div>
        {canSchedule && (
          <button onClick={() => setShowAdd(true)}
            className="bg-gray-900 text-white font-bold text-sm px-4 py-2.5 rounded-full active:bg-gray-800 flex items-center gap-1.5 shadow-md shadow-gray-900/10">
            <Plus size={14} />ראיון חדש
          </button>
        )}
      </div>

      {/* ── Month grid ── */}
      <div className="px-4 pt-1 pb-3">
        <div className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm">

          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth}
              className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center active:bg-gray-100">
              <ChevronRight size={14} className="text-gray-700" />
            </button>
            <button onClick={goToday} className="flex items-center gap-2">
              <span className="font-black text-gray-900 text-base">
                {MONTHS_HE[viewMonth]} {viewYear}
              </span>
              {isViewingOtherMonth && (
                <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                  חזור להיום
                </span>
              )}
            </button>
            <button onClick={nextMonth}
              className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center active:bg-gray-100">
              <ChevronLeft size={14} className="text-gray-700" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_HE.map((d) => (
              <div key={d} className="text-center text-gray-400 text-[10px] font-bold py-0.5">{d}</div>
            ))}
          </div>

          {/* Day cells — compact fixed height */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {grid.map((d, idx) => {
              const inMonth = d.getMonth() === viewMonth;
              const k       = dayKey(d);
              const events  = byDayKey[k] || [];
              const isToday = sameDay(d, today);
              const isSel   = selectedDay && sameDay(d, selectedDay);
              // up to 3 distinct status dots
              const dots    = [...new Set(events.map((it) => it.status))].slice(0, 3);

              return (
                <button key={idx}
                  onClick={() => {
                    if (isSel) { setSelectedDay(null); return; }
                    const sel = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    setSelectedDay(sel);
                    if (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear) {
                      setViewMonth(d.getMonth()); setViewYear(d.getFullYear());
                    }
                  }}
                  className={`h-9 rounded-xl flex flex-col items-center justify-center transition-colors ${
                    isSel
                      ? "bg-gray-900 text-white shadow-sm"
                      : isToday
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : inMonth
                          ? "active:bg-gray-100 text-gray-900"
                          : "text-gray-300"
                  }`}>
                  <span className={`text-[12px] font-bold leading-none ${dots.length > 0 ? "mb-[3px]" : ""}`}>
                    {d.getDate()}
                  </span>
                  {dots.length > 0 && (
                    <div className="flex gap-[2px]">
                      {dots.map((s, i) => (
                        <span key={i} className={`w-[5px] h-[5px] rounded-full ${
                          isSel ? "bg-white/70" : (STATUS_META[s]?.dot || "bg-gray-400")
                        }`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Active filter chip ── */}
      {selectedDay && (
        <div className="px-4 pb-3 flex items-center justify-between">
          <span className="text-gray-900 text-sm font-bold">
            {selectedDay.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <button onClick={() => setSelectedDay(null)}
            className="flex items-center gap-1 text-gray-500 text-xs font-semibold bg-gray-100 rounded-full px-3 py-1.5 active:bg-gray-200">
            <X size={11} />הצג הכל
          </button>
        </div>
      )}

      {/* ── Agenda list ── */}
      <div className="px-4 space-y-5 pb-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={22} className="animate-spin text-gray-400" />
          </div>
        ) : agendaGroups.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
              <CalIcon size={22} className="text-gray-400" />
            </div>
            <p className="text-gray-900 font-bold text-sm">
              {selectedDay ? "אין ראיונות ביום הזה" : "אין ראיונות קרובים"}
            </p>
            <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
              {selectedDay
                ? "לחצ/י על יום אחר בלוח או צור/י ראיון חדש"
                : "כל הראיונות הקרובים שלך יופיעו כאן"}
            </p>
            {canSchedule && (
              <button onClick={() => setShowAdd(true)}
                className="mt-4 bg-gray-900 text-white text-sm font-bold px-5 py-2.5 rounded-full active:bg-gray-800 inline-flex items-center gap-1.5">
                <Plus size={13} />ראיון חדש
              </button>
            )}
          </div>
        ) : (
          agendaGroups.map(([k, groupItems]) => (
            <div key={k}>
              {/* Date group header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-900 text-sm font-black whitespace-nowrap">
                  {groupLabel(k)}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
                {groupItems.length > 1 && (
                  <span className="text-gray-400 text-[11px] font-semibold whitespace-nowrap">
                    {groupItems.length} ראיונות
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {groupItems.map((it) => (
                  <InterviewCard key={it.id} it={it}
                    onAction={canSchedule ? () => setActionFor(it) : undefined} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showAdd && (
        <ScheduleModal
          restaurant={restaurant} user={user}
          defaultDate={selectedDay || today}
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

// ── Interview card ─────────────────────────────────────────────────────────
function InterviewCard({ it, onAction }) {
  const dt   = new Date(it.scheduled_at);
  const time = dt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const sMeta = STATUS_META[it.status] || STATUS_META.scheduled;

  const wa = it.candidate_phone
    ? `https://wa.me/972${it.candidate_phone.replace(/\D/g,"").replace(/^0/,"")}` +
      `?text=${encodeURIComponent(`היי ${it.candidate_name || ""}, מזכיר/ה לך את הראיון אצלנו היום בשעה ${time} 🙂`)}`
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex gap-3">
      {/* Time block */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 min-w-[58px]">
        <p className="text-gray-900 font-black text-base leading-none">{time}</p>
        <p className="text-gray-400 text-[10px] mt-1 flex items-center gap-0.5">
          <Clock size={8} />{it.duration_min || 30}ד׳
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-gray-900 font-bold text-sm truncate leading-snug">
            {it.candidate_name || "מועמד/ת"}
          </p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${sMeta.cls}`}>
            {sMeta.label}
          </span>
        </div>

        {it.location && (
          <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
            <MapPin size={10} className="flex-shrink-0" />
            <span className="truncate">{it.location}</span>
          </p>
        )}

        {it.notes && (
          <p className="text-gray-500 text-xs mt-1.5 line-clamp-1">{it.notes}</p>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-2 mt-2.5">
          {it.candidate_phone && (
            <a href={`tel:${it.candidate_phone}`}
              className="text-gray-700 text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full active:bg-gray-100 flex items-center gap-1">
              <Phone size={10} />
              {it.candidate_phone}
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer"
              className="text-green-700 text-xs font-bold bg-green-50 border border-green-200 px-3 py-1.5 rounded-full active:bg-green-100">
              💬
            </a>
          )}
          {onAction && (
            <button onClick={onAction}
              className="mr-auto w-8 h-8 rounded-full bg-gray-50 border border-gray-200 text-gray-500 flex items-center justify-center active:bg-gray-100">
              <MoreVertical size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Schedule modal ─────────────────────────────────────────────────────────
function ScheduleModal({ restaurant, user, defaultDate, onClose, onSaved }) {
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [date,  setDate]  = useState("");
  const [time,  setTime]  = useState("");
  const [dur,   setDur]   = useState(30);
  const [loc,   setLoc]   = useState("המסעדה");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err,   setErr]   = useState("");

  useEffect(() => {
    const d = defaultDate || new Date();
    setDate(d.toISOString().slice(0, 10));
    setTime("17:00");
  }, []);

  const submit = async () => {
    setErr("");
    if (!name.trim()) return setErr("חסר שם מועמד");
    if (phone && !isValidIsraeliPhone(phone)) return setErr("המספר חייב להתחיל ב-05 ולכלול 10 ספרות");
    if (!date || !time) return setErr("חסר תאריך/שעה");

    setSaving(true);
    const { error } = await supabase.from("interviews").insert({
      restaurant_id:   restaurant.id,
      candidate_name:  name.trim(),
      candidate_phone: phone || null,
      scheduled_at:    new Date(`${date}T${time}:00`).toISOString(),
      duration_min:    dur,
      location:        loc,
      notes:           notes.trim() || null,
      created_by:      user.id,
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
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                  dur === m
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
                }`}>
                {m}ד׳
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
            rows={3} placeholder="נושאים לדיון, התרשמות ראשונית..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900 resize-none" />
        </FormField>

        {err && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl px-4 py-2.5 text-center mb-3">
            {err}
          </div>
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
      <label className="text-gray-600 text-[11px] font-bold uppercase tracking-wide block mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-gray-400 text-[10px] mt-1">{hint}</p>}
    </div>
  );
}

// ── Action sheet ───────────────────────────────────────────────────────────
function ActionSheet({ interview, onClose, onStatus, onDelete }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
      onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl p-4 pb-8 max-w-md mx-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
        <p className="text-center text-gray-600 text-sm font-bold py-2 border-b border-gray-100 mb-1">
          {interview.candidate_name || "ראיון"}
        </p>
        {interview.status !== "done" && (
          <button onClick={() => onStatus("done")}
            className="w-full py-3.5 text-green-700 font-bold text-right px-3 active:bg-green-50 rounded-xl flex items-center gap-2">
            <Check size={16} />סמן כבוצע
          </button>
        )}
        {interview.status !== "no_show" && (
          <button onClick={() => onStatus("no_show")}
            className="w-full py-3.5 text-amber-700 font-semibold text-right px-3 active:bg-amber-50 rounded-xl">
            סמן ״לא הגיע/ה״
          </button>
        )}
        {interview.status !== "cancelled" && (
          <button onClick={() => onStatus("cancelled")}
            className="w-full py-3.5 text-gray-500 font-semibold text-right px-3 active:bg-gray-50 rounded-xl">
            ביטול הראיון
          </button>
        )}
        <div className="border-t border-gray-100 mt-1">
          <button onClick={onDelete}
            className="w-full py-3.5 text-red-600 font-semibold text-right px-3 active:bg-red-50 rounded-xl">
            מחיקה
          </button>
        </div>
        <button onClick={onClose}
          className="w-full py-3 text-gray-400 font-semibold text-center mt-1">
          ביטול
        </button>
      </div>
    </div>
  );
}
