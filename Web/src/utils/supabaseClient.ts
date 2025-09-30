import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined;
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string | undefined;

let client: SupabaseClient | null = null;
if (url && anon) {
  client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: { params: { eventsPerSecond: 5 } },
  });
} else if (typeof window !== "undefined") {
  console.warn("Supabase env not set (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Running in demo mode.");
}

export const supabase = client;
export type { SupabaseClient } from "@supabase/supabase-js";
