import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useSupabase } from "./SupabaseProvider";
import { ensureAppUser } from "../utils/authProvision";

export type AuthSession = {
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: { id: string; email?: string } | null;
};

const initialState: AuthSession = {
  loading: true,
  isAuthenticated: false,
  isAdmin: false,
  user: null,
};

const AuthContext = createContext<AuthSession>(initialState);

function mapUser(user: User | null): { id: string; email?: string } | null {
  if (!user) return null;
  return { id: user.id, email: user.email || undefined };
}

async function resolveIsAdmin(client: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await client
      .from("users")
      .select("role")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.role === "admin";
  } catch (error) {
    console.warn("Failed to resolve admin role", error);
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { client } = useSupabase();
  const [state, setState] = useState<AuthSession>(initialState);
  const bypassAuth = (import.meta.env.VITE_BYPASS_AUTH || "") === "1";

  useEffect(() => {
    if (bypassAuth) {
      setState({
        loading: false,
        isAuthenticated: true,
        isAdmin: true,
        user: { id: "e2e", email: "e2e@example.com" },
      });
      return;
    }

    const mounted = { value: true };
    let subscription: any = null;
    let hydrating = false;

    async function hydrate() {
      if (!mounted.value) return;
      if (hydrating) return; // avoid re-entrant hydrations
      hydrating = true;
      try {
        if (!client) {
          setState({ ...initialState, loading: false });
          return;
        }

        const { data } = await client.auth.getSession();
        const sessionUser = mapUser(data.session?.user ?? null);
        if (!mounted.value) return;

        if (!sessionUser) {
          setState({ ...initialState, loading: false });
          return;
        }

        await ensureAppUser(client);
        const admin = await resolveIsAdmin(client, sessionUser.id);
        if (!mounted.value) return;

        setState({ loading: false, isAuthenticated: true, isAdmin: admin, user: sessionUser });
      } catch (error) {
        console.warn("Auth hydrate failed", error);
        if (mounted.value) setState({ ...initialState, loading: false });
      } finally {
        hydrating = false;
      }
    }

    hydrate();

    if (client) {
      const res = client.auth.onAuthStateChange(() => {
        // schedule hydrate to avoid immediate re-entrancy
        setTimeout(() => void hydrate(), 50);
      });
      subscription = res?.data?.subscription ?? res;
    }

    return () => {
      mounted.value = false;
      try { subscription?.unsubscribe?.(); } catch {}
    };
  }, [client, bypassAuth]);

  const value = useMemo(() => state, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
