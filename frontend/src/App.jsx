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
import ProtectedRoute from "./Routes/ProtectedRoute.jsx";
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
const StaffProfileEditorPage = lazy(() => import("./pages/StaffProfileEditorPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));
const CustomerSettingsPage = lazy(() => import("./pages/CustomerSettingsPage.jsx"));
const CustomerExperienceSuitePage = lazy(() => import("./pages/CustomerExperienceSuitePage.jsx"));
const CustomerExperienceFeaturePage = lazy(() => import("./pages/CustomerExperienceFeaturePage.jsx"));
const ManageAccountPage = lazy(() => import("./pages/ManageAccountPage.jsx"));
const CustomerExperienceManagementPage = lazy(() => import("./pages/CustomerExperienceManagementPage.jsx"));
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


function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/*
        |--------------------------------------------------------------------------
        | Public routes
        |--------------------------------------------------------------------------
        */}
<Route path="loyalty" element={managementPage(LoyaltyProgrammePage)} />
<Route path="gift-cards" element={managementPage(GiftCardsPage)} />
<Route path="referrals" element={managementPage(ReferralManagementPage)} />
<Route path="notification-centre" element={managementPage(NotificationCentrePage)} />
<Route path="push-notifications" element={managementPage(PushNotificationsPage)} />
<Route path="email-campaigns" element={managementPage(EmailCampaignsPage)} />
<Route path="sms-reminders" element={managementPage(SmsRemindersPage)} />
<Route path="whatsapp-booking" element={managementPage(WhatsAppBookingPage)} />
<Route path="retention-automation" element={managementPage(RetentionAutomationPage)} />
<Route path="premium-analytics" element={managementPage(PremiumAnalyticsPage)} />
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
          element={<Stylists />}
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
          element={<Shop />}
        />

        <Route
          path="shop/:identifier"
          element={<ProductDetailsPage />}
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
          element={<Cart />}
        />


        {/*
        |--------------------------------------------------------------------------
        | Protected customer routes
        |--------------------------------------------------------------------------
        */}

        <Route
          path="checkout"
          element={protectedPage(
            Checkout
          )}
        />

        <Route
          path="checkout/success"
          element={protectedPage(
            CheckoutSuccess
          )}
        />

        <Route
          path="orders"
          element={protectedPage(
            OrderHistory
          )}
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
          element={protectedPage(
            Booking
          )}
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
          element={managementPage(
            HaircareRecommendationsPage
          )}
        />

        <Route
          path="ai/customer-segmentation"
          element={managementPage(
            AiCustomerSegmentationPage
          )}
        />

        <Route
          path="ai/customer-summaries"
          element={managementPage(
            CustomerAiSummariesPage
          )}
        />

        <Route
          path="ai/demand-forecasting"
          element={managementPage(
            AiDemandForecastingPage
          )}
        />

        <Route
          path="ai/marketing-insights"
          element={managementPage(
            AiMarketingInsightsPage
          )}
        />

        <Route
          path="ai/no-show-predictions"
          element={managementPage(
            AiNoShowPredictionPage
          )}
        />

        <Route
          path="ai/sales-forecasting"
          element={managementPage(
            AiSalesForecastingPage
          )}
        />


        {/*
        |--------------------------------------------------------------------------
        | Communications
        |--------------------------------------------------------------------------
        */}

        <Route
          path="communications"
          element={managementPage(
            CommunicationsPage
          )}
        />

        <Route
          path="communication-templates"
          element={managementPage(
            CommunicationTemplatesPage
          )}
        />

        <Route
          path="communication-campaigns"
          element={managementPage(
            CommunicationCampaignsPage
          )}
        />

        <Route
          path="scheduled-communications"
          element={managementPage(
            ScheduledCommunicationsPage
          )}
        />

        <Route
          path="message-delivery"
          element={managementPage(
            MessageDeliveryPage
          )}
        />


        {/*
        |--------------------------------------------------------------------------
        | Commerce management
        |--------------------------------------------------------------------------
        */}

        <Route
          path="manage/services"
          element={managementPage(
            ServicesPage
          )}
        />

        <Route
          path="manage/inventory"
          element={managementPage(
            InventoryManagement
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
          element={managementPage(
            SupplierManagementPage
          )}
        />

        <Route
          path="purchase-orders"
          element={managementPage(
            PurchaseOrdersPage
          )}
        />

        <Route
          path="purchase-orders/new"
          element={managementPage(
            CreatePurchaseOrderPage
          )}
        />

        <Route
          path="purchase-orders/:purchaseOrderId"
          element={managementPage(
            PurchaseOrderDetailsPage
          )}
        />

        <Route
          path="reorder-recommendations"
          element={managementPage(
            ReorderRecommendationsPage
          )}
        />


        {/*
        |--------------------------------------------------------------------------
        | Advanced management features
        |--------------------------------------------------------------------------
        */}

        <Route
          path="rebooking-campaigns"
          element={managementPage(
            RebookingCampaignsPage
          )}
        />

        <Route
          path="marketing-attribution"
          element={managementPage(
            MarketingAttributionPage
          )}
        />

        <Route
          path="smart-appointments"
          element={managementPage(
            SmartAppointmentsPage
          )}
        />

        <Route
          path="capacity-planning"
          element={managementPage(
            CapacityPlanningPage
          )}
        />

        <Route
          path="dynamic-pricing"
          element={managementPage(
            DynamicPricingPage
          )}
        />

        <Route
          path="inventory-forecasting"
          element={managementPage(
            InventoryForecastingPage
          )}
        />

        <Route
          path="feedback-analytics"
          element={managementPage(
            FeedbackAnalyticsPage
          )}
        />

        <Route
          path="management-copilot"
          element={managementPage(
            ManagementCopilotPage
          )}
        />

        <Route
          path="executive-command-centre"
          element={managementPage(
            ExecutiveCommandCentrePage
          )}
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
