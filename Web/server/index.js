import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";
import { supabaseAdmin } from "./supabaseAdmin.js";

const CWD = process.cwd();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [
  path.resolve(CWD, ".env.local"),
  path.resolve(CWD, ".env"),
  path.resolve(HERE, "..", ".env.local"),
  path.resolve(HERE, "..", ".env"),
  path.resolve(HERE, "..", "..", ".env.local"),
  path.resolve(HERE, "..", "..", ".env"),
];

CANDIDATES.forEach((file) => {
  dotenv.config({ path: file, override: false });
});

function hydrateEnvFallback() {
  for (const file of CANDIDATES) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = dotenv.parse(fs.readFileSync(file, "utf8"));
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] == null || process.env[key] === "") {
          process.env[key] = value;
        }
      }
    } catch (error) {
      console.warn("env hydrate failed", error);
    }
  }
}
hydrateEnvFallback();

const PORT = Number(process.env.PORT) || 4000;

// supabaseAdmin (imported above) is constructed in ./supabaseAdmin.js and already
// understands alternate env names like VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL.
// Use its presence to determine if the server has the required config.
if (!supabaseAdmin) {
  console.warn("Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check VITE_/NEXT_PUBLIC_ env names or SUPABASE_SERVICE_ROLE_KEY)");
}

const sentryDsn = process.env.SENTRY_DSN_SERVER || process.env.SENTRY_DSN;
const sentryEnabled = !!sentryDsn;
if (sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}

const app = express();
app.disable("x-powered-by");

if (sentryEnabled) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.use("/api", limiter);

const authCache = new Map();
const AUTH_CACHE_TTL_MS = 60_000;
let auditSupported = supabaseAdmin ? undefined : false;

async function resolveAdminFromToken(token) {
  if (!supabaseAdmin || !token) return null;
  const cached = authCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    const authUserId = data.user.id;
    const { data: appUser, error: appUserError } = await supabaseAdmin
      .from("users")
      .select("user_id, role")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (appUserError) throw appUserError;
    if (!appUser || appUser.role !== "admin") return null;

    const value = {
      authUserId,
      appUserId: appUser.user_id || null,
      email: data.user.email || null,
    };
    authCache.set(token, { value, expires: Date.now() + AUTH_CACHE_TTL_MS });
    return value;
  } catch (error) {
    // Permission errors (e.g., 42501) likely mean the token/user cannot access the app.users table.
    // Treat these as non-fatal and return null quietly to avoid noisy logs during health checks.
    try {
      const msg = String(error?.message || error);
      if (String(error?.code) === "42501" || /permission denied/i.test(msg)) {
        // debug-level noise only
        console.debug("admin token verify permission denied for users table");
        return null;
      }
    } catch (e) {
      // ignore
    }

    console.error("admin token verify failed", error);
    if (sentryEnabled) Sentry.captureException(error);
    return null;
  }
}

async function adminGuard(req, res, next) {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Supabase admin client not configured" });
  }
  if (req.method === "OPTIONS") return next();
  const header = req.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Missing bearer token" });
  const admin = await resolveAdminFromToken(token);
  if (!admin) return res.status(403).json({ error: "Admin privileges required" });
  req.admin = admin;
  return next();
}
app.use("/api", adminGuard);

app.get("/", (_req, res) => {
  res.type("text/plain").send("SpotnSend API OK");
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    supabaseConfigured: !!supabaseAdmin,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasUrl: !!process.env.SUPABASE_URL,
  });
});

function parseIntParam(input) {
  const value = Number.parseInt(String(input), 10);
  if (!Number.isFinite(value)) return null;
  return value;
}

async function recordAudit(req, action, payload) {
  if (!supabaseAdmin || auditSupported === false) return;
  try {
    await supabaseAdmin.from("audit_events").insert([
      {
        action,
        actor_auth_user_id: req.admin?.authUserId || null,
        actor_app_user_id: req.admin?.appUserId || null,
        request_path: req.path,
        payload,
      },
    ]);
    auditSupported = true;
  } catch (error) {
    auditSupported = false;
    console.warn("audit logging disabled", error.message || error);
    if (sentryEnabled) Sentry.captureException(error);
  }
}

app.post("/api/reports/:id", async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid report id" });
  const patch = req.body || {};

  const updates = {};
  if (patch.status) updates.status = patch.status;
  if (patch.priority) updates.priority = patch.priority;
  if (patch.ttl_minutes_override !== undefined) updates.ttl_minutes_override = patch.ttl_minutes_override;
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabaseAdmin
      .from("reports")
      .update(updates)
      .eq("report_id", id)
      .select()
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    await recordAudit(req, "report.update", { report_id: id, updates });
    return res.json({ data });
  } catch (error) {
    console.error("update report failed", error);
    if (sentryEnabled) Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to update report" });
  }
});

app.post("/api/reports/:id/delete", async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid report id" });
  try {
    let removed = false;
    try {
      const { error } = await supabaseAdmin.rpc("admin_delete_report", { p_report_id: id });
      if (!error) {
        removed = true;
      } else {
        console.warn("admin_delete_report failed", error.message || error);
      }
    } catch (error) {
      console.warn("admin_delete_report exception", error);
    }

    if (!removed) {
      try { await supabaseAdmin.from("report_media").delete().eq("report_id", id); } catch {}
      const { error: deleteError } = await supabaseAdmin.from("reports").delete().eq("report_id", id);
      if (deleteError) return res.status(400).json({ error: deleteError.message });
    }

    await recordAudit(req, "report.delete", { report_id: id });
    return res.json({ ok: true });
  } catch (error) {
    console.error("delete report failed", error);
    if (sentryEnabled) Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to delete report" });
  }
});

app.post("/api/reports/:id/note", async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid report id" });
  const message = (req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Message is required" });
  const actorId = req.admin?.appUserId;
  if (!actorId) return res.status(400).json({ error: "Admin profile not found" });
  try {
    const { error } = await supabaseAdmin
      .from("report_feedbacks")
      .insert([{ report_id: id, user_id: actorId, feedback_type: "comment", comment: message }]);
    if (error) return res.status(400).json({ error: error.message });
    await recordAudit(req, "report.note", { report_id: id, comment: message });
    return res.json({ ok: true });
  } catch (error) {
    console.error("add note failed", error);
    if (sentryEnabled) Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to add note" });
  }
});
app.post("/api/alerts", async (req, res) => {
  const body = req.body || {};
  try {
    let liveUntil = body.live_until;
    if (!liveUntil && body.category && body.subtype) {
      const { data: typeRow } = await supabaseAdmin
        .from("alert_types")
        .select("default_ttl_minutes")
        .eq("category", body.category)
        .eq("subtype", body.subtype)
        .maybeSingle();
      if (typeRow?.default_ttl_minutes) {
        liveUntil = new Date(Date.now() + typeRow.default_ttl_minutes * 60 * 1000).toISOString();
      }
    }

    const insertPayload = [{
      title: body.title,
      description: body.description,
      category: body.category,
      subtype: body.subtype,
      status: body.status || "LIVE",
      live_until: liveUntil,
      geom: body.geom || null,
    }];

    const { data, error } = await supabaseAdmin.from("alerts").insert(insertPayload).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    await recordAudit(req, "alert.insert", data);
    return res.json({ data });
  } catch (error) {
    console.error("insert alert failed", error);
    if (sentryEnabled) Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to create alert" });
  }
});

app.post("/api/dispatch", async (req, res) => {
  const payload = req.body || {};
  if (!payload.report_id || !payload.authority_id) {
    return res.status(400).json({ error: "report_id and authority_id required" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("report_authority_dispatches")
      .insert([{ report_id: payload.report_id, authority_id: payload.authority_id, status: "pending" }])
      .select()
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    await recordAudit(req, "dispatch.create", data);
    return res.json({ data });
  } catch (error) {
    console.error("create dispatch failed", error);
    if (sentryEnabled) Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to create dispatch" });
  }
});

app.post("/api/dispatch/:id/status", async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid dispatch id" });
  const status = req.body?.status;
  if (!status) return res.status(400).json({ error: "Status required" });

  try {
    const { data, error } = await supabaseAdmin
      .from("report_authority_dispatches")
      .update({ status })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    await recordAudit(req, "dispatch.update", { id, status });
    return res.json({ data });
  } catch (error) {
    console.error("update dispatch failed", error);
    if (sentryEnabled) Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to update dispatch" });
  }
});

app.post("/api/users/:id/suspend", async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid user id" });
  try {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ account_status: "suspended", updated_at: new Date().toISOString() })
      .eq("user_id", id);
    if (error) return res.status(400).json({ error: error.message });
    await recordAudit(req, "user.suspend", { user_id: id });
    return res.json({ ok: true });
  } catch (error) {
    console.error("suspend user failed", error);
    if (sentryEnabled) Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to suspend user" });
  }
});

app.post("/api/users/:id/activate", async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid user id" });
  try {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ account_status: "active", updated_at: new Date().toISOString() })
      .eq("user_id", id);
    if (error) return res.status(400).json({ error: error.message });
    await recordAudit(req, "user.activate", { user_id: id });
    return res.json({ ok: true });
  } catch (error) {
    console.error("activate user failed", error);
    if (sentryEnabled) Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to activate user" });
  }
});

if (sentryEnabled) {
  app.use(Sentry.Handlers.errorHandler());
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

