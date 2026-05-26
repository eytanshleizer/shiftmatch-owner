import { useState } from "react";
import {
  Briefcase, Plus, X, Check, Calendar, Moon, Sun, PartyPopper,
  Loader2, ChevronDown, ChevronUp, Trash2
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { can, ROLE_LABEL } from "../lib/permissions";

// ─────────────────────────────────────────────────────────────────────────────
// JobsTab — white Fireberry-style.
// Position cards, mandatory shifts, weekly commitment.
// Urgent promotion lives in PlansTab now (not here).
// ─────────────────────────────────────────────────────────────────────────────

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

const MANDATORY_SHIFTS = [
  { key: "weekend",       label: "סופי שבוע",   icon: PartyPopper },
  { key: "nights",        label: "לילות",        icon: Moon },
  { key: "holidays",      label: "חגים",         icon: Calendar },
  { key: "early_morning", label: "בוקר מוקדם",   icon: Sun },
];

const COMMITMENT_PRESETS = [
  { min: 1, max: 3, label: "1–3" },
  { min: 3, max: 5, label: "3–5" },
  { min: 5, max: 7, label: "5+" },
];

export default function JobsTab({ restaurant, onUpdate, role = "owner" }) {
  const canEdit = can(role, "edit_jobs");

  const positions = restaurant?.position_types || [];

  const [expandedPosition, setExpandedPosition] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const positionOpen      = restaurant?.position_open || {};
  const positionSalaries  = restaurant?.position_salaries || {};
  const positionCounts    = restaurant?.position_counts || {};
  const mandatoryShifts   = restaurant?.mandatory_shifts || [];
  const commitMin         = restaurant?.shift_commitment_min ?? null;
  const commitMax         = restaurant?.shift_commitment_max ?? null;

  const isOpen = (pos) => positionOpen[pos] !== false;

  const update = async (patch) => {
    if (!canEdit) return;
    setSaving(true);
    const { error } = await supabase
      .from("restaurants").update(patch).eq("id", restaurant.id);
    if (!error) onUpdate?.({ ...restaurant, ...patch });
    setSaving(false);
  };

  const togglePosition = (pos) => update({ position_open: { ...positionOpen, [pos]: !isOpen(pos) } });

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

  const setSalary = (pos, val) => update({ position_salaries: { ...positionSalaries, [pos]: parseInt(val) || 0 } });
  const setCount  = (pos, val) => update({ position_counts: { ...positionCounts, [pos]: Math.max(1, parseInt(val) || 1) } });

  const toggleMandatoryShift = (key) => {
    const next = mandatoryShifts.includes(key)
      ? mandatoryShifts.filter((s) => s !== key)
      : [...mandatoryShifts, key];
    update({ mandatory_shifts: next });
  };

  const setCommitment = (min, max) => update({ shift_commitment_min: min, shift_commitment_max: max });

  const availableToAdd = POSITIONS.filter((p) => !positions.includes(p.key));

  return (
    <div className="bg-gray-50 min-h-full pb-24 text-gray-900">
      {/* Header */}
      <div className="px-5 pt-20 pb-3 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">משרות</h1>
          <p className="text-gray-500 text-sm mt-1">
            {positions.filter(isOpen).length} פתוחות · {positions.length} בסך הכל
          </p>
        </div>
        {saving && <Loader2 size={16} className="text-gray-400 animate-spin" />}
      </div>

      <div className="px-4 pt-3 space-y-3">

        {!canEdit && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-2xl px-4 py-3 flex items-center gap-2">
            🔒 התפקיד שלך ({ROLE_LABEL[role] || role}) אינו מאפשר עריכת משרות. ניתן לצפות בלבד.
          </div>
        )}

        {/* ── Mandatory shifts ── */}
        <Card>
          <p className="text-gray-900 font-bold text-sm">משמרות חובה</p>
          <p className="text-gray-500 text-[11px] mb-3">מועמדים שלא זמינים למשמרות אלה לא יוכלו להגיש מועמדות</p>
          <div className="flex flex-wrap gap-2">
            {MANDATORY_SHIFTS.map(({ key, label, icon: Icon }) => {
              const on = mandatoryShifts.includes(key);
              return (
                <button key={key} onClick={() => toggleMandatoryShift(key)}
                  disabled={!canEdit}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${
                    on
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
                  } disabled:opacity-50`}>
                  <Icon size={13} />{label}{on && <Check size={12} />}
                </button>
              );
            })}
          </div>
        </Card>

        {/* ── Weekly commitment ── */}
        <Card>
          <p className="text-gray-900 font-bold text-sm">מכסת משמרות בשבוע</p>
          <p className="text-gray-500 text-[11px] mb-3">כמה משמרות העובד מתחייב לעבוד בשבוע</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {COMMITMENT_PRESETS.map(({ min, max, label }) => {
              const on = commitMin === min && commitMax === max;
              return (
                <button key={label} onClick={() => setCommitment(min, max)}
                  disabled={!canEdit}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-colors border ${
                    on
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
                  } disabled:opacity-50`}>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">מותאם:</span>
            <input type="number" min="1" max="14" disabled={!canEdit}
              value={commitMin ?? ""} onChange={(e) => setCommitment(parseInt(e.target.value) || null, commitMax)}
              placeholder="מינ׳"
              className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 text-sm text-center outline-none focus:border-gray-900" />
            <span className="text-gray-400">–</span>
            <input type="number" min="1" max="14" disabled={!canEdit}
              value={commitMax ?? ""} onChange={(e) => setCommitment(commitMin, parseInt(e.target.value) || null)}
              placeholder="מקס׳"
              className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 text-sm text-center outline-none focus:border-gray-900" />
            <span className="text-gray-400 text-xs">משמרות / שבוע</span>
          </div>
        </Card>

        {/* ── Positions list ── */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">משרות פתוחות</p>
            {canEdit && (
              <button onClick={() => setShowAdd(true)} disabled={!availableToAdd.length}
                className="text-gray-900 text-xs font-bold flex items-center gap-1 disabled:opacity-30">
                <Plus size={13} />הוספת משרה
              </button>
            )}
          </div>

          {positions.length === 0 ? (
            <Card center>
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mx-auto mb-3">💼</div>
              <p className="text-gray-900 font-bold text-sm">אין משרות עדיין</p>
              <p className="text-gray-500 text-xs mt-1">לחצ/י "+ הוספת משרה" כדי להתחיל</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {positions.map((pos) => {
                const meta = POSITIONS.find((p) => p.key === pos) || { emoji: "💼" };
                const open = isOpen(pos);
                const expanded = expandedPosition === pos;
                const salary = positionSalaries[pos] || 0;
                const count  = positionCounts[pos] || 1;
                return (
                  <div key={pos}
                    className={`rounded-2xl border bg-white shadow-sm transition-opacity ${open ? "" : "opacity-60"}`}
                    style={{ borderColor: open ? "#E5E7EB" : "#E5E7EB" }}>
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                        {meta.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-bold text-sm">{pos}</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">
                          {salary > 0 ? `₪${salary}/שעה · ` : ""}
                          {count} {count > 1 ? "משרות" : "משרה"}
                          {!open && " · סגורה"}
                        </p>
                      </div>
                      <button onClick={() => togglePosition(pos)} disabled={!canEdit}
                        className={`w-11 h-7 rounded-full flex items-center transition-colors flex-shrink-0 ${
                          open ? "bg-gray-900" : "bg-gray-200"
                        } disabled:opacity-50`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform mx-1 ${
                          open ? "translate-x-4" : "translate-x-0"
                        }`} />
                      </button>
                      <button onClick={() => setExpandedPosition(expanded ? null : pos)}
                        className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200 flex-shrink-0">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {expanded && (
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100">
                        <div>
                          <label className="text-gray-500 text-[11px] font-bold uppercase tracking-wide block mb-1.5">שכר לשעה (₪)</label>
                          <input type="number" min="0" disabled={!canEdit}
                            value={salary || ""}
                            onChange={(e) => setSalary(pos, e.target.value)}
                            placeholder="50"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900 disabled:opacity-50" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-[11px] font-bold uppercase tracking-wide block mb-1.5">כמה משרות פתוחות</label>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCount(pos, count - 1)}
                              disabled={!canEdit || count <= 1}
                              className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold flex items-center justify-center disabled:opacity-30 active:bg-gray-200">−</button>
                            <input type="number" min="1" max="20" value={count} disabled={!canEdit}
                              onChange={(e) => setCount(pos, e.target.value)}
                              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm text-center outline-none focus:bg-white focus:border-gray-900 disabled:opacity-50" />
                            <button onClick={() => setCount(pos, count + 1)}
                              disabled={!canEdit}
                              className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold flex items-center justify-center active:bg-gray-200 disabled:opacity-50">+</button>
                          </div>
                        </div>
                        {canEdit && (
                          <button onClick={() => removePosition(pos)}
                            className="w-full bg-red-50 border border-red-100 text-red-700 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:bg-red-100">
                            <Trash2 size={13} />הסרת משרה
                          </button>
                        )}
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end" onClick={() => setShowAdd(false)}>
          <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6 pb-8 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-black text-lg">הוספת משרה</h3>
              <button onClick={() => setShowAdd(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {availableToAdd.map(({ key, emoji }) => (
                <button key={key} onClick={() => addPosition(key)}
                  className="bg-white border border-gray-200 rounded-2xl p-4 text-center active:bg-gray-50 transition-colors shadow-sm">
                  <div className="text-3xl mb-1">{emoji}</div>
                  <p className="text-gray-900 text-sm font-bold">{key}</p>
                </button>
              ))}
            </div>
            {availableToAdd.length === 0 && (
              <p className="text-gray-500 text-center text-sm py-6">כל המשרות כבר נוספו</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ children, center }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl p-4 shadow-sm ${center ? "text-center py-8" : ""}`}>
      {children}
    </div>
  );
}
