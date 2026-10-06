function displayValue(value, fallback = "Not supplied") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function ValidationState({ state }) {
  if (!state) {
    return null;
  }

  const label =
    typeof state === "string"
      ? state
      : state?.label || state?.status || "Validation state supplied";
  const detail =
    typeof state === "string" ? "" : state?.detail || state?.reason || "";

  return (
    <div className="mt-2 rounded-lg border border-black/10 bg-stone-50 p-2.5">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-600">
        {label}
      </p>
      {detail ? (
        <p className="mt-1 text-xs leading-5 text-stone-600">{detail}</p>
      ) : null}
    </div>
  );
}

export default function TenantIdentityLocaleSummary({ identity }) {
  const fields = [
    ["Business name", identity?.businessName],
    ["Business slug", identity?.slug],
    ["Initial status", identity?.status],
    ["Locale", identity?.locale],
    ["Timezone", identity?.timezone],
    ["Currency", identity?.currency],
    [
      "First owner / administrator",
      identity?.ownerLabel || identity?.ownerEmail || identity?.ownerReference,
    ],
  ];

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
      aria-labelledby="tenant-identity-locale-title"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
        Tenant configuration
      </p>
      <h2
        id="tenant-identity-locale-title"
        className="mt-1 text-lg font-bold text-black"
      >
        Business identity and locale
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
        These values are presentation inputs. Uniqueness, account binding and
        tenant identity remain subject to authoritative server validation.
      </p>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-black/10 bg-stone-50 p-3"
          >
            <dt className="text-xs font-bold uppercase tracking-wide text-stone-600">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-bold text-black">
              {displayValue(value)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <section aria-label="Business slug validation">
          <h3 className="text-sm font-bold text-black">
            Business slug validation
          </h3>
          <ValidationState state={identity?.validation?.slug} />
          {!identity?.validation?.slug ? (
            <p className="mt-2 text-xs leading-5 text-stone-600">
              No authoritative slug validation state was supplied.
            </p>
          ) : null}
        </section>

        <section aria-label="Owner binding validation">
          <h3 className="text-sm font-bold text-black">
            Owner binding validation
          </h3>
          <ValidationState state={identity?.validation?.owner} />
          {!identity?.validation?.owner ? (
            <p className="mt-2 text-xs leading-5 text-stone-600">
              No authoritative owner-binding state was supplied.
            </p>
          ) : null}
        </section>
      </div>
    </section>
  );
}
