import {
  lazy,
  Suspense,
} from "react";

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import MainLayout from "./components/MainLayout.jsx";
import PageLoader from "./components/ui/PageLoader.jsx";

import AdminRoute from "./Routes/AdminRoute.jsx";
import ManagementRoute from "./Routes/ManagementRoute.jsx";
import PermissionRoute from "./Routes/PermissionRoute.jsx";
import ProtectedRoute from "./Routes/ProtectedRoute.jsx";
import FeatureRoute from "./Routes/FeatureRoute.jsx";
import SkipLink from "./components/accessibility/SkipLink.jsx";
import RouteAnnouncer from "./components/accessibility/RouteAnnouncer.jsx";

const LoyaltyProgrammePage = lazy(() => import("./pages/LoyaltyProgrammePage.jsx"));
const GiftCardsPage = lazy(() => import("./pages/GiftCardsPage.jsx"));
const CustomerAccountPage = lazy(() => import("./pages/CustomerAccountPage.jsx"));
const ReferralManagementPage = lazy(() => import("./pages/ReferralManagementPage.jsx"));
const NotificationCentrePage = lazy(() => import("./pages/NotificationCentrePage.jsx"));
const PushNotificationsPage = lazy(() => import("./pages/PushNotificationsPage.jsx"));
const EmailCampaignsPage = lazy(() => import("./pages/EmailCampaignsPage.jsx"));
const SmsRemindersPage = lazy(() => import("./pages/SmsRemindersPage.jsx"));
const WhatsAppBookingPage = lazy(() => import("./pages/WhatsAppBookingPage.jsx"));
const RetentionAutomationPage = lazy(() => import("./pages/RetentionAutomationPage.jsx"));
const PremiumAnalyticsPage = lazy(() => import("./pages/PremiumAnalyticsPage.jsx"));
const HelpCentrePage = lazy(() => import("./pages/HelpCentrePage.jsx"));
const AboutPage = lazy(() => import("./pages/AboutPage.jsx"));
const SearchLandingPage = lazy(
  () => import("./pages/SearchLandingPage.jsx")
);
const StaffProfileEditorPage = lazy(() => import("./pages/StaffProfileEditorPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));
const CustomerSettingsPage = lazy(() => import("./pages/CustomerSettingsPage.jsx"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage.jsx"));
const CookiePolicyPage = lazy(() => import("./pages/CookiePolicyPage.jsx"));
const MarketingPreferencesPage = lazy(() => import("./pages/MarketingPreferencesPage.jsx"));
const PrivacyRightsPage = lazy(() => import("./pages/PrivacyRightsPage.jsx"));
const AdminPrivacyRequestsPage = lazy(() => import("./pages/AdminPrivacyRequestsPage.jsx"));
const CustomerExperienceSuitePage = lazy(() => import("./pages/CustomerExperienceSuitePage.jsx"));
const CustomerExperienceFeaturePage = lazy(() => import("./pages/CustomerExperienceFeaturePage.jsx"));
const ManageAccountPage = lazy(() => import("./pages/ManageAccountPage.jsx"));
const CustomerExperienceManagementPage = lazy(() => import("./pages/CustomerExperienceManagementPage.jsx"));
const SystemAdministrationPage = lazy(() => import("./pages/SystemAdministrationPage.jsx"));
const Home = lazy(
  () => import("./pages/Home.jsx")
);

const Login = lazy(
  () => import("./pages/Login.jsx")
);

const Register = lazy(
  () => import("./pages/Register.jsx")
);

const Services = lazy(
  () => import("./pages/Services.jsx")
);

const Stylists = lazy(
  () => import("./pages/Stylists.jsx")
);

const Booking = lazy(
  () => import("./pages/Booking.jsx")
);

const Shop = lazy(
  () => import("./pages/Shop.jsx")
);

const ProductDetailsPage = lazy(
  () => import("./pages/ProductDetailsPage.jsx")
);

const ServicePackagesPage = lazy(
  () => import("./pages/ServicePackagesPage.jsx")
);

const ServicePackageManagementPage = lazy(
  () => import("./pages/ServicePackageManagementPage.jsx")
);

const Cart = lazy(
  () => import("./pages/Cart.jsx")
);

const Checkout = lazy(
  () => import("./pages/Checkout.jsx")
);

const CheckoutSuccess = lazy(
  () =>
    import(
      "./pages/CheckoutSuccess.jsx"
    )
);

const OrderHistory = lazy(
  () =>
    import(
      "./pages/OrderHistory.jsx"
    )
);

const InventoryManagement = lazy(
  () =>
    import(
      "./pages/InventoryManagement.jsx"
    )
);

const ProductManagementPage = lazy(
  () =>
    import(
      "./pages/ProductManagementPage.jsx"
    )
);

const OrderManagement = lazy(
  () =>
    import(
      "./pages/OrderManagement.jsx"
    )
);


const DashboardPage = lazy(
  () =>
    import(
      "./pages/DashboardPage.jsx"
    )
);

const CustomersPage = lazy(
  () =>
    import(
      "./pages/CustomersPage.jsx"
    )
);

const CustomerProfilePage = lazy(
  () =>
    import(
      "./pages/CustomerProfilePage.jsx"
    )
);

const CustomerFollowUpsPage = lazy(
  () =>
    import(
      "./pages/CustomerFollowUpsPage.jsx"
    )
);

const CustomerSegmentationPage = lazy(
  () =>
    import(
      "./pages/CustomerSegmentationPage.jsx"
    )
);

const CustomerValuePage = lazy(
  () =>
    import(
      "./pages/CustomerValuePage.jsx"
    )
);

const RetentionActionsPage = lazy(
  () =>
    import(
      "./pages/RetentionActionsPage.jsx"
    )
);

const RetentionPredictionsPage = lazy(
  () =>
    import(
      "./pages/RetentionPredictionsPage.jsx"
    )
);

const RebookingOpportunitiesPage = lazy(
  () =>
    import(
      "./pages/RebookingOpportunitiesPage.jsx"
    )
);


const AppointmentsPage = lazy(
  () =>
    import(
      "./pages/AppointmentsPage.jsx"
    )
);

const CalendarPage = lazy(
  () =>
    import(
      "./pages/CalendarPage.jsx"
    )
);

const WaitlistPage = lazy(
  () =>
    import(
      "./pages/WaitlistPage.jsx"
    )
);

const BookingDemandPage = lazy(
  () =>
    import(
      "./pages/BookingDemandPage.jsx"
    )
);

const BookingLossPage = lazy(
  () =>
    import(
      "./pages/BookingLossPage.jsx"
    )
);


const RevenueForecastPage = lazy(
  () =>
    import(
      "./pages/RevenueForecastPage.jsx"
    )
);

const ReportsCentrePage = lazy(
  () =>
    import(
      "./pages/ReportsCentrePage.jsx"
    )
);

const DailyClosePage = lazy(
  () =>
    import(
      "./pages/DailyClosePage.jsx"
    )
);

const StaffRotaPage = lazy(
  () =>
    import(
      "./pages/StaffRotaPage.jsx"
    )
);

const StaffManagementPage = lazy(
  () =>
    import(
      "./pages/StaffManagementPage.jsx"
    )
);

const StaffSelfServicePage = lazy(
  () =>
    import(
      "./pages/StaffSelfServicePage.jsx"
    )
);

const StaffPerformancePage = lazy(
  () =>
    import(
      "./pages/StaffPerformancePage.jsx"
    )
);

const ServicePerformancePage = lazy(
  () =>
    import(
      "./pages/ServicePerformancePage.jsx"
    )
);


const HaircareRecommendationsPage = lazy(
  () =>
    import(
      "./pages/HaircareRecommendationsPage.jsx"
    )
);

const CustomerAiSummariesPage = lazy(
  () =>
    import(
      "./pages/CustomerAiSummariesPage.jsx"
    )
);

const AiCustomerSegmentationPage = lazy(
  () =>
    import(
      "./pages/AiCustomerSegmentationPage.jsx"
    )
);

const AiDemandForecastingPage = lazy(
  () =>
    import(
      "./pages/AiDemandForecastingPage.jsx"
    )
);

const AiSalesForecastingPage = lazy(
  () =>
    import(
      "./pages/AiSalesForecastingPage.jsx"
    )
);

const AiMarketingInsightsPage = lazy(
  () =>
    import(
      "./pages/AiMarketingInsightsPage.jsx"
    )
);

const AiNoShowPredictionPage = lazy(
  () =>
    import(
      "./pages/AiNoShowPredictionPage.jsx"
    )
);

const CommunicationsPage = lazy(
  () =>
    import(
      "./pages/CommunicationsPage.jsx"
    )
);

const CommunicationTemplatesPage = lazy(
  () =>
    import(
      "./pages/CommunicationTemplatesPage.jsx"
    )
);

const CommunicationCampaignsPage = lazy(
  () =>
    import(
      "./pages/CommunicationCampaignsPage.jsx"
    )
);

const ScheduledCommunicationsPage = lazy(
  () =>
    import(
      "./pages/ScheduledCommunicationsPage.jsx"
    )
);

const MessageDeliveryPage = lazy(
  () =>
    import(
      "./pages/MessageDeliveryPage.jsx"
    )
);


const ServicesPage = lazy(
  () =>
    import(
      "./pages/ServicesPage.jsx"
    )
);


const RebookingCampaignsPage = lazy(
  () =>
    import(
      "./pages/RebookingCampaignsPage.jsx"
    )
);

const MarketingAttributionPage = lazy(
  () =>
    import(
      "./pages/MarketingAttributionPage.jsx"
    )
);

const SmartAppointmentsPage = lazy(
  () =>
    import(
      "./pages/SmartAppointmentsPage.jsx"
    )
);

const CapacityPlanningPage = lazy(
  () =>
    import(
      "./pages/CapacityPlanningPage.jsx"
    )
);

const DynamicPricingPage = lazy(
  () =>
    import(
      "./pages/DynamicPricingPage.jsx"
    )
);

const InventoryForecastingPage = lazy(
  () =>
    import(
      "./pages/InventoryForecastingPage.jsx"
    )
);

const FeedbackAnalyticsPage = lazy(
  () =>
    import(
      "./pages/FeedbackAnalyticsPage.jsx"
    )
);

const ManagementCopilotPage = lazy(
  () =>
    import(
      "./pages/ManagementCopilotPage.jsx"
    )
);

const ExecutiveCommandCentrePage = lazy(
  () =>
    import(
      "./pages/ExecutiveCommandCentrePage.jsx"
    )
);

const DataExportAuditPage = lazy(
  () =>
    import(
      "./pages/DataExportAuditPage.jsx"
    )
);


const AdminDashboard = lazy(
  () =>
    import(
      "./pages/AdminDashboard.jsx"
    )
);

const AdminStaffAccountsPage = lazy(
  () =>
    import(
      "./pages/AdminStaffAccountsPage.jsx"
    )
);

const AdminEmployeeDetailPage = lazy(
  () =>
    import(
      "./pages/AdminEmployeeDetailPage.jsx"
    )
);

const StaffRoleManagementPage = lazy(
  () =>
    import(
      "./pages/StaffRoleManagementPage.jsx"
    )
);

const SupplierManagementPage = lazy(
  () =>
    import(
      "./pages/SupplierManagementPage.jsx"
    )
);

const PurchaseOrdersPage = lazy(
  () =>
    import(
      "./pages/PurchaseOrdersPage.jsx"
    )
);

const CreatePurchaseOrderPage = lazy(
  () =>
    import(
      "./pages/CreatePurchaseOrderPage.jsx"
    )
);

const PurchaseOrderDetailsPage = lazy(
  () =>
    import(
      "./pages/PurchaseOrderDetailsPage.jsx"
    )
);

const ReorderRecommendationsPage = lazy(
  () =>
    import(
      "./pages/ReorderRecommendationsPage.jsx"
    )
);

const DataImportPage = lazy(
  () =>
    import(
      "./pages/DataImportPage.jsx"
    )
);

function protectedPage(
  PageComponent
) {
  return (
    <ProtectedRoute>
      <PageComponent />
    </ProtectedRoute>
  );
}


function managementPage(
  PageComponent
) {
  return (
    <ManagementRoute>
      <PageComponent />
    </ManagementRoute>
  );
}


function adminPage(
  PageComponent
) {
  return (
    <AdminRoute>
      <PageComponent />
    </AdminRoute>
  );
}

function permissionPage(
  PageComponent,
  permission
) {
  return (
    <PermissionRoute
      permission={permission}
    >
      <PageComponent />
    </PermissionRoute>
  );
}

function featurePage(element, featureId) {
  return (
    <FeatureRoute featureId={featureId}>
      {element}
    </FeatureRoute>
  );
}


function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/*
        |--------------------------------------------------------------------------
        | Public routes
        |--------------------------------------------------------------------------
        */}
<Route path="loyalty" element={featurePage(permissionPage(LoyaltyProgrammePage, "loyalty:manage"), "loyalty")} />
<Route path="gift-cards" element={featurePage(permissionPage(GiftCardsPage, "gift-card:manage"), "wallet")} />
<Route path="referrals" element={featurePage(permissionPage(ReferralManagementPage, "referral:manage"), "referrals")} />
<Route path="notification-centre" element={featurePage(permissionPage(NotificationCentrePage, "notification:manage"), "notifications")} />
<Route path="push-notifications" element={featurePage(permissionPage(PushNotificationsPage, "push:manage"), "notifications")} />
<Route path="email-campaigns" element={featurePage(permissionPage(EmailCampaignsPage, "email-campaign:manage"), "communications")} />
<Route path="sms-reminders" element={featurePage(permissionPage(SmsRemindersPage, "sms-reminder:manage"), "communications")} />
<Route path="whatsapp-booking" element={featurePage(permissionPage(WhatsAppBookingPage, "whatsapp:manage"), "whatsapp-booking")} />
<Route path="retention-automation" element={featurePage(permissionPage(RetentionAutomationPage, "retention-automation:manage"), "retention-automation")} />
<Route path="premium-analytics" element={featurePage(permissionPage(PremiumAnalyticsPage, "premium-analytics:read"), "premium-analytics")} />
<Route path="customer-experience-management" element={permissionPage(CustomerExperienceManagementPage, "customer:read")} />
        <Route
          index
          element={<Home />}
        />

        <Route
          path="services"
          element={<Services />}
        />

        <Route
          path="stylists"
          element={<Stylists />}
        />

        <Route
          path="hair-services"
          element={<SearchLandingPage />}
        />

        <Route
          path="hair-colour"
          element={<SearchLandingPage />}
        />

        <Route
          path="haircuts-styling"
          element={<SearchLandingPage />}
        />

        <Route
          path="professional-haircare"
          element={<SearchLandingPage />}
        />

        <Route
          path="book-hair-appointment"
          element={<SearchLandingPage />}
        />

        <Route
          path="about"
          element={<AboutPage />}
        />

        <Route
          path="login"
          element={<Login />}
        />

        <Route
          path="register"
          element={<Register />}
        />

        <Route
          path="shop"
          element={featurePage(<Shop />, "online-shop")}
        />

        <Route
          path="shop/:identifier"
          element={featurePage(<ProductDetailsPage />, "online-shop")}
        />

        <Route
          path="packages"
          element={<ServicePackagesPage />}
        />

        <Route
          path="experience"
          element={<CustomerExperienceSuitePage />}
        />

        <Route
          path="experience/:featureId"
          element={protectedPage(CustomerExperienceFeaturePage)}
        />

        <Route
          path="help"
          element={<HelpCentrePage />}
        />

        <Route
          path="privacy"
          element={<PrivacyPolicyPage />}
        />

        <Route
          path="cookies"
          element={<CookiePolicyPage />}
        />

        <Route
          path="communication-preferences"
          element={<MarketingPreferencesPage />}
        />

        <Route
          path="communication-preferences/:token"
          element={<MarketingPreferencesPage />}
        />

        <Route
          path="cart"
          element={featurePage(<Cart />, "online-shop")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Protected customer routes
        |--------------------------------------------------------------------------
        */}

        <Route
          path="checkout"
          element={featurePage(protectedPage(Checkout), "online-shop")}
        />

        <Route
          path="checkout/success"
          element={featurePage(protectedPage(CheckoutSuccess), "online-shop")}
        />

        <Route
          path="orders"
          element={featurePage(protectedPage(OrderHistory), "online-shop")}
        />

        <Route
          path="account"
          element={protectedPage(
            CustomerAccountPage
          )}
        />

        <Route
          path="settings"
          element={protectedPage(
            CustomerSettingsPage
          )}
        />

        <Route
          path="account/manage"
          element={protectedPage(
            ManageAccountPage
          )}
        />

        <Route
          path="account/privacy-rights"
          element={protectedPage(
            PrivacyRightsPage
          )}
        />

        <Route
          path="booking"
          element={featurePage(protectedPage(Booking), "online-booking")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Dashboard and customer management
        |--------------------------------------------------------------------------
        */}

        <Route
          path="dashboard"
          element={permissionPage(DashboardPage, "dashboard:view")}
        />

        <Route
          path="customers"
          element={permissionPage(CustomersPage, "customer:read")}
        />

        <Route
          path="customers/:customerId"
          element={permissionPage(CustomerProfilePage, "customer:read")}
        />

        <Route
          path="customers/:customerId/profile"
          element={permissionPage(CustomerProfilePage, "customer:read")}
        />

        <Route
          path="customer-follow-ups"
          element={permissionPage(CustomerFollowUpsPage, "customer:read")}
        />

        <Route
          path="customer-segments"
          element={permissionPage(CustomerSegmentationPage, "customer:read")}
        />

        <Route
          path="customer-value"
          element={permissionPage(CustomerValuePage, "customer:read")}
        />

        <Route
          path="retention-actions"
          element={permissionPage(RetentionActionsPage, "customer:read")}
        />

        <Route
          path="retention-predictions"
          element={permissionPage(RetentionPredictionsPage, "customer:read")}
        />

        <Route
          path="rebooking-opportunities"
          element={permissionPage(RebookingOpportunitiesPage, "customer:read")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Appointment management
        |--------------------------------------------------------------------------
        */}

        <Route
          path="appointments"
          element={permissionPage(AppointmentsPage, "appointment:read")}
        />

        <Route
          path="calendar"
          element={permissionPage(CalendarPage, "appointment:read")}
        />

        <Route
          path="waitlist"
          element={permissionPage(WaitlistPage, "appointment:read")}
        />

        <Route
          path="booking-demand"
          element={permissionPage(BookingDemandPage, "appointment:read")}
        />

        <Route
          path="booking-loss"
          element={permissionPage(BookingLossPage, "appointment:read")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Reports and salon operations
        |--------------------------------------------------------------------------
        */}

        <Route
          path="revenue-forecast"
          element={permissionPage(RevenueForecastPage, "reports:read")}
        />

        <Route
          path="reports"
          element={permissionPage(ReportsCentrePage, "reports:read")}
        />

        <Route
          path="daily-close"
          element={permissionPage(DailyClosePage, "reports:read")}
        />

        <Route
          path="staff-rota"
          element={permissionPage(StaffRotaPage, "employee:read")}
        />

        <Route
          path="team-availability"
          element={permissionPage(StaffManagementPage, "employee:read")}
        />

        <Route
          path="staff-management"
          element={
            <Navigate
              replace
              to="/team-availability"
            />
          }
        />

        <Route
          path="staff/profile"
          element={permissionPage(StaffProfileEditorPage, "profile:own:read")}
        />

        <Route
          path="staff/self-service"
          element={permissionPage(
            StaffSelfServicePage,
            "schedule:own:read"
          )}
        />

        <Route
          path="staff-performance"
          element={permissionPage(StaffPerformancePage, "reports:read")}
        />

        <Route
          path="service-performance"
          element={permissionPage(ServicePerformancePage, "reports:read")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Phase 4 AI features
        |--------------------------------------------------------------------------
        */}

        <Route
          path="ai/haircare"
          element={featurePage(permissionPage(HaircareRecommendationsPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="ai/customer-segmentation"
          element={featurePage(permissionPage(AiCustomerSegmentationPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="ai/customer-summaries"
          element={featurePage(permissionPage(CustomerAiSummariesPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="ai/demand-forecasting"
          element={featurePage(permissionPage(AiDemandForecastingPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="ai/marketing-insights"
          element={featurePage(permissionPage(AiMarketingInsightsPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="ai/no-show-predictions"
          element={featurePage(permissionPage(AiNoShowPredictionPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="ai/sales-forecasting"
          element={featurePage(permissionPage(AiSalesForecastingPage, "ai:use"), "ai-tools")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Communications
        |--------------------------------------------------------------------------
        */}

        <Route
          path="communications"
          element={featurePage(permissionPage(CommunicationsPage, "communications:read"), "communications")}
        />

        <Route
          path="communication-templates"
          element={featurePage(permissionPage(CommunicationTemplatesPage, "communications:read"), "communications")}
        />

        <Route
          path="communication-campaigns"
          element={featurePage(permissionPage(CommunicationCampaignsPage, "communications:read"), "communications")}
        />

        <Route
          path="scheduled-communications"
          element={featurePage(permissionPage(ScheduledCommunicationsPage, "communications:read"), "communications")}
        />

        <Route
          path="message-delivery"
          element={featurePage(permissionPage(MessageDeliveryPage, "communications:read"), "communications")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Commerce management
        |--------------------------------------------------------------------------
        */}

        <Route
          path="manage/services"
          element={permissionPage(
            ServicesPage,
            "service:read"
          )}
        />

        <Route
          path="manage/service-packages"
          element={permissionPage(
            ServicePackageManagementPage,
            "service:read"
          )}
        />

        <Route
          path="manage/products"
          element={permissionPage(
            ProductManagementPage,
            "product:read"
          )}
        />

        <Route
          path="manage/inventory"
          element={permissionPage(
            InventoryManagement,
            "inventory:read"
          )}
        />

        <Route
          path="data-imports"
          element={permissionPage(DataImportPage, "data-import:manage")}
        />

        <Route
          path="manage/orders"
          element={permissionPage(OrderManagement, "product:read")}
        />

        <Route
          path="suppliers"
          element={featurePage(permissionPage(SupplierManagementPage, "inventory:read"), "inventory-purchasing")}
        />

        <Route
          path="purchase-orders"
          element={featurePage(permissionPage(PurchaseOrdersPage, "inventory:read"), "inventory-purchasing")}
        />

        <Route
          path="purchase-orders/new"
          element={featurePage(permissionPage(CreatePurchaseOrderPage, "inventory:read"), "inventory-purchasing")}
        />

        <Route
          path="purchase-orders/:purchaseOrderId"
          element={featurePage(permissionPage(PurchaseOrderDetailsPage, "inventory:read"), "inventory-purchasing")}
        />

        <Route
          path="reorder-recommendations"
          element={featurePage(permissionPage(ReorderRecommendationsPage, "inventory:read"), "inventory-purchasing")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Advanced management features
        |--------------------------------------------------------------------------
        */}

        <Route
          path="rebooking-campaigns"
          element={featurePage(permissionPage(RebookingCampaignsPage, "communications:read"), "communications")}
        />

        <Route
          path="marketing-attribution"
          element={featurePage(permissionPage(MarketingAttributionPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="smart-appointments"
          element={featurePage(permissionPage(SmartAppointmentsPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="capacity-planning"
          element={featurePage(permissionPage(CapacityPlanningPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="dynamic-pricing"
          element={featurePage(permissionPage(DynamicPricingPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="inventory-forecasting"
          element={featurePage(permissionPage(InventoryForecastingPage, "inventory:read"), "inventory-purchasing")}
        />

        <Route
          path="feedback-analytics"
          element={featurePage(permissionPage(FeedbackAnalyticsPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="management-copilot"
          element={featurePage(permissionPage(ManagementCopilotPage, "ai:use"), "ai-tools")}
        />

        <Route
          path="executive-command-centre"
          element={featurePage(permissionPage(ExecutiveCommandCentrePage, "ai:use"), "ai-tools")}
        />

        <Route
          path="data-export-audit"
          element={permissionPage(DataExportAuditPage, "reports:read")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Administrator routes
        |--------------------------------------------------------------------------
        */}

        <Route
          path="admin"
          element={adminPage(
            AdminDashboard
          )}
        />

        <Route
          path="admin/privacy-requests"
          element={adminPage(
            AdminPrivacyRequestsPage
          )}
        />

        <Route
          path="admin/services"
          element={
            <Navigate
              replace
              to="/manage/services"
            />
          }
        />

        <Route
          path="admin/stylists"
          element={
            <Navigate
              replace
              to="/staff/profile"
            />
          }
        />

        <Route
          path="admin/employees"
          element={permissionPage(
            AdminStaffAccountsPage,
            "employee:read"
          )}
        />

        <Route
          path="admin/employees/record/:recordId"
          element={permissionPage(
            AdminEmployeeDetailPage,
            "employee:read"
          )}
        />

        <Route
          path="admin/employees/:id"
          element={permissionPage(
            AdminEmployeeDetailPage,
            "employee:read"
          )}
        />

        <Route
          path="admin/staff-accounts"
          element={
            <Navigate
              replace
              to="/admin/employees"
            />
          }
        />

        <Route
          path="admin/staff-roles"
          element={permissionPage(
            StaffRoleManagementPage,
            "staff-role:read"
          )}
        />

        <Route
          path="admin/appointments"
          element={
            <Navigate
              replace
              to="/appointments"
            />
          }
        />

        <Route
          path="admin/customers"
          element={
            <Navigate
              replace
              to="/customers"
            />
          }
        />

        <Route
          path="admin/system"
          element={permissionPage(SystemAdministrationPage, "feature-control:read")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Unknown route
        |--------------------------------------------------------------------------
        */}

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}


export default function App() {
  return (
    <BrowserRouter>
      <SkipLink />
      <RouteAnnouncer />
      <Suspense fallback={<PageLoader />}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  );
}
