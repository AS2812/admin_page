import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env candidates similar to the server entry so imports pick up envs
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
  try {
    dotenv.config({ path: file, override: false });
  } catch (e) {
    // ignore
  }
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
      // ignore
    }
  }
}
hydrateEnvFallback();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
