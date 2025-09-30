import { createContext, useContext, useMemo } from "react";
import { supabase } from "../utils/supabaseClient";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseContextValue = {
  client: SupabaseClient | null;
  ready: boolean;
};

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<SupabaseContextValue>(() => ({ client: supabase, ready: !!supabase }), []);
  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }
  return ctx;
}
