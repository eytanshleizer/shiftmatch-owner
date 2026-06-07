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
  const [profileRole, setProfileRole] = useState(null);
  const [waiterForwardUrl, setWaiterForwardUrl] = useState(null);

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
    setRestaurant(null); setMembership(null); setInvitation(null); setWizardOpen(false); setProfileRole(null); setWaiterForwardUrl(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    resetState();
  };

  const loadContext = async (uid, email) => {
    setLoading(true);
    resetState();

    // Identity now lives in restaurant_owners (separate from waiter profiles).
    // This is a restaurant account if a restaurant_owners row exists for them.
    const { data: owner } = await supabase
      .from("restaurant_owners")
      .select("id")
      .eq("id", uid)
      .maybeSingle();

    // No owner row → they might be a waiter who landed on the restaurant app as
    // a FALLBACK. Once the waiter app URL is in Supabase's Redirect URLs
    // allowlist, confirmation links go straight to the waiter app and this
    // branch is never hit. But if a link still resolves here, we DON'T silently
    // redirect — we show a clear "email confirmed" screen with a button that
    // carries the live session to the waiter app in the URL hash (the same
    // format Supabase uses) so they arrive already logged-in.
    let waiterProf = null;
    if (!owner) {
      const { data: wp } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .maybeSingle();
      waiterProf = wp;
    }

    if (!owner && waiterProf) {
      const waiterBase = "https://shiftmatch-waiter.vercel.app";
      const { data: sd } = await supabase.auth.getSession();
      const s = sd?.session;
      if (s?.access_token && s?.refresh_token) {
        const hash = new URLSearchParams({
          access_token:  s.access_token,
          refresh_token: s.refresh_token,
          expires_in:    String(s.expires_in ?? 3600),
          token_type:    "bearer",
          type:          "signup",
        }).toString();
        setWaiterForwardUrl(`${waiterBase}/#${hash}`);
      } else {
        setWaiterForwardUrl(waiterBase);
      }
      setProfileRole("waitress");
      setLoading(false);
      return;
    }

    setProfileRole("restaurant");

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

  // Waiter account landed on the restaurant app (fallback — see loadContext).
  // The email is already confirmed at this point, so we celebrate it and send
  // them to the waiter app carrying their live session, where they continue.
  if (profileRole === "waitress") {
    return (
      <div className="h-full bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center px-6 text-center" dir="rtl">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2">האימייל אושר! ✓</h1>
        <p className="text-gray-500 text-sm mb-8 max-w-xs leading-relaxed">
          החשבון שלך מאומת. המשך/המשיכי לאפליקציית ShiftMatch למחפשי עבודה — את/ה כבר מחובר/ת.
        </p>
        <a
          href={waiterForwardUrl || "https://shiftmatch-waiter.vercel.app"}
          className="w-full max-w-xs bg-brand-500 text-white font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg"
        >
          המשך/המשיכי לאפליקציה →
        </a>
        <button
          onClick={signOut}
          className="mt-4 text-gray-500 text-sm font-semibold py-2"
        >
          התנתק/י
        </button>
      </div>
    );
  }

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
