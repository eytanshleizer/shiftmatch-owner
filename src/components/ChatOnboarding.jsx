import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Send, ChevronLeft, Sparkles, MapPin, Loader2, Check } from "lucide-react";
import { logEvent } from "../lib/tracking";
import { normalizePhoneInput, isValidIsraeliPhone } from "../lib/phone";

const POSITIONS = [
  { id: "מלצרים/ות",   emoji: "🧑‍🍳" },
  { id: "ברמנים/יות",  emoji: "🍸" },
  { id: "מארחות/ים",   emoji: "💁" },
  { id: "מנהלי משמרת", emoji: "📋" },
  { id: "עוזרי מלצר",  emoji: "🙋" },
  { id: "קופאים/ות",   emoji: "💰" },
  { id: "מזון מהיר",   emoji: "🍔" },
];
const SHIFTS    = ["בוקר","צהריים","ערב","לילה","סופ\"ש"];
const BENEFITS  = ["טיפים","ארוחת עובד","נסיעות","בונוסים","חנייה","קידום פנימי","הכשרה","ביגוד","טיפים גבוהים","שעות גמישות","מונית הביתה"];
const REQUIREMENTS = ["ניסיון 1+ שנה","אנגלית","שירות צבאי","אדיב/ה","עבודת צוות","יוזמה","ניידות","עברית רהוטה"];
const VIBES = [
  { id: "high-end",  emoji: "✨", label: "פיין דיינינג / שף" },
  { id: "casual",    emoji: "🍴", label: "קז'ואל / משפחתי" },
  { id: "bar",       emoji: "🍹", label: "בר / נייטלייף" },
  { id: "cafe",      emoji: "☕", label: "בית קפה" },
  { id: "fast",      emoji: "🍔", label: "מזון מהיר" },
];

// Simplified manual flow — no AI guessing.  Owner fills every field directly.
const FLOW = [
  "greet",         // bot greeting
  "name",          // restaurant name
  "type",          // restaurant type (FREE TEXT: "סושי", "איטלקי", "מסעדת שף"...)
  "city",          // city
  "area",          // neighborhood / area (optional)
  "positions",     // which positions needed
  "counts",        // how many of each
  "salary",        // hourly wage per position
  "shifts",        // shifts available
  "benefits",      // benefits offered (optional)
  "urgent",        // urgent hiring?
  "whatsapp",      // recruitment WhatsApp number
  "saving",        // saving to DB
  "done",          // completed
];

function BotBubble({ children, isTyping }) {
  return (
    <div className="flex items-end gap-2 chat-bubble-bot">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-base flex-shrink-0 shadow-lg shadow-brand-500/30">🤖</div>
      <div className="bg-white/[0.06] backdrop-blur border border-white/5 text-white rounded-3xl rounded-bl-md px-4 py-3 max-w-[82%] text-sm leading-relaxed">
        {isTyping
          ? <span className="flex gap-1.5 py-1">{[0,1,2].map(i => <span key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}</span>
          : children}
      </div>
    </div>
  );
}

function UserBubble({ children }) {
  return (
    <div className="flex justify-start flex-row-reverse chat-bubble-user">
      <div className="bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-3xl rounded-br-md px-4 py-3 max-w-[80%] text-sm font-medium shadow-lg shadow-brand-500/20">{children}</div>
    </div>
  );
}

export default function ChatOnboarding({ user, onDone }) {
  const [messages, setMessages]     = useState([]);
  const [step, setStep]             = useState("greet");
  const [input, setInput]           = useState("");
  const [typing, setTyping]         = useState(false);
  const [stepHistory, setStepHistory] = useState([]);
  const bottomRef                   = useRef(null);

  const canGoBack = stepHistory.length > 0 &&
    !["greet", "searching", "saving", "done"].includes(step);

  const goBack = () => {
    if (!canGoBack) return;
    // Remove last user message + all bot messages after it
    setMessages(prev => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === "user") return prev.slice(0, i);
      }
      return prev;
    });
    const prevStep = stepHistory[stepHistory.length - 1];
    setStepHistory(h => h.slice(0, -1));
    setInput("");
    setStep(prevStep);
  };

  // Collected data
  const data = useRef({
    name: "",
    isChain: false,
    branchLocation: "",
    type: "",
    cuisine: "",
    city: "",
    area: "",
    address: "",
    description: "",
    vibe: "casual",
    price_range: "₪₪",
    phone: "",
    recruitment_whatsapp: "",
    image_url: "",
    positions: [],
    positionCounts: {},
    positionSalaries: {},
    totalPositions: 1,
    hourly_rate: 45,
    experience: "",
    shifts: [],
    benefits: [],
    requirements: [],
    urgent: false,
    aiData: null,
    candidates: [],
    searchAttempts: 0,
  });

  const addBot = (content, delay = 700) => new Promise(res => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(prev => [...prev, { role: "bot", content }]);
      res();
    }, delay);
  });

  const addUser = (content) => setMessages(prev => [...prev, { role: "user", content }]);

  // Initial greeting.  If the user signed up with a restaurant name already
  // (per SPEC 1.1) we skip the "name" step entirely.
  useEffect(() => {
    (async () => {
      const userName = user?.user_metadata?.name?.split(" ")[0] || "";
      const presetRestaurantName = user?.user_metadata?.restaurant_name?.trim();

      await addBot(<>שלום{userName ? ` ${userName}` : ""}! 👋<br/>אני <span className="text-brand-400 font-bold">מאי</span>, עוזרת ההגדרה שלך.</>, 600);

      if (presetRestaurantName) {
        // Restaurant name already provided at signup — skip to type.
        data.current.name = presetRestaurantName;
        await addBot(<>בוא נקים את <b className="text-white">{presetRestaurantName}</b> תוך 2 דקות 🚀</>, 1100);
        await addBot("איזה סוג מסעדה זה?", 900);
        await addBot("לדוגמה: סושי, איטלקי, מסעדת שף, בית קפה, בר...", 1100);
        setStep("type");
      } else {
        await addBot("בוא נקים את המסעדה שלך תוך 2 דקות 🚀", 1100);
        await addBot("איך קוראים למסעדה שלך?", 1000);
        setStep("name");
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Apply chosen candidate to data
  const applyCandidate = (c) => {
    data.current.aiData = c;
    if (c.name)        data.current.name = c.name;
    if (c.type)        data.current.type = c.type;
    if (c.cuisine)     data.current.cuisine = c.cuisine;
    if (c.city)        data.current.city = c.city;
    if (c.area)        data.current.area = c.area;
    if (c.address)     data.current.address = c.address;
    if (c.description) data.current.description = c.description;
    if (c.vibe)        data.current.vibe = c.vibe;
    if (c.price_range) data.current.price_range = c.price_range;
    if (c.phone)       data.current.phone = c.phone;
    if (c.typical_hourly_wage_range) {
      const m = c.typical_hourly_wage_range.match(/(\d+)/g);
      if (m && m.length >= 2) data.current.hourly_rate = Math.round((Number(m[0]) + Number(m[1])) / 2);
    }
    if (c.typical_requirements?.length) data.current.requirements = c.typical_requirements.slice(0,4);
    if (c.typical_benefits?.length)     data.current.benefits = c.typical_benefits.slice(0,5);
    if (c.shifts_typical?.length)       data.current.shifts = c.shifts_typical;
  };

  // ── AI deep research ──
  const researchRestaurant = async () => {
    data.current.searchAttempts += 1;
    const attempt = data.current.searchAttempts;

    await addBot(
      <div className="space-y-1.5">
        <p>
          {attempt === 1
            ? <>סבבה, מחפשת את <b className="text-brand-400">{data.current.name}</b> בגוגל...</>
            : <>מחפשת שוב באתרים אחרים...</>}
        </p>
        <p className="text-xs text-gray-400">🔎 Google · TripAdvisor · Wolt · Instagram · rest.co.il</p>
      </div>,
      400
    );

    setTyping(true);
    try {
      const res = await fetch("/api/research-restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.current.name,
          city: data.current.city,
          isChain: data.current.isChain,
          branchLocation: data.current.branchLocation,
        }),
      });
      const result = await res.json();
      setTyping(false);

      const candidates = result.candidates || [];
      data.current.candidates = candidates;

      if (candidates.length === 0) {
        // Not found in web search.  On first attempt offer retry, on second just skip
        // straight to manual flow so the user isn't stuck in a loop.
        if (attempt === 1) {
          await addBot(
            <div className="space-y-1.5">
              <p>לא הצלחתי למצוא את <b>{data.current.name}</b> ברשת 🤔</p>
              <p className="text-xs text-gray-400">אולי הכתיב שונה? תן/י לי את השם בעברית או באנגלית עם עיר מדויקת</p>
            </div>,
            400
          );
          setStep("pickCandidate"); // shows retry/manual buttons
        } else {
          await addBot(
            <div className="space-y-1.5">
              <p>בסדר, נמשיך ידנית — אסדר איתך הכל בשניות 💪</p>
            </div>,
            300
          );
          await addBot("איך תגדיר/י את המסעדה?", 700);
          setStep("vibe");
        }
      } else if (candidates.length === 1) {
        // Single match — auto-apply and show confirm
        applyCandidate(candidates[0]);
        await addBot(
          <div className="space-y-2">
            <p>מצאתי! ✨</p>
            <ResearchCard d={data.current} found={candidates[0]} />
          </div>,
          300
        );
        await addBot("האם זו המסעדה הנכונה?", 600);
        setStep("confirm");
      } else {
        // Multiple matches — let user pick
        await addBot(
          <div className="space-y-1">
            <p>מצאתי {candidates.length} מסעדות שמתאימות 🔍</p>
            <p className="text-xs text-gray-400">איזה מהן שלך?</p>
          </div>,
          400
        );
        setStep("pickCandidate");
      }
    } catch (e) {
      setTyping(false);
      await addBot("חיפוש האינטרנט לא זמין כרגע — נמשיך ביחד ידנית 💪", 200);
      await addBot("איך תגדיר/י את המסעדה?", 700);
      setStep("vibe");
    }
  };

  // ── Step navigation ──
  const advance = async (currentStep, value) => {
    switch (currentStep) {
      case "name":
        data.current.name = value;
        addUser(value);
        setInput("");
        setStepHistory(h => [...h, "name"]);
        await addBot("נחמד! איזה סוג מסעדה זה?", 600);
        await addBot("לדוגמה: סושי, איטלקי, מסעדת שף, בית קפה, בר...", 900);
        setStep("type");
        break;

      case "type":
        data.current.type = value;
        addUser(value);
        setInput("");
        setStepHistory(h => [...h, "type"]);
        await addBot("יופי! באיזו עיר?", 700);
        setStep("city");
        break;

      case "city":
        data.current.city = value;
        addUser(value);
        setInput("");
        setStepHistory(h => [...h, "city"]);
        await addBot("איזה אזור / שכונה? (לא חובה — אפשר לדלג)", 700);
        setStep("area");
        break;

      case "area":
        // "skip" comes from the skip button; otherwise free text
        if (value && value !== "__skip__") {
          data.current.area = value;
          addUser(value);
        } else {
          addUser("דלגתי");
        }
        setInput("");
        setStepHistory(h => [...h, "area"]);
        await addBot("איזה תפקידים את/ה צריך לגייס?", 700);
        setStep("positions");
        break;

      case "positions":
        data.current.positions = value;
        addUser(value.join(" · "));
        const initialCounts = {};
        value.forEach(p => initialCounts[p] = 1);
        data.current.positionCounts = initialCounts;
        setStepHistory(h => [...h, "positions"]);
        await addBot("כמה עובדים אתה צריך מכל תפקיד?", 700);
        setStep("counts");
        break;

      case "counts":
        data.current.positionCounts = value;
        const total = Object.values(value).reduce((a,b) => a+b, 0);
        data.current.totalPositions = total;
        // Initialize salaries with smart defaults per position
        const defaultSal = data.current.aiData?.typical_hourly_wage_range
          ? (() => {
              const m = data.current.aiData.typical_hourly_wage_range.match(/(\d+)/g);
              if (m && m.length >= 2) return Math.round((Number(m[0]) + Number(m[1])) / 2);
              return 45;
            })()
          : 45;
        const initialSalaries = {};
        data.current.positions.forEach(p => {
          // Smart defaults per position type
          initialSalaries[p] =
            p.includes("ברמן")    ? defaultSal + 5 :
            p.includes("מנהל")    ? defaultSal + 15 :
            p.includes("מארח")    ? defaultSal :
            p.includes("עוזרי")   ? defaultSal - 5 :
            p.includes("קופאי")   ? defaultSal - 3 :
            p.includes("מהיר")    ? Math.max(35, defaultSal - 8) :
                                    defaultSal;
        });
        data.current.positionSalaries = initialSalaries;
        addUser(`${total} עובדים בסך הכל`);
        setStepHistory(h => [...h, "counts"]);
        await addBot("מה השכר לשעה לכל תפקיד?", 700);
        setStep("salary");
        break;

      case "salary":
        // value is an object: { position: salary, ... }
        data.current.positionSalaries = value;
        const salaries = Object.values(value);
        const avgSalary = Math.round(salaries.reduce((a,b)=>a+b,0) / salaries.length);
        data.current.hourly_rate = avgSalary;
        const salaryLine = Object.entries(value)
          .map(([p, s]) => `${p}: ₪${s}`).join(" · ");
        addUser(salaryLine);
        setStepHistory(h => [...h, "salary"]);
        await addBot("אילו משמרות העובדים יצטרכו לכסות?", 700);
        setStep("shifts");
        break;

      case "shifts":
        data.current.shifts = value;
        addUser(value.join(" · "));
        setStepHistory(h => [...h, "shifts"]);
        await addBot("מה ההטבות שאתה מציע לעובדים? (אופציונלי)", 700);
        setStep("benefits");
        break;

      case "benefits":
        data.current.benefits = value;
        addUser(value.length ? value.join(" · ") : "ללא הטבות מיוחדות");
        setStepHistory(h => [...h, "benefits"]);
        await addBot("האם זה גיוס דחוף? 🚨", 700);
        setStep("urgent");
        break;

      case "urgent":
        data.current.urgent = value;
        if (value) {
          addUser("🚨 כן, דחוף — ₪79");
          setStepHistory(h => [...h, "urgent"]);
          await addBot(
            <div className="space-y-1.5">
              <p>מעולה! 🔥</p>
              <p className="text-xs text-gray-400">הסכום ₪79 יחויב לאחר השמירה (משולם — בקרוב)</p>
            </div>,
            500
          );
        } else {
          addUser("לא, רגיל");
          setStepHistory(h => [...h, "urgent"]);
        }
        await addBot(
          <div className="space-y-1">
            <p>מה מספר הוואטסאפ לגיוס?</p>
            <p className="text-xs text-gray-400">📱 כל המועמדים ייצרו איתך קשר דרכו — הוא ההודעה הראשונה שתקבל</p>
          </div>,
          800
        );
        setStep("whatsapp");
        break;

      case "whatsapp":
        data.current.recruitment_whatsapp = value;
        data.current.phone = value; // also use as main phone if not set
        addUser(<>📱 {value}</>);
        setInput("");
        setStep("saving");
        await addBot("מעולה! מעלה את המודעה לאוויר... 🚀", 400);
        await saveRestaurant();
        break;
    }
  };

  // PROTOCOL: Always geocode the restaurant address before saving — guarantees accurate map location
  const geocodeRestaurant = async (name, address, city) => {
    try {
      const res = await fetch("/api/geocode-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, city }),
      });
      const data = await res.json();
      if (data?.lat && data?.lng) {
        return { lat: data.lat, lng: data.lng, verified_address: data.verified_address };
      }
    } catch (e) { /* geocode is best-effort; if the api isn't available we just save without coords */ }
    return null;
  };

  const saveRestaurant = async () => {
    const d = data.current;

    // Geocode address before save
    const geo = await geocodeRestaurant(d.name, d.address, d.city);
    const finalLat = geo?.lat || null;
    const finalLng = geo?.lng || null;
    const finalAddress = geo?.verified_address || d.address || "";

    const { data: saved, error } = await supabase
      .from("restaurants")
      .upsert({
        owner_id:       user.id,
        name:           d.name,
        type:           d.type || "מסעדה",
        city:           d.city || "תל אביב",
        area:           d.area || "",
        address:        finalAddress,
        lat:            finalLat,
        lng:            finalLng,
        description:    d.description || `${d.name} - ${d.type || "מסעדה"} ב${d.city || "תל אביב"}`,
        phone:          d.phone || d.recruitment_whatsapp || "",
        recruitment_whatsapp: d.recruitment_whatsapp || d.phone || "",
        image_url:      d.image_url || `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80`,
        hourly_rate:    d.hourly_rate,
        position_salaries: d.positionSalaries,
        position_counts:   d.positionCounts,
        open_positions: d.totalPositions,
        shifts:         d.shifts,
        benefits:       d.benefits,
        requirements:   d.requirements,
        urgent:         d.urgent,
        position_types: d.positions,
        active:         true,
        contact_name:   user.user_metadata?.name || user.email,
      }, { onConflict: "owner_id" })
      .select()
      .single();

    if (!error && saved) {
      logEvent("restaurant", "published", {
        user_id: user.id,
        owner_name: user.user_metadata?.name || user.email,
        email: user.email,
        restaurant_name: d.name,
        city: d.city,
        address: finalAddress,
        type: d.type,
        phone: d.phone,
        hourly_rate: d.hourly_rate,
        open_positions: d.totalPositions,
        urgent: d.urgent,
        active: true,
      });
      await addBot(
        <div className="space-y-2">
          <p className="font-bold">המסעדה שלך עלתה לאוויר! 🎉</p>
          <p className="text-xs text-gray-400">מועמדים כבר רואים אותה ב-ShiftMatch</p>
        </div>,
        500
      );
      setTimeout(() => onDone(saved), 1500);
    } else {
      await addBot(`היה לי בעיה בשמירה: ${error?.message}`, 300);
    }
  };

  // ── Input renderer ──
  const renderInput = () => {
    if (step === "greet" || step === "searching" || step === "saving" || step === "done") return null;

    if (step === "name") return (
      <TextInput value={input} onChange={setInput} placeholder="שם המסעדה..."
        onSend={() => input.trim() && advance("name", input.trim())} />
    );

    if (step === "type") return (
      <TextInput value={input} onChange={setInput}
        placeholder='סושי, איטלקי, מסעדת שף...'
        onSend={() => input.trim() && advance("type", input.trim())} />
    );

    if (step === "city") return (
      <TextInput value={input} onChange={setInput}
        placeholder="עיר..."
        onSend={() => input.trim() && advance("city", input.trim())} />
    );

    if (step === "area") return (
      <div className="space-y-2">
        <TextInput value={input} onChange={setInput}
          placeholder="שכונה / אזור (אופציונלי)"
          onSend={() => input.trim() && advance("area", input.trim())} />
        <button onClick={() => advance("area", "__skip__")}
          className="w-full text-gray-500 text-xs py-2 active:text-gray-300">
          דלג ←
        </button>
      </div>
    );

    if (step === "positions") return <MultiSelectChips options={POSITIONS} onDone={v => advance("positions", v)} minOne />;

    if (step === "counts") return <CountsInput positions={data.current.positions} onDone={v => advance("counts", v)} />;

    if (step === "salary") return (
      <PerPositionSalary
        positions={data.current.positions}
        initial={data.current.positionSalaries}
        wageHint={data.current.aiData?.typical_hourly_wage_range}
        onDone={v => advance("salary", v)}
      />
    );

    if (step === "shifts") return (
      <MultiSelectChips options={SHIFTS.map(s => ({id: s, emoji: "🕐"}))} onDone={v => advance("shifts", v)} minOne />
    );

    if (step === "benefits") return (
      <MultiSelectChips options={BENEFITS.map(b => ({id: b, emoji: "✓"}))} onDone={v => advance("benefits", v)} />
    );

    if (step === "urgent") return (
      <div className="space-y-2">
        <button onClick={() => advance("urgent", true)}
          className="w-full bg-gradient-to-l from-red-500 to-red-600 text-white font-bold py-4 rounded-2xl text-sm active:opacity-80 shadow-lg shadow-red-500/30 flex items-center justify-between px-5 relative overflow-hidden">
          <span className="absolute top-1.5 left-2 bg-yellow-400 text-black text-[9px] font-black px-2 py-0.5 rounded-full">פרימיום</span>
          <span className="flex items-center gap-2">
            <span>🚨</span>
            <div className="text-right">
              <p className="font-black text-sm">גיוס דחוף</p>
              <p className="text-[10px] text-white/80 font-medium">חשיפה ×4 · תגית אדומה · עליון בחיפוש</p>
            </div>
          </span>
          <span className="bg-white/20 text-white text-xs font-black px-3 py-1.5 rounded-full">₪79</span>
        </button>
        <button onClick={() => advance("urgent", false)}
          className="w-full bg-white/8 text-white font-bold py-4 rounded-2xl text-sm active:bg-white/15 border border-white/5">
          לא, גיוס רגיל (חינם)
        </button>
      </div>
    );

    if (step === "whatsapp") return (
      <div className="space-y-2">
        <TextInput
          value={input}
          onChange={(v) => setInput(normalizePhoneInput(v))}
          type="tel"
          maxLength={10}
          inputMode="numeric"
          placeholder="0501234567 (WhatsApp)"
          onSend={() => isValidIsraeliPhone(input) && advance("whatsapp", input)}
        />
        <p className={`text-[10px] text-center ${
          input && !isValidIsraeliPhone(input) ? "text-amber-400" : "text-gray-500"
        }`}>
          {input && !isValidIsraeliPhone(input)
            ? "מספר חייב להיות בין 9 ל-10 ספרות"
            : "💚 וודא/י שזה מספר עם חשבון WhatsApp פעיל"}
        </p>
      </div>
    );

    return null;
  };

  // Progress
  const stepIdx = FLOW.indexOf(step);
  const visibleSteps = FLOW.filter(s => !["greet","searching","saving","done"].includes(s));
  const myIdx = visibleSteps.indexOf(step);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#0F0F0F] to-[#1a1a1a]">
      {/* Header */}
      <div className="bg-[#0F0F0F]/80 backdrop-blur-xl px-4 safe-top pb-3 flex-shrink-0 border-b border-white/5">
        <div className="flex items-center gap-3 pt-3">
          {canGoBack && (
            <button onClick={goBack}
              className="w-9 h-9 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center flex-shrink-0 active:bg-white/10">
              <ChevronLeft size={18} className="text-gray-400" style={{ transform: "rotate(180deg)" }} />
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-base shadow-lg shadow-brand-500/30 flex-shrink-0">🤖</div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-white font-bold text-sm">מאי</p>
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              <span className="text-[10px] text-gray-400">פעילה</span>
            </div>
            <p className="text-gray-500 text-[10px]">עוזרת AI · הגדרת מסעדה</p>
          </div>
          {/* Escape hatch: lets a stuck user sign out and start over */}
          <button onClick={() => supabase.auth.signOut()}
            className="text-[10px] text-gray-500 font-medium px-2 py-1 rounded-md active:bg-white/5">
            התנתק/י
          </button>
        </div>
        {/* Progress bar */}
        <div className="flex gap-1 mt-3">
          {visibleSteps.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i < myIdx ? "bg-brand-500" : i === myIdx ? "bg-brand-400 animate-pulse" : "bg-white/8"
            }`} />
          ))}
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ WebkitOverflowScrolling: "touch" }}>
        {messages.map((m, i) =>
          m.role === "bot"
            ? <BotBubble key={i}>{m.content}</BotBubble>
            : <UserBubble key={i}>{m.content}</UserBubble>
        )}
        {typing && <BotBubble isTyping />}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Input area */}
      <div className="bg-[#0F0F0F]/90 backdrop-blur-xl px-4 pt-3 pb-4 safe-bottom flex-shrink-0 border-t border-white/5">
        {renderInput()}
      </div>
    </div>
  );
}

// ── Reusable components ──

function ResearchCard({ d, found }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Sparkles size={14} className="text-yellow-400" />
        <p className="font-bold text-sm">מצאתי את {d.name}!</p>
      </div>

      <div className="bg-white/5 rounded-2xl p-3 space-y-2 -mx-1">
        <Row label="סוג" value={`${found.type || "—"}${found.cuisine ? ` · ${found.cuisine}` : ""}`} />
        {found.city && <Row label="מיקום" value={`${found.city}${found.area ? ` · ${found.area}` : ""}`} />}
        {found.address && <Row label="כתובת" value={found.address} icon={<MapPin size={11}/>} />}
        {found.vibe && <Row label="סגנון" value={vibeName(found.vibe)} />}
        {found.price_range && <Row label="טווח מחיר" value={found.price_range} />}
        {found.typical_hourly_wage_range && <Row label="שכר אופייני" value={found.typical_hourly_wage_range} />}
      </div>

      {found.description && (
        <div className="bg-white/5 rounded-2xl p-3 -mx-1">
          <p className="text-xs text-gray-400 mb-1">תיאור</p>
          <p className="text-xs text-gray-200 leading-relaxed">{found.description}</p>
        </div>
      )}

      {found.known_for?.length > 0 && (
        <div className="bg-white/5 rounded-2xl p-3 -mx-1">
          <p className="text-xs text-gray-400 mb-2">מפורסם ב:</p>
          <div className="flex flex-wrap gap-1.5">
            {found.known_for.map((k,i) => <span key={i} className="bg-brand-500/15 text-brand-300 text-[10px] px-2 py-0.5 rounded-full">{k}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

function vibeName(v) {
  return ({
    "high-end": "✨ פיין דיינינג / שף",
    "casual":   "🍴 קז'ואל",
    "bar":      "🍹 בר / נייטלייף",
    "cafe":     "☕ בית קפה",
    "fast":     "🍔 מזון מהיר",
    "family":   "👨‍👩‍👧 משפחתי",
  })[v] || v;
}

function Row({ label, value, icon }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-gray-400 flex-shrink-0 flex items-center gap-1">{icon}{label}</span>
      <span className="text-[11px] text-white font-medium text-left truncate">{value}</span>
    </div>
  );
}

function TextInput({ value, onChange, onSend, placeholder, type = "text", maxLength, inputMode }) {
  const dir = type === "tel" ? "ltr" : undefined;
  return (
    <div className="flex gap-2">
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        dir={dir}
        className={`flex-1 bg-white/8 text-white placeholder-gray-500 rounded-2xl px-4 py-3.5 text-sm outline-none focus:bg-white/12 focus:ring-2 focus:ring-brand-500/40 border border-white/5 ${dir === "ltr" ? "text-left" : ""}`}
      />
      <button onClick={onSend} disabled={!value.trim()}
        className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center active:bg-brand-600 disabled:opacity-40 disabled:bg-white/10 shadow-lg shadow-brand-500/30">
        <Send size={17} className="text-white" />
      </button>
    </div>
  );
}

function ButtonRow({ children }) {
  return <div className="flex gap-2">{children}</div>;
}

function PrimaryBtn({ children, onClick }) {
  return (
    <button onClick={onClick}
      className="flex-1 bg-brand-500 text-white font-bold py-4 rounded-2xl text-sm active:bg-brand-600 shadow-lg shadow-brand-500/30">{children}</button>
  );
}

function SecondaryBtn({ children, onClick }) {
  return (
    <button onClick={onClick}
      className="flex-1 bg-white/10 text-white font-bold py-4 rounded-2xl text-sm active:bg-white/20">{children}</button>
  );
}

function MultiSelectChips({ options, onDone, minOne = false }) {
  const [selected, setSelected] = useState([]);
  const toggle = (id) => setSelected(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);
  const canDone = minOne ? selected.length > 0 : true;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
        {options.map(({ id, emoji }) => (
          <button key={id} onClick={() => toggle(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all border ${
              selected.includes(id)
                ? "bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/30"
                : "bg-white/5 text-gray-300 border-white/5"
            }`}>
            <span>{emoji}</span>{id}
            {selected.includes(id) && <Check size={12} />}
          </button>
        ))}
      </div>
      <button onClick={() => onDone(selected)} disabled={!canDone}
        className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl text-sm active:bg-brand-600 disabled:opacity-40 disabled:bg-white/10 flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/30">
        המשך <ChevronLeft size={16} />
      </button>
    </div>
  );
}

function CountsInput({ positions, onDone }) {
  const [counts, setCounts] = useState(() => {
    const c = {};
    positions.forEach(p => c[p] = 1);
    return c;
  });
  const set = (p, v) => setCounts(prev => ({ ...prev, [p]: Math.max(1, Math.min(20, v)) }));

  return (
    <div className="space-y-2">
      {positions.map(p => (
        <div key={p} className="flex items-center justify-between bg-white/5 rounded-2xl px-3 py-2.5">
          <span className="text-white text-sm font-medium">{p}</span>
          <div className="flex items-center gap-3">
            <button onClick={() => set(p, counts[p]-1)} className="w-8 h-8 bg-white/10 rounded-full text-white text-lg">−</button>
            <span className="text-brand-400 font-bold text-lg w-6 text-center">{counts[p]}</span>
            <button onClick={() => set(p, counts[p]+1)} className="w-8 h-8 bg-brand-500 rounded-full text-white text-lg">+</button>
          </div>
        </div>
      ))}
      <button onClick={() => onDone(counts)}
        className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl text-sm active:bg-brand-600 flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/30 mt-2">
        המשך <ChevronLeft size={16} />
      </button>
    </div>
  );
}

function PerPositionSalary({ positions, initial, wageHint, onDone }) {
  const [salaries, setSalaries] = useState(() => ({ ...initial }));
  const set = (p, v) => setSalaries(prev => ({ ...prev, [p]: Math.max(25, Math.min(150, v)) }));

  return (
    <div className="space-y-2.5">
      {wageHint && (
        <div className="text-[11px] text-gray-400 bg-brand-500/10 border border-brand-500/20 rounded-xl px-3 py-2 flex items-center gap-1.5">
          💡 ההערכה למסעדה כמו שלך: <span className="text-brand-400 font-bold">{wageHint}</span>
        </div>
      )}

      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {positions.map(p => (
          <div key={p} className="bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-bold">{p}</span>
              <span className="text-brand-400 font-black text-lg">₪{salaries[p] || 45}<span className="text-gray-500 text-xs font-normal">/שעה</span></span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => set(p, (salaries[p] || 45) - 1)}
                className="w-8 h-8 bg-white/10 rounded-lg text-white text-base font-bold active:bg-white/20 flex-shrink-0">−</button>
              <input type="range" min={25} max={120} value={salaries[p] || 45}
                onChange={e => set(p, Number(e.target.value))}
                className="flex-1" />
              <button onClick={() => set(p, (salaries[p] || 45) + 1)}
                className="w-8 h-8 bg-brand-500 rounded-lg text-white text-base font-bold active:bg-brand-600 flex-shrink-0">+</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => onDone(salaries)}
        className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl text-sm active:bg-brand-600 flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/30 mt-2">
        המשך <ChevronLeft size={16} />
      </button>
    </div>
  );
}
