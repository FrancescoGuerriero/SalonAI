import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";

import aiibpLogo from "../../assets/aiibp-logo.webp";
import { AIIBP_COMMERCIAL_MODULES } from "../../config/aiibpCommercialModules.js";

function navClass({ isActive }) {
  return [
    "rounded-lg px-3 py-2 text-sm font-semibold no-underline transition",
    isActive ? "bg-cyan-400/10 text-cyan-200" : "text-slate-200 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

export default function AiibpPlatformChrome({ children }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const modulesRef = useRef(null);

  useEffect(() => {
    document.body.classList.add("aiibp-platform-active");
    return () => document.body.classList.remove("aiibp-platform-active");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setModulesOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!modulesOpen) return undefined;
    const close = (event) => {
      if (!modulesRef.current?.contains(event.target)) setModulesOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [modulesOpen]);

  return (
    <div className="aiibp-platform-site min-h-screen bg-[#061323] text-slate-100">
      <style>{`body.aiibp-platform-active .app-topbar, body.aiibp-platform-active .app-footer { display: none !important; } body.aiibp-platform-active .app-public-main { padding: 0 !important; margin: 0 !important; max-width: none !important; }`}</style>
      <header className="sticky top-0 z-[120] border-b border-cyan-400/15 bg-[#061323]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/platform" className="flex min-w-0 items-center gap-3 no-underline">
            <img src={aiibpLogo} alt="AIIBP" className="h-11 w-11 shrink-0 object-contain" />
            <span className="min-w-0">
              <strong className="block truncate text-base text-white">AIIBP</strong>
              <small className="block truncate text-[11px] uppercase tracking-[0.14em] text-cyan-300">AI Intelligent Business Platform</small>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="AIIBP platform navigation">
            <NavLink end to="/platform" className={navClass}>Platform</NavLink>
            <div className="relative" ref={modulesRef}>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border-0 bg-transparent px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white"
                aria-haspopup="menu"
                aria-expanded={modulesOpen}
                onClick={() => setModulesOpen((value) => !value)}
              >
                Modules <ChevronDown size={15} className={modulesOpen ? "rotate-180" : ""} />
              </button>
              {modulesOpen ? (
                <div className="absolute left-1/2 top-[calc(100%+0.6rem)] max-h-[70vh] w-[44rem] -translate-x-1/2 overflow-auto rounded-2xl border border-cyan-300/20 bg-[#0a1b2e] p-4 shadow-2xl" role="menu">
                  <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div>
                      <strong className="text-sm text-white">Commercial modules</strong>
                      <p className="mt-1 text-xs text-slate-400">Select modules independently or compose them into a custom tenant platform.</p>
                    </div>
                    <Link to="/platform/modules" className="text-xs font-bold text-cyan-300 no-underline">View all</Link>
                  </div>
                  <div className="grid gap-1 md:grid-cols-2">
                    {AIIBP_COMMERCIAL_MODULES.map((module) => (
                      <Link key={module.key} to={`/platform/modules#${module.key}`} role="menuitem" className="rounded-lg px-3 py-2 text-sm text-slate-200 no-underline hover:bg-white/10 hover:text-white">
                        {module.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <NavLink to="/platform/about" className={navClass}>About & AI</NavLink>
            <NavLink to="/platform/contact" className={navClass}>Contact</NavLink>
            <Link to="/" className="ml-2 rounded-lg border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-200 no-underline hover:bg-cyan-300/10">SalonAI tenant</Link>
          </nav>

          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 lg:hidden" aria-label="Open AIIBP navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[160] bg-[#061323] p-5 lg:hidden" role="dialog" aria-modal="true" aria-label="AIIBP navigation">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><img src={aiibpLogo} alt="" className="h-10 w-10 object-contain" /><strong>AIIBP</strong></div>
            <button type="button" className="rounded-lg border border-white/15 p-2" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20} /></button>
          </div>
          <nav className="mt-8 grid gap-2" aria-label="Mobile AIIBP navigation">
            <NavLink end to="/platform" className={navClass}>Platform</NavLink>
            <NavLink to="/platform/modules" className={navClass}>Modules — all {AIIBP_COMMERCIAL_MODULES.length}</NavLink>
            <div className="max-h-[45vh] overflow-auto rounded-xl border border-white/10 p-2">
              {AIIBP_COMMERCIAL_MODULES.map((module) => <Link key={module.key} to={`/platform/modules#${module.key}`} className="block rounded-lg px-3 py-2 text-sm text-slate-300 no-underline hover:bg-white/10">{module.label}</Link>)}
            </div>
            <NavLink to="/platform/about" className={navClass}>About & AI</NavLink>
            <NavLink to="/platform/contact" className={navClass}>Contact</NavLink>
            <NavLink to="/" className={navClass}>SalonAI tenant</NavLink>
          </nav>
        </div>
      ) : null}

      {children}

      <footer className="border-t border-cyan-300/15 bg-[#04101d]">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
          <div className="flex items-center gap-3"><img src={aiibpLogo} alt="" className="h-10 w-10 object-contain" /><div><strong className="block text-white">AI Intelligent Business Platform</strong><p className="mt-1 text-xs text-slate-400">Modular SaaS · Governed AI · Tenant-isolated delivery</p></div></div>
          <div className="flex flex-wrap items-center gap-4 text-sm"><Link to="/platform/modules" className="text-slate-300 no-underline hover:text-white">Modules</Link><Link to="/platform/about" className="text-slate-300 no-underline hover:text-white">About</Link><Link to="/platform/contact" className="text-slate-300 no-underline hover:text-white">Contact</Link></div>
        </div>
      </footer>
    </div>
  );
}
