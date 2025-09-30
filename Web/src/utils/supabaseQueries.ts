import { supabase } from "./supabaseClient";
import type { IncidentRow, ComplaintRow } from "./dataBus";

export type ReportDetail = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  createdAt: string;
  updatedAt?: string | null;
  category?: string;
  subcategory?: string;
  alerted?: string | null;
  locationName?: string | null;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  reporterName?: string | null;
  reporterId?: string | null;
  media: Array<{ id: string; type: string; url: string; thumbnailUrl?: string | null }>;
};

function normalizeCategory(name?: string | null): string | undefined {
  if (!name) return undefined;
  return String(name).trim();
}

// Decide if a report is an "incident" or a "complaint" based on category/subcategory.
// Aligns with the provided taxonomy for Incidents vs Complaints.
function classifyType(categoryKey?: string, subcategoryName?: string): "incident" | "complaint" {
  const key = (categoryKey || "").toLowerCase();
  const sub = (subcategoryName || "").toLowerCase();

  // Incident: acute emergencies requiring police/fire/EMS/civil defense
  const incidentTerms = [
    // Road traffic emergencies
    "road_traffic", "vehicle_collision", "single_vehicle", "pedestrian_struck", "motorcycle", "pileup",
    // Life‑threatening roadway hazards
    "sinkhole", "oil_spill", "signal_outage",
    // Fire / explosion
    "fire_explosion", "building_fire", "vehicle_fire", "electrical_fire", "gas_leak", "cylinder_blast",
    // Building / infrastructure emergencies
    "building_infra", "collapse", "partial_collapse", "falling_facade", "elevator_failure", "scaffold_collapse",
    // Rail / public transport
    "rail_public_transport", "train_collision", "derailment", "metro_incident", "bus_crash",
    // Utilities (dangerous failures)
    "gas_emergency", "major_power_outage",
    // Environment / weather acute hazards
    "flash_flood", "heavy_rain", "coastal_surge", "rockslide", "sandstorm", "khamaseen",
    // Medical emergencies
    "medical_emergency", "cardiac", "respiratory", "injury_no_collision", "mci",
    // Occupational / industrial
    "occupational_industrial", "factory_accident", "chemical_spill", "construction_injury",
    // Public safety / crime
    "public_safety_crime", "violence_nearby", "robbery_in_progress", "suspicious_package",
    // Marine / waterway
    "marine_waterway", "boat_incident", "drowning_risk", "port_hazard",
  ];

  // Complaints: service issues handled by municipalities/utilities (non‑emergency)
  const complaintTerms = [
    // Roadway hazard (service)
    "roadway_hazard", "pothole", "debris", "streetlight_outage", "streetlight", "lamp_out",
    // Utilities (local service)
    "power_outage", "water_cut", "telecom_outage", "internet_outage",
    // Maintenance buckets
    "sanitation", "garbage", "waste", "sewage", "trash", "cleaning",
  ];

  const anyMatch = (source: string, terms: string[]) => terms.some((t) => source.includes(t));

  // Direct category matches
  if (anyMatch(key, incidentTerms)) return "incident";
  if (anyMatch(key, complaintTerms)) return "complaint";

  // Subcategory fallbacks
  if (anyMatch(sub, incidentTerms)) return "incident";
  if (anyMatch(sub, complaintTerms)) return "complaint";

  // Nuanced power outage handling: major vs local (fallback by wording)
  if (/major\s+power\s+outage|hospital/.test(sub)) return "incident";
  if (/power\s+outage/.test(sub)) return "complaint";

  // Default: treat unknowns as incident so acute cases aren't missed
  return "incident";
}

function mapPriority(priority: string | null): IncidentRow["severity"] {
  switch ((priority || "low").toLowerCase()) {
    case "normal":
    case "medium":
    case "high":
    case "critical":
      return "normal" as IncidentRow["severity"];
    default:
      return "low" as IncidentRow["severity"];
  }
}

function mapStatus(status: string | null): IncidentRow["status"] {
  switch ((status || "submitted").toLowerCase()) {
    case "resolved":
      return "resolved";
    case "assigned":
    case "reviewing":
    case "published":
      return "assigned";
    case "open":
      return "submitted" as IncidentRow["status"];
    default:
      return "submitted" as IncidentRow["status"];
  }
}

export async function fetchReports(): Promise<IncidentRow[]> {
  if (!supabase) return [];
  // Preload category and subcategory maps to avoid view dependencies
  const [catsRes, subsRes] = await Promise.all([
    supabase.from("report_categories").select("category_id, name, slug"),
    supabase.from("report_subcategories").select("subcategory_id, name"),
  ]);
  if (catsRes.error) console.warn("fetchReports categories", catsRes.error);
  if (subsRes.error) console.warn("fetchReports subcategories", subsRes.error);
  const catMap = new Map<number, { name: string; slug?: string | null }>();
  (catsRes.data as any[] | null)?.forEach((c) => catMap.set(c.category_id, { name: c.name, slug: c.slug }));
  const subMap = new Map<number, string>();
  (subsRes.data as any[] | null)?.forEach((s) => subMap.set(s.subcategory_id, s.name));

  const { data, error } = await supabase
    .from("reports")
    .select(
      "report_id, title, status, priority, created_at, location_name, city, notify_scope, user_id, category_id, subcategory_id"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.warn("fetchReports", error);
    return [];
  }

  // Preload reporter identities (id_number, full_name) for visible rows
  const userIds = Array.from(new Set(((data as any[] | null) ?? []).map((r) => r.user_id).filter(Boolean)));
  let userMap = new Map<number, { full_name?: string | null; id_number?: string | null }>();
  if (userIds.length) {
    const { data: usersData, error: usersErr } = await supabase
      .from("users")
      .select("user_id, full_name, id_number")
      .in("user_id", userIds);
    if (usersErr) console.warn("fetchReports users", usersErr);
    (usersData as any[] | null)?.forEach((u) => userMap.set(u.user_id, { full_name: u.full_name, id_number: u.id_number }));
  }

  return ((data as any[] | null) ?? [])
    .filter((row) => {
      const catMeta = catMap.get(row.category_id);
      const subName = row.subcategory_id ? subMap.get(row.subcategory_id) : undefined;
      const type = classifyType(catMeta?.slug || catMeta?.name || undefined, subName);
      return type === "incident";
    })
    .map((row) => ({
      id: `R#${row.report_id}`,
      title: row.title || `Report #${row.report_id}`,
      area: row.location_name || row.city || "",
      severity: mapPriority(row.priority || null),
      status: mapStatus(row.status || null),
      reportedDate: row.created_at,
      reporter: userMap.get(row.user_id)?.full_name || undefined,
      reporterId: userMap.get(row.user_id)?.id_number || undefined,
      category: normalizeCategory(catMap.get(row.category_id)?.name),
      subcategory: normalizeCategory(row.subcategory_id ? subMap.get(row.subcategory_id) : undefined),
      alerted: row.notify_scope || undefined,
    }));
}

export async function fetchReportDetail(reportId: number): Promise<ReportDetail | null> {
  if (!supabase) return null;
  const [detailRes, mediaRes] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "report_id, title, description, status, priority, created_at, updated_at, notify_scope, location_name, address, city, latitude, longitude, user_id, category_id, subcategory_id"
      )
      .eq("report_id", reportId)
      .maybeSingle(),
    supabase
      .from("report_media")
      .select("media_id, media_type, storage_url, thumbnail_url")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true }),
  ]);

  if (detailRes.error) {
    console.warn("fetchReportDetail detail", detailRes.error);
    return null;
  }

  const detail = detailRes.data as any;
  if (!detail) return null;

  // Resolve reporter info
  let reporterName: string | null = null;
  let reporterId: string | null = null;
  if (detail.user_id) {
    const { data: userRow } = await supabase
      .from("users")
      .select("full_name, id_number")
      .eq("user_id", detail.user_id)
      .maybeSingle();
    reporterName = userRow?.full_name ?? null;
    reporterId = userRow?.id_number ?? null;
  }

  // Resolve category names
  let categoryName: string | undefined = undefined;
  let subcategoryName: string | undefined = undefined;
  if (detail.category_id) {
    const { data: c } = await supabase.from("report_categories").select("name").eq("category_id", detail.category_id).maybeSingle();
    categoryName = normalizeCategory(c?.name);
  }
  if (detail.subcategory_id) {
    const { data: s } = await supabase.from("report_subcategories").select("name").eq("subcategory_id", detail.subcategory_id).maybeSingle();
    subcategoryName = normalizeCategory(s?.name);
  }

  const media = (mediaRes.data as any[] | null)?.map((item) => ({
    id: item.media_id,
    type: item.media_type,
    url: item.storage_url,
    thumbnailUrl: item.thumbnail_url,
  })) ?? [];

  return {
    id: detail.report_id,
    title: detail.title || `Report #${detail.report_id}`,
    description: detail.description,
    status: detail.status,
    priority: detail.priority,
    createdAt: detail.created_at,
    updatedAt: detail.updated_at,
    category: categoryName,
    subcategory: subcategoryName,
    alerted: detail.notify_scope,
    locationName: detail.location_name,
    address: detail.address,
    city: detail.city,
    latitude: detail.latitude,
    longitude: detail.longitude,
    reporterName,
    reporterId: reporterId || undefined,
    media,
  };
}

export async function fetchComplaints(): Promise<ComplaintRow[]> {
  if (!supabase) return [];
  // Load category/subcategory maps
  const [catsRes, subsRes] = await Promise.all([
    supabase.from("report_categories").select("category_id, name, slug"),
    supabase.from("report_subcategories").select("subcategory_id, name"),
  ]);
  const catMap = new Map<number, { name: string; slug?: string | null }>();
  (catsRes.data as any[] | null)?.forEach((c) => catMap.set(c.category_id, { name: c.name, slug: c.slug }));
  const subMap = new Map<number, string>();
  (subsRes.data as any[] | null)?.forEach((s) => subMap.set(s.subcategory_id, s.name));

  const { data, error } = await supabase
    .from("reports")
    .select(
      "report_id, title, status, priority, created_at, location_name, city, notify_scope, user_id, category_id, subcategory_id"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.warn("fetchComplaints", error);
    return [];
  }

  // Preload reporter identities
  const userIds = Array.from(new Set(((data as any[] | null) ?? []).map((r) => r.user_id).filter(Boolean)));
  let userMap = new Map<number, { full_name?: string | null; id_number?: string | null }>();
  if (userIds.length) {
    const { data: usersData, error: usersErr } = await supabase
      .from("users")
      .select("user_id, full_name, id_number")
      .in("user_id", userIds);
    if (usersErr) console.warn("fetchComplaints users", usersErr);
    (usersData as any[] | null)?.forEach((u) => userMap.set(u.user_id, { full_name: u.full_name, id_number: u.id_number }));
  }

  function complaintBucket(catSource?: string, subSource?: string): ComplaintRow["category"] {
    const s = (catSource || "").toLowerCase();
    const sub = (subSource || "").toLowerCase();
    // Roadway service issues
    if (/(road|street|traffic|roadway_hazard|pothole|debris|hazard)/.test(s) || /(pothole|debris|hazard)/.test(sub)) return "road";
    // Utilities service issues (bucketed under electric for UI colors)
    if (/(electric|power|grid|light|lamp|streetlight|utilities?|water|telecom)/.test(s) || /(power_outage|streetlight|lamp|water_cut|telecom_outage|internet)/.test(sub)) return "electric";
    // Sanitation
    if (/(sanit|garbage|waste|sewage|trash|clean)/.test(s) || /(garbage|waste|trash|sewage)/.test(sub)) return "sanitation";
    // Default to infrastructure
    return "infrastructure";
  }

  return ((data as any[] | null) ?? [])
    .filter((row) => {
      const catMeta = catMap.get(row.category_id);
      const subName = row.subcategory_id ? subMap.get(row.subcategory_id) : undefined;
      const type = classifyType(catMeta?.slug || catMeta?.name || undefined, subName);
      return type === "complaint";
    })
    .map((row) => ({
      id: `C#${row.report_id}`,
      title: row.title || `Report #${row.report_id}`,
      area: row.location_name || row.city || "",
      category: complaintBucket(catMap.get(row.category_id)?.name, row.subcategory_id ? subMap.get(row.subcategory_id) : undefined),
      status: mapStatus(row.status || null),
      reportedDate: row.created_at,
      reporter: userMap.get(row.user_id)?.full_name || undefined,
      reporterId: userMap.get(row.user_id)?.id_number || undefined,
      alerted: row.notify_scope || undefined,
    }));
}

export async function fetchReportLocations(): Promise<Array<{ id: number; lon: number; lat: number; title: string; status: string; category?: string; type?: "incident" | "complaint" }>> {
  if (!supabase) return [];
  const [catsRes, reportsRes] = await Promise.all([
    supabase.from("report_categories").select("category_id, name"),
    supabase
      .from("reports")
      .select("report_id, title, status, location_geog, category_id, created_at")
      .not("location_geog", "is", null)
      .order("created_at", { ascending: false })
      .limit(250),
  ]);
  if (reportsRes.error) {
    console.warn("fetchReportLocations", reportsRes.error);
    return [];
  }
  const catMap = new Map<number, string>();
  (catsRes.data as any[] | null)?.forEach((c) => catMap.set(c.category_id, c.name));
  return (reportsRes.data as any[] | null)?.map((row) => {
    const geo = row.location_geog as { type: string; coordinates: [number, number] } | null;
    const [lon, lat] = geo?.coordinates || [0, 0];
    const catName = normalizeCategory(catMap.get(row.category_id));
    const type = classifyType(catName, undefined);
    return {
      id: row.report_id,
      lon,
      lat,
      title: row.title || "Report",
      status: row.status || "open",
      category: catName,
      type,
    };
  }) ?? [];
}

export async function fetchUsersBrief(): Promise<Array<{ id: string; name: string; role: "admin" | "user"; status: "verified" | "pending" | "banned"; active: "yes" | "no"; email?: string }>> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("users")
    .select("user_id, full_name, role, account_status, email")
    .order("user_id", { ascending: true })
    .limit(200);
  if (error) {
    console.warn("fetchUsersBrief", error);
    return [];
  }
  return (data as any[] | null)?.map((row) => {
    const status = (row.account_status || "pending").toLowerCase();
    return {
      id: String(row.user_id),
      name: row.full_name || "Unknown",
      role: row.role === "admin" ? "admin" : "user",
      status: status === "active" ? "verified" : status === "suspended" ? "banned" : "pending",
      active: status === "active" ? "yes" : "no",
      email: row.email || undefined,
    };
  }) ?? [];
}
