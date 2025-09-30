import { supabase } from "./supabaseClient";

export type ReportPatch = {
  status?: "open" | "assigned" | "resolved";
  priority?: "low" | "normal" | "high" | "critical";
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

export async function updateReport(id: number, patch: ReportPatch) {
  const res = await authorizedFetch(`/api/reports/${id}`, {
    method: "POST",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createDispatch(report_id: number, authority_id: number) {
  const res = await authorizedFetch("/api/dispatch", {
    method: "POST",
    body: JSON.stringify({ report_id, authority_id }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateDispatchStatus(id: number, status: "pending" | "notified" | "acknowledged" | "dismissed") {
  const res = await authorizedFetch(`/api/dispatch/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
export async function deleteReport(id: number) {
  const res = await authorizedFetch(`/api/reports/${id}/delete`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addReportNote(id: number, message: string) {
  const res = await authorizedFetch(`/api/reports/${id}/note`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function suspendUser(userId: number) {
  const res = await authorizedFetch(`/api/users/${userId}/suspend`, { method: "POST", body: JSON.stringify({}) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function activateUser(userId: number) {
  const res = await authorizedFetch(`/api/users/${userId}/activate`, { method: "POST", body: JSON.stringify({}) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// NEW: Users CRUD helpers
export type UserCreate = {
  name: string;
  nationalIdNumber: string;
  role?: "admin" | "user";
  gender?: "female" | "male" | "other";
  phone?: string;
  email?: string;
  notificationRadiusKm?: number;
  favoriteSpotsCount?: number;
};

export type UserUpdate = Partial<UserCreate> & { active?: "yes" | "no"; status?: "verified" | "pending" | "banned" };

export async function createUser(payload: UserCreate) {
  const res = await authorizedFetch(`/api/users`, { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateUser(userId: string | number, payload: UserUpdate) {
  const res = await authorizedFetch(`/api/users/${userId}`, { method: "PATCH", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteUser(userId: string | number) {
  const res = await authorizedFetch(`/api/users/${userId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}