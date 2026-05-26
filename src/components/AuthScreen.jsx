import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, ChevronLeft, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { logEvent } from "../lib/tracking";

// ─────────────────────────────────────────────────────────────────────────────
// AuthScreen — registration + login + forgot password.
//
// Registration flow now follows SEPARATION_SPEC.md:
//   1. Collect: full name, restaurant name, city, email, password (≥8).
//   2. Tap "המשך" → POST /api/verify-restaurant to check:
//        a. already_taken — another owner has that name+city.  Block.
//        b. exists_on_web === false (only when Google Places key is configured)
//           → soft warning, allow "yes, continue".
//   3. If clear, call supabase.auth.signUp() and persist the suggested
//      restaurant name + city onto profiles so the wizard can pre-fill.
//
// The actual restaurant row is NOT created here.  It only gets created
// after the user completes WizardOnboarding.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_PW = 8;

export default function AuthScreen() {
  const [mode, setMode]               = useState(null); // null | login | register | forgot
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [name, setName]               = useState("");
  const [restaurantName, setRestName] = useState("");
  const [city, setCity]               = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [resetSent, setResetSent]     = useState(false);

  // For the "not found on the web" soft warning case.
  const [softWarning, setSoftWarning] = useState(null);  // { name, city } once acknowledged
  const [pendingVerify, setPendingVerify] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "register") {
        if (password.length < MIN_PW)   throw new Error("PW_SHORT");
        if (!name.trim())               throw new Error("NAME_REQ");
        if (!restaurantName.trim())     throw new Error("REST_REQ");
        if (!city.trim())               throw new Error("CITY_REQ");

        // Step 1: verify the proposed restaurant unless user already
        // ack'd the "not found on the web" warning for these exact values.
        const alreadyAck = softWarning &&
          softWarning.name === restaurantName.trim() &&
          softWarning.city === city.trim();

        if (!alreadyAck) {
          setPendingVerify(true);
          const r = await fetch("/api/verify-restaurant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: restaurantName, city }),
          });
          const v = await r.json().catch(() => ({}));
          setPendingVerify(false);

          if (v.already_taken) {
            throw new Error("RESTAURANT_TAKEN");
          }
          // Only block on exists_on_web=false when Places actually answered
          // (verification_source === "google_places").  If we couldn't check
          // (no key / network), skip the soft warning silently.
          if (v.exists_on_web === false && v.verification_source === "google_places") {
            // Soft warning — user can confirm and retry.
            setSoftWarning({ name: restaurantName.trim(), city: city.trim() });
            setLoading(false);
            return;
          }
        }

        // Step 2: create the auth user + profile.
        const { data: authData, error: e } = await supabase.auth.signUp({
          email, password,
          options: {
            data: {
              name,
              restaurant_name: restaurantName,
              restaurant_city: city,
              role: "restaurant",
            },
          },
        });
        if (e) throw e;
        if (authData.user) {
          await supabase.from("profiles").upsert({
            id: authData.user.id,
            name, email, role: "restaurant",
            onboarded: false,
            suggested_restaurant_name: restaurantName,
            suggested_city: city,
          });
          logEvent("restaurant", "signup", {
            user_id: authData.user.id, owner_name: name,
            restaurant_name: restaurantName, restaurant_city: city, email,
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
      const msg = e?.message || "";
      setError(
        msg === "PW_SHORT"          ? `סיסמה חייבת להיות לפחות ${MIN_PW} תווים` :
        msg === "NAME_REQ"          ? "חסר שם מלא" :
        msg === "REST_REQ"          ? "חסר שם המסעדה" :
        msg === "CITY_REQ"          ? "חסר שם העיר" :
        msg === "RESTAURANT_TAKEN"  ? "מסעדה בשם הזה בעיר הזו כבר רשומה. אם זו המסעדה שלך, פנה/י לתמיכה." :
        msg === "Invalid login credentials" ? "אימייל או סיסמה שגויים" :
        msg === "User already registered"   ? "המשתמש כבר רשום — התחבר/י" :
        /Password/i.test(msg) ? `סיסמה חייבת להיות לפחות ${MIN_PW} תווים` :
        msg || "שגיאה — נסה שוב"
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Landing ────────────────────────────────────────────────────────
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
            כבר יש לי חשבון? <span className="text-gray-900 underline">כניסה</span>
          </button>
        </div>
      </Frame>
    );
  }

  // ── Registration / Login / Forgot ──────────────────────────────────
  return (
    <Frame>
      <div className="px-5 pt-4 flex items-center justify-between safe-top">
        <button onClick={() => { setMode(null); setError(""); setResetSent(false); setSoftWarning(null); }}
          aria-label="חזרה"
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200">
          <ChevronLeft size={20} className="text-gray-700 -scale-x-100" />
        </button>
        <SmallLogo />
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col px-6 pt-8 overflow-y-auto">
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
              <Field placeholder="שם המסעדה"     value={restaurantName} onChange={setRestName} />
              <Field placeholder="עיר"           value={city} onChange={setCity} />
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

          {/* Soft warning when Places couldn't find the restaurant */}
          {softWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-amber-800 text-xs leading-relaxed">
                לא הצלחנו לאתר את <b>{softWarning.name}</b> ברשת. אם המסעדה חדשה
                לגמרי או לא מופיעה ב-Google — אפשר להמשיך.
                <button onClick={submit}
                  className="block w-full mt-2 bg-amber-600 text-white text-xs font-bold py-2 rounded-xl active:bg-amber-700">
                  כן, להמשיך בהרשמה
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl py-3 px-4 text-red-700 text-sm text-center">
              {error}
            </div>
          )}

          {resetSent && mode === "forgot" && (
            <div className="bg-green-50 border border-green-100 rounded-2xl py-3 px-4 text-green-700 text-sm text-center">
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

        <div className="pb-8 safe-bottom pt-2">
          <PrimaryButton
            onClick={() => { setSoftWarning(null); submit(); }}
            disabled={
              loading || pendingVerify ||
              !email ||
              (mode === "register" && (password.length < MIN_PW || !name.trim() || !restaurantName.trim() || !city.trim())) ||
              (mode === "login"    && password.length < MIN_PW)
            }
            loading={loading || pendingVerify}
          >
            {pendingVerify ? "בודק שהמסעדה זמינה..."
              : mode === "register" ? "המשך"
              : mode === "forgot"   ? "שלח קישור איפוס"
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

// ── Presentational ──

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
