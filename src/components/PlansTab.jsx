import { useState } from "react";
import { Check, Crown, Zap, Sparkles, X, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// PlansTab — white, premium subscription page.
// Urgent ₪79 (one-time boost) is now a separate purchase here, not on Jobs.
// ─────────────────────────────────────────────────────────────────────────────

const URGENT_PRICE = 79;

const PLANS = [
  {
    id: "free",
    name: "חינמי",
    price: 0,
    description: "להתחיל ולהבין את הכלי",
    features: [
      "מודעה אחת פעילה",
      "פניות ללא הגבלה",
      "פאנל ניהול בסיסי",
      "תזמון ראיונות",
    ],
  },
  {
    id: "pro",
    name: "פרו",
    price: 199,
    badge: "הכי פופולרי",
    description: "למסעדה שרוצה לגדול",
    features: [
      "מודעה מודגשת בחיפוש",
      'תגית "מומלץ" על הכרטיס',
      "חשיפה ×4 ממודעה רגילה",
      "התראות WhatsApp על פניות",
      "ייצוא רשימת מועמדים",
      "תמיכה מועדפת",
    ],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "בלעדי",
    price: 499,
    description: "לרשתות ומסעדות מובילות",
    features: [
      "כל מה שב-פרו, פלוס:",
      "מספר מודעות במקביל",
      "מנהל חשבון אישי",
      "אינטגרציה מותאמת",
      "API + Webhooks",
      "SLA 99.9%",
    ],
  },
];

export default function PlansTab({ user, restaurant }) {
  const [billing, setBilling] = useState("monthly");
  const [picked, setPicked]   = useState(null);
  const [showUrgent, setShowUrgent] = useState(false);

  const urgentActive =
    restaurant?.urgent &&
    restaurant?.urgent_until &&
    new Date(restaurant.urgent_until) > new Date();

  const purchase = async () => {
    if (!picked) return;
    alert(`בקרוב! תשלום ל-${picked.name} — נחבר למשולם בקרוב`);
  };

  return (
    <div className="bg-gray-50 min-h-full pb-24 text-gray-900">
      <div className="px-5 pt-20 pb-3">
        <h1 className="text-3xl font-black tracking-tight">תוכניות ומחירים</h1>
        <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">
          התוכנית הנכונה לך — שדרוג ובלעדיות לבחירה.
        </p>
      </div>

      <div className="px-4 pt-3 space-y-4">

        {/* Urgent boost card */}
        <div className={`rounded-2xl p-5 border shadow-sm ${
          urgentActive
            ? "bg-gradient-to-br from-amber-50 to-red-50 border-amber-200"
            : "bg-white border-gray-200"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
              urgentActive ? "bg-red-500" : "bg-gray-900"
            }`}>
              <Zap size={20} className="text-white" fill="white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-gray-900 font-black text-base">
                  {urgentActive ? "🔥 קידום פעיל" : "קידום משרה דחוף"}
                </p>
                {!urgentActive && (
                  <span className="text-[10px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded-full flex-shrink-0">
                    חד-פעמי
                  </span>
                )}
              </div>
              <p className="text-gray-600 text-xs mt-1 leading-relaxed">
                {urgentActive
                  ? `המודעה שלך מקודמת. תוקף עד ${new Date(restaurant.urgent_until).toLocaleDateString("he-IL")}`
                  : "המודעה שלך עולה לראש החיפושים עם תגית 🔥 דחוף למשך 7 ימים. פי 4 חשיפה."}
              </p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-gray-900 font-black text-2xl">
                  ₪{URGENT_PRICE}<span className="text-gray-400 font-normal text-xs mr-1">/ 7 ימים</span>
                </span>
                {!urgentActive && (
                  <button onClick={() => setShowUrgent(true)}
                    className="bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-full active:bg-red-600 shadow-md shadow-red-500/30 flex items-center gap-1.5">
                    <Sparkles size={12} fill="white" />קדם עכשיו
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Billing toggle */}
        <div className="bg-white border border-gray-200 rounded-full p-1 flex shadow-sm">
          <button onClick={() => setBilling("monthly")}
            className={`flex-1 py-2 rounded-full text-sm font-bold transition-colors ${
              billing === "monthly" ? "bg-gray-900 text-white" : "text-gray-600"
            }`}>
            חודשי
          </button>
          <button onClick={() => setBilling("yearly")}
            className={`flex-1 py-2 rounded-full text-sm font-bold transition-colors ${
              billing === "yearly" ? "bg-gray-900 text-white" : "text-gray-600"
            }`}>
            שנתי <span className="text-[10px] font-semibold text-green-600 mr-1.5">-20%</span>
          </button>
        </div>

        {/* Plans */}
        <div className="space-y-3">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} billing={billing}
              selected={picked?.id === p.id}
              onPick={() => setPicked(p)} />
          ))}
        </div>

        {picked && picked.price > 0 && (
          <button onClick={purchase}
            className="w-full bg-gray-900 text-white font-bold py-4 rounded-full text-base active:bg-gray-800 shadow-md shadow-gray-900/10 flex items-center justify-center gap-2 mt-2">
            <Crown size={16} fill="white" />
            עבור ל-{picked.name} · ₪{billing === "yearly" ? Math.round(picked.price * 0.8) : picked.price}/חודש
          </button>
        )}

        <p className="text-center text-[11px] text-gray-400 pt-1">
          ביטול בכל עת · ללא התחייבות · חשבונית מע"מ כדין
        </p>
      </div>

      {showUrgent && (
        <UrgentModal
          restaurant={restaurant}
          onClose={() => setShowUrgent(false)}
          onPurchased={() => { setShowUrgent(false); }}
        />
      )}
    </div>
  );
}

function PlanCard({ plan, billing, selected, onPick }) {
  const price = billing === "yearly" ? Math.round(plan.price * 0.8) : plan.price;
  return (
    <button onClick={onPick}
      className={`w-full text-right rounded-2xl border p-5 transition-all relative shadow-sm ${
        selected
          ? "bg-gray-900 text-white border-gray-900 shadow-xl shadow-gray-900/20"
          : plan.highlight
            ? "bg-white border-gray-900"
            : "bg-white border-gray-200 active:bg-gray-50"
      }`}>
      {plan.badge && (
        <span className={`absolute -top-2.5 right-5 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
          selected ? "bg-white text-gray-900" : "bg-gray-900 text-white"
        }`}>{plan.badge}</span>
      )}
      <div className="flex items-baseline justify-between mb-1">
        <p className={`font-black text-xl ${selected ? "text-white" : "text-gray-900"}`}>{plan.name}</p>
        <p className={`font-black text-2xl ${selected ? "text-white" : "text-gray-900"}`}>
          {plan.price === 0 ? "חינם" : (
            <>₪{price}<span className={`text-xs font-normal ${selected ? "text-white/60" : "text-gray-400"}`}>/חודש</span></>
          )}
        </p>
      </div>
      <p className={`text-xs mb-4 ${selected ? "text-white/70" : "text-gray-500"}`}>{plan.description}</p>
      <div className="space-y-2">
        {plan.features.map((f) => (
          <div key={f} className="flex items-start gap-2 text-sm">
            <Check size={14} className={`flex-shrink-0 mt-0.5 ${selected ? "text-white" : "text-gray-900"}`} />
            <span className={selected ? "text-white/90" : "text-gray-700"}>{f}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function UrgentModal({ restaurant, onClose, onPurchased }) {
  const [working, setWorking] = useState(false);
  const confirm = async () => {
    setWorking(true);
    const until = new Date();
    until.setDate(until.getDate() + 7);
    await supabase.from("restaurants").update({
      urgent: true,
      urgent_until: until.toISOString(),
      urgent_price: URGENT_PRICE,
    }).eq("id", restaurant.id);
    setWorking(false);
    onPurchased();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-md">
            <Zap size={24} className="text-white" fill="white" />
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <X size={16} />
          </button>
        </div>
        <h3 className="text-gray-900 font-black text-xl mb-2">קדם את המודעה</h3>
        <p className="text-gray-600 text-sm leading-relaxed mb-5">
          המודעה תופיע בראש החיפושים עם תגית 🔥 דחוף למשך <b className="text-gray-900">7 ימים</b>.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-5 flex items-center justify-between">
          <span className="text-gray-500 text-sm">סכום לתשלום</span>
          <span className="text-gray-900 font-black text-2xl">₪{URGENT_PRICE}</span>
        </div>
        <button onClick={confirm} disabled={working}
          className="w-full bg-gray-900 text-white font-bold py-4 rounded-full active:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
          {working ? <Loader2 size={18} className="animate-spin" /> : <><Sparkles size={16} fill="white" />שלם וקדם</>}
        </button>
        <button onClick={onClose}
          className="w-full text-gray-500 text-sm font-semibold py-3 mt-1">ביטול</button>
      </div>
    </div>
  );
}
