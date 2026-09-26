import {
  CalendarDays,
  KeyRound,
  Plus,
  Save,
  Scissors,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createPortal,
} from "react-dom";

import ProfilePhotoUploader from "../profile/ProfilePhotoUploader.jsx";
import adminStaffService from "../../Services/adminStaffService.js";
import serviceService from "../../Services/serviceService.js";
import staffRoleService from "../../Services/staffRoleService.js";
import useAuth from "../../hooks/useAuth.js";
import useModalFocusTrap from "../../hooks/useModalFocusTrap.js";
import {
  ASSIGNABLE_EMPLOYEE_PERMISSIONS,
  hasPermission,
} from "../../utils/permissions.js";
import {
  DEFAULT_ASSIGNABLE_STAFF_ROLES,
  assignableRolesForUser,
} from "../../utils/staffRoles.js";

const DEFAULT_JOB_TITLES = {
  stylist: "Hair professional",
  receptionist: "Receptionist",
  manager: "Salon manager",
  admin: "Salon administrator",
};

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function defaultWorkingHours() {
  return DAYS.map((day) => ({
    day,
    available: day !== "Sunday",
    start: "09:00",
    end:
      day === "Saturday"
        ? "15:00"
        : "17:00",
    breaks: [],
  }));
}

function emptyForm() {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "stylist",
    password: "",
    profilePhoto: "",
    jobTitle: "Hair professional",
    biography: "",
    specialties: "",
    isActive: true,
    profilePublished: false,
    acceptsAppointments: false,
    permissions: [],
    configureServices: false,
    services: [],
    configureSchedule: false,
    workingHours:
      defaultWorkingHours(),
  };
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

function splitList(value) {
  return [
    ...new Set(
      String(value || "")
        .split(",")
        .map((item) =>
          item.trim()
        )
        .filter(Boolean)
    ),
  ];
}

function groupPermissions() {
  const groups =
    new Map();

  for (
    const permission of
      ASSIGNABLE_EMPLOYEE_PERMISSIONS
  ) {
    const group =
      permission.group ||
      "Other";

    if (!groups.has(group)) {
      groups.set(
        group,
        []
      );
    }

    groups
      .get(group)
      .push(
        permission
      );
  }

  return [
    ...groups.entries(),
  ];
}

export default function AddEmployeeModal({
  open,
  onClose,
  onCreated,
}) {
  const {
    user,
  } = useAuth();
  const modalPanelRef =
    useRef(null);

  const canManageRoles =
    hasPermission(
      user,
      "employee:role:update"
    );

  const canManagePermissions =
    hasPermission(
      user,
      "employee:permissions:update"
    );

  const canAssignServices =
    hasPermission(
      user,
      "employee:services:update"
    ) &&
    hasPermission(
      user,
      "service:read"
    );

  const canConfigureSchedule =
    hasPermission(
      user,
      "employee:schedule:update"
    );

  const canCreateInactive =
    hasPermission(
      user,
      "employee:deactivate"
    );

  const [
    form,
    setForm,
  ] = useState(
    emptyForm
  );

  const [
    services,
    setServices,
  ] = useState([]);

  const [
    roles,
    setRoles,
  ] = useState(
    DEFAULT_ASSIGNABLE_STAFF_ROLES
  );

  const [
    servicesLoaded,
    setServicesLoaded,
  ] = useState(false);

  const [
    servicesError,
    setServicesError,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const permissionGroups =
    useMemo(
      groupPermissions,
      []
    );

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let active = true;

    staffRoleService
      .list()
      .then((rows) => {
        if (!active) {
          return;
        }

        setRoles(
          Array.isArray(rows) &&
          rows.length
            ? rows
            : DEFAULT_ASSIGNABLE_STAFF_ROLES
        );
      })
      .catch(() => {
        if (active) {
          setRoles(
            DEFAULT_ASSIGNABLE_STAFF_ROLES
          );
        }
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(
      emptyForm()
    );
    setError("");
    setServicesError("");
    setServices([]);
    setServicesLoaded(false);

    if (
      !canAssignServices
    ) {
      return;
    }

    let active = true;

    serviceService
      .getManagementServices()
      .then((rows) => {
        if (!active) {
          return;
        }

        setServices(
          Array.isArray(rows)
            ? rows
            : []
        );
        setServicesLoaded(
          true
        );
      })
      .catch(
        (requestError) => {
          if (!active) {
            return;
          }

          setServicesError(
            errorMessage(
              requestError,
              "Services could not be loaded. You can still create the employee and assign services later."
            )
          );
        }
      );

    return () => {
      active = false;
    };
  }, [
    canAssignServices,
    open,
  ]);

  const closeModal =
    useCallback(() => {
      if (!submitting) {
        onClose?.();
      }
    }, [onClose, submitting]);

  const setModalOpen =
    useCallback(
      (nextOpen) => {
        if (!nextOpen) {
          closeModal();
        }
      },
      [closeModal]
    );

  useModalFocusTrap({
    open,
    containerRef:
      modalPanelRef,
    setOpen:
      setModalOpen,
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const prior =
      document.body.style
        .overflow;
    document.body.style
      .overflow = "hidden";

    return () => {
      document.body.style
        .overflow = prior;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function update(
    field,
    value
  ) {
    setError("");

    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );
  }

  function updateRole(
    role
  ) {
    const definition =
      roles.find(
        (item) =>
          item.key === role
      );

    setForm(
      (current) => ({
        ...current,
        role,
        jobTitle:
          DEFAULT_JOB_TITLES[
            role
          ] ||
          definition?.name ||
          current.jobTitle,
        permissions: [],
      })
    );
  }

  function toggleService(
    serviceId
  ) {
    setForm(
      (current) => ({
        ...current,
        services:
          current.services.includes(
            serviceId
          )
            ? current.services.filter(
                (id) =>
                  id !==
                  serviceId
              )
            : [
                ...current.services,
                serviceId,
              ],
      })
    );
  }

  function updateWorkingDay(
    index,
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        workingHours:
          current.workingHours.map(
            (
              row,
              rowIndex
            ) =>
              rowIndex ===
              index
                ? {
                    ...row,
                    [field]:
                      value,
                  }
                : row
          ),
      })
    );
  }

  function addBreak(
    index
  ) {
    setForm(
      (current) => ({
        ...current,
        workingHours:
          current.workingHours.map(
            (
              row,
              rowIndex
            ) =>
              rowIndex ===
              index
                ? {
                    ...row,
                    breaks: [
                      ...row.breaks,
                      {
                        start:
                          "13:00",
                        end:
                          "13:30",
                      },
                    ],
                  }
                : row
          ),
      })
    );
  }

  function updateBreak(
    dayIndex,
    breakIndex,
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        workingHours:
          current.workingHours.map(
            (
              row,
              rowIndex
            ) =>
              rowIndex ===
              dayIndex
                ? {
                    ...row,
                    breaks:
                      row.breaks.map(
                        (
                          pause,
                          pauseIndex
                        ) =>
                          pauseIndex ===
                          breakIndex
                            ? {
                                ...pause,
                                [field]:
                                  value,
                              }
                            : pause
                      ),
                  }
                : row
          ),
      })
    );
  }

  function removeBreak(
    dayIndex,
    breakIndex
  ) {
    setForm(
      (current) => ({
        ...current,
        workingHours:
          current.workingHours.map(
            (
              row,
              rowIndex
            ) =>
              rowIndex ===
              dayIndex
                ? {
                    ...row,
                    breaks:
                      row.breaks.filter(
                        (
                          _,
                          pauseIndex
                        ) =>
                          pauseIndex !==
                          breakIndex
                      ),
                  }
                : row
          ),
      })
    );
  }

  function togglePermission(
    permission
  ) {
    setForm(
      (current) => ({
        ...current,
        permissions:
          current.permissions.includes(
            permission
          )
            ? current.permissions.filter(
                (item) =>
                  item !==
                  permission
              )
            : [
                ...current.permissions,
                permission,
              ],
      })
    );
  }

  async function submit(
    event
  ) {
    event.preventDefault();

    setError("");

    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.email.trim() ||
      !form.password
    ) {
      setError(
        "First name, last name, email and temporary password are required."
      );
      return;
    }

    if (
      form.password.length <
      8
    ) {
      setError(
        "Temporary password must contain at least 8 characters."
      );
      return;
    }

    setSubmitting(
      true
    );

    try {
      const payload = {
        firstName:
          form.firstName.trim(),
        lastName:
          form.lastName.trim(),
        name:
          `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email:
          form.email
            .trim()
            .toLowerCase(),
        phone:
          form.phone.trim(),
        role:
          form.role,
        password:
          form.password,
        profilePhoto:
          form.profilePhoto,
        jobTitle:
          form.jobTitle.trim(),
        biography:
          form.biography.trim(),
        specialties:
          splitList(
            form.specialties
          ),
        isActive:
          canCreateInactive
            ? form.isActive
            : true,
        profilePublished:
          form.profilePublished,
        acceptsAppointments:
          form.acceptsAppointments,
        ...(canManagePermissions
          ? {
              permissions:
                form.permissions,
            }
          : {}),
        ...(canAssignServices &&
        servicesLoaded &&
        form.configureServices
          ? {
              services:
                form.services,
            }
          : {}),
        ...(canConfigureSchedule &&
        form.configureSchedule
          ? {
              workingHours:
                form.workingHours,
            }
          : {}),
      };

      const response =
        await adminStaffService.create(
          payload
        );

      await onCreated?.(
        response
      );
    } catch (
      requestError
    ) {
      setError(
        errorMessage(
          requestError,
          "The employee could not be created."
        )
      );
      return;
    } finally {
      setSubmitting(
        false
      );
    }

    onClose?.();
  }

  const visibleRoles =
    assignableRolesForUser(
      roles,
      {
        isSuperAdmin:
          canManageRoles,
      }
    );

  const selectedRole =
    roles.find(
      (role) =>
        role.key ===
        form.role
    );

  const customRoleSelected =
    selectedRole?.system ===
    false;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-employee-title"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
            event.currentTarget &&
          !submitting
        ) {
          closeModal();
        }
      }}
    >
      <form
        ref={modalPanelRef}
        className="flex max-h-[calc(100dvh-1rem)] min-w-0 w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)]"
        onSubmit={
          submit
        }
      >
        <header className="shrink-0 flex items-start justify-between border-b border-stone-200 bg-white p-4 sm:p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Employee onboarding
            </p>
            <h2
              id="add-employee-title"
              className="mt-1 text-xl font-bold text-black"
            >
              Add employee
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Create the staff account and initialise the employee profile in one governed workflow.
            </p>
          </div>

          <button
            type="button"
            className="min-h-11 min-w-11 rounded-lg p-2 text-black hover:bg-stone-100 disabled:opacity-50"
            disabled={
              submitting
            }
            onClick={closeModal}
            aria-label="Close employee onboarding"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-5">
          {error ? (
            <div
              className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <section className="rounded-2xl border border-stone-200 p-5">
            <div className="mb-4">
              <h3 className="font-bold text-black">
                Account & identity
              </h3>
              <p className="mt-1 text-sm text-stone-600">
                Login identity and core employee status.
              </p>
            </div>

            <ProfilePhotoUploader
              value={
                form.profilePhoto
              }
              onChange={(
                value
              ) =>
                update(
                  "profilePhoto",
                  value
                )
              }
              name={`${form.firstName} ${form.lastName}`}
              label="Staff profile photograph"
              disabled={
                submitting
              }
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-black">
                First name
                <input
                  required
                  maxLength={60}
                  value={
                    form.firstName
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "firstName",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal text-black"
                />
              </label>

              <label className="text-sm font-semibold text-black">
                Last name
                <input
                  required
                  maxLength={60}
                  value={
                    form.lastName
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "lastName",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal text-black"
                />
              </label>

              <label className="text-sm font-semibold text-black">
                Email
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={
                    form.email
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "email",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal text-black"
                />
              </label>

              <label className="text-sm font-semibold text-black">
                Phone
                <input
                  type="tel"
                  maxLength={30}
                  value={
                    form.phone
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "phone",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal text-black"
                />
              </label>

              <label className="text-sm font-semibold text-black">
                Role
                <select
                  required
                  value={
                    form.role
                  }
                  onChange={(
                    event
                  ) =>
                    updateRole(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 font-normal text-black"
                >
                  {visibleRoles.map(
                    (role) => (
                      <option
                        key={
                          role.key
                        }
                        value={
                          role.key
                        }
                      >
                        {role.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="text-sm font-semibold text-black">
                Temporary password
                <div className="relative mt-2">
                  <KeyRound
                    size={17}
                    className="pointer-events-none absolute left-3 top-3 text-stone-500"
                  />
                  <input
                    required
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={
                      form.password
                    }
                    onChange={(
                      event
                    ) =>
                      update(
                        "password",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-stone-300 py-2.5 pl-10 pr-3 font-normal text-black"
                  />
                </div>
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="flex items-start gap-3 rounded-xl border border-stone-200 p-4 text-sm text-black">
                <input
                  type="checkbox"
                  checked={
                    form.isActive
                  }
                  disabled={
                    !canCreateInactive
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "isActive",
                      event.target
                        .checked
                    )
                  }
                  className="mt-1 h-5 w-5 accent-amber-500"
                />
                <span>
                  <strong className="block">
                    Active
                  </strong>
                  Account participates in salon operations.
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-stone-200 p-4 text-sm text-black">
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
                  className="mt-1 h-5 w-5 accent-amber-500"
                />
                <span>
                  <strong className="block">
                    Published
                  </strong>
                  Show the profile on public team surfaces.
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-stone-200 p-4 text-sm text-black">
                <input
                  type="checkbox"
                  checked={
                    form.acceptsAppointments
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "acceptsAppointments",
                      event.target
                        .checked
                    )
                  }
                  className="mt-1 h-5 w-5 accent-amber-500"
                />
                <span>
                  <strong className="block">
                    Bookable
                  </strong>
                  Allow this employee to be selected for appointments across website, reception, in-salon, WhatsApp and future booking channels.
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 p-5">
            <h3 className="font-bold text-black">
              Professional profile
            </h3>
            <p className="mt-1 text-sm text-stone-600">
              Information used by staff management and, when Published, public profile experiences.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-black">
                Job title
                <input
                  maxLength={120}
                  value={
                    form.jobTitle
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
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal text-black"
                />
              </label>

              <label className="text-sm font-semibold text-black">
                Specialities
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
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal text-black"
                />
                <small className="mt-1 block font-normal text-stone-500">
                  Separate items with commas.
                </small>
              </label>

              <label className="sm:col-span-2 text-sm font-semibold text-black">
                Biography
                <textarea
                  rows="5"
                  maxLength={2000}
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
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-normal text-black"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 p-5">
            <div className="flex items-start gap-3">
              <Scissors
                size={20}
              />
              <div className="flex-1">
                <h3 className="font-bold text-black">
                  Initial service qualifications
                </h3>
                <p className="mt-1 text-sm text-stone-600">
                  Only assigned services are eligible for employee booking.
                </p>
              </div>
            </div>

            {canAssignServices ? (
              <>
                <label className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-stone-200 p-2.5 text-sm font-semibold text-black hover:bg-amber-50">
                  <input
                    type="checkbox"
                    checked={
                      form.configureServices
                    }
                    disabled={
                      !servicesLoaded
                    }
                    onChange={(
                      event
                    ) =>
                      update(
                        "configureServices",
                        event.target
                          .checked
                      )
                    }
                    className="h-5 w-5 accent-amber-500"
                  />
                  Assign services during onboarding
                </label>

                {servicesError ? (
                  <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-black">
                    {servicesError}
                  </p>
                ) : null}

                {servicesLoaded &&
                form.configureServices ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map(
                      (service) => {
                        const id =
                          String(
                            service._id
                          );

                        return (
                          <label
                            key={
                              id
                            }
                            className="flex items-start gap-2 rounded-xl border border-stone-200 p-3 text-sm text-black"
                          >
                            <input
                              type="checkbox"
                              checked={
                                form.services.includes(
                                  id
                                )
                              }
                              onChange={() =>
                                toggleService(
                                  id
                                )
                              }
                              className="mt-1 h-5 w-5 accent-amber-500"
                            />
                            <span>
                              <strong className="block">
                                {service.name}
                              </strong>
                              <small className="text-stone-500">
                                {service.category ||
                                  "Salon service"}
                                {service.active ===
                                false
                                  ? " · Unpublished"
                                  : ""}
                              </small>
                            </span>
                          </label>
                        );
                      }
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                Your account can create employees but cannot assign services. An authorised manager can assign them later.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 p-5">
            <div className="flex items-start gap-3">
              <CalendarDays
                size={20}
              />
              <div className="flex-1">
                <h3 className="font-bold text-black">
                  Initial working schedule & breaks
                </h3>
                <p className="mt-1 text-sm text-stone-600">
                  Configure normal weekly hours now, or leave this section off and manage the schedule later.
                </p>
              </div>
            </div>

            {canConfigureSchedule ? (
              <>
                <label className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-stone-200 p-2.5 text-sm font-semibold text-black hover:bg-amber-50">
                  <input
                    type="checkbox"
                    checked={
                      form.configureSchedule
                    }
                    onChange={(
                      event
                    ) =>
                      update(
                        "configureSchedule",
                        event.target
                          .checked
                      )
                    }
                    className="h-5 w-5 accent-amber-500"
                  />
                  Configure schedule during onboarding
                </label>

                {form.configureSchedule ? (
                  <div className="mt-4 space-y-3">
                    {form.workingHours.map(
                      (
                        row,
                        dayIndex
                      ) => (
                        <article
                          key={
                            row.day
                          }
                          className="rounded-xl border border-stone-200 p-4"
                        >
                          <div className="grid gap-3 lg:grid-cols-[9rem_1fr]">
                            <label className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm font-bold text-black hover:bg-amber-50">
                              <input
                                type="checkbox"
                                checked={
                                  row.available
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateWorkingDay(
                                    dayIndex,
                                    "available",
                                    event
                                      .target
                                      .checked
                                  )
                                }
                                className="h-5 w-5 accent-amber-500"
                              />
                              {row.day}
                            </label>

                            {row.available ? (
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-3">
                                  <label className="text-xs font-semibold text-black">
                                    Start
                                    <input
                                      type="time"
                                      value={
                                        row.start
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updateWorkingDay(
                                          dayIndex,
                                          "start",
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      className="mt-1 block rounded-lg border border-stone-300 px-2 py-2 text-sm text-black"
                                    />
                                  </label>

                                  <label className="text-xs font-semibold text-black">
                                    End
                                    <input
                                      type="time"
                                      value={
                                        row.end
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updateWorkingDay(
                                          dayIndex,
                                          "end",
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      className="mt-1 block rounded-lg border border-stone-300 px-2 py-2 text-sm text-black"
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    className="mt-auto inline-flex items-center gap-1 rounded-lg border border-black bg-white px-3 py-2 text-xs font-bold text-black hover:bg-amber-50"
                                    onClick={() =>
                                      addBreak(
                                        dayIndex
                                      )
                                    }
                                  >
                                    <Plus
                                      size={14}
                                    />
                                    Add break
                                  </button>
                                </div>

                                {row.breaks.map(
                                  (
                                    pause,
                                    breakIndex
                                  ) => (
                                    <div
                                      key={`${row.day}-break-${breakIndex}`}
                                      className="flex flex-wrap items-end gap-2 rounded-lg bg-stone-50 p-3"
                                    >
                                      <label className="text-xs font-semibold text-black">
                                        Break from
                                        <input
                                          type="time"
                                          value={
                                            pause.start
                                          }
                                          onChange={(
                                            event
                                          ) =>
                                            updateBreak(
                                              dayIndex,
                                              breakIndex,
                                              "start",
                                              event
                                                .target
                                                .value
                                            )
                                          }
                                          className="mt-1 block rounded-lg border border-stone-300 px-2 py-2 text-sm text-black"
                                        />
                                      </label>

                                      <label className="text-xs font-semibold text-black">
                                        To
                                        <input
                                          type="time"
                                          value={
                                            pause.end
                                          }
                                          onChange={(
                                            event
                                          ) =>
                                            updateBreak(
                                              dayIndex,
                                              breakIndex,
                                              "end",
                                              event
                                                .target
                                                .value
                                            )
                                          }
                                          className="mt-1 block rounded-lg border border-stone-300 px-2 py-2 text-sm text-black"
                                        />
                                      </label>

                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-bold text-black hover:bg-stone-100"
                                        onClick={() =>
                                          removeBreak(
                                            dayIndex,
                                            breakIndex
                                          )
                                        }
                                      >
                                        <Trash2
                                          size={14}
                                        />
                                        Remove
                                      </button>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-stone-500">
                                Not normally working.
                              </p>
                            )}
                          </div>
                        </article>
                      )
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                Your account can create employees but cannot configure staff schedules. An authorised manager can configure hours and breaks later.
              </p>
            )}
          </section>

          {canManagePermissions ? (
            <details className="rounded-2xl border border-stone-200 p-5">
              <summary className="cursor-pointer font-bold text-black">
                Initial access permissions
              </summary>
              <p className="mt-2 text-sm text-stone-600">
                {customRoleSelected
                  ? "The selected custom role supplies its shared template automatically. The options below are additional employee-specific permissions that Super Admin or Admin can grant."
                  : "Optional employee-specific permissions. These are additional to the selected role's normal capabilities and can be granted by Super Admin or Admin."}
              </p>

              {customRoleSelected && selectedRole?.permissions?.length ? (
                <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                  <strong className="block text-black">
                    Included by role
                  </strong>
                  <span>
                    {selectedRole.permissions
                      .map(
                        (value) =>
                          EMPLOYEE_PERMISSIONS.find(
                            (permission) =>
                              permission.value === value
                          )?.label || value
                      )
                      .join(", ")}
                  </span>
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {permissionGroups.map(
                  ([
                    group,
                    permissions,
                  ]) => (
                    <fieldset
                      key={
                        group
                      }
                      className="rounded-xl border border-stone-200 p-4"
                    >
                      <legend className="px-1 text-sm font-bold text-black">
                        {group}
                      </legend>

                      <div className="mt-2 space-y-2">
                        {permissions.map(
                          (permission) => (
                            <label
                              key={
                                permission.value
                              }
                              className="flex min-h-11 items-start gap-3 rounded-lg border border-stone-200 p-2.5 text-sm text-black hover:bg-amber-50"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  form.permissions.includes(
                                    permission.value
                                  )
                                }
                                onChange={() =>
                                  togglePermission(
                                    permission.value
                                  )
                                }
                                className="mt-1 h-5 w-5 accent-amber-500"
                              />
                              <span>
                                {permission.label}
                                <small className="block font-mono text-[11px] text-stone-500">
                                  {permission.value}
                                </small>
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    </fieldset>
                  )
                )}
              </div>
            </details>
          ) : null}

          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-black">
            <ShieldCheck
              size={18}
              className="mb-2"
            />
            <strong>
              Location
            </strong>
            <p className="mt-1">
              New employees use the current rota location, <strong>Main salon</strong>. Location and shift changes are managed from Staff Rota.
            </p>
          </section>
        </div>

        <footer className="shrink-0 flex flex-col-reverse gap-2 border-t border-stone-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:justify-end sm:p-5">
          <button
            type="button"
            className="rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-stone-50"
            disabled={
              submitting
            }
            onClick={closeModal}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50"
            disabled={
              submitting
            }
          >
            <Save
              size={17}
            />
            {submitting
              ? "Creating…"
              : "Create employee"}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
}
