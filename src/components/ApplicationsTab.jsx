import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Phone, MapPin, Clock, Loader2, ChevronRight, ArrowRight, Target, Calendar as CalIcon, Check, X, Lock, RotateCcw } from "lucide-react";
import { computeMatch, scoreColor } from "../lib/matching";
import { getJobRequirements, computeReqMatch } from "../lib/requirements";
import { can } from "../lib/permissions";
import { expLabel } from "../lib/gender";
import { locationLabel } from "../lib/location";

// Combined display score for a candidate: prefer the requirement-match score
// the waiter generated at apply time (mandatory shifts + commitment), then fall
// back to the screening-question score.
function displayScore(restaurant, app) {
  if (app?.match_score != null) return app.match_score;
  const qs = restaurant?.screening_questions || [];
  if (qs.length) return computeMatch(restaurant, qs, app?.answers || {}).score;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ApplicationsTab — white Fireberry-style.  Lists candidates with match-score
// badges, opens a detail view with screening answers + 🟢🔴 indicators.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS = {
  new:       { label: "חדש",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  viewed:    { label: "נצפה", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  accepted:  { label: "אושר", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:  { label: "נדחה", cls: "bg-red-50 text-red-600 border-red-200" },
  contacted: { label: "פנית", cls: "bg-green-50 text-green-700 border-green-200" },
};

const AVATAR_COLORS = [
  "from-brand-500 to-purple-600",
  "from-green-500 to-teal-600",
  "from-orange-500 to-red-500",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-blue-600",
];
function avatarColor(name) {
  const i = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}
function initials(name) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function ApplicationsTab({ restaurant, role = "owner", onScheduleInterview }) {
  const canContact = can(role, "contact_candidates");
  const [apps, setApps]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [openQuestions, setOpenQuestions] = useState([]); // free-text questions

  // Load the owner's free-text "open questions" so we can show each candidate's
  // answers in the detail view. Answers ride on applications.answers keyed by the
  // question id (set by the waiter app at apply time).
  useEffect(() => {
    if (!restaurant?.id) return;
    let cancelled = false;
    (async () => {
      const { data: positions } = await supabase
        .from("restaurant_positions").select("id, name").eq("restaurant_id", restaurant.id);
      const ids = (positions || []).map((p) => p.id);
      if (!ids.length) { setOpenQuestions([]); return; }
      const { data: qs } = await supabase
        .from("position_screening_questions")
        .select("id, question, answer_type, enabled, sort_order")
        .in("position_id", ids);
      if (cancelled) return;
      const list = (qs || [])
        .filter((q) => q.answer_type === "text" && q.question)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setOpenQuestions(list);
    })();
    return () => { cancelled = true; };
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant?.id) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("applications").select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false });

      // Manually attach profile (no FK from applications → profiles).
      let withProfiles = rows || [];
      if (withProfiles.length > 0) {
        const userIds = [...new Set(withProfiles.map((r) => r.user_id).filter(Boolean))];
        if (userIds.length) {
          const { data: profiles } = await supabase
            .from("profiles").select("*").in("id", userIds);
          const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
          withProfiles = withProfiles.map((a) => ({ ...a, profile: byId[a.user_id] || {} }));
        }
      }

      // Sort: new first, then by match score, then by date.
      const sorted = [...withProfiles].sort((a, b) => {
        const aNew = a.status === "new" ? 0 : 1;
        const bNew = b.status === "new" ? 0 : 1;
        if (aNew !== bNew) return aNew - bNew;
        const sA = displayScore(restaurant, a) ?? -1;
        const sB = displayScore(restaurant, b) ?? -1;
        if (sA !== sB) return sB - sA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      if (cancelled) return;
      setApps(sorted);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [restaurant?.id, restaurant?.screening_questions, restaurant?.mandatory_shifts, restaurant?.soft_attributes]);

  const open = async (app) => {
    if (app.status === "new") {
      await supabase.from("applications").update({ status: "viewed" }).eq("id", app.id);
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: "viewed" } : a)));
    }
    setSelected(app);
  };

  // Update an application's status both in the DB and in local state (list + open detail).
  const setStatus = async (app, status) => {
    await supabase.from("applications").update({ status }).eq("id", app.id);
    setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status } : a)));
    setSelected((cur) => (cur && cur.id === app.id ? { ...cur, status } : cur));
  };
  const accept  = (app) => setStatus(app, "accepted");
  const reject  = (app) => setStatus(app, "rejected");
  const contact = (app) => setStatus(app, "contacted");

  // ── Detail view ──
  if (selected) {
    const p  = selected.profile || {};
    const wa = p.phone
      ? `https://wa.me/972${p.phone.replace(/\D/g, "").replace(/^0/, "")}?text=${encodeURIComponent(
          `היי ${p.name || ""}! ראיתי את הפניה שלך ל-${restaurant?.name} ב-ShiftMatch 😊`)}`
      : null;

    return (
      <div className="bg-gray-50 min-h-full pb-8">
        {/* Header */}
        <div className="px-4 pt-16 pb-4 flex items-center gap-3 bg-white border-b border-gray-100">
          <button onClick={() => setSelected(null)}
            className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:bg-gray-200">
            <ArrowRight size={16} className="text-gray-700" />
          </button>
          <span className="text-gray-900 font-bold">פרופיל מועמד</span>
        </div>

        <div className="px-4 pt-4 space-y-3">
          {/* Profile card */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center gap-4 mb-5">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor(p.name)} flex items-center justify-center font-black text-white text-xl shadow-md flex-shrink-0`}>
                {initials(p.name)}
              </div>
              <div>
                <h2 className="text-gray-900 font-black text-xl">{p.name || "מועמד"}</h2>
                {p.city && (
                  <p className="text-gray-500 text-sm flex items-center gap-1 mt-0.5">
                    <MapPin size={12} />{locationLabel({ city: p.city, lat: p.lat, lng: p.lng })}
                  </p>
                )}
                <span className={`inline-block mt-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${STATUS[selected.status]?.cls || STATUS.new.cls}`}>
                  {STATUS[selected.status]?.label || "חדש"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {p.experience && <DetailTile label="ניסיון" value={expLabel(p.experience, p.gender)} />}
              {p.min_hourly_rate > 0 && <DetailTile label="ציפיית שכר" value={`₪${p.min_hourly_rate}/שעה`} />}
            </div>
          </div>

          {/* Willingness vs the job's hard requirements (mandatory shifts + commitment) */}
          {(() => {
            const { list } = getJobRequirements(restaurant);
            if (!list.length) return null;
            const answers = selected.answers || {};
            const { score, perReq } = computeReqMatch(restaurant, answers);
            const sc = scoreColor(score);
            return (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <Target size={11} />התאמה לדרישות המשרה
                  </p>
                  {score != null && (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 ${sc.bg} ${sc.text}`}>
                      {score}%
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {list.map((r) => {
                    const status = perReq[r.key];
                    const dot = status === "match" ? "🟢" : status === "miss" ? "🔴" : "⚫";
                    const txt = status === "match" ? "מוכן/ה" : status === "miss" ? "לא מוכן/ה" : "לא נשאל/ה";
                    return (
                      <div key={r.key} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-700 flex items-center gap-1.5">
                          <span className="text-[10px]">{dot}</span>
                          <span>{r.emoji}</span>{r.label}
                        </span>
                        <span className={`text-xs font-bold ${
                          status === "match" ? "text-green-600" : status === "miss" ? "text-red-500" : "text-gray-400"
                        }`}>{txt}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-400 mt-3">🟢 מוכן/ה · 🔴 לא מוכן/ה · ⚫ לא נשאל/ה</p>
              </div>
            );
          })()}

          {p.shifts?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                <Clock size={11} />משמרות מועדפות
              </p>
              <div className="flex flex-wrap gap-2">
                {p.shifts.map((s) => (
                  <span key={s} className="bg-brand-50 text-brand-700 text-xs px-3 py-1.5 rounded-full font-semibold border border-brand-100">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Screening answers + match */}
          {restaurant?.screening_questions?.length > 0 && (() => {
            const questions = restaurant.screening_questions;
            const answers   = selected.answers || {};
            const { score, perAnswer } = computeMatch(restaurant, questions, answers);
            const sc = scoreColor(score);
            return (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
                    תשובות לשאלון סינון
                  </p>
                  {score != null && (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 ${sc.bg} ${sc.text}`}>
                      <Target size={12} />התאמה {score}%
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {questions.map((q) => {
                    const a = answers[q.id];
                    const answered = a !== undefined && a !== null && a !== "";
                    const status = perAnswer[q.id];
                    const dot =
                      status === "match"   ? "🟢" :
                      status === "miss"    ? "🔴" :
                      status === "neutral" ? "⚪" : "⚫";
                    return (
                      <div key={q.id} className="border-r-2 border-gray-900/30 pr-3">
                        <p className="text-gray-500 text-[11px] mb-0.5 flex items-center gap-1">
                          <span className="text-[10px]">{dot}</span>{q.label}
                        </p>
                        <p className={`text-sm font-semibold ${answered ? "text-gray-900" : "text-gray-400 italic"}`}>
                          {!answered
                            ? "לא ענה/תה"
                            : q.type === "boolean"
                              ? (a ? "כן" : "לא")
                              : Array.isArray(a) ? a.join(", ") : String(a)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-400 mt-3">
                  🟢 תואם · 🔴 לא תואם · ⚪ ניטרלי · ⚫ לא ענה/תה
                </p>
              </div>
            );
          })()}

          {/* Open-question answers — free text the candidate wrote at apply time */}
          {(() => {
            const answers = selected.answers || {};
            const answered = openQuestions.filter((q) => {
              const a = answers[q.id];
              return a !== undefined && a !== null && String(a).trim() !== "";
            });
            if (!answered.length) return null;
            return (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
                  שאלות פתוחות
                </p>
                <div className="space-y-3">
                  {answered.map((q) => (
                    <div key={q.id} className="border-r-2 border-brand-500/40 pr-3">
                      <p className="text-gray-500 text-[11px] mb-0.5">{q.question}</p>
                      <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
                        {String(answers[q.id])}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* CTA — contact details are gated behind an accept/reject decision */}
          {!canContact ? (
            <div className="bg-gray-100 border border-gray-200 rounded-2xl p-3 text-center text-gray-500 text-xs">
              🔒 התפקיד שלך אינו מאפשר יצירת קשר עם מועמדים
            </div>
          ) : selected.status === "rejected" ? (
            <div className="space-y-2.5 pt-1">
              <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center text-red-600 text-xs font-semibold">
                ❌ דחית את המועמד/ת — פרטי ההתקשרות מוסתרים
              </div>
              <button onClick={() => accept(selected)}
                className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-full flex items-center justify-center gap-2 active:bg-gray-50 text-sm shadow-sm">
                <RotateCcw size={15} />ביטול הדחייה
              </button>
            </div>
          ) : (selected.status === "accepted" || selected.status === "contacted") ? (
            <>
              <div className="flex gap-2.5 pt-1">
                {p.phone && (
                  <a href={`tel:${p.phone}`} onClick={() => contact(selected)}
                    className="flex-1 bg-gray-900 text-white font-bold py-3.5 rounded-full flex items-center justify-center gap-2 active:bg-gray-800 shadow-md text-sm">
                    <Phone size={15} />התקשר/י
                  </a>
                )}
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer" onClick={() => contact(selected)}
                    className="flex-1 bg-[#25D366] text-white font-bold py-3.5 rounded-full flex items-center justify-center gap-2 active:opacity-90 shadow-md text-sm">
                    <span className="text-base">💬</span> WhatsApp
                  </a>
                )}
              </div>
              {onScheduleInterview && (
                <button onClick={() => onScheduleInterview(selected)}
                  className="w-full bg-white border border-gray-200 text-gray-900 font-bold py-3.5 rounded-full flex items-center justify-center gap-2 active:bg-gray-50 text-sm shadow-sm">
                  <CalIcon size={15} />קביעת ראיון
                </button>
              )}
            </>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center text-amber-700 text-xs flex items-center justify-center gap-1.5">
                <Lock size={12} />פרטי ההתקשרות יחשפו לאחר אישור המועמד/ת
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => accept(selected)}
                  className="flex-1 bg-emerald-600 text-white font-bold py-3.5 rounded-full flex items-center justify-center gap-2 active:bg-emerald-700 shadow-md text-sm">
                  <Check size={16} />אישור
                </button>
                <button onClick={() => reject(selected)}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold py-3.5 rounded-full flex items-center justify-center gap-2 active:bg-gray-50 shadow-sm text-sm">
                  <X size={16} />דחייה
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ──
  if (loading) return (
    <div className="bg-gray-50 min-h-full pt-16 px-4 space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-gray-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-2.5 bg-gray-50 rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );

  if (!apps.length) return (
    <div className="bg-gray-50 min-h-full pt-20 px-6">
      <div className="bg-white border border-gray-200 rounded-3xl p-10 text-center shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4 text-3xl">📭</div>
        <p className="text-gray-900 font-bold text-base">אין פניות עדיין</p>
        <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">
          ברגע שמועמדים יפנו דרך האפליקציה<br/>הם יופיעו כאן.
        </p>
      </div>
    </div>
  );

  const newCount = apps.filter((a) => a.status === "new").length;

  return (
    <div className="bg-gray-50 min-h-full pb-24">
      <div className="px-5 pt-20 pb-3 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">פניות</h1>
          <p className="text-gray-500 text-sm mt-1">
            {apps.length} סה"כ{newCount > 0 && ` · ${newCount} חדשות`}
          </p>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-2.5">
        {apps.map((app) => {
          const p = app.profile || {};
          const s = STATUS[app.status] || STATUS.new;
          const isNew = app.status === "new";
          const ago = formatAgo(app.created_at);
          const score = displayScore(restaurant, app);
          const sc = scoreColor(score);
          return (
            <div key={app.id} onClick={() => open(app)}
              className={`rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition-all cursor-pointer border relative shadow-sm ${
                isNew ? "bg-white border-blue-200" : "bg-white border-gray-200"
              }`}>
              {isNew && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-blue-500">
                  <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping" />
                </span>
              )}
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarColor(p.name)} flex items-center justify-center font-bold text-white text-base flex-shrink-0 shadow-md`}>
                {initials(p.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-900 font-bold text-sm">{p.name || "מועמד"}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {score != null && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                        {score}%
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-0.5 truncate">
                  {expLabel(p.experience, p.gender)}
                  {p.city ? ` · ${locationLabel({ city: p.city, lat: p.lat, lng: p.lng })}` : ""}
                  {p.min_hourly_rate > 0 ? ` · ₪${p.min_hourly_rate}/שעה` : ""}
                </p>
                {ago && <p className="text-gray-400 text-[10px] mt-1">⏱ {ago}</p>}
              </div>
              <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatAgo(timestamp) {
  if (!timestamp) return null;
  const ago = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(ago / 60000);
  if (mins < 1)   return "עכשיו";
  if (mins < 60)  return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days < 7)   return `לפני ${days} ימים`;
  return new Date(timestamp).toLocaleDateString("he-IL");
}

function DetailTile({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
      <p className="text-gray-500 text-xs mb-0.5 font-medium">{label}</p>
      <p className="text-gray-900 font-bold text-sm">{value}</p>
    </div>
  );
}
