import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  PackageCheck,
  Percent,
  PoundSterling,
  RefreshCcw,
  Save,
  Search,
  ShoppingBag,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react";

import useAuth from "../hooks/useAuth.js";
import {
  assignRetailOrder,
  getStaffPerformance,
  saveStaffCompensationPlan,
} from "../Services/staffPerformanceService.js";

function formatCurrency(value, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatPercentage(value, empty = "0.0%") {
  if (value === null || value === undefined) {
    return empty;
  }

  return `${(Number(value) || 0).toFixed(1)}%`;
}

function formatHours(value) {
  return `${(Number(value) || 0).toFixed(1)}h`;
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(date);
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Unable to load staff performance."
  );
}

function SummaryCard({ title, value, description, icon: Icon, loading }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{title}</p>

          {loading ? (
            <div className="mt-3 h-9 w-28 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-2 truncate text-3xl font-bold text-slate-900">
              {value}
            </p>
          )}

          <p className="mt-2 text-xs leading-5 text-slate-400">
            {description}
          </p>
        </div>

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={21} />
        </span>
      </div>
    </article>
  );
}

function ProgressBar({ value, label, targetLabel }) {
  const hasTarget = value !== null && value !== undefined;
  const numericValue = hasTarget ? Number(value) || 0 : 0;
  const width = Math.min(100, Math.max(0, numericValue));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">
          {hasTarget ? formatPercentage(numericValue) : "No target"}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>

      {targetLabel && (
        <p className="mt-1 text-[11px] text-slate-400">{targetLabel}</p>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "default" }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : "text-slate-900";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={`text-sm font-semibold ${toneClass}`}>{value}</dd>
    </div>
  );
}

function MonthlyPerformanceChart({ staff, currency }) {
  const monthly = staff?.monthly || [];
  const maximumRevenue = Math.max(
    ...monthly.map(
      (month) =>
        (Number(month.serviceRevenue) || 0) +
        (Number(month.retailRevenue) || 0)
    ),
    1
  );

  if (!monthly.length) {
    return (
      <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
        No monthly performance data is available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex h-80 min-w-[700px] items-end gap-4 border-b border-slate-200 px-3">
        {monthly.map((month) => {
          const revenue = Number(month.serviceRevenue) || 0;
          const retail = Number(month.retailRevenue) || 0;
          const total = revenue + retail;
          const height = total > 0 ? Math.max(6, (total / maximumRevenue) * 85) : 2;

          return (
            <div
              key={month.month}
              className="flex min-w-20 flex-1 flex-col items-center justify-end"
            >
              <p className="mb-2 text-center text-[11px] font-semibold text-slate-600">
                {formatCurrency(total, currency)}
              </p>

              <div
                style={{ height: `${height}%` }}
                title={`${month.label}: ${formatCurrency(total, currency)}`}
                className="flex w-full max-w-16 flex-col justify-end overflow-hidden rounded-t-xl bg-indigo-500"
              >
                {retail > 0 && (
                  <div
                    className="bg-emerald-400"
                    style={{ height: `${Math.max(8, (retail / total) * 100)}%` }}
                  />
                )}
              </div>

              <p className="mt-2 h-10 text-center text-xs font-medium text-slate-500">
                {month.label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
          Service revenue
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          Retail revenue
        </span>
      </div>
    </div>
  );
}

function emptyPlan(stylistId = "") {
  return {
    stylistId,
    active: true,
    serviceCommission: {
      enabled: false,
      basis: "earned",
      ratePercent: 0,
      tiers: [],
    },
    retailCommission: {
      enabled: false,
      basis: "subtotal",
      ratePercent: 0,
      tiers: [],
    },
    monthlyTargets: {
      serviceRevenue: 0,
      retailRevenue: 0,
      completedAppointments: 0,
      rebookingRate: 0,
      productivityRate: 0,
    },
    notes: "",
  };
}

function CommissionPlanEditor({ staff, canManage, saving, onSave }) {
  const [form, setForm] = useState(() => emptyPlan(staff?.stylistId));

  useEffect(() => {
    setForm(staff?.plan ? structuredClone(staff.plan) : emptyPlan(staff?.stylistId));
  }, [staff]);

  function updateRule(ruleName, key, value) {
    setForm((current) => ({
      ...current,
      [ruleName]: {
        ...current[ruleName],
        [key]: value,
      },
    }));
  }

  function updateTarget(key, value) {
    setForm((current) => ({
      ...current,
      monthlyTargets: {
        ...current.monthlyTargets,
        [key]: value,
      },
    }));
  }

  function addTier(ruleName) {
    setForm((current) => ({
      ...current,
      [ruleName]: {
        ...current[ruleName],
        tiers: [
          ...(current[ruleName]?.tiers || []),
          { threshold: 0, ratePercent: 0 },
        ],
      },
    }));
  }

  function updateTier(ruleName, index, key, value) {
    setForm((current) => ({
      ...current,
      [ruleName]: {
        ...current[ruleName],
        tiers: current[ruleName].tiers.map((tier, tierIndex) =>
          tierIndex === index ? { ...tier, [key]: value } : tier
        ),
      },
    }));
  }

  function removeTier(ruleName, index) {
    setForm((current) => ({
      ...current,
      [ruleName]: {
        ...current[ruleName],
        tiers: current[ruleName].tiers.filter(
          (_, tierIndex) => tierIndex !== index
        ),
      },
    }));
  }

  if (!staff) {
    return null;
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Commission plan and monthly targets
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Configure {staff.name}&apos;s service, retail and target rules.
          </p>
        </div>

        {!canManage && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Read-only
          </span>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {[
          {
            key: "serviceCommission",
            title: "Service commission",
            description: "Calculated from completed appointment revenue.",
            basisOptions: [
              ["earned", "Earned revenue"],
              ["collected", "Collected payments"],
            ],
          },
          {
            key: "retailCommission",
            title: "Retail commission",
            description: "Calculated from attributed paid product orders.",
            basisOptions: [
              ["subtotal", "Net product subtotal"],
              ["total", "Order total"],
            ],
          },
        ].map((configuration) => {
          const rule = form[configuration.key];

          return (
            <article
              key={configuration.key}
              className="rounded-2xl border border-slate-200 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-900">
                    {configuration.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {configuration.description}
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(rule.enabled)}
                    disabled={!canManage}
                    onChange={(event) =>
                      updateRule(
                        configuration.key,
                        "enabled",
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Enabled
                </label>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Base rate
                  </span>
                  <div className="relative mt-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={rule.ratePercent}
                      disabled={!canManage}
                      onChange={(event) =>
                        updateRule(
                          configuration.key,
                          "ratePercent",
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-9 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
                    />
                    <Percent
                      size={15}
                      className="absolute right-3 top-3 text-slate-400"
                    />
                  </div>
                </label>

                <label>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Calculation basis
                  </span>
                  <select
                    value={rule.basis}
                    disabled={!canManage}
                    onChange={(event) =>
                      updateRule(
                        configuration.key,
                        "basis",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
                  >
                    {configuration.basisOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Revenue tiers
                  </p>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => addTier(configuration.key)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Add tier
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {!rule.tiers?.length && (
                    <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
                      No tiers configured. The base rate applies to all revenue.
                    </p>
                  )}

                  {rule.tiers?.map((tier, index) => (
                    <div
                      key={`${configuration.key}-${index}`}
                      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                    >
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={tier.threshold}
                        disabled={!canManage}
                        aria-label="Revenue threshold"
                        placeholder="Revenue threshold"
                        onChange={(event) =>
                          updateTier(
                            configuration.key,
                            index,
                            "threshold",
                            event.target.value
                          )
                        }
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={tier.ratePercent}
                        disabled={!canManage}
                        aria-label="Tier percentage"
                        placeholder="Rate percentage"
                        onChange={(event) =>
                          updateTier(
                            configuration.key,
                            index,
                            "ratePercent",
                            event.target.value
                          )
                        }
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                      />
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => removeTier(configuration.key, index)}
                          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <article className="rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Target size={20} />
          </span>
          <div>
            <h3 className="font-bold text-slate-900">Monthly performance targets</h3>
            <p className="text-xs text-slate-500">
              Zero leaves that target unconfigured.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["serviceRevenue", "Service revenue", "£", "1"],
            ["retailRevenue", "Retail revenue", "£", "1"],
            ["completedAppointments", "Completed bookings", "", "1"],
            ["rebookingRate", "Rebooking rate", "%", "0.1"],
            ["productivityRate", "Productivity", "%", "0.1"],
          ].map(([key, label, suffix, step]) => (
            <label key={key}>
              <span className="text-xs font-semibold text-slate-600">{label}</span>
              <div className="relative mt-2">
                <input
                  type="number"
                  min="0"
                  step={step}
                  value={form.monthlyTargets[key]}
                  disabled={!canManage}
                  onChange={(event) => updateTarget(key, event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-8 text-sm disabled:bg-slate-50"
                />
                {suffix && (
                  <span className="absolute right-3 top-2.5 text-sm text-slate-400">
                    {suffix}
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>
      </article>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Plan notes</span>
        <textarea
          value={form.notes || ""}
          disabled={!canManage}
          rows={3}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
          placeholder="Optional payroll or target notes"
        />
      </label>

      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(form)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}
            Save plan
          </button>
        </div>
      )}
    </section>
  );
}

function RetailAttributionPanel({ orders, staff, canManage, assigning, onAssign }) {
  const [assignments, setAssignments] = useState({});

  if (!orders?.length) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={22} className="mt-0.5 text-emerald-600" />
          <div>
            <h2 className="font-bold text-emerald-900">
              All retail sales are attributed
            </h2>
            <p className="mt-1 text-sm text-emerald-700">
              There are no unassigned paid product orders in this reporting period.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-xl font-bold text-slate-900">
          Unassigned retail sales
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Assign paid product orders so retail commission is credited correctly.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Retail value</th>
              <th className="px-5 py-3">Stylist</th>
              <th className="px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => {
              const selectedStylist = assignments[order.orderId] || "";
              const isAssigning = assigning === order.orderId;

              return (
                <tr key={order.orderId}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">
                      {order.orderNumber}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {order.customerName}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(order.orderDate)}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {formatCurrency(order.retailRevenue)}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={selectedStylist}
                      disabled={!canManage || isAssigning}
                      onChange={(event) =>
                        setAssignments((current) => ({
                          ...current,
                          [order.orderId]: event.target.value,
                        }))
                      }
                      className="min-w-48 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
                    >
                      <option value="">Select stylist</option>
                      {staff.map((member) => (
                        <option key={member.stylistId} value={member.stylistId}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      disabled={!canManage || !selectedStylist || isAssigning}
                      onClick={() => onAssign(order.orderId, selectedStylist)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                    >
                      {isAssigning ? (
                        <LoaderCircle size={14} className="animate-spin" />
                      ) : (
                        <PackageCheck size={14} />
                      )}
                      Assign
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function StaffPerformancePage() {
  const { user } = useAuth();
  const canManage = ["admin", "manager"].includes(user?.role);

  const [months, setMonths] = useState(6);
  const [analytics, setAnalytics] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState("performance");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [assigningOrder, setAssigningOrder] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPerformance = useCallback(async (selectedMonths, initial = false) => {
    initial ? setLoading(true) : setRefreshing(true);
    setError("");

    try {
      const response = await getStaffPerformance({ months: selectedMonths });
      const result = response?.analytics || response?.data?.analytics || response;
      setAnalytics(result || null);

      const staffList = Array.isArray(result?.staff) ? result.staff : [];
      setSelectedStaffId((currentId) => {
        if (staffList.some((member) => member.stylistId === currentId)) {
          return currentId;
        }

        return staffList[0]?.stylistId || "";
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPerformance(6, true);
  }, [loadPerformance]);

  const staff = Array.isArray(analytics?.staff) ? analytics.staff : [];
  const summary = analytics?.summary || {};
  const currency = analytics?.currency || "GBP";
  const unassignedOrders = analytics?.retailOrders?.unassigned || [];

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return staff;
    }

    return staff.filter(
      (member) =>
        String(member.name || "").toLowerCase().includes(query) ||
        String(member.email || "").toLowerCase().includes(query)
    );
  }, [search, staff]);

  const selectedStaff =
    staff.find((member) => member.stylistId === selectedStaffId) ||
    staff[0] ||
    null;

  async function handleSavePlan(plan) {
    if (!selectedStaff) {
      return;
    }

    setSavingPlan(true);
    setError("");
    setNotice("");

    try {
      await saveStaffCompensationPlan(selectedStaff.stylistId, plan);
      setNotice(`${selectedStaff.name}'s commission plan was saved.`);
      await loadPerformance(months);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleAssignRetailOrder(orderId, stylistId) {
    setAssigningOrder(orderId);
    setError("");
    setNotice("");

    try {
      await assignRetailOrder(orderId, stylistId);
      setNotice("The retail sale was attributed successfully.");
      await loadPerformance(months);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setAssigningOrder("");
    }
  }

  return (
    <main className="space-y-7 p-6">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-violet-50 p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <UsersRound size={28} />
            </span>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Staff Performance and Commission
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Track service revenue, retail sales, productivity, rebooking,
                targets and estimated commission from one management report.
              </p>
              {analytics?.period?.label && (
                <p className="mt-2 text-xs font-medium text-indigo-700">
                  Reporting period: {analytics.period.label}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadPerformance(months)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh report
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-700">{notice}</p>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label>
            <span className="text-sm font-semibold text-slate-700">
              Reporting period
            </span>
            <select
              value={months}
              onChange={(event) => {
                const nextMonths = Number(event.target.value);
                setMonths(nextMonths);
                loadPerformance(nextMonths);
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value={1}>Current month</option>
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            {[
              ["performance", "Performance"],
              ["commission", "Commission setup"],
              ["retail", `Retail attribution (${unassignedOrders.length})`],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveView(value)}
                className={[
                  "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                  activeView === value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total revenue"
          value={formatCurrency(summary.totalRevenue, currency)}
          description={`${formatCurrency(summary.serviceRevenue, currency)} services + ${formatCurrency(summary.retailRevenue, currency)} retail`}
          icon={PoundSterling}
          loading={loading}
        />
        <SummaryCard
          title="Estimated commission"
          value={formatCurrency(summary.totalCommission, currency)}
          description={`${formatCurrency(summary.serviceCommission, currency)} service + ${formatCurrency(summary.retailCommission, currency)} retail`}
          icon={Award}
          loading={loading}
        />
        <SummaryCard
          title="Productivity"
          value={formatPercentage(summary.productivityRate)}
          description={`${formatHours(summary.productiveHours)} productive from ${formatHours(summary.scheduledHours)} scheduled`}
          icon={Gauge}
          loading={loading}
        />
        <SummaryCard
          title="Rebooking rate"
          value={formatPercentage(summary.rebookingRate)}
          description={
            summary.targetAttainment === null
              ? "Configure staff targets to measure attainment."
              : `${formatPercentage(summary.targetAttainment)} average target attainment`
          }
          icon={TrendingUp}
          loading={loading}
        />
      </section>

      {!loading && !staff.length && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <UserRound size={38} className="mx-auto text-slate-300" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            No staff performance data
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Add active stylists and appointments before generating this report.
          </p>
        </section>
      )}

      {staff.length > 0 && activeView === "performance" && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Staff scorecard
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select a staff member to inspect their detailed performance.
                </p>
              </div>

              <label className="relative block w-full lg:max-w-xs">
                <Search
                  size={17}
                  className="absolute left-3 top-3 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search staff"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Staff member</th>
                    <th className="px-5 py-3">Service revenue</th>
                    <th className="px-5 py-3">Retail sales</th>
                    <th className="px-5 py-3">Productivity</th>
                    <th className="px-5 py-3">Rebooking</th>
                    <th className="px-5 py-3">Commission</th>
                    <th className="px-5 py-3">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((member) => (
                    <tr
                      key={member.stylistId}
                      onClick={() => setSelectedStaffId(member.stylistId)}
                      className={[
                        "cursor-pointer transition hover:bg-slate-50",
                        selectedStaff?.stylistId === member.stylistId
                          ? "bg-indigo-50/60"
                          : "",
                      ].join(" ")}
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {member.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {member.completedAppointments} completed appointments
                        </p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {formatCurrency(member.serviceRevenue, currency)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-emerald-700">
                          {formatCurrency(member.retailRevenue, currency)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {member.retailOrderCount} attributed orders
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {formatPercentage(member.productivityRate)}
                      </td>
                      <td className="px-5 py-4">
                        {formatPercentage(member.rebookingRate)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-indigo-700">
                        {formatCurrency(member.commission.total, currency)}
                      </td>
                      <td className="px-5 py-4">
                        {member.targetProgress.overall === null ? (
                          <span className="text-xs text-slate-400">Not set</span>
                        ) : (
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                            {formatPercentage(member.targetProgress.overall)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selectedStaff && (
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,0.7fr)]">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {selectedStaff.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Monthly service and retail revenue
                    </p>
                  </div>
                  <BarChart3 size={22} className="text-indigo-600" />
                </div>

                <MonthlyPerformanceChart staff={selectedStaff} currency={currency} />
              </article>

              <div className="space-y-5">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">
                    Performance details
                  </h2>
                  <dl className="mt-3">
                    <Metric
                      label="Average service ticket"
                      value={formatCurrency(selectedStaff.averageTicket, currency)}
                    />
                    <Metric
                      label="Completion rate"
                      value={formatPercentage(selectedStaff.completionRate)}
                    />
                    <Metric
                      label="Scheduled hours"
                      value={formatHours(selectedStaff.scheduledHours)}
                    />
                    <Metric
                      label="Productive hours"
                      value={formatHours(selectedStaff.productiveHours)}
                    />
                    <Metric
                      label="Successful rebookings"
                      value={`${selectedStaff.successfulRebookings} of ${selectedStaff.eligibleRebookings}`}
                    />
                    <Metric
                      label="Unique customers"
                      value={selectedStaff.uniqueCustomers}
                    />
                  </dl>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">
                    Commission estimate
                  </h2>
                  <dl className="mt-3">
                    <Metric
                      label="Service commission"
                      value={formatCurrency(selectedStaff.commission.service, currency)}
                      tone="positive"
                    />
                    <Metric
                      label="Retail commission"
                      value={formatCurrency(selectedStaff.commission.retail, currency)}
                      tone="positive"
                    />
                    <Metric
                      label="Total commission"
                      value={formatCurrency(selectedStaff.commission.total, currency)}
                      tone="positive"
                    />
                  </dl>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Target size={18} className="text-indigo-600" />
                    <h2 className="text-lg font-bold text-slate-900">
                      Target progress
                    </h2>
                  </div>
                  <div className="mt-5 space-y-4">
                    <ProgressBar
                      label="Service revenue"
                      value={selectedStaff.targetProgress.serviceRevenue}
                      targetLabel={
                        selectedStaff.targetTotals.serviceRevenue > 0
                          ? `Target ${formatCurrency(selectedStaff.targetTotals.serviceRevenue, currency)}`
                          : ""
                      }
                    />
                    <ProgressBar
                      label="Retail revenue"
                      value={selectedStaff.targetProgress.retailRevenue}
                      targetLabel={
                        selectedStaff.targetTotals.retailRevenue > 0
                          ? `Target ${formatCurrency(selectedStaff.targetTotals.retailRevenue, currency)}`
                          : ""
                      }
                    />
                    <ProgressBar
                      label="Completed appointments"
                      value={selectedStaff.targetProgress.completedAppointments}
                    />
                    <ProgressBar
                      label="Rebooking rate"
                      value={selectedStaff.targetProgress.rebookingRate}
                    />
                    <ProgressBar
                      label="Productivity"
                      value={selectedStaff.targetProgress.productivityRate}
                    />
                  </div>
                </article>
              </div>
            </section>
          )}
        </>
      )}

      {staff.length > 0 && activeView === "commission" && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label>
              <span className="text-sm font-semibold text-slate-700">
                Staff member
              </span>
              <select
                value={selectedStaff?.stylistId || ""}
                onChange={(event) => setSelectedStaffId(event.target.value)}
                className="mt-2 w-full max-w-xl rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                {staff.map((member) => (
                  <option key={member.stylistId} value={member.stylistId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <CommissionPlanEditor
            staff={selectedStaff}
            canManage={canManage}
            saving={savingPlan}
            onSave={handleSavePlan}
          />
        </div>
      )}

      {activeView === "retail" && (
        <RetailAttributionPanel
          orders={unassignedOrders}
          staff={staff}
          canManage={canManage}
          assigning={assigningOrder}
          onAssign={handleAssignRetailOrder}
        />
      )}

      <footer className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Commission figures are estimates generated from configured rules. Confirm
        final payroll amounts against employment contracts and approved adjustments.
      </footer>
    </main>
  );
}
