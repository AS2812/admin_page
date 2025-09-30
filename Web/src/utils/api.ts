import { supabase } from "./supabaseClient";

export type ReportPatch = {
  status?: "submitted" | "assigned" | "resolved";
  priority?: "low" | "normal";
  ttl_minutes_override?: number | null;
};

const API_BASE = (import.meta.env.VITE_API_BASE || import.meta.env.API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

async function authorizedFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } catch (error) {
      console.warn("resolve session token failed", error);
    }
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

// Existing report helpers (kept for pages using them)
export async function updateReport(id: number, patch: ReportPatch) {
  if (!supabase) throw new Error("Supabase client not configured");
  const updates: Record<string, any> = {};
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.priority !== undefined) updates.priority = patch.priority;
  if (patch.ttl_minutes_override !== undefined) updates.ttl_minutes_override = patch.ttl_minutes_override;
  if (Object.keys(updates).length === 0) return { ok: true };
  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from("reports").update(updates).eq("report_id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function createDispatch(report_id: number, authority_id: number) {
  if (!supabase) throw new Error("Supabase client not configured");
  const { data, error } = await supabase
    .from("report_authority_dispatches")
    .insert([{ report_id, authority_id, status: "pending" }])
    .select("dispatch_id, report_id, authority_id, status")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDispatchStatus(id: number, status: "pending" | "notified" | "acknowledged" | "dismissed") {
  if (!supabase) throw new Error("Supabase client not configured");
  const { data, error } = await supabase
    .from("report_authority_dispatches")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("dispatch_id", id)
    .select("dispatch_id, status")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteReport(id: number) {
  if (!supabase) throw new Error("Supabase client not configured");
  const { error } = await supabase.rpc("admin_delete_report", { p_report_id: id });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function addReportNote(id: number, message: string) {
  if (!supabase) throw new Error("Supabase client not configured");
  const { data, error } = await supabase
    .from("report_feedbacks")
    .insert([{ report_id: id, message }])
    .select("feedback_id, report_id, message, created_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Direct Supabase edit for basic report fields (title, area/location_name, notify_scope)
export async function updateReportFields(
  id: number,
  fields: Partial<{ title: string; location_name: string; notify_scope: "people" | "government" | "both" }>
) {
  if (!supabase) throw new Error("Supabase client not configured");
  const cleaned: Record<string, any> = {};
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined) cleaned[k] = v;
  });
  if (Object.keys(cleaned).length === 0) return { ok: true };
  cleaned.updated_at = new Date().toISOString();
  const { error } = await supabase.from("reports").update(cleaned).eq("report_id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// Users CRUD helpers
export type CreateUserPayload = {
  name: string;
  role: "admin" | "user";
  email?: string;
  nationalIdNumber?: string; // id_number
};

export type UpdateUserPatch = Partial<CreateUserPayload> & {
  account_status?: "verified" | "pending" | "banned";
};

// Server-backed status changes
export async function suspendUser(userId: number) {
  if (!supabase) throw new Error("Supabase client not configured");
  const { error } = await supabase
    .from("users")
    .update({ account_status: "banned", updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function activateUser(userId: number) {
  if (!supabase) throw new Error("Supabase client not configured");
  const { error } = await supabase
    .from("users")
    .update({ account_status: "verified", updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// Direct Supabase CRUD for create/update/delete (admin RLS required)
export async function createUser(payload: CreateUserPayload) {
  if (!supabase) throw new Error("Supabase client not configured");
  const insert = {
    full_name: payload.name,
    role: payload.role,
    email: payload.email || null,
    id_number: payload.nationalIdNumber || null,
    account_status: "pending",
  };
  const { data, error } = await supabase.from("users").insert([insert]).select("user_id, full_name, role, account_status, email").maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateUser(userId: number, patch: UpdateUserPatch) {
  if (!supabase) throw new Error("Supabase client not configured");
  const updates: any = {
    full_name: patch.name,
    role: patch.role,
    email: patch.email,
    id_number: patch.nationalIdNumber,
  };
  if (patch.account_status) updates.account_status = patch.account_status;
  // Remove undefined keys
  Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);
  const { data, error } = await supabase
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("user_id, full_name, role, account_status, email")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteUser(userId: number) {
  if (!supabase) throw new Error("Supabase client not configured");
  const { error } = await supabase.from("users").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}