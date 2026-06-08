import {
  TrendingUp, TrendingDown, Eye, Users, Calendar, CheckCircle2,
  Clock, Sparkles, Lightbulb, ArrowLeft, Banknote, Flame, Info
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// INSIGHTS DEMO — preview-only mockups for two proposed features:
//   #7  "תובנות הגיוס" — analytics dashboard (funnel, time-to-hire, salary benchmark)
//   #8  "המלצה חכמה"   — recommendation: a job poster that SHOWS the salary gets
//                        far more attention (A/B poster comparison)
// Reached via ?demo=insights. Static sample data — not wired to production.
// ─────────────────────────────────────────────────────────────────────────────

export default function InsightsDemo() {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 text-gray-900 pb-12" dir="rtl">
      {/* Header */}
      <div className="px-5 pt-10 pb-5 bg-white border-b border-gray-100">
        <p className="text-brand-600 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles size={13} /> דמו · תצוגה מקדימה
        </p>
        <h1 className="text-2xl font-black tracking-tight mt-1">תובנות הגיוס שלך</h1>
        <p className="text-gray-400 text-xs mt-1">מסעדת הדגמה · תל אביב · 30 הימים האחרונים</p>
      </div>

      <div className="px-4 pt-4 space-y-6">
        <Section7 />
        <Section8 />
      </div>
    </div>
  );
}

/* ════════════════════════ #7 · ANALYTICS DASHBOARD ════════════════════════ */
function Section7() {
  return (
    <div className="space-y-3">
      <SectionLabel num="7" title="תובנות הגיוס" />

      {/* Funnel */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
        <p className="text-gray-900 font-bold text-sm mb-4 flex items-center gap-1.5">
          <TrendingUp size={15} className="text-brand-600" /> משפך הגיוס
        </p>
        <div className="space-y-2.5">
          <FunnelRow icon={<Eye size={15} />}        label="צפיות במודעה" value={412} pct={100} color="bg-brand-500" />
          <FunnelRow icon={<Users size={15} />}      label="פניות"        value={58}  pct={14}  color="bg-brand-400" drop="14%" />
          <FunnelRow icon={<Calendar size={15} />}   label="ראיונות"      value={19}  pct={33}  color="bg-emerald-400" drop="33%" />
          <FunnelRow icon={<CheckCircle2 size={15} />} label="גויסו"       value={6}   pct={32}  color="bg-emerald-600" drop="32%" />
        </div>
      </div>

      {/* Two metric tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center mb-2">
            <Clock size={16} className="text-blue-600" />
          </div>
          <p className="text-2xl font-black leading-none">4.2<span className="text-sm font-bold text-gray-400"> ימים</span></p>
          <p className="text-gray-500 text-[11px] mt-1 font-semibold">זמן ממוצע עד גיוס</p>
          <p className="text-emerald-600 text-[10px] mt-1.5 font-bold flex items-center gap-0.5">
            <TrendingDown size={11} /> מהיר ב-1.3 ימים מהחודש שעבר
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center mb-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black leading-none">10.3<span className="text-sm font-bold text-gray-400">%</span></p>
          <p className="text-gray-500 text-[11px] mt-1 font-semibold">פנייה → גיוס</p>
          <p className="text-gray-400 text-[10px] mt-1.5 font-bold flex items-center gap-0.5">
            <Info size={11} /> ממוצע בענף: 8%
          </p>
        </div>
      </div>

      {/* Salary benchmark */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <p className="text-gray-900 font-bold text-sm flex items-center gap-1.5">
            <Banknote size={15} className="text-amber-500" /> בנצ'מארק שכר · מלצר/ית
          </p>
          <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
            מתחת לממוצע
          </span>
        </div>
        <p className="text-gray-400 text-[11px] mb-4">לעומת מסעדות דומות באזורך</p>

        <BenchBar label="השכר שלך" value="₪45" pct={62} tone="low" />
        <BenchBar label="ממוצע באזור" value="₪52" pct={78} tone="mid" />
        <BenchBar label="25% המובילים" value="₪60" pct={100} tone="high" />

        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-start gap-2">
          <TrendingUp size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-amber-800 text-xs leading-relaxed">
            העלאת השכר ל-<b>₪52</b> צפויה להגדיל את מספר הפניות בכ-<b>40%</b> ולקצר את זמן הגיוס.
          </p>
        </div>
      </div>
    </div>
  );
}

function FunnelRow({ icon, label, value, pct, color, drop }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-700 text-sm font-semibold flex items-center gap-1.5">
          <span className="text-gray-400">{icon}</span>{label}
        </span>
        <span className="flex items-center gap-2">
          {drop && <span className="text-gray-400 text-[10px] font-bold">{drop} המרה</span>}
          <span className="text-gray-900 font-black text-sm tabular-nums">{value}</span>
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BenchBar({ label, value, pct, tone }) {
  const fill = tone === "low" ? "bg-amber-400" : tone === "mid" ? "bg-brand-400" : "bg-emerald-500";
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-600 text-xs font-semibold">{label}</span>
        <span className="text-gray-900 font-black text-sm">{value}<span className="text-gray-400 font-normal text-[11px]">/שעה</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ═══════════════ #8 · RECOMMENDATION — "POSTER WITH SALARY" ═══════════════ */
function Section8() {
  return (
    <div className="space-y-3">
      <SectionLabel num="8" title="המלצה חכמה" />

      {/* Hero recommendation */}
      <div className="bg-gray-900 text-white rounded-3xl p-5 shadow-xl shadow-gray-900/20">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-2xl bg-amber-400/20 flex items-center justify-center">
            <Lightbulb size={18} className="text-amber-300" />
          </div>
          <span className="text-amber-300 text-[11px] font-bold uppercase tracking-wide">המלצה עבורך</span>
        </div>
        <p className="text-lg font-black leading-snug">
          מודעות שמציגות את השכר מקבלות פי <span className="text-amber-300">2.3</span> יותר פניות
        </p>
        <p className="text-white/70 text-xs mt-1.5 leading-relaxed">
          ל-2 מהמשרות שלך השכר מוסתר ("לפי סיכום"). הצגת השכר היא הגורם מס' 1 לכמות הפניות.
        </p>
        <button className="mt-4 w-full bg-white text-gray-900 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99]">
          הצג שכר במשרות שלי <ArrowLeft size={16} />
        </button>
      </div>

      {/* A/B poster comparison */}
      <p className="text-gray-400 text-[11px] font-semibold text-center pt-1">השוואה · אותה משרה, שתי גרסאות</p>
      <div className="grid grid-cols-2 gap-3">
        <PosterCard salary={false} />
        <PosterCard salary={true} />
      </div>
    </div>
  );
}

function PosterCard({ salary }) {
  return (
    <div className={`relative rounded-3xl p-4 border shadow-sm overflow-hidden ${
      salary ? "bg-white border-brand-300 ring-2 ring-brand-500/30" : "bg-white border-gray-200"
    }`}>
      {salary && (
        <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
          <Flame size={10} /> מומלץ
        </span>
      )}
      {/* mock poster */}
      <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-xl mb-2">🍽️</div>
      <p className="font-black text-sm leading-tight">דרוש/ה מלצר/ית</p>
      <p className="text-gray-400 text-[11px] mt-0.5">מסעדת הדגמה · ת"א</p>

      {salary ? (
        <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5">
          <p className="text-emerald-700 font-black text-base leading-none">₪52<span className="text-[11px] font-bold">/שעה</span></p>
        </div>
      ) : (
        <div className="mt-2 bg-gray-100 border border-gray-200 rounded-xl px-2.5 py-1.5">
          <p className="text-gray-400 font-bold text-sm leading-none">לפי סיכום</p>
        </div>
      )}

      {/* attention meter */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-400 text-[10px] font-bold flex items-center gap-1"><Eye size={11} /> פניות</span>
          <span className={`text-sm font-black ${salary ? "text-emerald-600" : "text-gray-400"}`}>
            {salary ? "37" : "16"}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${salary ? "bg-emerald-500" : "bg-gray-300"}`}
            style={{ width: salary ? "100%" : "43%" }} />
        </div>
      </div>
    </div>
  );
}

/* ─── shared ─── */
function SectionLabel({ num, title }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="w-6 h-6 rounded-lg bg-brand-500 text-white text-xs font-black flex items-center justify-center">{num}</span>
      <h2 className="text-gray-900 font-black text-base">{title}</h2>
    </div>
  );
}
