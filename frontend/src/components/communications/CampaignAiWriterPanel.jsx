import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
  X,
} from "lucide-react";

import {
  AI_CAMPAIGN_TONES,
  generateAiCampaignCopy,
  getAiCampaignWritingErrorMessage,
} from "../../services/aiCampaignWritingService.js";

const REPLACEMENT_MODES = [
  {
    value: "replace",
    label: "Replace existing content",
    description:
      "Replace the current subject and message with the generated copy.",
  },
  {
    value: "append",
    label: "Append to message",
    description:
      "Keep the current message and add the generated copy underneath it.",
  },
  {
    value: "insert",
    label: "Insert at cursor",
    description:
      "Insert the generated copy at the active subject or message cursor position.",
  },
];

function normaliseText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\r\n/g, "\n");
}

function formatChannel(value) {
  const labels = {
    email: "Email",
    sms: "SMS",
    whatsapp: "WhatsApp",
    phone: "Phone",
    in_app: "In App",
  };

  return (
    labels[value] ||
    String(value || "Channel")
  );
}

function formatProvider(value) {
  const provider =
    String(value || "local")
      .trim()
      .toLowerCase();

  if (
    provider === "local" ||
    provider === "fallback"
  ) {
    return "SalonAI local writer";
  }

  return provider
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function warningClasses(code) {
  if (
    code === "MESSAGE_TOO_LONG" ||
    code === "SUBJECT_TOO_LONG"
  ) {
    return (
      "border-red-200 bg-red-50 " +
      "text-red-700"
    );
  }

  return (
    "border-amber-200 bg-amber-50 " +
    "text-amber-700"
  );
}

export default function CampaignAiWriterPanel({
  campaignName = "",
  campaignDescription = "",
  campaignType = "general",
  channel = "email",
  currentSubject = "",
  currentMessage = "",
  variables = [],
  disabled = false,
  onApply,
  onGenerated,
  className = "",
}) {
  const [
    tone,
    setTone,
  ] = useState("friendly");

  const [
    objective,
    setObjective,
  ] = useState("");

  const [
    offer,
    setOffer,
  ] = useState("");

  const [
    instruction,
    setInstruction,
  ] = useState("");

  const [
    replacementMode,
    setReplacementMode,
  ] = useState("replace");

  const [
    generatedCopy,
    setGeneratedCopy,
  ] = useState(null);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const availableVariables =
    useMemo(() => {
      const values =
        Array.isArray(variables)
          ? variables
          : [];

      return Array.from(
        new Set(
          values
            .map((value) =>
              String(value || "")
                .trim()
                .replace(
                  /^{{\s*|\s*}}$/g,
                  ""
                )
            )
            .filter(Boolean)
        )
      ).sort();
    }, [variables]);

  const selectedTone =
    useMemo(
      () =>
        AI_CAMPAIGN_TONES.find(
          (option) =>
            option.value === tone
        ) ||
        AI_CAMPAIGN_TONES[0],
      [tone]
    );

  const hasCurrentContent =
    Boolean(
      normaliseText(
        currentSubject
      ) ||
        normaliseText(
          currentMessage
        )
    );

  const hasGenerationContext =
    Boolean(
      normaliseText(objective) ||
        normaliseText(offer) ||
        normaliseText(instruction) ||
        normaliseText(
          campaignDescription
        ) ||
        hasCurrentContent
    );

  useEffect(() => {
    setGeneratedCopy(null);
    setError("");
    setSuccessMessage("");
  }, [
    campaignType,
    channel,
  ]);

  useEffect(() => {
    if (
      objective ||
      !campaignDescription
    ) {
      return;
    }

    setObjective(
      campaignDescription
    );
  }, [
    campaignDescription,
    objective,
  ]);

  function clearMessages() {
    setError("");
    setSuccessMessage("");
  }

  function updateTone(value) {
    setTone(value);
    clearMessages();
  }

  function updateObjective(value) {
    setObjective(value);
    clearMessages();
  }

  function updateOffer(value) {
    setOffer(value);
    clearMessages();
  }

  function updateInstruction(value) {
    setInstruction(value);
    clearMessages();
  }

  function updateReplacementMode(
    value
  ) {
    setReplacementMode(value);
    clearMessages();

    setGeneratedCopy(
      (current) =>
        current
          ? {
              ...current,
              replacementMode: value,
            }
          : current
    );
  }

  async function handleGenerate() {
    if (!hasGenerationContext) {
      setError(
        "Add a campaign objective, offer, instruction or existing message before generating copy."
      );

      return;
    }

    try {
      setGenerating(true);
      setError("");
      setSuccessMessage("");

      const result =
        await generateAiCampaignCopy({
          campaignName,
          campaignType,
          channel,
          tone,
          objective:
            objective ||
            campaignDescription,
          offer,
          instruction,
          currentSubject,
          currentMessage,
          variables:
            availableVariables,
          replacementMode,
        });

      setGeneratedCopy(
        result
      );

      setSuccessMessage(
        `Campaign copy generated using ${formatProvider(
          result.provider
        )}.`
      );

      onGenerated?.(
        result
      );
    } catch (requestError) {
      setGeneratedCopy(null);

      setError(
        getAiCampaignWritingErrorMessage(
          requestError,
          "Unable to generate campaign copy."
        )
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleApply() {
    if (
      !generatedCopy?.message
    ) {
      setError(
        "Generate campaign copy before applying it."
      );

      return;
    }

    try {
      setError("");
      setSuccessMessage("");

      onApply?.({
        subject:
          generatedCopy.subject ||
          "",

        message:
          generatedCopy.message ||
          generatedCopy.body ||
          "",

        body:
          generatedCopy.message ||
          generatedCopy.body ||
          "",

        variables:
          generatedCopy.variables ||
          [],

        provider:
          generatedCopy.provider ||
          "local",

        replacementMode,

        warnings:
          generatedCopy.warnings ||
          [],

        characterCount:
          generatedCopy.characterCount,

        characterLimit:
          generatedCopy.characterLimit,

        smsSegments:
          generatedCopy.smsSegments,
      });

      setSuccessMessage(
        replacementMode ===
        "replace"
          ? "Generated campaign copy applied."
          : replacementMode ===
              "append"
            ? "Generated copy appended to the campaign message."
            : "Generated copy inserted into the active editor."
      );
    } catch (applyError) {
      setError(
        applyError?.message ||
          "Unable to apply the generated campaign copy."
      );
    }
  }

  function resetWriter() {
    setTone("friendly");

    setObjective(
      campaignDescription ||
        ""
    );

    setOffer("");
    setInstruction("");
    setReplacementMode(
      "replace"
    );
    setGeneratedCopy(null);
    setError("");
    setSuccessMessage("");
  }

  function dismissGeneratedCopy() {
    setGeneratedCopy(null);
    setSuccessMessage("");
  }

  return (
    <section
      className={[
        "overflow-hidden rounded-2xl",
        "border border-violet-200",
        "bg-gradient-to-br",
        "from-violet-50 via-white",
        "to-indigo-50",
        className,
      ].join(" ")}
      aria-labelledby="campaign-ai-writer-title"
    >
      <div className="border-b border-violet-200 px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
              <Sparkles size={20} />
            </span>

            <div>
              <h4
                id="campaign-ai-writer-title"
                className="font-bold text-gray-900"
              >
                SalonAI Campaign Writer
              </h4>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-600">
                Generate campaign copy for{" "}
                {formatChannel(
                  channel
                )} while preserving
                personalisation variables and
                channel limits.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetWriter}
            disabled={
              disabled ||
              generating
            }
            className="inline-flex items-center gap-2 self-start rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCcw size={14} />
            Reset writer
          </button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {error ? (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={17}
                className="mt-0.5 shrink-0 text-red-600"
              />

              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="shrink-0 text-red-400 hover:text-red-700"
              aria-label="Dismiss AI writing error"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        {successMessage ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4"
          >
            <div className="flex items-start gap-2">
              <CheckCircle2
                size={17}
                className="mt-0.5 shrink-0 text-green-600"
              />

              <p className="text-sm text-green-700">
                {successMessage}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSuccessMessage("")
              }
              className="shrink-0 text-green-400 hover:text-green-700"
              aria-label="Dismiss AI writing success message"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label
              htmlFor="campaign-ai-tone"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Writing tone
            </label>

            <select
              id="campaign-ai-tone"
              value={tone}
              onChange={(event) =>
                updateTone(
                  event.target.value
                )
              }
              disabled={
                disabled ||
                generating
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-gray-100"
            >
              {AI_CAMPAIGN_TONES.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>

            <p className="mt-1.5 text-xs leading-5 text-gray-500">
              {selectedTone.description}
            </p>
          </div>

          <div>
            <label
              htmlFor="campaign-ai-mode"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Apply generated copy
            </label>

            <select
              id="campaign-ai-mode"
              value={
                replacementMode
              }
              onChange={(event) =>
                updateReplacementMode(
                  event.target.value
                )
              }
              disabled={
                disabled ||
                generating
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-gray-100"
            >
              {REPLACEMENT_MODES.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>

            <p className="mt-1.5 text-xs leading-5 text-gray-500">
              {
                REPLACEMENT_MODES.find(
                  (option) =>
                    option.value ===
                    replacementMode
                )?.description
              }
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="campaign-ai-objective"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Campaign objective
          </label>

          <textarea
            id="campaign-ai-objective"
            value={objective}
            onChange={(event) =>
              updateObjective(
                event.target.value
              )
            }
            rows={3}
            maxLength={1000}
            disabled={
              disabled ||
              generating
            }
            placeholder="For example: Encourage dormant customers to book a cut and blow dry this month."
            className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-gray-100"
          />

          <p className="mt-1 text-right text-xs text-gray-400">
            {objective.length}/1000
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label
              htmlFor="campaign-ai-offer"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Offer or incentive
            </label>

            <input
              id="campaign-ai-offer"
              type="text"
              value={offer}
              onChange={(event) =>
                updateOffer(
                  event.target.value
                )
              }
              maxLength={300}
              disabled={
                disabled ||
                generating
              }
              placeholder="For example: 20% off with code SUMMER20"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label
              htmlFor="campaign-ai-instruction"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Additional instruction
            </label>

            <input
              id="campaign-ai-instruction"
              type="text"
              value={instruction}
              onChange={(event) =>
                updateInstruction(
                  event.target.value
                )
              }
              maxLength={500}
              disabled={
                disabled ||
                generating
              }
              placeholder="For example: Avoid urgency and mention online booking."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-gray-100"
            />
          </div>
        </div>

        {availableVariables.length >
        0 ? (
          <div className="rounded-xl border border-violet-100 bg-white/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
              Variables supplied to the writer
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {availableVariables.map(
                (variableName) => (
                  <span
                    key={
                      variableName
                    }
                    className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-violet-700"
                  >
                    {`{{${variableName}}}`}
                  </span>
                )
              )}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-violet-100 pt-5">
          <p className="text-xs text-gray-500">
            Current message content is{" "}
            {hasCurrentContent
              ? "included as writing context."
              : "not yet available."}
          </p>

          <button
            type="button"
            onClick={
              handleGenerate
            }
            disabled={
              disabled ||
              generating ||
              !hasGenerationContext
            }
            className="inline-flex min-w-44 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <>
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
                Writing copy...
              </>
            ) : (
              <>
                <Sparkles size={17} />
                Generate campaign copy
              </>
            )}
          </button>
        </div>

        {generatedCopy ? (
          <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-gray-900">
                  Generated campaign copy
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Provider:{" "}
                  {formatProvider(
                    generatedCopy.provider
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  dismissGeneratedCopy
                }
                disabled={
                  disabled ||
                  generating
                }
                className="inline-flex items-center gap-1.5 self-start rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <X size={13} />
                Dismiss
              </button>
            </div>

            {channel === "email" ? (
              <div className="border-b border-gray-100 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Subject
                </p>

                <p className="mt-2 break-words font-semibold text-gray-900">
                  {generatedCopy.subject ||
                    "No subject generated"}
                </p>

                <p className="mt-2 text-right text-xs text-gray-400">
                  {String(
                    generatedCopy.subject ||
                      ""
                  ).length}
                  /200
                </p>
              </div>
            ) : null}

            <div className="px-5 py-5">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                Message
              </p>

              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
                {generatedCopy.message}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="rounded-full bg-gray-100 px-2.5 py-1">
                  {Number(
                    generatedCopy.characterCount ||
                      0
                  ).toLocaleString(
                    "en-GB"
                  )}{" "}
                  characters
                </span>

                <span className="rounded-full bg-gray-100 px-2.5 py-1">
                  Limit{" "}
                  {Number(
                    generatedCopy.characterLimit ||
                      0
                  ).toLocaleString(
                    "en-GB"
                  )}
                </span>

                {channel === "sms" ? (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1">
                    {Number(
                      generatedCopy.smsSegments ||
                        0
                    )}{" "}
                    SMS segment
                    {Number(
                      generatedCopy.smsSegments ||
                        0
                    ) === 1
                      ? ""
                      : "s"}
                  </span>
                ) : null}
              </div>
            </div>

            {Array.isArray(
              generatedCopy.warnings
            ) &&
            generatedCopy.warnings
              .length > 0 ? (
              <div className="space-y-2 border-t border-gray-100 px-5 py-4">
                {generatedCopy.warnings.map(
                  (
                    warning,
                    index
                  ) => (
                    <div
                      key={`${warning.code || "warning"}-${index}`}
                      className={[
                        "flex items-start gap-2 rounded-lg border p-3 text-xs",
                        warningClasses(
                          warning.code
                        ),
                      ].join(" ")}
                    >
                      <AlertTriangle
                        size={15}
                        className="mt-0.5 shrink-0"
                      />

                      <span>
                        {warning.message}
                      </span>
                    </div>
                  )
                )}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                Applying as:{" "}
                <strong className="text-gray-700">
                  {
                    REPLACEMENT_MODES.find(
                      (option) =>
                        option.value ===
                        replacementMode
                    )?.label
                  }
                </strong>
              </p>

              <button
                type="button"
                onClick={
                  handleApply
                }
                disabled={
                  disabled ||
                  generating
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2
                  size={17}
                />
                Apply generated copy
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}