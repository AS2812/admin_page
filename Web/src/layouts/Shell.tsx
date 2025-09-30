import TopBar from "../components/TopBar";
import { Outlet } from "react-router-dom";
import "../app.css"; // keeps your .page width rules

export default function Shell() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
