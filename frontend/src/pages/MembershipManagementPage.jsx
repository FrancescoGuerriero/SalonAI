import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgePoundSterling,
  CircleAlert,
  LoaderCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
} from "lucide-react";

import customerSegmentationService from "../Services/customerSegmentationService.js";
import membershipService from "../Services/membershipService.js";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";

const EMPTY_PLAN = Object.freeze({
  name: "",
  key: "",
  price: "",
  currency: "GBP",
  billingFrequency: "monthly",
  billingIntervalCount: "1",
  status: "active",
  freezeAllowed: false,
  freezeDays: "30",
});

const EMPTY_CONTRACT = Object.freeze({
  customer: "",
  plan: "",
  status: "active",
  startsAt: "",
});

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function idOf(value) {
  return String(value?._id || value?.id || value || "");
}

function customerName(customer) {
  return (
    customer?.preferredName ||
    customer?.fullName ||
    customer?.name ||
    [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
    customer?.email ||
    "Customer"
  );
}

function money(value, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
  }).format(Number(value || 0));
}

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB");
}

function statusClasses(status) {
  if (["active", "paid"].includes(status)) {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (["past_due", "failed", "cancelled", "expired"].includes(status)) {
    return "border-red-300 bg-red-50 text-red-900";
  }
  return "border-amber-300 bg-amber-50 text-black";
}

export default function MembershipManagementPage() {
  const { user } = useAuth();
  const canRead = hasPermission(user, "customer:read");
  const canManage = hasPermission(user, "customer:update");
  const [plans, setPlans] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [planForm, setPlanForm] = useState({ ...EMPTY_PLAN });
  const [contractForm, setContractForm] = useState({ ...EMPTY_CONTRACT });
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [benefits, setBenefits] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [planPayload, contractPayload] = await Promise.all([
        membershipService.getMembershipPlans(),
        membershipService.getMembershipContracts(),
      ]);
      setPlans(Array.isArray(planPayload?.items) ? planPayload.items : []);
      setContracts(Array.isArray(contractPayload?.items) ? contractPayload.items : []);
    } catch (requestError) {
      setError(errorMessage(requestError, "Memberships could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canRead) load();
    else setLoading(false);
  }, [canRead, load]);

  const activePlans = useMemo(
    () => plans.filter((plan) => plan.status !== "retired"),
    [plans]
  );

  async function searchCustomers(event) {
    event?.preventDefault();
    setCustomerLoading(true);
    setError("");
    try {
      const payload = await customerSegmentationService.getCustomers({
        segment: "all",
        search: customerQuery,
        page: 1,
        limit: 30,
        sortBy: "createdAt",
        sortDirection: "desc",
      });
      const rows = payload?.customers || payload?.items || payload?.results || [];
      setCustomers(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(errorMessage(requestError, "Customers could not be searched."));
    } finally {
      setCustomerLoading(false);
    }
  }

  async function createPlan(event) {
    event.preventDefault();
    if (!canManage) return;
    setBusy("create-plan");
    setError("");
    setNotice("");
    try {
      await membershipService.createMembershipPlan({
        name: planForm.name,
        key: planForm.key || undefined,
        price: Number(planForm.price),
        currency: planForm.currency,
        billingFrequency: planForm.billingFrequency,
        billingIntervalCount: Number(planForm.billingIntervalCount),
        status: planForm.status,
        freezePolicy: {
          allowed: Boolean(planForm.freezeAllowed),
          maxDaysPerYear: planForm.freezeAllowed ? Number(planForm.freezeDays || 0) : 0,
        },
      });
      setPlanForm({ ...EMPTY_PLAN });
      setNotice("Membership plan created for the active business.");
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, "Membership plan could not be created."));
    } finally {
      setBusy("");
    }
  }

  async function setPlanStatus(plan, status) {
    if (!canManage) return;
    const id = idOf(plan);
    setBusy(`plan:${id}`);
    setError("");
    setNotice("");
    try {
      await membershipService.updateMembershipPlan(id, { status });
      setNotice(`${plan.name} is now ${status}.`);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, "Membership plan could not be updated."));
    } finally {
      setBusy("");
    }
  }

  async function createContract(event) {
    event.preventDefault();
    if (!canManage) return;
    setBusy("create-contract");
    setError("");
    setNotice("");
    try {
      await membershipService.createMembershipContract({
        customer: contractForm.customer,
        plan: contractForm.plan,
        status: contractForm.status,
        startsAt: contractForm.startsAt || undefined,
      });
      setContractForm({ ...EMPTY_CONTRACT });
      setNotice("Customer membership created for the active business.");
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, "Customer membership could not be created."));
    } finally {
      setBusy("");
    }
  }

  async function freezeContract(contract) {
    if (!canManage) return;
    const id = idOf(contract);
    const resumesAt = window.prompt(
      "Optional automatic resume date (YYYY-MM-DD). Leave blank to freeze without a scheduled resume.",
      ""
    );
    if (resumesAt === null) return;
    setBusy(`contract:${id}`);
    setError("");
    setNotice("");
    try {
      await membershipService.freezeMembershipContract(id, resumesAt ? { resumesAt } : {});
      setNotice("Membership frozen using the plan's governed freeze policy.");
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, "Membership could not be frozen."));
    } finally {
      setBusy("");
    }
  }

  async function resumeContract(contract) {
    if (!canManage) return;
    const id = idOf(contract);
    setBusy(`contract:${id}`);
    setError("");
    setNotice("");
    try {
      await membershipService.resumeMembershipContract(id);
      setNotice("Membership resumed.");
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, "Membership could not be resumed."));
    } finally {
      setBusy("");
    }
  }

  async function recordCollection(contract, status) {
    if (!canManage) return;
    const id = idOf(contract);
    const plan = contract.plan || {};
    setBusy(`contract:${id}`);
    setError("");
    setNotice("");
    try {
      await membershipService.recordMembershipCollection(id, {
        status,
        amount: Number(plan.price || 0),
        provider: contract.paymentProvider || "manual",
      });
      setNotice(
        status === "succeeded"
          ? "Successful membership collection recorded and benefits refreshed."
          : "Failed collection recorded; retry state has been recalculated."
      );
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, "Membership collection could not be recorded."));
    } finally {
      setBusy("");
    }
  }

  async function loadBenefits(contract) {
    const id = idOf(contract);
    setBusy(`benefits:${id}`);
    setError("");
    try {
      const payload = await membershipService.getMembershipBenefits(id);
      setBenefits((current) => ({
        ...current,
        [id]: Array.isArray(payload?.items) ? payload.items : [],
      }));
    } catch (requestError) {
      setError(errorMessage(requestError, "Membership benefits could not be loaded."));
    } finally {
      setBusy("");
    }
  }

  if (!canRead) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-8" id="main-content" tabIndex="-1">
        <div className="mx-auto max-w-4xl rounded-2xl border border-amber-300 bg-amber-50 p-5 text-black" role="alert">
          You do not have permission to read customer memberships.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 sm:px-6 lg:px-8" id="main-content" tabIndex="-1">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-600">
                <UsersRound className="text-amber-600" size={18} /> Commerce · Memberships
              </div>
              <h1 className="mt-2 text-3xl font-bold text-black">Membership management</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
                Operate membership plans and customer contracts using the existing tenant-scoped Membership domain. Collections update canonical membership state and benefit ledgers; this workspace does not bypass payment-provider or stored-value governance.
              </p>
            </div>
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/10 bg-stone-100 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-100 disabled:opacity-50"
              disabled={loading}
              onClick={() => { setLoading(true); load(); }}
              type="button"
            >
              <RefreshCw size={17} /> Refresh
            </button>
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <CircleAlert className="mt-0.5 shrink-0" size={17} /> {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{notice}</div>
        ) : null}

        {canManage ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <form className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm" onSubmit={createPlan}>
              <div className="flex items-center gap-2">
                <Plus className="text-amber-600" size={20} />
                <h2 className="text-xl font-bold text-black">Create membership plan</h2>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-black">Plan name
                  <input className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2.5 font-normal" required value={planForm.name} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label className="text-sm font-semibold text-black">Key (optional)
                  <input className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2.5 font-normal" value={planForm.key} onChange={(event) => setPlanForm((current) => ({ ...current, key: event.target.value }))} />
                </label>
                <label className="text-sm font-semibold text-black">Price
                  <input className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2.5 font-normal" min="0" required step="0.01" type="number" value={planForm.price} onChange={(event) => setPlanForm((current) => ({ ...current, price: event.target.value }))} />
                </label>
                <label className="text-sm font-semibold text-black">Currency
                  <input className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2.5 font-normal uppercase" maxLength="3" required value={planForm.currency} onChange={(event) => setPlanForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
                </label>
                <label className="text-sm font-semibold text-black">Billing frequency
                  <select className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5 font-normal" value={planForm.billingFrequency} onChange={(event) => setPlanForm((current) => ({ ...current, billingFrequency: event.target.value }))}>
                    <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="custom">Custom</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-black">Billing interval
                  <input className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2.5 font-normal" min="1" required type="number" value={planForm.billingIntervalCount} onChange={(event) => setPlanForm((current) => ({ ...current, billingIntervalCount: event.target.value }))} />
                </label>
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-black">
                <input checked={planForm.freezeAllowed} onChange={(event) => setPlanForm((current) => ({ ...current, freezeAllowed: event.target.checked }))} type="checkbox" /> Allow membership freezing
              </label>
              {planForm.freezeAllowed ? (
                <label className="mt-3 block max-w-xs text-sm font-semibold text-black">Maximum freeze days/year
                  <input className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2.5 font-normal" min="0" type="number" value={planForm.freezeDays} onChange={(event) => setPlanForm((current) => ({ ...current, freezeDays: event.target.value }))} />
                </label>
              ) : null}
              <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50" disabled={busy === "create-plan"} type="submit">
                {busy === "create-plan" ? <LoaderCircle className="animate-spin" size={17} /> : <Plus size={17} />} Create plan
              </button>
            </form>

            <form className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm" onSubmit={createContract}>
              <div className="flex items-center gap-2">
                <UsersRound className="text-amber-600" size={20} />
                <h2 className="text-xl font-bold text-black">Create customer membership</h2>
              </div>
              <div className="mt-4 flex gap-2">
                <label className="relative block flex-1">
                  <Search className="pointer-events-none absolute left-3 top-3 text-stone-500" size={17} />
                  <span className="sr-only">Search customers</span>
                  <input className="w-full rounded-xl border border-black/15 py-2.5 pl-10 pr-3" placeholder="Search customer name, email or phone" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} />
                </label>
                <button className="rounded-xl border border-black/10 bg-stone-100 px-4 py-2 text-sm font-semibold hover:bg-amber-100" disabled={customerLoading} onClick={searchCustomers} type="button">
                  {customerLoading ? "Searching…" : "Search"}
                </button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-black">Customer
                  <select className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5 font-normal" required value={contractForm.customer} onChange={(event) => setContractForm((current) => ({ ...current, customer: event.target.value }))}>
                    <option value="">Select customer</option>
                    {customers.map((customer) => <option key={idOf(customer)} value={idOf(customer)}>{customerName(customer)}{customer.email ? ` · ${customer.email}` : ""}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-black">Membership plan
                  <select className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5 font-normal" required value={contractForm.plan} onChange={(event) => setContractForm((current) => ({ ...current, plan: event.target.value }))}>
                    <option value="">Select plan</option>
                    {activePlans.map((plan) => <option key={idOf(plan)} value={idOf(plan)}>{plan.name} · {money(plan.price, plan.currency)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-black">Status
                  <select className="mt-1 w-full rounded-xl border border-black/15 bg-white px-3 py-2.5 font-normal" value={contractForm.status} onChange={(event) => setContractForm((current) => ({ ...current, status: event.target.value }))}>
                    <option value="active">Active</option><option value="trial">Trial</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-black">Start date
                  <input className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2.5 font-normal" type="date" value={contractForm.startsAt} onChange={(event) => setContractForm((current) => ({ ...current, startsAt: event.target.value }))} />
                </label>
              </div>
              <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50" disabled={busy === "create-contract" || !activePlans.length} type="submit">
                {busy === "create-contract" ? <LoaderCircle className="animate-spin" size={17} /> : <Plus size={17} />} Create membership
              </button>
            </form>
          </div>
        ) : null}

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold text-black">Plans</h2><p className="mt-1 text-sm text-stone-600">{plans.length} plan{plans.length === 1 ? "" : "s"} for the active business.</p></div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <article className="rounded-xl border border-black/10 bg-stone-50 p-4" key={idOf(plan)}>
                <div className="flex items-start justify-between gap-2">
                  <div><h3 className="font-bold text-black">{plan.name}</h3><p className="mt-1 text-sm text-stone-600">{money(plan.price, plan.currency)} · {plan.billingFrequency}</p></div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(plan.status)}`}>{plan.status}</span>
                </div>
                <p className="mt-3 text-xs text-stone-500">{plan.freezePolicy?.allowed ? `Freeze up to ${plan.freezePolicy.maxDaysPerYear || 0} days/year` : "Freezing disabled"}</p>
                {canManage ? <div className="mt-3 flex gap-2">
                  {plan.status !== "active" ? <button className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold" disabled={busy === `plan:${idOf(plan)}`} onClick={() => setPlanStatus(plan, "active")} type="button">Activate</button> : null}
                  {plan.status !== "retired" ? <button className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold" disabled={busy === `plan:${idOf(plan)}`} onClick={() => setPlanStatus(plan, "retired")} type="button">Retire</button> : null}
                </div> : null}
              </article>
            ))}
          </div>
          {!plans.length && !loading ? <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">No membership plans exist yet.</p> : null}
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><BadgePoundSterling className="text-amber-600" size={20} /><h2 className="text-xl font-bold text-black">Customer memberships</h2></div>
          <div className="mt-4 space-y-4">
            {contracts.map((contract) => {
              const id = idOf(contract);
              const plan = contract.plan || {};
              const customer = contract.customer || {};
              const contractBusy = busy === `contract:${id}`;
              return (
                <article className="rounded-2xl border border-black/10 bg-stone-50 p-5" key={id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="font-bold text-black">{customerName(customer)}</h3><p className="mt-1 text-sm text-stone-600">{plan.name || "Membership"} · {money(plan.price, plan.currency)}</p></div>
                    <div className="flex gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(contract.status)}`}>{contract.status}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(contract.collectionStatus)}`}>collection: {contract.collectionStatus}</span></div>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div><dt className="font-semibold text-stone-700">Started</dt><dd className="mt-1 text-stone-600">{dateLabel(contract.startsAt)}</dd></div>
                    <div><dt className="font-semibold text-stone-700">Renews / collects</dt><dd className="mt-1 text-stone-600">{dateLabel(contract.nextCollectionAt || contract.renewsAt)}</dd></div>
                    <div><dt className="font-semibold text-stone-700">Provider</dt><dd className="mt-1 text-stone-600">{contract.paymentProvider || "Not linked"}</dd></div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100" disabled={busy === `benefits:${id}`} onClick={() => loadBenefits(contract)} type="button">Benefits</button>
                    {canManage && ["active", "trial", "past_due"].includes(contract.status) && plan.freezePolicy?.allowed ? <button className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100" disabled={contractBusy} onClick={() => freezeContract(contract)} type="button"><PauseCircle size={14} /> Freeze</button> : null}
                    {canManage && contract.status === "frozen" ? <button className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100" disabled={contractBusy} onClick={() => resumeContract(contract)} type="button"><PlayCircle size={14} /> Resume</button> : null}
                    {canManage && !["cancelled", "expired"].includes(contract.status) ? <><button className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900" disabled={contractBusy} onClick={() => recordCollection(contract, "succeeded")} type="button">Record paid</button><button className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900" disabled={contractBusy} onClick={() => recordCollection(contract, "failed")} type="button">Record failed</button></> : null}
                  </div>
                  {benefits[id] ? <div className="mt-4 rounded-xl border border-black/10 bg-white p-3"><div className="text-xs font-bold uppercase tracking-wide text-stone-500">Benefit balances</div>{benefits[id].length ? <ul className="mt-2 space-y-1 text-sm text-stone-700">{benefits[id].map((benefit, index) => <li key={benefit.key || benefit.instrument || index}>{benefit.key || "Benefit"}: {benefit.balance ?? benefit.availableBalance ?? benefit.amount ?? "—"} {benefit.unit || ""}</li>)}</ul> : <p className="mt-2 text-sm text-stone-600">No benefit balances are currently issued.</p>}</div> : null}
                </article>
              );
            })}
          </div>
          {!contracts.length && !loading ? <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">No customer membership contracts exist yet.</p> : null}
        </section>
      </div>
    </main>
  );
}
