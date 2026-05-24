import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Zap, Users, LogOut, TrendingUp, Eye, Bell, ChevronRight, Star, X, MessageCircle, Edit3 } from "lucide-react";

export default function HomeTab({ restaurant: r, onUpdate, onSignOut }) {
  const [appCount, setAppCount]   = useState(0);
  const [toggling, setToggling]   = useState(false);
  const [showTip, setShowTip]     = useState(true);
  const [showPay, setShowPay]     = useState(false);
  const [editingWA, setEditingWA] = useState(false);
  const [waInput, setWaInput]     = useState(r?.recruitment_whatsapp || r?.phone || "");
  const [stats, setStats]         = useState({ views: 0, whatsapp: 0, calls: 0, lastClickAt: null });

  useEffect(() => {
    if (!r?.id) return;
    // Applications (new candidates)
    supabase.from("applications").select("id", { count: "exact", head: true })
      .eq("restaurant_id", r.id).eq("status", "new")
      .then(({ count }) => setAppCount(count || 0));
    // Real-time event stats from restaurant_events
    supabase.from("restaurant_events").select("event_type,created_at")
      .eq("restaurant_id", r.id)
      .then(({ data }) => {
        if (!data) return;
        const s = { views: 0, whatsapp: 0, calls: 0, lastClickAt: null };
        data.forEach(e => {
          if (e.event_type === "click")    s.views++;
          if (e.event_type === "whatsapp") s.whatsapp++;
          if (e.event_type === "call")     s.calls++;
          if (!s.lastClickAt || e.created_at > s.lastClickAt) s.lastClickAt = e.created_at;
        });
        setStats(s);
      });
  }, [r?.id]);

  // Format last activity timestamp
  const lastActivity = stats.lastClickAt ? formatAgo(stats.lastClickAt) : null;

  const toggleActive = async () => {
    setToggling(true);
    const { data } = await supabase.from("restaurants")
      .update({ active: !r.active }).eq("id", r.id).select().single();
    if (data) onUpdate(data);
    setToggling(false);
  };

  const saveWhatsApp = async () => {
    const cleaned = waInput.trim();
    if (cleaned.replace(/\D/g, "").length < 9) return;
    const { data } = await supabase.from("restaurants")
      .update({ recruitment_whatsapp: cleaned, phone: cleaned })
      .eq("id", r.id).select().single();
    if (data) { onUpdate(data); setEditingWA(false); }
  };

  const toggleUrgent = async () => {
    // Off → On: require payment. Off → Off (already off): allow turn off freely.
    if (!r.urgent) {
      setShowPay(true); // show payment modal
      return;
    }
    const { data } = await supabase.from("restaurants")
      .update({ urgent: false }).eq("id", r.id).select().single();
    if (data) onUpdate(data);
  };

  const confirmUrgentPayment = async () => {
    setShowPay(false);
    const { data } = await supabase.from("restaurants")
      .update({ urgent: true }).eq("id", r.id).select().single();
    if (data) onUpdate(data);
  };

  // Generate color initials avatar
  const initials = r?.name?.split(" ").slice(0,2).map(w => w[0]).join("") || "R";

  return (
    <div className="pb-6">
      {/* Hero header */}
      <div className="relative overflow-hidden px-5 pt-14 pb-6"
        style={{ background: "linear-gradient(160deg, #1a0a2e 0%, #0A0A0A 70%)" }}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl translate-y-1/2" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Restaurant avatar */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-brand-500/30 flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium">שלום 👋</p>
              <h1 className="text-white text-lg font-black leading-tight">{r?.name}</h1>
              {r?.city && <p className="text-gray-500 text-xs">{r.city}</p>}
            </div>
          </div>
          <button onClick={onSignOut}
            className="w-9 h-9 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center active:bg-white/10">
            <LogOut size={15} className="text-gray-500" />
          </button>
        </div>
      </div>

      <div className="px-4 space-y-3 -mt-2">
        {/* Listing status card */}
        <div onClick={toggleActive}
          className={`rounded-3xl p-5 cursor-pointer transition-all duration-300 active:scale-[0.98] ${
            r?.active
              ? "bg-gradient-to-br from-brand-500 via-brand-500 to-brand-600 shadow-xl shadow-brand-500/30"
              : "bg-[#161616] border border-white/5"
          }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {r?.active && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-50" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                  </span>
                )}
                <p className={`text-xs font-semibold uppercase tracking-wide ${r?.active ? "text-white/70" : "text-gray-500"}`}>
                  {r?.active ? "מודעה פעילה" : "מודעה כבויה"}
                </p>
              </div>
              <p className={`text-2xl font-black ${r?.active ? "text-white" : "text-gray-300"}`}>
                {r?.active ? "מגייסים עכשיו ✓" : "לחץ להפעלה"}
              </p>
              {r?.active && (
                <p className="text-white/60 text-xs mt-1">המודעה שלך גלויה למועמדים</p>
              )}
            </div>
            {/* Toggle */}
            <div className={`w-14 h-8 rounded-full transition-all duration-300 flex items-center px-1 ${
              r?.active ? "bg-white/30" : "bg-white/10"
            }`} style={{ opacity: toggling ? 0.6 : 1 }}>
              <div className={`w-6 h-6 rounded-full shadow-md transition-all duration-300 ${
                r?.active ? "translate-x-6 bg-white" : "translate-x-0 bg-gray-500"
              }`} />
            </div>
          </div>

          {/* Tags */}
          <div className="flex gap-2 flex-wrap mt-3">
            <Tag active={r?.active} label={`₪${r?.hourly_rate}/שעה`} />
            <Tag active={r?.active} label={`${r?.open_positions || 0} משרות`} />
            {r?.type && <Tag active={r?.active} label={r.type} />}
          </div>
        </div>

        {/* Analytics — real-time numbers */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">📊 פעילות במודעה</p>
            {lastActivity && (
              <p className="text-gray-500 text-[10px]">פעילות אחרונה: {lastActivity}</p>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <AnalyticsCard
              icon={<Eye size={14} className="text-blue-400" />}
              value={stats.views}
              label="צפיות"
              accent="blue"
            />
            <AnalyticsCard
              icon={<MessageCircle size={14} className="text-green-400" />}
              value={stats.whatsapp}
              label="WhatsApp"
              accent="green"
              highlight={stats.whatsapp > 0}
            />
            <AnalyticsCard
              icon={<Users size={14} className="text-brand-400" />}
              value={appCount}
              label="חדשות"
              accent="brand"
              highlight={appCount > 0}
            />
            <AnalyticsCard
              icon={<TrendingUp size={14} className="text-purple-400" />}
              value={r?.position_types?.length || 0}
              label="תפקידים"
              accent="purple"
            />
          </div>
        </div>

        {/* Position salaries */}
        {r?.position_salaries && Object.keys(r.position_salaries).length > 0 && (
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">שכר לפי תפקיד</p>
            <div className="space-y-2">
              {Object.entries(r.position_salaries).map(([pos, sal]) => (
                <div key={pos} className="flex items-center justify-between bg-white/3 rounded-xl px-3 py-2">
                  <span className="text-white text-sm font-medium">{pos}</span>
                  <span className="text-brand-400 font-black text-sm">₪{sal}<span className="text-gray-500 text-[10px] font-normal">/שעה</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WhatsApp recruitment number */}
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center">
              <MessageCircle size={16} className="text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide">וואטסאפ לגיוס</p>
              <p className="text-gray-400 text-[10px]">מועמדים יצרו איתך קשר כאן</p>
            </div>
            {!editingWA && (
              <button onClick={() => setEditingWA(true)}
                className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center active:bg-white/10">
                <Edit3 size={13} className="text-gray-400" />
              </button>
            )}
          </div>
          {editingWA ? (
            <div className="flex gap-2">
              <input value={waInput} onChange={e => setWaInput(e.target.value)}
                type="tel" placeholder="050-1234567"
                autoFocus
                className="flex-1 bg-white/5 text-white placeholder-gray-500 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500/40 border border-white/5" />
              <button onClick={saveWhatsApp}
                className="bg-green-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold active:bg-green-600">
                שמור
              </button>
              <button onClick={() => { setWaInput(r?.recruitment_whatsapp || r?.phone || ""); setEditingWA(false); }}
                className="bg-white/10 text-gray-400 px-3 py-2.5 rounded-xl text-sm">
                ✕
              </button>
            </div>
          ) : (
            <p className="text-white font-bold text-lg" dir="ltr">
              {r?.recruitment_whatsapp || r?.phone || "—"}
            </p>
          )}
        </div>

        {/* Active shifts */}
        {r?.shifts?.length > 0 && (
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2.5">משמרות פתוחות</p>
            <div className="flex flex-wrap gap-2">
              {r.shifts.map(s => (
                <span key={s}
                  className="bg-brand-500/15 text-brand-400 text-xs px-3 py-1.5 rounded-full font-semibold border border-brand-500/20">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="space-y-2">
          {/* Urgent toggle */}
          <ActionRow
            onClick={toggleUrgent}
            active={r?.urgent}
            activeClass="bg-red-500/10 border-red-500/25"
            inactiveClass="bg-[#161616] border-white/5"
            icon={<Zap size={18} className={r?.urgent ? "text-red-400" : "text-gray-500"} fill={r?.urgent ? "#f87171" : "none"} />}
            title="גיוס דחוף"
            subtitle={r?.urgent ? "פעיל · תגית אדומה · חשיפה ×4" : "חשיפה ×4 · ₪29 חד-פעמי"}
            titleClass={r?.urgent ? "text-red-300" : "text-gray-300"}
            right={!r?.urgent
              ? <span className="text-[10px] bg-yellow-400 text-black px-2 py-0.5 rounded-full font-black">₪29</span>
              : <div className="w-5 h-5 rounded-full border-2 bg-red-500 border-red-500 flex items-center justify-center"><span className="text-white text-[10px] font-black">✓</span></div>
            }
          />

          {/* Notifications row */}
          <ActionRow
            onClick={() => {}}
            active={false}
            activeClass=""
            inactiveClass="bg-[#161616] border-white/5"
            icon={<Bell size={18} className="text-gray-500" />}
            title="התראות WhatsApp"
            subtitle="קבל הודעה כשמישהו נרשם"
            titleClass="text-gray-300"
            right={<span className="text-[10px] bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full font-bold">בקרוב</span>}
          />
        </div>

        {/* Payment sheet */}
        {showPay && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={() => setShowPay(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-[#1a1a1a] rounded-t-3xl p-6 pb-8 border-t border-white/10 animate-[slideUp_0.3s_ease-out]"
              onClick={e => e.stopPropagation()}
              style={{ animation: "slideUp 0.3s ease-out both" }}>
              <button onClick={() => setShowPay(false)}
                className="absolute top-4 left-4 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                <X size={14} className="text-gray-400" />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-2xl mb-4 shadow-lg shadow-red-500/30">🚨</div>
              <h2 className="text-white text-2xl font-black">גיוס דחוף</h2>
              <p className="text-gray-400 text-sm mt-1 leading-relaxed">המודעה תופיע ראשונה בחיפוש עם תגית אדומה בולטת — חשיפה גבוהה פי 4</p>

              <div className="bg-white/5 rounded-2xl p-4 my-5 border border-white/5">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-gray-400 text-sm">סה״כ לתשלום</span>
                  <span className="text-white text-3xl font-black">₪29<span className="text-gray-500 text-xs font-normal mr-1">חד-פעמי</span></span>
                </div>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <Bullet>תגית "🚨 דחוף" אדומה</Bullet>
                  <Bullet>מודעה עליונה בחיפוש</Bullet>
                  <Bullet>חשיפה ×4 ממודעה רגילה</Bullet>
                  <Bullet>פעיל ל-7 ימים</Bullet>
                </div>
              </div>

              <button onClick={confirmUrgentPayment}
                className="w-full bg-gradient-to-l from-red-500 to-orange-500 text-white font-black py-4 rounded-2xl text-base active:opacity-80 shadow-lg shadow-red-500/30 mb-2">
                שלם ₪29 והפעל
              </button>
              <p className="text-center text-[10px] text-gray-600">
                🔒 תשלום מאובטח · משולם · ביטול בכל עת
              </p>
              <p className="text-center text-[10px] text-yellow-400 mt-1">
                ⚡ בקרוב — לעת עתה נפעיל ידנית
              </p>
            </div>
            <style>{`
              @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>
          </div>
        )}

        {/* Tip card */}
        {showTip && (
          <div className="bg-gradient-to-br from-brand-500/10 to-purple-500/10 border border-brand-500/20 rounded-2xl p-4 relative">
            <button onClick={() => setShowTip(false)}
              className="absolute top-3 left-3 text-gray-600 hover:text-gray-400 text-lg leading-none">×</button>
            <div className="flex items-start gap-3">
              <Star size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" fill="#facc15" />
              <div>
                <p className="text-white font-bold text-sm mb-1">טיפ לשיפור הגיוס</p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  מסעדות שמוסיפות הטבות ומפרטות שכר מקבלות פי 4 יותר פניות מהממוצע.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Bullet({ children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-green-400 flex-shrink-0">✓</span>
      <span>{children}</span>
    </div>
  );
}

function Tag({ active, label }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
      active ? "bg-white/20 text-white" : "bg-white/5 text-gray-500"
    }`}>
      {label}
    </span>
  );
}

function StatCard({ icon, value, label, accent, highlight, isText }) {
  return (
    <div className={`rounded-2xl p-3.5 border transition-all ${
      highlight
        ? "bg-brand-500/10 border-brand-500/30"
        : "bg-[#161616] border-white/5"
    }`}>
      <div className="mb-2">{icon}</div>
      <p className={`font-black leading-tight ${isText ? "text-base" : "text-2xl"} text-white`}>{value}</p>
      <p className="text-gray-500 text-[10px] mt-0.5 font-medium">{label}</p>
    </div>
  );
}

function AnalyticsCard({ icon, value, label, accent, highlight }) {
  const accentBg = {
    blue:    highlight ? "bg-blue-500/10 border-blue-500/30"     : "bg-[#161616] border-white/5",
    green:   highlight ? "bg-green-500/10 border-green-500/30"   : "bg-[#161616] border-white/5",
    brand:   highlight ? "bg-brand-500/10 border-brand-500/30"   : "bg-[#161616] border-white/5",
    purple:  highlight ? "bg-purple-500/10 border-purple-500/30" : "bg-[#161616] border-white/5",
  }[accent] || "bg-[#161616] border-white/5";

  return (
    <div className={`rounded-2xl p-2.5 border transition-all ${accentBg} relative overflow-hidden`}>
      <div className="flex items-center gap-1 mb-1.5">{icon}</div>
      <p className="font-black text-xl leading-none text-white">{value}</p>
      <p className="text-gray-500 text-[9px] mt-1 font-semibold uppercase tracking-wide">{label}</p>
      {highlight && (
        <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-current"
          style={{ color: accent === "green" ? "#4ade80" : accent === "brand" ? "#60a5fa" : "#a78bfa" }} />
      )}
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
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

function ActionRow({ onClick, activeClass, inactiveClass, icon, title, subtitle, titleClass, checked, checkColor, right }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors active:scale-[0.98] text-right ${activeClass || inactiveClass}`}
      style={{ WebkitTapHighlightColor: "transparent" }}>
      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm ${titleClass}`}>{title}</p>
        <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>
      </div>
      {right || (
        checked !== undefined && (
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${checkColor}`}>
            {checked && <span className="text-white text-[10px] font-black">✓</span>}
          </div>
        )
      )}
    </button>
  );
}
