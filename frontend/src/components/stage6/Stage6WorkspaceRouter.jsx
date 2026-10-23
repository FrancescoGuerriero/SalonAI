import { Navigate } from "react-router-dom";

import GrowthLeadConversionPage from "../../pages/GrowthLeadConversionPage.jsx";
import useAuth from "../../hooks/useAuth.js";
import { hasPermission } from "../../utils/permissions.js";

function AccessDenied() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-4xl rounded-2xl border border-amber-500 bg-amber-50 p-5 text-black" role="alert">
        You do not have permission to inspect leads and growth conversion.
      </div>
    </main>
  );
}

export default function Stage6WorkspaceRouter({ pathname, children }) {
  const { user, loading } = useAuth();

  if (pathname === "/growth/leads") {
    if (loading) return null;
    if (!user) return <Navigate replace to="/login" />;
    return hasPermission(user, "customer:read")
      ? <GrowthLeadConversionPage />
      : <AccessDenied />;
  }

  return children;
}
