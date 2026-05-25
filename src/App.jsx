import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import SplashScreen          from "./components/SplashScreen";
import AuthScreen            from "./components/AuthScreen";
import ChatOnboarding        from "./components/ChatOnboarding";
import Dashboard             from "./components/Dashboard";
import AdminDashboard        from "./components/AdminDashboard";
import PendingApprovalScreen from "./components/PendingApprovalScreen";
import InvitationScreen      from "./components/InvitationScreen";

/**
 * Top-level routing.  Decides which screen to show based on auth + membership state:
 *  - No session              → AuthScreen
 *  - Pending invitation      → InvitationScreen (accept/decline)
 *  - Membership pending/rej. → PendingApprovalScreen
 *  - Approved membership     → Dashboard
 *  - No membership at all    → ChatOnboarding (new restaurant)
 */
export default function App() {
  // Admin dashboard route — /admin in URL
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return <AdminDashboard />;
  }

  const [splash, setSplash]         = useState(true);
  const [session, setSession]       = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [membership, setMembership] = useState(null);   // user's restaurant_members row
  const [invitation, setInvitation] = useState(null);   // pending invitation by email
  const [loading, setLoading]       = useState(true);

  const resetState = () => {
    setRestaurant(null); setMembership(null); setInvitation(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    resetState();
  };

  // Load the user's restaurant context.
  // Order of precedence:
  //   1) Approved member  → load that restaurant (latest first)
  //   2) Pending/Rejected → show pending screen
  //   3) Open invitation  → show invitation screen
  //   4) Nothing          → onboarding (will create restaurant + auto-member via trigger)
  const loadContext = async (uid, email) => {
    setLoading(true);
    resetState();

    // 1+2: Memberships
    const { data: memberships } = await supabase
      .from("restaurant_members")
      .select("*, restaurant:restaurants(*)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    const approved = memberships?.find((m) => m.status === "approved");
    if (approved) {
      setMembership(approved);
      setRestaurant(approved.restaurant);
      setLoading(false);
      return;
    }

    const pendingOrRejected = memberships?.[0];
    if (pendingOrRejected) {
      setMembership(pendingOrRejected);
      setRestaurant(pendingOrRejected.restaurant);
      setLoading(false);
      return;
    }

    // 3: Open invitations by email
    if (email) {
      const { data: invites } = await supabase
        .from("restaurant_invitations")
        .select("*, restaurant:restaurants(*)")
        .ilike("email", email)
        .is("accepted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      const inv = invites?.[0];
      if (inv) {
        setInvitation(inv);
        setLoading(false);
        return;
      }
    }

    // 4: No state → fresh onboarding (legacy fallback: check old owner_id linkage too)
    const { data: legacy } = await supabase
      .from("restaurants")
      .select("*")
      .eq("owner_id", uid)
      .maybeSingle();
    if (legacy) setRestaurant(legacy);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadContext(session.user.id, session.user.email);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadContext(s.user.id, s.user.email);
      else { resetState(); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (splash) return <SplashScreen onDone={() => setSplash(false)} />;
  if (loading) return (
    <div className="h-full flex items-center justify-center bg-[#0F0F0F]">
      <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!session) return <AuthScreen onAuth={() => {}} />;

  // Pending invitation → accept/decline screen
  if (invitation) {
    return (
      <InvitationScreen
        user={session.user}
        invitation={invitation}
        onAccepted={() => loadContext(session.user.id, session.user.email)}
        onSignOut={signOut}
      />
    );
  }

  // Member exists but not approved (pending or rejected)
  if (membership && membership.status !== "approved") {
    return (
      <PendingApprovalScreen
        user={session.user}
        membership={membership}
        restaurant={restaurant}
        onApproved={() => loadContext(session.user.id, session.user.email)}
        onSignOut={signOut}
      />
    );
  }

  // No restaurant context at all → onboarding (new owner)
  if (!restaurant) {
    return <ChatOnboarding user={session.user} onDone={(r) => setRestaurant(r)} />;
  }

  return (
    <Dashboard
      restaurant={restaurant}
      user={session.user}
      role={membership?.role || "owner"}
      onUpdate={setRestaurant}
    />
  );
}
