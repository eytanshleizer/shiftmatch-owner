import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, Sparkles } from "lucide-react";
import { logEvent } from "../lib/tracking";

export default function AuthScreen() {
  const [mode, setMode]       = useState(null); // null | "register" | "login"
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]       = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "register") {
        const { data: authData, error: e } = await supabase.auth.signUp({
          email, password,
          options: { data: { name, role: "restaurant" } },
        });
        if (e) throw e;
        if (authData.user) {
          await supabase.from("profiles").upsert({
            id: authData.user.id,
            name, email, role: "restaurant", onboarded: false,
          });
          logEvent("restaurant", "signup", {
            user_id: authData.user.id, owner_name: name, email,
          });
        }
      } else {
        const { data: authData, error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
        if (authData?.user?.id) {
          logEvent("restaurant", "login", { user_id: authData.user.id, email });
        }
      }
    } catch (e) {
      setError(
        e.message === "Invalid login credentials" ? "אימייל או סיסמה שגויים" :
        e.message === "User already registered" ? "המשתמש כבר רשום — התחבר/י" :
        e.message.includes("Password") ? "סיסמה חייבת להיות לפחות 6 תווים" :
        e.message
      );
    } finally {
      setLoading(false);
    }
  };

  // ── LANDING (when no mode selected) ──
  if (!mode) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-[#0F0F0F] via-[#0F0F0F] to-[#1a1a1a] relative overflow-hidden">
        {/* Decorative gradient blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-brand-500/30 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

        <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
          {/* Hero */}
          <div className="text-7xl mb-6 animate-pulse" style={{ animationDuration: "3s" }}>🍽️</div>
          <h1 className="text-4xl font-black text-white text-center tracking-tight leading-tight">
            ShiftMatch
          </h1>
          <p className="text-gray-400 text-center text-sm mt-3 leading-relaxed max-w-xs">
            הדרך הכי חכמה לגייס עובדים<br/>למסעדה שלך — עם AI
          </p>

          {/* Features */}
          <div className="mt-8 space-y-2 w-full max-w-xs">
            {[
              { emoji: "🤖", text: "גיוס עובדים ללא מאמץ" },
              { emoji: "⚡", text: "מודעה פעילה ב-30 שניות" },
              { emoji: "✨", text: "מועמדים מותאמים אישית" },
            ].map(({emoji, text}) => (
              <div key={text} className="flex items-center gap-3 bg-white/5 backdrop-blur rounded-2xl px-4 py-3">
                <span className="text-xl">{emoji}</span>
                <span className="text-gray-300 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-10 safe-bottom relative z-10">
          <button onClick={() => setMode("register")}
            className="w-full bg-brand-500 text-white font-black py-5 rounded-3xl text-lg active:bg-brand-600 shadow-2xl shadow-brand-500/40 flex items-center justify-center gap-2">
            <Sparkles size={20} fill="white" />
            הרשמה — חינם
          </button>
          <button onClick={() => setMode("login")}
            className="w-full text-gray-400 text-sm font-medium mt-4 active:text-white">
            כבר יש לי חשבון? <span className="text-brand-400 font-semibold">כניסה</span>
          </button>
        </div>
      </div>
    );
  }

  // ── LOGIN OR REGISTER FORM ──
  return (
    <div className="h-full flex flex-col bg-[#0F0F0F] px-6 pt-12 pb-6 safe-top">
      <button onClick={() => { setMode(null); setError(""); }}
        className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-6">
        <ArrowLeft size={18} className="text-gray-400" style={{ transform: "rotate(180deg)" }} />
      </button>

      <h1 className="text-3xl font-black text-white">
        {mode === "register" ? "ברוכים הבאים 👋" : "ברוכים השבים"}
      </h1>
      <p className="text-gray-500 text-sm mt-1.5 mb-8">
        {mode === "register" ? "בואו נצור לך חשבון בכמה שניות" : "כניסה לחשבון הקיים שלך"}
      </p>

      <div className="flex flex-col gap-3 flex-1">
        {mode === "register" && (
          <Field icon="👤" placeholder="השם המלא שלך" value={name} onChange={setName} />
        )}
        <Field icon={<Mail size={16}/>} placeholder="אימייל" value={email} onChange={setEmail} type="email" />
        <Field
          icon={<Lock size={16}/>} placeholder="סיסמה (לפחות 6 תווים)"
          value={password} onChange={setPassword}
          type={showPw ? "text" : "password"}
          right={<button onClick={()=>setShowPw(!showPw)}>{showPw ? <EyeOff size={16}/> : <Eye size={16}/>}</button>}
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl py-3 px-4 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <button onClick={submit} disabled={loading || !email || password.length < 6 || (mode==="register" && !name.trim())}
          className="w-full bg-brand-500 text-white font-black py-4 rounded-2xl text-base mt-2 active:bg-brand-600 disabled:opacity-40 disabled:bg-white/10 flex items-center justify-center gap-2 shadow-xl shadow-brand-500/30">
          {loading ? <Loader2 size={18} className="animate-spin"/> : null}
          {loading ? "..." : mode === "register" ? "צור חשבון" : "כניסה"}
        </button>

        {mode === "register" && (
          <p className="text-[11px] text-gray-500 text-center leading-relaxed mt-1">
            👥 לאחר ההרשמה תוכל/י להזמין צוות נוסף<br/>
            (מנהלים, מגייסים, צופים) עם תפקידים שונים
          </p>
        )}
      </div>

      <p className="text-center text-xs text-gray-600 mt-4">
        בלחיצה על "צור חשבון" את/ה מסכים/ה לתנאי השימוש
      </p>
    </div>
  );
}

function Field({ icon, placeholder, value, onChange, type = "text", right = null }) {
  return (
    <div className="relative">
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 flex items-center justify-center w-5">
        {typeof icon === "string" ? <span className="text-base">{icon}</span> : icon}
      </div>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 text-white placeholder-gray-600 rounded-2xl py-4 px-4 pr-12 pl-12 text-sm outline-none focus:bg-white/10 focus:ring-2 focus:ring-brand-500/40 border border-white/5"
      />
      {right && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">{right}</div>
      )}
    </div>
  );
}
