// src/components/TopBar.tsx
import "./topbar.css";
import { useNavigate, NavLink } from "react-router-dom";
import { useState } from "react";
import { t, getLang, setLang } from "../i18n";
import { getTheme, toggleTheme } from "../utils/theme";
import { useSupabase } from "../providers/SupabaseProvider";
import { useAuth } from "../providers/AuthProvider";

export default function TopBar() {
  const navigate = useNavigate();
  const { client } = useSupabase();
  const session = useAuth();
  const isAdmin = session.isAdmin;
  const [lang, setLangState] = useState(getLang());
  const [theme, setThemeState] = useState(getTheme());

  const pill = (to: string, label: string, exact = false) => (
    <NavLink to={to} end={exact} className={({ isActive }) => `pill${isActive ? " pill--active" : ""}`}>
      {label}
    </NavLink>
  );

  return (
    <div className="topbar">
      <div className="topbar-row">
        <div className="topbar-brand">
          <span
            id="brand-text"
            lang="en"
            dir="ltr"
            translate="no"
            style={{
              fontFamily: '"Montserrat","Segoe UI",system-ui,-apple-system,Arial,sans-serif',
              fontWeight: 800,
              letterSpacing: "0.2px",
              fontSynthesis: "none",
            }}
          >
            {t("brand")}
          </span>
        </div>

        {isAdmin && (
          <nav className="topbar-tabs" aria-label="Primary">
            {pill("/dashboard", t("nav.dashboard"), true)}
            {pill("/incidents", t("nav.incident"))}
            {pill("/complaints", t("nav.complaints"))}
            {pill("/map", t("nav.map"))}
            {pill("/users", t("nav.users"))}
          </nav>
        )}

        <div className="topbar-actions">
          <button
            className="smallbtn"
            type="button"
            onClick={() => {
              const next = lang === "en" ? "ar" : "en";
              setLang(next);
              setLangState(next);
            }}
            aria-label="Toggle language"
          >
            {lang === "en" ? "AR" : "EN"}
          </button>

          <button
            className="smallbtn"
            type="button"
            onClick={() => {
              toggleTheme();
              setThemeState(getTheme());
            }}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>

          {isAdmin ? (
            <button
              className="smallbtn"
              type="button"
              onClick={async () => {
                if (!client) return;
                try {
                  await client.auth.signOut();
                } catch (error) {
                  console.warn("signOut failed", error);
                }
                navigate("/login");
              }}
              aria-label="Logout"
            >
              Logout
            </button>
          ) : (
            <span className="topbar-note">{"Limited access"}</span>
          )}
        </div>
      </div>

      <div className="topbar-strip" />
    </div>
  );
}
