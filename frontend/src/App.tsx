import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { ContactsPage } from "./pages/ContactsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GoalsPage } from "./pages/GoalsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodayPage } from "./pages/TodayPage";

const NAV = [
  { to: "/", label: "Today" },
  { to: "/applications", label: "Applications" },
  { to: "/goals", label: "Goals" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/contacts", label: "Contacts" },
  { to: "/settings", label: "Settings" },
];

export function App() {
  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <span className="brand">Job Hunt</span>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/today" element={<Navigate to="/" replace />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}
