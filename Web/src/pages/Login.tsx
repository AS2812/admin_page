import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSupabase } from "../providers/SupabaseProvider";
import { ensureAppUser } from "../utils/authProvision";
import "./Login.css";

export default function LoginPage() {
  const { client } = useSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [search] = useSearchParams();

  async function waitForSession(timeoutMs = 4000): Promise<boolean> {
    if (!client) return false;
    const start = Date.now();
    const current = await client.auth.getSession();
    if (current.data.session) return true;
    return new Promise<boolean>((resolve) => {
      const subscription = client.auth.onAuthStateChange(async (_event, session) => {
        if (session?.access_token) {
          subscription.data.subscription.unsubscribe();
          resolve(true);
        }
      });
      const timer = setInterval(async () => {
        const snapshot = await client.auth.getSession();
        if (snapshot.data.session || Date.now() - start > timeoutMs) {
          clearInterval(timer);
          subscription.data.subscription.unsubscribe();
          resolve(!!snapshot.data.session);
        }
      }, 150);
    });
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    if (!client) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    try {
      const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      if (!data.session || !data.user) {
        setError("Please verify your email to continue.");
        setLoading(false);
        return;
      }

      const hasSession = await waitForSession();
      try {
        await ensureAppUser(client);
      } catch (provisionError) {
        console.warn("ensureAppUser failed", provisionError);
      }

      // Enforce admin-only login: check app user's role before navigating
      if (hasSession && data.user) {
        try {
          const { data: appUser, error: roleErr } = await client
            .from("users")
            .select("role")
            .eq("auth_user_id", data.user.id)
            .maybeSingle();
          if (roleErr) throw roleErr;
          if (appUser?.role !== "admin") {
            setError("You are not authorized to access the admin dashboard.");
            // Sign out immediately to prevent lingering session
            try { await client.auth.signOut(); } catch {}
            setLoading(false);
            return;
          }
        } catch (checkErr: any) {
          setError(checkErr?.message || "Authorization check failed.");
          try { await client.auth.signOut(); } catch {}
          setLoading(false);
          return;
        }
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err?.message || "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "70vh", padding: 16 }}>
      <form onSubmit={handleLogin} className="login-card">
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Admin Login</h2>
        <p style={{ opacity: 0.8, marginTop: 0 }}>Enter your email and password to sign in.</p>

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="you@example.com"
          className="login-input"
        />

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          placeholder="Password"
          className="login-input"
        />

        <button type="submit" className="btn btn--primary login-submit" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? "Signing in..." : "Sign In"}
        </button>

        {error && <div style={{ marginTop: 10, color: "#dc2626" }}>{error}</div>}
        {search.get("unauthorized") && !error && (
          <div style={{ marginTop: 10, color: "#dc2626" }}>You are not authorized to access this page.</div>
        )}
      </form>
    </div>
  );
}
