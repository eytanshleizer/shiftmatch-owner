import { useState, useEffect } from "react";
import { Mail, Loader2, LogOut, RefreshCw, Check } from "lucide-react";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// VerifyEmailScreen — shown after sign-up if Supabase requires email
// confirmation (project setting: Confirm Email = ON).  Polls every 5s for
// the user's email_confirmed_at to flip, then continues.
// ─────────────────────────────────────────────────────────────────────────────

export default function VerifyEmailScreen({ user, onConfirmed, onSignOut }) {
  const email = user?.email || "";
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt]   = useState(null);
  const [checking, setChecking]   = useState(false);

  const recheck = async () => {
    setChecking(true);
    // Refresh the session — once the user clicks the email link in another
    // tab, Supabase auto-confirms and the next getUser() will reflect it.
    const { data } = await supabase.auth.getUser();
    setChecking(false);
    if (data?.user?.email_confirmed_at) onConfirmed?.();
  };

  // Quiet poll every 5s while the user waits for the email.
  useEffect(() => {
    const t = setInterval(recheck, 5000);
    return () => clearInterval(t);
  }, []);

  const resend = async () => {
    if (!email) return;
    setResending(true);
    await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    setResentAt(Date.now());
    setTimeout(() => setResentAt(null), 10000); // hide the "sent" confirmation after 10s
  };

  return (
    <div className="h-full bg-white flex flex-col items-center justify-center px-6 text-center" dir="rtl">
      <div className="w-20 h-20 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6">
        <Mail size={36} className="text-blue-600" />
      </div>

      <h1 className="text-3xl font-black text-gray-900 leading-tight">בדוק/בדקי את האמייל שלך</h1>
      <p className="text-gray-500 text-sm mt-3 leading-relaxed max-w-xs">
        שלחנו אימייל ל-<b className="text-gray-900" dir="ltr">{email}</b> עם קישור לאישור החשבון.
        לחצ/י עליו כדי להמשיך.
      </p>

      {/* Quiet "we're polling" indicator */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-full px-3.5 py-1.5 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-70" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        <span className="text-gray-700 text-[11px] font-bold">בודק כל 5 שניות</span>
      </div>

      {/* Resend confirmation */}
      <div className="mt-8 space-y-2 w-full max-w-xs">
        <button onClick={recheck} disabled={checking}
          className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-full flex items-center justify-center gap-2 active:bg-gray-800 disabled:opacity-50 shadow-lg shadow-gray-900/10">
          <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
          {checking ? "בודק..." : "בדוק עכשיו"}
        </button>

        <button onClick={resend} disabled={resending || !!resentAt}
          className="w-full bg-gray-100 text-gray-900 font-semibold py-3 rounded-full text-sm active:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2">
          {resending
            ? <><Loader2 size={14} className="animate-spin" />שולח...</>
            : resentAt
              ? <><Check size={14} className="text-green-600" />אימייל נשלח שוב</>
              : "שלח/י לי שוב את האימייל"}
        </button>
      </div>

      <p className="text-[11px] text-gray-400 mt-6 leading-relaxed max-w-xs">
        לא רואה את האימייל? בדוק/בדקי גם בתיקיית הספאם. <br/>
        אם השתמשת באמייל שגוי, התנתק/י והירשם/י עם הכתובת הנכונה.
      </p>

      <button onClick={onSignOut}
        className="text-gray-500 text-sm font-semibold py-3 mt-2 flex items-center gap-1.5">
        <LogOut size={14} />התנתק/י
      </button>
    </div>
  );
}
