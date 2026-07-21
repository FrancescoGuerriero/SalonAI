import { useEffect, useState } from "react";

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
import TopStylistsChart from "../components/dashboard/TopStylistsChart";
import Card from "../components/ui/Card";

import { getDashboardData } from "../services/dashboardApi";
import { getDashboardInsights } from "../services/dashboardInsightsApi";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [insightsData, setInsightsData] = useState(null);
  const [insightsLoading, setInsightsLoading] =
    useState(true);
  const [insightsError, setInsightsError] = useState("");

  const [revenueDays, setRevenueDays] = useState(30);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setLoading(true);
      setInsightsLoading(true);

      setError("");
      setInsightsError("");

      const dashboardRequest = getDashboardData({
        revenueDays,
        activityLimit: 10,
        stylistLimit: 10,
      });

      const insightsRequest =
        getDashboardInsights(revenueDays);

      const [dashboardResult, insightsResult] =
        await Promise.allSettled([
          dashboardRequest,
          insightsRequest,
        ]);

      if (!isMounted) {
        return;
      }

      if (dashboardResult.status === "fulfilled") {
        setDashboard(dashboardResult.value);
      } else {
        setError(
          dashboardResult.reason?.message ||
            "Unable to load the dashboard."
        );
      }

      if (insightsResult.status === "fulfilled") {
        setInsightsData(insightsResult.value);
      } else {
        setInsightsError(
          insightsResult.reason?.message ||
            "Unable to load business insights."
        );
      }

      setLoading(false);
      setInsightsLoading(false);
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [revenueDays]);

  const stats = dashboard?.stats ?? {};
  const revenue = dashboard?.revenue ?? [];
  const appointments = dashboard?.appointments ?? [];
  const activity = dashboard?.activity ?? [];
  const alerts = dashboard?.alerts ?? {};

  const revenueByService =
    dashboard?.revenueByService ?? [];

  const appointmentStatus =
    dashboard?.appointmentStatus ?? [];

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
      <header>
        <h1 className="text-3xl font-bold text-gray-900">
          Dashboard
        </h1>

        <p className="mt-1 text-gray-500">
          Welcome back to SalonAI.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
        >
          Some dashboard data could not be refreshed:{" "}
          {error}
        </div>
      ) : null}

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
            onDaysChange={setRevenueDays}
          />
        </div>

        <TodayAppointments
          appointments={appointments}
          loading={loading}
        />
      </section>

      <section aria-label="Business insights">
        <BusinessInsightsPanel
          insights={insights}
          loading={insightsLoading}
          error={insightsError}
          days={revenueDays}
        />
      </section>

      <section
        aria-label="Service and appointment analytics"
        className="grid gap-6 lg:grid-cols-2"
      >
        <RevenueByServiceChart
          data={revenueByService}
          loading={loading}
        />

        <AppointmentsByStatusChart
          data={appointmentStatus}
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