import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Mail,
  MessageCircle,
  Phone,
  Save,
  Send,
  Smartphone,
  X,
} from "lucide-react";

import {
  createCustomerContactLog,
} from "../../services/customerContactApi";

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
    label: "Phone Call",
    icon: Phone,
  },
];

const CAMPAIGN_OPTIONS = [
  {
    value: "dormant_customer",
    label: "Dormant Customer",
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
    value: "appointment_reminder",
    label: "Appointment Reminder",
  },
  {
    value: "birthday",
    label: "Birthday",
  },
  {
    value: "general",
    label: "General Contact",
  },
];

function getCustomerId(customer) {
  return customer?.customerId ?? customer?._id ?? "";
}

function getCustomerName(customer) {
  return (
    customer?.customerName?.trim() ||
    customer?.fullName?.trim() ||
    customer?.name?.trim() ||
    [
      customer?.firstName,
      customer?.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Customer"
  );
}

function getRecipient(customer, channel) {
  if (channel === "email") {
    return customer?.email?.trim() ?? "";
  }

  if (
    channel === "sms" ||
    channel === "whatsapp" ||
    channel === "phone"
  ) {
    return customer?.phone?.trim() ?? "";
  }

  return "";
}

function createDefaultSubject(customerName, campaignType) {
  switch (campaignType) {
    case "dormant_customer":
      return `We miss you at SalonAI, ${customerName}`;

    case "follow_up":
      return `Following up from SalonAI`;

    case "promotion":
      return `A special SalonAI offer for you`;

    case "appointment_reminder":
      return `Your SalonAI appointment reminder`;

    case "birthday":
      return `Happy birthday from SalonAI`;

    default:
      return `A message from SalonAI`;
  }
}

function createDefaultMessage(customerName, campaignType) {
  switch (campaignType) {
    case "dormant_customer":
      return `Hello ${customerName},

It has been a while since your last appointment, and we would love to welcome you back to SalonAI.

Please contact us when you are ready to arrange your next visit.

Kind regards,
SalonAI`;

    case "follow_up":
      return `Hello ${customerName},

We are following up after your recent visit to SalonAI. We hope you were happy with your service.

Please contact us if you have any questions or would like to arrange another appointment.

Kind regards,
SalonAI`;

    case "promotion":
      return `Hello ${customerName},

We have a special offer available for selected SalonAI customers.

Contact us to learn more or arrange your next appointment.

Kind regards,
SalonAI`;

    case "appointment_reminder":
      return `Hello ${customerName},

This is a reminder about your upcoming appointment with SalonAI.

Please contact us if you need to confirm, cancel, or rearrange your appointment.

Kind regards,
SalonAI`;

    case "birthday":
      return `Happy birthday, ${customerName}!

Everyone at SalonAI wishes you a wonderful birthday.

We would love to welcome you back for your next appointment.

Kind regards,
SalonAI`;

    default:
      return `Hello ${customerName},

We are contacting you from SalonAI.

Please get in touch if you would like to arrange an appointment or require any assistance.

Kind regards,
SalonAI`;
  }
}

function normalizeWhatsAppNumber(phoneNumber) {
  return String(phoneNumber ?? "")
    .replace(/[^\d+]/g, "")
    .replace(/^\+/, "");
}

function openCommunicationApplication({
  channel,
  recipient,
  subject,
  message,
}) {
  if (channel === "email") {
    const url =
      `mailto:${recipient}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(message)}`;

    window.location.href = url;
    return;
  }

  if (channel === "sms") {
    const url =
      `sms:${recipient}` +
      `?body=${encodeURIComponent(message)}`;

    window.location.href = url;
    return;
  }

  if (channel === "whatsapp") {
    const normalizedNumber =
      normalizeWhatsAppNumber(recipient);

    const url =
      `https://wa.me/${normalizedNumber}` +
      `?text=${encodeURIComponent(message)}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );

    return;
  }

  if (channel === "phone") {
    window.location.href = `tel:${recipient}`;
  }
}

export default function CustomerContactModal({
  open = false,
  customer = null,
  defaultCampaignType = "dormant_customer",
  defaultChannel,
  onClose,
  onSaved,
}) {
  const customerId = getCustomerId(customer);
  const customerName = getCustomerName(customer);

  const availableChannels = useMemo(
    () =>
      CHANNEL_OPTIONS.filter((option) => {
        if (option.value === "email") {
          return Boolean(customer?.email);
        }

        return Boolean(customer?.phone);
      }),
    [customer]
  );

  const initialChannel =
    defaultChannel &&
    availableChannels.some(
      (option) => option.value === defaultChannel
    )
      ? defaultChannel
      : availableChannels[0]?.value ?? "email";

  const [campaignType, setCampaignType] = useState(
    defaultCampaignType
  );

  const [channel, setChannel] = useState(
    initialChannel
  );

  const [recipient, setRecipient] = useState("");

  const [subject, setSubject] = useState("");

  const [message, setMessage] = useState("");

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const resolvedCampaignType =
      defaultCampaignType || "dormant_customer";

    const resolvedChannel =
      defaultChannel &&
      availableChannels.some(
        (option) =>
          option.value === defaultChannel
      )
        ? defaultChannel
        : availableChannels[0]?.value ??
          "email";

    setCampaignType(resolvedCampaignType);
    setChannel(resolvedChannel);

    setRecipient(
      getRecipient(customer, resolvedChannel)
    );

    setSubject(
      createDefaultSubject(
        customerName,
        resolvedCampaignType
      )
    );

    setMessage(
      createDefaultMessage(
        customerName,
        resolvedCampaignType
      )
    );

    setError("");
    setSuccess("");
    setSaving(false);
  }, [
    open,
    customer,
    customerName,
    defaultCampaignType,
    defaultChannel,
    availableChannels,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setRecipient(
      getRecipient(customer, channel)
    );
  }, [channel, customer, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSubject(
      createDefaultSubject(
        customerName,
        campaignType
      )
    );

    setMessage(
      createDefaultMessage(
        customerName,
        campaignType
      )
    );
  }, [campaignType, customerName, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) {
        onClose?.();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    const originalOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        originalOverflow;
    };
  }, [open, saving, onClose]);

  if (!open) {
    return null;
  }

  function validateForm() {
    if (!customerId) {
      return "A valid customer is required.";
    }

    if (!channel) {
      return "Select a communication channel.";
    }

    if (!recipient.trim()) {
      return `The customer does not have a valid ${channel} recipient.`;
    }

    if (
      channel === "email" &&
      !recipient.includes("@")
    ) {
      return "Enter a valid email address.";
    }

    if (
      channel !== "phone" &&
      !message.trim()
    ) {
      return "Enter a message.";
    }

    if (
      channel === "email" &&
      !subject.trim()
    ) {
      return "Enter an email subject.";
    }

    return "";
  }

  async function saveContactLog({
    openApplication = false,
  } = {}) {
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const contactLog =
        await createCustomerContactLog({
          customer: customerId,
          campaignType,
          channel,
          direction: "outbound",
          subject:
            channel === "email"
              ? subject.trim()
              : "",
          message: message.trim(),
          recipient: recipient.trim(),

          /*
           * Opening an email, SMS, WhatsApp or phone application
           * does not prove that the message was sent.
           * The contact is therefore initially stored as a draft.
           */
          status: "draft",

          metadata: {
            source: "customer_contact_modal",
            customerName,
          },
        });

      setSuccess(
        openApplication
          ? "Contact saved. Opening the selected application."
          : "Contact draft saved successfully."
      );

      onSaved?.(contactLog);

      if (openApplication) {
        openCommunicationApplication({
          channel,
          recipient: recipient.trim(),
          subject: subject.trim(),
          message: message.trim(),
        });
      }
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to save the customer contact."
      );
    } finally {
      setSaving(false);
    }
  }

  const SelectedChannelIcon =
    CHANNEL_OPTIONS.find(
      (option) => option.value === channel
    )?.icon ?? Send;

  const hasContactDetails =
    availableChannels.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-contact-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!saving) {
            onClose?.();
          }
        }}
        aria-label="Close contact modal"
      />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                <SelectedChannelIcon
                  className="text-blue-700"
                  size={22}
                />
              </div>

              <div>
                <h2
                  id="customer-contact-title"
                  className="text-xl font-bold text-gray-900"
                >
                  Contact Customer
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Create a contact record for{" "}
                  {customerName}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X size={21} />
          </button>
        </header>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          {!hasContactDetails ? (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <AlertTriangle
                className="mt-0.5 shrink-0 text-yellow-700"
                size={20}
              />

              <div>
                <p className="font-semibold text-yellow-900">
                  No contact details available
                </p>

                <p className="mt-1 text-sm text-yellow-800">
                  Add an email address or phone number to
                  the customer record before creating a
                  contact attempt.
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertTriangle
                className="mt-0.5 shrink-0 text-red-600"
                size={20}
              />

              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          ) : null}

          {success ? (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle
                className="mt-0.5 shrink-0 text-green-600"
                size={20}
              />

              <p className="text-sm text-green-700">
                {success}
              </p>
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="contact-campaign-type"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Campaign Type
              </label>

              <select
                id="contact-campaign-type"
                value={campaignType}
                onChange={(event) =>
                  setCampaignType(
                    event.target.value
                  )
                }
                disabled={saving}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              >
                {CAMPAIGN_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="contact-channel"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Contact Channel
              </label>

              <select
                id="contact-channel"
                value={channel}
                onChange={(event) =>
                  setChannel(event.target.value)
                }
                disabled={
                  saving || !hasContactDetails
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              >
                {availableChannels.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="contact-recipient"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Recipient
            </label>

            <input
              id="contact-recipient"
              type={
                channel === "email"
                  ? "email"
                  : "text"
              }
              value={recipient}
              onChange={(event) =>
                setRecipient(event.target.value)
              }
              disabled={
                saving || !hasContactDetails
              }
              placeholder={
                channel === "email"
                  ? "customer@example.com"
                  : "Customer phone number"
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
            />
          </div>

          {channel === "email" ? (
            <div>
              <label
                htmlFor="contact-subject"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Subject
              </label>

              <input
                id="contact-subject"
                type="text"
                value={subject}
                onChange={(event) =>
                  setSubject(event.target.value)
                }
                disabled={saving}
                maxLength={200}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              />

              <p className="mt-1 text-right text-xs text-gray-400">
                {subject.length}/200
              </p>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="contact-message"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              {channel === "phone"
                ? "Call Notes"
                : "Message"}
            </label>

            <textarea
              id="contact-message"
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              disabled={saving}
              rows={9}
              maxLength={5000}
              placeholder={
                channel === "phone"
                  ? "Add notes for the planned call."
                  : "Enter the customer message."
              }
              className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm leading-6 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
            />

            <p className="mt-1 text-right text-xs text-gray-400">
              {message.length}/5000
            </p>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            The contact record will initially be saved as a
            draft. Opening an external email, SMS, WhatsApp,
            or telephone application does not confirm that the
            communication was sent.
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() =>
              saveContactLog({
                openApplication: false,
              })
            }
            disabled={
              saving || !hasContactDetails
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={17} />

            {saving ? "Saving..." : "Save Draft"}
          </button>

          <button
            type="button"
            onClick={() =>
              saveContactLog({
                openApplication: true,
              })
            }
            disabled={
              saving || !hasContactDetails
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={17} />

            {saving
              ? "Saving..."
              : channel === "phone"
                ? "Save & Call"
                : "Save & Open"}
          </button>
        </footer>
      </div>
    </div>
  );
}