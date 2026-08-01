import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  Gift,
  HeartHandshake,
  LayoutDashboard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  RotateCcw,
  Save,
  Scissors,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import CustomerNotesPanel from "../components/customers/CustomerNotesPanel.jsx";
import CustomerOperationsPanel from "../components/customers/CustomerOperationsPanel.jsx";

import {
  archiveCustomerProfile,
  createCustomerProfile,
  deleteCustomerProfile,
  getCustomerDisplayName,
  getCustomerInitials,
  getCustomerProfile,
  restoreCustomerProfile,
  updateCustomerConsent,
  updateCustomerProfile,
} from "../Services/customerProfileService.js";

const PROFILE_TABS = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    id: "personal",
    label: "Personal",
    icon: UserRound,
  },
  {
    id: "address",
    label: "Address",
    icon: MapPin,
  },
  {
    id: "hair",
    label: "Hair profile",
    icon: Scissors,
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: CalendarDays,
  },
  {
    id: "consent",
    label: "Consent",
    icon: ShieldCheck,
  },
  {
    id: "loyalty",
    label: "Loyalty",
    icon: Gift,
  },
  {
    id: "notes",
    label: "Notes",
    icon: HeartHandshake,
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: CircleUserRound,
  },
];

const EMPTY_FORM = {
  title: "",
  firstName: "",
  lastName: "",
  preferredName: "",
  pronouns: "",
  email: "",
  phone: "",
  alternativePhone: "",
  dateOfBirth: "",
  gender: "prefer_not_to_say",
  photo: "",
  source: "manual",
  status: "active",

  address: {
    line1: "",
    line2: "",
    city: "",
    county: "",
    postcode: "",
    country: "United Kingdom",
  },

  emergencyContact: {
    name: "",
    relationship: "",
    phone: "",
  },

  hairProfile: {
    hairType: "",
    naturalHairColour: "",
    currentHairColour: "",
    hairColour: "",
    hairLength: "",
    texture: "",
    density: "",
    porosity: "",
    scalpCondition: "",
    concerns: "",
    allergies: "",
    sensitivities: "",
    preferredProducts: "",
    productsToAvoid: "",
    chemicalHistory: "",
    consultationNotes: "",
    lastPatchTestAt: "",
    patchTestResult: "",
  },

  bookingPreferences: {
    preferredDays: [],
    preferredTimeOfDay: "",
    preferredReminderChannel:
      "email",
    accessibilityRequirements: "",
    additionalRequirements: "",
  },

  communicationPreferences: {
    preferredChannel: "email",
    appointmentReminders: true,
    promotionalMessages: true,
    serviceUpdates: true,
    birthdayMessages: true,
    feedbackRequests: true,
    emailUnsubscribed: false,
    smsUnsubscribed: false,
    unsubscribed: false,
    consentSource: "",
  },

  marketing: {
    emailConsent: true,
    smsConsent: false,
    consentSource: "",
  },

  loyaltyTier: "standard",
  membershipStatus: "none",
  membershipName: "",
  membershipStartedAt: "",
  membershipExpiresAt: "",
  referralCode: "",
  tags: "",
  notes: "",
  internalWarnings: "",
};

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function normaliseText(value) {
  return String(value ?? "").trim();
}

function toDateInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
    }
  ).format(date);
}

function formatCurrency(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "£0.00";
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(amount);
}

function formatLabel(value) {
  return normaliseText(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function parseCommaSeparated(value) {
  return Array.from(
    new Set(
      normaliseText(value)
        .split(",")
        .map((entry) =>
          entry.trim()
        )
        .filter(Boolean)
    )
  );
}

function arrayToCommaSeparated(value) {
  return Array.isArray(value)
    ? value.join(", ")
    : "";
}

function getErrorMessage(error) {
  return (
    error?.message ||
    "The customer profile operation failed."
  );
}

function mapCustomerToForm(
  customer
) {
  return {
    ...EMPTY_FORM,

    title:
      customer?.title || "",

    firstName:
      customer?.firstName || "",

    lastName:
      customer?.lastName || "",

    preferredName:
      customer?.preferredName || "",

    pronouns:
      customer?.pronouns || "",

    email:
      customer?.email || "",

    phone:
      customer?.phone || "",

    alternativePhone:
      customer?.alternativePhone ||
      "",

    dateOfBirth:
      toDateInput(
        customer?.dateOfBirth
      ),

    gender:
      customer?.gender ||
      "prefer_not_to_say",

    photo:
      customer?.photo || "",

    source:
      customer?.source ||
      "manual",

    status:
      customer?.status ||
      "active",

    address: {
      ...EMPTY_FORM.address,
      ...(customer?.address || {}),
    },

    emergencyContact: {
      ...EMPTY_FORM.emergencyContact,
      ...(customer?.emergencyContact ||
        {}),
    },

    hairProfile: {
      ...EMPTY_FORM.hairProfile,
      ...(customer?.hairProfile ||
        {}),

      concerns:
        arrayToCommaSeparated(
          customer?.hairProfile
            ?.concerns
        ),

      allergies:
        arrayToCommaSeparated(
          customer?.hairProfile
            ?.allergies
        ),

      sensitivities:
        arrayToCommaSeparated(
          customer?.hairProfile
            ?.sensitivities
        ),

      preferredProducts:
        arrayToCommaSeparated(
          customer?.hairProfile
            ?.preferredProducts
        ),

      productsToAvoid:
        arrayToCommaSeparated(
          customer?.hairProfile
            ?.productsToAvoid
        ),

      lastPatchTestAt:
        toDateInput(
          customer?.hairProfile
            ?.lastPatchTestAt
        ),
    },

    bookingPreferences: {
      ...EMPTY_FORM.bookingPreferences,
      ...(customer?.bookingPreferences ||
        {}),

      preferredDays:
        Array.isArray(
          customer?.bookingPreferences
            ?.preferredDays
        )
          ? customer
              .bookingPreferences
              .preferredDays
          : [],
    },

    communicationPreferences: {
      ...EMPTY_FORM.communicationPreferences,
      ...(customer
        ?.communicationPreferences ||
        {}),
    },

    marketing: {
      ...EMPTY_FORM.marketing,
      ...(customer?.marketing || {}),
    },

    loyaltyTier:
      customer?.loyaltyTier ||
      "standard",

    membershipStatus:
      customer?.membershipStatus ||
      "none",

    membershipName:
      customer?.membershipName || "",

    membershipStartedAt:
      toDateInput(
        customer?.membershipStartedAt
      ),

    membershipExpiresAt:
      toDateInput(
        customer?.membershipExpiresAt
      ),

    referralCode:
      customer?.referralCode || "",

    tags:
      arrayToCommaSeparated(
        customer?.tags
      ),

    notes:
      customer?.notes || "",

    internalWarnings:
      customer?.internalWarnings ||
      "",
  };
}

function buildProfilePayload(form) {
  return {
    title:
      normaliseText(form.title),

    firstName:
      normaliseText(
        form.firstName
      ),

    lastName:
      normaliseText(
        form.lastName
      ),

    preferredName:
      normaliseText(
        form.preferredName
      ),

    pronouns:
      normaliseText(
        form.pronouns
      ),

    email:
      normaliseText(
        form.email
      ).toLowerCase(),

    phone:
      normaliseText(
        form.phone
      ),

    alternativePhone:
      normaliseText(
        form.alternativePhone
      ),

    dateOfBirth:
      form.dateOfBirth || null,

    gender: form.gender,

    photo:
      normaliseText(
        form.photo
      ),

    source: form.source,

    status: form.status,

    address: {
      line1:
        normaliseText(
          form.address.line1
        ),

      line2:
        normaliseText(
          form.address.line2
        ),

      city:
        normaliseText(
          form.address.city
        ),

      county:
        normaliseText(
          form.address.county
        ),

      postcode:
        normaliseText(
          form.address.postcode
        ).toUpperCase(),

      country:
        normaliseText(
          form.address.country
        ) ||
        "United Kingdom",
    },

    emergencyContact: {
      name:
        normaliseText(
          form.emergencyContact
            .name
        ),

      relationship:
        normaliseText(
          form.emergencyContact
            .relationship
        ),

      phone:
        normaliseText(
          form.emergencyContact
            .phone
        ),
    },

    hairProfile: {
      hairType:
        normaliseText(
          form.hairProfile
            .hairType
        ),

      naturalHairColour:
        normaliseText(
          form.hairProfile
            .naturalHairColour
        ),

      currentHairColour:
        normaliseText(
          form.hairProfile
            .currentHairColour
        ),

      hairColour:
        normaliseText(
          form.hairProfile
            .hairColour
        ),

      hairLength:
        form.hairProfile
          .hairLength,

      texture:
        normaliseText(
          form.hairProfile
            .texture
        ),

      density:
        form.hairProfile.density,

      porosity:
        form.hairProfile.porosity,

      scalpCondition:
        normaliseText(
          form.hairProfile
            .scalpCondition
        ),

      concerns:
        parseCommaSeparated(
          form.hairProfile
            .concerns
        ),

      allergies:
        parseCommaSeparated(
          form.hairProfile
            .allergies
        ),

      sensitivities:
        parseCommaSeparated(
          form.hairProfile
            .sensitivities
        ),

      preferredProducts:
        parseCommaSeparated(
          form.hairProfile
            .preferredProducts
        ),

      productsToAvoid:
        parseCommaSeparated(
          form.hairProfile
            .productsToAvoid
        ),

      chemicalHistory:
        normaliseText(
          form.hairProfile
            .chemicalHistory
        ),

      consultationNotes:
        normaliseText(
          form.hairProfile
            .consultationNotes
        ),

      lastPatchTestAt:
        form.hairProfile
          .lastPatchTestAt ||
        null,

      patchTestResult:
        form.hairProfile
          .patchTestResult,
    },

    bookingPreferences: {
      preferredDays:
        form.bookingPreferences
          .preferredDays,

      preferredTimeOfDay:
        form.bookingPreferences
          .preferredTimeOfDay,

      preferredReminderChannel:
        form.bookingPreferences
          .preferredReminderChannel,

      accessibilityRequirements:
        normaliseText(
          form.bookingPreferences
            .accessibilityRequirements
        ),

      additionalRequirements:
        normaliseText(
          form.bookingPreferences
            .additionalRequirements
        ),
    },

    communicationPreferences: {
      ...form.communicationPreferences,

      consentSource:
        normaliseText(
          form.communicationPreferences
            .consentSource
        ),
    },

    marketing: {
      ...form.marketing,

      consentSource:
        normaliseText(
          form.marketing
            .consentSource
        ),
    },

    loyaltyTier:
      form.loyaltyTier,

    membershipStatus:
      form.membershipStatus,

    membershipName:
      normaliseText(
        form.membershipName
      ),

    membershipStartedAt:
      form.membershipStartedAt ||
      null,

    membershipExpiresAt:
      form.membershipExpiresAt ||
      null,

    referralCode:
      normaliseText(
        form.referralCode
      ).toUpperCase(),

    tags:
      parseCommaSeparated(
        form.tags
      ),

    notes:
      normaliseText(
        form.notes
      ),

    internalWarnings:
      normaliseText(
        form.internalWarnings
      ),
  };
}

function statusClass(status) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "inactive":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "archived":
      return "border-slate-300 bg-slate-100 text-slate-700";

    case "deleted":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function AlertMessage({
  type = "error",
  message,
  onClose,
}) {
  if (!message) {
    return null;
  }

  const successful =
    type === "success";

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${
        successful
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <div className="flex items-start gap-3">
        {successful ? (
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0"
          />
        ) : (
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0"
          />
        )}

        <p className="text-sm font-medium">
          {message}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 hover:bg-black/5"
        aria-label="Close notification"
      >
        <XCircle size={18} />
      </button>
    </div>
  );
}

function LoadingButton({
  loading = false,
  disabled = false,
  children,
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      disabled={
        disabled || loading
      }
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <Loader2
          size={17}
          className="animate-spin"
        />
      ) : null}

      {children}
    </button>
  );
}

function Field({
  label,
  id,
  required = false,
  helpText = "",
  children,
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-slate-700"
      >
        {label}

        {required ? (
          <span className="ml-1 text-red-600">
            *
          </span>
        ) : null}
      </label>

      {children}

      {helpText ? (
        <p className="mt-1 text-xs text-slate-500">
          {helpText}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          {title}
        </h2>

        {description ? (
          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        {children}
      </div>
    </section>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}) {
  return (
    <label className="flex items-start justify-between gap-5 rounded-xl border border-slate-200 p-4">
      <span>
        <span className="block text-sm font-semibold text-slate-800">
          {label}
        </span>

        {description ? (
          <span className="mt-1 block text-xs text-slate-500">
            {description}
          </span>
        ) : null}
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300"
      />
    </label>
  );
}

export default function CustomerProfilePage() {
  const {
    customerId,
  } = useParams();

  const navigate =
    useNavigate();

  const isCreating =
    !customerId ||
    customerId === "new";

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    isCreating
      ? "personal"
      : "overview"
  );

  const [
    customer,
    setCustomer,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState(EMPTY_FORM);

  const [
    loading,
    setLoading,
  ] = useState(!isCreating);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    consentSaving,
    setConsentSaving,
  ] = useState(false);

  const [
    lifecycleAction,
    setLifecycleAction,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const loadCustomer =
    useCallback(async () => {
      if (isCreating) {
        setCustomer(null);
        setForm(EMPTY_FORM);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response =
          await getCustomerProfile(
            customerId,
            {
              includeDeleted: true,
            }
          );

        const loadedCustomer =
          response?.customer;

        setCustomer(
          loadedCustomer
        );

        setForm(
          mapCustomerToForm(
            loadedCustomer
          )
        );
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError
          )
        );
      } finally {
        setLoading(false);
      }
    }, [
      customerId,
      isCreating,
    ]);

  useEffect(() => {
    void loadCustomer();
  }, [loadCustomer]);

  const displayName =
    useMemo(
      () =>
        customer
          ? getCustomerDisplayName(
              customer
            )
          : [
              form.firstName,
              form.lastName,
            ]
              .map(normaliseText)
              .filter(Boolean)
              .join(" ") ||
            "New customer",
      [
        customer,
        form.firstName,
        form.lastName,
      ]
    );

  const initials =
    useMemo(
      () =>
        customer
          ? getCustomerInitials(
              customer
            )
          : displayName
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) =>
                part
                  .charAt(0)
                  .toUpperCase()
              )
              .join("") || "NC",
      [customer, displayName]
    );

  const profileCustomerId =
    normaliseText(
      customer?._id ||
        customer?.id ||
        customerId
    );

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function updateField(
    field,
    value
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateNestedField(
    section,
    field,
    value
  ) {
    setForm((current) => ({
      ...current,

      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  }

  function togglePreferredDay(day) {
    setForm((current) => {
      const selectedDays =
        current.bookingPreferences
          .preferredDays;

      const nextDays =
        selectedDays.includes(day)
          ? selectedDays.filter(
              (selectedDay) =>
                selectedDay !== day
            )
          : [
              ...selectedDays,
              day,
            ];

      return {
        ...current,

        bookingPreferences: {
          ...current.bookingPreferences,
          preferredDays:
            nextDays,
        },
      };
    });
  }

  function handleCustomerTagsChanged(
    updatedTags
  ) {
    const safeTags =
      Array.isArray(updatedTags)
        ? updatedTags
        : [];

    setCustomer((current) =>
      current
        ? {
            ...current,
            tags: safeTags,
          }
        : current
    );

    setForm((current) => ({
      ...current,
      tags:
        arrayToCommaSeparated(
          safeTags
        ),
    }));
  }

  async function handleSave(
    event
  ) {
    event.preventDefault();
    clearMessages();

    if (
      !normaliseText(
        form.firstName
      )
    ) {
      setError(
        "Customer first name is required."
      );
      setActiveTab("personal");
      return;
    }

    if (
      !normaliseText(
        form.lastName
      )
    ) {
      setError(
        "Customer last name is required."
      );
      setActiveTab("personal");
      return;
    }

    setSaving(true);

    try {
      const payload =
        buildProfilePayload(
          form
        );

      const response =
        isCreating
          ? await createCustomerProfile(
              payload
            )
          : await updateCustomerProfile(
              customerId,
              payload
            );

      const savedCustomer =
        response?.customer;

      setCustomer(
        savedCustomer
      );

      setForm(
        mapCustomerToForm(
          savedCustomer
        )
      );

      setSuccess(
        response?.message ||
          "Customer profile saved successfully."
      );

      if (
        isCreating &&
        savedCustomer?._id
      ) {
        navigate(
          `/customers/${savedCustomer._id}`,
          {
            replace: true,
          }
        );
      }
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleConsentSave() {
    if (isCreating) {
      setError(
        "Create the customer profile before saving consent separately."
      );
      return;
    }

    setConsentSaving(true);
    clearMessages();

    try {
      const response =
        await updateCustomerConsent(
          customerId,
          {
            preferredChannel:
              form
                .communicationPreferences
                .preferredChannel,

            emailConsent:
              form.marketing
                .emailConsent,

            smsConsent:
              form.marketing
                .smsConsent,

            emailUnsubscribed:
              form
                .communicationPreferences
                .emailUnsubscribed,

            smsUnsubscribed:
              form
                .communicationPreferences
                .smsUnsubscribed,

            unsubscribed:
              form
                .communicationPreferences
                .unsubscribed,

            communicationPreferences:
              form.communicationPreferences,

            marketing:
              form.marketing,

            consentSource:
              form
                .communicationPreferences
                .consentSource ||
              "management_profile",
          }
        );

      const updatedCustomer =
        response?.customer;

      setCustomer(
        updatedCustomer
      );

      setForm(
        mapCustomerToForm(
          updatedCustomer
        )
      );

      setSuccess(
        response?.message ||
          "Communication consent saved successfully."
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setConsentSaving(false);
    }
  }

  async function runLifecycleAction(
    action
  ) {
    if (isCreating) {
      return;
    }

    const descriptions = {
      archive:
        "Archive this customer profile?",
      restore:
        "Restore this customer profile?",
      delete:
        "Delete this customer profile? This performs a soft deletion and removes any linked customer account.",
    };

    const confirmed =
      window.confirm(
        descriptions[action]
      );

    if (!confirmed) {
      return;
    }

    setLifecycleAction(action);
    clearMessages();

    try {
      let response;

      if (action === "archive") {
        response =
          await archiveCustomerProfile(
            customerId
          );
      } else if (
        action === "restore"
      ) {
        response =
          await restoreCustomerProfile(
            customerId
          );
      } else {
        response =
          await deleteCustomerProfile(
            customerId
          );
      }

      const updatedCustomer =
        response?.customer;

      setCustomer(
        updatedCustomer
      );

      setForm(
        mapCustomerToForm(
          updatedCustomer
        )
      );

      setSuccess(
        response?.message ||
          "Customer profile updated successfully."
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setLifecycleAction("");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2
              size={24}
              className="animate-spin"
            />

            Loading customer profile...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() =>
                navigate("/customers")
              }
              className="rounded-xl border border-slate-300 bg-white p-3 text-slate-700 shadow-sm transition hover:bg-slate-100"
              aria-label="Back to customers"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-lg font-bold text-indigo-700">
              {form.photo ? (
                <img
                  src={form.photo}
                  alt={displayName}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                initials
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  {displayName}
                </h1>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                    form.status
                  )}`}
                >
                  {formatLabel(
                    form.status
                  )}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {isCreating
                  ? "Create a complete salon customer profile."
                  : `Customer since ${formatDate(
                      customer?.createdAt
                    )}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {!isCreating ? (
              <LoadingButton
                type="button"
                loading={false}
                onClick={
                  loadCustomer
                }
                className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              >
                <RefreshCcw size={17} />
                Refresh
              </LoadingButton>
            ) : null}

            <LoadingButton
              type="button"
              loading={saving}
              onClick={handleSave}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <Save size={17} />

              {isCreating
                ? "Create profile"
                : "Save profile"}
            </LoadingButton>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <AlertMessage
            type="error"
            message={error}
            onClose={() =>
              setError("")
            }
          />

          <AlertMessage
            type="success"
            message={success}
            onClose={() =>
              setSuccess("")
            }
          />
        </div>

        {!isCreating ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Total spent
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(
                  customer?.totalSpent
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Visits
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {customer?.visitCount ||
                  0}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Loyalty points
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {customer
                  ?.loyaltyPoints || 0}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Last visit
              </p>

              <p className="mt-2 text-base font-bold text-slate-900">
                {formatDate(
                  customer?.lastVisit
                )}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-7 overflow-x-auto">
          <div className="inline-flex min-w-full gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:min-w-0">
            {PROFILE_TABS.map(
              ({
                id,
                label,
                icon: Icon,
              }) => {
                const active =
                  activeTab === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setActiveTab(id)
                    }
                    className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon size={17} />
                    {label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="mt-6">
            {isCreating ? (
              <Section
                title="Customer 360"
                description="Save the customer profile before viewing operational history."
              >
                <p className="text-sm text-slate-600">
                  Appointment, payment, note and communication history becomes
                  available after the profile is created.
                </p>
              </Section>
            ) : (
              <CustomerOperationsPanel
                customerId={customerId}
              />
            )}
          </div>
        ) : null}

        {activeTab ===
        "personal" ? (
          <div className="mt-6 space-y-6">
            <Section
              title="Personal information"
              description="Core identity and contact information for the customer."
            >
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <Field
                  id="customer-title"
                  label="Title"
                >
                  <select
                    id="customer-title"
                    value={form.title}
                    onChange={(event) =>
                      updateField(
                        "title",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      No title
                    </option>
                    <option value="Mr">
                      Mr
                    </option>
                    <option value="Mrs">
                      Mrs
                    </option>
                    <option value="Miss">
                      Miss
                    </option>
                    <option value="Ms">
                      Ms
                    </option>
                    <option value="Mx">
                      Mx
                    </option>
                    <option value="Dr">
                      Dr
                    </option>
                    <option value="Other">
                      Other
                    </option>
                  </select>
                </Field>

                <Field
                  id="customer-first-name"
                  label="First name"
                  required
                >
                  <input
                    id="customer-first-name"
                    type="text"
                    required
                    value={
                      form.firstName
                    }
                    onChange={(event) =>
                      updateField(
                        "firstName",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="customer-last-name"
                  label="Last name"
                  required
                >
                  <input
                    id="customer-last-name"
                    type="text"
                    required
                    value={
                      form.lastName
                    }
                    onChange={(event) =>
                      updateField(
                        "lastName",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="customer-preferred-name"
                  label="Preferred name"
                >
                  <input
                    id="customer-preferred-name"
                    type="text"
                    value={
                      form.preferredName
                    }
                    onChange={(event) =>
                      updateField(
                        "preferredName",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="customer-pronouns"
                  label="Pronouns"
                >
                  <input
                    id="customer-pronouns"
                    type="text"
                    value={
                      form.pronouns
                    }
                    onChange={(event) =>
                      updateField(
                        "pronouns",
                        event.target.value
                      )
                    }
                    placeholder="For example: she/her"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="customer-gender"
                  label="Gender"
                >
                  <select
                    id="customer-gender"
                    value={form.gender}
                    onChange={(event) =>
                      updateField(
                        "gender",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="female">
                      Female
                    </option>
                    <option value="male">
                      Male
                    </option>
                    <option value="non_binary">
                      Non-binary
                    </option>
                    <option value="other">
                      Other
                    </option>
                    <option value="prefer_not_to_say">
                      Prefer not to say
                    </option>
                  </select>
                </Field>

                <Field
                  id="customer-date-of-birth"
                  label="Date of birth"
                >
                  <input
                    id="customer-date-of-birth"
                    type="date"
                    value={
                      form.dateOfBirth
                    }
                    onChange={(event) =>
                      updateField(
                        "dateOfBirth",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="customer-source"
                  label="Customer source"
                >
                  <select
                    id="customer-source"
                    value={form.source}
                    onChange={(event) =>
                      updateField(
                        "source",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="manual">
                      Manual
                    </option>
                    <option value="website">
                      Website
                    </option>
                    <option value="booking">
                      Booking
                    </option>
                    <option value="referral">
                      Referral
                    </option>
                    <option value="import">
                      Import
                    </option>
                    <option value="social_media">
                      Social media
                    </option>
                    <option value="other">
                      Other
                    </option>
                  </select>
                </Field>

                <Field
                  id="customer-status"
                  label="Profile status"
                >
                  <select
                    id="customer-status"
                    value={form.status}
                    onChange={(event) =>
                      updateField(
                        "status",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="active">
                      Active
                    </option>
                    <option value="inactive">
                      Inactive
                    </option>
                    <option value="archived">
                      Archived
                    </option>
                  </select>
                </Field>
              </div>
            </Section>

            <Section
              title="Contact details"
              description="Email and telephone details used for bookings and communications."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  id="customer-email"
                  label="Email address"
                >
                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="customer-email"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField(
                          "email",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </Field>

                <Field
                  id="customer-phone"
                  label="Phone number"
                >
                  <div className="relative">
                    <Phone
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="customer-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        updateField(
                          "phone",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </Field>

                <Field
                  id="customer-alternative-phone"
                  label="Alternative phone"
                >
                  <input
                    id="customer-alternative-phone"
                    type="tel"
                    value={
                      form.alternativePhone
                    }
                    onChange={(event) =>
                      updateField(
                        "alternativePhone",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="customer-photo"
                  label="Profile photo URL"
                >
                  <input
                    id="customer-photo"
                    type="url"
                    value={form.photo}
                    onChange={(event) =>
                      updateField(
                        "photo",
                        event.target.value
                      )
                    }
                    placeholder="https://..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>
              </div>
            </Section>
          </div>
        ) : null}

        {activeTab === "address" ? (
          <div className="mt-6 space-y-6">
            <Section
              title="Postal address"
              description="Address information used for customer records and local marketing."
            >
              <div className="grid gap-5 md:grid-cols-2">
                {[
                  [
                    "line1",
                    "Address line 1",
                  ],
                  [
                    "line2",
                    "Address line 2",
                  ],
                  ["city", "City"],
                  ["county", "County"],
                  [
                    "postcode",
                    "Postcode",
                  ],
                  [
                    "country",
                    "Country",
                  ],
                ].map(
                  ([field, label]) => (
                    <Field
                      key={field}
                      id={`address-${field}`}
                      label={label}
                    >
                      <input
                        id={`address-${field}`}
                        type="text"
                        value={
                          form.address[
                            field
                          ]
                        }
                        onChange={(
                          event
                        ) =>
                          updateNestedField(
                            "address",
                            field,
                            event.target
                              .value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </Field>
                  )
                )}
              </div>
            </Section>

            <Section
              title="Emergency contact"
              description="Optional contact information for emergencies or safeguarding needs."
            >
              <div className="grid gap-5 md:grid-cols-3">
                <Field
                  id="emergency-name"
                  label="Contact name"
                >
                  <input
                    id="emergency-name"
                    type="text"
                    value={
                      form.emergencyContact
                        .name
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "emergencyContact",
                        "name",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="emergency-relationship"
                  label="Relationship"
                >
                  <input
                    id="emergency-relationship"
                    type="text"
                    value={
                      form.emergencyContact
                        .relationship
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "emergencyContact",
                        "relationship",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="emergency-phone"
                  label="Phone number"
                >
                  <input
                    id="emergency-phone"
                    type="tel"
                    value={
                      form.emergencyContact
                        .phone
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "emergencyContact",
                        "phone",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>
              </div>
            </Section>
          </div>
        ) : null}

        {activeTab === "hair" ? (
          <div className="mt-6 space-y-6">
            <Section
              title="Hair characteristics"
              description="Technical consultation information for safe and consistent salon services."
            >
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <Field
                  id="hair-type"
                  label="Hair type"
                >
                  <input
                    id="hair-type"
                    type="text"
                    value={
                      form.hairProfile
                        .hairType
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "hairProfile",
                        "hairType",
                        event.target.value
                      )
                    }
                    placeholder="Straight, wavy, curly..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="natural-hair-colour"
                  label="Natural hair colour"
                >
                  <input
                    id="natural-hair-colour"
                    type="text"
                    value={
                      form.hairProfile
                        .naturalHairColour
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "hairProfile",
                        "naturalHairColour",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="current-hair-colour"
                  label="Current hair colour"
                >
                  <input
                    id="current-hair-colour"
                    type="text"
                    value={
                      form.hairProfile
                        .currentHairColour
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "hairProfile",
                        "currentHairColour",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="hair-length"
                  label="Hair length"
                >
                  <select
                    id="hair-length"
                    value={
                      form.hairProfile
                        .hairLength
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "hairProfile",
                        "hairLength",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      Not recorded
                    </option>
                    <option value="very_short">
                      Very short
                    </option>
                    <option value="short">
                      Short
                    </option>
                    <option value="medium">
                      Medium
                    </option>
                    <option value="long">
                      Long
                    </option>
                    <option value="very_long">
                      Very long
                    </option>
                  </select>
                </Field>

                <Field
                  id="hair-texture"
                  label="Texture"
                >
                  <input
                    id="hair-texture"
                    type="text"
                    value={
                      form.hairProfile
                        .texture
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "hairProfile",
                        "texture",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="hair-density"
                  label="Density"
                >
                  <select
                    id="hair-density"
                    value={
                      form.hairProfile
                        .density
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "hairProfile",
                        "density",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      Not recorded
                    </option>
                    <option value="fine">
                      Fine
                    </option>
                    <option value="medium">
                      Medium
                    </option>
                    <option value="thick">
                      Thick
                    </option>
                  </select>
                </Field>

                <Field
                  id="hair-porosity"
                  label="Porosity"
                >
                  <select
                    id="hair-porosity"
                    value={
                      form.hairProfile
                        .porosity
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "hairProfile",
                        "porosity",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      Not recorded
                    </option>
                    <option value="low">
                      Low
                    </option>
                    <option value="medium">
                      Medium
                    </option>
                    <option value="high">
                      High
                    </option>
                  </select>
                </Field>

                <Field
                  id="patch-test-date"
                  label="Last patch test"
                >
                  <input
                    id="patch-test-date"
                    type="date"
                    value={
                      form.hairProfile
                        .lastPatchTestAt
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "hairProfile",
                        "lastPatchTestAt",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="patch-test-result"
                  label="Patch test result"
                >
                  <select
                    id="patch-test-result"
                    value={
                      form.hairProfile
                        .patchTestResult
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "hairProfile",
                        "patchTestResult",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      Not recorded
                    </option>
                    <option value="passed">
                      Passed
                    </option>
                    <option value="failed">
                      Failed
                    </option>
                    <option value="inconclusive">
                      Inconclusive
                    </option>
                  </select>
                </Field>
              </div>
            </Section>

            <Section
              title="Hair health and product information"
              description="Separate multiple values using commas."
            >
              <div className="grid gap-5 md:grid-cols-2">
                {[
                  [
                    "scalpCondition",
                    "Scalp condition",
                  ],
                  [
                    "concerns",
                    "Hair concerns",
                  ],
                  [
                    "allergies",
                    "Allergies",
                  ],
                  [
                    "sensitivities",
                    "Sensitivities",
                  ],
                  [
                    "preferredProducts",
                    "Preferred products",
                  ],
                  [
                    "productsToAvoid",
                    "Products to avoid",
                  ],
                ].map(
                  ([field, label]) => (
                    <Field
                      key={field}
                      id={`hair-${field}`}
                      label={label}
                    >
                      <input
                        id={`hair-${field}`}
                        type="text"
                        value={
                          form.hairProfile[
                            field
                          ]
                        }
                        onChange={(
                          event
                        ) =>
                          updateNestedField(
                            "hairProfile",
                            field,
                            event.target
                              .value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </Field>
                  )
                )}

                <div className="md:col-span-2">
                  <Field
                    id="chemical-history"
                    label="Chemical history"
                  >
                    <textarea
                      id="chemical-history"
                      rows={4}
                      value={
                        form.hairProfile
                          .chemicalHistory
                      }
                      onChange={(event) =>
                        updateNestedField(
                          "hairProfile",
                          "chemicalHistory",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field
                    id="consultation-notes"
                    label="Consultation notes"
                  >
                    <textarea
                      id="consultation-notes"
                      rows={5}
                      value={
                        form.hairProfile
                          .consultationNotes
                      }
                      onChange={(event) =>
                        updateNestedField(
                          "hairProfile",
                          "consultationNotes",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </Field>
                </div>
              </div>
            </Section>
          </div>
        ) : null}

        {activeTab ===
        "preferences" ? (
          <div className="mt-6 space-y-6">
            <Section
              title="Booking preferences"
              description="Preferred appointment days, times and reminder methods."
            >
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Preferred days
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {WEEKDAYS.map(
                    (day) => {
                      const selected =
                        form.bookingPreferences
                          .preferredDays
                          .includes(day);

                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() =>
                            togglePreferredDay(
                              day
                            )
                          }
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            selected
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {formatLabel(
                            day
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field
                  id="preferred-time"
                  label="Preferred time of day"
                >
                  <select
                    id="preferred-time"
                    value={
                      form.bookingPreferences
                        .preferredTimeOfDay
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "bookingPreferences",
                        "preferredTimeOfDay",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      No preference
                    </option>
                    <option value="morning">
                      Morning
                    </option>
                    <option value="afternoon">
                      Afternoon
                    </option>
                    <option value="evening">
                      Evening
                    </option>
                  </select>
                </Field>

                <Field
                  id="preferred-reminder-channel"
                  label="Preferred reminder channel"
                >
                  <select
                    id="preferred-reminder-channel"
                    value={
                      form.bookingPreferences
                        .preferredReminderChannel
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "bookingPreferences",
                        "preferredReminderChannel",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="email">
                      Email
                    </option>
                    <option value="sms">
                      SMS
                    </option>
                    <option value="phone">
                      Phone
                    </option>
                    <option value="whatsapp">
                      WhatsApp
                    </option>
                    <option value="none">
                      None
                    </option>
                  </select>
                </Field>

                <div className="md:col-span-2">
                  <Field
                    id="accessibility-requirements"
                    label="Accessibility requirements"
                  >
                    <textarea
                      id="accessibility-requirements"
                      rows={4}
                      value={
                        form.bookingPreferences
                          .accessibilityRequirements
                      }
                      onChange={(event) =>
                        updateNestedField(
                          "bookingPreferences",
                          "accessibilityRequirements",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field
                    id="additional-requirements"
                    label="Additional booking requirements"
                  >
                    <textarea
                      id="additional-requirements"
                      rows={4}
                      value={
                        form.bookingPreferences
                          .additionalRequirements
                      }
                      onChange={(event) =>
                        updateNestedField(
                          "bookingPreferences",
                          "additionalRequirements",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </Field>
                </div>
              </div>
            </Section>
          </div>
        ) : null}

        {activeTab === "consent" ? (
          <div className="mt-6 space-y-6">
            <Section
              title="Communication consent"
              description="Record the channels and message types the customer has agreed to receive."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  id="preferred-channel"
                  label="Preferred communication channel"
                >
                  <select
                    id="preferred-channel"
                    value={
                      form
                        .communicationPreferences
                        .preferredChannel
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "communicationPreferences",
                        "preferredChannel",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="email">
                      Email
                    </option>
                    <option value="sms">
                      SMS
                    </option>
                    <option value="phone">
                      Phone
                    </option>
                    <option value="whatsapp">
                      WhatsApp
                    </option>
                    <option value="none">
                      None
                    </option>
                  </select>
                </Field>

                <Field
                  id="consent-source"
                  label="Consent source"
                >
                  <input
                    id="consent-source"
                    type="text"
                    value={
                      form
                        .communicationPreferences
                        .consentSource
                    }
                    onChange={(event) =>
                      updateNestedField(
                        "communicationPreferences",
                        "consentSource",
                        event.target.value
                      )
                    }
                    placeholder="Website, paper form, telephone..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Toggle
                  label="Email marketing consent"
                  description="Allow promotional and relationship emails."
                  checked={
                    form.marketing
                      .emailConsent
                  }
                  onChange={(value) =>
                    updateNestedField(
                      "marketing",
                      "emailConsent",
                      value
                    )
                  }
                />

                <Toggle
                  label="SMS marketing consent"
                  description="Allow promotional and relationship text messages."
                  checked={
                    form.marketing
                      .smsConsent
                  }
                  onChange={(value) =>
                    updateNestedField(
                      "marketing",
                      "smsConsent",
                      value
                    )
                  }
                />

                <Toggle
                  label="Appointment reminders"
                  description="Send booking confirmations and reminders."
                  checked={
                    form
                      .communicationPreferences
                      .appointmentReminders
                  }
                  onChange={(value) =>
                    updateNestedField(
                      "communicationPreferences",
                      "appointmentReminders",
                      value
                    )
                  }
                />

                <Toggle
                  label="Promotional messages"
                  description="Send offers, campaigns and salon promotions."
                  checked={
                    form
                      .communicationPreferences
                      .promotionalMessages
                  }
                  onChange={(value) =>
                    updateNestedField(
                      "communicationPreferences",
                      "promotionalMessages",
                      value
                    )
                  }
                />

                <Toggle
                  label="Service updates"
                  description="Send information about services and availability."
                  checked={
                    form
                      .communicationPreferences
                      .serviceUpdates
                  }
                  onChange={(value) =>
                    updateNestedField(
                      "communicationPreferences",
                      "serviceUpdates",
                      value
                    )
                  }
                />

                <Toggle
                  label="Birthday messages"
                  description="Send birthday offers and greetings."
                  checked={
                    form
                      .communicationPreferences
                      .birthdayMessages
                  }
                  onChange={(value) =>
                    updateNestedField(
                      "communicationPreferences",
                      "birthdayMessages",
                      value
                    )
                  }
                />

                <Toggle
                  label="Feedback requests"
                  description="Ask the customer to review a completed service."
                  checked={
                    form
                      .communicationPreferences
                      .feedbackRequests
                  }
                  onChange={(value) =>
                    updateNestedField(
                      "communicationPreferences",
                      "feedbackRequests",
                      value
                    )
                  }
                />
              </div>
            </Section>

            <Section
              title="Unsubscribe controls"
              description="These settings override positive marketing-consent selections."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <Toggle
                  label="Email unsubscribed"
                  checked={
                    form
                      .communicationPreferences
                      .emailUnsubscribed
                  }
                  onChange={(value) =>
                    updateNestedField(
                      "communicationPreferences",
                      "emailUnsubscribed",
                      value
                    )
                  }
                />

                <Toggle
                  label="SMS unsubscribed"
                  checked={
                    form
                      .communicationPreferences
                      .smsUnsubscribed
                  }
                  onChange={(value) =>
                    updateNestedField(
                      "communicationPreferences",
                      "smsUnsubscribed",
                      value
                    )
                  }
                />

                <Toggle
                  label="All marketing unsubscribed"
                  checked={
                    form
                      .communicationPreferences
                      .unsubscribed
                  }
                  onChange={(value) =>
                    updateNestedField(
                      "communicationPreferences",
                      "unsubscribed",
                      value
                    )
                  }
                />
              </div>

              {!isCreating ? (
                <div className="mt-6">
                  <LoadingButton
                    type="button"
                    loading={
                      consentSaving
                    }
                    onClick={
                      handleConsentSave
                    }
                    className="bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    <ShieldCheck
                      size={17}
                    />
                    Save consent
                  </LoadingButton>
                </div>
              ) : null}
            </Section>
          </div>
        ) : null}

        {activeTab === "loyalty" ? (
          <div className="mt-6 space-y-6">
            <Section
              title="Loyalty and membership"
              description="Manage the customer's loyalty tier, membership and referral details."
            >
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <Field
                  id="loyalty-tier"
                  label="Loyalty tier"
                >
                  <select
                    id="loyalty-tier"
                    value={
                      form.loyaltyTier
                    }
                    onChange={(event) =>
                      updateField(
                        "loyaltyTier",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="standard">
                      Standard
                    </option>
                    <option value="silver">
                      Silver
                    </option>
                    <option value="gold">
                      Gold
                    </option>
                    <option value="platinum">
                      Platinum
                    </option>
                  </select>
                </Field>

                <Field
                  id="membership-status"
                  label="Membership status"
                >
                  <select
                    id="membership-status"
                    value={
                      form.membershipStatus
                    }
                    onChange={(event) =>
                      updateField(
                        "membershipStatus",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="none">
                      None
                    </option>
                    <option value="active">
                      Active
                    </option>
                    <option value="paused">
                      Paused
                    </option>
                    <option value="cancelled">
                      Cancelled
                    </option>
                    <option value="expired">
                      Expired
                    </option>
                  </select>
                </Field>

                <Field
                  id="membership-name"
                  label="Membership name"
                >
                  <input
                    id="membership-name"
                    type="text"
                    value={
                      form.membershipName
                    }
                    onChange={(event) =>
                      updateField(
                        "membershipName",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="membership-start"
                  label="Membership start"
                >
                  <input
                    id="membership-start"
                    type="date"
                    value={
                      form.membershipStartedAt
                    }
                    onChange={(event) =>
                      updateField(
                        "membershipStartedAt",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="membership-expiry"
                  label="Membership expiry"
                >
                  <input
                    id="membership-expiry"
                    type="date"
                    value={
                      form.membershipExpiresAt
                    }
                    onChange={(event) =>
                      updateField(
                        "membershipExpiresAt",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <Field
                  id="referral-code"
                  label="Referral code"
                >
                  <input
                    id="referral-code"
                    type="text"
                    value={
                      form.referralCode
                    }
                    onChange={(event) =>
                      updateField(
                        "referralCode",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>

                <div className="md:col-span-2 xl:col-span-3">
                  <Field
                    id="customer-tags"
                    label="Customer tags"
                    helpText="Separate tags using commas."
                  >
                    <input
                      id="customer-tags"
                      type="text"
                      value={form.tags}
                      onChange={(event) =>
                        updateField(
                          "tags",
                          event.target.value
                        )
                      }
                      placeholder="vip, colour-client, monthly"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </Field>
                </div>
              </div>
            </Section>
          </div>
        ) : null}

        {activeTab === "notes" ? (
          <div className="mt-6 space-y-6">
            <Section
              title="Customer notes"
              description="General customer information visible to salon management."
            >
              <Field
                id="customer-notes"
                label="Notes"
              >
                <textarea
                  id="customer-notes"
                  rows={9}
                  value={form.notes}
                  onChange={(event) =>
                    updateField(
                      "notes",
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </Field>
            </Section>

            <Section
              title="Internal warnings"
              description="Sensitive operational notes intended only for authorised salon staff."
            >
              <Field
                id="internal-warnings"
                label="Internal warning"
              >
                <textarea
                  id="internal-warnings"
                  rows={6}
                  value={
                    form.internalWarnings
                  }
                  onChange={(event) =>
                    updateField(
                      "internalWarnings",
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
              </Field>
            </Section>
          </div>
        ) : null}

        {activeTab ===
        "timeline" ? (
          <div className="mt-6">
            {isCreating ? (
              <Section
                title="Customer timeline"
                description="Structured notes and follow-ups become available after the customer profile is created."
              >
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
                  <div className="flex items-start gap-3">
                    <CircleUserRound
                      size={22}
                      className="mt-0.5 shrink-0 text-indigo-600"
                    />

                    <div>
                      <p className="font-semibold text-indigo-900">
                        Create the customer profile first
                      </p>

                      <p className="mt-1 text-sm leading-6 text-indigo-700">
                        Save the customer to enable chronological notes,
                        private staff entries, tags, pinned information and
                        follow-up tracking.
                      </p>
                    </div>
                  </div>
                </div>
              </Section>
            ) : profileCustomerId ? (
              <CustomerNotesPanel
                customerId={
                  profileCustomerId
                }
                customerTags={
                  Array.isArray(
                    customer?.tags
                  )
                    ? customer.tags
                    : parseCommaSeparated(
                        form.tags
                      )
                }
                onCustomerTagsChanged={
                  handleCustomerTagsChanged
                }
              />
            ) : (
              <Section
                title="Customer timeline unavailable"
                description="This customer record does not contain a valid identifier."
              >
                <AlertMessage
                  type="error"
                  message="The timeline cannot be loaded because the customer ID is missing."
                  onClose={() =>
                    setActiveTab(
                      "personal"
                    )
                  }
                />
              </Section>
            )}
          </div>
        ) : null}

        {!isCreating ? (
          <Section
            title="Profile lifecycle"
            description="Archive, restore or delete this customer profile."
          >
            <div className="flex flex-wrap gap-3">
              {form.status !==
              "archived" ? (
                <LoadingButton
                  type="button"
                  loading={
                    lifecycleAction ===
                    "archive"
                  }
                  disabled={
                    Boolean(
                      lifecycleAction
                    )
                  }
                  onClick={() =>
                    runLifecycleAction(
                      "archive"
                    )
                  }
                  className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                >
                  <Archive size={17} />
                  Archive
                </LoadingButton>
              ) : (
                <LoadingButton
                  type="button"
                  loading={
                    lifecycleAction ===
                    "restore"
                  }
                  disabled={
                    Boolean(
                      lifecycleAction
                    )
                  }
                  onClick={() =>
                    runLifecycleAction(
                      "restore"
                    )
                  }
                  className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                >
                  <RotateCcw size={17} />
                  Restore
                </LoadingButton>
              )}

              <LoadingButton
                type="button"
                loading={
                  lifecycleAction ===
                  "delete"
                }
                disabled={
                  Boolean(
                    lifecycleAction
                  )
                }
                onClick={() =>
                  runLifecycleAction(
                    "delete"
                  )
                }
                className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              >
                <Trash2 size={17} />
                Delete
              </LoadingButton>
            </div>
          </Section>
        ) : null}

        <div className="mt-6 flex justify-end">
          <LoadingButton
            type="button"
            loading={saving}
            onClick={handleSave}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Save size={17} />

            {isCreating
              ? "Create customer profile"
              : "Save all changes"}
          </LoadingButton>
        </div>
      </div>
    </main>
  );
}