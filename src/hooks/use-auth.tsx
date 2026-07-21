/**
 * Centralised authentication for CafeOS.
 *
 * Single source of truth for the signed-in user. Wraps the Supabase session
 * with a fetched Profile + Business + Role, and exposes actions for signing
 * in/up/out and refreshing.
 *
 * Rules of the road:
 *   - No localStorage reads for auth state. The Supabase client persists the
 *     session; everything else is derived from the DB.
 *   - Never call `supabase.*` inside the `onAuthStateChange` callback body —
 *     that can deadlock the auth client. We defer with `setTimeout(0)`.
 *   - `AuthProvider` must wrap the whole app (see `src/routes/__root.tsx`).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Role = Database["public"]["Enums"]["app_role"];

export type Profile = {
  id: string;
  name: string;
  email: string;
  business_id: string | null;
  active: boolean;
};

export type Business = {
  id: string;
  name: string;
  currency: string;
  tax_percent: number;
  logo: string | null;
  parcel_fee: number;
};

export type SignUpOwnerInput = {
  businessName: string;
  name: string;
  email: string;
  password: string;
};

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  business: Business | null;
  role: Role | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUpOwner: (input: SignUpOwnerInput) => Promise<void>;
  activateBusiness: (businessName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Maps a role to that user's landing route. */
export function roleHome(role: Role | null): string {
  switch (role) {
    case "owner":
      return "/owner/dashboard";
    case "manager":
      return "/manager/dashboard";
    case "chef":
      return "/chef/dashboard";
    case "staff":
      return "/staff";
    default:
      return "/login";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  /** Fetch profile + role + business for the signed-in user. */
  const fetchContext = useCallback(async (userId: string) => {
    const [profileRes, roleRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,name,email,business_id,active")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role,business_id")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (roleRes.error) throw roleRes.error;

    const prof = profileRes.data;
    if (prof && !prof.active) {
      await supabase.auth.signOut();
      if (!mountedRef.current) return;
      setProfile(null);
      setBusiness(null);
      setRole(null);
      throw new Error("Your account has been deactivated.");
    }

    if (!mountedRef.current) return;
    setProfile(prof ?? null);
    setRole((roleRes.data?.role as Role | undefined) ?? null);

    if (prof?.business_id) {
      const { data: biz, error: bizErr } = await supabase
        .from("businesses")
        .select("id,name,currency,tax_percent,logo,parcel_fee")
        .eq("id", prof.business_id)
        .maybeSingle();
      if (bizErr) throw bizErr;
      if (!mountedRef.current) return;
      setBusiness(biz ?? null);
    } else {
      setBusiness(null);
    }
  }, []);

  const loadFor = useCallback(
    (userId: string) => {
      fetchContext(userId)
        .catch((err) => {
          console.error("[auth] failed to load context", err);
        })
        .finally(() => {
          if (mountedRef.current) setLoading(false);
        });
    },
    [fetchContext],
  );

  useEffect(() => {
    mountedRef.current = true;

    // Subscribe first so we don't miss an event fired during initial getSession.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mountedRef.current) return;
      setSession(next);
      if (next?.user) {
        // Defer supabase queries out of the callback to avoid deadlock.
        setTimeout(() => {
          if (!mountedRef.current) return;
          loadFor(next.user.id);
        }, 0);
      } else {
        setProfile(null);
        setBusiness(null);
        setRole(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mountedRef.current) return;
      setSession(data.session);
      if (data.session?.user) {
        loadFor(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
    };
  }, [loadFor]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }, []);

  const activateBusiness = useCallback(
    async (businessName: string) => {
      const name = businessName.trim();
      if (!name) throw new Error("Business name is required");
      const { error } = await supabase.rpc("create_business_and_owner", { _name: name });
      if (error) throw error;
      // Ensure UI sees the new business/role before redirecting.
      const { data } = await supabase.auth.getUser();
      if (data.user) await fetchContext(data.user.id);
    },
    [fetchContext],
  );

  const signUpOwner = useCallback(
    async (input: SignUpOwnerInput) => {
      const email = input.email.trim();
      const name = input.name.trim();
      const businessName = input.businessName.trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
          data: { name, pending_business_name: businessName },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation required — we can't call the RPC without a session.
        throw new Error(
          "Check your email to confirm your account, then sign in to activate your business.",
        );
      }
      try {
        await activateBusiness(businessName);
      } catch (rpcErr) {
        // Roll back: sign out the half-created account so they can retry cleanly.
        await supabase.auth.signOut();
        throw rpcErr;
      }
    },
    [activateBusiness],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refresh = useCallback(async () => {
    if (session?.user) await fetchContext(session.user.id);
  }, [session, fetchContext]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      business,
      role,
      loading,
      isAuthenticated: !!session,
      signIn,
      signUpOwner,
      activateBusiness,
      signOut,
      refresh,
    }),
    [session, profile, business, role, loading, signIn, signUpOwner, activateBusiness, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/**
 * Back-compat shape for pre-existing components that expect the old
 * `{ id, name, email, role, active }` object from the Zustand store.
 * New code should read from `useAuth()` directly.
 */
export function useCurrentUser() {
  const { profile, role } = useAuth();
  if (!profile) return null;
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: (role ?? "staff") as Role,
    active: profile.active,
  };
}
