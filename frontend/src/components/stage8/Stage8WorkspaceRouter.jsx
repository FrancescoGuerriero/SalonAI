import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth.js";
import { hasPermission } from "../../utils/permissions.js";

const AiReadinessPage = lazy(() => import("../../pages/AiReadinessPage.jsx"));
const DataHubPage = lazy(() => import("../../pages/DataHubPage.jsx"));
const MarketingHubPage = lazy(() => import("../../pages/MarketingHubPage.jsx"));

function AccessDenied({ message }) {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-4xl rounded-2xl border border-amber-500 bg-amber-50 p-5 text-black" role="alert">
        {message}
      </div>
    </main>
  );
}

function DeferredWorkspace({ children }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

export default function Stage8WorkspaceRouter({ pathname, children }) {
  const { user, loading } = useAuth();

  if (pathname === "/marketing") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><MarketingHubPage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect Marketing connections." />;
  }

  if (pathname === "/admin/system/data-hub") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><DataHubPage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect the AIIBP Data Hub." />;
  }

  if (pathname === "/admin/system/ai-readiness") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><AiReadinessPage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect AI readiness and planning evidence." />;
  }

  return children;
}
