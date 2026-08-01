import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarOff,
  Check,
  Clock3,
  RefreshCw,
  Save,
  UsersRound,
  X,
} from "lucide-react";

import stylistService from "../services/stylistService.js";
import { staffApi } from "../services/futureFeaturesApi.js";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

function staffName(staff = {}) {
  return (
    staff.fullName ||
    staff.name ||
    [staff.firstName, staff.lastName].filter(Boolean).join(" ") ||
    "Unnamed stylist"
  );
}

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "The staff-management operation failed."
  );
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusClass(status) {
  switch (String(status || "").toLowerCase()) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "declined":
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function initialDayRows(stylist, availability = []) {
  return Object.fromEntries(
    DAYS.map((day) => {
      const configured = availability.find(
        (entry) => Number(entry.dayOfWeek) === day.value
      );
      const workingHours = stylist?.workingHours?.find(
        (entry) => entry.day === day.label
      );
      const firstRange = configured?.ranges?.[0];
      const active = configured
        ? configured.active !== false && configured.ranges?.length > 0
        : workingHours?.available !== false && Boolean(workingHours);

      return [
        day.value,
        {
          active,
          start: firstRange?.start || workingHours?.start || "09:00",
          end: firstRange?.end || workingHours?.end || "17:00",
          source: configured ? "Configured" : "Stylist profile",
        },
      ];
    })
  );
}

export default function StaffManagementPage() {
  const [stylists, setStylists] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [dayRows, setDayRows] = useState({});
  const [timeOff, setTimeOff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingDay, setSavingDay] = useState(null);
  const [updatingRequest, setUpdatingRequest] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [timeOffForm, setTimeOffForm] = useState({
    startsAt: "",
    endsAt: "",
    reason: "",
  });

  const selectedStylist = useMemo(
    () => stylists.find((stylist) => String(stylist._id) === selectedStaffId),
    [stylists, selectedStaffId]
  );

  const loadStylists = useCallback(async () => {
    const response = await stylistService.getStylists({
      limit: 100,
      sort: "firstName",
    });
    const items = Array.isArray(response)
      ? response
      : response?.stylists || response?.items || [];

    setStylists(items);
    setSelectedStaffId((current) => current || String(items[0]?._id || ""));
  }, []);

  const loadStaffDetails = useCallback(async () => {
    if (!selectedStaffId) {
      setDayRows({});
      setTimeOff([]);
      return;
    }

    const [availabilityResponse, timeOffResponse] = await Promise.all([
      staffApi.week(selectedStaffId),
      staffApi.listTimeOff({ staff: selectedStaffId }),
    ]);

    const availability = availabilityResponse?.items || [];
    setDayRows(initialDayRows(selectedStylist, availability));
    setTimeOff(timeOffResponse?.items || []);
  }, [selectedStaffId, selectedStylist]);

  const loadPage = useCallback(async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await loadStylists();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [loadStylists]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!selectedStaffId) return;

    setRefreshing(true);
    setError("");

    loadStaffDetails()
      .catch((requestError) => setError(errorMessage(requestError)))
      .finally(() => setRefreshing(false));
  }, [selectedStaffId, loadStaffDetails]);

  function updateDay(dayOfWeek, field, value) {
    setDayRows((current) => ({
      ...current,
      [dayOfWeek]: {
        ...(current[dayOfWeek] || {}),
        [field]: value,
      },
    }));
  }

  async function saveAvailability(dayOfWeek) {
    const row = dayRows[dayOfWeek];
    if (!row || !selectedStaffId) return;

    setSavingDay(dayOfWeek);
    setError("");
    setSuccess("");

    try {
      await staffApi.setAvailability(selectedStaffId, {
        dayOfWeek,
        active: Boolean(row.active),
        ranges: row.active
          ? [{ start: row.start, end: row.end }]
          : [],
      });
      setSuccess(`${DAYS.find((day) => day.value === dayOfWeek)?.label} availability saved.`);
      await loadStaffDetails();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSavingDay(null);
    }
  }

  async function submitTimeOff(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedStaffId || !timeOffForm.startsAt || !timeOffForm.endsAt) {
      setError("Select a stylist and provide both time-off dates.");
      return;
    }

    try {
      await staffApi.requestTimeOff(selectedStaffId, {
        startsAt: new Date(timeOffForm.startsAt).toISOString(),
        endsAt: new Date(timeOffForm.endsAt).toISOString(),
        reason: timeOffForm.reason,
      });
      setTimeOffForm({ startsAt: "", endsAt: "", reason: "" });
      setSuccess("Time-off request created.");
      await loadStaffDetails();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function changeTimeOffStatus(id, status) {
    setUpdatingRequest(id);
    setError("");
    setSuccess("");

    try {
      await staffApi.updateTimeOff(id, status);
      setSuccess(`Time-off request marked ${status}.`);
      await loadStaffDetails();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setUpdatingRequest("");
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm font-semibold text-slate-600">
        Loading staff management…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-600">
            <UsersRound size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Phase 3</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Staff management</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure stylist working hours and manage time-off requests.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            loadStaffDetails()
              .catch((requestError) => setError(errorMessage(requestError)))
              .finally(() => setRefreshing(false));
          }}
          disabled={!selectedStaffId || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700" htmlFor="staff-selector">
          Stylist
        </label>
        <select
          id="staff-selector"
          value={selectedStaffId}
          onChange={(event) => setSelectedStaffId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-50 sm:max-w-md"
        >
          {stylists.map((stylist) => (
            <option key={stylist._id} value={stylist._id}>
              {staffName(stylist)}{stylist.isActive === false ? " — inactive" : ""}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Clock3 size={19} className="text-indigo-600" />
            Weekly availability
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {DAYS.map((day) => {
            const row = dayRows[day.value] || {
              active: false,
              start: "09:00",
              end: "17:00",
              source: "Stylist profile",
            };

            return (
              <div key={day.value} className="grid gap-4 p-5 lg:grid-cols-[10rem_8rem_1fr_auto] lg:items-center">
                <div>
                  <p className="font-semibold text-slate-900">{day.label}</p>
                  <p className="text-xs text-slate-500">{row.source}</p>
                </div>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(row.active)}
                    onChange={(event) => updateDay(day.value, "active", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  Working
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    value={row.start}
                    disabled={!row.active}
                    onChange={(event) => updateDay(day.value, "start", event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                  <span className="text-sm text-slate-400">to</span>
                  <input
                    type="time"
                    value={row.end}
                    disabled={!row.active}
                    onChange={(event) => updateDay(day.value, "end", event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => saveAvailability(day.value)}
                  disabled={savingDay === day.value}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Save size={16} />
                  {savingDay === day.value ? "Saving…" : "Save"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <form onSubmit={submitTimeOff} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <CalendarOff size={19} className="text-indigo-600" />
            Add time off
          </h2>

          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Starts
              <input
                type="datetime-local"
                value={timeOffForm.startsAt}
                onChange={(event) => setTimeOffForm((current) => ({ ...current, startsAt: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Ends
              <input
                type="datetime-local"
                value={timeOffForm.endsAt}
                onChange={(event) => setTimeOffForm((current) => ({ ...current, endsAt: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Reason
              <textarea
                value={timeOffForm.reason}
                onChange={(event) => setTimeOffForm((current) => ({ ...current, reason: event.target.value }))}
                rows={3}
                maxLength={500}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                placeholder="Holiday, training, appointment…"
              />
            </label>

            <button
              type="submit"
              disabled={!selectedStaffId}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <CalendarOff size={17} />
              Create request
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">Time-off requests</h2>
          </div>

          {timeOff.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No time-off requests for this stylist.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {timeOff.map((request) => (
                <article key={request._id} className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {formatDateTime(request.startsAt)} — {formatDateTime(request.endsAt)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {request.reason || "No reason supplied"}
                      </p>
                    </div>
                    <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(request.status)}`}>
                      {request.status}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => changeTimeOffStatus(request._id, "approved")}
                      disabled={updatingRequest === request._id || request.status === "approved"}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => changeTimeOffStatus(request._id, "declined")}
                      disabled={updatingRequest === request._id || request.status === "declined"}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                    >
                      <X size={14} /> Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => changeTimeOffStatus(request._id, "cancelled")}
                      disabled={updatingRequest === request._id || request.status === "cancelled"}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
