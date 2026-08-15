import {
  CheckCircle2,
  Home,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import ProfilePhotoUploader from "../components/profile/ProfilePhotoUploader.jsx";
import useAuth from "../hooks/useAuth.js";
import HairConsultationPage from "./HairConsultationPage.jsx";

const EMPTY_ADDRESS = {
  line1: "",
  line2: "",
  city: "",
  county: "",
  postcode: "",
  country: "United Kingdom",
};

const EMPTY_FORM = {
  name: "",
  phone: "",
  profilePhoto: "",
  homeAddress: EMPTY_ADDRESS,
};

function accountToForm(account = {}) {
  return {
    name: account?.name || "",
    phone: account?.phone || "",
    profilePhoto: account?.profilePhoto || "",
    homeAddress: {
      ...EMPTY_ADDRESS,
      ...(account?.homeAddress || {}),
    },
  };
}

function requestMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export default function ManageAccountPage() {
  const {
    user,
    refreshAccount,
    updateAccount,
  } = useAuth();

  const [form, setForm] = useState(() => accountToForm(user));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      setLoading(true);
      setError("");

      try {
        const account = await refreshAccount();

        if (active) {
          setForm(accountToForm(account));
        }
      } catch (requestError) {
        if (!active) return;

        setForm(accountToForm(user));
        setError(
          requestMessage(
            requestError,
            "We could not refresh your account details. The last saved details are shown where available."
          )
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, [refreshAccount]);

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function updateField(field, value) {
    clearFeedback();
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateAddress(field, value) {
    clearFeedback();
    setForm((current) => ({
      ...current,
      homeAddress: {
        ...current.homeAddress,
        [field]: value,
      },
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    clearFeedback();

    try {
      const response = await updateAccount({
        name: form.name,
        phone: form.phone,
        profilePhoto: form.profilePhoto,
        homeAddress: form.homeAddress,
      });

      /*
       * Re-read the account from the backend after PATCH so the success message
       * reflects persisted database state, not only the submitted React state.
       */
      const persistedAccount = await refreshAccount().catch(
        () => response?.user || null
      );

      if (!persistedAccount) {
        throw new Error(
          "The server did not return the saved account details."
        );
      }

      setForm(accountToForm(persistedAccount));
      setMessage(
        "Your profile details were saved and confirmed by the server."
      );
    } catch (requestError) {
      setError(
        requestMessage(
          requestError,
          "Your account details could not be saved. Please try again."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <main
        className="manage-account-page"
        id="main-content"
        tabIndex="-1"
      >
        <section className="manage-account-hero">
          <div className="manage-account-hero-icon">
            <UserRound size={26} />
          </div>

          <div>
            <span>Account</span>
            <h1>Your profile and delivery details</h1>
            <p>
              Update your profile photograph, contact number and home address.
              SalonAI now verifies the saved values against the backend after
              every successful update.
            </p>
          </div>

          <div className="manage-account-email">
            <Mail size={17} />
            <span>
              <small>Sign-in email</small>
              {user?.email || "Not available"}
            </span>
          </div>
        </section>

        {error ? (
          <div className="manage-account-alert" role="alert">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="manage-account-alert is-success" role="status">
            <CheckCircle2 size={18} />
            {message}
          </div>
        ) : null}

        <form
          className="manage-account-form"
          onSubmit={submit}
          aria-busy={loading || saving}
        >
          <section>
            <header>
              <UserRound size={20} />
              <div>
                <h2>Profile</h2>
                <p>
                  These details belong to your authenticated SalonAI user
                  account and are available again after you sign out and return.
                </p>
              </div>
            </header>

            <ProfilePhotoUploader
              value={form.profilePhoto}
              onChange={(value) => updateField("profilePhoto", value)}
              name={form.name}
              label="Profile photograph"
              disabled={loading || saving}
            />

            <div className="manage-account-grid">
              <label className="manage-account-wide">
                Full name
                <input
                  required
                  disabled={loading || saving}
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  autoComplete="name"
                />
              </label>

              <label>
                Phone number
                <input
                  disabled={loading || saving}
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </label>
            </div>
          </section>

          <section>
            <header>
              <Home size={20} />
              <div>
                <h2>Home address</h2>
                <p>
                  Stored privately on your account and available to supported
                  delivery checkout flows.
                </p>
              </div>
            </header>

            <div className="manage-account-grid">
              <label className="manage-account-wide">
                Address line 1
                <input
                  disabled={loading || saving}
                  value={form.homeAddress.line1}
                  onChange={(event) => updateAddress("line1", event.target.value)}
                  autoComplete="address-line1"
                />
              </label>

              <label className="manage-account-wide">
                Address line 2
                <input
                  disabled={loading || saving}
                  value={form.homeAddress.line2}
                  onChange={(event) => updateAddress("line2", event.target.value)}
                  autoComplete="address-line2"
                />
              </label>

              <label>
                Town or city
                <input
                  disabled={loading || saving}
                  value={form.homeAddress.city}
                  onChange={(event) => updateAddress("city", event.target.value)}
                  autoComplete="address-level2"
                />
              </label>

              <label>
                County
                <input
                  disabled={loading || saving}
                  value={form.homeAddress.county}
                  onChange={(event) => updateAddress("county", event.target.value)}
                  autoComplete="address-level1"
                />
              </label>

              <label>
                Postcode
                <input
                  disabled={loading || saving}
                  value={form.homeAddress.postcode}
                  onChange={(event) =>
                    updateAddress(
                      "postcode",
                      event.target.value.toUpperCase()
                    )
                  }
                  autoComplete="postal-code"
                />
              </label>

              <label>
                Country
                <input
                  disabled={loading || saving}
                  value={form.homeAddress.country}
                  onChange={(event) => updateAddress("country", event.target.value)}
                  autoComplete="country-name"
                />
              </label>
            </div>
          </section>

          <footer>
            <p>
              <ShieldCheck size={17} />
              Your address and contact details are never displayed publicly.
            </p>

            <button
              type="submit"
              className="app-button app-button-primary"
              disabled={loading || saving}
            >
              <Save size={17} />
              {saving ? "Saving and verifying…" : "Save account details"}
            </button>
          </footer>
        </form>
      </main>

      <HairConsultationPage />
    </>
  );
}
