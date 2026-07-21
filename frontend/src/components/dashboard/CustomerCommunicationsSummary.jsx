import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  CheckCheck,
  Eye,
  MessageCircle,
  MessageSquareReply,
  RefreshCcw,
  Send,
  Users,
} from "lucide-react";

import { Link } from "react-router-dom";

import { getCustomerContactCampaignSummary } from "../../services/customerContactApi";

const numberFormatter = new Intl.NumberFormat("en-GB");

const percentageFormatter = new Intl.NumberFormat(
  "en-GB",
  {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }
);

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

function formatPercentage(value) {
  return `${percentageFormatter.format(
    Number(value) || 0
  )}%`;
}

function MetricCard({
  title,
  value,
  icon: Icon,
  loading,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {title}
          </p>

          {loading ? (
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {value}
            </p>
          )}
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function CustomerCommunicationsSummary({
  days = 30,
}) {
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const loadSummary = useCallback(
    async ({ initialLoad = false } = {}) => {
      try {
        if (initialLoad) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const response =
          await getCustomerContactCampaignSummary({
            days,
          });

        setSummary(
          response?.summary ??
            response?.data?.summary ??
            response ??
            {}
        );
      } catch (requestError) {
        setError(
          requestError?.response?.data?.message ||
            requestError?.message ||
            "Unable to load communication statistics."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days]
  );

  useEffect(() => {
    let active = true;

    async function loadInitialSummary() {
      try {
        setLoading(true);
        setError("");

        const response =
          await getCustomerContactCampaignSummary({
            days,
          });

        if (!active) {
          return;
        }

        setSummary(
          response?.summary ??
            response?.data?.summary ??
            response ??
            {}
        );
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(
          requestError?.response?.data?.message ||
            requestError?.message ||
            "Unable to load communication statistics."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadInitialSummary();

    return () => {
      active = false;
    };
  }, [days]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100">
            <MessageCircle
              className="text-indigo-700"
              size={22}
            />
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Customer Communications
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Communication performance over the last{" "}
              {days} days
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              loadSummary({
                initialLoad: false,
              })
            }
            disabled={loading || refreshing}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Refresh communication summary"
            title="Refresh communication summary"
          >
            <RefreshCcw
              size={17}
              className={
                refreshing ? "animate-spin" : ""
              }
            />
          </button>

          <Link
            to="/communications"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            View communications
            <ArrowRight size={17} />
          </Link>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Total Contacts"
          value={formatNumber(summary.total)}
          icon={Send}
          loading={loading}
        />

        <MetricCard
          title="Customers Contacted"
          value={formatNumber(
            summary.uniqueCustomers
          )}
          icon={Users}
          loading={loading}
        />

        <MetricCard
          title="Messages Sent"
          value={formatNumber(summary.sent)}
          icon={CheckCheck}
          loading={loading}
        />

        <MetricCard
          title="Delivery Rate"
          value={formatPercentage(
            summary.deliveryRate
          )}
          icon={CheckCheck}
          loading={loading}
        />

        <MetricCard
          title="Open Rate"
          value={formatPercentage(
            summary.openRate
          )}
          icon={Eye}
          loading={loading}
        />

        <MetricCard
          title="Response Rate"
          value={formatPercentage(
            summary.responseRate
          )}
          icon={MessageSquareReply}
          loading={loading}
        />
      </div>
    </section>
  );
}