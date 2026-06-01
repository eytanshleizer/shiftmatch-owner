import { useState, useEffect } from "react";
import {
  Users, UserPlus, ArrowRight, X, Check, Crown, Shield, Calendar,
  Eye, MoreVertical, Loader2, Trash2, Lock, ChevronDown
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { can } from "../lib/permissions";

// ─── Role metadata — light-theme palette ────────────────────────────────────
const ROLES = {
  owner:     { label: "בעלים",       icon: Crown,    bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-400"  },
  admin:     { label: "מנהל ראשי",   icon: Shield,   bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
  recruiter: { label: "מגייס/ת",     icon: Calendar, bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500"   },
  viewer:    { label: "צפייה בלבד",  icon: Eye,      bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400"   },
};

const ROLE_DESCRIPTIONS = {
  admin:     "הוספת אנשי צוות ועריכת כל פרטי המסעדה",
  recruiter: "תיאום ראיונות עם מועמדים בלבד",
  viewer:    "צפייה בפניות ומועמדים — ללא עריכה",
};

const ROLE_PERMISSIONS = [
  { role: "owner",     perms: ["ניהול מלא", "הסרת חשבונות", "הוספת צוות"] },
  { role: "admin",     perms: ["הוספת צוות", "עריכת פרטים", "ניהול משרות"] },
  { role: "recruiter", perms: ["תיאום ראיונות", "צפייה במועמדים"] },
  { role: "viewer",    perms: ["צפייה בלבד"] },
];

const ADDABLE_ROLES = ["admin", "recruiter", "viewer"];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TeamPage({ restaurant, user, onBack }) {
  const [members,      setMembers]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showAdd,      setShowAdd]      = useState(false);
  const [actionMember, setActionMember] = useState(null);

  const myMembership = members.find(m => m.user_id === user?.id);
  const myRole    = myMembership?.role || "viewer";
  const canAdd    = can(myRole, "invite");
  const canRemove = can(myRole, "remove");
  const canEdit   = can(myRole, "change_role");

  const load = async () => {
    setLoading(true);

    // Self-heal: if owner has no member row yet, create one so they appear.
    if (user?.id && restaurant?.owner_id === user.id) {
      const { data: existing } = await supabase
        .from("restaurant_members").select("id")
        .eq("restaurant_id", restaurant.id).eq("user_id", user.id).maybeSingle();
      if (!existing) {
        await supabase.from("restaurant_members").insert({
          restaurant_id: restaurant.id, user_id: user.id,
          role: "owner", status: "approved",
          approved_at: new Date().toISOString(),
        });
      }
    }

    // Use a SECURITY DEFINER RPC to avoid the recursive-RLS issue that
    // occurs when querying restaurant_members filtered by restaurant_id.
    const { data: rows } = await supabase
      .rpc("get_team_members", { p_restaurant_id: restaurant.id });

    // Normalise shape so MemberRow can use profile.name / profile.email
    const members = (rows || []).map(r => ({
      ...r,
      profile: { name: r.profile_name, email: r.profile_email },
    }));

    setMembers(members);
    setLoading(false);
  };

  useEffect(() => { if (restaurant?.id) load(); }, [restaurant?.id]);

  const changeRole = async (memberId, newRole) => {
    await supabase.from("restaurant_members").update({ role: newRole }).eq("id", memberId);
    setActionMember(null);
    load();
  };

  const removeMember = async (memberId) => {
    const { data, error } = await supabase.rpc("remove_team_member", {
      p_member_id:    memberId,
      p_requester_id: user.id,
    });
    const errMsg = error?.message || data?.error;
    if (errMsg) { alert("שגיאה בהסרת חבר הצוות: " + errMsg); return; }
    setActionMember(null);
    load();
  };

  return (
    <div className="h-full flex flex-col bg-gray-50" dir="rtl">

      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 pt-14 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="w-9 h-9 bg-gray-100 rounded-2xl flex items-center justify-center active:bg-gray-200">
            <ArrowRight size={16} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-gray-900 font-black text-xl">ניהול צוות</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {loading ? "טוען..." : `${members.length} חברי צוות`}
            </p>
          </div>
          {canAdd && (
            <button onClick={() => setShowAdd(true)}
              className="bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl active:bg-gray-800 flex items-center gap-1.5 shadow-sm">
              <UserPlus size={14} />הוסף חבר/ת
            </button>
          )}
        </div>
      </div>

      {/* ── Members list ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-6 space-y-2.5">
        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 size={28} className="text-gray-300 animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gray-100 flex items-center justify-center text-4xl mb-4">👥</div>
            <p className="text-gray-900 font-bold text-base">אין חברי צוות עדיין</p>
            <p className="text-gray-400 text-xs mt-1 mb-5">הוסף אנשים כדי לעבוד יחד על הגיוס</p>
            {canAdd && (
              <button onClick={() => setShowAdd(true)}
                className="bg-gray-900 text-white text-sm font-bold px-5 py-3 rounded-xl active:bg-gray-800 inline-flex items-center gap-2">
                <UserPlus size={15} />הוסף חבר/ת ראשון/ה
              </button>
            )}
          </div>
        ) : (
          <>
            {members.map(m => {
              const isMe    = m.user_id === user?.id;
              const isOwner = m.role === "owner";
              // Can open action sheet on someone else who isn't the owner
              const showAction = !isMe && !isOwner && (canRemove || canEdit);
              return (
                <MemberRow key={m.id} m={m} isMe={isMe}
                  showAction={showAction}
                  onAction={() => setActionMember(m)} />
              );
            })}

            {/* ── Role legend ── */}
            <div className="mt-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wide mb-3">
                הרשאות לפי תפקיד
              </p>
              <div className="space-y-2.5">
                {ROLE_PERMISSIONS.map(({ role, perms }) => {
                  const r = ROLES[role];
                  return (
                    <div key={role} className="flex items-start gap-2.5">
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${r.dot}`} />
                      <div>
                        <span className={`text-[11px] font-bold ${r.text}`}>{r.label} </span>
                        <span className="text-gray-400 text-[11px]">
                          — {perms.join(" · ")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Add member modal ── */}
      {showAdd && (
        <AddMemberModal
          restaurant={restaurant}
          requesterId={user.id}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); load(); }}
        />
      )}

      {/* ── Action sheet ── */}
      {actionMember && (
        <ActionSheet
          member={actionMember}
          canRemove={canRemove}
          canEdit={canEdit}
          onClose={() => setActionMember(null)}
          onChangeRole={newRole => changeRole(actionMember.id, newRole)}
          onRemove={() => removeMember(actionMember.id)}
        />
      )}
    </div>
  );
}

// ─── Member row card ──────────────────────────────────────────────────────────
function MemberRow({ m, isMe, showAction, onAction }) {
  const role    = ROLES[m.role] || ROLES.viewer;
  const profile = m.profile || {};
  const name    = profile.name || profile.email || "משתמש";
  const email   = profile.email || "";
  const initials = name
    .split(/\s+/).slice(0, 2)
    .map(w => (w[0] || "").toUpperCase()).join("") || "?";

  // Avatar gradient by role
  const avatarGrad = {
    owner:     "from-amber-400 to-orange-500",
    admin:     "from-purple-500 to-pink-500",
    recruiter: "from-blue-500 to-cyan-500",
    viewer:    "from-gray-400 to-gray-500",
  }[m.role] || "from-gray-400 to-gray-500";

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
      {/* Avatar */}
      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm`}>
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-gray-900 font-bold text-sm truncate">{name}</p>
          {isMe && <span className="text-gray-400 text-[10px] font-semibold">(אני)</span>}
        </div>
        {email && (
          <p className="text-gray-400 text-[11px] mt-0.5 truncate" dir="ltr">{email}</p>
        )}
        {/* Role chip */}
        <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${role.bg} ${role.text}`}>
          <div className={`w-1 h-1 rounded-full ${role.dot}`} />
          {role.label}
        </span>
      </div>

      {/* Action button */}
      {showAction && (
        <button onClick={onAction}
          className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 flex items-center justify-center active:bg-gray-100 flex-shrink-0">
          <MoreVertical size={15} />
        </button>
      )}
    </div>
  );
}

// ─── Add member modal (bottom sheet) ─────────────────────────────────────────
function AddMemberModal({ restaurant, requesterId, onClose, onAdded }) {
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [role,     setRole]     = useState("recruiter");
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  const valid =
    name.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= 6;

  const submit = async () => {
    if (!valid) return;
    setErr("");
    setSaving(true);
    const { data, error } = await supabase.rpc("create_team_member", {
      p_email:         email.trim().toLowerCase(),
      p_password:      password,
      p_name:          name.trim(),
      p_restaurant_id: restaurant.id,
      p_role:          role,
      p_requester_id:  requesterId,
    });
    setSaving(false);
    // The function returns JSON — check both the Supabase-level error and the
    // data.error field (returned when the function detects a business-logic error).
    const errMsg = error?.message || data?.error;
    if (errMsg) {
      setErr(
        errMsg.includes("already") || errMsg.includes("duplicate") || errMsg.includes("רשומה")
          ? "אמייל זה כבר רשום במערכת"
          : errMsg
      );
      return;
    }
    onAdded();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full sm:hidden" />
        </div>

        <div className="px-5 pb-8 pt-3 overflow-y-auto flex-1">
          {/* Title */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-gray-900 font-black text-lg flex items-center gap-2">
              <UserPlus size={18} className="text-gray-500" />
              הוספת חבר/ת צוות
            </h3>
            <button onClick={onClose}
              className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 active:bg-gray-200">
              <X size={16} />
            </button>
          </div>

          {/* Name */}
          <label className="block text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-1.5">
            שם מלא
          </label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="ישראל ישראלי"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900 mb-4"
          />

          {/* Email */}
          <label className="block text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-1.5">
            אמייל
          </label>
          <input
            type="email" dir="ltr" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900 mb-4 text-left"
          />

          {/* Password */}
          <label className="block text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-1.5">
            סיסמה
          </label>
          <div className="relative mb-4">
            <input
              type={showPwd ? "text" : "password"}
              dir="ltr" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="מינימום 6 תווים"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-gray-900 text-left pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600">
              <Lock size={15} />
            </button>
          </div>
          {password && password.length < 6 && (
            <p className="text-amber-500 text-[11px] font-semibold -mt-3 mb-3">
              הסיסמה חייבת להכיל לפחות 6 תווים
            </p>
          )}

          {/* Role picker */}
          <label className="block text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-2">
            תפקיד
          </label>
          <div className="space-y-2 mb-5">
            {ADDABLE_ROLES.map(r => {
              const meta = ROLES[r];
              const Icon = meta.icon;
              const on   = role === r;
              return (
                <button key={r} onClick={() => setRole(r)}
                  className={`w-full p-3.5 rounded-2xl border text-right flex items-center gap-3 transition-all active:scale-[0.99] ${
                    on
                      ? "bg-gray-900 border-gray-900"
                      : "bg-gray-50 border-gray-200 active:bg-gray-100"
                  }`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    on ? `${meta.bg} ${meta.text}` : "bg-white border border-gray-200 text-gray-500"
                  }`}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold text-sm ${on ? "text-white" : "text-gray-900"}`}>
                      {meta.label}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${on ? "text-gray-300" : "text-gray-500"}`}>
                      {ROLE_DESCRIPTIONS[r]}
                    </p>
                  </div>
                  {on && <Check size={16} className="text-white flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {err && (
            <p className="text-red-500 text-xs text-center mb-3 font-semibold">{err}</p>
          )}

          {/* Submit */}
          <button onClick={submit} disabled={!valid || saving}
            className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-2xl active:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity">
            {saving
              ? <Loader2 size={18} className="animate-spin" />
              : <><UserPlus size={16} />צור/י חשבון</>}
          </button>
          <p className="text-gray-400 text-[10px] text-center mt-2 leading-relaxed">
            החשבון ייווצר מיד — המשתמש/ת יוכלו להיכנס עם האמייל והסיסמה שהגדרת
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Action sheet ─────────────────────────────────────────────────────────────
function ActionSheet({ member, canRemove, canEdit, onClose, onChangeRole, onRemove }) {
  const [view, setView] = useState("main"); // "main" | "role"

  const profile  = member.profile || {};
  const dispName = profile.name || profile.email || "חבר צוות";

  const confirmRemove = () => {
    if (window.confirm(`להסיר את "${dispName}" מהמסעדה?\nהחשבון שלהם יימחק לצמיתות.`)) {
      onRemove();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full sm:hidden" />
        </div>

        {view === "main" ? (
          <div className="px-4 pt-2 pb-8 overflow-y-auto flex-1">
            <p className="text-center text-gray-500 text-xs font-semibold pb-3 border-b border-gray-100">
              {dispName}
            </p>

            {canEdit && (
              <button onClick={() => setView("role")}
                className="w-full py-4 text-gray-900 font-semibold text-right px-3 active:bg-gray-50 rounded-xl flex items-center gap-2">
                <ChevronDown size={15} className="text-gray-400" />
                שינוי תפקיד
              </button>
            )}

            {canRemove && (
              <button onClick={confirmRemove}
                className="w-full py-4 text-red-600 font-semibold text-right px-3 active:bg-red-50 rounded-xl flex items-center gap-2">
                <Trash2 size={15} className="text-red-500" />
                הסרה מהמסעדה ומחיקת חשבון
              </button>
            )}

            <button onClick={onClose}
              className="w-full mt-1 py-3.5 text-gray-400 font-semibold rounded-xl active:bg-gray-50">
              ביטול
            </button>
          </div>
        ) : (
          <div className="px-4 pt-2 pb-8 overflow-y-auto flex-1">
            <p className="text-gray-900 font-bold text-center py-3 border-b border-gray-100 mb-2">
              בחירת תפקיד חדש
            </p>
            <div className="space-y-1">
              {ADDABLE_ROLES.map(r => {
                const meta = ROLES[r];
                const Icon = meta.icon;
                const on   = member.role === r;
                return (
                  <button key={r} onClick={() => onChangeRole(r)}
                    className={`w-full py-3.5 px-3 text-right rounded-xl active:bg-gray-50 flex items-center gap-3 ${
                      on ? "bg-gray-50" : ""
                    }`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg} ${meta.text}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900 text-sm font-bold">{meta.label}</p>
                      <p className="text-gray-400 text-[11px]">{ROLE_DESCRIPTIONS[r]}</p>
                    </div>
                    {on && <Check size={15} className="text-gray-900" />}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setView("main")}
              className="w-full mt-2 py-3.5 text-gray-400 font-semibold rounded-xl active:bg-gray-50">
              חזרה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
