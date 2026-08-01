import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Braces,
  Check,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Smartphone,
  X,
} from "lucide-react";

import {
  createCommunicationTemplate,
  getCommunicationTemplateErrorMessage,
  updateCommunicationTemplate,
} from "../../Services/communicationTemplateApi";

const CAMPAIGN_OPTIONS = [
  {
    value: "dormant_customer",
    label: "Dormant Customer",
  },
  {
    value: "appointment_reminder",
    label: "Appointment Reminder",
  },
  {
    value: "follow_up",
    label: "Follow-up",
  },
  {
    value: "promotion",
    label: "Promotion",
  },
  {
    value: "birthday",
    label: "Birthday",
  },
  {
    value: "general",
    label: "General",
  },
];

const CHANNEL_OPTIONS = [
  {
    value: "email",
    label: "Email",
    icon: Mail,
  },
  {
    value: "sms",
    label: "SMS",
    icon: Smartphone,
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
  },
  {
    value: "phone",
    label: "Phone",
    icon: Phone,
  },
  {
    value: "in_app",
    label: "In App",
    icon: FileText,
  },
];

const COMMON_VARIABLES = [
  "customerName",
  "firstName",
  "salonName",
  "stylistName",
  "appointmentDate",
  "appointmentTime",
  "serviceName",
  "bookingReference",
  "salonPhone",
];

const SAMPLE_VARIABLE_VALUES = {
  customerName: "Sophia Brown",
  firstName: "Sophia",
  salonName: "SalonAI",
  stylistName: "Emma",
  appointmentDate: "24 July 2026",
  appointmentTime: "14:30",
  serviceName: "Cut and Blow Dry",
  bookingReference: "SAL-1024",
  salonPhone: "020 1234 5678",
};

const EMPTY_FORM = {
  name: "",
  description: "",
  campaignType: "general",
  channel: "email",
  subject: "",
  body: "",
  tags: "",
  active: true,
};

function getTemplateId(template) {
  return template?._id || template?.id || "";
}

function normalizeTemplate(template) {
  if (!template) {
    return EMPTY_FORM;
  }

  return {
    name: template.name || "",
    description: template.description || "",
    campaignType:
      template.campaignType || "general",
    channel: template.channel || "email",
    subject: template.subject || "",
    body: template.body || "",
    tags: Array.isArray(template.tags)
      ? template.tags.join(", ")
      : template.tags || "",
    active:
      template.active === undefined
        ? true
        : Boolean(template.active),
  };
}

function extractVariables(...values) {
  const variables = new Set();
  const pattern =
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g;

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

function renderPreview(value, variables) {
  return String(value || "").replace(
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g,
    (placeholder, variableName) =>
      variables[variableName] ?? placeholder
  );
}

function getCharacterLimit(channel) {
  if (channel === "sms") {
    return 480;
  }

  if (channel === "whatsapp") {
    return 4096;
  }

  return 10000;
}

function validateForm(form) {
  const errors = {};

  if (!form.name.trim()) {
    errors.name = "Template name is required.";
  }

  if (form.name.trim().length < 2) {
    errors.name =
      "Template name must contain at least 2 characters.";
  }

  if (!form.channel) {
    errors.channel =
      "Communication channel is required.";
  }

  if (
    form.channel === "email" &&
    !form.subject.trim()
  ) {
    errors.subject =
      "Email templates require a subject.";
  }

  if (!form.body.trim()) {
    errors.body =
      "Template message body is required.";
  }

  const characterLimit = getCharacterLimit(
    form.channel
  );

  if (form.body.length > characterLimit) {
    errors.body = `The message cannot exceed ${characterLimit.toLocaleString(
      "en-GB"
    )} characters for this channel.`;
  }

  return errors;
}

function ModalFieldError({ message }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
      <AlertCircle size={13} />
      {message}
    </p>
  );
}

export default function CommunicationTemplateModal({
  open = false,
  template = null,
  onClose,
  onSaved,
}) {
  const bodyTextAreaRef = useRef(null);
  const subjectInputRef = useRef(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] =
    useState("");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] =
    useState(false);
  const [variableTarget, setVariableTarget] =
    useState("body");

  const templateId = getTemplateId(template);
  const editing = Boolean(templateId);

  const extractedVariables = useMemo(
    () =>
      extractVariables(
        form.subject,
        form.body
      ),
    [form.subject, form.body]
  );

  const previewSubject = useMemo(
    () =>
      renderPreview(
        form.subject,
        SAMPLE_VARIABLE_VALUES
      ),
    [form.subject]
  );

  const previewBody = useMemo(
    () =>
      renderPreview(
        form.body,
        SAMPLE_VARIABLE_VALUES
      ),
    [form.body]
  );

  const characterLimit = getCharacterLimit(
    form.channel
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(normalizeTemplate(template));
    setErrors({});
    setRequestError("");
    setPreviewOpen(false);
    setVariableTarget("body");
  }, [open, template]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleEscape(event) {
      if (
        event.key === "Escape" &&
        !saving
      ) {
        onClose?.();
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );

      document.body.style.overflow = "";
    };
  }, [open, saving, onClose]);

  if (!open) {
    return null;
  }

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: "",
    }));

    setRequestError("");
  }

  function handleChannelChange(channel) {
    setForm((currentForm) => ({
      ...currentForm,
      channel,
      subject:
        channel === "email"
          ? currentForm.subject
          : "",
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      channel: "",
      subject: "",
      body: "",
    }));

    setRequestError("");
  }

  function insertVariable(variableName) {
    const placeholder = `{{${variableName}}}`;
    const field =
      variableTarget === "subject" &&
      form.channel === "email"
        ? "subject"
        : "body";

    const input =
      field === "subject"
        ? subjectInputRef.current
        : bodyTextAreaRef.current;

    const currentValue = form[field] || "";

    if (!input) {
      updateField(
        field,
        `${currentValue}${placeholder}`
      );
      return;
    }

    const selectionStart =
      input.selectionStart ??
      currentValue.length;

    const selectionEnd =
      input.selectionEnd ??
      selectionStart;

    const nextValue =
      currentValue.slice(0, selectionStart) +
      placeholder +
      currentValue.slice(selectionEnd);

    updateField(field, nextValue);

    window.requestAnimationFrame(() => {
      input.focus();

      const nextPosition =
        selectionStart +
        placeholder.length;

      input.setSelectionRange(
        nextPosition,
        nextPosition
      );
    });
  }

  function handleBackdropClick(event) {
    if (
      event.target === event.currentTarget &&
      !saving
    ) {
      onClose?.();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationErrors =
      validateForm(form);

    if (
      Object.keys(validationErrors).length > 0
    ) {
      setErrors(validationErrors);
      return;
    }

    try {
      setSaving(true);
      setErrors({});
      setRequestError("");

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        campaignType: form.campaignType,
        channel: form.channel,
        subject:
          form.channel === "email"
            ? form.subject.trim()
            : "",
        body: form.body.trim(),
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        variables: extractedVariables,
        active: form.active,
      };

      const response = editing
        ? await updateCommunicationTemplate(
            templateId,
            payload
          )
        : await createCommunicationTemplate(
            payload
          );

      const savedTemplate =
        response?.template ||
        response?.data?.template ||
        response?.data ||
        response;

      await onSaved?.(savedTemplate);
    } catch (error) {
      setRequestError(
        getCommunicationTemplateErrorMessage(
          error,
          editing
            ? "Unable to update the communication template."
            : "Unable to create the communication template."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="communication-template-modal-title"
      onMouseDown={handleBackdropClick}
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <FileText size={22} />
            </div>

            <div>
              <h2
                id="communication-template-modal-title"
                className="text-xl font-bold text-gray-900"
              >
                {editing
                  ? "Edit Communication Template"
                  : "Create Communication Template"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Create reusable content for email,
                SMS, WhatsApp, telephone and in-app
                communications.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={saving}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close template editor"
          >
            <X size={21} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {requestError ? (
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
                    Template could not be saved
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    {requestError}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
              <div className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="template-name"
                      className="mb-2 block text-sm font-semibold text-gray-700"
                    >
                      Template name
                    </label>

                    <input
                      id="template-name"
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        updateField(
                          "name",
                          event.target.value
                        )
                      }
                      maxLength={120}
                      placeholder="Appointment reminder"
                      disabled={saving}
                      className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                        errors.name
                          ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                          : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-100"
                      }`}
                    />

                    <ModalFieldError
                      message={errors.name}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="template-campaign"
                      className="mb-2 block text-sm font-semibold text-gray-700"
                    >
                      Campaign type
                    </label>

                    <select
                      id="template-campaign"
                      value={form.campaignType}
                      onChange={(event) =>
                        updateField(
                          "campaignType",
                          event.target.value
                        )
                      }
                      disabled={saving}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                    >
                      {CAMPAIGN_OPTIONS.map(
                        (option) => (
                          <option
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="template-description"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Description
                  </label>

                  <textarea
                    id="template-description"
                    value={form.description}
                    onChange={(event) =>
                      updateField(
                        "description",
                        event.target.value
                      )
                    }
                    rows={2}
                    maxLength={500}
                    placeholder="Explain when this template should be used."
                    disabled={saving}
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                  />

                  <p className="mt-1 text-right text-xs text-gray-400">
                    {form.description.length}/500
                  </p>
                </div>

                <fieldset>
                  <legend className="mb-3 text-sm font-semibold text-gray-700">
                    Communication channel
                  </legend>

                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    {CHANNEL_OPTIONS.map(
                      (option) => {
                        const Icon = option.icon;
                        const selected =
                          form.channel ===
                          option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              handleChannelChange(
                                option.value
                              )
                            }
                            disabled={saving}
                            className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              selected
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <Icon size={20} />
                            {option.label}
                          </button>
                        );
                      }
                    )}
                  </div>

                  <ModalFieldError
                    message={errors.channel}
                  />
                </fieldset>

                {form.channel === "email" ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label
                        htmlFor="template-subject"
                        className="text-sm font-semibold text-gray-700"
                      >
                        Email subject
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          setVariableTarget(
                            "subject"
                          )
                        }
                        className={`text-xs font-semibold ${
                          variableTarget ===
                          "subject"
                            ? "text-indigo-700"
                            : "text-gray-500 hover:text-indigo-700"
                        }`}
                      >
                        Insert variables here
                      </button>
                    </div>

                    <input
                      ref={subjectInputRef}
                      id="template-subject"
                      type="text"
                      value={form.subject}
                      onFocus={() =>
                        setVariableTarget(
                          "subject"
                        )
                      }
                      onChange={(event) =>
                        updateField(
                          "subject",
                          event.target.value
                        )
                      }
                      maxLength={200}
                      placeholder="Your appointment at {{salonName}}"
                      disabled={saving}
                      className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                        errors.subject
                          ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                          : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-100"
                      }`}
                    />

                    <ModalFieldError
                      message={errors.subject}
                    />
                  </div>
                ) : null}

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="template-body"
                      className="text-sm font-semibold text-gray-700"
                    >
                      Message body
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setVariableTarget("body")
                      }
                      className={`text-xs font-semibold ${
                        variableTarget === "body"
                          ? "text-indigo-700"
                          : "text-gray-500 hover:text-indigo-700"
                      }`}
                    >
                      Insert variables here
                    </button>
                  </div>

                  <textarea
                    ref={bodyTextAreaRef}
                    id="template-body"
                    value={form.body}
                    onFocus={() =>
                      setVariableTarget("body")
                    }
                    onChange={(event) =>
                      updateField(
                        "body",
                        event.target.value
                      )
                    }
                    rows={10}
                    maxLength={characterLimit}
                    placeholder={
                      "Hello {{customerName}},\n\nYour appointment is booked for {{appointmentDate}} at {{appointmentTime}}."
                    }
                    disabled={saving}
                    className={`w-full resize-y rounded-lg border px-3 py-3 text-sm leading-6 text-gray-900 outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                      errors.body
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                        : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-100"
                    }`}
                  />

                  <div className="mt-1 flex items-start justify-between gap-3">
                    <ModalFieldError
                      message={errors.body}
                    />

                    <p
                      className={`ml-auto shrink-0 text-xs ${
                        form.body.length >
                        characterLimit * 0.9
                          ? "font-semibold text-orange-600"
                          : "text-gray-400"
                      }`}
                    >
                      {form.body.length.toLocaleString(
                        "en-GB"
                      )}
                      /
                      {characterLimit.toLocaleString(
                        "en-GB"
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="template-tags"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Tags
                  </label>

                  <input
                    id="template-tags"
                    type="text"
                    value={form.tags}
                    onChange={(event) =>
                      updateField(
                        "tags",
                        event.target.value
                      )
                    }
                    placeholder="reminder, appointment, customer-care"
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                  />

                  <p className="mt-1.5 text-xs text-gray-500">
                    Separate tags with commas.
                  </p>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      updateField(
                        "active",
                        event.target.checked
                      )
                    }
                    disabled={saving}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />

                  <span>
                    <span className="block text-sm font-semibold text-gray-800">
                      Active template
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-gray-500">
                      Active templates can be selected
                      when composing customer
                      communications.
                    </span>
                  </span>
                </label>
              </div>

              <aside className="space-y-5">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2">
                    <Braces
                      className="text-indigo-600"
                      size={18}
                    />

                    <h3 className="font-semibold text-gray-900">
                      Template variables
                    </h3>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    Select where the variable should
                    appear, then insert it into the
                    template.
                  </p>

                  <div className="mt-4 flex gap-2">
                    {form.channel === "email" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setVariableTarget(
                            "subject"
                          )
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          variableTarget ===
                          "subject"
                            ? "bg-indigo-600 text-white"
                            : "border border-gray-300 bg-white text-gray-600"
                        }`}
                      >
                        Subject
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() =>
                        setVariableTarget("body")
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        variableTarget === "body"
                          ? "bg-indigo-600 text-white"
                          : "border border-gray-300 bg-white text-gray-600"
                      }`}
                    >
                      Message
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {COMMON_VARIABLES.map(
                      (variableName) => (
                        <button
                          key={variableName}
                          type="button"
                          onClick={() =>
                            insertVariable(
                              variableName
                            )
                          }
                          disabled={saving}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
                        >
                          <Plus size={12} />
                          {variableName}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Detected variables
                      </h3>

                      <p className="mt-1 text-xs text-gray-500">
                        Automatically extracted from
                        the content.
                      </p>
                    </div>

                    <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                      {extractedVariables.length}
                    </span>
                  </div>

                  {extractedVariables.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {extractedVariables.map(
                        (variableName) => (
                          <span
                            key={variableName}
                            className="rounded-lg bg-gray-100 px-2.5 py-1.5 font-mono text-xs text-gray-700"
                          >
                            {`{{${variableName}}}`}
                          </span>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-gray-500">
                      No variables have been added.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex items-center gap-2">
                    <Eye
                      className="text-indigo-700"
                      size={18}
                    />

                    <h3 className="font-semibold text-indigo-900">
                      Message preview
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setPreviewOpen(
                        (currentValue) =>
                          !currentValue
                      )
                    }
                    className="mt-4 w-full rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    {previewOpen
                      ? "Hide Preview"
                      : "Show Preview"}
                  </button>

                  {previewOpen ? (
                    <div className="mt-4 rounded-lg border border-indigo-200 bg-white p-4">
                      {form.channel ===
                        "email" &&
                      previewSubject ? (
                        <div className="border-b border-gray-100 pb-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Subject
                          </p>

                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {previewSubject}
                          </p>
                        </div>
                      ) : null}

                      <div
                        className={
                          form.channel ===
                            "email" &&
                          previewSubject
                            ? "pt-3"
                            : ""
                        }
                      >
                        <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {previewBody ||
                            "Your message preview will appear here."}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </aside>
            </div>
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              Variables use the format{" "}
              <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-gray-700">
                {"{{customerName}}"}
              </code>
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => onClose?.()}
                disabled={saving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-w-36 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    {editing ? (
                      <Check size={17} />
                    ) : (
                      <Save size={17} />
                    )}

                    {editing
                      ? "Save Changes"
                      : "Create Template"}
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}