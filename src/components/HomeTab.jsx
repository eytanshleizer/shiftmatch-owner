import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Search, TrendingUp, Eye, MessageCircle, Phone, ChevronLeft, Edit3,
  Briefcase, Users, Calendar, Sparkles
} from "lucide-react";
import { normalizePhoneInput, isValidIsraeliPhone } from "../lib/phone";

// ─────────────────────────────────────────────────────────────────────────────
// HomeTab — clean Fireberry-inspired white dashboard.
// Cards on light gray background, big black "active listing" hero,
// global search at top, quick KPIs and shortcuts.
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeTab({ restaurant: r, onUpdate, onOpenSearch, onGoTab }) {
  const [appCount, setAppCount]   = useState(0);
  const [toggling, setToggling]   = useState(false);
  const [editingWA, setEditingWA] = useState(false);
  const [waInput, setWaInput]     = useState(r?.recruitment_whatsapp || r?.phone || "");
  const [stats, setStats]         = useState({ views: 0, whatsapp: 0, calls: 0 });
  const [nextInterview, setNextInterview] = useState(null);

  useEffect(() => {
    if (!r?.id) return;
    // Applications + event analytics
    Promise.all([
      supabase.from("applications").select("id", { count: "exact", head: true })
        .eq("restaurant_id", r.id).eq("status", "new"),
      supabase.from("restaurant_events").select("event_type").eq("restaurant_id", r.id),
      supabase.from("interviews").select("*").eq("restaurant_id", r.id)
        .gte("scheduled_at", new Date().toISOString())
        .eq("status", "scheduled")
        .order("scheduled_at", { ascending: true }).limit(1),
    ]).then(([apps, events, intv]) => {
      setAppCount(apps.count || 0);
      const s = { views: 0, whatsapp: 0, calls: 0 };
      (events.data || []).forEach((e) => {
        if (e.event_type === "click")    s.views++;
        if (e.event_type === "whatsapp") s.whatsapp++;
        if (e.event_type === "call")     s.calls++;
      });
      setStats(s);
      setNextInterview(intv.data?.[0] || null);
    });
  }, [r?.id]);

  const toggleActive = async () => {
    setToggling(true);
    const { data } = await supabase.from("restaurants")
      .update({ active: !r.active }).eq("id", r.id).select().single();
    if (data) onUpdate(data);
    setToggling(false);
  };

  const saveWhatsApp = async () => {
    const cleaned = normalizePhoneInput(waInput);
    if (!isValidIsraeliPhone(cleaned)) return;
    const { data } = await supabase.from("restaurants")
      .update({ recruitment_whatsapp: cleaned, phone: cleaned })
      .eq("id", r.id).select().single();
    if (data) { onUpdate(data); setEditingWA(false); }
  };

  const totalPositions = Object.values(r?.position_counts || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
                       || (r?.position_types?.length || 0);

  return (
    <div className="bg-gray-50 min-h-full pb-8 text-gray-900">
      {/* ── Top search bar (always at the top of Home) ── */}
      <div className="px-4 pt-16 pb-3 bg-white border-b border-gray-100">
        <button onClick={onOpenSearch}
          className="w-full bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-2.5 active:bg-gray-200 transition-colors">
          <Search size={16} className="text-gray-500" />
          <span className="text-gray-500 text-sm flex-1 text-right">חיפוש מועמדים, משרות, ראיונות...</span>
          <span className="text-gray-400 text-[10px] font-semibold bg-white border border-gray-200 px-1.5 py-0.5 rounded">⌘K</span>
        </button>
      </div>

      <div className="px-4 pt-5 space-y-4">

        {/* ── Active listing hero card ── */}
        <button onClick={toggleActive} disabled={toggling}
          className={`w-full rounded-3xl p-6 text-right transition-all active:scale-[0.99] ${
            r?.active
              ? "bg-gray-900 text-white shadow-xl shadow-gray-900/20"
              : "bg-white border border-gray-200 text-gray-700"
          }`}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {r?.active && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-70" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                  </span>
                )}
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${r?.active ? "text-white/60" : "text-gray-500"}`}>
                  {r?.active ? "המודעה פעילה" : "המודעה כבויה"}
                </p>
              </div>
              <p className="text-2xl font-black tracking-tight">
                {r?.active ? "מגייסים עכשיו" : "לחצ/י להפעלת המודעה"}
              </p>
              <p className={`text-xs mt-1.5 ${r?.active ? "text-white/60" : "text-gray-400"}`}>
                {r?.active ? "מועמדים יכולים לראות ולפנות אליך" : "אף אחד לא רואה את המודעה כרגע"}
              </p>
            </div>
            <div className={`w-14 h-8 rounded-full flex items-center px-1 flex-shrink-0 ${
              r?.active ? "bg-white/20" : "bg-gray-200"
            }`} style={{ opacity: toggling ? 0.6 : 1 }}>
              <div className={`w-6 h-6 rounded-full transition-transform duration-300 ${
                r?.active ? "translate-x-6 bg-white" : "translate-x-0 bg-white"
              }`} />
            </div>
          </div>
        </button>

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-4 gap-2">
          <KPI label="פניות"   value={appCount}     accent="bg-brand-100 text-brand-700" icon={<TrendingUp size={14} />} onClick={() => onGoTab?.("apps")} />
          <KPI label="צפיות"   value={stats.views}  icon={<Eye size={14} />} />
          <KPI label="WhatsApp" value={stats.whatsapp} accent="bg-green-100 text-green-700" icon={<MessageCircle size={14} />} />
          <KPI label="שיחות"   value={stats.calls}  icon={<Phone size={14} />} />
        </div>

        {/* ── Next interview ── */}
        {nextInterview && (
          <button onClick={() => onGoTab?.("calendar")}
            className="w-full bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 text-right active:bg-gray-50 shadow-sm">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
              <Calendar size={18} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">הראיון הקרוב</p>
              <p className="text-gray-900 font-bold text-sm mt-0.5">
                {nextInterview.candidate_name || "מועמד/ת"} ·{" "}
                {new Date(nextInterview.scheduled_at).toLocaleString("he-IL", {
                  weekday: "short", day: "numeric", month: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            <ChevronLeft size={16} className="text-gray-400" />
          </button>
        )}

        {/* ── Position salaries summary ── */}
        {Object.keys(r?.position_salaries || {}).length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-900 font-bold text-sm flex items-center gap-1.5">
                <Briefcase size={14} className="text-gray-500" />שכר לפי תפקיד
              </p>
              <button onClick={() => onGoTab?.("jobs")} className="text-gray-500 text-xs font-semibold flex items-center gap-1 active:text-gray-700">
                ערוך <ChevronLeft size={11} />
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(r.position_salaries).map(([pos, sal]) => (
                <div key={pos} className="flex items-center justify-between border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                  <span className="text-gray-700 text-sm">{pos}</span>
                  <span className="text-gray-900 font-bold text-sm">₪{sal}<span className="text-gray-400 font-normal text-xs">/שעה</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recruitment WhatsApp ── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-900 font-bold text-sm flex items-center gap-1.5">
              <MessageCircle size={14} className="text-green-600" />וואטסאפ לגיוס
            </p>
            {!editingWA && (
              <button onClick={() => setEditingWA(true)}
                className="text-gray-500 text-xs font-semibold flex items-center gap-1">
                <Edit3 size={11} />ערוך
              </button>
            )}
          </div>
          <p className="text-gray-500 text-[11px] mb-3">מועמדים יצרו איתך קשר דרך המספר הזה</p>
          {editingWA ? (
            <div className="flex gap-2">
              <input value={waInput}
                onChange={(e) => setWaInput(normalizePhoneInput(e.target.value))}
                type="tel" inputMode="numeric" maxLength={10} dir="ltr" autoFocus
                placeholder="0501234567"
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900 text-left" />
              <button onClick={saveWhatsApp}
                disabled={!isValidIsraeliPhone(waInput)}
                className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold active:bg-gray-800 disabled:opacity-40">
                שמור
              </button>
              <button onClick={() => { setWaInput(r?.recruitment_whatsapp || r?.phone || ""); setEditingWA(false); }}
                className="bg-gray-100 text-gray-500 px-3 py-2.5 rounded-xl text-sm">✕</button>
            </div>
          ) : (
            <p className="text-gray-900 font-bold text-lg" dir="ltr">
              {r?.recruitment_whatsapp || r?.phone || "—"}
            </p>
          )}
        </div>

        {/* ── Quick links ── */}
        <div className="grid grid-cols-2 gap-2.5">
          <QuickLink icon={<Briefcase size={16} />} label="ניהול משרות" sub={`${totalPositions} משרות`}
            onClick={() => onGoTab?.("jobs")} />
          <QuickLink icon={<Users size={16} />} label="פניות" sub={`${appCount} חדשות`}
            highlight={appCount > 0}
            onClick={() => onGoTab?.("apps")} />
          <QuickLink icon={<Calendar size={16} />} label="ראיונות"
            sub={nextInterview ? "ראיון קרוב" : "אין מתוכננים"}
            onClick={() => onGoTab?.("calendar")} />
          <QuickLink icon={<Sparkles size={16} />} label="קידום פרימיום" sub="הופעה ראשונה בחיפושים"
            onClick={() => onGoTab?.("plans")} />
        </div>
      </div>
    </div>
  );
}

// ── KPI tile ──
function KPI({ label, value, icon, accent = "bg-gray-100 text-gray-700", onClick }) {
  const Wrap = onClick ? "button" : "div";
  return (
    <Wrap onClick={onClick}
      className="bg-white border border-gray-200 rounded-2xl p-3 text-center shadow-sm active:bg-gray-50 transition-colors">
      <div className={`w-7 h-7 rounded-lg ${accent} flex items-center justify-center mx-auto mb-1.5`}>
        {icon}
      </div>
      <p className="text-gray-900 font-black text-xl leading-none">{value}</p>
      <p className="text-gray-500 text-[10px] mt-1 font-semibold">{label}</p>
    </Wrap>
  );
}

// ── Quick link card ──
function QuickLink({ icon, label, sub, onClick, highlight }) {
  return (
    <button onClick={onClick}
      className={`text-right rounded-2xl p-4 border transition-colors ${
        highlight
          ? "bg-brand-50 border-brand-200 active:bg-brand-100"
          : "bg-white border-gray-200 active:bg-gray-50"
      } shadow-sm`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${
        highlight ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-700"
      }`}>
        {icon}
      </div>
      <p className="text-gray-900 font-bold text-sm">{label}</p>
      <p className={`text-xs mt-0.5 ${highlight ? "text-brand-700 font-semibold" : "text-gray-500"}`}>{sub}</p>
    </button>
  );
}
