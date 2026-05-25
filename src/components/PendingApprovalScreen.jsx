import { useState, useEffect } from "react";
import { Clock, LogOut, RefreshCw, X, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";

/**
 * Shown to a user who has a pending membership (or only a rejected one).
 * Polls every 10s to detect approval automatically.
 */
export default function PendingApprovalScreen({ user, membership, restaurant, onApproved, onSignOut }) {
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    const { data } = await supabase
      .from("restaurant_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();
    setChecking(false);
    if (data?.status === "approved") onApproved?.(data);
  };

  // Poll quietly every 10 seconds.
  useEffect(() => {
    const t = setInterval(recheck, 10000);
    return () => clearInterval(t);
  }, [user?.id, restaurant?.id]);

  const isRejected = membership?.status === "rejected";

  return (
    <div className="h-full bg-[#0A0A0A] flex flex-col items-center justify-center px-6 text-center">
      <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 ${
        isRejected ? "bg-red-500/15" : "bg-amber-500/15"
      }`}>
        {isRejected ? (
          <X size={42} className="text-red-400" />
        ) : (
          <Clock size={42} className="text-amber-400" />
        )}
      </div>

      <h1 className="text-white font-black text-2xl mb-2">
        {isRejected ? "הבקשה נדחתה" : "ממתין/ה לאישור"}
      </h1>

      <p className="text-gray-400 text-sm leading-relaxed max-w-xs mb-1">
        {isRejected ? (
          <>מנהל המסעדה <b className="text-white">{restaurant?.name}</b> דחה את בקשת ההצטרפות שלך.</>
        ) : (
          <>
            הבקשה שלך להצטרף ל-<b className="text-white">{restaurant?.name}</b> נשלחה למנהל המסעדה. תקבל/י גישה ברגע שהבקשה תאושר.
          </>
        )}
      </p>

      {!isRejected && (
        <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mt-6 mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-300 text-xs font-bold">בודק כל 10 שניות</span>
        </div>
      )}

      {!isRejected && (
        <button onClick={recheck} disabled={checking}
          className="bg-brand-500 text-white font-bold px-6 py-3 rounded-2xl active:bg-brand-600 flex items-center gap-2 mb-3 shadow-lg shadow-brand-500/30 disabled:opacity-60">
          <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
          {checking ? "בודק..." : "בדוק עכשיו"}
        </button>
      )}

      <button onClick={onSignOut}
        className="text-gray-500 text-sm font-semibold py-3 flex items-center gap-1.5">
        <LogOut size={14} />התנתקות
      </button>
    </div>
  );
}
