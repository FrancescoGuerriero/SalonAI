import { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  BellRing,
  CheckCircle2,
  Mail,
  MessageCircle,
  Moon,
  Save,
  Smartphone,
  UserRound,
} from "lucide-react";

import useAuth from "../hooks/useAuth.js";
import PreferenceToggle from "../components/settings/PreferenceToggle.jsx";
import SettingsSection from "../components/settings/SettingsSection.jsx";
import Alert from "../components/ui/Alert.jsx";
import {
  getCustomerCommunicationPreferences,
  updateCustomerCommunicationPreferences,
} from "../Services/customerCommunicationPreferencesService.js";

const STORAGE_KEY = "salonai.customer.display-preferences";

const defaultDisplayPreferences = {
  pushNotifications: true,
  reducedMotion: false,
  highContrast: false,
  compactLayout: false,
  darkMode: false,
};

const defaultCommunicationPreferences = {
  preferredChannel: "email",
  appointmentReminders: true,
  promotionalMessages: true,
  serviceUpdates: true,
  birthdayMessages: true,
  feedbackRequests: true,
  emailUnsubscribed: false,
  smsUnsubscribed: false,
  unsubscribed: false,
};

function loadDisplayPreferences() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved
      ? { ...defaultDisplayPreferences, ...JSON.parse(saved) }
      : defaultDisplayPreferences;
  } catch {
    return defaultDisplayPreferences;
  }
}

function payload(response) {
  return response?.data ?? response ?? {};
}

export default function CustomerSettingsPage() {
  const { user } = useAuth();
  const [displayPreferences, setDisplayPreferences] = useState(loadDisplayPreferences);
  const [communicationPreferences, setCommunicationPreferences] = useState(
    defaultCommunicationPreferences
  );
  const [loadingCommunications, setLoadingCommunications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const displayName =
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "SalonAI customer";

  const initials = useMemo(
    () =>
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(""),
    [displayName]
  );

  useEffect(() => {
    document.documentElement.dataset.salonaiTheme =
      displayPreferences.darkMode ? "dark" : "light";

    document.documentElement.dataset.salonaiContrast =
      displayPreferences.highContrast ? "high" : "standard";

    document.documentElement.dataset.salonaiDensity =
      displayPreferences.compactLayout ? "compact" : "comfortable";

    document.documentElement.dataset.salonaiMotion =
      displayPreferences.reducedMotion ? "reduced" : "standard";
  }, [displayPreferences]);

  useEffect(() => {
    let active = true;

    async function loadCommunicationPreferences() {
      setLoadingCommunications(true);
      setError("");

      try {
        const response = await getCustomerCommunicationPreferences();
        if (!active) return;

        setCommunicationPreferences({
          ...defaultCommunicationPreferences,
          ...(payload(response).communicationPreferences || {}),
        });
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError?.response?.data?.message ||
            "We could not load your communication preferences."
        );
      } finally {
        if (active) setLoadingCommunications(false);
      }
    }

    loadCommunicationPreferences();

    return () => {
      active = false;
    };
  }, []);

  function updateDisplayPreference(name, value) {
    setSaved(false);
    setDisplayPreferences((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateCommunicationPreference(name, value) {
    setSaved(false);
    setCommunicationPreferences((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function savePreferences() {
    setSaving(true);
    setSaved(false);
    setError("");

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(displayPreferences)
    );

    try {
      const response = await updateCustomerCommunicationPreferences(
        communicationPreferences
      );

      setCommunicationPreferences({
        ...defaultCommunicationPreferences,
        ...(payload(response).communicationPreferences || {}),
      });
      setSaved(true);

      window.setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (saveError) {
      setError(
        saveError?.response?.data?.message ||
          saveError?.message ||
          "We could not save your communication preferences."
      );
    } finally {
      setSaving(false);
    }
  }

  const emailEnabled = !communicationPreferences.emailUnsubscribed;
  const smsEnabled = !communicationPreferences.smsUnsubscribed;
  const whatsappEnabled = communicationPreferences.preferredChannel === "whatsapp";

  return (
    <main className="customer-settings-page">
      <section className="settings-hero">
        <div className="settings-avatar" aria-hidden="true">
          {initials || <UserRound size={28} />}
        </div>

        <div className="settings-hero-copy">
          <span>Customer profile</span>
          <h1>{displayName}</h1>
          <p>
            Manage how SalonAI communicates with you and customise the
            application experience on this device.
          </p>
        </div>

        <button
          type="button"
          className="settings-save-button"
          onClick={savePreferences}
          disabled={saving || loadingCommunications}
        >
          {saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {saving
            ? "Saving…"
            : saved
              ? "Preferences saved"
              : "Save preferences"}
        </button>
      </section>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="settings-layout">
        <SettingsSection
          title="Account information"
          description="Details associated with your authenticated SalonAI account."
          icon={UserRound}
        >
          <dl className="account-details-list">
            <div>
              <dt>Name</dt>
              <dd>{displayName}</dd>
            </div>

            <div>
              <dt>Email</dt>
              <dd>{user?.email || "Not available"}</dd>
            </div>

            <div>
              <dt>Account role</dt>
              <dd>{user?.role || "customer"}</dd>
            </div>
          </dl>
        </SettingsSection>

        <SettingsSection
          title="Communication preferences"
          description="These settings are saved to your SalonAI customer profile and used for booking, payment and service messages."
          icon={BellRing}
        >
          <label className="settings-field" htmlFor="preferredChannel">
            <span>Preferred service channel</span>
            <select
              id="preferredChannel"
              value={communicationPreferences.preferredChannel}
              disabled={loadingCommunications}
              onChange={(event) =>
                updateCommunicationPreference("preferredChannel", event.target.value)
              }
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="none">Email only / no preferred mobile channel</option>
            </select>
          </label>

          <PreferenceToggle
            id="emailUpdates"
            label="Email updates"
            description="Booking confirmations, payment receipts and service information."
            checked={emailEnabled}
            onChange={(value) =>
              updateCommunicationPreference("emailUnsubscribed", !value)
            }
          />

          <PreferenceToggle
            id="smsUpdates"
            label="SMS updates"
            description="Allow transactional text messages when SMS is your preferred channel."
            checked={smsEnabled}
            onChange={(value) =>
              updateCommunicationPreference("smsUnsubscribed", !value)
            }
          />

          <PreferenceToggle
            id="appointmentReminders"
            label="Appointment reminders"
            description="Receive scheduled reminders before upcoming appointments."
            checked={communicationPreferences.appointmentReminders}
            onChange={(value) =>
              updateCommunicationPreference("appointmentReminders", value)
            }
          />

          <PreferenceToggle
            id="serviceUpdates"
            label="Service and booking updates"
            description="Receive changes to bookings, payments and salon service information."
            checked={communicationPreferences.serviceUpdates}
            onChange={(value) =>
              updateCommunicationPreference("serviceUpdates", value)
            }
          />

          <PreferenceToggle
            id="promotionalMessages"
            label="Offers and promotional messages"
            description="Receive optional marketing and promotional communications."
            checked={communicationPreferences.promotionalMessages}
            onChange={(value) =>
              updateCommunicationPreference("promotionalMessages", value)
            }
          />

          <PreferenceToggle
            id="feedbackRequests"
            label="Feedback and review requests"
            description="Allow post-visit feedback and review invitations."
            checked={communicationPreferences.feedbackRequests}
            onChange={(value) =>
              updateCommunicationPreference("feedbackRequests", value)
            }
          />
        </SettingsSection>

        <SettingsSection
          title="Accessibility and display"
          description="These preferences apply to this browser and device."
          icon={Accessibility}
        >
          <PreferenceToggle
            id="pushNotifications"
            label="Push notifications"
            description="Browser or device notifications when supported."
            checked={displayPreferences.pushNotifications}
            onChange={(value) => updateDisplayPreference("pushNotifications", value)}
          />

          <PreferenceToggle
            id="reducedMotion"
            label="Reduce motion"
            description="Minimise non-essential animation and transitions."
            checked={displayPreferences.reducedMotion}
            onChange={(value) => updateDisplayPreference("reducedMotion", value)}
          />

          <PreferenceToggle
            id="highContrast"
            label="Increase contrast"
            description="Strengthen borders, focus indicators and text contrast."
            checked={displayPreferences.highContrast}
            onChange={(value) => updateDisplayPreference("highContrast", value)}
          />

          <PreferenceToggle
            id="compactLayout"
            label="Compact layout"
            description="Reduce spacing in supported customer interfaces."
            checked={displayPreferences.compactLayout}
            onChange={(value) => updateDisplayPreference("compactLayout", value)}
          />

          <PreferenceToggle
            id="darkMode"
            label="Dark appearance"
            description="Use the SalonAI dark interface on this device."
            checked={displayPreferences.darkMode}
            onChange={(value) => updateDisplayPreference("darkMode", value)}
          />
        </SettingsSection>

        <aside className="settings-channel-summary">
          <h2>Active channels</h2>

          <ul>
            <li className={emailEnabled ? "is-enabled" : ""}>
              <Mail size={18} />
              Email
            </li>
            <li className={smsEnabled ? "is-enabled" : ""}>
              <Smartphone size={18} />
              SMS
            </li>
            <li className={whatsappEnabled ? "is-enabled" : ""}>
              <MessageCircle size={18} />
              WhatsApp
            </li>
            <li className={displayPreferences.pushNotifications ? "is-enabled" : ""}>
              <BellRing size={18} />
              Push
            </li>
          </ul>

          <div className="settings-local-note">
            <Moon size={18} />
            <span>
              Communication choices are stored on your account. Display choices
              remain local to this browser.
            </span>
          </div>
        </aside>
      </div>
    </main>
  );
}
