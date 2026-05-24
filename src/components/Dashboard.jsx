import { useState } from "react";
import { Home, Users, MessageCircle, CreditCard } from "lucide-react";
import { supabase } from "../lib/supabase";
import HomeTab         from "./HomeTab";
import ApplicationsTab from "./ApplicationsTab";
import WhatsAppTab     from "./WhatsAppTab";
import PlansTab        from "./PlansTab";

const TABS = [
  { id: "home",  label: "בית",        icon: Home },
  { id: "apps",  label: "פניות",       icon: Users },
  { id: "wa",    label: "AI",          icon: MessageCircle },
  { id: "plans", label: "תוכניות",    icon: CreditCard },
];

export default function Dashboard({ restaurant, user, onUpdate }) {
  const [tab, setTab] = useState("home");

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        {tab === "home"  && <HomeTab  restaurant={restaurant} onUpdate={onUpdate} onSignOut={() => supabase.auth.signOut()} />}
        {tab === "apps"  && <ApplicationsTab restaurant={restaurant} />}
        {tab === "wa"    && <WhatsAppTab restaurant={restaurant} />}
        {tab === "plans" && <PlansTab user={user} restaurant={restaurant} />}
      </div>

      {/* Bottom nav */}
      <div className="flex-shrink-0 safe-bottom"
        style={{
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
        <div className="flex px-2 pt-2 pb-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 flex flex-col items-center gap-1 py-1 relative transition-all duration-200"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                {/* Active pill background */}
                {active && (
                  <div className="absolute inset-x-3 top-0 h-8 bg-brand-500/15 rounded-2xl" />
                )}
                <div className={`relative z-10 w-6 h-6 flex items-center justify-center transition-all duration-200 ${active ? "scale-110" : ""}`}>
                  <Icon size={20}
                    strokeWidth={active ? 2.2 : 1.5}
                    className={active ? "text-brand-400" : "text-gray-600"} />
                </div>
                <span className={`text-[10px] font-semibold transition-colors duration-200 ${active ? "text-brand-400" : "text-gray-600"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
