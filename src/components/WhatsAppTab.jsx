import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, MessageCircle, MapPin, ChevronRight } from "lucide-react";

export default function WhatsAppTab({ restaurant }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);

  useEffect(() => {
    supabase.from("whatsapp_candidates")
      .select("*").in("status", ["complete", "matched"])
      .order("created_at", { ascending: false })
      .then(({ data }) => { setCandidates(data || []); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="text-brand-400 animate-spin" /></div>;

  if (selected) {
    const c = selected;
    const waNum = c.phone?.replace(/\D/g,"").replace(/^0/,"972");
    const waMsg = `היי ${c.name || ""}! ראיתי את הפרופיל שלך ב-ShiftMatch, אשמח לדבר על עבודה ב${restaurant?.name} 😊`;
    const waLink = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}` : null;

    return (
      <div className="px-4 pt-14 pb-6">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-brand-400 text-sm mb-4">
          <ChevronRight size={16} />חזרה
        </button>
        <div className="bg-[#1E1E1E] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center text-2xl">🤖</div>
            <div>
              <h2 className="text-white font-bold text-lg">{c.name || "מועמד"}</h2>
              {c.city && <p className="text-gray-400 text-sm flex items-center gap-1"><MapPin size={11}/>{c.city}</p>}
              <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">רואיין ע״י AI</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {c.age > 0 && <Tile label="גיל" value={`${c.age}`} />}
            {c.experience_years > 0 && <Tile label="ניסיון" value={`${c.experience_years} שנים`} />}
            {c.expected_hourly > 0 && <Tile label="ציפיות שכר" value={`₪${c.expected_hourly}/שעה`} />}
            <Tile label="רכב" value={c.has_car ? "✅ יש" : "❌ אין"} />
          </div>

          {c.shifts?.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs mb-2">משמרות זמינות</p>
              <div className="flex flex-wrap gap-1.5">
                {c.shifts.map(s => <span key={s} className="bg-brand-500/20 text-brand-400 text-xs px-2.5 py-1 rounded-full">{s}</span>)}
              </div>
            </div>
          )}

          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer"
              className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:bg-green-600 text-sm">
              <MessageCircle size={18}/>צור קשר בוואטסאפ
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!candidates.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="text-6xl mb-4">🤖</div>
      <p className="text-white font-bold text-lg">עדיין אין מועמדים מה-AI</p>
      <p className="text-gray-500 text-sm mt-1 max-w-xs">כשה-AI יסיים לרייין מועמדים בוואטסאפ — הם יופיעו כאן</p>
    </div>
  );

  return (
    <div className="px-4 pt-14 pb-6 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-white font-bold text-lg">מועמדי AI</h2>
        <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2.5 py-1 rounded-full">{candidates.length} זמינים</span>
      </div>
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-xs text-green-400">
        🤖 המועמדים האלה עברו ראיון AI מלא בוואטסאפ
      </div>
      {candidates.map(c => (
        <div key={c.id} onClick={() => setSelected(c)}
          className="bg-[#1E1E1E] rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer">
          <div className="w-11 h-11 rounded-xl bg-green-500/20 flex items-center justify-center text-xl flex-shrink-0">🤖</div>
          <div className="flex-1 min-w-0">
            <span className="text-white font-semibold text-sm">{c.name || "מועמד"}</span>
            <p className="text-gray-500 text-xs mt-0.5">{c.city || ""}{c.experience_years ? ` · ${c.experience_years} שנות ניסיון` : ""}</p>
            <p className="text-green-400 text-[10px] mt-0.5">₪{c.expected_hourly || "?"}/שעה · {c.has_car ? "🚗" : "🚶"}</p>
          </div>
          <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="bg-white/5 rounded-xl p-3">
      <p className="text-gray-500 text-xs mb-0.5">{label}</p>
      <p className="text-white font-semibold text-sm">{value}</p>
    </div>
  );
}
