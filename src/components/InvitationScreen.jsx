import { useState } from "react";
import { Mail, Check, X, LogOut, Loader2, Store } from "lucide-react";
import { supabase } from "../lib/supabase";

/**
 * Shown when the logged-in user has a pending invitation matched by email
 * (no membership row yet).  Accepting creates a pending member row;
 * the next App boot will show the PendingApprovalScreen.
 */
export default function InvitationScreen({ user, invitation, onAccepted, onSignOut }) {
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");

  const accept = async () => {
    setWorking(true); setErr("");
    // The owner already chose this user's role when sending the invite, so
    // accepting it makes them an APPROVED member immediately — no separate
    // owner-side approval step.
    const { error: insErr } = await supabase.from("restaurant_members").insert({
      restaurant_id: invitation.restaurant_id,
      user_id: user.id,
      role: invitation.role,
      status: "approved",
      invited_by: invitation.invited_by,
      approved_by: invitation.invited_by,
      approved_at: new Date().toISOString(),
    });
    if (insErr) {
      setErr(insErr.message);
      setWorking(false);
      return;
    }
    // Mark invitation as accepted so it disappears from the owner's "pending invites" list.
    await supabase.from("restaurant_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);
    setWorking(false);
    onAccepted?.();
  };

  const decline = async () => {
    setWorking(true);
    await supabase.from("restaurant_invitations").delete().eq("id", invitation.id);
    setWorking(false);
    onSignOut();
  };

  const r = invitation.restaurant || {};

  return (
    <div className="h-full bg-[#0A0A0A] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-brand-500/15 flex items-center justify-center mb-5">
        <Mail size={36} className="text-brand-400" />
      </div>

      <h1 className="text-white font-black text-2xl mb-2">הוזמנת לצוות</h1>
      <p className="text-gray-400 text-sm leading-relaxed max-w-xs mb-6">
        בעל/ת המסעדה הזמין/ה אותך כ<b className="text-white">{ROLE_LABELS[invitation.role] || invitation.role}</b> במסעדה:
      </p>

      <div className="bg-[#161616] border border-white/10 rounded-2xl p-5 mb-6 w-full max-w-sm flex items-center gap-3">
        {r.image_url ? (
          <img src={r.image_url} alt={r.name} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
            <Store size={22} className="text-gray-500" />
          </div>
        )}
        <div className="flex-1 text-right min-w-0">
          <p className="text-white font-bold text-base">{r.name || "מסעדה"}</p>
          <p className="text-gray-500 text-xs mt-0.5 truncate">
            {r.city}{r.area ? ` · ${r.area}` : ""}
          </p>
        </div>
      </div>

      {err && <p className="text-red-400 text-xs mb-3">{err}</p>}

      <div className="flex gap-2 w-full max-w-sm">
        <button onClick={decline} disabled={working}
          className="flex-1 bg-white/5 border border-white/10 text-gray-300 font-bold py-3.5 rounded-2xl active:bg-white/10 flex items-center justify-center gap-2 disabled:opacity-50">
          <X size={16} />דחה
        </button>
        <button onClick={accept} disabled={working}
          className="flex-1 bg-brand-500 text-white font-bold py-3.5 rounded-2xl active:bg-brand-600 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-brand-500/30">
          {working ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} />קבל הזמנה</>}
        </button>
      </div>

      <button onClick={onSignOut} className="text-gray-500 text-xs font-semibold py-4 mt-2 flex items-center gap-1.5">
        <LogOut size={12} />התנתק/י עם משתמש אחר
      </button>
    </div>
  );
}

const ROLE_LABELS = {
  admin: "מנהל ראשי",
  manager: "מנהל",
  recruiter: "מגייס",
  viewer: "צפייה בלבד",
};
