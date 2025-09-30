import type { JSX } from "react";
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TopBar from "./components/TopBar";
import DashboardPage from "./pages/Dashboard";
import IncidentPage from "./pages/Incidents";
import ComplaintsPage from "./pages/Complaints";
import MapPage from "./pages/Map";
import UsersPage from "./pages/Users";
import LoginPage from "./pages/Login";
import { useAuth } from "./hooks/useAuth";
import IntroSplash from "./pages/IntroSplash";
import { useRealtimeDemoBridge } from "./hooks/useRealtime";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const session = useAuth();
  const isAdmin = session.isAuthenticated && session.isAdmin;

  useRealtimeDemoBridge(isAdmin);

  const Loading = () => (
    <div style={{ display: "grid", placeItems: "center", minHeight: "50vh", opacity: 0.8 }}>
      Loading...
    </div>
  );

  const guardAdmin = (element: JSX.Element) => {
    if (session.loading) return <Loading />;
    if (!session.isAuthenticated) return <Navigate to="/login" replace />;
    if (!session.isAdmin) return <Navigate to="/login?unauthorized=1" replace />;
    return element;
  };

  return (
    <BrowserRouter>
      {showSplash && <IntroSplash onDone={() => setShowSplash(false)} />}

      {isAdmin && <TopBar />}
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={guardAdmin(<DashboardPage />)} />
          <Route path="/incidents" element={guardAdmin(<IncidentPage />)} />
          <Route path="/complaints" element={guardAdmin(<ComplaintsPage />)} />
          <Route path="/map" element={guardAdmin(<MapPage />)} />
          <Route path="/users" element={guardAdmin(<UsersPage />)} />
          <Route
            path="/"
            element={session.loading ? <Loading /> : (<Navigate to={isAdmin ? "/dashboard" : "/login"} replace />)}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
