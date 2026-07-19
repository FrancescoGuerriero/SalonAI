import {
  NavLink,
  useNavigate
} from "react-router-dom";

import useAuth from "../hooks/useAuth.js";

function Navbar() {
  const navigate = useNavigate();

  const {
    user,
    isAuthenticated,
    logout
  } = useAuth();

  function getLinkClass({ isActive }) {
    return isActive
      ? "navbar-link navbar-link-active"
      : "navbar-link";
  }

  function handleLogout() {
    logout();

    navigate("/login", {
      replace: true
    });
  }

  return (
    <header className="navbar">
      <div className="navbar-container">
        <NavLink
          to="/"
          className="navbar-brand"
          aria-label="SalonAI homepage"
        >
          <span className="navbar-brand-mark">
            S
          </span>

          <span className="navbar-brand-text">
            SalonAI
          </span>
        </NavLink>

        <nav
          className="navbar-navigation"
          aria-label="Main navigation"
        >
          <NavLink
            to="/"
            end
            className={getLinkClass}
          >
            Home
          </NavLink>

          <NavLink
            to="/services"
            className={getLinkClass}
          >
            Services
          </NavLink>

          <NavLink
            to="/stylists"
            className={getLinkClass}
          >
            Stylists
          </NavLink>

          {isAuthenticated && (
            <>
              <NavLink
                to="/booking"
                className={getLinkClass}
              >
                Book
              </NavLink>

              <NavLink
                to="/dashboard"
                className={getLinkClass}
              >
                Dashboard
              </NavLink>
            </>
          )}
        </nav>

        <div className="navbar-actions">
          {isAuthenticated ? (
            <>
              <div className="navbar-user">
                <span className="navbar-user-avatar">
                  {user?.name
                    ?.trim()
                    ?.charAt(0)
                    ?.toUpperCase() || "U"}
                </span>

                <div className="navbar-user-details">
                  <span className="navbar-user-name">
                    {user?.name || "Customer"}
                  </span>

                  <span className="navbar-user-role">
                    Customer
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="navbar-logout-button"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className="navbar-login-link"
              >
                Login
              </NavLink>

              <NavLink
                to="/register"
                className="navbar-register-link"
              >
                Create Account
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;