import { NavLink, useNavigate } from "react-router-dom";

import useAuth from "../hooks/useAuth.js";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function getNavLinkClass({ isActive }) {
    return isActive
      ? "navbar__link navbar__link--active"
      : "navbar__link";
  }

  const displayName =
    user?.name ||
    user?.fullName ||
    user?.email ||
    "My account";

  return (
    <header className="navbar">
      <div className="navbar__container">
        <NavLink to="/" className="navbar__brand">
          SalonAI
        </NavLink>

        <nav className="navbar__navigation" aria-label="Main navigation">
          <NavLink to="/" end className={getNavLinkClass}>
            Home
          </NavLink>

          <NavLink to="/services" className={getNavLinkClass}>
            Services
          </NavLink>

          {isAuthenticated ? (
            <>
              <NavLink to="/dashboard" className={getNavLinkClass}>
                Dashboard
              </NavLink>

              <span className="navbar__user" title={displayName}>
                {displayName}
              </span>

              <button
                type="button"
                className="navbar__logout"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={getNavLinkClass}>
                Login
              </NavLink>

              <NavLink
                to="/register"
                className="navbar__register"
              >
                Register
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;