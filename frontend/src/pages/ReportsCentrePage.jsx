import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  MessageSquareText,
  PoundSterling,
  RefreshCw,
  Send,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import reportApi from "../services/reportApi.js";

function localIsoDate(date) {
  const copy = new Date(date);

  copy.setMinutes(
    copy.getMinutes() -
      copy.getTimezoneOffset()
  );

  return copy
    .toISOString()
    .slice(0, 10);
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();

  start.setDate(
    start.getDate() - 30
  );

  return {
    startDate: localIsoDate(start),
    endDate: localIsoDate(end),
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(Number(value || 0));
}

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The report request failed."
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

const REPORT_EXPORTS = [
  {
    type: "appointments.csv",
    filename:
      "salonai-appointments.csv",
    title:
      "Appointment register",
    description:
      "Dates, customers, services, stylists, statuses and booking values.",
    icon: CalendarDays,
  },
  {
    type: "communications.csv",
    filename:
      "salonai-communications.csv",
    title:
      "Communication activity",
    description:
      "Customer contact history, delivery channels and communication statuses.",
    icon: MessageSquareText,
  },
  {
    type: "management.xlsx",
    filename:
      "salonai-management-report.xlsx",
    title:
      "Management workbook",
    description:
      "Excel workbook containing summary figures and appointment details.",
    icon: FileSpreadsheet,
  },
];

export default function ReportsCentrePage() {
  const [range, setRange] =
    useState(defaultDateRange);

  const [summary, setSummary] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    downloading,
    setDownloading,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const loadSummary =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const result =
          await reportApi.getSummary(
            range
          );

        setSummary(result);
      } catch (requestError) {
        setError(
          errorMessage(requestError)
        );
      } finally {
        setLoading(false);
      }
    }, [range]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  function updateRange(field, value) {
    setRange((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleDownload(
    report
  ) {
    setDownloading(report.type);
    setError("");
    setSuccess("");

    try {
      const response =
        await reportApi.download(
          report.type,
          range
        );

      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data]);

      const objectUrl =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement("a");

      link.href = objectUrl;
      link.download =
        report.filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(
        objectUrl
      );

      setSuccess(
        `${report.title} downloaded successfully.`
      );
    } catch (requestError) {
      setError(
        errorMessage(requestError)
      );
    } finally {
      setDownloading("");
    }
  }

  const generatedAt =
    summary?.generatedAt
      ? new Date(
          summary.generatedAt
        ).toLocaleString("en-GB")
      : "Not generated";

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Phase 3 reporting
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Management reporting centre
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Review salon activity and
            export authenticated
            operational reports.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSummary}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
          <label className="text-sm font-semibold text-slate-700">
            Period start

            <input
              type="date"
              value={
                range.startDate
              }
              onChange={(event) =>
                updateRange(
                  "startDate",
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Period end

            <input
              type="date"
              value={range.endDate}
              onChange={(event) =>
                updateRange(
                  "endDate",
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Last generated:{" "}
          {generatedAt}
        </p>
      </section>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm font-semibold text-slate-600">
          <LoaderCircle
            size={20}
            className="animate-spin"
          />

          Loading report summary…
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={UsersRound}
            label="Customers"
            value={
              summary?.customers || 0
            }
            description="Total customer records"
          />

          <MetricCard
            icon={CalendarDays}
            label="Appointments"
            value={
              summary?.appointments ||
              0
            }
            description="Bookings in the selected period"
          />

          <MetricCard
            icon={MessageSquareText}
            label="Contacts"
            value={
              summary?.contacts || 0
            }
            description="Logged customer communications"
          />

          <MetricCard
            icon={Send}
            label="Campaigns"
            value={
              summary?.campaigns || 0
            }
            description="Campaigns created in the period"
          />

          <MetricCard
            icon={PoundSterling}
            label="Revenue"
            value={formatCurrency(
              summary?.revenue
            )}
            description="Revenue from completed appointments"
          />
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Report exports
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Every export uses the
            selected date range and the
            logged-in management account.
          </p>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-3">
          {REPORT_EXPORTS.map(
            (report) => {
              const Icon =
                report.icon;

              const isDownloading =
                downloading ===
                report.type;

              return (
                <article
                  key={report.type}
                  className="rounded-xl border border-slate-200 p-5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Icon size={21} />
                  </span>

                  <h3 className="mt-4 font-bold text-slate-900">
                    {report.title}
                  </h3>

                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">
                    {
                      report.description
                    }
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownload(
                        report
                      )
                    }
                    disabled={Boolean(
                      downloading
                    )}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Download
                        size={16}
                      />
                    )}

                    {isDownloading
                      ? "Preparing…"
                      : "Download"}
                  </button>
                </article>
              );
            }
          )}
        </div>
      </section>
    </div>
  );
}