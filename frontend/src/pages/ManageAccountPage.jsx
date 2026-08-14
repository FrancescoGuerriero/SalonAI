import {
  BrainCircuit,
  CheckCircle2,
  Home,
  Mail,
  MapPin,
  Save,
  Scissors,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import ProfilePhotoUploader from "../components/profile/ProfilePhotoUploader.jsx";
import useAuth from "../hooks/useAuth.js";

import customerExperienceService from "../Services/customerExperienceService.js";

import {
  generateHaircareRecommendation,
} from "../Services/haircareRecommendationService.js";

const emptyAddress = {
  line1: "",
  line2: "",
  city: "",
  county: "",
  postcode: "",
  country: "United Kingdom",
};

const emptyForm = {
  name: "",
  phone: "",
  profilePhoto: "",
  homeAddress: emptyAddress,
};

const emptyConsultation = {
  hairType: "",
  currentColour: "",
  desiredOutcome: "",
  sensitivities: "",
  previousTreatments: "",
  notes: "",
  dataProcessingConsent: false,
};

function accountToForm(account = {}) {
  return {
    name: account?.name || "",
    phone: account?.phone || "",
    profilePhoto:
      account?.profilePhoto || "",
    homeAddress: {
      ...emptyAddress,
      ...(account?.homeAddress || {}),
    },
  };
}

function consultationToAdvicePayload(
  consultation
) {
  return {
    hairType:
      consultation.hairType || "",
    currentColour:
      consultation.currentColour || "",
    desiredOutcome:
      consultation.desiredOutcome || "",
    sensitivities:
      consultation.sensitivities || "",
    previousTreatments:
      consultation.previousTreatments || "",
    notes:
      consultation.notes || "",
  };
}

export default function ManageAccountPage() {
  const {
    user,
    refreshAccount,
    updateAccount,
  } = useAuth();

  const [
    form,
    setForm,
  ] = useState(emptyForm);

  const [
    consultation,
    setConsultation,
  ] = useState(
    emptyConsultation
  );

  const [
    consultationHistory,
    setConsultationHistory,
  ] = useState([]);

  const [
    advice,
    setAdvice,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    savingConsultation,
    setSavingConsultation,
  ] = useState(false);

  const [
    requestingAdvice,
    setRequestingAdvice,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [
          account,
          experience,
        ] = await Promise.all([
          refreshAccount(),
          customerExperienceService.getMine(),
        ]);

        if (!active) {
          return;
        }

        setForm(
          accountToForm(
            account
          )
        );

        const consultations =
          experience?.consultations ||
          experience?.profile
            ?.consultations ||
          [];

        setConsultationHistory(
          Array.isArray(
            consultations
          )
            ? consultations
            : []
        );

        if (
          Array.isArray(
            consultations
          ) &&
          consultations.length
        ) {
          const latest =
            consultations[0];

          setConsultation({
            hairType:
              latest.hairType || "",
            currentColour:
              latest.currentColour ||
              "",
            desiredOutcome:
              latest.desiredOutcome ||
              "",
            sensitivities:
              latest.sensitivities ||
              "",
            previousTreatments:
              latest.previousTreatments ||
              "",
            notes:
              latest.notes || "",
            dataProcessingConsent:
              true,
          });
        }
      } catch {
        if (!active) {
          return;
        }

        setForm(
          accountToForm(
            user
          )
        );

        setError(
          "Some account details could not be loaded. You can still update the information shown below."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [
    refreshAccount,
    user,
  ]);

  function updateField(
    field,
    value
  ) {
    setMessage("");
    setError("");

    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function updateAddress(
    field,
    value
  ) {
    setMessage("");
    setError("");

    setForm(
      (current) => ({
        ...current,
        homeAddress: {
          ...current.homeAddress,
          [field]: value,
        },
      })
    );
  }

  function updateConsultation(
    field,
    value
  ) {
    setMessage("");
    setError("");
    setAdvice(null);

    setConsultation(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  async function submit(
    event
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response =
        await updateAccount(
          form
        );

      setForm(
        accountToForm(
          response.user
        )
      );

      setMessage(
        "Your account details and profile photograph have been saved."
      );
    } catch (
      requestError
    ) {
      setError(
        requestError.response
          ?.data
          ?.message ||
          "Your account details could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveConsultation(
    event
  ) {
    event.preventDefault();

    setSavingConsultation(
      true
    );

    setMessage("");
    setError("");

    try {
      if (
        !consultation
          .desiredOutcome
          .trim()
      ) {
        throw new Error(
          "Tell us what result you would like from your hair consultation."
        );
      }

      if (
        consultation
          .dataProcessingConsent !==
        true
      ) {
        throw new Error(
          "Please confirm consent before saving your consultation."
        );
      }

      const response =
        await customerExperienceService
          .addConsultation(
            consultation
          );

      const saved =
        response?.consultation;

      if (saved) {
        setConsultationHistory(
          (current) => [
            saved,
            ...current,
          ]
        );
      }

      setMessage(
        "Your hair consultation has been saved."
      );
    } catch (
      requestError
    ) {
      setError(
        requestError.response
          ?.data
          ?.message ||
          requestError.message ||
          "Your consultation could not be saved."
      );
    } finally {
      setSavingConsultation(
        false
      );
    }
  }

  async function requestAdvice() {
    setRequestingAdvice(
      true
    );

    setMessage("");
    setError("");
    setAdvice(null);

    try {
      if (
        !consultation
          .desiredOutcome
          .trim()
      ) {
        throw new Error(
          "Complete your consultation before requesting hair advice."
        );
      }

      const result =
        await generateHaircareRecommendation(
          consultationToAdvicePayload(
            consultation
          )
        );

      setAdvice(result);

      setMessage(
        "Your personalised hair advice is ready."
      );
    } catch (
      requestError
    ) {
      setError(
        requestError.message ||
          "Hair advice could not be generated."
      );
    } finally {
      setRequestingAdvice(
        false
      );
    }
  }

  const isCustomer =
    !user?.role ||
    user.role ===
      "customer";

  return (
    <main
      className="manage-account-page"
      id="main-content"
      tabIndex="-1"
    >
      <section className="manage-account-hero">
        <div className="manage-account-hero-icon">
          <UserRound
            size={26}
          />
        </div>

        <div>
          <span>
            Account
          </span>

          <h1>
            Your profile and
            details
          </h1>

          <p>
            Manage your profile photograph,
            contact information and account
            preferences from one place.
          </p>
        </div>

        <div className="manage-account-email">
          <Mail
            size={17}
          />

          <span>
            <small>
              Sign-in email
            </small>

            {user?.email ||
              "Not available"}
          </span>
        </div>
      </section>

      {error ? (
        <div
          className="manage-account-alert"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          className="manage-account-alert is-success"
          role="status"
        >
          <CheckCircle2
            size={18}
          />

          {message}
        </div>
      ) : null}

      <form
        className="manage-account-form"
        onSubmit={submit}
        aria-busy={
          loading ||
          saving
        }
      >
        <section>
          <header>
            <UserRound
              size={20}
            />

            <div>
              <h2>
                Profile
              </h2>

              <p>
                Every registered SalonAI user can
                add or change their profile picture.
              </p>
            </div>
          </header>

          <ProfilePhotoUploader
            value={
              form.profilePhoto
            }
            onChange={(
              value
            ) =>
              updateField(
                "profilePhoto",
                value
              )
            }
            name={form.name}
            label="Profile photograph"
            disabled={
              loading ||
              saving
            }
          />

          <div className="manage-account-grid">
            <label className="manage-account-wide">
              Full name

              <input
                required
                disabled={loading}
                value={form.name}
                onChange={(
                  event
                ) =>
                  updateField(
                    "name",
                    event.target
                      .value
                  )
                }
                autoComplete="name"
              />
            </label>

            <label>
              Phone number

              <input
                disabled={loading}
                value={form.phone}
                onChange={(
                  event
                ) =>
                  updateField(
                    "phone",
                    event.target
                      .value
                  )
                }
                autoComplete="tel"
                inputMode="tel"
              />
            </label>
          </div>
        </section>

        <section>
          <header>
            <Home
              size={20}
            />

            <div>
              <h2>
                Home address
              </h2>

              <p>
                Saved securely to your
                account and available for
                delivery checkout.
              </p>
            </div>
          </header>

          <div className="manage-account-grid">
            <label className="manage-account-wide">
              Address line 1

              <input
                disabled={loading}
                value={
                  form.homeAddress
                    .line1
                }
                onChange={(
                  event
                ) =>
                  updateAddress(
                    "line1",
                    event.target
                      .value
                  )
                }
                autoComplete="address-line1"
              />
            </label>

            <label className="manage-account-wide">
              Address line 2

              <input
                disabled={loading}
                value={
                  form.homeAddress
                    .line2
                }
                onChange={(
                  event
                ) =>
                  updateAddress(
                    "line2",
                    event.target
                      .value
                  )
                }
                autoComplete="address-line2"
              />
            </label>

            <label>
              Town or city

              <input
                disabled={loading}
                value={
                  form.homeAddress
                    .city
                }
                onChange={(
                  event
                ) =>
                  updateAddress(
                    "city",
                    event.target
                      .value
                  )
                }
                autoComplete="address-level2"
              />
            </label>

            <label>
              County

              <input
                disabled={loading}
                value={
                  form.homeAddress
                    .county
                }
                onChange={(
                  event
                ) =>
                  updateAddress(
                    "county",
                    event.target
                      .value
                  )
                }
                autoComplete="address-level1"
              />
            </label>

            <label>
              Postcode

              <input
                disabled={loading}
                value={
                  form.homeAddress
                    .postcode
                }
                onChange={(
                  event
                ) =>
                  updateAddress(
                    "postcode",
                    event.target
                      .value
                      .toUpperCase()
                  )
                }
                autoComplete="postal-code"
              />
            </label>

            <label>
              Country

              <input
                disabled={loading}
                value={
                  form.homeAddress
                    .country
                }
                onChange={(
                  event
                ) =>
                  updateAddress(
                    "country",
                    event.target
                      .value
                  )
                }
                autoComplete="country-name"
              />
            </label>
          </div>
        </section>

        <footer>
          <p>
            <ShieldCheck
              size={17}
            />

            Your address is never
            displayed publicly.
          </p>

          <button
            type="submit"
            className="app-button app-button-primary"
            disabled={
              loading ||
              saving
            }
          >
            <Save
              size={17}
            />

            {saving
              ? "Saving…"
              : "Save account details"}
          </button>
        </footer>
      </form>

      {isCustomer ? (
        <form
          className="manage-account-form"
          onSubmit={
            saveConsultation
          }
        >
          <section>
            <header>
              <Scissors
                size={20}
              />

              <div>
                <h2>
                  Hair consultation
                </h2>

                <p>
                  Tell us about your hair and
                  your goals. Save the
                  consultation to your account,
                  then request personalised
                  advice.
                </p>
              </div>
            </header>

            <div className="manage-account-grid">
              <label>
                Hair type

                <select
                  value={
                    consultation
                      .hairType
                  }
                  onChange={(
                    event
                  ) =>
                    updateConsultation(
                      "hairType",
                      event.target
                        .value
                    )
                  }
                >
                  <option value="">
                    Select hair type
                  </option>

                  <option value="straight">
                    Straight
                  </option>

                  <option value="wavy">
                    Wavy
                  </option>

                  <option value="curly">
                    Curly
                  </option>

                  <option value="coily">
                    Coily
                  </option>
                </select>
              </label>

              <label>
                Current colour

                <input
                  value={
                    consultation
                      .currentColour
                  }
                  onChange={(
                    event
                  ) =>
                    updateConsultation(
                      "currentColour",
                      event.target
                        .value
                    )
                  }
                  maxLength={100}
                />
              </label>

              <label className="manage-account-wide">
                Desired result

                <textarea
                  required
                  value={
                    consultation
                      .desiredOutcome
                  }
                  onChange={(
                    event
                  ) =>
                    updateConsultation(
                      "desiredOutcome",
                      event.target
                        .value
                    )
                  }
                  maxLength={750}
                  rows={4}
                  placeholder="Describe the result you would like to achieve."
                />
              </label>

              <label className="manage-account-wide">
                Sensitivities

                <textarea
                  value={
                    consultation
                      .sensitivities
                  }
                  onChange={(
                    event
                  ) =>
                    updateConsultation(
                      "sensitivities",
                      event.target
                        .value
                    )
                  }
                  maxLength={750}
                  rows={3}
                  placeholder="Allergies, scalp sensitivity or other concerns."
                />
              </label>

              <label className="manage-account-wide">
                Previous treatments

                <textarea
                  value={
                    consultation
                      .previousTreatments
                  }
                  onChange={(
                    event
                  ) =>
                    updateConsultation(
                      "previousTreatments",
                      event.target
                        .value
                    )
                  }
                  maxLength={1000}
                  rows={3}
                  placeholder="Colour, bleach, keratin, relaxer, perm or other treatments."
                />
              </label>

              <label className="manage-account-wide">
                Additional notes

                <textarea
                  value={
                    consultation
                      .notes
                  }
                  onChange={(
                    event
                  ) =>
                    updateConsultation(
                      "notes",
                      event.target
                        .value
                    )
                  }
                  maxLength={1000}
                  rows={3}
                />
              </label>
            </div>

            <label>
              <input
                type="checkbox"
                checked={
                  consultation
                    .dataProcessingConsent
                }
                onChange={(
                  event
                ) =>
                  updateConsultation(
                    "dataProcessingConsent",
                    event.target
                      .checked
                  )
                }
              />

              I consent to SalonAI saving
              these consultation details to
              my account so they can be used
              to provide haircare advice.
            </label>
          </section>

          <footer>
            <button
              type="submit"
              className="app-button app-button-secondary"
              disabled={
                savingConsultation
              }
            >
              <Save
                size={17}
              />

              {savingConsultation
                ? "Saving consultation…"
                : "Save consultation"}
            </button>

            <button
              type="button"
              className="app-button app-button-primary"
              disabled={
                requestingAdvice
              }
              onClick={
                requestAdvice
              }
            >
              <BrainCircuit
                size={17}
              />

              {requestingAdvice
                ? "Preparing advice…"
                : "Request hair advice"}
            </button>
          </footer>
        </form>
      ) : null}

      {isCustomer &&
      advice ? (
        <section className="manage-account-form">
          <header>
            <Sparkles
              size={20}
            />

            <div>
              <h2>
                Your personalised
                hair advice
              </h2>

              <p>
                Generated from the
                consultation details saved
                to your account.
              </p>
            </div>
          </header>

          <pre
            style={{
              whiteSpace:
                "pre-wrap",
              fontFamily:
                "inherit",
            }}
          >
            {typeof advice ===
            "string"
              ? advice
              : JSON.stringify(
                  advice,
                  null,
                  2
                )}
          </pre>
        </section>
      ) : null}

      {isCustomer &&
      consultationHistory.length >
        0 ? (
        <aside className="manage-account-checkout-note">
          <Scissors
            size={19}
          />

          <div>
            <strong>
              Consultation history
            </strong>

            <p>
              {
                consultationHistory
                  .length
              }{" "}
              saved consultation
              {consultationHistory
                .length === 1
                ? ""
                : "s"}{" "}
              on your account.
            </p>
          </div>
        </aside>
      ) : null}

      <aside className="manage-account-checkout-note">
        <MapPin
          size={19}
        />

        <div>
          <strong>
            Faster haircare checkout
          </strong>

          <p>
            Your saved home address will
            prefill the delivery form; you
            can still change it for an
            individual order.
          </p>
        </div>
      </aside>
    </main>
  );
}