import { useState, useLayoutEffect, useCallback } from "react";
import { Sparkles, ChevronLeft } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CoachTour — a "video-game tutorial" coach-mark overlay. Dims the screen, cuts a
// rounded spotlight hole around the current target element, draws a pulsing ring,
// and shows a tooltip with Back / Next / Skip.
//
// Targets are looked up live by CSS selector (data-tour="…"), so a single tour can
// span multiple tabs/screens — the parent just switches tabs and the overlay polls
// for the element to appear (it may mount asynchronously after a tab change or a
// data fetch). A step with selector=null shows a centered tooltip (intro/outro).
//
// Used by Dashboard to onboard brand-new owners right after the jobs wizard.
// ─────────────────────────────────────────────────────────────────────────────
export default function CoachTour({ step, index, total, onNext, onBack, onSkip }) {
  const [rect, setRect] = useState(null);
  const selector = step?.selector || null;

  const measure = useCallback(() => {
    if (!selector) { setRect(null); return true; }
    const el = document.querySelector(selector);
    if (!el) { setRect(null); return false; }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;   // not laid out yet
    setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    return true;
  }, [selector]);

  // Poll for the target — it may mount after a tab switch or an async load — then
  // keep it measured against scroll/resize. Caps at ~4s so it never spins forever.
  useLayoutEffect(() => {
    let tries = 0, scrolled = false, settle;
    const attempt = () => {
      const el = selector ? document.querySelector(selector) : null;
      if (selector && el && !scrolled && el.scrollIntoView) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        scrolled = true;
        settle = setTimeout(measure, 360);   // re-measure once scroll settles
      }
      return measure();
    };
    const done = attempt();
    const iv = (!selector || done) ? null : setInterval(() => {
      if (attempt() || ++tries > 40) clearInterval(iv);
    }, 100);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      if (iv) clearInterval(iv);
      clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, selector, index]);

  const pad = 8;
  const hole = rect && {
    x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2,
  };

  // Tooltip placement: below the hole if there's room, else above; centered if no target.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const below = hole ? hole.y + hole.h + 14 : null;
  const placeAbove = hole && below + 210 > vh;
  const tipTop = !hole ? null : placeAbove ? Math.max(12, hole.y - 14) : below;

  return (
    // Root is interactive (pointer-events-auto) so taps on the dimmed page are
    // swallowed — the tour advances only via the tooltip buttons. Keeps a new
    // owner from accidentally toggling controls or opening modals mid-tour.
    <div className="fixed inset-0 z-[100] pointer-events-auto" dir="rtl">
      <style>{`
        @keyframes coachPulse {
          0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.9), 0 0 0 3px rgba(251,191,36,0.9); }
          70%  { box-shadow: 0 0 0 14px rgba(255,255,255,0), 0 0 0 3px rgba(251,191,36,0.6); }
          100% { box-shadow: 0 0 0 0 rgba(255,255,255,0), 0 0 0 3px rgba(251,191,36,0.9); }
        }
        .coach-ring { animation: coachPulse 1.8s ease-out infinite; }
      `}</style>

      {/* Dim + spotlight hole (SVG mask = crisp rounded cut-out) */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="coach-hole">
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx="16" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(17,24,39,0.72)" mask="url(#coach-hole)" />
      </svg>

      {/* Pulsing ring around the target */}
      {hole && (
        <div className="absolute rounded-2xl coach-ring"
          style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
      )}

      {/* Tooltip */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[min(20rem,90vw)] bg-white rounded-2xl shadow-2xl p-4"
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
          className="absolute -top-3 -left-3 bg-white shadow-md text-gray-400 text-[11px] font-bold px-2.5 py-1 rounded-full active:text-gray-700">
          דילוג על הסיור
        </button>
      </div>
    </div>
  );
}

// Step definitions for the new-owner onboarding tour. `tab` tells Dashboard which
// tab must be active; `selector` is the data-tour target to spotlight.
export const OWNER_TOUR_STEPS = [
  { tab: "jobs", selector: '[data-tour="jobs-position"]',
    title: "המשרות שלך מוכנות! 🎉",
    body: "כל מה שהגדרת בסיור כבר כאן — בלי שדות אדומים. לחיצה על משרה פותחת אותה, ושם מעדכנים שכר, משמרות ודרישות מתי שתרצה." },
  { tab: "jobs", selector: '[data-tour="jobs-toggle"]',
    title: "הדלקה וכיבוי גיוס",
    body: "לכל משרה יש מתג. כהה = פעיל ומגייס, אפור = מושהה. לחיצה אחת וזהו — בלי למחוק כלום." },
  { tab: "jobs", selector: '[data-tour="jobs-add"]',
    title: "הוספת עוד משרות",
    body: "צריך תפקיד נוסף? אפשר להוסיף משרה חדשה בכל רגע מהכפתור הזה." },
  { tab: "jobs", selector: '[data-tour="nav-settings"]',
    title: "עכשיו — ההגדרות",
    body: "בוא נראה לך איפה משנים את פרטי המסעדה ואת הגדרות הגיוס.", next: "להגדרות" },
  { tab: "settings", selector: '[data-tour="settings-details"]',
    title: "פרטי המסעדה",
    body: "שם, סוג מטבח, עיר, כתובת ותמונת כריכה — בדיוק מה שהמלצרים רואים בכרטיס המודעה. הכול נערך כאן." },
  { tab: "settings", selector: '[data-tour="settings-contact"]',
    title: "פרטי קשר לגיוס",
    body: "וואטסאפ וטלפון שאליהם המועמדים פונים. מומלץ מספר ייעודי לגיוס כדי לא להתבלבל." },
  { tab: "settings", selector: '[data-tour="settings-shifts"]',
    title: "משמרות זמינות",
    body: "סמן את כל המשמרות שבהן יש לך משרות — זה עוזר להתאים את המועמדים הנכונים." },
  { tab: "settings", selector: '[data-tour="settings-actions"]',
    title: "צוות, שאלון וחשבון",
    body: "ניהול צוות, שאלון סינון למועמדים, תוכניות ומחירים והתנתקות — כל הפעולות במקום אחד.", next: "כמעט סיימנו" },
  { tab: "settings", selector: null,
    title: "סיימת את הסיור! 🚀",
    body: "זהו — אתה מוכן לקבל מועמדים. אפשר להריץ את הסיור שוב בכל עת מתוך ההגדרות.", next: "סיום" },
];
