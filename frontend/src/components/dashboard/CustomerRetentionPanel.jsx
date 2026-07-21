import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCcw,
  UsersRound,
} from "lucide-react";

import CustomerContactModal from "../customers/CustomerContactModal";
import CustomerRetentionStats from "./CustomerRetentionStats";
import DormantCustomersTable from "./DormantCustomersTable";
import NewVsReturningChart from "./NewVsReturningChart";
import TopCustomersTable from "./TopCustomersTable";

import { getCustomerRetentionAnalytics } from "../../services/customerRetentionApi";

function normalizePositiveInteger(
  value,
  fallback,
  maximum
) {
  const parsedValue = Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

export default function CustomerRetentionPanel({
  days = 90,
  dormantDays = 60,
  dormantLimit = 20,
  topCustomerLimit = 10,
}) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedCustomer, setSelectedCustomer] =
    useState(null);

  const [contactSuccess, setContactSuccess] =
    useState("");

  const safeDays = normalizePositiveInteger(
    days,
    90,
    365
  );

  const safeDormantDays = normalizePositiveInteger(
    dormantDays,
    60,
    730
  );

  const safeDormantLimit = normalizePositiveInteger(
    dormantLimit,
    20,
    100
  );

  const safeTopCustomerLimit =
    normalizePositiveInteger(
      topCustomerLimit,
      10,
      50
    );

  const loadRetentionAnalytics = useCallback(
    async ({ initialLoad = false } = {}) => {
      try {
        if (initialLoad) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const data =
          await getCustomerRetentionAnalytics({
            days: safeDays,
            dormantDays: safeDormantDays,
            dormantLimit: safeDormantLimit,
            topCustomerLimit:
              safeTopCustomerLimit,
          });

        setAnalytics(data);
      } catch (requestError) {
        setError(
          requestError.message ||
            "Unable to load customer retention analytics."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      safeDays,
      safeDormantDays,
      safeDormantLimit,
      safeTopCustomerLimit,
    ]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        setLoading(true);
        setError("");

        const data =
          await getCustomerRetentionAnalytics({
            days: safeDays,
            dormantDays: safeDormantDays,
            dormantLimit: safeDormantLimit,
            topCustomerLimit:
              safeTopCustomerLimit,
          });

        if (isMounted) {
          setAnalytics(data);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError.message ||
              "Unable to load customer retention analytics."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [
    safeDays,
    safeDormantDays,
    safeDormantLimit,
    safeTopCustomerLimit,
  ]);

  const summary = analytics?.summary ?? {};

  const newVsReturning = Array.isArray(
    analytics?.newVsReturning
  )
    ? analytics.newVsReturning
    : [];

  const dormantCustomers = Array.isArray(
    analytics?.dormantCustomers
  )
    ? analytics.dormantCustomers
    : [];

  const topCustomers = Array.isArray(
    analytics?.topCustomers
  )
    ? analytics.topCustomers
    : [];

  function handleCustomerSelect(customer) {
    setContactSuccess("");
    setSelectedCustomer(customer);
  }

  function handleContactModalClose() {
    setSelectedCustomer(null);
  }

  async function handleContactSaved(contactLog) {
    const customerName =
      contactLog?.customer?.fullName ||
      contactLog?.customer?.name ||
      selectedCustomer?.customerName ||
      "Customer";

    setContactSuccess(
      `Contact draft for ${customerName} was saved successfully.`
    );

    setSelectedCustomer(null);

    await loadRetentionAnalytics({
      initialLoad: false,
    });
  }

  function handleRefresh() {
    setContactSuccess("");

    loadRetentionAnalytics({
      initialLoad: false,
    });
  }

  return (
    <>
      <section className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
              <UsersRound
                className="text-blue-700"
                size={23}
              />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Customer Retention
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Customer activity and loyalty over the
                last {safeDays} days
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw
              size={17}
              className={
                loading || refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </header>

        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertTriangle
              className="mt-0.5 shrink-0 text-red-600"
              size={21}
            />

            <div className="min-w-0">
              <p className="font-semibold text-red-800">
                Retention analytics unavailable
              </p>

              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        ) : null}

        {contactSuccess ? (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
            <CheckCircle
              className="mt-0.5 shrink-0 text-green-600"
              size={21}
            />

            <div className="min-w-0">
              <p className="font-semibold text-green-800">
                Contact recorded
              </p>

              <p className="mt-1 text-sm text-green-700">
                {contactSuccess}
              </p>
            </div>
          </div>
        ) : null}

        <CustomerRetentionStats
          summary={summary}
          loading={loading}
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <NewVsReturningChart
              data={newVsReturning}
              loading={loading}
            />
          </div>

          <div className="xl:col-span-2">
            <TopCustomersTable
              customers={topCustomers}
              loading={loading}
            />
          </div>
        </div>

        <DormantCustomersTable
          customers={dormantCustomers}
          loading={loading}
          dormantDays={safeDormantDays}
          onCustomerSelect={handleCustomerSelect}
        />
      </section>

      <CustomerContactModal
        open={Boolean(selectedCustomer)}
        customer={selectedCustomer}
        defaultCampaignType="dormant_customer"
        onClose={handleContactModalClose}
        onSaved={handleContactSaved}
      />
    </>
  );
}