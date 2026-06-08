import { useState, useLayoutEffect, useRef, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import JobsSetupWizard from "../components/JobsSetupWizard";
import {
  Plus, Settings, Home, Briefcase, Calendar, Inbox,
  PartyPopper, Moon, Sun, Sparkles, ChevronLeft, Check, Trash2,
  Store, Phone as PhoneIcon, Clock, Gift, Users, HelpCircle, CreditCard, LogOut, MapPin,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TOUR DEMO — preview-only (?demo=tour). A "video-game tutorial" walkthrough for
// a brand-new owner: big CTA → guided Q&A wizard → land on a fully-set-up jobs
// page (no red errors) → coach-mark tour of the key buttons → guided settings.
//
// Everything is mocked in-memory; no login, no production data. Not imported by
// any production route. This is a clickable PROTOTYPE to agree on the UX before
// wiring the real coach-marks into Dashboard / JobsTab / SettingsTab.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tiny in-memory Supabase mock so the real JobsSetupWizard runs unmodified ──
let idc = 5000;
const uid = () => "demo-" + idc++;
const store = {
  position_templates: [
    { id: "t-waiter",    name: "מלצר/ית",    icon: "🍽️", sort_order: 1 },
    { id: "t-bartender", name: "ברמן/ית",    icon: "🍸", sort_order: 2 },
    { id: "t-host",      name: "מארח/ת",     icon: "🛎️", sort_order: 3 },
    { id: "t-runner",    name: "ראנר/ית",    icon: "🏃", sort_order: 4 },
    { id: "t-chef",      name: "טבח/ית",     icon: "👨‍🍳", sort_order: 5 },
    { id: "t-dish",      name: "שטיפת כלים", icon: "🧽", sort_order: 6 },
  ],
  restaurant_positions: [],
  position_screening_questions: [],
  restaurants: [{ id: "demo-rest", name: "מסעדת הדגמה", mandatory_shifts: [] }],
};
const resetStore = () => {
  store.restaurant_positions = [];
  store.position_screening_questions = [];
};
function makeBuilder(table) {
  const s = { op: "select", filters: [], inFilter: null, payload: null, single: false };
  const rows = () => {
    let r = store[table] || [];
    r = r.filter((row) => s.filters.every(([c, v]) => row[c] === v));
    if (s.inFilter) { const [c, vals] = s.inFilter; r = r.filter((row) => vals.includes(row[c])); }
    return r;
  };
  const exec = async () => {
    if (s.op === "select") { const d = rows(); return { data: s.single ? d[0] || null : d, error: null }; }
    if (s.op === "insert") {
      const arr = Array.isArray(s.payload) ? s.payload : [s.payload];
      const ins = arr.map((x) => ({ id: uid(), created_at: new Date().toISOString(), ...x }));
      store[table] = [...(store[table] || []), ...ins];
      return { data: s.single ? ins[0] : ins, error: null };
    }
    if (s.op === "update") {
      const ids = new Set(rows().map((r) => r.id));
      store[table] = store[table].map((r) => (ids.has(r.id) ? { ...r, ...s.payload } : r));
      return { data: null, error: null };
    }
    if (s.op === "delete") {
      const ids = new Set(rows().map((r) => r.id));
      store[table] = store[table].filter((r) => !ids.has(r.id));
      return { data: null, error: null };
    }
  };
  const b = {
    select() { return b; },
    eq(c, v) { s.filters.push([c, v]); return b; },
    in(c, v) { s.inFilter = [c, v]; return b; },
    order() { return b; },
    update(p) { s.op = "update"; s.payload = p; return b; },
    insert(p) { s.op = "insert"; s.payload = p; return b; },
    delete() { s.op = "delete"; return b; },
    single() { s.single = true; return exec(); },
    maybeSingle() { s.single = true; return exec(); },
    then(res, rej) { return exec().then(res, rej); },
  };
  return b;
}
supabase.from = (table) => makeBuilder(table);

// ─────────────────────────────────────────────────────────────────────────────
// Coach-mark overlay: dims the screen, cuts a rounded spotlight hole around the
// target element, draws a pulsing ring, and shows a tooltip with Back/Next/Skip.
// ─────────────────────────────────────────────────────────────────────────────
function CoachOverlay({ targetRef, step, index, total, onNext, onBack, onSkip }) {
  const [rect, setRect] = useState(null);

  const measure = useCallback(() => {
    const el = targetRef?.current;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
  }, [targetRef]);

  useLayoutEffect(() => {
    const el = targetRef?.current;
    if (el?.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();
    const t1 = setTimeout(measure, 80);
    const t2 = setTimeout(measure, 360);   // after smooth-scroll settles
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, index, step]);

  const pad = 8;
  const hole = rect && {
    x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2,
  };

  // Tooltip placement: below the hole if there's room, else above; centered if no target.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const below = hole ? hole.y + hole.h + 14 : null;
  const placeAbove = hole && below + 200 > vh;
  const tipTop = !hole ? null : placeAbove ? Math.max(12, hole.y - 14) : below;

  return (
    // Parent is click-through (pointer-events-none); only the dim blockers and
    // the tooltip opt back in. This keeps the spotlight HOLE clickable so the
    // user can tap the highlighted control itself.
    <div className="fixed inset-0 z-[100] pointer-events-none" dir="rtl">
      {/* Dim + spotlight hole (SVG mask = crisp rounded cut-out) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx="16" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(17,24,39,0.72)" mask="url(#tour-hole)" />
      </svg>

      {/* Pulsing ring around the target */}
      {hole && (
        <div className="absolute rounded-2xl pointer-events-none tour-ring"
          style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
      )}

      {/* Click blockers AROUND the spotlight — they swallow stray taps on the
          dimmed page but deliberately leave the hole open, so tapping the
          highlighted control runs its real action. Skipping is only via the
          explicit "דילוג על הסיור" pill below — never an accidental backdrop tap. */}
      {hole ? (
        <>
          <div className="absolute inset-x-0 top-0 pointer-events-auto"
            style={{ height: Math.max(0, hole.y) }} />
          <div className="absolute inset-x-0 bottom-0 pointer-events-auto"
            style={{ top: hole.y + hole.h }} />
          <div className="absolute pointer-events-auto"
            style={{ top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.h }} />
          <div className="absolute pointer-events-auto"
            style={{ top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }} />
        </>
      ) : (
        <div className="absolute inset-0 pointer-events-auto" />
      )}

      {/* Tooltip */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[min(20rem,90vw)] bg-white rounded-2xl shadow-2xl p-4 pointer-events-auto"
        style={hole
          ? { top: tipTop, transform: `translate(-50%, ${placeAbove ? "-100%" : "0"})` }
          : { top: "50%", transform: "translate(-50%, -50%)" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
            <Sparkles size={14} className="text-amber-300" />
          </div>
          <p className="text-gray-900 font-black text-sm">{step.title}</p>
        </div>
        <p className="text-gray-600 text-xs leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between mt-3.5">
          {/* progress dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-gray-900" : "w-1.5 bg-gray-200"}`} />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button onClick={onBack}
                className="text-gray-500 text-xs font-bold px-3 py-2 rounded-xl active:bg-gray-100">
                חזרה
              </button>
            )}
            <button onClick={onNext}
              className="bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-xl active:bg-gray-800 flex items-center gap-1">
              {step.next || "הבא"} <ChevronLeft size={14} />
            </button>
          </div>
        </div>

        <button onClick={onSkip}
          className="absolute -top-3 -left-3 bg-white shadow-md text-gray-400 text-[11px] font-bold w-auto px-2.5 py-1 rounded-full active:text-gray-700">
          דילוג על הסיור
        </button>
      </div>
    </div>
  );
}

// ── Bottom navigation (visual only, matches the real app) ──────────────────────
function BottomNav({ active, settingsRef }) {
  const Item = ({ icon: Icon, label, on, refEl, dot }) => (
    <div ref={refEl} className="flex-1 flex flex-col items-center gap-0.5 py-2 relative">
      {dot && <span className="absolute top-1.5 right-[28%] w-2 h-2 bg-red-500 rounded-full" />}
      <Icon size={20} className={on ? "text-gray-900" : "text-gray-400"} />
      <span className={`text-[10px] font-bold ${on ? "text-gray-900" : "text-gray-400"}`}>{label}</span>
    </div>
  );
  return (
    <div className="absolute bottom-0 inset-x-0 bg-white border-t border-gray-100 flex px-2">
      <Item icon={Settings} label="הגדרות" on={active === "settings"} refEl={settingsRef} dot />
      <Item icon={Inbox} label="פניות" />
      <Item icon={Calendar} label="ראיונות" />
      <Item icon={Briefcase} label="משרות" on={active === "jobs"} />
      <Item icon={Home} label="בית" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main demo
// ─────────────────────────────────────────────────────────────────────────────
export default function TourDemo() {
  const [phase, setPhase] = useState("intro"); // intro | wizard | jobs | settings | done
  const [coach, setCoach] = useState(0);
  const [positions, setPositions] = useState([]);

  // Refs for highlight targets
  const ctaRef       = useRef(null);
  const sumRef       = useRef(null);
  const toggleRef    = useRef(null);
  const cardRef      = useRef(null);
  const addRef       = useRef(null);
  const navSetRef     = useRef(null);
  const setDetailRef  = useRef(null);
  const setContactRef = useRef(null);
  const setShiftRef   = useRef(null);
  const setAccountRef = useRef(null);
  const setSaveRef    = useRef(null);

  const startWizard = () => { resetStore(); setPhase("wizard"); };

  const finishWizard = () => {
    const created = store.restaurant_positions.filter((p) => p.restaurant_id === "demo-rest");
    setPositions(created.length ? created : DEMO_FALLBACK);
    setCoach(0);
    setPhase("jobs");
  };

  // Coach-step definitions per phase
  const jobsSteps = [
    { ref: sumRef,    title: "המשרות שלך מוכנות! 🎉", body: "כל מה שהגדרת בסיור כבר כאן — בלי שדות אדומים ובלי התראות. ההקמה הושלמה.", next: "המשך" },
    { ref: toggleRef, title: "הדלקה וכיבוי גיוס",       body: "לכל משרה יש מתג. ירוק = פעיל ומגייס, אפור = מושהה. לחיצה אחת וזהו." },
    { ref: cardRef,   title: "עריכת פרטים ומשמרות",     body: "לחיצה על משרה פותחת אותה — שם מוסיפים משמרות, מעדכנים שכר ודרישות מתי שתרצה." },
    { ref: addRef,    title: "הוספת עוד משרות",          body: "צריך תפקיד נוסף? מוסיפים משרה חדשה בכל רגע מהכפתור הזה." },
    { ref: navSetRef, title: "עכשיו — ההגדרות",          body: "בוא נראה לך איפה משנים את פרטי המסעדה ואת הגדרות הגיוס.", next: "להגדרות" },
  ];
  const settingsSteps = [
    { ref: setDetailRef,  title: "פרטי המסעדה",        body: "שם, סוג מטבח, עיר, כתובת ותמונת כריכה — בדיוק מה שהמלצרים רואים בכרטיס המודעה. הכול נערך כאן." },
    { ref: setContactRef, title: "פרטי קשר לגיוס",     body: "וואטסאפ וטלפון שאליהם המועמדים פונים. מומלץ מספר ייעודי לגיוס כדי לא להתבלבל." },
    { ref: setShiftRef,   title: "משמרות זמינות",        body: "סמן את כל המשמרות שבהן יש לך משרות — בוקר, ערב, סופ״ש ועוד. זה עוזר להתאים את המועמדים הנכונים." },
    { ref: setAccountRef, title: "צוות, שאלון וחשבון",   body: "ניהול צוות, שאלון סינון למועמדים, תוכניות ומחירים והתנתקות — כל הפעולות במקום אחד.", next: "כמעט סיימנו" },
    { ref: setSaveRef,    title: "שמירת שינויים",        body: "שינית משהו? כפתור 'שמור שינויים' נדלק למטה. לחיצה אחת והכול מתעדכן.", next: "סיום הסיור" },
    { ref: null,          title: "סיימת את הסיור! 🚀",   body: "זהו — אתה מוכן לקבל מועמדים. אפשר להריץ את הסיור שוב בכל עת מתוך ההגדרות.", next: "סיום" },
  ];

  const steps = phase === "jobs" ? jobsSteps : phase === "settings" ? settingsSteps : [];
  const cur = steps[coach];

  const next = () => {
    if (phase === "jobs") {
      if (coach < jobsSteps.length - 1) setCoach(coach + 1);
      else { setCoach(0); setPhase("settings"); }
    } else if (phase === "settings") {
      if (coach < settingsSteps.length - 1) setCoach(coach + 1);
      else setPhase("done");
    }
  };
  const back = () => setCoach((c) => Math.max(0, c - 1));
  const skip = () => setPhase("done");

  // ── Phase: WIZARD (real component) ──
  if (phase === "wizard") {
    return (
      <Phone>
        <JobsSetupWizard
          restaurant={{ id: "demo-rest", hourly_rate: 50, shifts: ["ערב"] }}
          onDone={finishWizard}
          onClose={() => setPhase("intro")}
        />
      </Phone>
    );
  }

  // ── Phase: DONE ──
  if (phase === "done") {
    return (
      <Phone>
        <div className="h-full flex flex-col items-center justify-center text-center px-8 bg-gray-50" dir="rtl">
          <div className="text-6xl mb-4">🚀</div>
          <h1 className="text-2xl font-black text-gray-900">הכול מוכן!</h1>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed">
            זה היה הסיור המודרך. ככה אונבורד חדש יראה את האפליקציה בפעם הראשונה.
          </p>
          <button onClick={() => { resetStore(); setPositions([]); setCoach(0); setPhase("intro"); }}
            className="mt-8 bg-gray-900 text-white font-bold px-6 py-3.5 rounded-full text-sm active:bg-gray-800">
            הרצת הסיור מחדש
          </button>
        </div>
      </Phone>
    );
  }

  // ── Phase: SETTINGS (mock page mirroring the real SettingsTab + coach-marks) ──
  if (phase === "settings") {
    const shiftOptions = ["בוקר", "צהריים", "ערב", "לילה", "סופ\"ש"];
    const benefitOptions = ["טיפים", "ארוחת עובד", "נסיעות", "חנייה", "שעות גמישות"];
    return (
      <Phone>
        <TourStyles />
        <div className="h-full bg-gray-50 overflow-y-auto pb-28 text-gray-900" dir="rtl">
          {/* Header — matches real SettingsTab */}
          <div className="px-5 pt-14 pb-4">
            <h2 className="text-gray-900 font-black text-xl flex items-center gap-2">
              <Settings size={20} className="text-brand-400" />
              הגדרות
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">עריכת פרטי המסעדה</p>
          </div>

          <div className="px-4 space-y-4">
            {/* Cover image preview */}
            <div className="relative h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-700 to-gray-900 flex items-end">
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="relative p-3">
                <p className="text-white text-lg font-black drop-shadow">מסעדת הדגמה</p>
                <p className="text-white/80 text-[11px] flex items-center gap-1 mt-0.5">
                  <MapPin size={11} />תל אביב · מסעדת שף
                </p>
              </div>
            </div>

            {/* פרטי מסעדה */}
            <MockSection refEl={setDetailRef} icon={Store} title="פרטי מסעדה">
              <MockField label="שם המסעדה" value="מסעדת הדגמה" />
              <MockField label="סוג מטבח" value="מסעדת שף" chevron />
              <div className="grid grid-cols-2 gap-2">
                <MockField label="עיר" value="תל אביב" />
                <MockField label="שכונה / אזור" value="שרונה" />
              </div>
              <MockField label="כתובת מלאה" value="הארבעה 19, תל אביב" />
            </MockSection>

            {/* פרטי קשר לגיוס */}
            <MockSection refEl={setContactRef} icon={PhoneIcon} title="פרטי קשר לגיוס">
              <MockField label="שם איש קשר" value="מנהל משמרת" />
              <MockField label="וואטסאפ לגיוס" value="0501234567" ltr />
              <MockField label="טלפון" value="0312345678" ltr />
            </MockSection>

            {/* משמרות זמינות */}
            <MockSection refEl={setShiftRef} icon={Clock} title="משמרות זמינות">
              <p className="text-gray-500 text-xs mb-3">בחר/בחרי את כל המשמרות שבהן יש משרות</p>
              <div className="flex flex-wrap gap-2">
                {shiftOptions.map((sft, i) => (
                  <span key={sft} className={`inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold ${
                    i % 2 === 0 ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30" : "bg-gray-50 text-gray-400 border border-gray-200"
                  }`}>{sft}{i % 2 === 0 && <Check size={12} className="mr-1" />}</span>
                ))}
              </div>
            </MockSection>

            {/* הטבות לעובד */}
            <MockSection icon={Gift} title="הטבות לעובד">
              <div className="flex flex-wrap gap-2">
                {benefitOptions.map((b, i) => (
                  <span key={b} className={`inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold ${
                    i < 2 ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30" : "bg-gray-50 text-gray-400 border border-gray-200"
                  }`}>{b}{i < 2 && <Check size={12} className="mr-1" />}</span>
                ))}
              </div>
            </MockSection>

            {/* Actions card — team / screening / plans / logout */}
            <div ref={setAccountRef} className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
              <ActionRow icon={Users} tint="purple" label="ניהול צוות" />
              <ActionRow icon={HelpCircle} tint="blue" label="שאלון סינון" />
              <ActionRow icon={CreditCard} tint="brand" label="תוכניות ומחירים" />
              <ActionRow icon={LogOut} tint="red" label="התנתקות" danger />
            </div>
          </div>
        </div>

        {/* Sticky save bar (matches real app) */}
        <div className="absolute bottom-[68px] inset-x-0 px-4 z-40">
          <button ref={setSaveRef}
            className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-2xl shadow-brand-500/40">
            שמור שינויים
          </button>
        </div>

        <BottomNav active="settings" settingsRef={navSetRef} />
        {cur && (
          <CoachOverlay targetRef={cur.ref} step={cur} index={coach} total={settingsSteps.length}
            onNext={next} onBack={back} onSkip={skip} />
        )}
      </Phone>
    );
  }

  // ── Phase: INTRO + JOBS (same page; intro = empty, jobs = populated) ──
  const isIntro = phase === "intro";
  const open = positions.filter((p) => p.is_open).length;

  return (
    <Phone>
      <TourStyles />
      <div className="h-full bg-gray-50 overflow-y-auto pb-24 text-gray-900" dir="rtl">
        {/* account chip */}
        <div className="flex justify-end px-5 pt-5">
          <div className="bg-white border border-gray-200 rounded-full pl-1 pr-3 py-1 flex items-center gap-2 shadow-sm">
            <span className="text-xs font-bold text-gray-700">מסעדת הדגמה</span>
            <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">מ</span>
          </div>
        </div>

        <div className="px-5 pt-6 pb-3">
          <h1 className="text-3xl font-black tracking-tight">משרות</h1>
          <p className="text-gray-500 text-sm mt-1">{open} פתוחות · {positions.length} בסך הכל</p>
        </div>

        <div className="px-4 space-y-3">
          {isIntro ? (
            /* Welcome card with the (now bigger) CTA */
            <div className="bg-gray-900 text-white rounded-2xl p-5">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={16} className="text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base">👋 בואו נתחיל</p>
                  <p className="text-gray-300 text-xs mt-1 leading-relaxed">
                    סיור מודרך קצר יקים יחד איתך את המשרות — נבחר תפקידים, נחליט על שכר ודרישות,
                    והכול יהיה מוכן בלי טפסים אדומים.
                  </p>
                  <button ref={ctaRef} onClick={startWizard}
                    className="mt-4 w-full bg-white text-gray-900 text-sm font-black px-5 py-4 rounded-2xl flex items-center justify-center gap-2 active:bg-gray-100 shadow-lg">
                    <Sparkles size={18} className="text-amber-500" />
                    התחלת סיור מודרך
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* summary banner (success, no red errors) */}
              <div ref={sumRef} className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Check size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-green-900 font-bold text-sm">ההקמה הושלמה</p>
                  <p className="text-green-700 text-[11px] mt-0.5">{positions.length} משרות מוכנות לגיוס — אין פרטים חסרים.</p>
                </div>
              </div>

              {/* positions list */}
              <div className="flex items-center justify-between px-1">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">משרות</p>
                <button ref={addRef} className="text-gray-900 text-xs font-bold flex items-center gap-1">
                  <Plus size={13} />הוספת משרה
                </button>
              </div>

              <div className="space-y-2">
                {positions.map((p, i) => (
                  <div key={p.id} ref={i === 0 ? cardRef : null}
                    className="rounded-2xl border bg-white shadow-sm p-4 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center text-xl">
                      {store.position_templates.find((t) => t.id === p.template_id)?.icon || "💼"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{p.name}</p>
                      <p className="text-gray-500 text-[11px] mt-0.5">
                        {p.reveal_salary !== false && p.hourly_rate > 0 ? `₪${p.hourly_rate}/שעה` : "שכר לפי סיכום"}
                      </p>
                    </div>
                    <div ref={i === 0 ? toggleRef : null}
                      className={`w-11 h-7 rounded-full flex items-center flex-shrink-0 ${p.is_open ? "bg-gray-900" : "bg-gray-200"}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md mx-1 ${p.is_open ? "translate-x-4" : ""}`} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* mandatory shifts card (visual context, matches real page) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-gray-900 font-bold text-sm">משמרות חובה לכל המסעדה</p>
            <p className="text-gray-500 text-[11px] mt-0.5">מועמדים שאינם זמינים למשמרות אלה לא יוצגו</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {[["סופי שבוע", PartyPopper], ["לילות", Moon], ["בוקר מוקדם", Sun]].map(([l, Icon]) => (
                <span key={l} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border bg-white text-gray-700 border-gray-200">
                  <Icon size={12} />{l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="jobs" settingsRef={navSetRef} />

      {/* Intro coach-mark on the CTA */}
      {isIntro && (
        <CoachOverlay
          targetRef={ctaRef}
          step={{ title: "ברוכים הבאים ל-ShiftMatch 👋", body: "בוא נקים יחד את המשרות הראשונות שלך — לוקח פחות מדקה. לחץ כדי להתחיל את הסיור.", next: "בוא נתחיל" }}
          index={0} total={1}
          onNext={startWizard} onBack={() => {}} onSkip={skip} />
      )}

      {/* Jobs coach-mark tour */}
      {phase === "jobs" && cur && (
        <CoachOverlay targetRef={cur.ref} step={cur} index={coach} total={jobsSteps.length}
          onNext={next} onBack={back} onSkip={skip} />
      )}
    </Phone>
  );
}

// ── Small presentational helpers ───────────────────────────────────────────────
const DEMO_FALLBACK = [
  { id: "f1", template_id: "t-waiter",    name: "מלצר/ית", hourly_rate: 52, is_open: true,  reveal_salary: true },
  { id: "f2", template_id: "t-bartender", name: "ברמן/ית", hourly_rate: 0,  is_open: true,  reveal_salary: false },
];

function Phone({ children }) {
  // Phone-sized frame centered on desktop; full-screen on mobile preview.
  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center sm:py-6">
      <div className="relative w-full sm:max-w-[390px] h-screen sm:h-[844px] bg-white sm:rounded-[2.2rem] sm:shadow-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function MockSection({ refEl, icon: Icon, title, children }) {
  return (
    <div ref={refEl} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} className="text-brand-400" />
        <h3 className="text-gray-900 font-bold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MockField({ label, value, ltr, chevron }) {
  return (
    <div>
      <label className="text-gray-500 text-[11px] font-bold uppercase tracking-wide block mb-1.5">{label}</label>
      <div className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 text-sm flex items-center justify-between ${ltr ? "flex-row-reverse" : ""}`}>
        <span className={ltr ? "text-left w-full" : ""} dir={ltr ? "ltr" : "rtl"}>{value}</span>
        {chevron && <span className="text-gray-400">›</span>}
      </div>
    </div>
  );
}

const TINTS = {
  purple: "bg-purple-500/15 text-purple-500",
  blue:   "bg-blue-500/15 text-blue-500",
  brand:  "bg-brand-500/15 text-brand-500",
  red:    "bg-red-500/15 text-red-500",
};
function ActionRow({ icon: Icon, tint, label, danger }) {
  return (
    <div className="w-full px-4 py-3.5 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${TINTS[tint]}`}>
        <Icon size={16} />
      </div>
      <span className={`flex-1 text-right font-bold text-sm ${danger ? "text-red-500" : "text-gray-900"}`}>{label}</span>
      {!danger && <span className="text-gray-300">›</span>}
    </div>
  );
}

function TourStyles() {
  return (
    <style>{`
      @keyframes tourPulse {
        0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.9), 0 0 0 3px rgba(251,191,36,0.9); }
        70%  { box-shadow: 0 0 0 14px rgba(255,255,255,0), 0 0 0 3px rgba(251,191,36,0.6); }
        100% { box-shadow: 0 0 0 0 rgba(255,255,255,0), 0 0 0 3px rgba(251,191,36,0.9); }
      }
      .tour-ring { animation: tourPulse 1.8s ease-out infinite; }
    `}</style>
  );
}
