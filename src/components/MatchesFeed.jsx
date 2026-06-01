import { useState, useEffect } from "react";
import { Sparkles, CalendarPlus, X, Loader2, Check, ThumbsUp } from "lucide-react";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// MatchesFeed — the restaurant-facing side of the AI matching agent.
// Reads `match_messages` (written by the n8n agent), renders a card per strong
// candidate, and lets the owner book an interview in one tap (→ `interviews`).
// ─────────────────────────────────────────────────────────────────────────────

function scoreStyle(score) {
  if (score >= 85) return { label: "התאמה מצוינת", dot: "bg-green-500", chip: "bg-green-50 text-green-700 border-green-200" };
  if (score >= 70) return { label: "התאמה גבוהה",  dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  return { label: "התאמה",   dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 border-amber-200" };
}

export default function MatchesFeed({ restaurant, user, onScheduled }) {
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [scheduleFor, setScheduleFor] = useState(null);
  const [interestedIds, setInterestedIds] = useState(() => new Set());

  const load = async () => {
    if (!restaurant?.id) return;
    setLoading(true);
    const { data: msgs } = await supabase
      .from("match_messages")
      .select("*, position:restaurant_positions(name, template_id)")
      .eq("restaurant_id", restaurant.id)
      .in("status", ["new", "viewed"])
      .order("match_score", { ascending: false })
      .order("created_at", { ascending: false });

    const ids = [...new Set((msgs || []).map((m) => m.candidate_user_id).filter(Boolean))];
    const map = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, name, phone").in("id", ids);
      (profs || []).forEach((p) => { map[p.id] = p; });
    }
    setProfiles(map);
    setMessages(msgs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant?.id]);

  const dismiss = async (m) => {
    setMessages((cur) => cur.filter((x) => x.id !== m.id));
    await supabase.from("match_messages").update({ status: "dismissed" }).eq("id", m.id);
  };

  // Double opt-in: the restaurant taps "Interested" → the waiter (who already
  // opted in by applying) gets notified back. We mark both the match and the
  // linked application as 'interested'; the waiter app reads that status live.
  const markInterested = async (m) => {
    setInterestedIds((cur) => new Set(cur).add(m.id));
    await supabase.from("match_messages").update({ status: "interested" }).eq("id", m.id);
    if (m.application_id) {
      await supabase.from("applications").update({ status: "interested" }).eq("id", m.application_id);
    }
  };

  const confirmSchedule = async ({ when, duration }) => {
    const m = scheduleFor;
    const prof = profiles[m.candidate_user_id] || {};
    const name = prof.name || candidateName(m) || "מועמד/ת";
    await supabase.from("interviews").insert({
      restaurant_id:     m.restaurant_id,
      application_id:    m.application_id,
      position_id:       m.position_id,
      candidate_user_id: m.candidate_user_id,
      candidate_name:    name,
      candidate_phone:   prof.phone || null,
      scheduled_at:      when,
      duration_min:      duration,
      status:            "scheduled",
      created_by:        user?.id || null,
    });
    await supabase.from("match_messages").update({ status: "scheduled" }).eq("id", m.id);
    // Notify the waiter that the restaurant engaged (drives their notification).
    if (m.application_id) {
      await supabase.from("applications").update({ status: "interested" }).eq("id", m.application_id);
    }
    setScheduleFor(null);
    setMessages((cur) => cur.filter((x) => x.id !== m.id));
    onScheduled?.();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 size={20} className="text-gray-300 animate-spin" />
      </div>
    );
  }
  if (!messages.length) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 px-1 mb-2">
        <Sparkles size={14} className="text-brand-600" />
        <p className="text-gray-900 font-bold text-sm">התאמות חכמות</p>
        <span className="bg-brand-100 text-brand-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {messages.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {messages.map((m) => {
          const st = scoreStyle(m.match_score || 0);
          const highlights = Array.isArray(m.highlights) ? m.highlights : [];
          return (
            <div key={m.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              {/* header */}
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${st.chip}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label} · {m.match_score}%
                </span>
                <div className="flex items-center gap-2">
                  {m.position?.name && (
                    <span className="text-gray-500 text-[11px] font-semibold">{m.position.name}</span>
                  )}
                  <button onClick={() => dismiss(m)}
                    className="w-6 h-6 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center active:bg-gray-100">
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* summary */}
              <p className="text-gray-800 text-sm leading-relaxed">{m.summary}</p>

              {/* highlights */}
              {highlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {highlights.map((h, i) => (
                    <span key={i} className="bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                      {h.icon ? `${h.icon} ` : ""}{h.text}
                    </span>
                  ))}
                </div>
              )}

              {/* fit line */}
              {m.req_count > 0 && (
                <p className="text-gray-500 text-[11px] mt-2.5 flex items-center gap-1">
                  <Check size={12} className="text-green-600" />
                  עומד/ת ב-{m.met_count} מתוך {m.req_count} הדרישות למשרה זו
                </p>
              )}

              {/* actions */}
              {interestedIds.has(m.id) ? (
                <div className="mt-3 space-y-2">
                  <div className="w-full bg-green-50 border border-green-200 text-green-700 font-bold text-[12px] py-2.5 rounded-xl flex items-center justify-center gap-1.5">
                    <Check size={15} />שלחנו התראה למועמד/ת שאתם מעוניינים
                  </div>
                  <button onClick={() => setScheduleFor(m)}
                    className="w-full bg-gray-900 text-white font-bold text-sm py-3 rounded-xl active:bg-gray-800 flex items-center justify-center gap-2">
                    <CalendarPlus size={16} />קבע ראיון
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => markInterested(m)}
                    className="flex-1 bg-brand-600 text-white font-bold text-sm py-3 rounded-xl active:bg-brand-700 flex items-center justify-center gap-1.5">
                    <ThumbsUp size={16} />מעוניינים
                  </button>
                  <button onClick={() => setScheduleFor(m)}
                    className="flex-1 bg-gray-900 text-white font-bold text-sm py-3 rounded-xl active:bg-gray-800 flex items-center justify-center gap-1.5">
                    <CalendarPlus size={16} />קבע ראיון
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {scheduleFor && (
        <ScheduleModal
          name={profiles[scheduleFor.candidate_user_id]?.name || candidateName(scheduleFor) || "מועמד/ת"}
          onClose={() => setScheduleFor(null)}
          onConfirm={confirmSchedule} />
      )}
    </div>
  );
}

// Best-effort: pull the candidate's name out of the summary's "היי! <name>" opener.
function candidateName(m) {
  const match = (m.summary || "").match(/היי!?\s*([^,.\n]+)/);
  return match ? match[1].trim() : null;
}

// ── Schedule interview modal ─────────────────────────────────────────────────
function ScheduleModal({ name, onClose, onConfirm }) {
  const today = new Date();
  const [date,     setDate]     = useState(today.toISOString().slice(0, 10));
  const [time,     setTime]     = useState("10:00");
  const [duration, setDuration] = useState(30);
  const [saving,   setSaving]   = useState(false);

  const submit = async () => {
    if (!date || !time) return;
    setSaving(true);
    const when = new Date(`${date}T${time}:00`).toISOString();
    await onConfirm({ when, duration });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-w-md shadow-2xl" dir="rtl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-5 pb-8 pt-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-gray-900 font-black text-lg flex items-center gap-2">
              <CalendarPlus size={18} className="text-gray-500" />קביעת ראיון
            </h3>
            <button onClick={onClose}
              className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
              <X size={16} />
            </button>
          </div>
          <p className="text-gray-500 text-xs mb-5">עם {name}</p>

          <label className="block text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-1.5">תאריך</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900 mb-4" />

          <label className="block text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-1.5">שעה</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900 mb-4" />

          <label className="block text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-2">משך</label>
          <div className="flex gap-2 mb-6">
            {[15, 30, 45, 60].map((d) => (
              <button key={d} onClick={() => setDuration(d)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                  duration === d
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-gray-50 text-gray-700 border-gray-200 active:bg-gray-100"
                }`}>
                {d}׳
              </button>
            ))}
          </div>

          <button onClick={submit} disabled={saving}
            className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-2xl active:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <><Check size={16} />קבע ראיון</>}
          </button>
        </div>
      </div>
    </div>
  );
}
