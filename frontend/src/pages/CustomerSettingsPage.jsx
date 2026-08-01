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

const STORAGE_KEY = "salonai.customer.preferences";

const defaultPreferences = {
  emailUpdates: true,
  smsReminders: true,
  whatsappUpdates: false,
  pushNotifications: true,
  reducedMotion: false,
  highContrast: false,
  compactLayout: false,
  darkMode: false,
};

function loadPreferences() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved
      ? { ...defaultPreferences, ...JSON.parse(saved) }
      : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

export default function CustomerSettingsPage() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(loadPreferences);
  const [saved, setSaved] = useState(false);

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
      preferences.darkMode ? "dark" : "light";

    document.documentElement.dataset.salonaiContrast =
      preferences.highContrast ? "high" : "standard";

    document.documentElement.dataset.salonaiDensity =
      preferences.compactLayout ? "compact" : "comfortable";

    document.documentElement.dataset.salonaiMotion =
      preferences.reducedMotion ? "reduced" : "standard";
  }, [preferences]);

  function updatePreference(name, value) {
    setSaved(false);
    setPreferences((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function savePreferences() {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(preferences)
    );

    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 3000);
  }

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
        >
          {saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {saved ? "Preferences saved" : "Save preferences"}
        </button>
      </section>

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

          <p className="settings-information-note">
            Account identity changes should be completed through the salon or
            the authenticated profile API when that capability is enabled.
          </p>
        </SettingsSection>

        <SettingsSection
          title="Communication preferences"
          description="Choose which customer updates you would like to receive."
          icon={BellRing}
        >
          <PreferenceToggle
            id="emailUpdates"
            label="Email updates"
            description="Booking confirmations, receipts and account information."
            checked={preferences.emailUpdates}
            onChange={(value) => updatePreference("emailUpdates", value)}
          />

          <PreferenceToggle
            id="smsReminders"
            label="SMS reminders"
            description="Appointment reminders sent to your registered mobile."
            checked={preferences.smsReminders}
            onChange={(value) => updatePreference("smsReminders", value)}
          />

          <PreferenceToggle
            id="whatsappUpdates"
            label="WhatsApp updates"
            description="Optional booking and service messages through WhatsApp."
            checked={preferences.whatsappUpdates}
            onChange={(value) => updatePreference("whatsappUpdates", value)}
          />

          <PreferenceToggle
            id="pushNotifications"
            label="Push notifications"
            description="Browser or device notifications when supported."
            checked={preferences.pushNotifications}
            onChange={(value) => updatePreference("pushNotifications", value)}
          />
        </SettingsSection>

        <SettingsSection
          title="Accessibility and display"
          description="Adjust the interface on this device."
          icon={Accessibility}
        >
          <PreferenceToggle
            id="reducedMotion"
            label="Reduce motion"
            description="Minimise non-essential animation and transitions."
            checked={preferences.reducedMotion}
            onChange={(value) => updatePreference("reducedMotion", value)}
          />

          <PreferenceToggle
            id="highContrast"
            label="Increase contrast"
            description="Strengthen borders, focus indicators and text contrast."
            checked={preferences.highContrast}
            onChange={(value) => updatePreference("highContrast", value)}
          />

          <PreferenceToggle
            id="compactLayout"
            label="Compact layout"
            description="Reduce spacing in supported customer interfaces."
            checked={preferences.compactLayout}
            onChange={(value) => updatePreference("compactLayout", value)}
          />

          <PreferenceToggle
            id="darkMode"
            label="Dark appearance"
            description="Use the SalonAI dark interface on this device."
            checked={preferences.darkMode}
            onChange={(value) => updatePreference("darkMode", value)}
          />
        </SettingsSection>

        <aside className="settings-channel-summary">
          <h2>Active channels</h2>

          <ul>
            <li className={preferences.emailUpdates ? "is-enabled" : ""}>
              <Mail size={18} />
              Email
            </li>
            <li className={preferences.smsReminders ? "is-enabled" : ""}>
              <Smartphone size={18} />
              SMS
            </li>
            <li className={preferences.whatsappUpdates ? "is-enabled" : ""}>
              <MessageCircle size={18} />
              WhatsApp
            </li>
            <li className={preferences.pushNotifications ? "is-enabled" : ""}>
              <BellRing size={18} />
              Push
            </li>
          </ul>

          <div className="settings-local-note">
            <Moon size={18} />
            <span>
              Display preferences are stored locally in this browser.
            </span>
          </div>
        </aside>
      </div>
    </main>
  );
}
