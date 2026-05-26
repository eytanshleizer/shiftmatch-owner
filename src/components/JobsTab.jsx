import { useState } from "react";
import {
  Briefcase, Plus, X, Check, Zap, Calendar, Moon, Sun, PartyPopper,
  Loader2, ChevronDown, ChevronUp, Power, Trash2, Sparkles
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { can, ROLE_LABEL } from "../lib/permissions";

// Position catalog with emoji + label.  Matches ChatOnboarding.jsx.
const POSITIONS = [
  { key: "מלצר/ית",          emoji: "🧑‍🍳" },
  { key: "ברמן/ית",          emoji: "🍸" },
  { key: "מארח/ת",          emoji: "💁" },
  { key: "מנהל/ת משמרת",   emoji: "📋" },
  { key: "עוזר/ת מלצר",     emoji: "🙋" },
  { key: "קופאי/ת",         emoji: "💰" },
  { key: "מזון מהיר",       emoji: "🍔" },
  { key: "טבח/ית",           emoji: "👨‍🍳" },
  { key: "עוזר/ת מטבח",    emoji: "🍳" },
  { key: "שוטף/ת כלים",    emoji: "🧽" },
  { key: "בריסטה",           emoji: "☕" },
];

// Mandatory-shift options.  Keys saved to DB; labels shown to user.
const MANDATORY_SHIFTS = [
  { key: "weekend",       label: "סופי שבוע",          icon: PartyPopper },
  { key: "nights",        label: "לילות",              icon: Moon },
  { key: "holidays",      label: "חגים",               icon: Calendar },
  { key: "early_morning", label: "בוקר מוקדם",         icon: Sun },
];

// Weekly commitment quick-picks.
const COMMITMENT_PRESETS = [
  { min: 1, max: 3, label: "1–3" },
  { min: 3, max: 5, label: "3–5" },
  { min: 5, max: 7, label: "5+" },
];

const URGENT_PRICE = 79;

export default function JobsTab({ restaurant, onUpdate, role = "owner" }) {
  // Per spec §2.2 — only owner/admin/manager can edit jobs.
  const canEdit = can(role, "edit_jobs");

  // Selected positions live in restaurant.position_types (already in DB).
  const positions = restaurant?.position_types || [];

  const [expandedPosition, setExpandedPosition] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showUrgentPay, setShowUrgentPay] = useState(false);

  const positionOpen = restaurant?.position_open || {};
  const positionSalaries = restaurant?.position_salaries || {};
  const positionCounts = restaurant?.position_counts || {};
  const mandatoryShifts = restaurant?.mandatory_shifts || [];
  const commitMin = restaurant?.shift_commitment_min ?? null;
  const commitMax = restaurant?.shift_commitment_max ?? null;

  // True if position is open (default open if missing).
  const isOpen = (pos) => positionOpen[pos] !== false;

  const update = async (patch) => {
    if (!canEdit) return; // Hard guard — buttons are also hidden, but be safe.
    setSaving(true);
    const { error } = await supabase
      .from("restaurants")
      .update(patch)
      .eq("id", restaurant.id);
    if (!error) onUpdate?.({ ...restaurant, ...patch });
    setSaving(false);
  };

  const togglePosition = (pos) => {
    update({ position_open: { ...positionOpen, [pos]: !isOpen(pos) } });
  };

  const removePosition = (pos) => {
    if (!confirm(`להסיר את המשרה "${pos}" לחלוטין?`)) return;
    const nextTypes = positions.filter((p) => p !== pos);
    const nextOpen = { ...positionOpen };       delete nextOpen[pos];
    const nextSal  = { ...positionSalaries };   delete nextSal[pos];
    const nextCnt  = { ...positionCounts };     delete nextCnt[pos];
    update({
      position_types: nextTypes,
      position_open: nextOpen,
      position_salaries: nextSal,
      position_counts: nextCnt,
    });
  };

  const addPosition = (pos) => {
    if (positions.includes(pos)) return;
    update({
      position_types: [...positions, pos],
      position_open: { ...positionOpen, [pos]: true },
      position_counts: { ...positionCounts, [pos]: 1 },
    });
    setShowAdd(false);
    setExpandedPosition(pos);
  };

  const setSalary = (pos, val) => {
    const num = parseInt(val) || 0;
    update({ position_salaries: { ...positionSalaries, [pos]: num } });
  };

  const setCount = (pos, val) => {
    const num = Math.max(1, parseInt(val) || 1);
    update({ position_counts: { ...positionCounts, [pos]: num } });
  };

  const toggleMandatoryShift = (key) => {
    const next = mandatoryShifts.includes(key)
      ? mandatoryShifts.filter((s) => s !== key)
      : [...mandatoryShifts, key];
    update({ mandatory_shifts: next });
  };

  const setCommitment = (min, max) => {
    update({ shift_commitment_min: min, shift_commitment_max: max });
  };

  // Urgent — already paid + still active?
  const urgentActive =
    restaurant?.urgent &&
    restaurant?.urgent_until &&
    new Date(restaurant.urgent_until) > new Date();

  const confirmUrgent = async () => {
    const until = new Date();
    until.setDate(until.getDate() + 7);
    await update({
      urgent: true,
      urgent_until: until.toISOString(),
      urgent_price: URGENT_PRICE,
    });
    setShowUrgentPay(false);
  };

  const availableToAdd = POSITIONS.filter((p) => !positions.includes(p.key));

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-black text-xl flex items-center gap-2">
            <Briefcase size={20} className="text-brand-400" />
            משרות
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {positions.filter(isOpen).length} פתוחות · {positions.length} בסך הכל
          </p>
        </div>
        {saving && <Loader2 size={16} className="text-brand-400 animate-spin" />}
      </div>

      <div className="px-4 space-y-3">

        {!canEdit && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-2xl px-4 py-3 flex items-center gap-2">
            🔒 התפקיד שלך ({ROLE_LABEL[role] || role}) אינו מאפשר עריכת משרות. ניתן לצפות בלבד.
          </div>
        )}

        {/* ── Urgent banner ── */}
        <div className={`rounded-2xl p-4 border ${
          urgentActive
            ? "bg-gradient-to-br from-red-500/15 to-orange-500/10 border-red-500/30"
            : "bg-[#161616] border-white/5"
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                urgentActive ? "bg-red-500" : "bg-white/5"
              }`}>
                <Zap size={20} className={urgentActive ? "text-white" : "text-gray-500"} fill={urgentActive ? "white" : "none"} />
              </div>
              <div className="min-w-0">
                <p className="text-white font-black text-sm">
                  {urgentActive ? "🔥 משרה דחופה פעילה" : "קידום משרה"}
                </p>
                <p className="text-gray-400 text-[11px] mt-0.5">
                  {urgentActive
                    ? `מסתיים ${new Date(restaurant.urgent_until).toLocaleDateString("he-IL")}`
                    : `₪${URGENT_PRICE} · 7 ימים בראש החיפושים`}
                </p>
              </div>
            </div>
            {!urgentActive && (
              <button onClick={() => setShowUrgentPay(true)}
                className="bg-red-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl active:bg-red-600 flex-shrink-0 shadow-lg shadow-red-500/30">
                קדם
              </button>
            )}
          </div>
        </div>

        {/* ── Mandatory shifts ── */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
          <p className="text-white font-bold text-sm mb-1">משמרות חובה</p>
          <p className="text-gray-500 text-[11px] mb-3">
            מועמדים שלא זמינים למשמרות אלה לא יוכלו להגיש מועמדות
          </p>
          <div className="flex flex-wrap gap-2">
            {MANDATORY_SHIFTS.map(({ key, label, icon: Icon }) => {
              const on = mandatoryShifts.includes(key);
              return (
                <button key={key} onClick={() => toggleMandatoryShift(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    on
                      ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                      : "bg-white/5 text-gray-400 border border-white/10"
                  }`}>
                  <Icon size={13} />
                  {label}
                  {on && <Check size={12} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Weekly commitment ── */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
          <p className="text-white font-bold text-sm mb-1">מכסת משמרות בשבוע</p>
          <p className="text-gray-500 text-[11px] mb-3">
            כמה משמרות העובד מתחייב לעבוד בשבוע
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {COMMITMENT_PRESETS.map(({ min, max, label }) => {
              const on = commitMin === min && commitMax === max;
              return (
                <button key={label} onClick={() => setCommitment(min, max)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                    on
                      ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                      : "bg-white/5 text-gray-400 border border-white/10"
                  }`}>
                  {label}
                </button>
              );
            })}
          </div>
          {/* Custom range */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">מותאם:</span>
            <input type="number" min="1" max="14"
              value={commitMin ?? ""} onChange={(e) => setCommitment(parseInt(e.target.value) || null, commitMax)}
              placeholder="מינ׳"
              className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-center outline-none focus:border-brand-500" />
            <span className="text-gray-500">–</span>
            <input type="number" min="1" max="14"
              value={commitMax ?? ""} onChange={(e) => setCommitment(commitMin, parseInt(e.target.value) || null)}
              placeholder="מקס׳"
              className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-center outline-none focus:border-brand-500" />
            <span className="text-gray-500 text-xs">משמרות / שבוע</span>
          </div>
        </div>

        {/* ── Positions list ── */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">משרות פתוחות</p>
            <button onClick={() => setShowAdd(true)}
              disabled={!availableToAdd.length}
              className="text-brand-400 text-xs font-bold flex items-center gap-1 active:opacity-60 disabled:opacity-30">
              <Plus size={14} />הוספת משרה
            </button>
          </div>

          {positions.length === 0 ? (
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-3xl mx-auto mb-3">💼</div>
              <p className="text-white font-bold text-sm">אין משרות עדיין</p>
              <p className="text-gray-500 text-xs mt-1">לחצ/י "+ הוספת משרה" כדי להתחיל</p>
            </div>
          ) : (
            <div className="space-y-2">
              {positions.map((pos) => {
                const meta = POSITIONS.find((p) => p.key === pos) || { emoji: "💼" };
                const open = isOpen(pos);
                const expanded = expandedPosition === pos;
                const salary = positionSalaries[pos] || 0;
                const count = positionCounts[pos] || 1;
                return (
                  <div key={pos}
                    className={`rounded-2xl border transition-all ${
                      open
                        ? "bg-[#161616] border-white/5"
                        : "bg-[#0F0F0F] border-white/5 opacity-60"
                    }`}>
                    {/* Header row */}
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center text-xl flex-shrink-0">
                        {meta.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">{pos}</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">
                          {salary > 0 ? `₪${salary}/שעה · ` : ""}
                          {count} {count > 1 ? "משרות" : "משרה"}
                          {!open && " · סגורה"}
                        </p>
                      </div>
                      {/* Open/close toggle */}
                      <button onClick={() => togglePosition(pos)}
                        className={`w-11 h-7 rounded-full flex items-center transition-colors flex-shrink-0 ${
                          open ? "bg-brand-500" : "bg-white/10"
                        }`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform mx-1 ${
                          open ? "translate-x-4" : "translate-x-0"
                        }`} />
                      </button>
                      <button onClick={() => setExpandedPosition(expanded ? null : pos)}
                        className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 active:bg-white/10 flex-shrink-0">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {/* Expanded edit */}
                    {expanded && (
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5">
                        {/* Salary */}
                        <div>
                          <label className="text-gray-500 text-[11px] font-bold uppercase tracking-wide block mb-1.5">שכר לשעה (₪)</label>
                          <input type="number" min="0" value={salary || ""}
                            onChange={(e) => setSalary(pos, e.target.value)}
                            placeholder="50"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-brand-500" />
                        </div>
                        {/* Count */}
                        <div>
                          <label className="text-gray-500 text-[11px] font-bold uppercase tracking-wide block mb-1.5">כמה משרות פתוחות</label>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCount(pos, count - 1)}
                              disabled={count <= 1}
                              className="w-9 h-9 rounded-xl bg-white/5 text-white font-bold flex items-center justify-center disabled:opacity-30 active:bg-white/10">−</button>
                            <input type="number" min="1" max="20" value={count}
                              onChange={(e) => setCount(pos, e.target.value)}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm text-center outline-none focus:border-brand-500" />
                            <button onClick={() => setCount(pos, count + 1)}
                              className="w-9 h-9 rounded-xl bg-white/5 text-white font-bold flex items-center justify-center active:bg-white/10">+</button>
                          </div>
                        </div>
                        {/* Remove */}
                        <button onClick={() => removePosition(pos)}
                          className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:bg-red-500/20">
                          <Trash2 size={13} />הסרת משרה
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Add position modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-end justify-center"
          onClick={() => setShowAdd(false)}>
          <div className="bg-[#161616] border-t border-white/10 rounded-t-3xl w-full max-w-md p-6 pb-8 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black text-lg">הוספת משרה</h3>
              <button onClick={() => setShowAdd(false)}
                className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {availableToAdd.map(({ key, emoji }) => (
                <button key={key} onClick={() => addPosition(key)}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center active:bg-white/10 active:scale-95 transition-all">
                  <div className="text-3xl mb-1">{emoji}</div>
                  <p className="text-white text-sm font-bold">{key}</p>
                </button>
              ))}
            </div>
            {availableToAdd.length === 0 && (
              <p className="text-gray-500 text-center text-sm py-6">כל המשרות כבר נוספו</p>
            )}
          </div>
        </div>
      )}

      {/* ── Urgent payment modal ── */}
      {showUrgentPay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4"
          onClick={() => setShowUrgentPay(false)}>
          <div className="bg-[#161616] border border-white/10 rounded-3xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mb-4 shadow-lg shadow-red-500/30">
              <Zap size={28} className="text-white" fill="white" />
            </div>
            <h3 className="text-white font-black text-xl text-center mb-2">קדם את המשרה</h3>
            <p className="text-gray-400 text-sm text-center mb-5 leading-relaxed">
              המשרה תופיע בראש החיפושים עם תגית 🔥 דחוף למשך <b className="text-white">7 ימים</b>
            </p>
            <div className="bg-white/5 rounded-2xl p-4 mb-5 flex items-center justify-between">
              <span className="text-gray-400 text-sm">סכום לתשלום</span>
              <span className="text-white font-black text-2xl">₪{URGENT_PRICE}</span>
            </div>
            <button onClick={confirmUrgent}
              disabled={saving}
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold py-4 rounded-2xl active:opacity-80 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <><Sparkles size={16} fill="white" />שלם וקדם</>}
            </button>
            <button onClick={() => setShowUrgentPay(false)}
              className="w-full text-gray-500 text-sm font-semibold py-3 mt-1">ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}
