// src/utils/dataBus.ts

// ---- Types (keep in sync with your pages) ----
export type IncidentRow = {
  id: string;
  title: string;
  area: string;
  severity: "low" | "normal";
  status: "submitted" | "assigned" | "resolved";
  reportedDate: string;
  reporter?: string;
  reporterId?: string;
  category?: string;
  subcategory?: string;
  alerted?: "people" | "government" | "both";
};

export type ComplaintRow = {
  id: string;
  title: string;
  area: string;
  category: "infrastructure" | "road" | "electric" | "sanitation";
  status: "submitted" | "assigned" | "resolved";
  reportedDate: string;
  reporter?: string;
  reporterId?: string;
  alerted?: "people" | "government" | "both";
};

// ---- Storage keys ----
const INC_KEY = "dash:incidents";
const CMP_KEY = "dash:complaints";

// ---- Publishers (call these when rows change) ----
export function sendIncidentsUpdate(rows: IncidentRow[]) {
  try { localStorage.setItem(INC_KEY, JSON.stringify(rows)); } catch {}
  window.dispatchEvent(new CustomEvent<IncidentRow[]>("data:incidents", { detail: rows }));
}

export function sendComplaintsUpdate(rows: ComplaintRow[]) {
  try { localStorage.setItem(CMP_KEY, JSON.stringify(rows)); } catch {}
  window.dispatchEvent(new CustomEvent<ComplaintRow[]>("data:complaints", { detail: rows }));
}

// ---- Readers (for initial load) ----
export function readIncidents(): IncidentRow[] {
  try { return JSON.parse(localStorage.getItem(INC_KEY) || "[]"); } catch { return []; }
}
export function readComplaints(): ComplaintRow[] {
  try { return JSON.parse(localStorage.getItem(CMP_KEY) || "[]"); } catch { return []; }
}
