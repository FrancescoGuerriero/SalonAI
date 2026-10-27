import { Navigate } from "react-router-dom";
import AiibpPlatformChrome from "../platform/AiibpPlatformChrome.jsx";
import AiibpModulesPage from "../../pages/AiibpModulesPage.jsx";
import AiibpPlatformAboutPage from "../../pages/AiibpPlatformAboutPage.jsx";
import AiibpPlatformContactPage from "../../pages/AiibpPlatformContactPage.jsx";
import AiibpPlatformHomePage from "../../pages/AiibpPlatformHomePage.jsx";
import CmsPage from "../../pages/CmsPage.jsx";
import ContentStudioPage from "../../pages/ContentStudioPage.jsx";
import CustomerCheckInPage from "../../pages/CustomerCheckInPage.jsx";
import CustomerRelationshipsPage from "../../pages/CustomerRelationshipsPage.jsx";
import ReputationHubPage from "../../pages/ReputationHubPage.jsx";
import StylistCopilotPage from "../../pages/StylistCopilotPage.jsx";
import useAuth from "../../hooks/useAuth.js";
import useFeatureControls from "../../hooks/useFeatureControls.js";
import { hasPermission } from "../../utils/permissions.js";
import Stage5WorkspaceRouter from "../stage5/Stage5WorkspaceRouter.jsx";

function AccessDenied() {
  return (
    <main className="experience-management-page" id="main-content" tabIndex="-1">
      <div className="experience-message is-error" role="alert">
        You do not have permission to open this SalonAI workspace.
      </div>
    </main>
  );
}

function FeatureUnavailable() {
  return (
    <main className="experience-management-page" id="main-content" tabIndex="-1">
      <div className="experience-message is-error" role="alert">
        This SalonAI capability is not enabled for the current business.
      </div>
    </main>
  );
}

function platformPage(pathname) {
  let Page = null;
  if (pathname === "/platform") Page = AiibpPlatformHomePage;
  else if (pathname === "/platform/modules") Page = AiibpModulesPage;
  else if (pathname === "/platform/about") Page = AiibpPlatformAboutPage;
  else if (pathname === "/platform/contact") Page = AiibpPlatformContactPage;
  if (!Page) return null;
  return <AiibpPlatformChrome><Page /></AiibpPlatformChrome>;
}

export default function Stage4WorkspaceRouter({ pathname, children }) {
  const { user, loading } = useAuth();
  const { isFeatureEnabled } = useFeatureControls();

  const publicPlatformPage = platformPage(pathname);
  if (publicPlatformPage) return publicPlatformPage;

  if (pathname.startsWith("/content/") && pathname.length > "/content/".length) {
    return <CmsPage />;
  }

  const customerWorkspace = pathname === "/experience/check-in" || pathname === "/experience/relationships";
  if (customerWorkspace && loading) return null;
  if (customerWorkspace && !user) return <Navigate replace to="/login" />;
  if (pathname === "/experience/check-in") return <CustomerCheckInPage />;
  if (pathname === "/experience/relationships") return <CustomerRelationshipsPage />;

  const stylistCopilotWorkspace = pathname === "/stylist-copilot";
  if (stylistCopilotWorkspace && loading) return null;
  if (stylistCopilotWorkspace && !user) return <Navigate replace to="/login" />;
  if (stylistCopilotWorkspace && !hasPermission(user, "ai:use")) return <AccessDenied />;
  if (stylistCopilotWorkspace && !isFeatureEnabled("ai-tools")) return <FeatureUnavailable />;
  if (stylistCopilotWorkspace) return <StylistCopilotPage />;

  const managementWorkspace = pathname === "/customer-experience-management/content"
    || pathname === "/customer-experience-management/reputation";
  if (managementWorkspace && loading) return null;
  if (managementWorkspace && !user) return <Navigate replace to="/login" />;

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

  return (
    <Stage5WorkspaceRouter pathname={pathname}>
      {children}
    </Stage5WorkspaceRouter>
  );
}
