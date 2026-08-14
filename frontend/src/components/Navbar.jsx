import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ChevronDown,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  ShoppingBag,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  getWhatsAppBookingUrl,
} from "../config/publicLinks.js";
import useAuth from "../hooks/useAuth.js";
import useCart from "../hooks/useCart.js";
import {
  isManagementRole,
} from "../utils/roles.js";

const PUBLIC_LINKS = [
  {
    to: "/",
    label: "Home",
    end: true,
  },
  {
    to: "/services",
    label: "Services",
  },
  {
    to: "/stylists",
    label: "Stylists",
  },
  {
    to: "/about",
    label: "About",
  },
  {
    to: "/shop",
    label: "Shop",
  },
];

function navClass({
  isActive,
}) {
  return `app-nav-link${
    isActive
      ? " app-nav-link-active"
      : ""
  }`;
}

function accountLinkClass({
  isActive,
}) {
  return [
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold no-underline transition",
    isActive
      ? "bg-amber-50 text-amber-800"
      : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
  ].join(" ");
}

export default function Navbar() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    user,
    isAuthenticated,
    logout,
  } = useAuth();

  const {
    itemCount,
  } = useCart();

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const [
    accountOpen,
    setAccountOpen,
  ] = useState(false);

  const accountRef =
    useRef(null);

  const showManagement =
    isManagementRole(
      user?.role
    );

  const whatsappUrl =
    useMemo(
      () =>
        getWhatsAppBookingUrl(),
      []
    );

  useEffect(() => {
    function handleKeyDown(
      event
    ) {
      if (
        event.key !==
        "Escape"
      ) {
        return;
      }

      setMobileOpen(false);
      setAccountOpen(false);
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const previous =
      document.body.style
        .overflow;

    document.body.style
      .overflow = "hidden";

    return () => {
      document.body.style
        .overflow =
        previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!accountOpen) {
      return undefined;
    }

    function handlePointerDown(
      event
    ) {
      if (
        !accountRef.current
          ?.contains(
            event.target
          )
      ) {
        setAccountOpen(
          false
        );
      }
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    return () =>
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );
  }, [accountOpen]);

  function handleLogout() {
    logout();
    setAccountOpen(false);
    setMobileOpen(false);

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  }

  const customerLinks =
    isAuthenticated
      ? [
          {
            to: "/booking",
            label: "Book",
          },
        ]
      : [];

  const mobileLinks = [
    ...PUBLIC_LINKS,
    ...customerLinks,
    ...(isAuthenticated
      ? [
          {
            to: "/orders",
            label: "Orders",
          },
        ]
      : []),
    ...(showManagement
      ? [
          {
            to: "/dashboard",
            label:
              "Management",
          },
        ]
      : []),
  ];

  const initials =
    user?.name
      ?.trim()
      ?.charAt(0)
      ?.toUpperCase() ||
    "S";

  const displayName =
    user?.name ||
    "SalonAI User";

  return (
    <header className="app-topbar">
      <div className="app-topbar-inner">
        <NavLink
          to="/"
          className="app-brand"
          aria-label="SalonAI homepage"
        >
          <span className="app-brand-mark">
            <Sparkles
              size={18}
            />
          </span>

          <span>
            <strong>
              SalonAI
            </strong>
            <small>
              Intelligent salon management
            </small>
          </span>
        </NavLink>

        <nav
          className="app-desktop-nav"
          aria-label="Main navigation"
        >
          {PUBLIC_LINKS.map(
            (link) => (
              <NavLink
                key={link.to}
                {...link}
                className={
                  navClass
                }
              >
                {link.label}
              </NavLink>
            )
          )}

          {customerLinks.map(
            (link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={
                  navClass
                }
              >
                {link.label}
              </NavLink>
            )
          )}

          {showManagement ? (
            <NavLink
              to="/dashboard"
              className={
                navClass
              }
            >
              Management
            </NavLink>
          ) : null}
        </nav>

        <div className="app-topbar-actions">
          {whatsappUrl ? (
            <a
              href={
                whatsappUrl
              }
              className="app-icon-button"
              aria-label="Book on WhatsApp"
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle
                size={19}
              />
            </a>
          ) : null}

          <NavLink
            to="/cart"
            className="app-icon-button"
            aria-label={`Cart with ${itemCount} items`}
          >
            <ShoppingBag
              size={19}
            />

            {itemCount > 0 ? (
              <span className="app-cart-count">
                {itemCount > 99
                  ? "99+"
                  : itemCount}
              </span>
            ) : null}
          </NavLink>

          {isAuthenticated ? (
            <div
              ref={accountRef}
              className="app-user-cluster relative"
            >
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border-0 bg-transparent px-1 py-1 text-left hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                onClick={() =>
                  setAccountOpen(
                    (value) =>
                      !value
                  )
                }
                aria-expanded={
                  accountOpen
                }
                aria-haspopup="menu"
                aria-controls="salonai-account-menu"
              >
                <span className="app-user-avatar">
                  {user?.profilePhoto ? (
                    <img
                      src={user.profilePhoto}
                      alt=""
                    />
                  ) : (
                    initials
                  )}
                </span>

                <span className="app-user-copy">
                  <strong>
                    {displayName}
                  </strong>
                  <small>
                    {user?.role ||
                      "customer"}
                  </small>
                </span>

                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={`hidden shrink-0 transition-transform sm:block${
                    accountOpen
                      ? " rotate-180"
                      : ""
                  }`}
                />
              </button>

              {accountOpen ? (
                <div
                  id="salonai-account-menu"
                  role="menu"
                  aria-label={`${displayName} account menu`}
                  className="absolute right-0 top-[calc(100%+0.65rem)] z-[150] w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="m-0 truncate text-sm font-bold text-slate-950">
                      {displayName}
                    </p>
                    <p className="m-0 mt-1 text-xs capitalize text-slate-500">
                      {user?.role ||
                        "customer"}
                    </p>
                  </div>

                  <div className="grid gap-1 p-2">
                    <NavLink
                      to="/account"
                      role="menuitem"
                      className={
                        accountLinkClass
                      }
                    >
                      <UserRound
                        size={17}
                      />
                      My account
                    </NavLink>


                  </div>

                  <div className="border-t border-slate-100 p-2">
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                      onClick={
                        handleLogout
                      }
                    >
                      <LogOut
                        size={17}
                      />
                      Log out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="app-auth-actions app-desktop-only">
              <NavLink
                to="/login"
                className="app-button app-button-ghost"
              >
                Log in
              </NavLink>

              <NavLink
                to="/register"
                className="app-button app-button-primary"
              >
                Create account
              </NavLink>
            </div>
          )}

          <button
            type="button"
            className="app-icon-button app-mobile-only"
            onClick={() =>
              setMobileOpen(
                true
              )
            }
            aria-label="Open navigation"
            aria-expanded={
              mobileOpen
            }
            aria-controls="salonai-mobile-navigation"
          >
            <Menu size={21} />
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          className="app-mobile-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <button
            type="button"
            className="app-mobile-backdrop"
            onClick={() =>
              setMobileOpen(
                false
              )
            }
            aria-label="Close navigation"
          />

          <aside
            className="app-mobile-panel"
            id="salonai-mobile-navigation"
          >
            <div className="app-mobile-panel-head">
              <span className="app-brand">
                <span className="app-brand-mark">
                  <Sparkles
                    size={18}
                  />
                </span>
                <strong>
                  SalonAI
                </strong>
              </span>

              <button
                type="button"
                className="app-icon-button"
                onClick={() =>
                  setMobileOpen(
                    false
                  )
                }
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="app-mobile-nav">
              {mobileLinks.map(
                (link) => (
                  <NavLink
                    key={
                      link.to
                    }
                    {...link}
                    className={
                      navClass
                    }
                    onClick={() =>
                      setMobileOpen(
                        false
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                )
              )}
            </nav>

            <div className="app-mobile-panel-foot">
              {isAuthenticated ? (
                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="app-user-avatar">
                      {user?.profilePhoto ? (
                        <img
                          src={user.profilePhoto}
                          alt=""
                        />
                      ) : (
                        initials
                      )}
                    </span>
                    <span className="app-user-copy">
                      <strong>
                        {displayName}
                      </strong>
                      <small>
                        {user?.role ||
                          "customer"}
                      </small>
                    </span>
                  </div>

                  <div className="grid gap-1">
                    <NavLink
                      to="/account"
                      className={
                        accountLinkClass
                      }
                      onClick={() =>
                        setMobileOpen(
                          false
                        )
                      }
                    >
                      <UserRound
                        size={17}
                      />
                      My account
                    </NavLink>


                  </div>
                </div>
              ) : null}

              {whatsappUrl ? (
                <a
                  href={
                    whatsappUrl
                  }
                  className="app-button app-button-primary app-full-width"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    setMobileOpen(
                      false
                    )
                  }
                >
                  <MessageCircle
                    size={17}
                  />
                  Book on WhatsApp
                </a>
              ) : null}

              {isAuthenticated ? (
                <button
                  type="button"
                  className="app-button app-button-secondary app-full-width"
                  onClick={
                    handleLogout
                  }
                >
                  <LogOut
                    size={17}
                  />
                  Log out
                </button>
              ) : (
                <>
                  <NavLink
                    to="/login"
                    className="app-button app-button-secondary app-full-width"
                    onClick={() =>
                      setMobileOpen(
                        false
                      )
                    }
                  >
                    Log in
                  </NavLink>

                  <NavLink
                    to="/register"
                    className="app-button app-button-primary app-full-width"
                    onClick={() =>
                      setMobileOpen(
                        false
                      )
                    }
                  >
                    Create account
                  </NavLink>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </header>
  );
}
