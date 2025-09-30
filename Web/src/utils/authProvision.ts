import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureAppUser(client: SupabaseClient | null): Promise<void> {
  if (!client) return;
  const { data: { session } } = await client.auth.getSession();
  const user = session?.user;
  if (!user) return;
  try {
    const { data: existing } = await client
      .from("users")
      .select("user_id, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (existing) return;
    await client.from("users").insert({
      full_name: user.email || "User",
      username: (user.email || user.id).split("@")[0],
      email: user.email || `${user.id}@example.com`,
      role: "user",
      account_status: "pending",
      auth_user_id: user.id,
    });
  } catch (error) {
    console.warn("ensureAppUser failed", error);
  }
}
