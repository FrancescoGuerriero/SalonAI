import CmsPage from "../../pages/CmsPage.jsx";
import ContentStudioPage from "../../pages/ContentStudioPage.jsx";
import CustomerCheckInPage from "../../pages/CustomerCheckInPage.jsx";
import CustomerRelationshipsPage from "../../pages/CustomerRelationshipsPage.jsx";
import ReputationHubPage from "../../pages/ReputationHubPage.jsx";
import useAuth from "../../hooks/useAuth.js";
import { hasPermission } from "../../utils/permissions.js";

function AccessDenied() {
  return (
    <main className="experience-management-page" id="main-content" tabIndex="-1">
      <div className="experience-message is-error" role="alert">
        You do not have permission to open this SalonAI workspace.
      </div>
    </main>
  );
}

export default function Stage4WorkspaceRouter({ pathname, children }) {
  const { user } = useAuth();

  if (pathname.startsWith("/content/") && pathname.length > "/content/".length) {
    return <CmsPage />;
  }
  if (pathname === "/experience/check-in") {
    return <CustomerCheckInPage />;
  }
  if (pathname === "/experience/relationships") {
    return <CustomerRelationshipsPage />;
  }

  if (pathname === "/customer-experience-management/content") {
    return hasPermission(user, "customer-experience:read")
      ? <ContentStudioPage />
      : <AccessDenied />;
  }
  if (pathname === "/customer-experience-management/reputation") {
    return hasPermission(user, "customer-experience:read")
      ? <ReputationHubPage />
      : <AccessDenied />;
  }

  return children;
}
