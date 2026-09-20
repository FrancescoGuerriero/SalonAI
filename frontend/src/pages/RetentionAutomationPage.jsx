import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UsersRound,
  Workflow,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createRetentionJourney,
  listRetentionJourneys,
  previewRetentionJourney,
  updateRetentionJourney,
} from "../Services/retentionAutomationService.js";

const TRIGGERS = [
  {
    value:
      "customer_inactive",
    label:
      "Customer becomes inactive",
  },
  {
    value:
      "appointment_completed",
    label:
      "Appointment completed",
  },
  {
    value:
      "customer_created",
    label:
      "Customer created",
  },
  {
    value:
      "loyalty_tier_changed",
    label:
      "Loyalty tier changed",
  },
  {
    value:
      "referral_rewarded",
    label:
      "Referral rewarded",
  },
];

const CHANNELS = [
  "email",
  "sms",
  "whatsapp",
  "push",
  "in_app",
];

const STOP_CONDITIONS = [
  {
    value: "none",
    label:
      "Do not stop automatically",
  },
  {
    value:
      "appointment_booked",
    label:
      "Stop when appointment is booked",
  },
  {
    value:
      "purchase_completed",
    label:
      "Stop when purchase is completed",
  },
  {
    value:
      "customer_opted_out",
    label:
      "Stop when customer opts out",
  },
];

const RISK_LEVELS = [
  "low",
  "medium",
  "high",
];

function newStep() {
  return {
    delayMinutes: 0,
    channel: "email",
    subject:
      "We would love to see you again",
    body:
      "Hi {{customer.firstName}}, we would love to welcome you back to {{salon.name}}.",
    stopIf:
      "appointment_booked",
  };
}

function emptyForm() {
  return {
    name: "",
    description: "",
    trigger:
      "customer_inactive",
    conditions: {
      inactiveDays: 60,
      minimumVisits: 0,
      minimumLifetimeValue: 0,
      retentionRiskLevels: [],
    },
    steps: [
      newStep(),
    ],
  };
}

function errorMessage(error) {
  return (
    error?.response?.data
      ?.message ||
    error?.message ||
    "Retention automation could not be updated."
  );
}

function triggerLabel(value) {
  return (
    TRIGGERS.find(
      (item) =>
        item.value === value
    )?.label ||
    String(value || "")
      .replace(/_/g, " ")
  );
}

function channelLabel(value) {
  if (value === "in_app") {
    return "In-app";
  }

  if (
    value === "sms"
  ) {
    return "SMS";
  }

  return (
    String(value || "")
      .charAt(0)
      .toUpperCase() +
    String(value || "").slice(1)
  );
}

function readinessReasonLabel(
  value
) {
  return String(
    value || ""
  )
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function previewCustomerName(
  customer
) {
  return (
    customer?.preferredName ||
    [
      customer?.firstName,
      customer?.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    customer?.email ||
    "Customer"
  );
}

function previewDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : new Intl.DateTimeFormat(
        "en-GB",
        {
          dateStyle:
            "medium",
        }
      ).format(date);
}

function previewMoney(value) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(
    Number(value) || 0
  );
}

function journeyToForm(journey) {
  return {
    name:
      journey?.name || "",
    description:
      journey?.description ||
      "",
    trigger:
      journey?.trigger ||
      "customer_inactive",
    conditions: {
      inactiveDays:
        journey?.conditions
          ?.inactiveDays ?? 60,
      minimumVisits:
        journey?.conditions
          ?.minimumVisits ?? 0,
      minimumLifetimeValue:
        journey?.conditions
          ?.minimumLifetimeValue ??
        0,
      retentionRiskLevels:
        Array.isArray(
          journey?.conditions
            ?.retentionRiskLevels
        )
          ? journey.conditions
              .retentionRiskLevels
          : [],
    },
    steps:
      Array.isArray(
        journey?.steps
      ) &&
      journey.steps.length
        ? journey.steps.map(
            (step) => ({
              delayMinutes:
                step.delayMinutes ??
                0,
              channel:
                step.channel ||
                "email",
              subject:
                step.subject || "",
              body:
                step.body || "",
              stopIf:
                step.stopIf ||
                "none",
            })
          )
        : [
            newStep(),
          ],
  };
}

export default function RetentionAutomationPage() {
  const [
    journeys,
    setJourneys,
  ] = useState([]);
  const [
    form,
    setForm,
  ] = useState(
    emptyForm
  );
  const [
    editingId,
    setEditingId,
  ] = useState("");
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    saving,
    setSaving,
  ] = useState(false);
  const [
    workingId,
    setWorkingId,
  ] = useState("");
  const [
    previewingId,
    setPreviewingId,
  ] = useState("");
  const [
    preview,
    setPreview,
  ] = useState(null);
  const [
    error,
    setError,
  ] = useState("");
  const [
    success,
    setSuccess,
  ] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result =
        await listRetentionJourneys();

      setJourneys(
        result.journeys
      );
    } catch (requestError) {
      setError(
        errorMessage(
          requestError
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const enabledCount =
    useMemo(
      () =>
        journeys.filter(
          (journey) =>
            journey.enabled ===
            true
        ).length,
      [journeys]
    );

  const stepCount =
    useMemo(
      () =>
        journeys.reduce(
          (
            total,
            journey
          ) =>
            total +
            (Array.isArray(
              journey.steps
            )
              ? journey.steps
                  .length
              : 0),
          0
        ),
      [journeys]
    );

  function updateField(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function updateCondition(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        conditions: {
          ...current.conditions,
          [field]: value,
        },
      })
    );
  }

  function toggleRisk(
    risk
  ) {
    setForm(
      (current) => {
        const selected =
          current.conditions
            .retentionRiskLevels;

        return {
          ...current,
          conditions: {
            ...current.conditions,
            retentionRiskLevels:
              selected.includes(
                risk
              )
                ? selected.filter(
                    (item) =>
                      item !==
                      risk
                  )
                : [
                    ...selected,
                    risk,
                  ],
          },
        };
      }
    );
  }

  function updateStep(
    index,
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        steps:
          current.steps.map(
            (
              step,
              stepIndex
            ) =>
              stepIndex ===
              index
                ? {
                    ...step,
                    [field]:
                      value,
                  }
                : step
          ),
      })
    );
  }

  function addStep() {
    setForm(
      (current) => ({
        ...current,
        steps: [
          ...current.steps,
          newStep(),
        ].slice(0, 10),
      })
    );
  }

  function removeStep(
    index
  ) {
    setForm(
      (current) => ({
        ...current,
        steps:
          current.steps.length <=
          1
            ? current.steps
            : current.steps.filter(
                (
                  _,
                  stepIndex
                ) =>
                  stepIndex !==
                  index
              ),
      })
    );
  }

  function resetEditor() {
    setEditingId("");
    setForm(
      emptyForm()
    );
  }

  function editJourney(
    journey
  ) {
    setEditingId(
      journey._id
    );
    setForm(
      journeyToForm(
        journey
      )
    );
    setError("");
    setSuccess("");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function submit(
    event
  ) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (editingId) {
        await updateRetentionJourney(
          editingId,
          form
        );
        setSuccess(
          "Retention journey updated."
        );
      } else {
        await createRetentionJourney(
          form
        );
        setSuccess(
          "Retention journey created in paused state."
        );
      }

      resetEditor();
      await load();
    } catch (requestError) {
      setError(
        errorMessage(
          requestError
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function previewAudience(
    journey
  ) {
    setPreviewingId(
      journey._id
    );
    setError("");
    setSuccess("");

    try {
      const result =
        await previewRetentionJourney(
          journey._id,
          {
            limit: 50,
          }
        );

      setPreview(
        result
      );
    } catch (requestError) {
      setPreview(null);
      setError(
        errorMessage(
          requestError
        )
      );
    } finally {
      setPreviewingId("");
    }
  }

  async function toggleJourney(
    journey
  ) {
    setWorkingId(
      journey._id
    );
    setError("");
    setSuccess("");

    try {
      const nextEnabled =
        journey.enabled !==
        true;

      await updateRetentionJourney(
        journey._id,
        {
          enabled:
            nextEnabled,
        }
      );

      setSuccess(
        nextEnabled
          ? "Journey enabled. Automatic execution remains gated until the execution engine is activated."
          : "Journey paused."
      );

      await load();
    } catch (requestError) {
      setError(
        errorMessage(
          requestError
        )
      );
    } finally {
      setWorkingId("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
                <Sparkles
                  size={18}
                />
                CRM / Retention
              </div>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Retention Automation
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Build governed customer-retention journeys using the existing SalonAI communications and customer intelligence foundations.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void load()
              }
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="mt-0.5 shrink-0 text-amber-700"
            />
            <div>
              <h2 className="font-bold text-amber-950">
                Execution engine pending
              </h2>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                Journey definitions still cannot execute automatically. Audience preview now evaluates bounded contact, consent and provider-suppression readiness, but idempotency, stop-condition enforcement, scheduling and audit evidence remain mandatory before any customer message can be queued.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <section
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800"
          >
            {error}
          </section>
        ) : null}

        {success ? (
          <section
            role="status"
            className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"
          >
            <CheckCircle2
              size={18}
            />
            {success}
          </section>
        ) : null}

        {preview ? (
          <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Audience dry-run
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {preview.journey?.name ||
                    "Retention journey"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {preview.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPreview(null)
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"
              >
                Close preview
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Candidates
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {preview.supported
                    ? preview.candidateCount
                    : "—"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Returned
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {preview.returnedCount ||
                    0}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Messages queued
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  0
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Required channels
                </p>
                <p className="mt-2 text-sm font-bold text-slate-900">
                  {preview.requiredChannels
                    ?.length
                    ? preview.requiredChannels
                        .map(
                          channelLabel
                        )
                        .join(", ")
                    : "None"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Contact ready
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {preview.readiness
                    ?.fullyContactReadyCount ||
                    0}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Blocked
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {preview.readiness
                    ?.blockedCount ||
                    0}
                </p>
              </div>
            </div>

            {preview.supported ? (
              <>
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Contactability, marketing consent and provider email suppression are evaluated for the returned preview customers only. This is still evidence, not execution authorisation: idempotency, stop conditions, scheduling and delivery controls have not been passed.
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3">
                            Customer
                          </th>
                          <th className="px-4 py-3">
                            Last visit
                          </th>
                          <th className="px-4 py-3">
                            Inactive
                          </th>
                          <th className="px-4 py-3">
                            Visits
                          </th>
                          <th className="px-4 py-3">
                            LTV
                          </th>
                          <th className="px-4 py-3">
                            Retention risk
                          </th>
                          <th className="px-4 py-3">
                            Contact readiness
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {(preview.items ||
                          []).map(
                          (customer) => (
                            <tr
                              key={
                                customer._id
                              }
                            >
                              <td className="px-4 py-3">
                                <strong className="text-slate-900">
                                  {previewCustomerName(
                                    customer
                                  )}
                                </strong>
                                <div className="mt-1 text-xs text-slate-500">
                                  {customer.email ||
                                    customer.phone ||
                                    "No contact destination"}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                {previewDate(
                                  customer.lastVisit
                                )}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-700">
                                {customer.daysInactive ||
                                  0}{" "}
                                days
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                {customer.visits ||
                                  0}
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                {previewMoney(
                                  customer.lifetimeValue
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {customer.risk
                                  ?.label ? (
                                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold capitalize text-indigo-700">
                                    {customer.risk.label}{" "}
                                    {Number.isFinite(
                                      Number(
                                        customer
                                          .risk
                                          .score
                                      )
                                    )
                                      ? `· ${Math.round(
                                          Number(
                                            customer
                                              .risk
                                              .score
                                          ) *
                                            100
                                        )}%`
                                      : ""}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    No fresh prediction
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {customer
                                  .readiness
                                  ?.fullyReady ? (
                                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                    Ready
                                  </span>
                                ) : (
                                  <div className="space-y-1">
                                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                                      Blocked
                                    </span>
                                    {(customer
                                      .readiness
                                      ?.channels ||
                                      [])
                                      .filter(
                                        (
                                          channel
                                        ) =>
                                          !channel.ready
                                      )
                                      .map(
                                        (
                                          channel
                                        ) => (
                                          <p
                                            key={
                                              channel.channel
                                            }
                                            className="text-xs text-slate-500"
                                          >
                                            {channelLabel(
                                              channel.channel
                                            )}
                                            :{" "}
                                            {(
                                              channel.reasons ||
                                              []
                                            )
                                              .map(
                                                readinessReasonLabel
                                              )
                                              .join(
                                                ", "
                                              )}
                                          </p>
                                        )
                                      )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  {preview.truncated ? (
                    <p className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                      Showing the first{" "}
                      {preview.returnedCount}{" "}
                      of{" "}
                      {preview.candidateCount}{" "}
                      candidates.
                    </p>
                  ) : null}

                  {!preview.items
                    ?.length ? (
                    <p className="p-8 text-center text-sm text-slate-500">
                      No customers currently match this journey definition.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <UsersRound
              size={21}
              className="text-indigo-600"
            />
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {journeys.length}
            </p>
            <p className="text-sm font-semibold text-slate-500">
              Journey definitions
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ToggleRight
              size={21}
              className="text-indigo-600"
            />
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {enabledCount}
            </p>
            <p className="text-sm font-semibold text-slate-500">
              Enabled definitions
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Workflow
              size={21}
              className="text-indigo-600"
            />
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {stepCount}
            </p>
            <p className="text-sm font-semibold text-slate-500">
              Configured steps
            </p>
          </article>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <form
            onSubmit={submit}
            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <header>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Journey builder
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                {editingId
                  ? "Edit retention journey"
                  : "Create retention journey"}
              </h2>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                Journey name
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={form.name}
                  onChange={(event) =>
                    updateField(
                      "name",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Dormant customer return journey"
                />
              </label>

              <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                Description
                <textarea
                  rows={3}
                  maxLength={600}
                  value={
                    form.description
                  }
                  onChange={(event) =>
                    updateField(
                      "description",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                Trigger
                <select
                  value={
                    form.trigger
                  }
                  onChange={(event) =>
                    updateField(
                      "trigger",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"
                >
                  {TRIGGERS.map(
                    (item) => (
                      <option
                        key={
                          item.value
                        }
                        value={
                          item.value
                        }
                      >
                        {item.label}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <section className="rounded-2xl bg-slate-50 p-4">
              <h3 className="font-bold text-slate-900">
                Audience conditions
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Conditions are stored now and will be enforced by the execution engine before any automated message is queued.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700">
                  Inactive days
                  <input
                    type="number"
                    min="1"
                    max="730"
                    value={
                      form.conditions
                        .inactiveDays
                    }
                    onChange={(event) =>
                      updateCondition(
                        "inactiveDays",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Minimum visits
                  <input
                    type="number"
                    min="0"
                    value={
                      form.conditions
                        .minimumVisits
                    }
                    onChange={(event) =>
                      updateCondition(
                        "minimumVisits",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Minimum LTV (£)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.conditions
                        .minimumLifetimeValue
                    }
                    onChange={(event) =>
                      updateCondition(
                        "minimumLifetimeValue",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                  />
                </label>
              </div>

              <fieldset className="mt-4">
                <legend className="text-sm font-semibold text-slate-700">
                  Retention-risk filter
                </legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {RISK_LEVELS.map(
                    (risk) => (
                      <label
                        key={risk}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={
                            form.conditions
                              .retentionRiskLevels
                              .includes(
                                risk
                              )
                          }
                          onChange={() =>
                            toggleRisk(
                              risk
                            )
                          }
                        />
                        {risk
                          .charAt(0)
                          .toUpperCase() +
                          risk.slice(1)}
                      </label>
                    )
                  )}
                </div>
              </fieldset>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">
                    Journey steps
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Up to 10 ordered communications.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addStep}
                  disabled={
                    form.steps.length >=
                    10
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 disabled:opacity-50"
                >
                  <Plus size={15} />
                  Add step
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {form.steps.map(
                  (
                    step,
                    index
                  ) => (
                    <article
                      key={index}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-slate-900">
                          Step{" "}
                          {index + 1}
                        </strong>

                        <button
                          type="button"
                          onClick={() =>
                            removeStep(
                              index
                            )
                          }
                          disabled={
                            form.steps
                              .length <=
                            1
                          }
                          className="inline-flex items-center gap-1 text-sm font-semibold text-rose-700 disabled:opacity-40"
                        >
                          <Trash2
                            size={15}
                          />
                          Remove
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-semibold text-slate-700">
                          Delay minutes
                          <input
                            type="number"
                            min="0"
                            max="525600"
                            value={
                              step.delayMinutes
                            }
                            onChange={(event) =>
                              updateStep(
                                index,
                                "delayMinutes",
                                event.target.value
                              )
                            }
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                          />
                        </label>

                        <label className="text-sm font-semibold text-slate-700">
                          Channel
                          <select
                            value={
                              step.channel
                            }
                            onChange={(event) =>
                              updateStep(
                                index,
                                "channel",
                                event.target.value
                              )
                            }
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                          >
                            {CHANNELS.map(
                              (
                                channel
                              ) => (
                                <option
                                  key={
                                    channel
                                  }
                                  value={
                                    channel
                                  }
                                >
                                  {channelLabel(
                                    channel
                                  )}
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        {step.channel ===
                        "email" ? (
                          <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                            Email subject
                            <input
                              maxLength={240}
                              value={
                                step.subject
                              }
                              onChange={(event) =>
                                updateStep(
                                  index,
                                  "subject",
                                  event.target.value
                                )
                              }
                              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                            />
                          </label>
                        ) : null}

                        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                          Message
                          <textarea
                            required
                            rows={4}
                            maxLength={5000}
                            value={
                              step.body
                            }
                            onChange={(event) =>
                              updateStep(
                                index,
                                "body",
                                event.target.value
                              )
                            }
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
                          />
                        </label>

                        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                          Stop condition
                          <select
                            value={
                              step.stopIf
                            }
                            onChange={(event) =>
                              updateStep(
                                index,
                                "stopIf",
                                event.target.value
                              )
                            }
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                          >
                            {STOP_CONDITIONS.map(
                              (
                                item
                              ) => (
                                <option
                                  key={
                                    item.value
                                  }
                                  value={
                                    item.value
                                  }
                                >
                                  {item.label}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                      </div>
                    </article>
                  )
                )}
              </div>
            </section>

            <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
              {editingId ? (
                <button
                  type="button"
                  onClick={
                    resetEditor
                  }
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700"
                >
                  Cancel edit
                </button>
              ) : null}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Save
                    size={16}
                  />
                )}
                {editingId
                  ? "Save journey"
                  : "Create paused journey"}
              </button>
            </footer>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 p-5">
              <h2 className="text-xl font-bold text-slate-900">
                Journey library
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review, edit and pause retention definitions.
              </p>
            </header>

            {loading ? (
              <div className="p-16 text-center">
                <Loader2 className="mx-auto animate-spin text-indigo-600" />
              </div>
            ) : journeys.length ? (
              <div className="divide-y divide-slate-100">
                {journeys.map(
                  (journey) => (
                    <article
                      key={
                        journey._id
                      }
                      className="p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900">
                              {journey.name}
                            </h3>
                            <span
                              className={
                                journey.enabled
                                  ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700"
                                  : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"
                              }
                            >
                              {journey.enabled
                                ? "Enabled"
                                : "Paused"}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {triggerLabel(
                              journey.trigger
                            )}
                          </p>

                          {journey.description ? (
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              {journey.description}
                            </p>
                          ) : null}
                        </div>

                        <Workflow
                          size={22}
                          className="shrink-0 text-indigo-500"
                        />
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="font-semibold text-slate-500">
                            Steps
                          </dt>
                          <dd className="mt-1 font-bold text-slate-900">
                            {journey.steps
                              ?.length ||
                              0}
                          </dd>
                        </div>

                        <div>
                          <dt className="font-semibold text-slate-500">
                            Inactive rule
                          </dt>
                          <dd className="mt-1 font-bold text-slate-900">
                            {journey
                              .conditions
                              ?.inactiveDays ??
                              "—"}{" "}
                            days
                          </dd>
                        </div>

                        <div>
                          <dt className="font-semibold text-slate-500">
                            Updated
                          </dt>
                          <dd className="mt-1 inline-flex items-center gap-1 font-bold text-slate-900">
                            <Clock3
                              size={14}
                            />
                            {journey.updatedAt
                              ? new Intl.DateTimeFormat(
                                  "en-GB",
                                  {
                                    dateStyle:
                                      "medium",
                                  }
                                ).format(
                                  new Date(
                                    journey.updatedAt
                                  )
                                )
                              : "—"}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            previewingId ===
                            journey._id
                          }
                          onClick={() =>
                            void previewAudience(
                              journey
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 disabled:opacity-50"
                        >
                          {previewingId ===
                          journey._id ? (
                            <Loader2
                              size={15}
                              className="animate-spin"
                            />
                          ) : (
                            <UsersRound
                              size={15}
                            />
                          )}
                          Preview audience
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            editJourney(
                              journey
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil
                            size={15}
                          />
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={
                            workingId ===
                            journey._id
                          }
                          onClick={() =>
                            void toggleJourney(
                              journey
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 disabled:opacity-50"
                        >
                          {journey.enabled ? (
                            <ToggleLeft
                              size={17}
                            />
                          ) : (
                            <ToggleRight
                              size={17}
                            />
                          )}
                          {journey.enabled
                            ? "Pause"
                            : "Enable definition"}
                        </button>
                      </div>
                    </article>
                  )
                )}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Workflow
                  size={38}
                  className="mx-auto text-slate-300"
                />
                <h3 className="mt-4 font-bold text-slate-900">
                  No retention journeys yet
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Create the first paused journey using the builder.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
