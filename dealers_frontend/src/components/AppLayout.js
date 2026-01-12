import React from "react";
import { NavLink } from "react-router-dom";
import "./AppLayout.css";

/**
 * Base app layout: persistent sidebar navigation + topbar + main content area.
 * Uses NavLink to provide active state styling.
 */
// PUBLIC_INTERFACE
export default function AppLayout({ title, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar__brand" aria-label="Dealers Manager">
          <div className="sidebar__logo" aria-hidden="true">
            DM
          </div>
          <div className="sidebar__brandText">
            <div className="sidebar__brandName">Dealers Manager</div>
            <div className="sidebar__brandTag">Local store</div>
          </div>
        </div>

        <nav className="sidebar__nav">
          <NavItem to="/dashboard" label="Finance Dashboard" />
          <NavItem to="/dealers" label="Dealers" />
          <NavItem to="/stock" label="Stock" />
          <NavItem to="/payroll-credits" label="Payroll / Credits" />
          <NavItem to="/payments" label="Payments" />
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__hint">Light theme • v0.1</div>
        </div>
      </aside>

      <div className="content">
        <header className="topbar" role="banner">
          <div className="topbar__left">
            <h1 className="topbar__title">{title}</h1>
          </div>

          <div className="topbar__right">
            <div className="topbar__chip" aria-label="Environment">
              Local
            </div>
          </div>
        </header>

        <main className="main" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
      }
      end
    >
      <span className="sidebar__linkText">{label}</span>
    </NavLink>
  );
}
