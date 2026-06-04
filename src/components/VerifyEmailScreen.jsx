import { useState } from "react";
import { KeyRound, Loader2, LogOut, Check } from "lucide-react";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// VerifyEmailScreen — shown after sign-up if Supabase requires email
// confirmation (project setting: Confirm Email = ON).  The confirmation email
// now contains a 6-digit code (OTP) instead of a link; the user types it here
// and we verify it with supabase.auth.verifyOtp({ type: "signup" }).
// ─────────────────────────────────────────────────────────────────────────────

export default function VerifyEmailScreen({ user, onConfirmed, onSignOut }) {
  const email = user?.email || "";
  const [code, setCode]           = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError]         = useState("");
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt]   = useState(null);

  const verifyCode = async () => {
    const token = code.replace(/\D/g, "").trim();
    if (token.length < 6) { setError("הזן/י את הקוד המלא מהמייל"); return; }
    setError(""); setVerifying(true);
    try {
      const { error: e } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
      if (e) throw e;
      onConfirmed?.();
    } catch {
      setError("הקוד שגוי או שפג תוקפו — נסה/י שוב");
    } finally {
      setVerifying(false);
    }
  };

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
        <KeyRound size={34} className="text-blue-600" />
      </div>

      <h1 className="text-3xl font-black text-gray-900 leading-tight">הזן/י את הקוד</h1>
      <p className="text-gray-500 text-sm mt-3 leading-relaxed max-w-xs">
        שלחנו קוד בן 6 ספרות ל-<b className="text-gray-900" dir="ltr">{email}</b>.
        הזן/י אותו כאן כדי לאמת את החשבון.
      </p>

      {/* Code input */}
      <input
        value={code}
        onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
        onKeyDown={(e) => e.key === "Enter" && verifyCode()}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="••••••"
        dir="ltr"
        className="mt-7 w-72 text-center tracking-[0.3em] text-3xl font-black bg-gray-50 border-2 border-gray-200 rounded-2xl py-4 text-gray-900 placeholder-gray-300 outline-none focus:bg-white focus:border-gray-900 transition-colors"
      />

      {error && <p className="text-red-600 text-sm font-semibold mt-3">{error}</p>}

      <div className="mt-7 space-y-2 w-full max-w-xs">
        <button onClick={verifyCode} disabled={verifying || code.length < 6}
          className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-full flex items-center justify-center gap-2 active:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 shadow-lg shadow-gray-900/10">
          {verifying && <Loader2 size={16} className="animate-spin" />}
          {verifying ? "מאמת..." : "אימות"}
        </button>

        <button onClick={resend} disabled={resending || !!resentAt}
          className="w-full bg-gray-100 text-gray-900 font-semibold py-3 rounded-full text-sm active:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2">
          {resending
            ? <><Loader2 size={14} className="animate-spin" />שולח...</>
            : resentAt
              ? <><Check size={14} className="text-green-600" />קוד חדש נשלח</>
              : "שלח/י לי קוד חדש"}
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
