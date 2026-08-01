import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menu, ShoppingBag, Sparkles, X } from "lucide-react";
import useAuth from "../hooks/useAuth.js";
import useCart from "../hooks/useCart.js";
import { isManagementRole } from "../utils/roles.js";

const PUBLIC_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/services", label: "Services" },
  { to: "/stylists", label: "Stylists" },
  { to: "/shop", label: "Shop" },
  { to: "/experience", label: "Explore" },
  { to: "/help", label: "Help" },
];

function navClass({ isActive }) {
  return `app-nav-link${isActive ? " app-nav-link-active" : ""}`;
}

export default function Navbar() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount } = useCart();
  const [open, setOpen] = useState(false);
  const showManagement = isManagementRole(user?.role);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  function handleLogout() {
    logout();
    setOpen(false);
    navigate("/login", { replace: true });
  }

  const customerLinks = isAuthenticated ? [
    { to: "/booking", label: "Book" },
    { to: "/account", label: "My account" },
    { to: "/settings", label: "Settings" },
  ] : [];

  const mobileLinks = [
    ...PUBLIC_LINKS,
    ...customerLinks,
    ...(isAuthenticated ? [{ to: "/orders", label: "Orders" }] : []),
    ...(showManagement ? [{ to: "/dashboard", label: "Management" }] : []),
  ];

  const initials = user?.name?.trim()?.charAt(0)?.toUpperCase() || "S";

  return (
    <header className="app-topbar">
      <div className="app-topbar-inner">
        <NavLink to="/" className="app-brand" aria-label="SalonAI homepage">
          <span className="app-brand-mark"><Sparkles size={18} /></span>
          <span><strong>SalonAI</strong><small>Intelligent salon management</small></span>
        </NavLink>

        <nav className="app-desktop-nav" aria-label="Main navigation">
          {PUBLIC_LINKS.map((link) => <NavLink key={link.to} {...link} className={navClass}>{link.label}</NavLink>)}
          {customerLinks.map((link) => <NavLink key={link.to} to={link.to} className={navClass}>{link.label}</NavLink>)}
          {showManagement ? <NavLink to="/dashboard" className={navClass}>Management</NavLink> : null}
        </nav>

        <div className="app-topbar-actions">
          <NavLink to="/cart" className="app-icon-button" aria-label={`Cart with ${itemCount} items`}>
            <ShoppingBag size={19} />
            {itemCount > 0 ? <span className="app-cart-count">{itemCount > 99 ? "99+" : itemCount}</span> : null}
          </NavLink>
          {isAuthenticated ? (
            <div className="app-user-cluster">
              <span className="app-user-avatar">{initials}</span>
              <span className="app-user-copy"><strong>{user?.name || "SalonAI User"}</strong><small>{user?.role || "customer"}</small></span>
              <button type="button" className="app-button app-button-ghost app-desktop-only" onClick={handleLogout}>Log out</button>
            </div>
          ) : (
            <div className="app-auth-actions app-desktop-only">
              <NavLink to="/login" className="app-button app-button-ghost">Log in</NavLink>
              <NavLink to="/register" className="app-button app-button-primary">Create account</NavLink>
            </div>
          )}
          <button type="button" className="app-icon-button app-mobile-only" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
        </div>
      </div>

      {open ? (
        <div className="app-mobile-overlay" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <button className="app-mobile-backdrop" onClick={() => setOpen(false)} aria-label="Close navigation" />
          <aside className="app-mobile-panel">
            <div className="app-mobile-panel-head">
              <span className="app-brand"><span className="app-brand-mark"><Sparkles size={18} /></span><strong>SalonAI</strong></span>
              <button className="app-icon-button" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
            </div>
            <nav className="app-mobile-nav">
              {mobileLinks.map((link) => <NavLink key={link.to} {...link} className={navClass} onClick={() => setOpen(false)}>{link.label}</NavLink>)}
            </nav>
            <div className="app-mobile-panel-foot">
              {isAuthenticated ? <button type="button" className="app-button app-button-secondary app-full-width" onClick={handleLogout}>Log out</button> : <><NavLink to="/login" className="app-button app-button-secondary app-full-width" onClick={() => setOpen(false)}>Log in</NavLink><NavLink to="/register" className="app-button app-button-primary app-full-width" onClick={() => setOpen(false)}>Create account</NavLink></>}
            </div>
          </aside>
        </div>
      ) : null}
    </header>
  );
}
