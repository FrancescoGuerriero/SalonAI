import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth.js";
import { hasPermission } from "../../utils/permissions.js";
import Stage8WorkspaceRouter from "../stage8/Stage8WorkspaceRouter.jsx";

const ConnectedAccountsPage = lazy(() => import("../../pages/ConnectedAccountsPage.jsx"));
const MeasurementIntegrationCorePage = lazy(() => import("../../pages/MeasurementIntegrationCorePage.jsx"));

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

export default function Stage5WorkspaceRouter({ pathname, children }) {
  const { user, loading } = useAuth();

  if (pathname === "/admin/system/measurement-core") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><MeasurementIntegrationCorePage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect the Stage 5 measurement and integration core." />;
  }

  if (pathname === "/admin/system/connected-accounts") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "feature-control:read")
      ? <DeferredWorkspace><ConnectedAccountsPage /></DeferredWorkspace>
      : <AccessDenied message="You do not have permission to inspect connected business accounts." />;
  }

  return (
    <Stage8WorkspaceRouter pathname={pathname}>
      {children}
    </Stage8WorkspaceRouter>
  );
}
