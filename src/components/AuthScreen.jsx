import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, ArrowLeft, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { logEvent } from "../lib/tracking";

// ─────────────────────────────────────────────────────────────────────────────
// AuthScreen — Fireberry-inspired light-theme entry.
// Layout: white background, big brand mark, single focused question/field per
// view, full-width dark CTA at the bottom, RTL Hebrew throughout.
// Three views: landing → login | register | forgot.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_PW = 8;

export default function AuthScreen() {
  const [mode, setMode]               = useState(null); // null | login | register | forgot
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [name, setName]               = useState("");
  const [restaurantName, setRestName] = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [resetSent, setResetSent]     = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "register") {
        if (password.length < MIN_PW) throw new Error("PW_SHORT");
        const { data: authData, error: e } = await supabase.auth.signUp({
          email, password,
          options: { data: { name, restaurant_name: restaurantName, role: "restaurant" } },
        });
        if (e) throw e;
        if (authData.user) {
          await supabase.from("profiles").upsert({
            id: authData.user.id,
            name, email, role: "restaurant", onboarded: false,
          });
          logEvent("restaurant", "signup", {
            user_id: authData.user.id, owner_name: name,
            restaurant_name: restaurantName, email,
          });
        }
      } else if (mode === "login") {
        const { data: authData, error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
        if (authData?.user?.id) logEvent("restaurant", "login", { user_id: authData.user.id, email });
      } else if (mode === "forgot") {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        });
        if (e) throw e;
        setResetSent(true);
      }
    } catch (e) {
      setError(
        e.message === "PW_SHORT" ? `סיסמה חייבת להיות לפחות ${MIN_PW} תווים` :
        e.message === "Invalid login credentials" ? "אימייל או סיסמה שגויים" :
        e.message === "User already registered" ? "המשתמש כבר רשום — התחבר/י" :
        /Password/i.test(e.message || "") ? `סיסמה חייבת להיות לפחות ${MIN_PW} תווים` :
        e.message
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Landing view ──────────────────────────────────────────────────────
  if (!mode) {
    return (
      <Frame>
        <Logo />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl font-black text-gray-900 leading-tight">
            הצוות שלך מתחיל כאן.
          </h1>
          <p className="text-gray-500 text-sm mt-3 leading-relaxed max-w-xs">
            פלטפורמת הגיוס הראשונה בישראל שמיועדת אך ורק למסעדות.
          </p>

          {/* Three quick value bullets in a soft card row */}
          <div className="mt-10 grid grid-cols-3 gap-3 w-full max-w-sm">
            {[
              { e: "⚡",  t: "פרסום ב-2 דקות" },
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

        <div className="px-6 pb-8 space-y-3 safe-bottom">
          <PrimaryButton onClick={() => setMode("register")}>צור חשבון מסעדה</PrimaryButton>
          <button onClick={() => setMode("login")}
            className="w-full text-gray-600 text-sm font-semibold py-2">
            כבר יש לך חשבון? <span className="text-gray-900 underline">כניסה</span>
          </button>
        </div>
      </Frame>
    );
  }

  // ── Registration / Login / Forgot view ────────────────────────────────
  return (
    <Frame>
      {/* Back button + small logo on top */}
      <div className="px-5 pt-4 flex items-center justify-between safe-top">
        <button onClick={() => { setMode(null); setError(""); setResetSent(false); }}
          aria-label="חזרה"
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
          <ChevronLeft size={20} className="text-gray-700 -scale-x-100" />
        </button>
        <SmallLogo />
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col px-6 pt-8">
        <h1 className="text-2xl font-black text-gray-900 leading-tight">
          {mode === "register" ? "בואו נכיר" :
           mode === "forgot"   ? "איפוס סיסמה" :
                                  "ברוך/ה השוב/ה"}
        </h1>
        <p className="text-gray-500 text-sm mt-2 mb-7">
          {mode === "register" ? "כמה פרטים בסיסיים ואנחנו בדרך"
            : mode === "forgot" ? "נשלח לאמייל שלך קישור איפוס"
            : "הזן/י את הפרטים כדי להתחבר"}
        </p>

        <div className="space-y-3 flex-1">
          {mode === "register" && (
            <>
              <Field placeholder="השם המלא שלך" value={name} onChange={setName} />
              <Field placeholder="שם המסעדה (אופציונלי אם הוזמנת)"
                value={restaurantName} onChange={setRestName} />
            </>
          )}

          <Field placeholder="אימייל" type="email" value={email} onChange={setEmail} />

          {mode !== "forgot" && (
            <Field
              placeholder={`סיסמה (לפחות ${MIN_PW} תווים)`}
              type={showPw ? "text" : "password"}
              value={password} onChange={setPassword}
              right={
                <button onClick={() => setShowPw((v) => !v)}
                  className="text-gray-400 active:text-gray-700">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl py-3 px-4 text-red-700 text-sm text-center">
              {error}
            </div>
          )}
          {resetSent && mode === "forgot" && (
            <div className="bg-green-50 border border-green-100 rounded-xl py-3 px-4 text-green-700 text-sm text-center">
              ✓ שלחנו אימייל עם קישור איפוס (אם החשבון קיים)
            </div>
          )}

          {mode === "login" && !resetSent && (
            <button onClick={() => { setMode("forgot"); setError(""); setPassword(""); }}
              className="text-gray-500 text-xs font-semibold underline self-start mt-1">
              שכחת סיסמה?
            </button>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="pb-8 safe-bottom">
          <PrimaryButton
            onClick={submit}
            disabled={
              loading ||
              !email ||
              (mode === "register" && (password.length < MIN_PW || !name.trim())) ||
              (mode === "login"    && password.length < MIN_PW)
            }
            loading={loading}
          >
            {mode === "register" ? "המשך"
              : mode === "forgot" ? "שלח קישור איפוס"
              : "כניסה"}
          </PrimaryButton>
          {mode === "register" && (
            <p className="text-[11px] text-gray-400 text-center mt-3 leading-relaxed">
              בלחיצה על "המשך" את/ה מסכים/ה לתנאי השימוש ומדיניות הפרטיות
            </p>
          )}
        </div>
      </div>
    </Frame>
  );
}

// ── Local presentational components ──────────────────────────────────────

function Frame({ children }) {
  return (
    <div className="h-full bg-white flex flex-col text-gray-900" dir="rtl">
      {children}
    </div>
  );
}

function Logo() {
  return (
    <div className="pt-12 pb-6 flex items-center justify-center safe-top">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
          <span className="text-white text-xl">🍽️</span>
        </div>
        <span className="text-2xl font-black text-gray-900 tracking-tight">ShiftMatch</span>
      </div>
    </div>
  );
}

function SmallLogo() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
        <span className="text-white text-sm">🍽️</span>
      </div>
      <span className="text-base font-black text-gray-900 tracking-tight">ShiftMatch</span>
    </div>
  );
}

function Field({ placeholder, value, onChange, type = "text", right }) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 placeholder-gray-400 text-base outline-none focus:bg-white focus:border-gray-900 transition-colors"
      />
      {right && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2">{right}</div>
      )}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, loading }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full bg-gray-900 text-white font-bold py-4 rounded-full text-base active:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10">
      {loading && <Loader2 size={18} className="animate-spin" />}
      {children}
    </button>
  );
}
