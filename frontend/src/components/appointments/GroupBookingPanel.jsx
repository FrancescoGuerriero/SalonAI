import {
  CalendarClock,
  CheckCircle2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import appointmentManagementApi from "../../Services/appointmentManagementApi.js";
import groupBookingService from "../../Services/groupBookingService.js";
import { AuthContext } from "../../context/AuthContext.jsx";
import { hasPermission } from "../../utils/permissions.js";

const STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];

function entityName(entity, fallback = "Unknown") {
  if (!entity || typeof entity !== "object") return fallback;
  return (
    entity.fullName ||
    entity.preferredName ||
    entity.name ||
    [entity.firstName, entity.lastName].filter(Boolean).join(" ") ||
    fallback
  );
}

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  date.setMinutes(date.getMinutes() - offset);
  return date.toISOString().slice(0, 16);
}

function toIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function statusLabel(value) {
  return String(value || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function errorText(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The group booking operation failed."
  );
}

let nextRow = 1;
function blankParticipant() {
  return {
    key: `group-participant-${nextRow++}`,
    customer: "",
    service: "",
    stylist: "",
    startsAt: "",
    label: "",
  };
}

function ParticipantFields({
  value,
  customers,
  services,
  stylists,
  onChange,
  onRemove,
  removable = true,
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-5">
      <label className="text-xs font-bold text-slate-700">
        Customer
        <select
          value={value.customer}
          onChange={(event) => onChange("customer", event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer._id} value={customer._id}>
              {entityName(customer)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-bold text-slate-700">
        Service
        <select
          value={value.service}
          onChange={(event) => onChange("service", event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
        >
          <option value="">Select service</option>
          {services.map((service) => (
            <option key={service._id} value={service._id}>
              {service.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-bold text-slate-700">
        Stylist
        <select
          value={value.stylist}
          onChange={(event) => onChange("stylist", event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
        >
          <option value="">Select stylist</option>
          {stylists.map((stylist) => (
            <option key={stylist._id} value={stylist._id}>
              {entityName(stylist)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-bold text-slate-700">
        Date and time
        <input
          type="datetime-local"
          value={value.startsAt}
          onChange={(event) => onChange("startsAt", event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
        />
      </label>

      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1 text-xs font-bold text-slate-700">
          Label
          <input
            value={value.label}
            onChange={(event) => onChange("label", event.target.value)}
            placeholder="e.g. Bride"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
          />
        </label>
        {removable ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-red-300 hover:text-red-700"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function GroupBookingPanel({
  services = [],
  stylists = [],
  onChanged,
}) {
  const { user } = useContext(AuthContext) || {};
  const canRead = hasPermission(user, "appointment:read");
  const canCreate = hasPermission(user, "appointment:create");
  const canUpdate = hasPermission(user, "appointment:update");
  const canCancel = hasPermission(user, "appointment:cancel");

  const [groups, setGroups] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [title, setTitle] = useState("");
  const [organiser, setOrganiser] = useState("");
  const [notes, setNotes] = useState("");
  const [participants, setParticipants] = useState([
    blankParticipant(),
    blankParticipant(),
  ]);
  const [editDrafts, setEditDrafts] = useState({});
  const [statusDrafts, setStatusDrafts] = useState({});
  const [groupStatusDrafts, setGroupStatusDrafts] = useState({});
  const [addGroupId, setAddGroupId] = useState("");
  const [addDraft, setAddDraft] = useState(blankParticipant());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeServices = useMemo(
    () =>
      services.filter(
        (item) => item.active !== false && item.bookable !== false
      ),
    [services]
  );
  const activeStylists = useMemo(
    () =>
      stylists.filter(
        (item) =>
          item.isActive !== false &&
          item.active !== false &&
          item.acceptsAppointments !== false
      ),
    [stylists]
  );

  const availableStatusOptions = useMemo(
    () =>
      STATUS_OPTIONS.filter((item) =>
        item === "cancelled" ? canCancel : canUpdate
      ),
    [canCancel, canUpdate]
  );

  const loadGroups = useCallback(async () => {
    if (!canRead) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await groupBookingService.list({ limit: 100 });
      setGroups(Array.isArray(result?.items) ? result.items : []);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  const searchCustomers = useCallback(async () => {
    if (!canCreate && !canUpdate) return;
    setError("");
    try {
      const result = await appointmentManagementApi.searchCustomers(
        customerSearch
      );
      setCustomers(
        Array.isArray(result?.customers) ? result.customers : []
      );
    } catch (requestError) {
      setError(errorText(requestError));
    }
  }, [canCreate, canUpdate, customerSearch]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (canCreate || canUpdate) {
      void searchCustomers();
    }
  }, [canCreate, canUpdate]);

  function updateParticipant(key, field, value) {
    setParticipants((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row
      )
    );
  }

  async function createGroup() {
    if (!organiser || participants.length < 2) {
      setError("Select an organiser and at least two participants.");
      return;
    }

    if (
      participants.some(
        (row) => !row.customer || !row.service || !row.stylist || !row.startsAt
      )
    ) {
      setError("Every participant needs a customer, service, stylist, date and time.");
      return;
    }

    setBusy("create");
    setError("");
    setSuccess("");
    try {
      await groupBookingService.create({
        organiser,
        title: title.trim() || "Group booking",
        notes,
        participants: participants.map((row) => ({
          customer: row.customer,
          service: row.service,
          stylist: row.stylist,
          startsAt: toIso(row.startsAt),
          label: row.label,
        })),
      });
      setSuccess("Group booking created. Every participant is now a canonical appointment.");
      setTitle("");
      setNotes("");
      setOrganiser("");
      setParticipants([blankParticipant(), blankParticipant()]);
      await loadGroups();
      await onChanged?.();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy("");
    }
  }

  function participantDraft(participant) {
    const appointment = participant.appointment || {};
    return (
      editDrafts[participant._id] || {
        startsAt: localDateTime(
          appointment.startsAt || appointment.appointmentDate
        ),
        service: String(appointment.service?._id || appointment.service || ""),
        stylist: String(appointment.stylist?._id || appointment.stylist || ""),
      }
    );
  }

  function updateEditDraft(participant, field, value) {
    const base = participantDraft(participant);
    setEditDrafts((current) => ({
      ...current,
      [participant._id]: {
        ...base,
        [field]: value,
      },
    }));
  }

  async function reschedule(group, participant) {
    const draft = participantDraft(participant);
    if (!draft.startsAt || !draft.service || !draft.stylist) {
      setError("A participant reschedule needs a date/time, service and stylist.");
      return;
    }

    setBusy(`reschedule-${participant._id}`);
    setError("");
    setSuccess("");
    try {
      await groupBookingService.rescheduleParticipant(
        group._id,
        participant._id,
        {
          startsAt: toIso(draft.startsAt),
          service: draft.service,
          stylist: draft.stylist,
          reason: "Group booking participant reschedule",
        }
      );
      setSuccess("Participant appointment rescheduled through the canonical booking engine.");
      await loadGroups();
      await onChanged?.();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy("");
    }
  }

  async function updateStatus(group, participant) {
    const appointment = participant.appointment || {};
    const status =
      statusDrafts[participant._id] ||
      (canUpdate ? appointment.status || "pending" : "cancelled");
    let reason = "Group booking participant status update";

    if (["cancelled", "no_show"].includes(status)) {
      reason = window.prompt("Enter the reason for this status change:") || "";
      if (!reason.trim()) return;
    }

    setBusy(`status-${participant._id}`);
    setError("");
    setSuccess("");
    try {
      await groupBookingService.updateParticipantStatus(
        group._id,
        participant._id,
        {
          status,
          reason,
          requireReason: ["cancelled", "no_show"].includes(status),
        }
      );
      setSuccess("Participant status updated.");
      await loadGroups();
      await onChanged?.();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy("");
    }
  }

  async function updateWholeGroup(group) {
    const status =
      groupStatusDrafts[group._id] || (canUpdate ? "confirmed" : "cancelled");
    let reason = "Group booking status update";

    if (["cancelled", "no_show"].includes(status)) {
      reason = window.prompt("Enter the reason for this group status change:") || "";
      if (!reason.trim()) return;
    }

    setBusy(`group-status-${group._id}`);
    setError("");
    setSuccess("");
    try {
      const result = await groupBookingService.updateGroupStatus(group._id, {
        status,
        reason,
        requireReason: ["cancelled", "no_show"].includes(status),
      });
      setSuccess(
        result?.partialSuccess
          ? `${result.updated} participant(s) updated; ${result.failed} failed and were left unchanged.`
          : "Group participant statuses updated."
      );
      await loadGroups();
      await onChanged?.();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy("");
    }
  }

  async function addParticipant(group) {
    if (!addDraft.customer || !addDraft.service || !addDraft.stylist || !addDraft.startsAt) {
      setError("The new participant needs a customer, service, stylist, date and time.");
      return;
    }

    setBusy(`add-${group._id}`);
    setError("");
    setSuccess("");
    try {
      await groupBookingService.addParticipant(group._id, {
        customer: addDraft.customer,
        service: addDraft.service,
        stylist: addDraft.stylist,
        startsAt: toIso(addDraft.startsAt),
        label: addDraft.label,
      });
      setSuccess("Participant added to the group as a canonical appointment.");
      setAddGroupId("");
      setAddDraft(blankParticipant());
      await loadGroups();
      await onChanged?.();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy("");
    }
  }

  if (!canRead) return null;

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Stage 2 · Group bookings
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Organiser and participant bookings
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Each participant remains an ordinary appointment, so staff availability,
            conflict checks, service eligibility and lifecycle status stay authoritative.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadGroups()}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh groups
        </button>
      </header>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}

      {(canCreate || canUpdate) ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 text-xs font-bold text-slate-700">
              Find customers
              <span className="relative mt-1 block">
                <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                <input
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void searchCustomers();
                    }
                  }}
                  placeholder="Name, email or phone"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-normal"
                />
              </span>
            </label>
            <button
              type="button"
              onClick={() => void searchCustomers()}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700"
            >
              Search
            </button>
          </div>
        </div>
      ) : null}

      {canCreate ? (
        <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-bold text-slate-700">
              Group title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Wedding party, family booking…"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="text-xs font-bold text-slate-700">
              Organiser
              <select
                value={organiser}
                onChange={(event) => setOrganiser(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="">Select organiser</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {entityName(customer)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">
              Notes
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
          </div>

          <div className="space-y-3">
            {participants.map((row) => (
              <ParticipantFields
                key={row.key}
                value={row}
                customers={customers}
                services={activeServices}
                stylists={activeStylists}
                onChange={(field, value) => updateParticipant(row.key, field, value)}
                onRemove={() =>
                  setParticipants((current) =>
                    current.length <= 2
                      ? current
                      : current.filter((item) => item.key !== row.key)
                  )
                }
                removable={participants.length > 2}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={participants.length >= 25}
              onClick={() =>
                setParticipants((current) => [...current, blankParticipant()])
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              <Plus size={16} />
              Add participant
            </button>
            <button
              type="button"
              disabled={busy === "create"}
              onClick={() => void createGroup()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              <UsersRound size={16} />
              {busy === "create" ? "Creating…" : "Create group booking"}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm font-bold text-slate-600">
          <LoaderCircle size={18} className="animate-spin" />
          Loading group bookings…
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No group bookings have been created yet.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <article key={group._id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{group.title || "Group booking"}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Organiser: {entityName(group.organiser)} · {group.participants?.length || 0} participants
                  </p>
                </div>
                {canUpdate || canCancel ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={groupStatusDrafts[group._id] || "confirmed"}
                      onChange={(event) =>
                        setGroupStatusDrafts((current) => ({
                          ...current,
                          [group._id]: event.target.value,
                        }))
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      {availableStatusOptions.map((item) => (
                        <option key={item} value={item}>{statusLabel(item)}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy === `group-status-${group._id}`}
                      onClick={() => void updateWholeGroup(group)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
                    >
                      Apply to group
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {(group.participants || []).map((participant) => {
                  const appointment = participant.appointment || {};
                  const draft = participantDraft(participant);
                  const statusValue =
                    statusDrafts[participant._id] ||
                    (canUpdate ? appointment.status || "pending" : "cancelled");

                  return (
                    <div
                      key={participant._id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1.1fr_auto]">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {participant.label ? `${participant.label} · ` : ""}
                            {entityName(participant.customer || appointment.customer)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {entityName(appointment.service, "Service")} · {entityName(appointment.stylist, "Stylist")}
                          </p>
                        </div>

                        <label className="text-xs font-bold text-slate-700">
                          Date/time
                          <input
                            type="datetime-local"
                            disabled={!canUpdate}
                            value={draft.startsAt}
                            onChange={(event) =>
                              updateEditDraft(participant, "startsAt", event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-normal disabled:bg-slate-100"
                          />
                        </label>

                        <label className="text-xs font-bold text-slate-700">
                          Service
                          <select
                            disabled={!canUpdate}
                            value={draft.service}
                            onChange={(event) =>
                              updateEditDraft(participant, "service", event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-normal disabled:bg-slate-100"
                          >
                            {activeServices.map((service) => (
                              <option key={service._id} value={service._id}>{service.name}</option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-bold text-slate-700">
                          Stylist
                          <select
                            disabled={!canUpdate}
                            value={draft.stylist}
                            onChange={(event) =>
                              updateEditDraft(participant, "stylist", event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-normal disabled:bg-slate-100"
                          >
                            {activeStylists.map((stylist) => (
                              <option key={stylist._id} value={stylist._id}>{entityName(stylist)}</option>
                            ))}
                          </select>
                        </label>

                        {canUpdate ? (
                          <button
                            type="button"
                            disabled={busy === `reschedule-${participant._id}`}
                            onClick={() => void reschedule(group, participant)}
                            className="self-end rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                          >
                            <CalendarClock size={14} className="mr-1 inline" />
                            Reschedule
                          </button>
                        ) : null}
                      </div>

                      {(canUpdate || canCancel) ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                          <span className="text-xs font-bold text-slate-600">Participant status</span>
                          <select
                            value={statusValue}
                            onChange={(event) =>
                              setStatusDrafts((current) => ({
                                ...current,
                                [participant._id]: event.target.value,
                              }))
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                          >
                            {availableStatusOptions.map((item) => (
                              <option key={item} value={item}>{statusLabel(item)}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={busy === `status-${participant._id}`}
                            onClick={() => void updateStatus(group, participant)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} />
                            Update status
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {canCreate ? (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  {addGroupId === group._id ? (
                    <div className="space-y-3">
                      <ParticipantFields
                        value={addDraft}
                        customers={customers}
                        services={activeServices}
                        stylists={activeStylists}
                        onChange={(field, value) =>
                          setAddDraft((current) => ({ ...current, [field]: value }))
                        }
                        onRemove={() => {
                          setAddGroupId("");
                          setAddDraft(blankParticipant());
                        }}
                      />
                      <button
                        type="button"
                        disabled={busy === `add-${group._id}`}
                        onClick={() => void addParticipant(group)}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        Add to existing group
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddGroupId(group._id);
                        setAddDraft(blankParticipant());
                      }}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700"
                    >
                      <Plus size={15} />
                      Add participant
                    </button>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
