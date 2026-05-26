import { useState } from "react";
import { Sparkles, LogOut, Trash2, KeyRound, ChevronLeft, Loader2, X } from "lucide-react";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState — landing screen for a logged-in user who hasn't set up their
// restaurant yet.  Big CTA to start the onboarding wizard, plus a profile
// menu where they can change password / delete account / sign out.
// ─────────────────────────────────────────────────────────────────────────────

export default function EmptyState({ user, onStart, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const userName = (user?.user_metadata?.name || "").trim();
  const firstName = userName.split(/\s+/)[0] || "";
  const suggested = user?.user_metadata?.restaurant_name?.trim();

  return (
    <div className="h-full bg-white flex flex-col text-gray-900" dir="rtl">

      {/* Top bar with profile button */}
      <div className="px-4 pt-12 flex items-center justify-between safe-top">
        <button onClick={() => setMenuOpen(true)}
          className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-700 text-xs active:bg-gray-200">
          {firstName ? firstName[0].toUpperCase() : "👤"}
        </button>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
            <span className="text-white text-sm">🍽️</span>
          </div>
          <span className="text-base font-black text-gray-900 tracking-tight">ShiftMatch</span>
        </div>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gray-900 flex items-center justify-center mb-6 shadow-xl shadow-gray-900/20">
          <span className="text-3xl">🍽️</span>
        </div>

        <h1 className="text-3xl font-black text-gray-900 leading-tight">
          {firstName ? `שלום ${firstName} 👋` : "ברוך/ה הבא/ה 👋"}
        </h1>
        <p className="text-gray-500 text-sm mt-3 leading-relaxed max-w-xs">
          {suggested
            ? <>נמשיך להגדיר את <b className="text-gray-900">{suggested}</b>?<br/>2 דקות וההתחלנו לגייס.</>
            : <>בואו נגדיר את המסעדה שלך — 2 דקות וההתחלנו לגייס.</>}
        </p>

        {/* Quick value cards (like landing page) */}
        <div className="mt-10 grid grid-cols-3 gap-3 w-full max-w-sm">
          {[
            { e: "⚡", t: "פרסום ב-2 דקות" },
            { e: "🎯", t: "התאמה חכמה" },
            { e: "👥", t: "צוות שלם בחשבון" },
          ].map((x) => (
            <div key={x.t} className="bg-gray-50 border border-gray-100 rounded-2xl px-2 py-3 text-center">
              <div className="text-2xl mb-1">{x.e}</div>
              <div className="text-[11px] text-gray-700 font-semibold leading-tight">{x.t}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-8 safe-bottom">
        <button onClick={onStart}
          className="w-full bg-gray-900 text-white font-bold py-4 rounded-full text-base active:bg-gray-800 flex items-center justify-center gap-2 shadow-lg shadow-gray-900/20">
          <Sparkles size={18} fill="white" />
          {suggested ? "המשך הגדרה" : "התחל הגדרת המסעדה"}
        </button>
        <p className="text-[11px] text-gray-400 text-center mt-3">
          תוכל/י להמשיך מאיפה שהפסקת בכל זמן.
        </p>
      </div>

      {menuOpen && (
        <ProfileMenu
          user={user}
          onClose={() => setMenuOpen(false)}
          onSignOut={() => { setMenuOpen(false); onSignOut(); }}
          onDelete={() => { setMenuOpen(false); setConfirmDelete(true); }}
        />
      )}

      {confirmDelete && (
        <DeleteConfirm onClose={() => setConfirmDelete(false)} onSignOut={onSignOut} />
      )}
    </div>
  );
}

// ── Profile menu (slide-in from right in RTL) ──
function ProfileMenu({ user, onClose, onSignOut, onDelete }) {
  const [sentReset, setSentReset] = useState(false);
  const [working, setWorking] = useState(false);

  const passwordReset = async () => {
    if (!user?.email) return;
    setWorking(true);
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    setWorking(false);
    setSentReset(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-8"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-900 font-black text-lg">חשבון</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200">
            <X size={16} />
          </button>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
          <p className="text-gray-900 font-bold text-sm">{user?.user_metadata?.name || "משתמש"}</p>
          <p className="text-gray-500 text-xs mt-0.5" dir="ltr">{user?.email}</p>
        </div>

        <div className="space-y-1">
          <button onClick={passwordReset} disabled={working || sentReset}
            className="w-full flex items-center gap-3 py-3 px-3 rounded-xl active:bg-gray-50 text-right disabled:opacity-50">
            <KeyRound size={16} className="text-gray-500" />
            <span className="flex-1 text-gray-900 text-sm font-semibold">
              {sentReset ? "✓ שלחנו אימייל איפוס" : "שינוי סיסמה"}
            </span>
          </button>

          <button onClick={onSignOut}
            className="w-full flex items-center gap-3 py-3 px-3 rounded-xl active:bg-gray-50 text-right">
            <LogOut size={16} className="text-gray-500" />
            <span className="flex-1 text-gray-900 text-sm font-semibold">התנתקות</span>
          </button>

          <div className="border-t border-gray-100 my-2" />

          <button onClick={onDelete}
            className="w-full flex items-center gap-3 py-3 px-3 rounded-xl active:bg-red-50 text-right">
            <Trash2 size={16} className="text-red-600" />
            <span className="flex-1 text-red-600 text-sm font-semibold">מחיקת חשבון</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ──
function DeleteConfirm({ onClose, onSignOut }) {
  const [confirmText, setConfirmText] = useState("");
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");

  const ready = confirmText.trim() === "מחק";

  const confirm = async () => {
    if (!ready) return;
    setWorking(true); setErr("");
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setErr(error.message || "שגיאה במחיקה");
      setWorking(false);
      return;
    }
    // The auth session is now orphaned — sign out cleanly.
    await supabase.auth.signOut();
    onSignOut();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 mx-auto rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
          <Trash2 size={24} className="text-red-600" />
        </div>
        <h3 className="text-gray-900 font-black text-xl text-center mb-2">מחיקת חשבון</h3>
        <p className="text-gray-600 text-sm leading-relaxed text-center mb-5">
          זה ימחק את החשבון, המסעדה ואת כל הנתונים שלך לתמיד.
          <br/>הפעולה לא ניתנת לביטול.
        </p>

        <label className="text-gray-600 text-[11px] font-bold uppercase tracking-wide block mb-1.5">
          כדי להמשיך, הקלד/י "מחק"
        </label>
        <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
          placeholder="מחק"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm outline-none focus:bg-white focus:border-red-500 mb-4" />

        {err && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl px-4 py-2.5 text-center mb-3">
            {err}
          </div>
        )}

        <button onClick={confirm} disabled={!ready || working}
          className="w-full bg-red-600 text-white font-bold py-4 rounded-full active:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center gap-2">
          {working ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={16} />}
          מחק לתמיד
        </button>
        <button onClick={onClose}
          className="w-full text-gray-500 text-sm font-semibold py-3 mt-1">ביטול</button>
      </div>
    </div>
  );
}
