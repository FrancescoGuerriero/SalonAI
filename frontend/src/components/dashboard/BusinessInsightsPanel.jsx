import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle,
  Lightbulb,
  Scissors,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

import Card from "../ui/Card";

const toneConfig = {
  positive: {
    icon: ArrowUpRight,
    iconClass: "text-green-600",
    iconBackgroundClass: "bg-green-100",
    badgeClass: "bg-green-100 text-green-700",
    borderClass: "border-green-200",
  },

  negative: {
    icon: ArrowDownRight,
    iconClass: "text-red-600",
    iconBackgroundClass: "bg-red-100",
    badgeClass: "bg-red-100 text-red-700",
    borderClass: "border-red-200",
  },

  neutral: {
    icon: ArrowRight,
    iconClass: "text-yellow-600",
    iconBackgroundClass: "bg-yellow-100",
    badgeClass: "bg-yellow-100 text-yellow-700",
    borderClass: "border-yellow-200",
  },
};

const categoryConfig = {
  revenue: {
    icon: TrendingUp,
    label: "Revenue",
  },

  appointments: {
    icon: CalendarDays,
    label: "Appointments",
  },

  customers: {
    icon: Users,
    label: "Customers",
  },

  operations: {
    icon: CheckCircle,
    label: "Operations",
  },

  services: {
    icon: Scissors,
    label: "Services",
  },

  stylists: {
    icon: Sparkles,
    label: "Stylists",
  },
};

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-GB");

function formatValue(insight) {
  const value = Number(insight?.value);

  if (!Number.isFinite(value)) {
    return null;
  }

  if (insight.unit === "percent") {
    return `${value}%`;
  }

  if (
    insight.category === "revenue" ||
    insight.category === "services" ||
    insight.category === "stylists"
  ) {
    return currencyFormatter.format(value);
  }

  return numberFormatter.format(value);
}

function formatChange(changePercentage) {
  const value = Number(changePercentage);

  if (!Number.isFinite(value)) {
    return null;
  }

  if (value > 0) {
    return `+${value}%`;
  }

  return `${value}%`;
}

function InsightCard({ insight }) {
  const tone =
    toneConfig[insight.tone] ?? toneConfig.neutral;

  const category =
    categoryConfig[insight.category] ?? {
      icon: Lightbulb,
      label: "Insight",
    };

  const ToneIcon = tone.icon;
  const CategoryIcon = category.icon;

  const formattedValue = formatValue(insight);
  const formattedChange = formatChange(
    insight.changePercentage
  );

  return (
    <article
      className={`rounded-xl border bg-white p-5 ${tone.borderClass}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.iconBackgroundClass}`}
        >
          <CategoryIcon
            size={21}
            className={tone.iconClass}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone.badgeClass}`}
              >
                {category.label}
              </span>

              <h3 className="mt-2 font-semibold text-gray-900">
                {insight.title}
              </h3>
            </div>

            {formattedChange ? (
              <div
                className={`flex items-center gap-1 text-sm font-semibold ${tone.iconClass}`}
              >
                <ToneIcon size={17} />
                <span>{formattedChange}</span>
              </div>
            ) : null}
          </div>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            {insight.message}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            {formattedValue ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Current value
                </p>

                <p className="mt-1 text-lg font-bold text-gray-900">
                  {formattedValue}
                </p>
              </div>
            ) : null}

            {Number.isFinite(
              Number(insight.previousValue)
            ) ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Previous
                </p>

                <p className="mt-1 text-lg font-semibold text-gray-600">
                  {insight.category === "revenue"
                    ? currencyFormatter.format(
                        Number(insight.previousValue)
                      )
                    : numberFormatter.format(
                        Number(insight.previousValue)
                      )}
                </p>
              </div>
            ) : null}

            {Number.isFinite(
              Number(insight.appointments)
            ) ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Appointments
                </p>

                <p className="mt-1 text-lg font-semibold text-gray-600">
                  {numberFormatter.format(
                    Number(insight.appointments)
                  )}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function InsightsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-48 animate-pulse rounded-xl bg-gray-100"
        />
      ))}
    </div>
  );
}

export default function BusinessInsightsPanel({
  insights = [],
  loading = false,
  error = "",
  days = 30,
}) {
  const normalizedInsights = Array.isArray(insights)
    ? insights.filter(
        (insight) =>
          insight &&
          typeof insight === "object" &&
          insight.id
      )
    : [];

  return (
    <Card
      title="Business Insights"
      subtitle={`Performance analysis for the last ${days} days`}
      actions={
        <div className="flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 text-sm font-semibold text-purple-700">
          <Sparkles size={16} />
          SalonAI Insights
        </div>
      }
    >
      {loading ? (
        <InsightsSkeleton />
      ) : error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle
            className="mt-0.5 shrink-0 text-red-600"
            size={20}
          />

          <div>
            <p className="font-semibold text-red-800">
              Insights unavailable
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
          </div>
        </div>
      ) : normalizedInsights.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
            <Lightbulb
              className="text-purple-600"
              size={24}
            />
          </div>

          <h3 className="mt-4 font-semibold text-gray-900">
            No insights available yet
          </h3>

          <p className="mt-2 max-w-md text-sm text-gray-500">
            SalonAI needs appointment and payment data before it
            can generate useful business insights.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {normalizedInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
            />
          ))}
        </div>
      )}
    </Card>
  );
}