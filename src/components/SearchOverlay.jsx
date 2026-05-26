import { useState, useEffect, useRef } from "react";
import { Search, X, Users, Briefcase, Calendar, ChevronLeft } from "lucide-react";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Global search overlay.  Searches:
//   • Candidate names (via applications → profiles)
//   • Open positions (restaurant.position_types)
//   • Scheduled interviews
// ─────────────────────────────────────────────────────────────────────────────

export default function SearchOverlay({ restaurant, onClose, onNavigate }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ candidates: [], jobs: [], interviews: [] });
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!restaurant?.id) return;
    if (!q.trim()) { setResults({ candidates: [], jobs: [], interviews: [] }); return; }

    const term = q.trim().toLowerCase();
    setLoading(true);
    let cancelled = false;

    (async () => {
      // 1. Applications + profile name search
      const { data: apps } = await supabase
        .from("applications").select("*")
        .eq("restaurant_id", restaurant.id);
      let candidates = [];
      if (apps?.length) {
        const userIds = [...new Set(apps.map((a) => a.user_id).filter(Boolean))];
        if (userIds.length) {
          const { data: profs } = await supabase
            .from("profiles").select("id, name, city, experience, position_types")
            .in("id", userIds);
          const byId = Object.fromEntries((profs || []).map((p) => [p.id, p]));
          candidates = apps
            .map((a) => ({ ...a, profile: byId[a.user_id] || {} }))
            .filter((a) => {
              const name = a.profile?.name || "";
              const city = a.profile?.city || "";
              return name.toLowerCase().includes(term) || city.toLowerCase().includes(term);
            })
            .slice(0, 8);
        }
      }

      // 2. Positions
      const jobs = (restaurant.position_types || [])
        .filter((p) => p.toLowerCase().includes(term))
        .map((p) => ({ id: p, label: p, salary: restaurant.position_salaries?.[p] }));

      // 3. Interviews
      const { data: ivs } = await supabase
        .from("interviews").select("*")
        .eq("restaurant_id", restaurant.id);
      const interviews = (ivs || [])
        .filter((it) => (it.candidate_name || "").toLowerCase().includes(term))
        .slice(0, 5);

      if (!cancelled) {
        setResults({ candidates, jobs, interviews });
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [q, restaurant?.id]);

  const total = results.candidates.length + results.jobs.length + results.interviews.length;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" dir="rtl">
      {/* Header */}
      <div className="px-4 pt-14 pb-3 flex items-center gap-2 border-b border-gray-100 bg-white">
        <button onClick={onClose}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
          <X size={18} className="text-gray-700" />
        </button>
        <div className="flex-1 bg-gray-100 border border-gray-200 rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
          <Search size={16} className="text-gray-500" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש מועמדים, משרות, ראיונות..."
            className="flex-1 bg-transparent outline-none text-gray-900 text-sm placeholder-gray-500" />
          {q && (
            <button onClick={() => setQ("")} className="text-gray-400 active:text-gray-700">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {!q.trim() ? (
          <EmptyHint />
        ) : loading ? (
          <p className="text-center text-gray-400 text-sm py-10">מחפש...</p>
        ) : total === 0 ? (
          <NoResults q={q} />
        ) : (
          <div className="px-4 py-4 space-y-4">
            {results.candidates.length > 0 && (
              <SectionWrap title="מועמדים" icon={<Users size={13} />}>
                {results.candidates.map((c) => (
                  <ResultCard key={c.id} onClick={() => { onNavigate("apps"); onClose(); }}>
                    <p className="text-gray-900 font-bold text-sm">{c.profile?.name || "מועמד/ת"}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {[c.profile?.city, c.profile?.experience].filter(Boolean).join(" · ")}
                    </p>
                  </ResultCard>
                ))}
              </SectionWrap>
            )}

            {results.jobs.length > 0 && (
              <SectionWrap title="משרות" icon={<Briefcase size={13} />}>
                {results.jobs.map((j) => (
                  <ResultCard key={j.id} onClick={() => { onNavigate("jobs"); onClose(); }}>
                    <p className="text-gray-900 font-bold text-sm">{j.label}</p>
                    {j.salary > 0 && (
                      <p className="text-gray-500 text-xs mt-0.5">₪{j.salary}/שעה</p>
                    )}
                  </ResultCard>
                ))}
              </SectionWrap>
            )}

            {results.interviews.length > 0 && (
              <SectionWrap title="ראיונות" icon={<Calendar size={13} />}>
                {results.interviews.map((it) => (
                  <ResultCard key={it.id} onClick={() => { onNavigate("calendar"); onClose(); }}>
                    <p className="text-gray-900 font-bold text-sm">{it.candidate_name || "מועמד/ת"}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {new Date(it.scheduled_at).toLocaleString("he-IL", {
                        weekday: "short", day: "numeric", month: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </ResultCard>
                ))}
              </SectionWrap>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionWrap({ title, icon, children }) {
  return (
    <div>
      <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-2 px-1 flex items-center gap-1.5">
        {icon}{title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ResultCard({ onClick, children }) {
  return (
    <button onClick={onClick}
      className="w-full bg-white border border-gray-200 rounded-2xl p-3.5 text-right active:bg-gray-50 flex items-center gap-2 shadow-sm">
      <div className="flex-1 min-w-0">{children}</div>
      <ChevronLeft size={14} className="text-gray-400 flex-shrink-0" />
    </button>
  );
}

function EmptyHint() {
  return (
    <div className="px-6 py-10 text-center">
      <div className="w-16 h-16 mx-auto rounded-3xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
        <Search size={24} className="text-gray-400" />
      </div>
      <p className="text-gray-900 font-bold">חיפוש מהיר</p>
      <p className="text-gray-500 text-sm mt-1.5 leading-relaxed max-w-xs mx-auto">
        מצא מועמדים, משרות וראיונות במקום אחד.
      </p>
    </div>
  );
}

function NoResults({ q }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-gray-900 font-bold">לא נמצאו תוצאות עבור "{q}"</p>
      <p className="text-gray-500 text-sm mt-1.5">נסה לחפש בשם של מועמד או תפקיד.</p>
    </div>
  );
}
