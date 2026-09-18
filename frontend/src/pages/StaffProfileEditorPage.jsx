import {
  CheckCircle2,
  Eye,
  EyeOff,
  Save,
  Scissors,
  Sparkles,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useSearchParams,
} from "react-router-dom";

import ProfilePhotoUploader from "../components/profile/ProfilePhotoUploader.jsx";
import Alert from "../components/ui/Alert.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import adminStaffService from "../Services/adminStaffService.js";
import stylistService from "../Services/stylistService.js";
import useAuth from "../hooks/useAuth.js";
import {
  hasPermission,
} from "../utils/permissions.js";

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
  return Array.isArray(value)
    ? value.join(", ")
    : String(value || "");
}

function stylistToForm(stylist = {}) {
  return {
    firstName: stylist.firstName || "",
    lastName: stylist.lastName || "",
    email: stylist.email || "",
    jobTitle:
      stylist.jobTitle ||
      "Hair professional",
    biography:
      stylist.biography || "",
    profileImage:
      stylist.profileImage || "",
    yearsExperience:
      Number(
        stylist.yearsExperience || 0
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
      stylist.profilePublished === true,
  };
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}

function errorMessage(
  error,
  fallback
) {
  return (
    error?.response?.data
      ?.message ||
    error?.message ||
    fallback
  );
}

function profilePayload(form) {
  return {
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
  };
}

export default function StaffProfileEditorPage() {
  const {
    user,
  } = useAuth();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const canReadAll =
    hasPermission(
      user,
      "profile:all:read"
    );

  const canUpdateAll =
    hasPermission(
      user,
      "profile:all:update"
    );

  const canUpdateOwn =
    hasPermission(
      user,
      "profile:own:update"
    );

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    selectedEmployeeId,
    setSelectedEmployeeId,
  ] = useState("");

  const [
    selectedProfileId,
    setSelectedProfileId,
  ] = useState("");

  const [
    form,
    setForm,
  ] = useState(
    emptyProfile
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const selectedEmployee =
    useMemo(
      () =>
        employees.find(
          (employee) =>
            String(
              employee.id
            ) ===
            String(
              selectedEmployeeId
            )
        ) || null,
      [
        employees,
        selectedEmployeeId,
      ]
    );

  const loadEmployeeProfile =
    useCallback(
      async (employee) => {
        const profileId =
          employee
            ?.stylistProfile
            ?.id;

        if (!profileId) {
          setSelectedProfileId(
            ""
          );
          setForm(
            emptyProfile
          );
          setError(
            "This staff account does not yet have a linked public profile. Open Manage employee first to create/link its operational profile."
          );
          return;
        }

        const stylist =
          await stylistService.getStylist(
            profileId
          );

        setSelectedProfileId(
          String(profileId)
        );

        setForm(
          stylistToForm(
            stylist
          )
        );
      },
      []
    );

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");
        setMessage("");

        try {
          if (!canReadAll) {
            const payload =
              await stylistService.getMyProfile();

            setEmployees([]);
            setSelectedEmployeeId(
              ""
            );
            setSelectedProfileId(
              String(
                payload
                  ?.stylist
                  ?._id || ""
              )
            );
            setForm(
              stylistToForm(
                payload?.stylist
              )
            );
            return;
          }

          const result =
            await adminStaffService.list({
              limit: 500,
            });

          const staff =
            Array.isArray(
              result?.users
            )
              ? result.users
              : [];

          setEmployees(
            staff
          );

          if (!staff.length) {
            setSelectedEmployeeId(
              ""
            );
            setSelectedProfileId(
              ""
            );
            setForm(
              emptyProfile
            );
            setError(
              "No staff accounts are available."
            );
            return;
          }

          const requested =
            searchParams.get(
              "edit"
            );

          const target =
            staff.find(
              (employee) =>
                String(
                  employee.id
                ) ===
                  String(
                    requested ||
                      ""
                  ) ||
                String(
                  employee
                    ?.stylistProfile
                    ?.id || ""
                ) ===
                  String(
                    requested ||
                      ""
                  )
            ) ||
            staff[0];

          setSelectedEmployeeId(
            String(
              target.id
            )
          );

          await loadEmployeeProfile(
            target
          );

          if (requested) {
            const next =
              new URLSearchParams(
                searchParams
              );

            next.delete(
              "edit"
            );

            setSearchParams(
              next,
              {
                replace:
                  true,
              }
            );
          }
        } catch (
          requestError
        ) {
          setError(
            errorMessage(
              requestError,
              canReadAll
                ? "Staff profiles could not be loaded."
                : "Your staff profile could not be loaded."
            )
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        canReadAll,
        loadEmployeeProfile,
        searchParams,
        setSearchParams,
      ]
    );

  useEffect(() => {
    void load();
  }, [load]);

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

  async function changeEmployee(
    employeeId
  ) {
    const employee =
      employees.find(
        (item) =>
          String(item.id) ===
          String(employeeId)
      );

    setSelectedEmployeeId(
      String(
        employeeId
      )
    );
    setError("");
    setMessage("");

    if (!employee) {
      return;
    }

    setLoading(true);

    try {
      await loadEmployeeProfile(
        employee
      );
    } catch (
      requestError
    ) {
      setError(
        errorMessage(
          requestError,
          "The selected staff profile could not be loaded."
        )
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function submit(
    event
  ) {
    event.preventDefault();

    if (
      canReadAll &&
      !canUpdateAll
    ) {
      setError(
        "You can view staff profiles but you do not have permission to edit them."
      );
      return;
    }

    if (
      !canReadAll &&
      !canUpdateOwn
    ) {
      setError(
        "You do not have permission to edit this profile."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      let response;

      if (
        canReadAll
      ) {
        if (
          !selectedProfileId
        ) {
          throw new Error(
            "The selected staff account does not have a linked profile."
          );
        }

        response =
          await stylistService.updateStylist(
            selectedProfileId,
            profilePayload(
              form
            )
          );

        setForm(
          stylistToForm(
            response
          )
        );

        setMessage(
          `${selectedEmployee?.name || "Staff"} profile has been saved.`
        );
      } else {
        response =
          await stylistService.updateMyProfile(
            profilePayload(
              form
            )
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
      }
    } catch (
      requestError
    ) {
      setError(
        errorMessage(
          requestError,
          canReadAll
            ? "The selected staff profile could not be saved."
            : "Your staff profile could not be saved."
        )
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

  const editable =
    canReadAll
      ? canUpdateAll
      : canUpdateOwn;

  return (
    <main
      className="staff-profile-page"
      id="main-content"
      tabIndex="-1"
    >
      <section className="staff-profile-hero">
        <div>
          <p className="customer-eyebrow">
            {canReadAll ? (
              <UsersRound
                size={16}
              />
            ) : (
              <Sparkles
                size={16}
              />
            )}
            {canReadAll
              ? "Staff profiles"
              : "My public profile"}
          </p>

          <h1>
            {canReadAll
              ? "Manage the professional profiles clients see."
              : "Publish the professional profile clients see."}
          </h1>

          <p>
            {canReadAll
              ? "Select a genuine staff account, then maintain its photograph, title, biography, specialties and public links. Historical booking records are not treated as staff identities."
              : "Keep your photograph, title, biography, specialties and public links current. Private account information remains separate from the public profile."}
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

      {canReadAll ? (
        <section className="mb-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UsersRound
              size={20}
            />
            <div>
              <h2 className="font-bold text-black">
                Select staff profile
              </h2>
              <p className="text-sm text-stone-600">
                The list uses canonical SalonAI staff accounts, in the same order as Employees.
              </p>
            </div>
          </div>

          <label className="mt-4 block max-w-xl text-sm font-semibold text-black">
            Staff member
            <select
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-black"
              value={
                selectedEmployeeId
              }
              onChange={(
                event
              ) =>
                void changeEmployee(
                  event.target
                    .value
                )
              }
            >
              {employees.map(
                (employee) => (
                  <option
                    key={
                      employee.id
                    }
                    value={
                      employee.id
                    }
                  >
                    {employee.name} · {employee.role}
                  </option>
                )
              )}
            </select>
          </label>
        </section>
      ) : null}

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
              saving ||
              !editable
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
                disabled={
                  !editable
                }
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
                disabled={
                  !editable
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
                disabled={
                  !editable
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
                {form.biography.length}/2000 characters
              </small>
            </label>

            <label className="staff-profile-wide">
              Specialties
              <input
                value={
                  form.specialties
                }
                disabled={
                  !editable
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
                disabled={
                  !editable
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
                disabled={
                  !editable
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
                disabled={
                  !editable
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
                disabled={
                  !editable
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
              When enabled, the profile may appear on public team experiences subject to the salon&apos;s Public team feature control.
            </p>
          </div>

          <label className="staff-profile-switch">
            <input
              type="checkbox"
              checked={
                form.profilePublished
              }
              disabled={
                !editable
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
              saving ||
              !editable ||
              (canReadAll &&
                !selectedProfileId)
            }
          >
            <Save
              size={17}
            />
            {saving
              ? "Saving…"
              : canReadAll
                ? "Save selected profile"
                : "Save my profile"}
          </button>
        </footer>
      </form>
    </main>
  );
}
