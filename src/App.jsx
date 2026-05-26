import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import SplashScreen          from "./components/SplashScreen";
import AuthScreen            from "./components/AuthScreen";
import VerifyEmailScreen     from "./components/VerifyEmailScreen";
import EmptyState            from "./components/EmptyState";
import WizardOnboarding      from "./components/WizardOnboarding";
import Dashboard             from "./components/Dashboard";
import AdminDashboard        from "./components/AdminDashboard";
import PendingApprovalScreen from "./components/PendingApprovalScreen";
import InvitationScreen      from "./components/InvitationScreen";

/**
 * Top-level routing.
 *
 * Per SEPARATION_SPEC.md the post-signup flow now goes:
 *   AuthScreen → (auth state) → EmptyState → WizardOnboarding → Dashboard
 *
 * Order of branches:
 *   - /admin path                → AdminDashboard
 *   - No session                 → AuthScreen
 *   - Pending invitation         → InvitationScreen
 *   - Membership pending/rej.    → PendingApprovalScreen
 *   - Approved + restaurant      → Dashboard
 *   - Approved, no restaurant    → EmptyState (CTA opens WizardOnboarding overlay)
 *   - Onboarding overlay open    → WizardOnboarding
 */
export default function App() {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return <AdminDashboard />;
  }

  const [splash, setSplash]         = useState(true);
  const [session, setSession]       = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [membership, setMembership] = useState(null);
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading]       = useState(true);

  // Wizard open/closed state — independent from "do I have a restaurant".
  // Persisted in sessionStorage so a page refresh while filling out the
  // wizard doesn't bump the user back to EmptyState.
  const [wizardOpen, setWizardOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("shiftmatch:wizard_open") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (wizardOpen) window.sessionStorage.setItem("shiftmatch:wizard_open", "1");
    else            window.sessionStorage.removeItem("shiftmatch:wizard_open");
  }, [wizardOpen]);

  const resetState = () => {
    setRestaurant(null); setMembership(null); setInvitation(null); setWizardOpen(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    resetState();
  };

  const loadContext = async (uid, email) => {
    setLoading(true);
    resetState();

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

    // Legacy fallback for old accounts created before restaurant_members.
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
    <div className="h-full flex items-center justify-center bg-white">
      <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!session) return <AuthScreen />;

  // If Supabase email confirmation is enabled (recommended) and the user
  // hasn't clicked the link yet, hold them on the verification screen.
  // When the project setting is OFF this branch is never hit because
  // email_confirmed_at is auto-populated at sign-up.
  if (session?.user && !session.user.email_confirmed_at) {
    return (
      <VerifyEmailScreen
        user={session.user}
        onConfirmed={async () => {
          // Re-fetch the session so email_confirmed_at is fresh.
          const { data } = await supabase.auth.refreshSession();
          if (data?.session) setSession(data.session);
          if (data?.user)    loadContext(data.user.id, data.user.email);
        }}
        onSignOut={signOut}
      />
    );
  }

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

  // No restaurant context yet → empty landing OR wizard (if opened from empty).
  if (!restaurant) {
    if (wizardOpen) {
      return (
        <WizardOnboarding
          user={session.user}
          onDone={(r) => { setRestaurant(r); setWizardOpen(false); }}
          onClose={() => setWizardOpen(false)}
        />
      );
    }
    return (
      <EmptyState
        user={session.user}
        onStart={() => setWizardOpen(true)}
        onSignOut={signOut}
      />
    );
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
