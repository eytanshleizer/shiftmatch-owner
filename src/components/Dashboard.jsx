import { useState, useEffect } from "react";
import {
  Home, Briefcase, Users, Settings as SettingsIcon, Calendar, LogOut, Sparkles, ChevronLeft, X
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { ROLE_LABEL } from "../lib/permissions";
import { needsSetup, getGuideStep } from "../lib/setup";
import HomeTab         from "./HomeTab";
import JobsTab         from "./JobsTab";
import JobsSetupWizard from "./JobsSetupWizard";
import CalendarTab     from "./CalendarTab";
import ApplicationsTab from "./ApplicationsTab";
import SettingsTab     from "./SettingsTab";
import PlansTab        from "./PlansTab";
import TeamPage        from "./TeamPage";
import QuestionnaireEditor from "./QuestionnaireEditor";
import CoachTour, { OWNER_TOUR_STEPS } from "./CoachTour";

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

  // Discovery nudge for the הגדרות tab — a soft red dot that just says "there's
  // stuff worth a look in here" (atmosphere, perks, ranking preferences…). Unlike
  // the משרות setup nudge, these are optional: the dot clears as soon as the owner
  // opens Settings once, whether or not they fill anything in. Persisted per
  // restaurant so it doesn't reappear on reload.
  const settingsSeenKey = `settingsSeen_${restaurant?.id || "anon"}`;
  const [settingsSeen, setSettingsSeen] = useState(() => {
    try { return localStorage.getItem(settingsSeenKey) === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (tab === "settings" && !settingsSeen) {
      setSettingsSeen(true);
      try { localStorage.setItem(settingsSeenKey, "1"); } catch {}
    }
  }, [tab, settingsSeen, settingsSeenKey]);

  // First-time jobs walkthrough — a full-screen guided wizard that picks up
  // where signup left off. Shown only the first time an owner opens משרות and
  // they have no positions yet. Once seen (finished or skipped) we set a
  // per-restaurant flag so it never reappears.
  const jobsWizardSeenKey = `jobsWizardSeen_${restaurant?.id || "anon"}`;
  const [jobsWizardSeen, setJobsWizardSeen] = useState(() => {
    try { return localStorage.getItem(jobsWizardSeenKey) === "1"; } catch { return false; }
  });
  const hasPositions = (restaurant?.position_types?.length || 0) > 0;
  const showJobsWizard = tab === "jobs" && !jobsWizardSeen && !hasPositions;

  // ── Guided coach-mark tour ──
  // After the first-time wizard, walk the owner through the key buttons (toggle
  // recruiting, edit a position, add more, then the settings screen) like a
  // video-game tutorial. Shown once per restaurant; replayable from Settings.
  const tourSeenKey   = `jobsTourSeen_${restaurant?.id || "anon"}`;
  const tourActiveKey = `jobsTourActive_${restaurant?.id || "anon"}`;
  const tourStepKey   = `jobsTourStep_${restaurant?.id || "anon"}`;
  // Resume an unfinished tour across reloads/navigation — it only ends when the
  // owner completes it or explicitly taps "דילוג על הסיור".
  const [tourActive, setTourActive] = useState(() => {
    try { return localStorage.getItem(tourActiveKey) === "1"; } catch { return false; }
  });
  const [tourStep, setTourStep] = useState(() => {
    try { return parseInt(localStorage.getItem(tourStepKey) || "0", 10) || 0; } catch { return 0; }
  });

  const startTour = () => { setTourStep(0); setTab("jobs"); setTourActive(true); };
  const endTour = () => {
    setTourActive(false);
    try { localStorage.setItem(tourSeenKey, "1"); } catch {}
  };

  // Persist tour progress so leaving the page (nav or full reload) resumes the
  // tour rather than silently ending it.
  useEffect(() => {
    try {
      if (tourActive) {
        localStorage.setItem(tourActiveKey, "1");
        localStorage.setItem(tourStepKey, String(tourStep));
      } else {
        localStorage.removeItem(tourActiveKey);
        localStorage.removeItem(tourStepKey);
      }
    } catch { /* ignore */ }
  }, [tourActive, tourStep, tourActiveKey, tourStepKey]);

  // Keep the active tab pinned to the current tour step (the tour spans both the
  // משרות and הגדרות tabs). `tab` is a dep so if the owner clicks away mid-tour we
  // snap them straight back — they advance only via the tooltip buttons. CoachTour
  // then polls for the step's target.
  useEffect(() => {
    if (!tourActive) return;
    const step = OWNER_TOUR_STEPS[tourStep];
    if (step?.tab && step.tab !== tab) setTab(step.tab);
  }, [tourActive, tourStep, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishJobsWizard = async () => {
    setJobsWizardSeen(true);
    try { localStorage.setItem(jobsWizardSeenKey, "1"); } catch {}
    // Pull the freshly-written restaurant row so JobsTab + nudges reflect the
    // positions the owner just created in the wizard.
    if (restaurant?.id) {
      try {
        const { data } = await supabase
          .from("restaurants").select("*").eq("id", restaurant.id).maybeSingle();
        if (data) onUpdate?.(data);
      } catch {}
    }
    setTab("jobs");
    // Kick off the guided coach-mark tour the first time only.
    let tourSeen = true;
    try { tourSeen = localStorage.getItem(tourSeenKey) === "1"; } catch {}
    if (!tourSeen) { setTourStep(0); setTourActive(true); }
  };

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
  const guideStep     = getGuideStep(restaurant);   // "add" | "salary" | "reqs" | null
  // Once the owner has completed the first-time wizard, treat setup as
  // acknowledged: drop the red attention badges + nudge bubble (the guided tour
  // teaches them where everything is, so the "errors" would be redundant noise).
  const jobsNeedSetup = needsSetup(restaurant) && !jobsWizardSeen;

  // The coach bubble points owners to the משרות tab whenever they're elsewhere
  // and there's still setup to finish (and they haven't dismissed it this session).
  const showCoach = guideStep && tab !== "jobs" && !coachDismissed && !jobsWizardSeen && !tourActive;
  const coachText = {
    add:    "בואו נתחיל! הוסיפו את המשרות שאתם מגייסים",
    salary: "כמעט שם — הגדירו שכר לשעה למשרות שלכם",
    reqs:   "שלב אחרון — הגדירו את דרישות העובד למשרות",
  }[guideStep];

  // Full-screen takeover: the first-time jobs walkthrough replaces the whole
  // dashboard chrome (no nav/sidebar) so it feels like a continuation of signup.
  if (showJobsWizard) {
    return (
      <div className="h-full w-full bg-white overflow-y-auto" dir="rtl">
        <JobsSetupWizard
          restaurant={restaurant}
          onDone={finishJobsWizard}
          onClose={finishJobsWizard}
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex bg-gray-50" dir="rtl">

      {/* ===== Desktop sidebar (lg+) — replaces the mobile bottom nav ===== */}
      <DesktopSidebar
        restaurant={restaurant}
        tab={tab}
        onTab={setTab}
        onOpenPlans={() => setPlansOpen(true)}
        jobsNeedSetup={jobsNeedSetup}
        settingsSeen={settingsSeen}
        firstName={firstName}
        initials={initials}
        role={role}
        onSignOut={() => supabase.auth.signOut()}
      />

      {/* ===== Main column ===== */}
      <div className="relative flex-1 min-w-0 h-full flex flex-col bg-gray-50 overflow-hidden">

      {/* Mobile-only floating user pill (desktop shows it in the sidebar) */}
      <div className="lg:hidden absolute z-30" style={{ top: "max(env(safe-area-inset-top, 0px), 12px)", insetInlineStart: "12px" }}>
        <UserPill firstName={firstName} initials={initials} role={role}
          onSignOut={() => supabase.auth.signOut()} />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
       <div className="w-full lg:max-w-5xl lg:mx-auto">
        {tab === "home"     && <HomeTab     restaurant={restaurant} user={user} onUpdate={onUpdate}
          onGoTab={goTab} />}
        {tab === "jobs"     && <JobsTab     restaurant={restaurant} onUpdate={onUpdate} role={role}
          setupAcknowledged={jobsWizardSeen} />}
        {tab === "calendar" && <CalendarTab restaurant={restaurant} user={user} role={role} />}
        {tab === "apps"     && <ApplicationsTab restaurant={restaurant} role={role} />}
        {tab === "settings" && <SettingsTab restaurant={restaurant} onUpdate={onUpdate}
          onSignOut={() => supabase.auth.signOut()}
          onOpenPlans={() => setPlansOpen(true)}
          onOpenTeam={() => setTeamOpen(true)}
          onOpenQuestionnaire={() => setQuestionnaireOpen(true)}
          onReplayTour={startTour}
          role={role} />}
       </div>
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
        <div className="absolute inset-x-3 z-40 guide-coach lg:inset-x-auto lg:left-6 lg:w-80"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)" }}>
          <div className="bg-gray-900 text-white rounded-2xl shadow-xl shadow-gray-900/25 p-3 flex items-center gap-2.5">
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

      {/* Bottom nav — white, clean (mobile only; desktop uses the sidebar) */}
      <div className="flex-shrink-0 lg:hidden">
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
                  data-tour={id === "settings" ? "nav-settings" : undefined}
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
                      <AttnMark className="absolute -top-1.5 -right-1.5" />
                    )}
                    {id === "settings" && !settingsSeen && (
                      <AttnMark className="absolute -top-1.5 -right-1.5" />
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

      {/* Guided coach-mark tour — spotlights the key buttons across משרות + הגדרות */}
      {tourActive && (
        <CoachTour
          step={OWNER_TOUR_STEPS[tourStep]}
          index={tourStep}
          total={OWNER_TOUR_STEPS.length}
          onNext={() => {
            if (tourStep < OWNER_TOUR_STEPS.length - 1) setTourStep(tourStep + 1);
            else endTour();
          }}
          onBack={() => setTourStep((s) => Math.max(0, s - 1))}
          onSkip={endTour}
        />
      )}
    </div>
    </div>
  );
}

// ── Attention mark — a red "!" badge that replaces the old plain red dot. Reads
// louder than a dot ("there's something you need to do here", not just "new").
function AttnMark({ className = "" }) {
  return (
    <span className={`flex items-center justify-center h-4 w-4 rounded-full bg-red-500 ring-2 ring-white text-white text-[11px] font-black leading-none ${className}`}>
      <span className="attn-ring absolute inline-flex h-4 w-4 rounded-full bg-red-400 -z-10" />
      !
    </span>
  );
}

// ── Desktop sidebar (lg+) — vertical nav that replaces the mobile bottom bar ──
function DesktopSidebar({ restaurant, tab, onTab, onOpenPlans, jobsNeedSetup, settingsSeen, firstName, initials, role, onSignOut }) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:flex-shrink-0 h-full bg-white border-l border-gray-200">
      {/* Brand + restaurant */}
      <div className="px-5 pt-6 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-brand-500/30">S</div>
          <span className="text-gray-900 font-black text-base tracking-tight">ShiftMatch</span>
        </div>
        <div className="mt-4">
          <p className="text-gray-900 font-bold text-sm truncate">{restaurant?.name || "המסעדה שלי"}</p>
          {restaurant?.city && <p className="text-gray-400 text-xs mt-0.5 truncate">{restaurant.city}</p>}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          const dot = (id === "jobs" && jobsNeedSetup) || (id === "settings" && !settingsSeen);
          return (
            <button key={id} onClick={() => onTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                active ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              }`}>
              <span className="relative flex items-center justify-center">
                <Icon size={19} strokeWidth={active ? 2.2 : 1.7} />
                {dot && <AttnMark className="absolute -top-2 -right-2" />}
              </span>
              <span className="flex-1 text-right">{label}</span>
            </button>
          );
        })}

        <button onClick={onOpenPlans}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-brand-700 hover:bg-brand-50 transition-colors">
          <Sparkles size={19} strokeWidth={1.9} />
          <span className="flex-1 text-right">קידום פרימיום</span>
        </button>
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white font-black text-[11px] flex-shrink-0">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 text-sm font-bold truncate">{firstName}</p>
            {role && <p className="text-gray-400 text-[11px] truncate">{ROLE_LABEL[role] || role}</p>}
          </div>
        </div>
        <button onClick={onSignOut}
          className="w-full flex items-center gap-2 text-red-600 text-xs font-semibold py-2 px-2 rounded-lg hover:bg-red-50 transition-colors">
          <LogOut size={14} />התנתק/י
        </button>
      </div>
    </aside>
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
