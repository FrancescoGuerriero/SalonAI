import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth.js";
import { hasPermission } from "../../utils/permissions.js";

const AiCandidateGovernancePage = lazy(() => import("../../pages/AiCandidateGovernancePage.jsx"));
const AiCorePage = lazy(() => import("../../pages/AiCorePage.jsx"));
const AiOfflineExperimentComparisonPage = lazy(() => import("../../pages/AiOfflineExperimentComparisonPage.jsx"));
const AiPromotionProposalPage = lazy(() => import("../../pages/AiPromotionProposalPage.jsx"));
const AiReadinessPage = lazy(() => import("../../pages/AiReadinessPage.jsx"));
const ConnectionsWorkspacePage = lazy(() => import("../../pages/ConnectionsWorkspacePage.jsx"));
const DataHubPage = lazy(() => import("../../pages/DataHubPage.jsx"));
const MarketingHubPage = lazy(() => import("../../pages/MarketingHubPage.jsx"));
const MarketingModulePage = lazy(() => import("../../pages/MarketingModulePage.jsx"));
const MarketingDataConnectionsPage = lazy(() => import("../../pages/MarketingDataConnectionsPage.jsx"));

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

function MarketingAccess({ children, loading, user }) {
  if (loading) return null;
  if (!user) return <Navigate replace to="/login" />;
  return hasPermission(user, "feature-control:read")
    ? <DeferredWorkspace>{children}</DeferredWorkspace>
    : <AccessDenied message="You do not have permission to inspect Marketing connections." />;
}

export default function Stage8WorkspaceRouter({ pathname, children }) {
  const { user, loading } = useAuth();

  if (pathname === "/marketing") {
    return <MarketingAccess loading={loading} user={user}><MarketingModulePage /></MarketingAccess>;
  }

  if (pathname === "/marketing/native-connections") {
    return <MarketingAccess loading={loading} user={user}><MarketingHubPage /></MarketingAccess>;
  }

  if (pathname === "/marketing/data-connections") {
    return <MarketingAccess loading={loading} user={user}><MarketingDataConnectionsPage /></MarketingAccess>;
  }

  if (pathname === "/admin/system/connections") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><ConnectionsWorkspacePage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect business connections." />;
  }

  if (pathname === "/admin/system/data-hub") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><DataHubPage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect the AIIBP Data Hub." />;
  }

  if (pathname === "/admin/system/ai-core") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><AiCorePage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect AI Core governance." />;
  }

  if (pathname === "/admin/system/ai-readiness") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><AiReadinessPage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect AI readiness and planning evidence." />;
  }

  if (pathname === "/admin/system/ai-candidate-governance") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><AiCandidateGovernancePage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect AI candidate governance records." />;
  }

  if (pathname === "/admin/system/ai-offline-experiments") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><AiOfflineExperimentComparisonPage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect offline AI experiment evidence." />;
  }

  if (pathname === "/admin/system/ai-promotion-proposals") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><AiPromotionProposalPage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect AI promotion proposal dossiers." />;
  }

  return children;
}
