import {
  lazy,
  Suspense,
} from "react";

import {
  BrowserRouter,
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

const AdminServices = lazy(
  () =>
    import(
      "./pages/AdminServices.jsx"
    )
);

const AdminStylists = lazy(
  () =>
    import(
      "./pages/AdminStylists.jsx"
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

const AdminAppointments = lazy(
  () =>
    import(
      "./pages/AdminAppointments.jsx"
    )
);

const AdminCustomers = lazy(
  () =>
    import(
      "./pages/AdminCustomers.jsx"
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
<Route path="loyalty" element={featurePage(managementPage(LoyaltyProgrammePage), "loyalty")} />
<Route path="gift-cards" element={featurePage(managementPage(GiftCardsPage), "wallet")} />
<Route path="referrals" element={featurePage(managementPage(ReferralManagementPage), "referrals")} />
<Route path="notification-centre" element={featurePage(managementPage(NotificationCentrePage), "notifications")} />
<Route path="push-notifications" element={featurePage(managementPage(PushNotificationsPage), "notifications")} />
<Route path="email-campaigns" element={featurePage(managementPage(EmailCampaignsPage), "communications")} />
<Route path="sms-reminders" element={featurePage(managementPage(SmsRemindersPage), "communications")} />
<Route path="whatsapp-booking" element={featurePage(managementPage(WhatsAppBookingPage), "whatsapp-booking")} />
<Route path="retention-automation" element={featurePage(managementPage(RetentionAutomationPage), "retention-automation")} />
<Route path="premium-analytics" element={featurePage(managementPage(PremiumAnalyticsPage), "premium-analytics")} />
<Route path="customer-experience-management" element={managementPage(CustomerExperienceManagementPage)} />
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
          element={featurePage(<Stylists />, "public-team")}
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
          element={managementPage(
            DashboardPage
          )}
        />

        <Route
          path="customers"
          element={managementPage(
            CustomersPage
          )}
        />

        <Route
          path="customers/:customerId"
          element={managementPage(
            CustomerProfilePage
          )}
        />

        <Route
          path="customers/:customerId/profile"
          element={managementPage(
            CustomerProfilePage
          )}
        />

        <Route
          path="customer-follow-ups"
          element={managementPage(
            CustomerFollowUpsPage
          )}
        />

        <Route
          path="customer-segments"
          element={managementPage(
            CustomerSegmentationPage
          )}
        />

        <Route
          path="customer-value"
          element={managementPage(
            CustomerValuePage
          )}
        />

        <Route
          path="retention-actions"
          element={managementPage(
            RetentionActionsPage
          )}
        />

        <Route
          path="retention-predictions"
          element={managementPage(
            RetentionPredictionsPage
          )}
        />

        <Route
          path="rebooking-opportunities"
          element={managementPage(
            RebookingOpportunitiesPage
          )}
        />


        {/*
        |--------------------------------------------------------------------------
        | Appointment management
        |--------------------------------------------------------------------------
        */}

        <Route
          path="appointments"
          element={managementPage(
            AppointmentsPage
          )}
        />

        <Route
          path="calendar"
          element={managementPage(
            CalendarPage
          )}
        />

        <Route
          path="waitlist"
          element={managementPage(
            WaitlistPage
          )}
        />

        <Route
          path="booking-demand"
          element={managementPage(
            BookingDemandPage
          )}
        />

        <Route
          path="booking-loss"
          element={managementPage(
            BookingLossPage
          )}
        />


        {/*
        |--------------------------------------------------------------------------
        | Reports and salon operations
        |--------------------------------------------------------------------------
        */}

        <Route
          path="revenue-forecast"
          element={managementPage(
            RevenueForecastPage
          )}
        />

        <Route
          path="reports"
          element={managementPage(
            ReportsCentrePage
          )}
        />

        <Route
          path="daily-close"
          element={managementPage(
            DailyClosePage
          )}
        />

        <Route
          path="staff-rota"
          element={managementPage(
            StaffRotaPage
          )}
        />

        <Route
          path="staff-management"
          element={managementPage(
            StaffManagementPage
          )}
        />

        <Route
          path="staff/profile"
          element={managementPage(
            StaffProfileEditorPage
          )}
        />

        <Route
          path="staff-performance"
          element={managementPage(
            StaffPerformancePage
          )}
        />

        <Route
          path="service-performance"
          element={managementPage(
            ServicePerformancePage
          )}
        />


        {/*
        |--------------------------------------------------------------------------
        | Phase 4 AI features
        |--------------------------------------------------------------------------
        */}

        <Route
          path="ai/haircare"
          element={featurePage(managementPage(HaircareRecommendationsPage), "ai-tools")}
        />

        <Route
          path="ai/customer-segmentation"
          element={featurePage(managementPage(AiCustomerSegmentationPage), "ai-tools")}
        />

        <Route
          path="ai/customer-summaries"
          element={featurePage(managementPage(CustomerAiSummariesPage), "ai-tools")}
        />

        <Route
          path="ai/demand-forecasting"
          element={featurePage(managementPage(AiDemandForecastingPage), "ai-tools")}
        />

        <Route
          path="ai/marketing-insights"
          element={featurePage(managementPage(AiMarketingInsightsPage), "ai-tools")}
        />

        <Route
          path="ai/no-show-predictions"
          element={featurePage(managementPage(AiNoShowPredictionPage), "ai-tools")}
        />

        <Route
          path="ai/sales-forecasting"
          element={featurePage(managementPage(AiSalesForecastingPage), "ai-tools")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Communications
        |--------------------------------------------------------------------------
        */}

        <Route
          path="communications"
          element={featurePage(managementPage(CommunicationsPage), "communications")}
        />

        <Route
          path="communication-templates"
          element={featurePage(managementPage(CommunicationTemplatesPage), "communications")}
        />

        <Route
          path="communication-campaigns"
          element={featurePage(managementPage(CommunicationCampaignsPage), "communications")}
        />

        <Route
          path="scheduled-communications"
          element={featurePage(managementPage(ScheduledCommunicationsPage), "communications")}
        />

        <Route
          path="message-delivery"
          element={featurePage(managementPage(MessageDeliveryPage), "communications")}
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
          element={adminPage(
            DataImportPage
          )}
        />

        <Route
          path="manage/orders"
          element={managementPage(
            OrderManagement
          )}
        />

        <Route
          path="suppliers"
          element={featurePage(managementPage(SupplierManagementPage), "inventory-purchasing")}
        />

        <Route
          path="purchase-orders"
          element={featurePage(managementPage(PurchaseOrdersPage), "inventory-purchasing")}
        />

        <Route
          path="purchase-orders/new"
          element={featurePage(managementPage(CreatePurchaseOrderPage), "inventory-purchasing")}
        />

        <Route
          path="purchase-orders/:purchaseOrderId"
          element={featurePage(managementPage(PurchaseOrderDetailsPage), "inventory-purchasing")}
        />

        <Route
          path="reorder-recommendations"
          element={featurePage(managementPage(ReorderRecommendationsPage), "inventory-purchasing")}
        />


        {/*
        |--------------------------------------------------------------------------
        | Advanced management features
        |--------------------------------------------------------------------------
        */}

        <Route
          path="rebooking-campaigns"
          element={featurePage(managementPage(RebookingCampaignsPage), "communications")}
        />

        <Route
          path="marketing-attribution"
          element={featurePage(managementPage(MarketingAttributionPage), "ai-tools")}
        />

        <Route
          path="smart-appointments"
          element={featurePage(managementPage(SmartAppointmentsPage), "ai-tools")}
        />

        <Route
          path="capacity-planning"
          element={featurePage(managementPage(CapacityPlanningPage), "ai-tools")}
        />

        <Route
          path="dynamic-pricing"
          element={featurePage(managementPage(DynamicPricingPage), "ai-tools")}
        />

        <Route
          path="inventory-forecasting"
          element={featurePage(managementPage(InventoryForecastingPage), "inventory-purchasing")}
        />

        <Route
          path="feedback-analytics"
          element={featurePage(managementPage(FeedbackAnalyticsPage), "ai-tools")}
        />

        <Route
          path="management-copilot"
          element={featurePage(managementPage(ManagementCopilotPage), "ai-tools")}
        />

        <Route
          path="executive-command-centre"
          element={featurePage(managementPage(ExecutiveCommandCentrePage), "ai-tools")}
        />

        <Route
          path="data-export-audit"
          element={managementPage(
            DataExportAuditPage
          )}
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
          path="admin/services"
          element={adminPage(
            AdminServices
          )}
        />

        <Route
          path="admin/stylists"
          element={adminPage(
            AdminStylists
          )}
        />

        <Route
          path="admin/employees"
          element={permissionPage(
            AdminStaffAccountsPage,
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
          element={permissionPage(
            AdminStaffAccountsPage,
            "employee:read"
          )}
        />

        <Route
          path="admin/appointments"
          element={adminPage(
            AdminAppointments
          )}
        />

        <Route
          path="admin/customers"
          element={adminPage(
            AdminCustomers
          )}
        />

        <Route
          path="admin/system"
          element={adminPage(
            SystemAdministrationPage
          )}
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
