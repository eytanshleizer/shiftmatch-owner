import { useState } from "react";
import { Home, Briefcase, Users, Settings as SettingsIcon, LogOut } from "lucide-react";
import { supabase } from "../lib/supabase";
import { ROLE_LABEL } from "../lib/permissions";
import HomeTab         from "./HomeTab";
import JobsTab         from "./JobsTab";
import ApplicationsTab from "./ApplicationsTab";
import SettingsTab     from "./SettingsTab";
import PlansTab        from "./PlansTab";
import TeamPage        from "./TeamPage";
import QuestionnaireEditor from "./QuestionnaireEditor";

const TABS = [
  { id: "home",     label: "בית",      icon: Home },
  { id: "jobs",     label: "משרות",     icon: Briefcase },
  { id: "apps",     label: "פניות",     icon: Users },
  { id: "settings", label: "הגדרות",   icon: SettingsIcon },
];

export default function Dashboard({ restaurant, user, role, onUpdate }) {
  const [tab, setTab] = useState("home");
  // Plans + Team are overlays launched from Settings instead of top-level tabs.
  const [plansOpen, setPlansOpen]               = useState(false);
  const [teamOpen,  setTeamOpen]                = useState(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);

  // Logged-in user name + initials for the persistent top-right pill.
  const fullName  = (user?.user_metadata?.name || user?.email || "").trim();
  const firstName = fullName.split(/\s+/)[0] || "משתמש";
  const initials  = fullName.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* Persistent top-right user pill (across all tabs).  Click → sign out. */}
      <div className="absolute z-30" style={{ top: "max(env(safe-area-inset-top, 0px), 12px)", insetInlineStart: "12px" }}>
        <UserPill firstName={firstName} initials={initials} role={role}
          onSignOut={() => supabase.auth.signOut()} />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        {tab === "home"     && <HomeTab     restaurant={restaurant} onUpdate={onUpdate} onSignOut={() => supabase.auth.signOut()} />}
        {tab === "jobs"     && <JobsTab     restaurant={restaurant} onUpdate={onUpdate} role={role} />}
        {tab === "apps"     && <ApplicationsTab restaurant={restaurant} role={role} />}
        {tab === "settings" && <SettingsTab restaurant={restaurant} onUpdate={onUpdate}
          onSignOut={() => supabase.auth.signOut()}
          onOpenPlans={() => setPlansOpen(true)}
          onOpenTeam={() => setTeamOpen(true)}
          onOpenQuestionnaire={() => setQuestionnaireOpen(true)}
          role={role} />}
      </div>

      {/* Plans overlay (full-screen) */}
      {plansOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PlansTab user={user} restaurant={restaurant} />
          </div>
          <button onClick={() => setPlansOpen(false)}
            className="absolute top-12 right-4 w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center text-white active:bg-white/20 z-10">
            ✕
          </button>
        </div>
      )}

      {/* Team overlay (full-screen) */}
      {teamOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]">
          <TeamPage restaurant={restaurant} user={user} onBack={() => setTeamOpen(false)} />
        </div>
      )}

      {/* Questionnaire editor overlay (full-screen) */}
      {questionnaireOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]">
          <QuestionnaireEditor
            restaurant={restaurant}
            onBack={() => setQuestionnaireOpen(false)}
            onSaved={(qs) => onUpdate?.({ ...restaurant, screening_questions: qs })}
          />
        </div>
      )}

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

// ── User pill ──
// Shown in the top-right (RTL → inline-start) of every tab.  Tapping
// opens a tiny menu with the user's full name + sign-out.
function UserPill({ firstName, initials, role, onSignOut }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full pr-1 pl-3 py-1 active:bg-white/15 shadow-lg shadow-black/40">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-black text-[11px]">
          {initials}
        </div>
        <span className="text-white text-xs font-bold leading-none">{firstName}</span>
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute mt-2 z-20 bg-[#161616] border border-white/10 rounded-2xl p-3 min-w-[180px] shadow-2xl shadow-black/60"
               style={{ insetInlineStart: 0 }}>
            <p className="text-white text-sm font-bold truncate">{firstName}</p>
            {role && (
              <p className="text-gray-500 text-[11px] mt-0.5">{ROLE_LABEL[role] || role}</p>
            )}
            <div className="border-t border-white/5 my-2" />
            <button onClick={onSignOut}
              className="w-full flex items-center gap-2 text-red-400 text-xs font-semibold py-2 px-2 rounded-lg active:bg-red-500/10">
              <LogOut size={13} />התנתק/י
            </button>
          </div>
        </>
      )}
    </div>
  );
}
