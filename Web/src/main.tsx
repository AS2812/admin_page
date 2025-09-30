import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { getTheme } from "./utils/theme";
import { SupabaseProvider } from "./providers/SupabaseProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { initMonitoring } from "./utils/monitoring";
// Initialize MapTiler SDK & Client (and import SDK CSS) early
import "./utils/maptiler";

const theme = getTheme();
document.documentElement.setAttribute("data-theme", theme);

initMonitoring();

window.addEventListener("error", (event) => {
  console.error("Global error:", event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled rejection:", event.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SupabaseProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SupabaseProvider>
  </React.StrictMode>
);
