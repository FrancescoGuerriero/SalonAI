import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ImageOff,
  Layers3,
  RefreshCw,
  Search,
  Scissors,
  WalletCards,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import API from "../api/axios.js";

function extractServices(responseData) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (Array.isArray(responseData?.services)) {
    return responseData.services;
  }

  if (Array.isArray(responseData?.data)) {
    return responseData.data;
  }

  if (
    Array.isArray(
      responseData?.data?.services
    )
  ) {
    return responseData.data.services;
  }

  return [];
}

function getServiceName(service) {
  return (
    String(
      service?.name ||
        service?.title ||
        ""
    ).trim() || "Unnamed service"
  );
}

function getCategory(service) {
  return (
    String(
      service?.category || ""
    ).trim() || "Uncategorised"
  );
}

function getPrice(service) {
  return Number(service?.price || 0);
}

function getDuration(service) {
  return Number(service?.duration || 0);
}

function isServiceActive(service) {
  return service?.active !== false;
}

function formatCurrency(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "£0.00";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function formatDuration(value) {
  const minutes = Number(value);

  if (
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    return "Not set";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes =
    minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

function SummaryCard({
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

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

function ServiceImage({ service }) {
  const [imageFailed, setImageFailed] =
    useState(false);

  if (
    !service.image ||
    imageFailed
  ) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <ImageOff size={20} />
      </div>
    );
  }

  return (
    <img
      src={service.image}
      alt={getServiceName(service)}
      onError={() =>
        setImageFailed(true)
      }
      className="h-12 w-12 shrink-0 rounded-xl object-cover"
    />
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active
            ? "bg-emerald-500"
            : "bg-slate-400"
        }`}
      />

      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ServiceRow({ service }) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80">
      <td className="px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <ServiceImage
            service={service}
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {getServiceName(service)}
            </p>

            <p className="mt-0.5 max-w-sm truncate text-xs text-slate-500">
              {service.description ||
                "No description provided"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4 text-sm font-medium text-slate-700">
        {getCategory(service)}
      </td>

      <td className="px-5 py-4 text-sm font-bold text-slate-900">
        {formatCurrency(
          getPrice(service)
        )}
      </td>

      <td className="px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Clock3
            size={15}
            className="text-slate-400"
          />

          {formatDuration(
            getDuration(service)
          )}
        </div>
      </td>

      <td className="px-5 py-4">
        <StatusBadge
          active={isServiceActive(
            service
          )}
        />
      </td>
    </tr>
  );
}

function ServiceMobileCard({
  service,
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-40 bg-slate-100">
        {service.image ? (
          <img
            src={service.image}
            alt={getServiceName(service)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <div className="text-center">
              <ImageOff
                size={30}
                className="mx-auto"
              />

              <p className="mt-2 text-xs font-medium">
                No service image
              </p>
            </div>
          </div>
        )}

        <div className="absolute right-3 top-3">
          <StatusBadge
            active={isServiceActive(
              service
            )}
          />
        </div>
      </div>

      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
          {getCategory(service)}
        </p>

        <div className="mt-2 flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">
            {getServiceName(service)}
          </h2>

          <p className="shrink-0 text-base font-bold text-slate-900">
            {formatCurrency(
              getPrice(service)
            )}
          </p>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {service.description ||
            "No description has been provided for this service."}
        </p>

        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm font-medium text-slate-600">
          <Clock3
            size={16}
            className="text-slate-400"
          />

          {formatDuration(
            getDuration(service)
          )}
        </div>
      </div>
    </article>
  );
}

export default function ServicesPage() {
  const [services, setServices] =
    useState([]);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState("all");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState("all");

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadServices =
    useCallback(async () => {
      setIsLoading(true);
      setError("");

      try {
        const response =
          await API.get("/services");

        setServices(
          extractServices(response.data)
        );
      } catch (requestError) {
        setServices([]);

        setError(
          requestError.response?.data
            ?.message ||
            requestError.message ||
            "Unable to load salon services."
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const categories = useMemo(() => {
    const values = services
      .map(getCategory)
      .filter(Boolean);

    return [
      "all",
      ...Array.from(
        new Set(values)
      ).sort((first, second) =>
        first.localeCompare(second)
      ),
    ];
  }, [services]);

  const filteredServices =
    useMemo(() => {
      const query = searchTerm
        .trim()
        .toLowerCase();

      return services.filter(
        (service) => {
          const categoryMatches =
            selectedCategory ===
              "all" ||
            getCategory(service) ===
              selectedCategory;

          const statusMatches =
            selectedStatus === "all" ||
            (selectedStatus ===
              "active" &&
              isServiceActive(
                service
              )) ||
            (selectedStatus ===
              "inactive" &&
              !isServiceActive(
                service
              ));

          const textMatches =
            !query ||
            [
              getServiceName(service),
              getCategory(service),
              service.description,
              service._id,
              service.id,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(query)
            );

          return (
            categoryMatches &&
            statusMatches &&
            textMatches
          );
        }
      );
    }, [
      services,
      searchTerm,
      selectedCategory,
      selectedStatus,
    ]);

  const summary = useMemo(() => {
    return services.reduce(
      (totals, service) => {
        totals.total += 1;
        totals.totalPrice +=
          getPrice(service);
        totals.totalDuration +=
          getDuration(service);

        if (
          isServiceActive(service)
        ) {
          totals.active += 1;
        }

        return totals;
      },
      {
        total: 0,
        active: 0,
        totalPrice: 0,
        totalDuration: 0,
      }
    );
  }, [services]);

  const averagePrice =
    summary.total > 0
      ? summary.totalPrice /
        summary.total
      : 0;

  const averageDuration =
    summary.total > 0
      ? Math.round(
          summary.totalDuration /
            summary.total
        )
      : 0;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Scissors}
            label="Total services"
            value={summary.total}
            description="All catalogue services"
          />

          <SummaryCard
            icon={CheckCircle2}
            label="Active services"
            value={summary.active}
            description="Available for booking"
          />

          <SummaryCard
            icon={WalletCards}
            label="Average price"
            value={formatCurrency(
              averagePrice
            )}
            description="Average catalogue price"
          />

          <SummaryCard
            icon={Clock3}
            label="Average duration"
            value={formatDuration(
              averageDuration
            )}
            description="Average appointment time"
          />
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Service catalogue
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Review salon treatments,
                prices, duration and
                availability.
              </p>
            </div>

            <button
              type="button"
              onClick={loadServices}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={
                  isLoading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>
          </div>

          <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[1fr_220px_180px]">
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search services by name, category or description"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </div>

            <div className="relative">
              <Layers3
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <select
                value={selectedCategory}
                onChange={(event) =>
                  setSelectedCategory(
                    event.target.value
                  )
                }
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              >
                {categories.map(
                  (category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category === "all"
                        ? "All categories"
                        : category}
                    </option>
                  )
                )}
              </select>
            </div>

            <select
              value={selectedStatus}
              onChange={(event) =>
                setSelectedStatus(
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            >
              <option value="all">
                All statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>
          </div>

          {error && (
            <div className="m-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="font-semibold">
                  Services could not be
                  loaded
                </p>

                <p className="mt-1">
                  {error}
                </p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({
                length: 6,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : filteredServices.length >
            0 ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Service
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Category
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Price
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Duration
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredServices.map(
                      (service) => (
                        <ServiceRow
                          key={
                            service._id ||
                            service.id ||
                            `${service.name}-${service.category}`
                          }
                          service={
                            service
                          }
                        />
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 p-4 sm:grid-cols-2 md:hidden">
                {filteredServices.map(
                  (service) => (
                    <ServiceMobileCard
                      key={
                        service._id ||
                        service.id ||
                        `${service.name}-${service.category}`
                      }
                      service={
                        service
                      }
                    />
                  )
                )}
              </div>

              <div className="border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {
                    filteredServices.length
                  }
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {services.length}
                </span>{" "}
                services
              </div>
            </>
          ) : (
            <div className="px-6 py-16 text-center">
              <Scissors
                size={38}
                className="mx-auto text-slate-300"
              />

              <h3 className="mt-4 text-base font-bold text-slate-900">
                No services found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {searchTerm ||
                selectedCategory !== "all" ||
                selectedStatus !== "all"
                  ? "No services match the selected filters."
                  : "Salon services will appear here once they have been created."}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}