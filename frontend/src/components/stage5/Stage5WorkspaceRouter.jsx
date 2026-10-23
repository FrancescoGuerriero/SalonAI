import MeasurementIntegrationCorePage from "../../pages/MeasurementIntegrationCorePage.jsx";
import useAuth from "../../hooks/useAuth.js";
import { hasPermission } from "../../utils/permissions.js";

function AccessDenied() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-4xl rounded-2xl border border-amber-500 bg-amber-50 p-5 text-black" role="alert">
        You do not have permission to inspect the Stage 5 measurement and integration core.
      </div>
    </main>
  );
}

export default function Stage5WorkspaceRouter({ pathname, children }) {
  const { user } = useAuth();

  if (pathname === "/admin/system/measurement-core") {
    return hasPermission(user, "feature-control:read")
      ? <MeasurementIntegrationCorePage />
      : <AccessDenied />;
  }

  return children;
}
