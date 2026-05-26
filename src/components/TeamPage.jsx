import { useState, useEffect } from "react";
import {
  Users, UserPlus, ArrowRight, X, Check, Crown, Shield, Briefcase,
  Phone, Eye, MoreVertical, Loader2, Mail, Clock, Trash2
} from "lucide-react";
import { supabase } from "../lib/supabase";

// Role catalog — order matters (used for sorting + role picker).
const ROLES = {
  owner:     { label: "בעלים",        icon: Crown,     color: "from-yellow-500 to-orange-500" },
  admin:     { label: "מנהל ראשי",    icon: Shield,    color: "from-purple-500 to-pink-500" },
  manager:   { label: "מנהל",         icon: Briefcase, color: "from-blue-500 to-cyan-500" },
  recruiter: { label: "מגייס",         icon: Phone,     color: "from-green-500 to-teal-500" },
  viewer:    { label: "צפייה בלבד",    icon: Eye,       color: "from-gray-500 to-gray-600" },
};

const ROLE_DESCRIPTIONS = {
  admin:     "הרשאות מלאות מלבד מחיקת חשבון המסעדה",
  manager:   "פרסום משרות וניהול מועמדים",
  recruiter: "צפייה ויצירת קשר עם מועמדים בלבד",
  viewer:    "קריאה בלבד — בלי לערוך",
};

const ROLE_ORDER = ["owner", "admin", "manager", "recruiter", "viewer"];

export default function TeamPage({ restaurant, user, onBack }) {
  const [members,    setMembers]    = useState([]);
  const [invites,    setInvites]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [actionMember, setActionMember] = useState(null); // { ...member } for action sheet

  // Find caller's role to decide what UI to show.
  const myMembership = members.find((m) => m.user_id === user?.id);
  const myRole = myMembership?.role || "viewer";
  const canManage = myRole === "owner" || myRole === "admin";

  const load = async () => {
    setLoading(true);

    // Self-heal: if the restaurant owner doesn't have a member row (because the
    // auto-trigger missed them, e.g. demo-seeded restaurants), insert one now so
    // they appear in the team list and have full RLS access.
    if (user?.id && restaurant?.owner_id === user.id) {
      const { data: existing } = await supabase
        .from("restaurant_members")
        .select("id")
        .eq("restaurant_id", restaurant.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existing) {
        await supabase.from("restaurant_members").insert({
          restaurant_id: restaurant.id,
          user_id: user.id,
          role: "owner",
          status: "approved",
          approved_at: new Date().toISOString(),
        });
      }
    }

    // Fetch members + invitations in parallel.
    const [{ data: m }, { data: i }] = await Promise.all([
      supabase
        .from("restaurant_members")
        .select("*")
        .eq("restaurant_id", restaurant.id),
      supabase
        .from("restaurant_invitations")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .is("accepted_at", null),
    ]);

    // Manually attach profile (no FK from restaurant_members → profiles,
    // both reference auth.users → PostgREST can't auto-join).
    let withProfiles = m || [];
    if (withProfiles.length > 0) {
      const userIds = withProfiles.map((x) => x.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      withProfiles = withProfiles.map((row) => ({
        ...row,
        profile: byId[row.user_id] || { name: null },
      }));
    }

    // Sort by status (pending first) then role priority.
    const sorted = withProfiles.sort((a, b) => {
      const sa = a.status === "pending" ? -1 : 0;
      const sb = b.status === "pending" ? -1 : 0;
      if (sa !== sb) return sa - sb;
      return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
    });
    setMembers(sorted);
    setInvites(i || []);
    setLoading(false);
  };

  useEffect(() => { if (restaurant?.id) load(); }, [restaurant?.id]);

  const updateMember = async (id, patch) => {
    await supabase.from("restaurant_members").update(patch).eq("id", id);
    load();
    setActionMember(null);
  };

  const removeMember = async (id) => {
    if (!confirm("להסיר את המשתמש מהמסעדה?")) return;
    await supabase.from("restaurant_members").delete().eq("id", id);
    load();
    setActionMember(null);
  };

  const approveMember = (m) => updateMember(m.id, {
    status: "approved",
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  });

  const rejectMember = (m) => updateMember(m.id, { status: "rejected" });

  const cancelInvite = async (id) => {
    await supabase.from("restaurant_invitations").delete().eq("id", id);
    load();
  };

  const pendingCount = members.filter((m) => m.status === "pending").length;

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-14 pb-4 flex items-center gap-3 border-b border-white/5">
        <button onClick={onBack}
          className="w-9 h-9 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center active:bg-white/10">
          <ArrowRight size={16} className="text-gray-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-white font-black text-xl flex items-center gap-2">
            <Users size={18} className="text-brand-400" />
            צוות
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {members.length} חברים{pendingCount > 0 && ` · ${pendingCount} ממתינים לאישור`}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowInvite(true)}
            className="bg-brand-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl active:bg-brand-600 flex items-center gap-1.5 shadow-lg shadow-brand-500/30">
            <UserPlus size={14} />הזמן
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={28} className="text-brand-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Pending invitations (sent but not yet signed up) */}
            {invites.length > 0 && (
              <div>
                <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-2 px-1">
                  הזמנות פתוחות
                </p>
                <div className="space-y-2">
                  {invites.map((inv) => {
                    const role = ROLES[inv.role] || ROLES.viewer;
                    return (
                      <div key={inv.id} className="bg-[#161616] border border-white/5 rounded-2xl p-3.5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Mail size={16} className="text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-bold truncate">{inv.email}</p>
                          <p className="text-gray-500 text-[11px] mt-0.5">{role.label} · ממתין שיצטרף</p>
                        </div>
                        {canManage && (
                          <button onClick={() => cancelInvite(inv.id)}
                            className="w-8 h-8 rounded-xl bg-white/5 text-gray-500 flex items-center justify-center active:bg-white/10">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending members (signed up, waiting approval) */}
            {pendingCount > 0 && (
              <div>
                <p className="text-amber-400 text-[11px] font-bold uppercase tracking-wide mb-2 px-1 flex items-center gap-1">
                  <Clock size={11} />ממתינים לאישורך
                </p>
                <div className="space-y-2">
                  {members.filter((m) => m.status === "pending").map((m) => (
                    <MemberCard key={m.id} m={m} canManage={canManage}
                      onApprove={() => approveMember(m)}
                      onReject={() => rejectMember(m)} />
                  ))}
                </div>
              </div>
            )}

            {/* Active team */}
            <div>
              <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wide mb-2 px-1">
                חברי צוות פעילים
              </p>
              <div className="space-y-2">
                {members.filter((m) => m.status === "approved").map((m) => {
                  const isMe = m.user_id === user?.id;
                  const isOwner = m.role === "owner";
                  return (
                    <MemberCard key={m.id} m={m} isMe={isMe}
                      canManage={canManage && !isOwner}
                      onAction={() => setActionMember(m)} />
                  );
                })}
              </div>
            </div>

            {/* Empty state */}
            {!loading && members.length === 0 && invites.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-white/5 flex items-center justify-center text-4xl mb-4">👥</div>
                <p className="text-white font-bold">אין חברי צוות</p>
                <p className="text-gray-500 text-xs mt-1">הזמן את הצוות שלך לעבוד יחד</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <InviteModal
          restaurant={restaurant}
          inviterId={user.id}
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); load(); }}
        />
      )}

      {/* Action sheet for approved members */}
      {actionMember && (
        <ActionSheet
          member={actionMember}
          onClose={() => setActionMember(null)}
          onChangeRole={(role) => updateMember(actionMember.id, { role })}
          onRemove={() => removeMember(actionMember.id)}
        />
      )}
    </div>
  );
}

// ── Member card ──
function MemberCard({ m, isMe, canManage, onApprove, onReject, onAction }) {
  const role = ROLES[m.role] || ROLES.viewer;
  const Icon = role.icon;
  const isPending = m.status === "pending";
  const profile = m.profile || {};
  const displayName = profile.name || profile.email || "משתמש";
  const initials = (displayName.match(/[֐-׿a-zA-Z]/g) || []).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-3.5 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${role.color} flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-md`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-white text-sm font-bold truncate">{displayName}</p>
          {isMe && <span className="text-brand-400 text-[10px] font-bold">(אני)</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Icon size={11} className="text-gray-500" />
          <span className="text-gray-500 text-[11px] font-semibold">{role.label}</span>
          {profile.email && <span className="text-gray-600 text-[11px] truncate">· {profile.email}</span>}
        </div>
      </div>
      {isPending ? (
        canManage && (
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={onReject}
              className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center active:bg-red-500/20">
              <X size={14} />
            </button>
            <button onClick={onApprove}
              className="w-9 h-9 rounded-xl bg-green-500 text-white flex items-center justify-center active:bg-green-600 shadow-lg shadow-green-500/30">
              <Check size={14} />
            </button>
          </div>
        )
      ) : (
        canManage && (
          <button onClick={onAction}
            className="w-9 h-9 rounded-xl bg-white/5 text-gray-400 flex items-center justify-center active:bg-white/10 flex-shrink-0">
            <MoreVertical size={14} />
          </button>
        )
      )}
    </div>
  );
}

// ── Invite modal ──
function InviteModal({ restaurant, inviterId, onClose, onInvited }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    setErr("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) { setErr("אמייל לא תקין"); return; }
    setSaving(true);
    const { error } = await supabase.from("restaurant_invitations").insert({
      restaurant_id: restaurant.id,
      email: cleanEmail,
      role,
      invited_by: inviterId,
    });
    setSaving(false);
    if (error) {
      setErr(error.code === "23505" ? "הזמנה כבר נשלחה לאמייל זה" : error.message);
      return;
    }
    onInvited();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-end justify-center"
      onClick={onClose}>
      <div className="bg-[#161616] border-t border-white/10 rounded-t-3xl w-full max-w-md p-6 pb-8"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-black text-lg flex items-center gap-2">
            <UserPlus size={18} className="text-brand-400" />הזמן חבר צוות
          </h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
            <X size={16} />
          </button>
        </div>

        <label className="text-gray-500 text-[11px] font-bold uppercase tracking-wide block mb-1.5">אמייל</label>
        <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none focus:border-brand-500 text-left mb-4" />

        <label className="text-gray-500 text-[11px] font-bold uppercase tracking-wide block mb-1.5">תפקיד</label>
        <div className="space-y-2 mb-4">
          {["admin", "manager", "recruiter", "viewer"].map((r) => {
            const meta = ROLES[r];
            const Icon = meta.icon;
            const on = role === r;
            return (
              <button key={r} onClick={() => setRole(r)}
                className={`w-full p-3 rounded-2xl border text-right flex items-center gap-3 transition-all ${
                  on
                    ? "bg-brand-500/15 border-brand-500/40"
                    : "bg-white/5 border-white/10 active:bg-white/10"
                }`}>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-white`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">{meta.label}</p>
                  <p className="text-gray-500 text-[11px] mt-0.5">{ROLE_DESCRIPTIONS[r]}</p>
                </div>
                {on && <Check size={16} className="text-brand-400" />}
              </button>
            );
          })}
        </div>

        {err && <p className="text-red-400 text-xs mb-3 text-center">{err}</p>}

        <button onClick={send} disabled={saving || !email.trim()}
          className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl active:bg-brand-600 disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <><Mail size={16} />שלח הזמנה</>}
        </button>
        <p className="text-gray-600 text-[10px] mt-2 text-center leading-relaxed">
          המוזמן יראה את ההזמנה כשייכנס לאפליקציה עם האמייל הזה
        </p>
      </div>
    </div>
  );
}

// ── Action sheet (change role / remove) ──
function ActionSheet({ member, onClose, onChangeRole, onRemove }) {
  const [changingRole, setChangingRole] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-end justify-center"
      onClick={onClose}>
      <div className="bg-[#161616] border-t border-white/10 rounded-t-3xl w-full max-w-md p-4 pb-8"
        onClick={(e) => e.stopPropagation()}>
        {!changingRole ? (
          <>
            <p className="text-center text-gray-500 text-xs py-3 border-b border-white/5">
              {member.profile?.name || member.profile?.email || "חבר צוות"}
            </p>
            <button onClick={() => setChangingRole(true)}
              className="w-full py-4 text-white font-semibold text-right px-3 active:bg-white/5 border-b border-white/5">
              שנה תפקיד
            </button>
            <button onClick={onRemove}
              className="w-full py-4 text-red-400 font-semibold text-right px-3 active:bg-red-500/10 flex items-center gap-2">
              <Trash2 size={14} />הסר מהמסעדה
            </button>
            <button onClick={onClose}
              className="w-full mt-2 py-3 text-gray-500 font-semibold">ביטול</button>
          </>
        ) : (
          <>
            <p className="text-white font-bold text-center py-3 border-b border-white/5 mb-2">בחר תפקיד חדש</p>
            {["admin", "manager", "recruiter", "viewer"].map((r) => {
              const meta = ROLES[r];
              const on = member.role === r;
              return (
                <button key={r} onClick={() => onChangeRole(r)}
                  className={`w-full py-3 px-3 text-right active:bg-white/5 flex items-center gap-3 ${
                    on ? "bg-brand-500/10" : ""
                  }`}>
                  <span className="flex-1 text-white text-sm font-semibold">{meta.label}</span>
                  {on && <Check size={14} className="text-brand-400" />}
                </button>
              );
            })}
            <button onClick={() => setChangingRole(false)}
              className="w-full mt-2 py-3 text-gray-500 font-semibold">חזרה</button>
          </>
        )}
      </div>
    </div>
  );
}
