import { useState } from "react";
import { CheckCircle, Crown, Zap, Sparkles } from "lucide-react";

const PLANS = [
  {
    id: "free",
    name: "חינמי",
    price: 0,
    emoji: "🆓",
    description: "להתחיל ולנסות",
    features: [
      "מודעה אחת פעילה",
      "פניות ללא הגבלה",
      "מועמדי AI מוואטסאפ",
      "פאנל ניהול מלא",
    ],
  },
  {
    id: "pro",
    name: "פרו",
    price: 199,
    emoji: "⚡",
    badge: "הכי פופולרי",
    color: "brand",
    description: "לעסקים שרוצים לגדול",
    features: [
      "מודעה מודגשת בחיפוש",
      "תגית \"מומלץ\" על הכרטיס",
      "חשיפה ×4 ממודעה רגילה",
      "התראות WhatsApp על פניות",
      "סטטיסטיקות מתקדמות",
    ],
  },
  {
    id: "business",
    name: "עסקי",
    price: 399,
    emoji: "👑",
    color: "purple",
    description: "לרשתות ועסקים גדולים",
    features: [
      "עד 5 מודעות פעילות",
      "דחיפה אוטומטית 4× ביום",
      "מודעה ראשונה בעמוד הבית",
      "תמיכה אישית בוואטסאפ",
      "גישה מוקדמת למועמדי AI",
    ],
  },
];

export default function PlansTab({ user, restaurant }) {
  const [loading, setLoading] = useState(null);
  const current = restaurant?.subscription_tier || "free";

  const upgrade = async (planId) => {
    alert(`בקרוב! תשלום ל${PLANS.find(p=>p.id===planId)?.name} — נחבר למשולם בקרוב`);
  };

  const currentPlan = PLANS.find(p => p.id === current) || PLANS[0];

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-14 pb-6"
        style={{ background: "linear-gradient(160deg, #1a0a2e 0%, #0A0A0A 70%)" }}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl -translate-y-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Crown size={18} className="text-yellow-400" fill="#facc15" />
            <span className="text-gray-400 text-sm font-medium">התוכנית שלך</span>
          </div>
          <h1 className="text-white text-2xl font-black">{currentPlan.name}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {current === "free" ? "שדרג לחשיפה מקסימלית ✨" : "תודה שאתה שותף שלנו 🙏"}
          </p>
        </div>
      </div>

      <div className="px-4 space-y-3 -mt-1">
        {PLANS.map((plan, idx) => {
          const isCurrent = plan.id === current;
          const isLoading = loading === plan.id;
          const isPro     = plan.color === "brand";
          const isPurple  = plan.color === "purple";

          return (
            <div key={plan.id}
              className={`rounded-3xl p-5 relative border transition-all ${
                isPro    ? "bg-gradient-to-br from-brand-500/12 to-brand-600/5 border-brand-500/30" :
                isPurple ? "bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/25" :
                           "bg-[#161616] border-white/5"
              } ${isCurrent ? "ring-1 ring-brand-500/40" : ""}`}>

              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-brand-500/40 flex items-center gap-1">
                    <Sparkles size={9} fill="white" /> {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{plan.emoji}</span>
                    <div>
                      <h3 className="text-white font-black text-lg leading-none">{plan.name}</h3>
                      <p className="text-gray-500 text-xs mt-0.5">{plan.description}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className={`text-3xl font-black ${isPro ? "text-brand-400" : isPurple ? "text-purple-400" : "text-white"}`}>
                      {plan.price === 0 ? "חינם" : `₪${plan.price}`}
                    </span>
                    {plan.price > 0 && <span className="text-gray-500 text-sm">/חודש</span>}
                  </div>
                </div>
                {isCurrent && (
                  <span className="text-[10px] font-bold bg-green-500/15 text-green-400 px-2.5 py-1 rounded-full border border-green-500/25 flex items-center gap-1 flex-shrink-0 mt-1">
                    <CheckCircle size={9} />פעיל
                  </span>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-4">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle size={13} className={`flex-shrink-0 ${isPro ? "text-brand-400" : isPurple ? "text-purple-400" : "text-green-500"}`} />
                    <span className="text-gray-400">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {!isCurrent && (
                <button onClick={() => upgrade(plan.id)} disabled={!!loading}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-40 transition-all ${
                    isPro    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30" :
                    isPurple ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" :
                               "bg-white/10 text-white border border-white/10"
                  }`}>
                  {isLoading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Zap size={14} fill="currentColor" />שדרג ל{plan.name}</>
                  }
                </button>
              )}
            </div>
          );
        })}

        <p className="text-center text-xs text-gray-600 py-2">
          🔒 תשלום מאובטח · ביטול בכל עת · ללא התחייבות
        </p>
      </div>
    </div>
  );
}
