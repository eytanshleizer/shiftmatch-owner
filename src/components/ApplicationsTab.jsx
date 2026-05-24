import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Phone, MapPin, Clock, Loader2, ChevronRight, ArrowRight } from "lucide-react";

const STATUS = {
  new:       { label: "חדש",  cls: "bg-brand-500/20 text-brand-400 border-brand-500/30" },
  viewed:    { label: "נצפה", cls: "bg-white/8 text-gray-400 border-white/10" },
  contacted: { label: "פנית", cls: "bg-green-500/20 text-green-400 border-green-500/30" },
};

// Generate a color based on name
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
  return name.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase();
}

export default function ApplicationsTab({ restaurant }) {
  const [apps, setApps]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!restaurant?.id) return;
    supabase.from("applications")
      .select("*, profile:profiles(*)")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setApps(data || []); setLoading(false); });
  }, [restaurant?.id]);

  const open = async (app) => {
    if (app.status === "new") {
      await supabase.from("applications").update({ status: "viewed" }).eq("id", app.id);
      setApps(prev => prev.map(a => a.id === app.id ? { ...a, status: "viewed" } : a));
    }
    setSelected(app);
  };

  const contact = async (app) => {
    await supabase.from("applications").update({ status: "contacted" }).eq("id", app.id);
    setApps(prev => prev.map(a => a.id === app.id ? { ...a, status: "contacted" } : a));
  };

  if (loading) return (
    <div className="px-4 pt-14 pb-6 space-y-3">
      {[0,1,2].map(i => (
        <div key={i} className="bg-[#161616] border border-white/5 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-white/5 rounded w-1/2" />
            <div className="h-2.5 bg-white/5 rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );

  if (selected) {
    const p = selected.profile || {};
    const wa = p.phone
      ? `https://wa.me/972${p.phone.replace(/\D/g,"").replace(/^0/,"")}?text=${encodeURIComponent(`היי ${p.name}! ראיתי את הפניה שלך ל${restaurant?.name} ב-ShiftMatch 😊`)}`
      : null;

    return (
      <div className="pb-6">
        {/* Header */}
        <div className="px-4 pt-14 pb-4 flex items-center gap-3">
          <button onClick={() => setSelected(null)}
            className="w-9 h-9 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center active:bg-white/10">
            <ArrowRight size={16} className="text-gray-400" />
          </button>
          <span className="text-white font-bold">פרופיל מועמד</span>
        </div>

        <div className="px-4 space-y-3">
          {/* Profile card */}
          <div className="bg-[#161616] border border-white/5 rounded-3xl p-5">
            <div className="flex items-center gap-4 mb-5">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor(p.name)} flex items-center justify-center font-black text-white text-xl shadow-lg flex-shrink-0`}>
                {initials(p.name)}
              </div>
              <div>
                <h2 className="text-white font-black text-xl">{p.name || "מועמד"}</h2>
                {p.city && (
                  <p className="text-gray-400 text-sm flex items-center gap-1 mt-0.5">
                    <MapPin size={12}/>{p.city}
                  </p>
                )}
                <span className={`inline-block mt-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${STATUS[selected.status]?.cls || STATUS.new.cls}`}>
                  {STATUS[selected.status]?.label || "חדש"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {p.experience && <DetailTile label="ניסיון" value={p.experience} />}
              {p.min_hourly_rate > 0 && <DetailTile label="ציפיית שכר" value={`₪${p.min_hourly_rate}/שעה`} />}
            </div>
          </div>

          {p.shifts?.length > 0 && (
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                <Clock size={11} />משמרות מועדפות
              </p>
              <div className="flex flex-wrap gap-2">
                {p.shifts.map(s => (
                  <span key={s} className="bg-brand-500/15 text-brand-400 text-xs px-3 py-1.5 rounded-full font-semibold border border-brand-500/20">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex gap-2.5 pt-1">
            {p.phone && (
              <a href={`tel:${p.phone}`} onClick={() => contact(selected)}
                className="flex-1 bg-brand-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:bg-brand-600 shadow-lg shadow-brand-500/25 text-sm">
                <Phone size={16}/>התקשר/י
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" onClick={() => contact(selected)}
                className="flex-1 bg-[#25D366] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:opacity-80 shadow-lg shadow-green-500/20 text-sm">
                <span className="text-base">💬</span> WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!apps.length) return (
    <div className="flex flex-col items-center justify-center py-28 text-center px-8">
      <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-4xl mb-5">📭</div>
      <p className="text-white font-black text-xl">אין פניות עדיין</p>
      <p className="text-gray-500 text-sm mt-2 leading-relaxed">
        ברגע שמועמדים יפנו דרך האפליקציה<br/>הם יופיעו כאן
      </p>
    </div>
  );

  const newCount = apps.filter(a => a.status === "new").length;

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center justify-between">
        <h2 className="text-white font-black text-xl">פניות</h2>
        {newCount > 0 && (
          <span className="bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-brand-500/30">
            {newCount} חדשות
          </span>
        )}
      </div>

      <div className="px-4 space-y-2.5">
        {apps.map(app => {
          const p = app.profile || {};
          const s = STATUS[app.status] || STATUS.new;
          const isNew = app.status === "new";
          const ago = formatAgo(app.created_at);
          return (
            <div key={app.id} onClick={() => open(app)}
              className={`rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer border relative overflow-hidden ${
                isNew ? "bg-brand-500/5 border-brand-500/20" : "bg-[#161616] border-white/5"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {isNew && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-brand-400">
                  <span className="absolute inset-0 rounded-full bg-brand-400 animate-ping" />
                </span>
              )}
              {/* Avatar */}
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarColor(p.name)} flex items-center justify-center font-bold text-white text-base flex-shrink-0 shadow-md`}>
                {initials(p.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white font-bold text-sm">{p.name || "מועמד"}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${s.cls}`}>{s.label}</span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5 truncate">
                  {p.experience || ""}
                  {p.city ? ` · ${p.city}` : ""}
                  {p.min_hourly_rate > 0 ? ` · ₪${p.min_hourly_rate}/שעה` : ""}
                </p>
                {ago && <p className="text-gray-600 text-[10px] mt-1">⏱ {ago}</p>}
              </div>
              <ChevronRight size={15} className="text-gray-600 flex-shrink-0" />
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
    <div className="bg-white/4 rounded-xl p-3 border border-white/5">
      <p className="text-gray-500 text-xs mb-0.5 font-medium">{label}</p>
      <p className="text-white font-bold text-sm">{value}</p>
    </div>
  );
}
