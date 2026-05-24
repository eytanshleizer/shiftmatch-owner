import { useEffect, useState } from "react";

export default function SplashScreen({ onDone }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); setTimeout(onDone, 200); return 100; }
        return p + 4;
      });
    }, 60);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center bg-[#0A0A0A] relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute w-96 h-96 bg-brand-500/20 rounded-full blur-3xl -translate-y-20" />
      <div className="absolute w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-20 translate-x-20" />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-2xl shadow-brand-500/40 mb-6"
          style={{ animation: "logoIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}>
          <span className="text-4xl">🍽️</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">ShiftMatch</h1>
        <p className="text-gray-500 text-sm mt-1.5 font-medium">פורטל בעלי מסעדות</p>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-16 w-32 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500 rounded-full transition-all duration-75"
          style={{ width: `${progress}%` }} />
      </div>

      <style>{`
        @keyframes logoIn {
          from { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
