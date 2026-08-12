import {
  CheckCircle2,
  Eye,
  EyeOff,
  Save,
  Scissors,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import ProfilePhotoUploader from "../components/profile/ProfilePhotoUploader.jsx";
import Alert from "../components/ui/Alert.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import stylistService from "../Services/stylistService.js";

const emptyProfile = {
  firstName: "",
  lastName: "",
  email: "",
  jobTitle: "Hair professional",
  biography: "",
  profileImage: "",
  yearsExperience: 0,
  specialties: "",
  languages: "",
  instagram: "",
  facebook: "",
  website: "",
  profilePublished: false,
};

function listToText(value) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value.join(
      ", "
    );
  }

  return String(
    value || ""
  );
}

function stylistToForm(stylist = {}) {
  return {
    firstName:
      stylist.firstName || "",
    lastName:
      stylist.lastName || "",
    email:
      stylist.email || "",
    jobTitle:
      stylist.jobTitle ||
      "Hair professional",
    biography:
      stylist.biography || "",
    profileImage:
      stylist.profileImage || "",
    yearsExperience:
      Number(
        stylist.yearsExperience ||
          0
      ),
    specialties:
      listToText(
        stylist.specialties
      ),
    languages:
      listToText(
        stylist.languages
      ),
    instagram:
      stylist.instagram || "",
    facebook:
      stylist.facebook || "",
    website:
      stylist.website || "",
    profilePublished:
      stylist.profilePublished !==
      false,
  };
}

function splitList(value) {
  return String(
    value || ""
  )
    .split(",")
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}

export default function StaffProfileEditorPage() {
  const [
    form,
    setForm,
  ] = useState(
    emptyProfile
  );
  const [
    loading,
    setLoading,
  ] = useState(
    true
  );
  const [
    saving,
    setSaving,
  ] = useState(
    false
  );
  const [
    error,
    setError,
  ] = useState("");
  const [
    message,
    setMessage,
  ] = useState("");

  useEffect(() => {
    let active =
      true;

    stylistService
      .getMyProfile()
      .then(
        (payload) => {
          if (!active) {
            return;
          }

          setForm(
            stylistToForm(
              payload?.stylist
            )
          );
        }
      )
      .catch(
        (requestError) => {
          if (!active) {
            return;
          }

          setError(
            requestError
              .response
              ?.data
              ?.message ||
              "Your staff profile could not be loaded."
          );
        }
      )
      .finally(() => {
        if (active) {
          setLoading(
            false
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function update(
    field,
    value
  ) {
    setError("");
    setMessage("");

    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );
  }

  async function submit(
    event
  ) {
    event.preventDefault();

    setSaving(
      true
    );
    setError("");
    setMessage("");

    try {
      const response =
        await stylistService.updateMyProfile(
          {
            jobTitle:
              form.jobTitle,
            biography:
              form.biography,
            profileImage:
              form.profileImage,
            yearsExperience:
              Number(
                form.yearsExperience
              ) || 0,
            specialties:
              splitList(
                form.specialties
              ),
            languages:
              splitList(
                form.languages
              ),
            instagram:
              form.instagram,
            facebook:
              form.facebook,
            website:
              form.website,
            profilePublished:
              form.profilePublished,
          }
        );

      setForm(
        stylistToForm(
          response?.stylist
        )
      );
      setMessage(
        response?.message ||
          "Your staff profile has been saved."
      );
    } catch (
      requestError
    ) {
      setError(
        requestError
          .response
          ?.data
          ?.message ||
          "Your staff profile could not be saved."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  if (loading) {
    return (
      <main className="staff-profile-page">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </main>
    );
  }

  return (
    <main
      className="staff-profile-page"
      id="main-content"
      tabIndex="-1"
    >
      <section className="staff-profile-hero">
        <div>
          <p className="customer-eyebrow">
            <Sparkles
              size={16}
            />
            Staff profile
          </p>
          <h1>
            Publish the professional
            profile clients see.
          </h1>
          <p>
            Keep your photograph, title, biography, specialties and public
            links current. Private contact information is not editable here and
            is not included in the public team endpoint.
          </p>
        </div>

        <div className="staff-profile-status">
          {form.profilePublished ? (
            <Eye
              size={20}
            />
          ) : (
            <EyeOff
              size={20}
            />
          )}

          <div>
            <small>
              Visibility
            </small>
            <strong>
              {form.profilePublished
                ? "Published"
                : "Hidden"}
            </strong>
          </div>
        </div>
      </section>

      {error ? (
        <Alert
          type="error"
          title="Staff profile"
        >
          {error}
        </Alert>
      ) : null}

      {message ? (
        <div
          className="staff-profile-success"
          role="status"
        >
          <CheckCircle2
            size={18}
          />
          {message}
        </div>
      ) : null}

      <form
        className="staff-profile-form"
        onSubmit={
          submit
        }
      >
        <section>
          <header>
            <Scissors
              size={20}
            />
            <div>
              <h2>
                Public identity
              </h2>
              <p>
                {form.firstName}{" "}
                {form.lastName}
                {form.email
                  ? ` · ${form.email}`
                  : ""}
              </p>
            </div>
          </header>

          <ProfilePhotoUploader
            value={
              form.profileImage
            }
            onChange={(
              value
            ) =>
              update(
                "profileImage",
                value
              )
            }
            name={`${form.firstName} ${form.lastName}`}
            label="Professional profile photograph"
            disabled={
              saving
            }
          />

          <div className="staff-profile-grid">
            <label>
              Job title
              <input
                value={
                  form.jobTitle
                }
                maxLength={120}
                onChange={(
                  event
                ) =>
                  update(
                    "jobTitle",
                    event.target
                      .value
                  )
                }
              />
            </label>

            <label>
              Years of experience
              <input
                type="number"
                min="0"
                max="80"
                step="1"
                value={
                  form.yearsExperience
                }
                onChange={(
                  event
                ) =>
                  update(
                    "yearsExperience",
                    event.target
                      .value
                  )
                }
              />
            </label>

            <label className="staff-profile-wide">
              Biography
              <textarea
                rows="6"
                maxLength="2000"
                value={
                  form.biography
                }
                onChange={(
                  event
                ) =>
                  update(
                    "biography",
                    event.target
                      .value
                  )
                }
              />
              <small>
                {
                  form.biography
                    .length
                }
                /2000 characters
              </small>
            </label>

            <label className="staff-profile-wide">
              Specialties
              <input
                value={
                  form.specialties
                }
                onChange={(
                  event
                ) =>
                  update(
                    "specialties",
                    event.target
                      .value
                  )
                }
                placeholder="Balayage, colour, precision cutting"
              />
              <small>
                Separate specialties with commas.
              </small>
            </label>

            <label className="staff-profile-wide">
              Languages
              <input
                value={
                  form.languages
                }
                onChange={(
                  event
                ) =>
                  update(
                    "languages",
                    event.target
                      .value
                  )
                }
                placeholder="English, Italian"
              />
            </label>

            <label>
              Instagram
              <input
                value={
                  form.instagram
                }
                onChange={(
                  event
                ) =>
                  update(
                    "instagram",
                    event.target
                      .value
                  )
                }
                placeholder="@handle or https://..."
              />
            </label>

            <label>
              Facebook
              <input
                type="url"
                value={
                  form.facebook
                }
                onChange={(
                  event
                ) =>
                  update(
                    "facebook",
                    event.target
                      .value
                  )
                }
                placeholder="https://..."
              />
            </label>

            <label className="staff-profile-wide">
              Website
              <input
                type="url"
                value={
                  form.website
                }
                onChange={(
                  event
                ) =>
                  update(
                    "website",
                    event.target
                      .value
                  )
                }
                placeholder="https://..."
              />
            </label>
          </div>
        </section>

        <section className="staff-profile-publish">
          <div>
            <strong>
              Publish this profile
            </strong>
            <p>
              When enabled, the profile appears on the public About/team
              experience.
            </p>
          </div>

          <label className="staff-profile-switch">
            <input
              type="checkbox"
              checked={
                form.profilePublished
              }
              onChange={(
                event
              ) =>
                update(
                  "profilePublished",
                  event.target
                    .checked
                )
              }
            />
            <span>
              {form.profilePublished
                ? "Published"
                : "Hidden"}
            </span>
          </label>
        </section>

        <footer className="staff-profile-actions">
          <button
            type="submit"
            className="app-button app-button-primary"
            disabled={
              saving
            }
          >
            <Save
              size={17}
            />
            {saving
              ? "Saving…"
              : "Save staff profile"}
          </button>
        </footer>
      </form>
    </main>
  );
}
