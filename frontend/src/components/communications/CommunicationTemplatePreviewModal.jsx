import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  Braces,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  RefreshCcw,
  Send,
  Smartphone,
  X,
} from "lucide-react";

import {
  getCommunicationTemplateErrorMessage,
  renderCommunicationTemplate,
} from "../../services/communicationTemplateApi";

const CHANNEL_CONFIG = {
  email: {
    label: "Email",
    icon: Mail,
    badgeClass:
      "border-blue-200 bg-blue-50 text-blue-700",
    iconClass:
      "bg-blue-100 text-blue-700",
  },

  sms: {
    label: "SMS",
    icon: Smartphone,
    badgeClass:
      "border-purple-200 bg-purple-50 text-purple-700",
    iconClass:
      "bg-purple-100 text-purple-700",
  },

  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    badgeClass:
      "border-green-200 bg-green-50 text-green-700",
    iconClass:
      "bg-green-100 text-green-700",
  },

  phone: {
    label: "Phone",
    icon: Phone,
    badgeClass:
      "border-orange-200 bg-orange-50 text-orange-700",
    iconClass:
      "bg-orange-100 text-orange-700",
  },

  in_app: {
    label: "In App",
    icon: FileText,
    badgeClass:
      "border-indigo-200 bg-indigo-50 text-indigo-700",
    iconClass:
      "bg-indigo-100 text-indigo-700",
  },
};

const CAMPAIGN_LABELS = {
  dormant_customer: "Dormant Customer",
  appointment_reminder:
    "Appointment Reminder",
  follow_up: "Follow-up",
  promotion: "Promotion",
  birthday: "Birthday",
  general: "General",
};

const DEFAULT_VARIABLE_VALUES = {
  customerName: "Sophia Brown",
  firstName: "Sophia",
  lastName: "Brown",
  salonName: "SalonAI",
  stylistName: "Emma",
  appointmentDate: "24 July 2026",
  appointmentTime: "14:30",
  serviceName: "Cut and Blow Dry",
  bookingReference: "SAL-1024",
  salonPhone: "020 1234 5678",
  salonEmail: "hello@salonai.co.uk",
  discountCode: "WELCOME10",
  discountAmount: "10%",
  birthdayOffer: "20% off",
  rebookingLink:
    "https://salonai.example/booking",
};

function getTemplateId(template) {
  return template?._id || template?.id || "";
}

function formatCampaignType(value) {
  return (
    CAMPAIGN_LABELS[value] ||
    String(value || "General")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      )
  );
}

function extractTemplateVariables(
  template
) {
  const variables = new Set();

  if (Array.isArray(template?.variables)) {
    for (const variable of template.variables) {
      const normalizedVariable = String(
        variable || ""
      ).trim();

      if (normalizedVariable) {
        variables.add(normalizedVariable);
      }
    }
  }

  const pattern =
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g;

  const values = [
    template?.subject,
    template?.body,
  ];

  for (const value of values) {
    const text = String(value || "");

    let match = pattern.exec(text);

    while (match) {
      variables.add(match[1]);
      match = pattern.exec(text);
    }

    pattern.lastIndex = 0;
  }

  return Array.from(variables).sort();
}

function renderLocalText(
  value,
  variables
) {
  return String(value || "").replace(
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g,
    (placeholder, variableName) => {
      const suppliedValue =
        variables[variableName];

      if (
        suppliedValue === undefined ||
        suppliedValue === null ||
        suppliedValue === ""
      ) {
        return placeholder;
      }

      return String(suppliedValue);
    }
  );
}

function createInitialVariableValues(
  variableNames
) {
  return Object.fromEntries(
    variableNames.map((variableName) => [
      variableName,
      DEFAULT_VARIABLE_VALUES[
        variableName
      ] || "",
    ])
  );
}

function getMissingVariables(
  variableNames,
  values
) {
  return variableNames.filter(
    (variableName) =>
      !String(
        values[variableName] || ""
      ).trim()
  );
}

function formatDate(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function VariableInput({
  variableName,
  value,
  disabled,
  onChange,
}) {
  return (
    <div>
      <label
        htmlFor={`preview-variable-${variableName}`}
        className="mb-2 block font-mono text-xs font-semibold text-gray-700"
      >
        {`{{${variableName}}}`}
      </label>

      <input
        id={`preview-variable-${variableName}`}
        type="text"
        value={value}
        onChange={(event) =>
          onChange(
            variableName,
            event.target.value
          )
        }
        disabled={disabled}
        placeholder={`Enter ${variableName}`}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-gray-100"
      />
    </div>
  );
}

export default function CommunicationTemplatePreviewModal({
  open = false,
  template = null,
  onClose,
  onUse,
}) {
  const [variableValues, setVariableValues] =
    useState({});

  const [renderedTemplate, setRenderedTemplate] =
    useState(null);

  const [rendering, setRendering] =
    useState(false);

  const [usingTemplate, setUsingTemplate] =
    useState(false);

  const [error, setError] = useState("");

  const templateId = getTemplateId(template);

  const variableNames = useMemo(
    () =>
      extractTemplateVariables(
        template
      ),
    [template]
  );

  const missingVariables = useMemo(
    () =>
      getMissingVariables(
        variableNames,
        variableValues
      ),
    [variableNames, variableValues]
  );

  const localSubject = useMemo(
    () =>
      renderLocalText(
        template?.subject,
        variableValues
      ),
    [template?.subject, variableValues]
  );

  const localBody = useMemo(
    () =>
      renderLocalText(
        template?.body,
        variableValues
      ),
    [template?.body, variableValues]
  );

  const previewSubject =
    renderedTemplate?.subject ??
    localSubject;

  const previewBody =
    renderedTemplate?.body ??
    localBody;

  const channelConfig =
    CHANNEL_CONFIG[template?.channel] ||
    CHANNEL_CONFIG.in_app;

  const ChannelIcon =
    channelConfig.icon;

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialValues =
      createInitialVariableValues(
        extractTemplateVariables(template)
      );

    setVariableValues(initialValues);
    setRenderedTemplate(null);
    setError("");
    setRendering(false);
    setUsingTemplate(false);
  }, [open, template]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (
        event.key === "Escape" &&
        !rendering &&
        !usingTemplate
      ) {
        onClose?.();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow = "";
    };
  }, [
    open,
    rendering,
    usingTemplate,
    onClose,
  ]);

  if (!open || !template) {
    return null;
  }

  function updateVariable(
    variableName,
    value
  ) {
    setVariableValues(
      (currentValues) => ({
        ...currentValues,
        [variableName]: value,
      })
    );

    setRenderedTemplate(null);
    setError("");
  }

  function resetVariableValues() {
    setVariableValues(
      createInitialVariableValues(
        variableNames
      )
    );

    setRenderedTemplate(null);
    setError("");
  }

  function handleBackdropClick(event) {
    if (
      event.target === event.currentTarget &&
      !rendering &&
      !usingTemplate
    ) {
      onClose?.();
    }
  }

  async function handleServerPreview() {
    if (!templateId) {
      setError(
        "This template does not have a valid ID."
      );

      return;
    }

    try {
      setRendering(true);
      setError("");

      const response =
        await renderCommunicationTemplate(
          templateId,
          variableValues,
          {
            requireActive: false,
            requireAllVariables: false,
            recordUsage: false,
          }
        );

      const result =
        response?.renderedTemplate ||
        response?.data
          ?.renderedTemplate ||
        response?.data ||
        response;

      setRenderedTemplate(result);
    } catch (requestError) {
      setError(
        getCommunicationTemplateErrorMessage(
          requestError,
          "Unable to render the communication template."
        )
      );
    } finally {
      setRendering(false);
    }
  }

  async function handleUseTemplate() {
    try {
      setUsingTemplate(true);
      setError("");

      let result = {
        template: {
          _id: templateId,
          name: template.name,
          channel: template.channel,
          campaignType:
            template.campaignType,
          variables: variableNames,
        },
        subject: localSubject,
        body: localBody,
        missingVariables,
        complete:
          missingVariables.length === 0,
      };

      if (templateId) {
        const response =
          await renderCommunicationTemplate(
            templateId,
            variableValues,
            {
              requireActive: true,
              requireAllVariables: false,
              recordUsage: true,
            }
          );

        result =
          response?.renderedTemplate ||
          response?.data
            ?.renderedTemplate ||
          response?.data ||
          response;
      }

      await onUse?.({
        ...result,
        sourceTemplate: template,
        variables: variableValues,
      });
    } catch (requestError) {
      setError(
        getCommunicationTemplateErrorMessage(
          requestError,
          "Unable to use the communication template."
        )
      );
    } finally {
      setUsingTemplate(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-preview-title"
      onMouseDown={handleBackdropClick}
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${channelConfig.iconClass}`}
            >
              <ChannelIcon size={22} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="template-preview-title"
                  className="truncate text-xl font-bold text-gray-900"
                >
                  {template.name ||
                    "Communication Template"}
                </h2>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${channelConfig.badgeClass}`}
                >
                  <ChannelIcon size={13} />
                  {channelConfig.label}
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    template.active !== false
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-gray-200 bg-gray-100 text-gray-600"
                  }`}
                >
                  <CheckCircle2 size={13} />

                  {template.active !== false
                    ? "Active"
                    : "Inactive"}
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                {template.description ||
                  "Preview the personalised message before using this template."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={
              rendering || usingTemplate
            }
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close template preview"
          >
            <X size={21} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {error ? (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
            >
              <AlertCircle
                className="mt-0.5 shrink-0 text-red-600"
                size={20}
              />

              <div>
                <p className="font-semibold text-red-800">
                  Preview unavailable
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {error}
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.4fr)]">
            <aside className="space-y-5">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Braces
                      className="text-indigo-600"
                      size={18}
                    />

                    <h3 className="font-semibold text-gray-900">
                      Personalisation
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={resetVariableValues}
                    disabled={
                      rendering ||
                      usingTemplate
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 transition hover:text-indigo-900 disabled:opacity-50"
                  >
                    <RefreshCcw size={13} />
                    Reset
                  </button>
                </div>

                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Update the values below to preview
                  how the customer will see the message.
                </p>

                {variableNames.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {variableNames.map(
                      (variableName) => (
                        <VariableInput
                          key={variableName}
                          variableName={
                            variableName
                          }
                          value={
                            variableValues[
                              variableName
                            ] || ""
                          }
                          disabled={
                            rendering ||
                            usingTemplate
                          }
                          onChange={
                            updateVariable
                          }
                        />
                      )
                    )}
                  </div>
                ) : (
                  <div className="mt-5 rounded-lg border border-dashed border-gray-300 bg-white p-4 text-center">
                    <p className="text-sm font-medium text-gray-700">
                      No variables required
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      This template contains static
                      content.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="font-semibold text-gray-900">
                  Template details
                </h3>

                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-gray-500">
                      Campaign
                    </dt>

                    <dd className="text-right font-semibold text-gray-800">
                      {formatCampaignType(
                        template.campaignType
                      )}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-gray-500">
                      Variables
                    </dt>

                    <dd className="font-semibold text-gray-800">
                      {variableNames.length}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-gray-500">
                      Times used
                    </dt>

                    <dd className="font-semibold text-gray-800">
                      {Number(
                        template.usageCount
                      ).toLocaleString("en-GB")}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-gray-500">
                      Last used
                    </dt>

                    <dd className="text-right font-semibold text-gray-800">
                      {formatDate(
                        template.lastUsedAt
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {missingVariables.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle
                      className="text-amber-600"
                      size={18}
                    />

                    <h3 className="font-semibold text-amber-900">
                      Missing values
                    </h3>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-amber-800">
                    These placeholders are still visible
                    in the preview:
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {missingVariables.map(
                      (variableName) => (
                        <span
                          key={variableName}
                          className="rounded-md bg-white px-2 py-1 font-mono text-xs text-amber-800"
                        >
                          {`{{${variableName}}}`}
                        </span>
                      )
                    )}
                  </div>
                </div>
              ) : null}
            </aside>

            <section className="space-y-5">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Eye
                      className="text-indigo-700"
                      size={19}
                    />

                    <div>
                      <h3 className="font-semibold text-indigo-900">
                        Customer preview
                      </h3>

                      <p className="mt-0.5 text-xs text-indigo-700">
                        This is how the personalised
                        message will appear.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleServerPreview
                    }
                    disabled={
                      rendering ||
                      usingTemplate ||
                      !templateId
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCcw
                      size={14}
                      className={
                        rendering
                          ? "animate-spin"
                          : ""
                      }
                    />

                    {rendering
                      ? "Rendering..."
                      : "Validate Preview"}
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${channelConfig.iconClass}`}
                    >
                      <ChannelIcon size={18} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {channelConfig.label} preview
                      </p>

                      <p className="text-xs text-gray-500">
                        {formatCampaignType(
                          template.campaignType
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {template.channel ===
                  "email" ? (
                  <div className="border-b border-gray-100 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Subject
                    </p>

                    <p className="mt-2 text-base font-semibold text-gray-900">
                      {previewSubject ||
                        "No email subject"}
                    </p>
                  </div>
                ) : null}

                <div className="min-h-72 px-5 py-6">
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
                    {previewBody ||
                      "No message content"}
                  </p>
                </div>

                <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock size={14} />
                      Updated{" "}
                      {formatDate(
                        template.updatedAt
                      )}
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <Braces size={14} />
                      {variableNames.length} variable
                      {variableNames.length === 1
                        ? ""
                        : "s"}
                    </span>
                  </div>
                </div>
              </div>

              {renderedTemplate ? (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4"
                >
                  <CheckCircle2
                    className="mt-0.5 shrink-0 text-green-600"
                    size={19}
                  />

                  <div>
                    <p className="font-semibold text-green-800">
                      Preview validated
                    </p>

                    <p className="mt-1 text-sm text-green-700">
                      The backend rendered this template
                      successfully.
                    </p>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Template ID:{" "}
            <span className="font-mono">
              {templateId || "Not available"}
            </span>
          </p>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onClose?.()}
              disabled={
                rendering || usingTemplate
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close
            </button>

            {onUse ? (
              <button
                type="button"
                onClick={handleUseTemplate}
                disabled={
                  rendering ||
                  usingTemplate ||
                  template.active === false
                }
                className="inline-flex min-w-36 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {usingTemplate ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Send size={17} />
                    Use Template
                  </>
                )}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}