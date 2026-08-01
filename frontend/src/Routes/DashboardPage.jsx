import {
  useCallback,
  useEffect,
  useState,
} from "react";

import ActivityTimeline from "../components/dashboard/ActivityTimeline";
import AppointmentsByStatusChart from "../components/dashboard/AppointmentsByStatusChart";
import BusinessInsightsPanel from "../components/dashboard/BusinessInsightsPanel";
import CustomerCommunicationsSummary from "../components/dashboard/CustomerCommunicationsSummary";
import CustomerRetentionPanel from "../components/dashboard/CustomerRetentionPanel";
import DashboardAlerts from "../components/dashboard/DashboardAlerts";
import DashboardStats from "../components/dashboard/DashboardStats";
import RevenueByServiceChart from "../components/dashboard/RevenueByServiceChart";
import RevenueChart from "../components/dashboard/RevenueChart";
import TodayAppointments from "../components/dashboard/TodayAppointments";
import TodayOperationsPanel from "../components/dashboard/TodayOperationsPanel";
import TopStylistsChart from "../components/dashboard/TopStylistsChart";
import Card from "../components/ui/Card";
import ManagementPageHeader from "../components/management/ManagementPageHeader.jsx";
import ManagementQuickActions from "../components/management/ManagementQuickActions.jsx";
import ManagementContextBar from "../components/management/ManagementContextBar.jsx";
import { CalendarDays, ContactRound, PackagePlus, BarChart3 } from "lucide-react";

import {
  getDashboardData,
} from "../Services/dashboardApi";

import {
  getDashboardInsights,
} from "../Services/dashboardInsightsApi";

import {
  getDashboardOperations,
} from "../Services/dashboardOperationsApi";

export default function DashboardPage() {
  const [
    dashboard,
    setDashboard,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    insightsData,
    setInsightsData,
  ] = useState(null);

  const [
    insightsLoading,
    setInsightsLoading,
  ] = useState(true);

  const [
    insightsError,
    setInsightsError,
  ] = useState("");

  const [
    operations,
    setOperations,
  ] = useState(null);

  const [
    operationsLoading,
    setOperationsLoading,
  ] = useState(true);

  const [
    operationsError,
    setOperationsError,
  ] = useState("");

  const [
    revenueDays,
    setRevenueDays,
  ] = useState(30);

  const loadOperations =
    useCallback(async () => {
      setOperationsLoading(true);
      setOperationsError("");

      try {
        const result =
          await getDashboardOperations();

        setOperations(result);
      } catch (requestError) {
        setOperationsError(
          requestError?.message ||
            "Unable to load today's operations."
        );
      } finally {
        setOperationsLoading(false);
      }
    }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setLoading(true);
      setInsightsLoading(true);
      setOperationsLoading(true);

      setError("");
      setInsightsError("");
      setOperationsError("");

      const dashboardRequest =
        getDashboardData({
          revenueDays,
          activityLimit: 10,
          stylistLimit: 10,
        });

      const insightsRequest =
        getDashboardInsights(
          revenueDays
        );

      const operationsRequest =
        getDashboardOperations();

      const [
        dashboardResult,
        insightsResult,
        operationsResult,
      ] = await Promise.allSettled([
        dashboardRequest,
        insightsRequest,
        operationsRequest,
      ]);

      if (!isMounted) {
        return;
      }

      if (
        dashboardResult.status ===
        "fulfilled"
      ) {
        setDashboard(
          dashboardResult.value
        );
      } else {
        setError(
          dashboardResult.reason
            ?.message ||
            "Unable to load the dashboard."
        );
      }

      if (
        insightsResult.status ===
        "fulfilled"
      ) {
        setInsightsData(
          insightsResult.value
        );
      } else {
        setInsightsError(
          insightsResult.reason
            ?.message ||
            "Unable to load business insights."
        );
      }

      if (
        operationsResult.status ===
        "fulfilled"
      ) {
        setOperations(
          operationsResult.value
        );
      } else {
        setOperationsError(
          operationsResult.reason
            ?.message ||
            "Unable to load today's operations."
        );
      }

      setLoading(false);
      setInsightsLoading(false);
      setOperationsLoading(false);
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [revenueDays]);

  const stats =
    dashboard?.stats ?? {};

  const revenue =
    dashboard?.revenue ?? [];

  const appointments =
    dashboard?.appointments ?? [];

  const activity =
    dashboard?.activity ?? [];

  const alerts =
    dashboard?.alerts ?? {};

  const revenueByService =
    dashboard?.revenueByService ??
    [];

  const appointmentStatus =
    dashboard?.appointmentStatus ??
    [];

  const topStylists =
    dashboard?.topStylists ?? [];

  const insights =
    insightsData?.insights ?? [];

  if (error && !dashboard) {
    return (
      <div className="p-6">
        <Card title="Dashboard Error">
          <p className="text-red-600">
            {error}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <main className="space-y-10 p-6">
      <ManagementContextBar />

      <ManagementPageHeader
        eyebrow="Management overview"
        title="Salon performance dashboard"
        description="Review today’s operation, customer activity, revenue performance and the actions that need management attention."
        meta={[`Revenue window: ${revenueDays} days`, "Live operational data", "Role-protected workspace"]}
        actions={[{ label: "Open appointments", to: "/appointments", icon: CalendarDays, variant: "primary" }, { label: "View reports", to: "/reports", icon: BarChart3 }]}
      />

      <ManagementQuickActions
        title="Run the salon"
        description="Move directly into the workflows used most often during the working day."
        actions={[
          { to: "/appointments", label: "Appointments", description: "Confirm, check in and reschedule bookings", icon: CalendarDays, badge: "Operations" },
          { to: "/customers", label: "Customers", description: "Review profiles, history and follow-ups", icon: ContactRound, badge: "CRM" },
          { to: "/purchase-orders", label: "Purchasing", description: "Approve orders and receive stock", icon: PackagePlus, badge: "Inventory" },
          { to: "/reports", label: "Reports centre", description: "Review revenue and service performance", icon: BarChart3, badge: "Analytics" },
        ]}
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
        >
          Some dashboard data could not
          be refreshed: {error}
        </div>
      ) : null}

      <TodayOperationsPanel
        data={operations}
        loading={operationsLoading}
        error={operationsError}
        onRefresh={loadOperations}
      />

      <section aria-label="Dashboard statistics">
        <DashboardStats
          stats={stats}
          loading={loading}
        />
      </section>

      <section
        aria-label="Revenue and today's appointments"
        className="grid gap-6 xl:grid-cols-3"
      >
        <div className="xl:col-span-2">
          <RevenueChart
            data={revenue}
            loading={loading}
            days={revenueDays}
            onDaysChange={
              setRevenueDays
            }
          />
        </div>

        <TodayAppointments
          appointments={
            appointments
          }
          loading={loading}
        />
      </section>

      <section aria-label="Business insights">
        <BusinessInsightsPanel
          insights={insights}
          loading={
            insightsLoading
          }
          error={insightsError}
          days={revenueDays}
        />
      </section>

      <section
        aria-label="Service and appointment analytics"
        className="grid gap-6 lg:grid-cols-2"
      >
        <RevenueByServiceChart
          data={
            revenueByService
          }
          loading={loading}
        />

        <AppointmentsByStatusChart
          data={
            appointmentStatus
          }
          loading={loading}
        />
      </section>

      <section aria-label="Stylist performance">
        <TopStylistsChart
          data={topStylists}
          loading={loading}
        />
      </section>

      <section
        aria-label="Activity and alerts"
        className="grid gap-6 lg:grid-cols-2"
      >
        <ActivityTimeline
          activity={activity}
          loading={loading}
        />

        <DashboardAlerts
          alerts={alerts}
          loading={loading}
        />
      </section>

      <section
        aria-label="Customer retention"
        className="border-t border-gray-200 pt-10"
      >
        <CustomerRetentionPanel
          days={90}
          dormantDays={60}
          dormantLimit={20}
          topCustomerLimit={10}
        />
      </section>

      <section
        aria-label="Customer communications summary"
        className="border-t border-gray-200 pt-10"
      >
        <CustomerCommunicationsSummary
          days={30}
        />
      </section>
    </main>
  );
}