import { Building2, CircleAlert, Globe2, UserRoundCheck } from "lucide-react";

function valueOrFallback(value, fallback = "Not supplied") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export default function TenantIdentityLocaleSummary({ tenant }) {
  const businessName = valueOrFallback(tenant?.businessName);
  const slug = valueOrFallback(tenant?.slug);
  const locale = valueOrFallback(tenant?.locale);
  const timezone = valueOrFallback(tenant?.timezone);
  const currency = valueOrFallback(tenant?.currency);
  const ownerLabel = valueOrFallback(tenant?.ownerLabel || tenant?.ownerEmail, "No owner binding supplied");
  const status = valueOrFallback(tenant?.status, "review");

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm" aria-labelledby="tenant-identity-locale-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Tenant configuration</p><h2 id="tenant-identity-locale-title" className="mt-1 text-lg font-bold text-black">Identity and locale</h2></div>
        <span className="inline-flex min-h-7 items-center rounded-full border border-black/10 bg-stone-100 px-2.5 text-xs font-bold text-stone-700">{status}</span>
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-black/10 bg-stone-50 p-4"><dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-600"><Building2 size={15} aria-hidden="true" />Business</dt><dd className="mt-2 text-sm font-bold text-black">{businessName}</dd><dd className="mt-1 break-all text-xs text-stone-600">Slug: {slug}</dd></div>
        <div className="rounded-xl border border-black/10 bg-stone-50 p-4"><dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-600"><Globe2 size={15} aria-hidden="true" />Locale</dt><dd className="mt-2 text-sm font-bold text-black">{locale}</dd><dd className="mt-1 text-xs text-stone-600">Timezone: {timezone}</dd><dd className="mt-1 text-xs text-stone-600">Currency: {currency}</dd></div>
        <div className="rounded-xl border border-black/10 bg-stone-50 p-4 sm:col-span-2 lg:col-span-1"><dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-600"><UserRoundCheck size={15} aria-hidden="true" />First owner/admin</dt><dd className="mt-2 break-words text-sm font-bold text-black">{ownerLabel}</dd><dd className="mt-1 text-xs leading-5 text-stone-600">Binding is displayed for review only. Authority remains server-side.</dd></div>
      </dl>
      {tenant?.warning ? <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-black" role="status"><CircleAlert size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-800" /><span>{tenant.warning}</span></div> : null}
    </section>
  );
}
