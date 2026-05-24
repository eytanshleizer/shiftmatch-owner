import { useState, useEffect } from "react";
import { Users, Store, Download, RefreshCw, Search, MessageCircle, TrendingUp, Eye, Phone } from "lucide-react";

const ADMIN_KEY = "shiftmatch-admin-2026";

export default function AdminDashboard() {
  const [data, setData]       = useState(null);
  const [diag, setDiag]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("waiters");
  const [search, setSearch]   = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [resData, resDiag] = await Promise.all([
        fetch(`/api/admin-dashboard?key=${ADMIN_KEY}`).then(r => r.json()),
        fetch(`/api/admin-diagnose?key=${ADMIN_KEY}`).then(r => r.json()),
      ]);
      setData(resData);
      setDiag(resDiag);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const waiters = (data?.waiters || []).filter(w =>
    !search ||
    (w.name?.includes(search) || w.email?.includes(search) || w.city?.includes(search) || w.phone?.includes(search))
  );
  const restaurants = (data?.restaurants || []).filter(r =>
    !search ||
    (r.restaurant_name?.includes(search) || r.owner_name?.includes(search) || r.city?.includes(search))
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black mb-1">📊 ShiftMatch — Admin Dashboard</h1>
            <p className="text-gray-500 text-sm">Auto-refreshes every 30s</p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
            diag?.ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          }`}>
            <span className={`w-2 h-2 rounded-full ${diag?.ok ? "bg-green-400" : "bg-red-400 animate-pulse"}`} />
            {diag?.ok ? "All systems OK" : (diag?.summary || "Issues found")}
          </div>
        </div>

        {/* Setup diagnostic banner — shown when issues */}
        {diag && !diag.ok && (
          <div className="bg-gradient-to-br from-red-500/15 to-orange-500/10 border-2 border-red-500/40 rounded-3xl p-5 mb-6">
            <h2 className="text-xl font-black text-red-400 mb-1">⚙️ One-time database setup needed</h2>
            <p className="text-gray-300 text-sm mb-4">
              Your Supabase database is missing 2 tables. <b>This takes 15 seconds</b> — Supabase's security requires you to run this yourself.
            </p>

            <div className="bg-black/30 rounded-2xl p-4 mb-4">
              <p className="text-white font-bold text-sm mb-3">Follow these 3 steps:</p>
              <div className="space-y-3">
                <SetupStep number={1} title="Copy the SQL"
                  action={<button onClick={async () => {
                    await navigator.clipboard.writeText(diag.fix_sql || "");
                    alert("✓ SQL copied to clipboard");
                  }}
                  className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl text-xs font-bold w-full">
                    📋 Copy SQL to clipboard
                  </button>} />
                <SetupStep number={2} title="Open Supabase & paste"
                  action={<a href="https://supabase.com/dashboard/project/huwcyedlbcrugpbdcsdo/sql/new"
                    target="_blank" rel="noreferrer"
                    className="block bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold text-center">
                    🔗 Open SQL Editor (paste with ⌘V, click Run)
                  </a>} />
                <SetupStep number={3} title="Verify it worked"
                  action={<button onClick={load}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold w-full">
                    🔄 Click to re-check
                  </button>} />
              </div>
            </div>

            <details className="text-xs text-gray-400">
              <summary className="cursor-pointer hover:text-gray-300">Show me what's missing (technical details)</summary>
              <div className="mt-3 space-y-1.5">
                {diag.checks.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={c.pass ? "text-green-400" : "text-red-400"}>{c.pass ? "✓" : "✗"}</span>
                    <span className="text-gray-300 font-semibold">{c.step}:</span>
                    <span className="text-gray-500">{c.details}</span>
                  </div>
                ))}
              </div>
            </details>

            <details className="text-xs text-gray-400 mt-2">
              <summary className="cursor-pointer hover:text-gray-300">Show me the SQL (optional preview)</summary>
              <pre className="bg-black/50 rounded-xl p-3 text-[10px] text-gray-300 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre mt-2">
                {diag.fix_sql}
              </pre>
            </details>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="מועמדים" value={data?.counts?.waiters || 0} icon={<Users size={18} className="text-brand-400"/>} />
          <StatCard label="מסעדות" value={data?.counts?.restaurants || 0} icon={<Store size={18} className="text-purple-400"/>} sub={`${data?.counts?.owned_restaurants || 0} עם בעלים`} />
          <StatCard label="צפיות 👁️" value={data?.counts?.total_views || 0} icon={<Eye size={18} className="text-blue-400"/>} sub="לחיצות על מסעדה" />
          <StatCard label="WhatsApp 💬" value={data?.counts?.total_whatsapp_clicks || 0} icon={<MessageCircle size={18} className="text-green-400"/>} />
          <StatCard label="התקשרויות 📞" value={data?.counts?.total_call_clicks || 0} icon={<Phone size={18} className="text-orange-400"/>} />
        </div>

        {/* Service key warning */}
        {!data?.using_service_key && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 mb-4 text-xs text-yellow-300">
            ⚠️ Running without SUPABASE_SERVICE_KEY — login timestamps + emails may be empty. Add it to Vercel env for full data.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <TabBtn active={tab === "waiters"} onClick={() => setTab("waiters")} icon={<Users size={14}/>}>
            מועמדים ({waiters.length})
          </TabBtn>
          <TabBtn active={tab === "restaurants"} onClick={() => setTab("restaurants")} icon={<Store size={14}/>}>
            מסעדות ({restaurants.length})
          </TabBtn>
          <TabBtn active={tab === "popular"} onClick={() => setTab("popular")} icon={<TrendingUp size={14}/>}>
            הכי פופולריות ({(data?.top_restaurants || []).length})
          </TabBtn>
          <div className="flex-1" />
          <button onClick={load} className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5">
            <RefreshCw size={12} /> רענן
          </button>
          <button onClick={() => exportCSV(tab === "waiters" ? waiters : restaurants, tab)}
            className="bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5">
            <Download size={12} /> CSV
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם / אימייל / עיר..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pr-9 pl-4 text-sm placeholder-gray-500 outline-none focus:border-brand-500" />
        </div>

        {/* Tables */}
        {tab === "waiters"     && <WaitersTable rows={waiters} />}
        {tab === "restaurants" && <RestaurantsTable rows={restaurants} />}
        {tab === "popular"     && <PopularTable rows={data?.top_restaurants || []} />}
      </div>
    </div>
  );
}

function SetupStep({ number, title, action }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0">
        {number}
      </div>
      <div className="flex-1">
        <p className="text-white text-xs font-semibold mb-1.5">{title}</p>
        {action}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, sub }) {
  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-400">{label}</span></div>
      <p className="text-3xl font-black">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold ${
        active ? "bg-brand-500 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
      }`}>
      {icon}{children}
    </button>
  );
}

function WaitersTable({ rows }) {
  if (!rows.length) return <Empty msg="אין מועמדים עדיין" />;
  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-white/5">
          <tr>
            <Th>שם</Th><Th>אימייל</Th><Th>טלפון</Th><Th>עיר</Th><Th>תפקידים</Th>
            <Th>ניסיון</Th><Th>שכר מינ׳</Th><Th>משמרות</Th><Th>הודעות נשלחו</Th>
            <Th>נרשם</Th><Th>כניסה אחרונה</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(w => (
            <tr key={w.user_id} className="border-t border-white/5 hover:bg-white/2">
              <Td className="font-bold text-white">{w.name}</Td>
              <Td>{w.email}</Td>
              <Td className="font-mono">{w.phone}</Td>
              <Td>{w.city}</Td>
              <Td>{w.position_types?.join(", ") || "—"}</Td>
              <Td>{w.experience}</Td>
              <Td>{w.min_hourly_rate ? `₪${w.min_hourly_rate}` : "—"}</Td>
              <Td>{w.shifts?.join(", ") || "—"}</Td>
              <Td className="text-center font-bold text-brand-400">{w.total_messages_sent}</Td>
              <Td>{fmtDate(w.signed_up_at)}</Td>
              <Td>{fmtDate(w.last_login_at)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RestaurantsTable({ rows }) {
  if (!rows.length) return <Empty msg="אין מסעדות עדיין" />;
  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-white/5">
          <tr>
            <Th>מסעדה</Th><Th>בעל/ת</Th><Th>עיר</Th>
            <Th className="text-blue-400">👁️ צפיות</Th>
            <Th className="text-green-400">💬 WhatsApp</Th>
            <Th className="text-orange-400">📞 שיחות</Th>
            <Th>מועמדים שונים</Th>
            <Th>אינטראקציה אחרונה</Th>
            <Th>שכר</Th><Th>משרות</Th><Th>פעיל</Th>
            <Th>נרשם</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.restaurant_id} className="border-t border-white/5 hover:bg-white/2">
              <Td className="font-bold text-white">
                {r.restaurant_name}
                {r.is_seeded && <span className="ml-1 text-[9px] text-gray-500">(seeded)</span>}
              </Td>
              <Td>{r.owner_name}</Td>
              <Td>{r.city}</Td>
              <Td className="text-center text-blue-400 font-bold">{r.total_views || 0}</Td>
              <Td className="text-center text-green-400 font-bold">{r.total_whatsapp_clicks || 0}</Td>
              <Td className="text-center text-orange-400 font-bold">{r.total_call_clicks || 0}</Td>
              <Td className="text-center">{r.unique_waiters_clicked || 0}</Td>
              <Td>{r.last_click_at ? fmtDate(r.last_click_at) : "—"}</Td>
              <Td>{r.hourly_rate ? `₪${r.hourly_rate}` : "—"}</Td>
              <Td>{r.open_positions || "—"}</Td>
              <Td>{r.active ? "✓" : "✗"}</Td>
              <Td>{fmtDate(r.signed_up_at)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PopularTable({ rows }) {
  if (!rows.length) return <Empty msg="עדיין אין אינטראקציות" />;
  const max = Math.max(...rows.map(r => r.total_interactions || 0), 1);
  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-white/5">
          <tr>
            <Th>דירוג</Th>
            <Th>מסעדה</Th>
            <Th>עיר</Th>
            <Th className="text-blue-400">👁️ צפיות</Th>
            <Th className="text-green-400">💬 WhatsApp</Th>
            <Th className="text-orange-400">📞 שיחות</Th>
            <Th>סה״כ</Th>
            <Th>פופולריות</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pct = Math.round(((r.total_interactions || 0) / max) * 100);
            return (
              <tr key={r.restaurant_id} className="border-t border-white/5 hover:bg-white/2">
                <Td>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-xs ${
                    i === 0 ? "bg-yellow-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-orange-700" : "bg-white/10"
                  }`}>
                    {i + 1}
                  </div>
                </Td>
                <Td className="font-bold text-white">{r.restaurant_name}</Td>
                <Td>{r.city}</Td>
                <Td className="text-center text-blue-400 font-bold">{r.total_views || 0}</Td>
                <Td className="text-center text-green-400 font-bold">{r.total_whatsapp_clicks || 0}</Td>
                <Td className="text-center text-orange-400 font-bold">{r.total_call_clicks || 0}</Td>
                <Td className="text-center text-white font-black">{r.total_interactions || 0}</Td>
                <Td className="w-40">
                  <div className="bg-white/5 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-l from-brand-400 to-green-600 h-full rounded-full"
                      style={{ width: `${pct}%` }} />
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }) {
  return <th className="text-right px-3 py-2.5 font-semibold text-gray-400 whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-2.5 text-gray-300 whitespace-nowrap ${className}`}>{children}</td>;
}
function Empty({ msg }) {
  return <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-gray-500 text-sm">{msg}</div>;
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  const now = new Date();
  const diffMin = Math.floor((now - dt) / 60000);
  if (diffMin < 60) return `${diffMin} ד׳`;
  if (diffMin < 1440) return `${Math.floor(diffMin/60)} שעות`;
  return dt.toLocaleDateString("he-IL");
}

function exportCSV(rows, type) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map(r => keys.map(k => {
      const v = r[k];
      if (Array.isArray(v)) return `"${v.join(" / ")}"`;
      if (typeof v === "string" && v.includes(",")) return `"${v.replace(/"/g, '""')}"`;
      return v ?? "";
    }).join(",")),
  ].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shiftmatch-${type}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
