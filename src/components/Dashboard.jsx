import { useState } from "react";
import {
  Home, Briefcase, Users, Settings as SettingsIcon, Calendar, LogOut, Sparkles, ChevronLeft, X
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { ROLE_LABEL } from "../lib/permissions";
import { needsSetup, getGuideStep } from "../lib/setup";
import HomeTab         from "./HomeTab";
import JobsTab         from "./JobsTab";
import CalendarTab     from "./CalendarTab";
import ApplicationsTab from "./ApplicationsTab";
import SettingsTab     from "./SettingsTab";
import PlansTab        from "./PlansTab";
import TeamPage        from "./TeamPage";
import QuestionnaireEditor from "./QuestionnaireEditor";

const TABS = [
  { id: "home",     label: "בית",      icon: Home },
  { id: "jobs",     label: "משרות",     icon: Briefcase },
  { id: "calendar", label: "ראיונות",   icon: Calendar },
  { id: "apps",     label: "פניות",     icon: Users },
  { id: "settings", label: "הגדרות",   icon: SettingsIcon },
];

export default function Dashboard({ restaurant, user, role, onUpdate }) {
  const [tab, setTab]               = useState("home");
  const [plansOpen, setPlansOpen]               = useState(false);
  const [teamOpen,  setTeamOpen]                = useState(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [coachDismissed, setCoachDismissed]       = useState(false);

  // User pill bits
  const fullName  = (user?.user_metadata?.name || user?.email || "").trim();
  const firstName = fullName.split(/\s+/)[0] || "משתמש";
  const initials  = fullName.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

  const goTab = (id) => {
    if (id === "plans") setPlansOpen(true);
    else setTab(id);
  };

  // Nudge owners through the whole setup — shows a pulsing red dot on the משרות
  // tab and a coach bubble until every open position has pay + requirements.
  const jobsNeedSetup = needsSetup(restaurant);
  const guideStep     = getGuideStep(restaurant);   // "add" | "salary" | "reqs" | null

  // The coach bubble points owners to the משרות tab whenever they're elsewhere
  // and there's still setup to finish (and they haven't dismissed it this session).
  const showCoach = guideStep && tab !== "jobs" && !coachDismissed;
  const coachText = {
    add:    "בואו נתחיל! הוסיפו את המשרות שאתם מגייסים",
    salary: "כמעט שם — הגדירו שכר לשעה למשרות שלכם",
    reqs:   "שלב אחרון — הגדירו את דרישות העובד למשרות",
  }[guideStep];

  return (
    <div className="h-full w-full flex justify-center bg-gray-200">
    <div className="relative h-full w-full max-w-md flex flex-col bg-gray-50 sm:shadow-2xl sm:shadow-gray-400/30 overflow-hidden" dir="rtl">
      {/* Persistent top-right user pill */}
      <div className="absolute z-30" style={{ top: "max(env(safe-area-inset-top, 0px), 12px)", insetInlineStart: "12px" }}>
        <UserPill firstName={firstName} initials={initials} role={role}
          onSignOut={() => supabase.auth.signOut()} />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        {tab === "home"     && <HomeTab     restaurant={restaurant} user={user} onUpdate={onUpdate}
          onGoTab={goTab} />}
        {tab === "jobs"     && <JobsTab     restaurant={restaurant} onUpdate={onUpdate} role={role} />}
        {tab === "calendar" && <CalendarTab restaurant={restaurant} user={user} role={role} />}
        {tab === "apps"     && <ApplicationsTab restaurant={restaurant} role={role} />}
        {tab === "settings" && <SettingsTab restaurant={restaurant} onUpdate={onUpdate}
          onSignOut={() => supabase.auth.signOut()}
          onOpenPlans={() => setPlansOpen(true)}
          onOpenTeam={() => setTeamOpen(true)}
          onOpenQuestionnaire={() => setQuestionnaireOpen(true)}
          role={role} />}
      </div>

      {/* Plans overlay */}
      {plansOpen && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PlansTab user={user} restaurant={restaurant} />
          </div>
          <button onClick={() => setPlansOpen(false)}
            className="absolute top-12 right-4 w-10 h-10 bg-gray-100 backdrop-blur rounded-full flex items-center justify-center text-gray-700 active:bg-gray-200 z-10 shadow-md">
            ✕
          </button>
        </div>
      )}

      {teamOpen && (
        <div className="absolute inset-0 z-50 bg-gray-50">
          <TeamPage restaurant={restaurant} user={user} onBack={() => setTeamOpen(false)} />
        </div>
      )}

      {questionnaireOpen && (
        <div className="absolute inset-0 z-50 bg-gray-50">
          <QuestionnaireEditor
            restaurant={restaurant}
            onBack={() => setQuestionnaireOpen(false)}
            onSaved={(qs) => onUpdate?.({ ...restaurant, screening_questions: qs })}
          />
        </div>
      )}

      {/* Guide coach bubble — floats above the bottom nav, points to משרות */}
      {showCoach && (
        <div className="absolute inset-x-3 z-40"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 74px)" }}>
          <div className="bg-gray-900 text-white rounded-2xl shadow-xl shadow-gray-900/20 p-3 flex items-center gap-2.5 animate-[fadeIn_0.3s_ease]">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Sparkles size={15} className="text-amber-300" />
            </div>
            <button onClick={() => setTab("jobs")}
              className="flex-1 min-w-0 text-right active:opacity-80">
              <p className="text-white text-xs font-bold leading-snug">{coachText}</p>
              <span className="text-gray-300 text-[11px] font-semibold flex items-center gap-0.5 mt-0.5">
                עברו ללשונית משרות <ChevronLeft size={12} />
              </span>
            </button>
            <button onClick={() => setCoachDismissed(true)}
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-gray-300 active:bg-white/20 flex-shrink-0">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav — white, clean */}
      <div className="flex-shrink-0">
        <div className="safe-bottom"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(0,0,0,0.06)",
          }}>
          <div className="flex px-2 pt-2 pb-1">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)}
                  className="flex-1 flex flex-col items-center gap-1 py-1 relative transition-all duration-200"
                  style={{ WebkitTapHighlightColor: "transparent" }}>
                  {active && (
                    <div className="absolute inset-x-3 top-0 h-8 bg-gray-900/5 rounded-2xl" />
                  )}
                  <div className={`relative z-10 w-6 h-6 flex items-center justify-center transition-all duration-200 ${active ? "scale-110" : ""}`}>
                    <Icon size={20}
                      strokeWidth={active ? 2.2 : 1.5}
                      className={active ? "text-gray-900" : "text-gray-400"} />
                    {id === "jobs" && jobsNeedSetup && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold transition-colors duration-200 ${active ? "text-gray-900" : "text-gray-400"}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// ── User pill (top-right floating) — light glass style ──
function UserPill({ firstName, initials, role, onSignOut }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-full pr-1 pl-3 py-1 active:bg-gray-50 shadow-md">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white font-black text-[11px]">
          {initials}
        </div>
        <span className="text-gray-900 text-xs font-bold leading-none">{firstName}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute mt-2 z-20 bg-white border border-gray-200 rounded-2xl p-3 min-w-[200px] shadow-xl"
               style={{ insetInlineStart: 0 }}>
            <p className="text-gray-900 text-sm font-bold truncate">{firstName}</p>
            {role && (
              <p className="text-gray-500 text-[11px] mt-0.5">{ROLE_LABEL[role] || role}</p>
            )}
            <div className="border-t border-gray-100 my-2" />
            <button onClick={onSignOut}
              className="w-full flex items-center gap-2 text-red-600 text-xs font-semibold py-2 px-2 rounded-lg active:bg-red-50">
              <LogOut size={13} />התנתק/י
            </button>
          </div>
        </>
      )}
    </div>
  );
}
