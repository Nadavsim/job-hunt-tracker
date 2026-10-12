import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { ContactsPage } from "./pages/ContactsPage";

const NAV = [
  { to: "/applications", label: "Applications" },
  { to: "/contacts", label: "Contacts" },
];

export function App() {
  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <span className="brand">Job Hunt</span>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/applications" replace />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}
