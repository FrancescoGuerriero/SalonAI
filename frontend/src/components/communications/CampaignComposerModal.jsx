
  import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Braces,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  Smartphone,
  Users,
  X,
} from "lucide-react";

import CampaignAudienceSelector from "./CampaignAudienceSelector";

import {
  createCommunicationCampaign,
  getCommunicationCampaignErrorMessage,
  previewNewCampaignAudience,
  updateCommunicationCampaign,
} from "../../services/communicationCampaignApi";

import {
  getCommunicationTemplates,
} from "../../services/communicationTemplateApi";

import CampaignAiWriterPanel from "./CampaignAiWriterPanel.jsx";

const STEPS = [
  {
    id: "details",
    label: "Details",
    icon: FileText,
  },
  {
    id: "message",
    label: "Message",
    icon: MessageCircle,
  },
  {
    id: "audience",
    label: "Audience",
    icon: Users,
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: CalendarClock,
  },
  {
    id: "review",
    label: "Review",
    icon: Eye,
  },
];

const CAMPAIGN_TYPES = [
  {
    value: "general",
    label: "General",
  },
  {
    value: "promotion",
    label: "Promotion",
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
    value: "dormant_customer",
    label: "Dormant Customer",
  },
  {
    value: "birthday",
    label: "Birthday",
  },
];

const CHANNELS = [
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

const SEND_MODES = [
  {
    value: "draft",
    label: "Save as Draft",
    description:
      "Save the campaign without scheduling or launching it.",
    icon: Save,
  },
  {
    value: "immediate",
    label: "Ready to Launch",
    description:
      "Save the campaign so it can be launched immediately from the campaign page.",
    icon: Send,
  },
  {
    value: "scheduled",
    label: "Schedule Campaign",
    description:
      "Schedule the campaign for a future date and time.",
    icon: CalendarClock,
  },
];

const COMMON_VARIABLES = [
  "customerName",
  "firstName",
  "lastName",
  "customerEmail",
  "customerPhone",
  "salonName",
  "salonPhone",
  "salonEmail",
  "appointmentDate",
  "appointmentTime",
  "stylistName",
  "serviceName",
  "bookingReference",
  "campaignName",
  "rebookingLink",
  "discountCode",
  "discountAmount",
];

const SAMPLE_VARIABLE_VALUES = {
  customerName: "Sophia Brown",
  firstName: "Sophia",
  lastName: "Brown",
  customerEmail: "sophia@example.com",
  customerPhone: "07123 456789",
  salonName: "SalonAI",
  salonPhone: "020 1234 5678",
  salonEmail: "hello@salonai.co.uk",
  appointmentDate: "24 July 2026",
  appointmentTime: "14:30",
  stylistName: "Emma",
  serviceName: "Cut and Blow Dry",
  bookingReference: "SAL-1024",
  campaignName: "Summer Hair Offer",
  rebookingLink:
    "https://salonai.example/booking",
  discountCode: "SUMMER20",
  discountAmount: "20%",
};

const DEFAULT_AUDIENCE = {
  type: "all_customers",
  segments: [],
  customerIds: [],
  excludedCustomerIds: [],

  filters: {
    dormantDays: 60,
    minimumSpend: null,
    maximumSpend: null,
    minimumAppointments: null,
    maximumAppointments: null,
    lastAppointmentBefore: null,
    lastAppointmentAfter: null,
    appointmentDateFrom: null,
    appointmentDateTo: null,
    preferredStylist: null,
    preferredService: null,
    tags: [],
    excludeTags: [],
    hasEmail: null,
    hasPhone: null,
    birthdayMonth: null,
    customQuery: {},
  },

  estimatedRecipients: 0,
  calculatedAt: null,
};

const DEFAULT_OPTIONS = {
  trackDelivery: true,
  trackOpens: true,
  trackResponses: true,
  requireContactConsent: true,
  excludeUnsubscribed: true,
  excludeInvalidContacts: true,
  preventDuplicateRecipients: true,
  createContactLogs: true,
  dryRun: false,
};

const DEFAULT_SCHEDULE = {
  mode: "draft",
  scheduledAt: "",
  timezone: "Europe/London",
  batchSize: 100,
  delayBetweenBatchesSeconds: 0,
};

const EMPTY_FORM = {
  name: "",
  description: "",
  campaignType: "general",
  channel: "email",
  template: "",
  subject: "",
  body: "",
  variables: [],
  variableValues: {},
  audience: DEFAULT_AUDIENCE,
  schedule: DEFAULT_SCHEDULE,
  options: DEFAULT_OPTIONS,
};

function getRecordId(record) {
  return String(
    record?._id ||
      record?.id ||
      record ||
      ""
  ).trim();
}

function getTemplateName(template) {
  return (
    template?.name ||
    template?.title ||
    "Untitled Template"
  );
}

function normalizeTemplatesResponse(response) {
  const payload = response?.data ?? response ?? {};

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.templates)) {
    return payload.templates;
  }

  if (
    Array.isArray(payload.data?.templates)
  ) {
    return payload.data.templates;
  }

  return [];
}

function normalizeAudience(audience) {
  return {
    ...DEFAULT_AUDIENCE,
    ...(audience || {}),

    segments: Array.isArray(
      audience?.segments
    )
      ? audience.segments
      : [],

    customerIds: Array.isArray(
      audience?.customerIds
    )
      ? audience.customerIds
      : [],

    excludedCustomerIds: Array.isArray(
      audience?.excludedCustomerIds
    )
      ? audience.excludedCustomerIds
      : [],

    filters: {
      ...DEFAULT_AUDIENCE.filters,
      ...(audience?.filters || {}),

      tags: Array.isArray(
        audience?.filters?.tags
      )
        ? audience.filters.tags
        : [],

      excludeTags: Array.isArray(
        audience?.filters?.excludeTags
      )
        ? audience.filters.excludeTags
        : [],

      customQuery:
        audience?.filters?.customQuery &&
        typeof audience.filters
          .customQuery === "object"
          ? audience.filters.customQuery
          : {},
    },
  };
}

function toDateTimeLocal(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset =
    date.getTimezoneOffset() * 60000;

  return new Date(
    date.getTime() - timezoneOffset
  )
    .toISOString()
    .slice(0, 16);
}

function normalizeCampaign(campaign) {
  if (!campaign) {
    return EMPTY_FORM;
  }

  return {
    name: campaign.name || "",
    description:
      campaign.description || "",

    campaignType:
      campaign.campaignType || "general",

    channel:
      campaign.channel || "email",

    template: getRecordId(
      campaign.template
    ),

    subject:
      campaign.subject || "",

    body:
      campaign.body || "",

    variables: Array.isArray(
      campaign.variables
    )
      ? campaign.variables
      : [],

    variableValues:
      campaign.variableValues &&
      typeof campaign.variableValues ===
        "object"
        ? campaign.variableValues
        : {},

    audience: normalizeAudience(
      campaign.audience
    ),

    schedule: {
      ...DEFAULT_SCHEDULE,
      ...(campaign.schedule || {}),

      scheduledAt: toDateTimeLocal(
        campaign.schedule?.scheduledAt
      ),
    },

    options: {
      ...DEFAULT_OPTIONS,
      ...(campaign.options || {}),
    },
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

function renderMessage(value, variables) {
  return String(value || "").replace(
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g,
    (placeholder, variableName) => {
      const replacement =
        variables?.[variableName];

      if (
        replacement === undefined ||
        replacement === null ||
        replacement === ""
      ) {
        return placeholder;
      }

      return String(replacement);
    }
  );
}

function getMessageCharacterLimit(channel) {
  if (channel === "sms") {
    return 480;
  }

  if (channel === "whatsapp") {
    return 4096;
  }

  return 10000;
}

function getCampaignTypeLabel(value) {
  return (
    CAMPAIGN_TYPES.find(
      (option) => option.value === value
    )?.label || "General"
  );
}

function getChannelLabel(value) {
  return (
    CHANNELS.find(
      (option) => option.value === value
    )?.label || value
  );
}

function getAudienceLabel(value) {
  const labels = {
    all_customers: "All Customers",
    segments: "Customer Segments",
    selected_customers:
      "Selected Customers",
    custom_filters: "Custom Filters",
  };

  return labels[value] || "Audience";
}

function getAudienceDescription(audience) {
  if (
    audience.type === "selected_customers"
  ) {
    const count =
      audience.customerIds?.length || 0;

    return `${count} selected customer${
      count === 1 ? "" : "s"
    }`;
  }

  if (audience.type === "segments") {
    const count =
      audience.segments?.length || 0;

    return `${count} customer segment${
      count === 1 ? "" : "s"
    }`;
  }

  if (
    audience.type === "custom_filters"
  ) {
    return "Customers matching custom filters";
  }

  return "All eligible customers";
}

function prepareCustomerIds(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map(getRecordId)
        .filter(Boolean)
    )
  );
}

function mergeVariableNames(
  ...groups
) {
  return Array.from(
    new Set(
      groups
        .flatMap((group) =>
          Array.isArray(group)
            ? group
            : []
        )
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
}

function validateStep(stepId, form) {
  const errors = {};

  if (stepId === "details") {
    if (!form.name.trim()) {
      errors.name =
        "Campaign name is required.";
    } else if (
      form.name.trim().length < 2
    ) {
      errors.name =
        "Campaign name must contain at least 2 characters.";
    }

    if (!form.channel) {
      errors.channel =
        "Communication channel is required.";
    }

    if (!form.campaignType) {
      errors.campaignType =
        "Campaign type is required.";
    }
  }

  if (stepId === "message") {
    if (
      form.channel === "email" &&
      !form.subject.trim()
    ) {
      errors.subject =
        "Email campaigns require a subject.";
    }

    if (!form.body.trim()) {
      errors.body =
        "Campaign message is required.";
    }

    const characterLimit =
      getMessageCharacterLimit(
        form.channel
      );

    if (
      form.body.length > characterLimit
    ) {
      errors.body = `The message cannot exceed ${characterLimit.toLocaleString(
        "en-GB"
      )} characters for this channel.`;
    }
  }

  if (stepId === "audience") {
    if (
      form.audience.type ===
        "selected_customers" &&
      form.audience.customerIds.length === 0
    ) {
      errors.audience =
        "Select at least one customer.";
    }

    if (
      form.audience.type === "segments" &&
      form.audience.segments.length === 0
    ) {
      errors.audience =
        "Select at least one customer segment.";
    }
  }

  if (stepId === "schedule") {
    if (
      form.schedule.mode === "scheduled"
    ) {
      if (!form.schedule.scheduledAt) {
        errors.scheduledAt =
          "Select a future campaign date and time.";
      } else {
        const scheduledDate = new Date(
          form.schedule.scheduledAt
        );

        if (
          Number.isNaN(
            scheduledDate.getTime()
          ) ||
          scheduledDate.getTime() <=
            Date.now()
        ) {
          errors.scheduledAt =
            "The scheduled date and time must be in the future.";
        }
      }
    }

    if (
      Number(form.schedule.batchSize) < 1 ||
      Number(form.schedule.batchSize) >
        1000
    ) {
      errors.batchSize =
        "Batch size must be between 1 and 1,000.";
    }

    if (
      Number(
        form.schedule
          .delayBetweenBatchesSeconds
      ) < 0
    ) {
      errors.delayBetweenBatchesSeconds =
        "Batch delay cannot be negative.";
    }
  }

  return errors;
}

function validateEntireForm(form) {
  return {
    ...validateStep("details", form),
    ...validateStep("message", form),
    ...validateStep("audience", form),
    ...validateStep("schedule", form),
  };
}

function FieldError({ message }) {
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

function OptionCheckbox({
  title,
  description,
  checked,
  disabled,
  onChange,
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.checked)
        }
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />

      <span>
        <span className="block text-sm font-semibold text-gray-900">
          {title}
        </span>

        <span className="mt-1 block text-xs leading-5 text-gray-500">
          {description}
        </span>
      </span>
    </label>
  );
}

export default function CampaignComposerModal({
  open = false,
  campaign = null,
  initialTemplate = null,
  onClose,
  onSaved,
}) {
  const subjectInputRef = useRef(null);
  const bodyTextAreaRef = useRef(null);

  const [form, setForm] = useState(
    EMPTY_FORM
  );

  const [currentStep, setCurrentStep] =
    useState(0);

  const [templates, setTemplates] =
    useState([]);

  const [loadingTemplates, setLoadingTemplates] =
    useState(false);

  const [templateError, setTemplateError] =
    useState("");

  const [errors, setErrors] = useState({});

  const [requestError, setRequestError] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [activeEditor, setActiveEditor] =
    useState("body");

  const [audiencePreview, setAudiencePreview] =
    useState(null);

  const [previewingAudience, setPreviewingAudience] =
    useState(false);

  const [
    audiencePreviewError,
    setAudiencePreviewError,
  ] = useState("");

  const campaignId =
    getRecordId(campaign);

  const editing = Boolean(campaignId);

  const extractedVariables = useMemo(
    () =>
      extractVariables(
        form.subject,
        form.body
      ),
    [form.subject, form.body]
  );

  const previewVariables = useMemo(
    () => ({
      ...SAMPLE_VARIABLE_VALUES,
      ...form.variableValues,
      campaignName:
        form.name ||
        SAMPLE_VARIABLE_VALUES.campaignName,
    }),
    [
      form.variableValues,
      form.name,
    ]
  );

  const previewSubject = useMemo(
    () =>
      renderMessage(
        form.subject,
        previewVariables
      ),
    [form.subject, previewVariables]
  );

  const previewBody = useMemo(
    () =>
      renderMessage(
        form.body,
        previewVariables
      ),
    [form.body, previewVariables]
  );

  const availableTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.active !== false &&
          (!form.channel ||
            template.channel ===
              form.channel)
      ),
    [templates, form.channel]
  );

  const selectedTemplate = useMemo(
    () =>
      templates.find(
        (template) =>
          getRecordId(template) ===
          form.template
      ) || null,
    [templates, form.template]
  );

  const characterLimit =
    getMessageCharacterLimit(
      form.channel
    );

  const currentStepDefinition =
    STEPS[currentStep];

  const lastStep =
    currentStep === STEPS.length - 1;

  useEffect(() => {
    if (!open) {
      return;
    }

    let initialForm =
      normalizeCampaign(campaign);

    if (
      !campaign &&
      initialTemplate
    ) {
      initialForm = {
        ...initialForm,

        template:
          getRecordId(initialTemplate),

        channel:
          initialTemplate.channel ||
          initialForm.channel,

        campaignType:
          initialTemplate.campaignType ||
          initialForm.campaignType,

        subject:
          initialTemplate.subject || "",

        body:
          initialTemplate.body || "",

        variables: Array.isArray(
          initialTemplate.variables
        )
          ? initialTemplate.variables
          : [],
      };
    }

    setForm(initialForm);
    setCurrentStep(0);
    setErrors({});
    setRequestError("");
    setTemplateError("");
    setAudiencePreview(null);
    setAudiencePreviewError("");
    setActiveEditor("body");
  }, [
    open,
    campaign,
    initialTemplate,
  ]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;

    async function loadTemplates() {
      try {
        setLoadingTemplates(true);
        setTemplateError("");

        const response =
          await getCommunicationTemplates({
            active: true,
            limit: 100,
            sort: "name_asc",
          });

        if (!cancelled) {
          setTemplates(
            normalizeTemplatesResponse(
              response
            )
          );
        }
      } catch (error) {
        if (!cancelled) {
          setTemplateError(
            error?.response?.data?.message ||
              error?.message ||
              "Unable to load message templates."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingTemplates(false);
        }
      }
    }

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleEscape(event) {
      if (
        event.key === "Escape" &&
        !saving &&
        !previewingAudience
      ) {
        onClose?.();
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );

      document.body.style.overflow = "";
    };
  }, [
    open,
    saving,
    previewingAudience,
    onClose,
  ]);

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

  function updateSchedule(field, value) {
    setForm((currentForm) => ({
      ...currentForm,

      schedule: {
        ...currentForm.schedule,
        [field]: value,
      },
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: "",
    }));

    setRequestError("");
  }

  function updateOption(field, value) {
    setForm((currentForm) => ({
      ...currentForm,

      options: {
        ...currentForm.options,
        [field]: value,
      },
    }));

    setRequestError("");
  }

  function updateVariableValue(
    variableName,
    value
  ) {
    setForm((currentForm) => ({
      ...currentForm,

      variableValues: {
        ...currentForm.variableValues,
        [variableName]: value,
      },
    }));
  }

  function handleChannelChange(channel) {
    setForm((currentForm) => ({
      ...currentForm,
      channel,

      template:
        currentForm.template &&
        templates.find(
          (template) =>
            getRecordId(template) ===
              currentForm.template &&
            template.channel === channel
        )
          ? currentForm.template
          : "",

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

    setAudiencePreview(null);
    setAudiencePreviewError("");
  }

  function handleTemplateChange(templateId) {
    if (!templateId) {
      updateField("template", "");
      return;
    }

    const template = templates.find(
      (candidate) =>
        getRecordId(candidate) ===
        templateId
    );

    if (!template) {
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,

      template: templateId,

      channel:
        template.channel ||
        currentForm.channel,

      campaignType:
        template.campaignType ||
        currentForm.campaignType,

      subject:
        template.subject || "",

      body:
        template.body || "",

      variables: Array.from(
        new Set([
          ...(currentForm.variables || []),
          ...(template.variables || []),
        ])
      ).sort(),
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
    const placeholder =
      `{{${variableName}}}`;

    const field =
      activeEditor === "subject" &&
      form.channel === "email"
        ? "subject"
        : "body";

    const input =
      field === "subject"
        ? subjectInputRef.current
        : bodyTextAreaRef.current;

    const currentValue =
      form[field] || "";

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
      currentValue.slice(
        0,
        selectionStart
      ) +
      placeholder +
      currentValue.slice(
        selectionEnd
      );

    updateField(
      field,
      nextValue
    );

    window.requestAnimationFrame(
      () => {
        input.focus();

        const nextPosition =
          selectionStart +
          placeholder.length;

        input.setSelectionRange(
          nextPosition,
          nextPosition
        );
      }
    );
  }

  function handleApplyAiCopy({
    subject = "",
    message = "",
    body = "",
    variables = [],
    replacementMode = "replace",
  }) {
    const generatedSubject =
      String(subject || "")
        .trim()
        .replace(/\s+/g, " ");

    const generatedMessage =
      String(
        message ||
          body ||
          ""
      ).trim();

    if (!generatedMessage) {
      throw new Error(
        "The generated campaign message is empty."
      );
    }

    const mergedVariables =
      mergeVariableNames(
        form.variables,
        extractedVariables,
        variables,
        extractVariables(
          generatedSubject,
          generatedMessage
        )
      );

    if (
      replacementMode === "insert"
    ) {
      const field =
        activeEditor === "subject" &&
        form.channel === "email"
          ? "subject"
          : "body";

      const generatedText =
        field === "subject"
          ? generatedSubject
          : generatedMessage;

      if (!generatedText) {
        throw new Error(
          field === "subject"
            ? "No email subject was generated."
            : "No campaign message was generated."
        );
      }

      const input =
        field === "subject"
          ? subjectInputRef.current
          : bodyTextAreaRef.current;

      const currentValue =
        form[field] || "";

      const selectionStart =
        input?.selectionStart ??
        currentValue.length;

      const selectionEnd =
        input?.selectionEnd ??
        selectionStart;

      const nextValue =
        currentValue.slice(
          0,
          selectionStart
        ) +
        generatedText +
        currentValue.slice(
          selectionEnd
        );

      if (
        field === "subject" &&
        nextValue.length > 200
      ) {
        throw new Error(
          "Inserting the generated subject would exceed the 200-character subject limit."
        );
      }

      if (
        field === "body" &&
        nextValue.length >
          characterLimit
      ) {
        throw new Error(
          `Inserting the generated message would exceed the ${characterLimit.toLocaleString(
            "en-GB"
          )}-character limit for ${getChannelLabel(
            form.channel
          )}.`
        );
      }

      setForm(
        (currentForm) => ({
          ...currentForm,

          [field]:
            nextValue,

          variables:
            mergedVariables,
        })
      );

      setErrors(
        (currentErrors) => ({
          ...currentErrors,
          [field]: "",
        })
      );

      setRequestError("");

      window.requestAnimationFrame(
        () => {
          if (!input) {
            return;
          }

          input.focus();

          const nextPosition =
            selectionStart +
            generatedText.length;

          input.setSelectionRange(
            nextPosition,
            nextPosition
          );
        }
      );

      return;
    }

    let nextSubject =
      form.channel === "email"
        ? generatedSubject
        : "";

    let nextBody =
      generatedMessage;

    if (
      replacementMode === "append"
    ) {
      nextSubject =
        form.channel === "email"
          ? form.subject.trim() ||
            generatedSubject
          : "";

      nextBody =
        form.body.trim()
          ? `${form.body.trimEnd()}\n\n${generatedMessage}`
          : generatedMessage;
    }

    if (
      replacementMode === "replace" &&
      form.channel === "email" &&
      !nextSubject
    ) {
      nextSubject =
        form.subject;
    }

    if (
      nextSubject.length > 200
    ) {
      throw new Error(
        "The generated email subject exceeds the 200-character limit."
      );
    }

    if (
      nextBody.length >
      characterLimit
    ) {
      throw new Error(
        `Applying the generated message would exceed the ${characterLimit.toLocaleString(
          "en-GB"
        )}-character limit for ${getChannelLabel(
          form.channel
        )}.`
      );
    }

    setForm(
      (currentForm) => ({
        ...currentForm,

        subject:
          currentForm.channel ===
          "email"
            ? nextSubject
            : "",

        body:
          nextBody,

        variables:
          mergedVariables,
      })
    );

    setErrors(
      (currentErrors) => ({
        ...currentErrors,
        subject: "",
        body: "",
      })
    );

    setRequestError("");
    setActiveEditor("body");

    window.requestAnimationFrame(
      () => {
        bodyTextAreaRef.current?.focus();
      }
    );
  }

  function handleAudienceChange(audience) {
    setForm((currentForm) => ({
      ...currentForm,
      audience,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      audience: "",
    }));

    setAudiencePreview(null);
    setAudiencePreviewError("");
  }

  function preparePayload() {
    const customerIds =
      prepareCustomerIds(
        form.audience.customerIds
      );

    const excludedCustomerIds =
      prepareCustomerIds(
        form.audience
          .excludedCustomerIds
      );

    let scheduledAt = null;

    if (
      form.schedule.mode === "scheduled"
    ) {
      scheduledAt = new Date(
        form.schedule.scheduledAt
      ).toISOString();
    }

    return {
      name: form.name.trim(),

      description:
        form.description.trim(),

      campaignType:
        form.campaignType,

      channel: form.channel,

      template:
        form.template || null,

      subject:
        form.channel === "email"
          ? form.subject.trim()
          : "",

      body: form.body.trim(),

      variables:
        extractedVariables,

      variableValues:
        form.variableValues,

      audience: {
        ...form.audience,
        customerIds,
        excludedCustomerIds,
      },

      schedule: {
        mode: form.schedule.mode,
        scheduledAt,

        timezone:
          form.schedule.timezone ||
          "Europe/London",

        batchSize:
          Number(
            form.schedule.batchSize
          ) || 100,

        delayBetweenBatchesSeconds:
          Number(
            form.schedule
              .delayBetweenBatchesSeconds
          ) || 0,
      },

      options: {
        ...form.options,
      },
    };
  }

  async function handleAudiencePreview() {
    const validationErrors = {
      ...validateStep(
        "details",
        form
      ),
      ...validateStep(
        "message",
        form
      ),
      ...validateStep(
        "audience",
        form
      ),
    };

    if (
      Object.keys(validationErrors).length >
      0
    ) {
      setErrors(validationErrors);

      setAudiencePreviewError(
        "Complete the campaign details, message and audience before calculating the preview."
      );

      return;
    }

    try {
      setPreviewingAudience(true);
      setAudiencePreviewError("");
      setAudiencePreview(null);

      const response =
        await previewNewCampaignAudience(
          preparePayload(),
          {
            previewLimit: 10,
          }
        );

      setAudiencePreview(
        response?.preview ||
          response?.data?.preview ||
          response
      );

      setForm((currentForm) => ({
        ...currentForm,

        audience: {
          ...currentForm.audience,

          estimatedRecipients:
            Number(
              response?.preview
                ?.estimatedRecipients ??
                response?.data?.preview
                  ?.estimatedRecipients ??
                response
                  ?.estimatedRecipients ??
                0
            ),

          calculatedAt:
            new Date().toISOString(),
        },
      }));
    } catch (error) {
      setAudiencePreviewError(
        getCommunicationCampaignErrorMessage(
          error,
          "Unable to calculate the campaign audience."
        )
      );
    } finally {
      setPreviewingAudience(false);
    }
  }

  function handleNext() {
    const validationErrors =
      validateStep(
        currentStepDefinition.id,
        form
      );

    if (
      Object.keys(validationErrors).length >
      0
    ) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setCurrentStep((currentValue) =>
      Math.min(
        currentValue + 1,
        STEPS.length - 1
      )
    );
  }

  function handlePrevious() {
    setErrors({});
    setCurrentStep((currentValue) =>
      Math.max(currentValue - 1, 0)
    );
  }

  function goToStep(stepIndex) {
    if (
      stepIndex < currentStep
    ) {
      setErrors({});
      setCurrentStep(stepIndex);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationErrors =
      validateEntireForm(form);

    if (
      Object.keys(validationErrors).length >
      0
    ) {
      setErrors(validationErrors);

      const firstInvalidStep =
        STEPS.findIndex((step) =>
          Object.keys(
            validateStep(step.id, form)
          ).length > 0
        );

      if (firstInvalidStep >= 0) {
        setCurrentStep(firstInvalidStep);
      }

      return;
    }

    try {
      setSaving(true);
      setRequestError("");
      setErrors({});

      const payload =
        preparePayload();

      const response = editing
        ? await updateCommunicationCampaign(
            campaignId,
            payload
          )
        : await createCommunicationCampaign(
            payload
          );

      const savedCampaign =
        response?.campaign ||
        response?.data?.campaign ||
        response?.data ||
        response;

      onSaved?.(savedCampaign);
    } catch (error) {
      setRequestError(
        getCommunicationCampaignErrorMessage(
          error,
          editing
            ? "Unable to update the communication campaign."
            : "Unable to create the communication campaign."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  function handleBackdropClick(event) {
    if (
      event.target ===
        event.currentTarget &&
      !saving &&
      !previewingAudience
    ) {
      onClose?.();
    }
  }

  function renderDetailsStep() {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Campaign details
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Define the campaign name, purpose
            and communication channel.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="campaign-name"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Campaign name
            </label>

            <input
              id="campaign-name"
              type="text"
              value={form.name}
              onChange={(event) =>
                updateField(
                  "name",
                  event.target.value
                )
              }
              maxLength={150}
              disabled={saving}
              placeholder="Summer customer promotion"
              className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                errors.name
                  ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-100"
              }`}
            />

            <FieldError
              message={errors.name}
            />
          </div>

          <div>
            <label
              htmlFor="campaign-type"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Campaign type
            </label>

            <select
              id="campaign-type"
              value={form.campaignType}
              onChange={(event) =>
                updateField(
                  "campaignType",
                  event.target.value
                )
              }
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
            >
              {CAMPAIGN_TYPES.map(
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

            <FieldError
              message={errors.campaignType}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="campaign-description"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Description
          </label>

          <textarea
            id="campaign-description"
            value={form.description}
            onChange={(event) =>
              updateField(
                "description",
                event.target.value
              )
            }
            rows={3}
            maxLength={1000}
            disabled={saving}
            placeholder="Describe the objective of this campaign."
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
          />

          <p className="mt-1 text-right text-xs text-gray-400">
            {form.description.length}/1000
          </p>
        </div>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-gray-700">
            Communication channel
          </legend>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {CHANNELS.map((option) => {
              const Icon = option.icon;

              const selected =
                form.channel === option.value;

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
                  className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-50 ${
                    selected
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Icon size={20} />
                  {option.label}
                </button>
              );
            })}
          </div>

          <FieldError
            message={errors.channel}
          />
        </fieldset>

        <div>
          <label
            htmlFor="campaign-template"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Message template
          </label>

          <select
            id="campaign-template"
            value={form.template}
            onChange={(event) =>
              handleTemplateChange(
                event.target.value
              )
            }
            disabled={
              saving || loadingTemplates
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
          >
            <option value="">
              Start without a template
            </option>

            {availableTemplates.map(
              (template) => (
                <option
                  key={getRecordId(template)}
                  value={getRecordId(template)}
                >
                  {getTemplateName(template)}
                </option>
              )
            )}
          </select>

          {loadingTemplates ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <RefreshCcw
                size={13}
                className="animate-spin"
              />
              Loading templates...
            </p>
          ) : null}

          {templateError ? (
            <FieldError
              message={templateError}
            />
          ) : null}

          {selectedTemplate ? (
            <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-indigo-900">
                {getTemplateName(
                  selectedTemplate
                )}
              </p>

              <p className="mt-1 text-xs leading-5 text-indigo-700">
                {selectedTemplate.description ||
                  "The campaign message has been populated from this template."}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderMessageStep() {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.7fr)]">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Campaign message
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Write the message and add
              personalised customer variables.
            </p>
          </div>
<CampaignAiWriterPanel
  campaignName={
    form.name
  }
  campaignDescription={
    form.description
  }
  campaignType={
    form.campaignType
  }
  channel={
    form.channel
  }
  currentSubject={
    form.subject
  }
  currentMessage={
    form.body
  }
  variables={mergeVariableNames(
    COMMON_VARIABLES,
    form.variables,
    extractedVariables
  )}
  disabled={
    saving ||
    previewingAudience
  }
  onApply={
    handleApplyAiCopy
  }
/>
          {form.channel === "email" ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="campaign-subject"
                  className="text-sm font-semibold text-gray-700"
                >
                  Email subject
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setActiveEditor("subject")
                  }
                  className={`text-xs font-semibold ${
                    activeEditor === "subject"
                      ? "text-indigo-700"
                      : "text-gray-500"
                  }`}
                >
                  Insert variables here
                </button>
              </div>

              <input
                ref={subjectInputRef}
                id="campaign-subject"
                type="text"
                value={form.subject}
                onFocus={() =>
                  setActiveEditor("subject")
                }
                onChange={(event) =>
                  updateField(
                    "subject",
                    event.target.value
                  )
                }
                maxLength={200}
                disabled={saving}
                placeholder="A special offer for {{firstName}}"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:bg-gray-100 ${
                  errors.subject
                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                    : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-100"
                }`}
              />

              <FieldError
                message={errors.subject}
              />
            </div>
          ) : null}

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                htmlFor="campaign-body"
                className="text-sm font-semibold text-gray-700"
              >
                Message body
              </label>

              <button
                type="button"
                onClick={() =>
                  setActiveEditor("body")
                }
                className={`text-xs font-semibold ${
                  activeEditor === "body"
                    ? "text-indigo-700"
                    : "text-gray-500"
                }`}
              >
                Insert variables here
              </button>
            </div>

            <textarea
              ref={bodyTextAreaRef}
              id="campaign-body"
              value={form.body}
              onFocus={() =>
                setActiveEditor("body")
              }
              onChange={(event) =>
                updateField(
                  "body",
                  event.target.value
                )
              }
              rows={13}
              maxLength={characterLimit}
              disabled={saving}
              placeholder={
                "Hello {{firstName}},\n\nWe have a special offer for you at {{salonName}}."
              }
              className={`w-full resize-y rounded-lg border px-3 py-3 text-sm leading-6 outline-none focus:ring-2 disabled:bg-gray-100 ${
                errors.body
                  ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-100"
              }`}
            />

            <div className="mt-1 flex items-start justify-between gap-3">
              <FieldError
                message={errors.body}
              />

              <p className="ml-auto shrink-0 text-xs text-gray-400">
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
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2">
              <Braces
                className="text-indigo-600"
                size={18}
              />

              <h4 className="font-semibold text-gray-900">
                Personalisation variables
              </h4>
            </div>

            <p className="mt-2 text-xs leading-5 text-gray-500">
              Insert a variable into the active
              subject or message field.
            </p>

            <div className="mt-4 flex gap-2">
              {form.channel === "email" ? (
                <button
                  type="button"
                  onClick={() =>
                    setActiveEditor("subject")
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    activeEditor === "subject"
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
                  setActiveEditor("body")
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  activeEditor === "body"
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
                    className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {variableName}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h4 className="font-semibold text-gray-900">
              Detected variables
            </h4>

            {extractedVariables.length > 0 ? (
              <div className="mt-4 space-y-3">
                {extractedVariables.map(
                  (variableName) => (
                    <div key={variableName}>
                      <label
                        htmlFor={`campaign-variable-${variableName}`}
                        className="mb-1.5 block font-mono text-xs font-semibold text-gray-600"
                      >
                        {`{{${variableName}}}`}
                      </label>

                      <input
                        id={`campaign-variable-${variableName}`}
                        type="text"
                        value={
                          form.variableValues[
                            variableName
                          ] || ""
                        }
                        onChange={(event) =>
                          updateVariableValue(
                            variableName,
                            event.target.value
                          )
                        }
                        placeholder={
                          SAMPLE_VARIABLE_VALUES[
                            variableName
                          ] ||
                          `Default ${variableName}`
                        }
                        disabled={saving}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                      />
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                No variables detected.
              </p>
            )}
          </div>
        </aside>
      </div>
    );
  }

  function renderAudienceStep() {
    return (
      <div className="space-y-5">
        <CampaignAudienceSelector
          value={form.audience}
          channel={form.channel}
          disabled={saving}
          preview={audiencePreview}
          previewing={
            previewingAudience
          }
          previewError={
            audiencePreviewError
          }
          onChange={
            handleAudienceChange
          }
          onPreview={
            handleAudiencePreview
          }
        />

        <FieldError
          message={errors.audience}
        />
      </div>
    );
  }

  function renderScheduleStep() {
    return (
      <div className="space-y-7">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Delivery schedule
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Decide when the campaign should
            become available for delivery.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {SEND_MODES.map((option) => {
            const Icon = option.icon;

            const selected =
              form.schedule.mode ===
              option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  updateSchedule(
                    "mode",
                    option.value
                  )
                }
                disabled={saving}
                className={`rounded-xl border p-4 text-left transition disabled:opacity-50 ${
                  selected
                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      selected
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <Icon size={19} />
                  </div>

                  {selected ? (
                    <CheckCircle2
                      className="text-indigo-600"
                      size={19}
                    />
                  ) : null}
                </div>

                <p className="mt-4 font-semibold text-gray-900">
                  {option.label}
                </p>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        {form.schedule.mode ===
        "scheduled" ? (
          <div className="grid gap-5 rounded-xl border border-indigo-200 bg-indigo-50 p-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="campaign-scheduled-at"
                className="mb-2 block text-sm font-semibold text-indigo-900"
              >
                Scheduled date and time
              </label>

              <input
                id="campaign-scheduled-at"
                type="datetime-local"
                value={
                  form.schedule.scheduledAt
                }
                min={toDateTimeLocal(
                  new Date(
                    Date.now() + 60000
                  )
                )}
                onChange={(event) =>
                  updateSchedule(
                    "scheduledAt",
                    event.target.value
                  )
                }
                disabled={saving}
                className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:bg-gray-100 ${
                  errors.scheduledAt
                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                    : "border-indigo-300 focus:border-indigo-500 focus:ring-indigo-100"
                }`}
              />

              <FieldError
                message={errors.scheduledAt}
              />
            </div>

            <div>
              <label
                htmlFor="campaign-timezone"
                className="mb-2 block text-sm font-semibold text-indigo-900"
              >
                Timezone
              </label>

              <select
                id="campaign-timezone"
                value={
                  form.schedule.timezone
                }
                onChange={(event) =>
                  updateSchedule(
                    "timezone",
                    event.target.value
                  )
                }
                disabled={saving}
                className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              >
                <option value="Europe/London">
                  Europe/London
                </option>

                <option value="UTC">
                  UTC
                </option>
              </select>
            </div>
          </div>
        ) : null}

        <div>
          <div className="flex items-center gap-2">
            <Settings2
              className="text-indigo-600"
              size={19}
            />

            <h3 className="font-semibold text-gray-900">
              Delivery processing
            </h3>
          </div>

          <div className="mt-4 grid gap-5 rounded-xl border border-gray-200 bg-gray-50 p-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="campaign-batch-size"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Recipients per batch
              </label>

              <input
                id="campaign-batch-size"
                type="number"
                min="1"
                max="1000"
                value={
                  form.schedule.batchSize
                }
                onChange={(event) =>
                  updateSchedule(
                    "batchSize",
                    event.target.value
                  )
                }
                disabled={saving}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
              />

              <FieldError
                message={errors.batchSize}
              />
            </div>

            <div>
              <label
                htmlFor="campaign-batch-delay"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Delay between batches
              </label>

              <div className="relative">
                <input
                  id="campaign-batch-delay"
                  type="number"
                  min="0"
                  max="86400"
                  value={
                    form.schedule
                      .delayBetweenBatchesSeconds
                  }
                  onChange={(event) =>
                    updateSchedule(
                      "delayBetweenBatchesSeconds",
                      event.target.value
                    )
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-20 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                />

                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  seconds
                </span>
              </div>

              <FieldError
                message={
                  errors.delayBetweenBatchesSeconds
                }
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900">
            Campaign controls
          </h3>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <OptionCheckbox
              title="Require communication consent"
              description="Exclude customers who have explicitly declined communication consent."
              checked={
                form.options
                  .requireContactConsent
              }
              disabled={saving}
              onChange={(value) =>
                updateOption(
                  "requireContactConsent",
                  value
                )
              }
            />

            <OptionCheckbox
              title="Exclude unsubscribed customers"
              description="Do not include customers who have unsubscribed from the selected channel."
              checked={
                form.options
                  .excludeUnsubscribed
              }
              disabled={saving}
              onChange={(value) =>
                updateOption(
                  "excludeUnsubscribed",
                  value
                )
              }
            />

            <OptionCheckbox
              title="Exclude invalid contacts"
              description="Skip customers with missing or invalid email addresses or phone numbers."
              checked={
                form.options
                  .excludeInvalidContacts
              }
              disabled={saving}
              onChange={(value) =>
                updateOption(
                  "excludeInvalidContacts",
                  value
                )
              }
            />

            <OptionCheckbox
              title="Prevent duplicate recipients"
              description="Ensure that each customer appears only once in the campaign."
              checked={
                form.options
                  .preventDuplicateRecipients
              }
              disabled={saving}
              onChange={(value) =>
                updateOption(
                  "preventDuplicateRecipients",
                  value
                )
              }
            />

            <OptionCheckbox
              title="Track delivery"
              description="Record whether campaign messages were successfully delivered."
              checked={
                form.options.trackDelivery
              }
              disabled={saving}
              onChange={(value) =>
                updateOption(
                  "trackDelivery",
                  value
                )
              }
            />

            <OptionCheckbox
              title="Track opens"
              description="Record message opens when the communication provider supports open tracking."
              checked={
                form.options.trackOpens
              }
              disabled={saving}
              onChange={(value) =>
                updateOption(
                  "trackOpens",
                  value
                )
              }
            />

            <OptionCheckbox
              title="Track responses"
              description="Record customer responses associated with this campaign."
              checked={
                form.options
                  .trackResponses
              }
              disabled={saving}
              onChange={(value) =>
                updateOption(
                  "trackResponses",
                  value
                )
              }
            />

            <OptionCheckbox
              title="Create customer contact logs"
              description="Add each queued communication to the customer's contact history."
              checked={
                form.options
                  .createContactLogs
              }
              disabled={saving}
              onChange={(value) =>
                updateOption(
                  "createContactLogs",
                  value
                )
              }
            />

            <OptionCheckbox
              title="Dry-run campaign"
              description="Prepare and validate the campaign without sending real communications."
              checked={
                form.options.dryRun
              }
              disabled={saving}
              onChange={(value) =>
                updateOption(
                  "dryRun",
                  value
                )
              }
            />
          </div>
        </div>
      </div>
    );
  }

  function renderReviewStep() {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Review campaign
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Confirm the campaign configuration
            before saving.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Campaign
            </p>

            <p className="mt-2 font-semibold text-gray-900">
              {form.name ||
                "Untitled Campaign"}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {getCampaignTypeLabel(
                form.campaignType
              )}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Channel
            </p>

            <p className="mt-2 font-semibold text-gray-900">
              {getChannelLabel(
                form.channel
              )}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {selectedTemplate
                ? getTemplateName(
                    selectedTemplate
                  )
                : "Custom message"}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Audience
            </p>

            <p className="mt-2 font-semibold text-gray-900">
              {getAudienceLabel(
                form.audience.type
              )}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {getAudienceDescription(
                form.audience
              )}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Delivery
            </p>

            <p className="mt-2 font-semibold text-gray-900">
              {
                SEND_MODES.find(
                  (option) =>
                    option.value ===
                    form.schedule.mode
                )?.label
              }
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {form.schedule.mode ===
              "scheduled"
                ? new Date(
                    form.schedule.scheduledAt
                  ).toLocaleString("en-GB")
                : `${form.schedule.batchSize} recipients per batch`}
            </p>
          </div>
        </div>

        {audiencePreview ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="text-green-600"
                size={20}
              />

              <h4 className="font-semibold text-green-900">
                Audience validated
              </h4>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-3">
                <p className="text-xs text-gray-500">
                  Eligible
                </p>

                <p className="mt-1 text-xl font-bold text-gray-900">
                  {Number(
                    audiencePreview
                      .estimatedRecipients || 0
                  ).toLocaleString("en-GB")}
                </p>
              </div>

              <div className="rounded-lg bg-white p-3">
                <p className="text-xs text-gray-500">
                  Matched
                </p>

                <p className="mt-1 text-xl font-bold text-gray-900">
                  {Number(
                    audiencePreview
                      .totalMatchedCustomers || 0
                  ).toLocaleString("en-GB")}
                </p>
              </div>

              <div className="rounded-lg bg-white p-3">
                <p className="text-xs text-gray-500">
                  Skipped
                </p>

                <p className="mt-1 text-xl font-bold text-gray-900">
                  {Number(
                    audiencePreview
                      .skippedRecipients || 0
                  ).toLocaleString("en-GB")}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              {form.channel === "email" ? (
                <Mail size={19} />
              ) : form.channel === "sms" ? (
                <Smartphone size={19} />
              ) : form.channel ===
                "whatsapp" ? (
                <MessageCircle size={19} />
              ) : form.channel ===
                "phone" ? (
                <Phone size={19} />
              ) : (
                <FileText size={19} />
              )}
            </div>

            <div>
              <p className="font-semibold text-gray-900">
                Message preview
              </p>

              <p className="text-xs text-gray-500">
                Personalised with sample
                customer details
              </p>
            </div>
          </div>

          {form.channel === "email" ? (
            <div className="border-b border-gray-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Subject
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                {previewSubject ||
                  "No email subject"}
              </p>
            </div>
          ) : null}

          <div className="min-h-64 px-5 py-6">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
              {previewBody ||
                "No message content"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex items-center gap-2">
            <Clock3
              className="text-indigo-600"
              size={19}
            />

            <h4 className="font-semibold text-gray-900">
              Processing configuration
            </h4>
          </div>

          <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-gray-500">
                Batch size
              </dt>

              <dd className="mt-1 font-semibold text-gray-900">
                {Number(
                  form.schedule.batchSize
                ).toLocaleString("en-GB")}
              </dd>
            </div>

            <div>
              <dt className="text-gray-500">
                Delay between batches
              </dt>

              <dd className="mt-1 font-semibold text-gray-900">
                {Number(
                  form.schedule
                    .delayBetweenBatchesSeconds
                ).toLocaleString("en-GB")}{" "}
                seconds
              </dd>
            </div>

            <div>
              <dt className="text-gray-500">
                Variables detected
              </dt>

              <dd className="mt-1 font-semibold text-gray-900">
                {extractedVariables.length}
              </dd>
            </div>

            <div>
              <dt className="text-gray-500">
                Dry run
              </dt>

              <dd className="mt-1 font-semibold text-gray-900">
                {form.options.dryRun
                  ? "Enabled"
                  : "Disabled"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-composer-title"
      onMouseDown={handleBackdropClick}
    >
      <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Send size={22} />
            </div>

            <div>
              <h2
                id="campaign-composer-title"
                className="text-xl font-bold text-gray-900"
              >
                {editing
                  ? "Edit Communication Campaign"
                  : "Create Communication Campaign"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Compose, personalise and schedule
                customer communications.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={
              saving ||
              previewingAudience
            }
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
            aria-label="Close campaign composer"
          >
            <X size={21} />
          </button>
        </header>

        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4 sm:px-7">
          <div className="flex overflow-x-auto">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const active =
                currentStep === index;
              const complete =
                currentStep > index;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() =>
                    goToStep(index)
                  }
                  disabled={
                    index > currentStep ||
                    saving
                  }
                  className="group flex min-w-fit flex-1 items-center"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition ${
                        active
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : complete
                            ? "border-green-600 bg-green-600 text-white"
                            : "border-gray-300 bg-white text-gray-500"
                      }`}
                    >
                      {complete ? (
                        <Check size={15} />
                      ) : (
                        <Icon size={15} />
                      )}
                    </span>

                    <span
                      className={`hidden text-sm font-semibold sm:block ${
                        active
                          ? "text-indigo-700"
                          : complete
                            ? "text-green-700"
                            : "text-gray-500"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {index <
                  STEPS.length - 1 ? (
                    <span
                      className={`mx-3 h-px min-w-5 flex-1 ${
                        complete
                          ? "bg-green-300"
                          : "bg-gray-300"
                      }`}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
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
                    Campaign could not be saved
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    {requestError}
                  </p>
                </div>
              </div>
            ) : null}

            {currentStepDefinition.id ===
            "details"
              ? renderDetailsStep()
              : null}

            {currentStepDefinition.id ===
            "message"
              ? renderMessageStep()
              : null}

            {currentStepDefinition.id ===
            "audience"
              ? renderAudienceStep()
              : null}

            {currentStepDefinition.id ===
            "schedule"
              ? renderScheduleStep()
              : null}

            {currentStepDefinition.id ===
            "review"
              ? renderReviewStep()
              : null}
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div>
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  <ArrowLeft size={17} />
                  Previous
                </button>
              ) : (
                <p className="text-xs text-gray-500">
                  Step {currentStep + 1} of{" "}
                  {STEPS.length}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => onClose?.()}
                disabled={saving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              {!lastStep ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={saving}
                  className="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  Continue
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={17} />

                      {editing
                        ? "Save Changes"
                        : form.schedule.mode ===
                            "scheduled"
                          ? "Schedule Campaign"
                          : "Create Campaign"}
                    </>
                  )}
                </button>
              )}
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}