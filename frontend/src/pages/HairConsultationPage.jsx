import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Palette,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import { getAppointments } from "../Services/appointmentApi.js";
import customerExperienceService from "../Services/customerExperienceService.js";

const CONCERNS = [
  "Dryness",
  "Frizz",
  "Breakage",
  "Split ends",
  "Lack of shine",
  "Colour fade",
  "Brassiness",
  "Flat roots",
  "Excess oil",
  "Scalp sensitivity",
  "Tangling",
  "Heat damage",
];

const EMPTY_FORM = {
  appointmentId: "",
  hairType: "",
  texturePattern: "",
  density: "",
  strandThickness: "",
  length: "",
  porosity: "",
  scalpCondition: "",
  hairCondition: "",
  naturalColour: "",
  currentColour: "",
  greyPercentage: "",
  colourHistory: "",
  bleachHistory: "",
  previousTreatments: "",
  washFrequency: "",
  heatStylingFrequency: "",
  homeCareRoutine: "",
  currentProducts: "",
  lifestyleExposure: "",
  concerns: [],
  desiredOutcome: "",
  maintenancePreference: "",
  budgetRange: "",
  upcomingEvent: "",
  inspirationNotes: "",
  sensitivities: "",
  patchTestRequired: false,
  safetyNotes: "",
  notes: "",
  dataProcessingConsent: false,
};

function unwrapAppointments(value) {
  const payload = value?.data ?? value ?? {};
  if (Array.isArray(payload)) return payload;
  return payload.appointments || payload.items || payload.results || [];
}

function appointmentDate(item) {
  return item?.startsAt || item?.appointmentDate || null;
}

function appointmentLabel(item) {
  const service = item?.service?.name || item?.serviceName || "Salon appointment";
  const rawDate = appointmentDate(item);
  const date = rawDate ? new Date(rawDate) : null;
  const formatted = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date)
    : "date unavailable";

  return `${service} · ${formatted}`;
}

function requestMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section>
      <header>
        <Icon size={20} />
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export default function HairConsultationPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [appointments, setAppointments] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const futureAppointments = useMemo(
    () =>
      appointments.filter((item) => {
        const date = new Date(appointmentDate(item));
        return !Number.isNaN(date.getTime()) && date.getTime() >= Date.now();
      }),
    [appointments]
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const [appointmentResult, experienceResult] = await Promise.allSettled([
        getAppointments(),
        customerExperienceService.getMine(),
      ]);

      if (!active) return;

      if (appointmentResult.status === "fulfilled") {
        setAppointments(unwrapAppointments(appointmentResult.value));
      }

      if (experienceResult.status === "fulfilled") {
        const consultations = experienceResult.value?.profile?.consultations || [];
        setHistory(Array.isArray(consultations) ? consultations : []);
      }

      if (
        appointmentResult.status === "rejected" &&
        experienceResult.status === "rejected"
      ) {
        setError("We could not load your consultation information. Please try again.");
      }

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  function setField(field, value) {
    setMessage("");
    setError("");
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleConcern(concern) {
    setForm((current) => ({
      ...current,
      concerns: current.concerns.includes(concern)
        ? current.concerns.filter((item) => item !== concern)
        : [...current.concerns, concern],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.desiredOutcome.trim()) {
      setError("Tell us what you would like to achieve from your consultation.");
      return;
    }

    if (!form.dataProcessingConsent) {
      setError("Please confirm consent before saving your consultation.");
      return;
    }

    setSaving(true);

    try {
      const result = await customerExperienceService.addConsultation(form);
      const saved = result?.consultation;

      if (saved) {
        setHistory((current) => [saved, ...current]);
      }

      setForm((current) => ({
        ...EMPTY_FORM,
        appointmentId: current.appointmentId,
      }));
      setMessage(
        result?.message ||
          "Your consultation has been saved securely for the salon team."
      );
    } catch (requestError) {
      setError(
        requestMessage(
          requestError,
          "Your consultation could not be saved. Please try again."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="manage-account-page" id="main-content" tabIndex="-1">
      <section className="manage-account-hero">
        <div className="manage-account-hero-icon">
          <ClipboardList size={26} />
        </div>
        <div>
          <span>Salon consultation</span>
          <h1>Professional hair consultation</h1>
          <p>
            Give your stylist a useful picture of your hair history, routine,
            goals and salon-relevant sensitivities before your appointment.
          </p>
        </div>
        <div className="manage-account-email">
          <Sparkles size={17} />
          <span>
            <small>Private to your salon account</small>
            Saved consultation history
          </span>
        </div>
      </section>

      <div className="manage-account-alert" role="note">
        <AlertTriangle size={18} />
        This form supports salon service planning only. It does not provide a
        medical diagnosis. Tell the salon directly about allergies, reactions
        or conditions that could affect a service, and seek medical advice for
        health concerns where appropriate.
      </div>

      {error ? (
        <div className="manage-account-alert" role="alert">{error}</div>
      ) : null}

      {message ? (
        <div className="manage-account-alert is-success" role="status">
          <CheckCircle2 size={18} />
          {message}
        </div>
      ) : null}

      <form className="manage-account-form" onSubmit={submit} aria-busy={saving || loading}>
        <Section
          icon={ClipboardList}
          title="Appointment and hair profile"
          description="Start with the physical characteristics your stylist needs for service planning."
        >
          <div className="manage-account-grid">
            <label className="manage-account-wide">
              Link to an upcoming appointment (optional)
              <select
                value={form.appointmentId}
                onChange={(event) => setField("appointmentId", event.target.value)}
              >
                <option value="">General consultation</option>
                {futureAppointments.map((item) => (
                  <option key={item?._id || item?.id} value={item?._id || item?.id}>
                    {appointmentLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Hair family
              <select value={form.hairType} onChange={(event) => setField("hairType", event.target.value)}>
                <option value="">Choose</option>
                <option value="straight">Straight</option>
                <option value="wavy">Wavy</option>
                <option value="curly">Curly</option>
                <option value="coily">Coily</option>
                <option value="mixed">Mixed patterns</option>
              </select>
            </label>

            <label>
              Curl / texture pattern
              <input
                value={form.texturePattern}
                onChange={(event) => setField("texturePattern", event.target.value)}
                placeholder="e.g. 2C, 3B, mixed, very straight"
              />
            </label>

            <label>
              Density
              <select value={form.density} onChange={(event) => setField("density", event.target.value)}>
                <option value="">Choose</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="unsure">Not sure</option>
              </select>
            </label>

            <label>
              Strand thickness
              <select value={form.strandThickness} onChange={(event) => setField("strandThickness", event.target.value)}>
                <option value="">Choose</option>
                <option value="fine">Fine</option>
                <option value="medium">Medium</option>
                <option value="coarse">Coarse</option>
                <option value="mixed">Mixed</option>
                <option value="unsure">Not sure</option>
              </select>
            </label>

            <label>
              Current length
              <select value={form.length} onChange={(event) => setField("length", event.target.value)}>
                <option value="">Choose</option>
                <option value="short">Short / above ear</option>
                <option value="jaw">Jaw / bob</option>
                <option value="shoulder">Shoulder</option>
                <option value="mid-back">Mid-back</option>
                <option value="long">Long / below mid-back</option>
              </select>
            </label>

            <label>
              Porosity
              <select value={form.porosity} onChange={(event) => setField("porosity", event.target.value)}>
                <option value="">Choose</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="unsure">Not sure</option>
              </select>
            </label>

            <label className="manage-account-wide">
              Hair condition now
              <textarea
                rows="3"
                value={form.hairCondition}
                onChange={(event) => setField("hairCondition", event.target.value)}
                placeholder="Strength, elasticity, dryness, damage, ends, recent changes…"
              />
            </label>

            <label className="manage-account-wide">
              Scalp information relevant to a salon service
              <textarea
                rows="3"
                value={form.scalpCondition}
                onChange={(event) => setField("scalpCondition", event.target.value)}
                placeholder="For example sensitivity, dryness or irritation the stylist should know about."
              />
            </label>
          </div>
        </Section>

        <Section
          icon={Palette}
          title="Colour and chemical history"
          description="Colour results depend heavily on what is already in the hair, including home colour and lightener history."
        >
          <div className="manage-account-grid">
            <label>
              Natural colour
              <input value={form.naturalColour} onChange={(event) => setField("naturalColour", event.target.value)} />
            </label>
            <label>
              Current colour
              <input value={form.currentColour} onChange={(event) => setField("currentColour", event.target.value)} />
            </label>
            <label>
              Approximate grey percentage
              <select value={form.greyPercentage} onChange={(event) => setField("greyPercentage", event.target.value)}>
                <option value="">Choose</option>
                <option value="0">None</option>
                <option value="under-25">Under 25%</option>
                <option value="25-50">25–50%</option>
                <option value="50-75">50–75%</option>
                <option value="over-75">Over 75%</option>
                <option value="unsure">Not sure</option>
              </select>
            </label>
            <label className="manage-account-wide">
              Colour history
              <textarea
                rows="4"
                value={form.colourHistory}
                onChange={(event) => setField("colourHistory", event.target.value)}
                placeholder="Professional or home colour, toners, henna, colour removers, dates and shades where known."
              />
            </label>
            <label className="manage-account-wide">
              Bleach / lightener history
              <textarea
                rows="3"
                value={form.bleachHistory}
                onChange={(event) => setField("bleachHistory", event.target.value)}
                placeholder="Highlights, balayage, bleach, lightener or previous lifting services."
              />
            </label>
            <label className="manage-account-wide">
              Other chemical treatments
              <textarea
                rows="3"
                value={form.previousTreatments}
                onChange={(event) => setField("previousTreatments", event.target.value)}
                placeholder="Keratin, relaxer, perm, smoothing, straightening or other chemical services."
              />
            </label>
          </div>
        </Section>

        <Section
          icon={Sparkles}
          title="Routine and current concerns"
          description="Your home routine helps the stylist recommend a result you can realistically maintain."
        >
          <div className="manage-account-grid">
            <label>
              Wash frequency
              <select value={form.washFrequency} onChange={(event) => setField("washFrequency", event.target.value)}>
                <option value="">Choose</option>
                <option value="daily">Daily</option>
                <option value="2-3-week">2–3 times a week</option>
                <option value="weekly">About weekly</option>
                <option value="less-weekly">Less than weekly</option>
              </select>
            </label>
            <label>
              Heat styling
              <select value={form.heatStylingFrequency} onChange={(event) => setField("heatStylingFrequency", event.target.value)}>
                <option value="">Choose</option>
                <option value="none">Rarely / never</option>
                <option value="weekly">About weekly</option>
                <option value="several-week">Several times a week</option>
                <option value="daily">Daily</option>
              </select>
            </label>
            <label className="manage-account-wide">
              Home-care routine
              <textarea rows="3" value={form.homeCareRoutine} onChange={(event) => setField("homeCareRoutine", event.target.value)} placeholder="Shampoo, conditioner, masks, leave-ins, styling routine…" />
            </label>
            <label className="manage-account-wide">
              Products currently used
              <textarea rows="3" value={form.currentProducts} onChange={(event) => setField("currentProducts", event.target.value)} placeholder="Brands/products if you know them." />
            </label>
            <label className="manage-account-wide">
              Lifestyle exposure
              <textarea rows="3" value={form.lifestyleExposure} onChange={(event) => setField("lifestyleExposure", event.target.value)} placeholder="Swimming, frequent sun, hard water, gym/sauna, protective styles or other relevant exposure." />
            </label>
          </div>

          <fieldset>
            <legend>What would you most like to improve?</legend>
            <div className="experience-chip-options">
              {CONCERNS.map((concern) => (
                <label key={concern}>
                  <input
                    type="checkbox"
                    checked={form.concerns.includes(concern)}
                    onChange={() => toggleConcern(concern)}
                  />
                  <span>{concern}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </Section>

        <Section
          icon={Sparkles}
          title="Your goal"
          description="Describe the result you want and how much maintenance you are comfortable with."
        >
          <div className="manage-account-grid">
            <label className="manage-account-wide">
              Desired result *
              <textarea
                required
                rows="5"
                maxLength="1500"
                value={form.desiredOutcome}
                onChange={(event) => setField("desiredOutcome", event.target.value)}
                placeholder="Cut, colour, finish, tone, shape, movement, volume or overall look you want to achieve."
              />
            </label>
            <label>
              Maintenance preference
              <select value={form.maintenancePreference} onChange={(event) => setField("maintenancePreference", event.target.value)}>
                <option value="">Choose</option>
                <option value="low">Low maintenance</option>
                <option value="moderate">Comfortable with regular upkeep</option>
                <option value="high">Happy with high-maintenance results</option>
                <option value="discuss">Discuss with stylist</option>
              </select>
            </label>
            <label>
              Approximate service budget (optional)
              <select value={form.budgetRange} onChange={(event) => setField("budgetRange", event.target.value)}>
                <option value="">Prefer to discuss</option>
                <option value="under-75">Under £75</option>
                <option value="75-150">£75–£150</option>
                <option value="150-250">£150–£250</option>
                <option value="250-plus">£250+</option>
              </select>
            </label>
            <label className="manage-account-wide">
              Upcoming event or deadline (optional)
              <textarea rows="2" value={form.upcomingEvent} onChange={(event) => setField("upcomingEvent", event.target.value)} placeholder="Wedding, holiday, event date or another timing constraint." />
            </label>
            <label className="manage-account-wide">
              Inspiration / reference notes
              <textarea rows="3" value={form.inspirationNotes} onChange={(event) => setField("inspirationNotes", event.target.value)} placeholder="Describe reference images, styles or specific details you like or dislike." />
            </label>
          </div>
        </Section>

        <Section
          icon={ShieldCheck}
          title="Safety and service preparation"
          description="This information helps the salon decide whether a patch test, strand test or further consultation is needed."
        >
          <div className="manage-account-grid">
            <label className="manage-account-wide">
              Known salon-product sensitivities or allergies
              <textarea rows="3" value={form.sensitivities} onChange={(event) => setField("sensitivities", event.target.value)} />
            </label>
            <label className="manage-account-wide">
              Other salon-relevant safety notes
              <textarea rows="3" value={form.safetyNotes} onChange={(event) => setField("safetyNotes", event.target.value)} placeholder="Previous reactions or anything the stylist should discuss with you before a service." />
            </label>
            <label className="manage-account-wide">
              Additional notes
              <textarea rows="3" value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
            </label>
          </div>

          <label className="experience-consent">
            <input
              type="checkbox"
              checked={form.patchTestRequired}
              onChange={(event) => setField("patchTestRequired", event.target.checked)}
            />
            <span>I believe this service may require a patch/skin test or I would like the salon to confirm whether one is required.</span>
          </label>

          <label className="experience-consent">
            <input
              required
              type="checkbox"
              checked={form.dataProcessingConsent}
              onChange={(event) => setField("dataProcessingConsent", event.target.checked)}
            />
            <span>I consent to SalonAI storing these consultation details for salon care, service planning and appointment preparation.</span>
          </label>
        </Section>

        <footer>
          <p>
            <ShieldCheck size={17} />
            Your consultation is stored in your authenticated account and is not displayed publicly.
          </p>
          <button type="submit" className="app-button app-button-primary" disabled={saving || loading}>
            <Save size={17} />
            {saving ? "Saving consultation…" : "Save consultation"}
          </button>
        </footer>
      </form>

      <section className="manage-account-form">
        <Section
          icon={ClipboardList}
          title="Consultation history"
          description="Your latest submitted consultation records are kept here so you and the salon can refer back to them."
        >
          {history.length ? (
            <div className="account-list">
              {history.slice(0, 10).map((item) => (
                <article className="account-list-item" key={item?._id || item?.id}>
                  <span className="account-list-icon"><ClipboardList size={19} /></span>
                  <div className="account-list-copy">
                    <strong>{item.desiredOutcome || "Hair consultation"}</strong>
                    <span>
                      {item.createdAt
                        ? new Intl.DateTimeFormat("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(item.createdAt))
                        : "Saved consultation"}
                    </span>
                    <small>
                      {[item.hairType, item.currentColour].filter(Boolean).join(" · ") ||
                        "Professional consultation record"}
                    </small>
                  </div>
                  <span className="account-status">{item.status || "submitted"}</span>
                </article>
              ))}
            </div>
          ) : (
            <p>No consultations have been saved yet.</p>
          )}
        </Section>
      </section>

      <p className="account-note">
        Looking for saved inspiration and other salon tools? <Link to="/experience">Open Salon Experience</Link>.
      </p>
    </main>
  );
}
