import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import SplashScreen   from "./components/SplashScreen";
import AuthScreen     from "./components/AuthScreen";
import ChatOnboarding from "./components/ChatOnboarding";
import Dashboard      from "./components/Dashboard";
import AdminDashboard from "./components/AdminDashboard";

export default function App() {
  // Admin dashboard route — /admin in URL
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return <AdminDashboard />;
  }

  const [splash, setSplash]         = useState(true);
  const [session, setSession]       = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadRestaurant(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadRestaurant(s.user.id);
      else { setRestaurant(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadRestaurant = async (uid) => {
    const { data } = await supabase
      .from("restaurants")
      .select("*")
      .eq("owner_id", uid)
      .maybeSingle();
    setRestaurant(data || null);
    setLoading(false);
  };

  if (splash) return <SplashScreen onDone={() => setSplash(false)} />;
  if (loading) return (
    <div className="h-full flex items-center justify-center bg-[#0F0F0F]">
      <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!session)    return <AuthScreen onAuth={() => {}} />;
  if (!restaurant) return <ChatOnboarding user={session.user} onDone={(r) => setRestaurant(r)} />;
  return <Dashboard restaurant={restaurant} user={session.user} onUpdate={setRestaurant} />;
}
