import {
  Activity,
  BadgePoundSterling,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  getCampaignJourneyRevenue,
  getCustomer360,
  listCrmSegments,
  listJourneyEnrollments,
  reconcileMembershipRecoveryJourneys,
} from "../../Services/retentionAutomationService.js";

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "CRM operations could not be loaded."
  );
}

function money(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value) || 0);
}

function date(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(parsed);
}

function label(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function StatCard({ icon: Icon, title, value, detail }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Icon size={19} className="text-indigo-600" />
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </article>
  );
}

export default function Stage7CrmOperationsPanel() {
  const [segments, setSegments] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);
  const [customer360, setCustomer360] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [error, setError] = useState("");

  async function loadOperations() {
    setLoading(true);
    setError("");
    try {
      const [segmentRows, enrollmentRows, measurementRows] = await Promise.all([
        listCrmSegments({ limit: 100 }),
        listJourneyEnrollments({ limit: 100 }),
        getCampaignJourneyRevenue(),
      ]);
      setSegments(segmentRows);
      setEnrollments(enrollmentRows);
      setRevenueRows(measurementRows);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOperations();
  }, []);

  async function inspectCustomer(customerId) {
    setSelectedCustomerId(customerId);
    setCustomerLoading(true);
    setError("");
    try {
      setCustomer360(await getCustomer360(customerId));
    } catch (requestError) {
      setCustomer360(null);
      setError(errorMessage(requestError));
    } finally {
      setCustomerLoading(false);
    }
  }

  async function reconcileRecovery() {
    setReconciling(true);
    setError("");
    try {
      const result = await reconcileMembershipRecoveryJourneys({ limit: 100 });
      setReconcileResult(result);
      await loadOperations();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setReconciling(false);
    }
  }

  const totals = useMemo(() => {
    return revenueRows.reduce(
      (result, row) => ({
        revenue: result.revenue + Number(row.revenue || 0),
        spend: result.spend + Number(row.spend || 0),
        rebookings: result.rebookings + Number(row.rebookings || 0),
        recoveredMemberships:
          result.recoveredMemberships + Number(row.recoveredMemberships || 0),
      }),
      { revenue: 0, spend: 0, rebookings: 0, recoveredMemberships: 0 }
    );
  }, [revenueRows]);

  const activeEnrollmentCount = enrollments.filter((entry) =>
    ["pending", "active", "paused"].includes(entry.status)
  ).length;

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-100/60 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Stage 7 operations
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            CRM, lifecycle and retention evidence
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Inspect deterministic segments, Customer 360 evidence, journey enrolments,
            membership-recovery reconciliation and campaign-to-revenue results. These
            controls do not authorise customer messaging.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadOperations()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh CRM
          </button>
          <button
            type="button"
            onClick={() => void reconcileRecovery()}
            disabled={reconciling}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 disabled:opacity-50"
          >
            {reconciling ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
            Reconcile recovery evidence
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <div className="flex items-start gap-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <p>
            <strong>Governed mode:</strong> Customer 360 and recovery reconciliation are
            evidence-only. Journey execution remains unauthorised and no provider send,
            payment retry or card charge is performed here.
          </p>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      {reconcileResult ? (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm font-semibold text-indigo-800">
          <CheckCircle2 size={17} />
          Recovery evidence reconciled: {Number(reconcileResult.processed || 0)} processed, {Number(reconcileResult.enrolled || 0)} enrolled, {Number(reconcileResult.recovered || 0)} recovered.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={UsersRound} title="Customers inspected" value={segments.length} detail="Current CRM segment sample" />
        <StatCard icon={Activity} title="Open enrolments" value={activeEnrollmentCount} detail="Pending, active or paused" />
        <StatCard icon={BadgePoundSterling} title="Campaign revenue" value={money(totals.revenue)} detail={`Spend ${money(totals.spend)}`} />
        <StatCard icon={UserRoundSearch} title="Rebookings" value={totals.rebookings} detail="Recorded retention outcomes" />
        <StatCard icon={CircleDollarSign} title="Membership recoveries" value={totals.recoveredMemberships} detail="Canonical recovery outcomes" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">Lifecycle and deterministic segments</h3>
            <p className="mt-1 text-xs text-slate-500">
              Select a customer to inspect the unified Customer 360 projection.
            </p>
          </header>
          <div className="max-h-[430px] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Lifecycle</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Segments</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {segments.map((customer) => (
                  <tr key={customer.customerId} className={selectedCustomerId === String(customer.customerId) ? "bg-indigo-50/60" : "bg-white"}>
                    <td className="px-4 py-3">
                      <strong className="text-slate-900">{customer.name || customer.email || "Customer"}</strong>
                      <div className="mt-1 text-xs text-slate-500">Last visit {date(customer.lastVisit)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {label(customer.lifecycleState)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {money(customer.totalSpent)} · {customer.visits || 0} visits
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-sm flex-wrap gap-1">
                        {(customer.segments || []).slice(0, 5).map((segment) => (
                          <span key={segment} className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                            {label(segment)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void inspectCustomer(customer.customerId)}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700"
                      >
                        View 360
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!segments.length && !loading ? (
              <p className="p-8 text-center text-sm text-slate-500">No tenant-owned customers are available.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-bold text-slate-900">Customer 360</h3>
          {customerLoading ? (
            <div className="p-12 text-center"><Loader2 className="mx-auto animate-spin text-indigo-600" /></div>
          ) : customer360 ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-lg font-bold text-slate-900">
                  {customer360.customer?.preferredName || [customer360.customer?.firstName, customer360.customer?.lastName].filter(Boolean).join(" ") || "Customer"}
                </p>
                <p className="text-slate-500">{label(customer360.lifecycle?.state)} · {money(customer360.value?.totalSpent)} LTV</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Next best action</p>
                <p className="mt-1 font-bold text-slate-900">{label(customer360.intelligence?.nextBestAction?.action)}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{customer360.intelligence?.nextBestAction?.reason}</p>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-xs font-semibold text-slate-500">Appointments</dt><dd className="font-bold text-slate-900">{customer360.appointments?.count || 0}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Consultations</dt><dd className="font-bold text-slate-900">{customer360.consultations?.count || 0}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Communications</dt><dd className="font-bold text-slate-900">{customer360.communications?.count || 0}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Reviews</dt><dd className="font-bold text-slate-900">{customer360.reviews?.count || 0}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Gift cards</dt><dd className="font-bold text-slate-900">{customer360.giftCards?.count || 0}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Campaign touches</dt><dd className="font-bold text-slate-900">{customer360.attribution?.touchCount || 0}</dd></div>
              </dl>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Contactable channels</p>
                <p className="mt-1 font-semibold text-slate-700">
                  {(customer360.intelligence?.nextBestAction?.contactableChannels || []).map(label).join(", ") || "None currently verified"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent services</p>
                <div className="mt-2 space-y-2">
                  {(customer360.appointments?.serviceHistory || []).slice(0, 4).map((entry) => (
                    <div key={String(entry.appointmentId)} className="rounded-lg border border-slate-200 p-2">
                      <strong className="text-slate-800">{entry.service?.name || "Service"}</strong>
                      <p className="text-xs text-slate-500">{date(entry.occurredAt)} · {entry.stylist?.name || [entry.stylist?.firstName, entry.stylist?.lastName].filter(Boolean).join(" ") || "Stylist"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Select a customer from the CRM table to inspect their unified history and evidence.</p>
          )}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">Recent journey enrolments</h3>
          </header>
          <div className="max-h-80 overflow-auto divide-y divide-slate-100">
            {enrollments.slice(0, 25).map((entry) => (
              <article key={entry._id} className="p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-slate-900">{label(entry.trigger)}</strong>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{label(entry.status)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Outcome: {label(entry.outcome || "none")} · Created {date(entry.createdAt)}</p>
                <p className="mt-1 text-xs font-semibold text-amber-700">Execution authorised: No</p>
              </article>
            ))}
            {!enrollments.length && !loading ? <p className="p-8 text-center text-sm text-slate-500">No retention enrolments recorded.</p> : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 p-4">
            <h3 className="font-bold text-slate-900">Campaign-to-retention measurement</h3>
          </header>
          <div className="max-h-80 overflow-auto divide-y divide-slate-100">
            {revenueRows.map((row, index) => (
              <article key={row.campaignId || `unattributed-${index}`} className="p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-slate-900">{row.campaignId ? `Campaign ${String(row.campaignId).slice(-8)}` : "Unattributed retention"}</strong>
                  <span className="font-bold text-emerald-700">{money(row.revenue)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {row.retentionEnrollments || 0} enrolments · {row.rebookings || 0} rebookings · {row.purchases || 0} purchases · {row.recoveredMemberships || 0} membership recoveries
                </p>
              </article>
            ))}
            {!revenueRows.length && !loading ? <p className="p-8 text-center text-sm text-slate-500">No campaign/retention measurement rows yet.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
