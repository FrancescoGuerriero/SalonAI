import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Timer,
  Trash2,
  UserX,
  UsersRound,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import useAuth from "../hooks/useAuth.js";
import staffRotaApi from "../Services/staffRotaApi.js";

const DAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "2-digit",
  month: "short",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

function localDateKey(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function mondayOf(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);

  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));

  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + Number(days));
  return date;
}

function combineDateAndTime(dateValue, timeValue) {
  const [year, month, day] = String(dateValue).split("-").map(Number);
  const [hours, minutes] = String(timeValue).split(":").map(Number);

  return new Date(
    year,
    month - 1,
    day,
    hours,
    minutes,
    0,
    0
  ).toISOString();
}

function staffName(staff = {}) {
  return (
    staff.fullName ||
    staff.name ||
    [staff.firstName, staff.lastName].filter(Boolean).join(" ") ||
    "Staff member"
  );
}

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "The staff rota operation failed."
  );
}

function formatMinutes(value) {
  const minutes = Math.max(Number(value || 0), 0);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function statusClasses(status) {
  const classes = {
    draft: "border-slate-200 bg-slate-100 text-slate-700",
    published: "border-blue-200 bg-blue-50 text-blue-700",
    completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cancelled: "border-red-200 bg-red-50 text-red-700",
    present: "border-emerald-200 bg-emerald-50 text-emerald-700",
    late: "border-amber-200 bg-amber-50 text-amber-700",
    absent: "border-red-200 bg-red-50 text-red-700",
    scheduled: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return classes[status] || classes.scheduled;
}

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function emptyShiftForm(date, staffId = "") {
  return {
    id: "",
    staffId,
    date,
    start: "09:00",
    end: "17:00",
    breakMinutes: 30,
    roleTitle: "Stylist",
    location: "Main salon",
    status: "draft",
    notes: "",
  };
}

function MetricCard({ icon: Icon, label, value, detail, warning = false }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p
            className={`mt-2 text-2xl font-bold ${
              warning ? "text-amber-700" : "text-slate-900"
            }`}
          >
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            warning
              ? "bg-amber-50 text-amber-600"
              : "bg-indigo-50 text-indigo-600"
          }`}
        >
          <Icon size={19} />
        </span>
      </div>
    </article>
  );
}

export default function StaffRotaPage() {
  const { user } = useAuth();
  const canManage = ["admin", "manager"].includes(user?.role);

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [rota, setRota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingShiftId, setWorkingShiftId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() =>
    emptyShiftForm(localDateKey(mondayOf(new Date())))
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRota = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await staffRotaApi.getWeek({
        startDate: localDateKey(weekStart),
      });

      setRota(result);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    void loadRota();
  }, [loadRota]);

  const staffDirectory = useMemo(() => {
    const rows = Array.isArray(rota?.staff) ? rota.staff : [];

    return rows.map((row) => ({
      id: String(row.staffId || ""),
      name: row.name || "Staff member",
      ...row,
    }));
  }, [rota]);

  const visibleShifts = useMemo(() => {
    const shifts = Array.isArray(rota?.shifts) ? rota.shifts : [];

    if (!selectedStaffId) {
      return shifts;
    }

    return shifts.filter(
      (shift) =>
        String(shift.staff?._id || shift.staff) === selectedStaffId
    );
  }, [rota, selectedStaffId]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        const key = localDateKey(date);

        return {
          key,
          date,
          shifts: visibleShifts.filter(
            (shift) => localDateKey(shift.startsAt) === key
          ),
          coverage: rota?.days?.find((day) => day.date === key) || null,
        };
      }),
    [rota, visibleShifts, weekStart]
  );

  function openCreate(date = localDateKey(weekStart)) {
    setForm(emptyShiftForm(date, selectedStaffId || staffDirectory[0]?.id || ""));
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function openEdit(shift) {
    setForm({
      id: String(shift._id),
      staffId: String(shift.staff?._id || shift.staff || ""),
      date: localDateKey(shift.startsAt),
      start: TIME_FORMATTER.format(new Date(shift.startsAt)),
      end: TIME_FORMATTER.format(new Date(shift.endsAt)),
      breakMinutes: Number(shift.breakMinutes || 0),
      roleTitle: shift.roleTitle || "Stylist",
      location: shift.location || "Main salon",
      status: shift.status || "draft",
      notes: shift.notes || "",
    });

    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveShift(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        staffId: form.staffId,
        startsAt: combineDateAndTime(form.date, form.start),
        endsAt: combineDateAndTime(form.date, form.end),
        breakMinutes: Number(form.breakMinutes || 0),
        roleTitle: form.roleTitle,
        location: form.location,
        status: form.status,
        notes: form.notes,
      };

      if (form.id) {
        await staffRotaApi.updateShift(form.id, payload);
        setSuccess("Shift updated successfully.");
      } else {
        await staffRotaApi.createShift(payload);
        setSuccess("Shift created successfully.");
      }

      setShowForm(false);
      await loadRota();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function removeShift(shift) {
    if (!window.confirm("Delete this draft shift?")) {
      return;
    }

    setWorkingShiftId(String(shift._id));
    setError("");
    setSuccess("");

    try {
      await staffRotaApi.deleteShift(shift._id);
      setSuccess("Shift deleted.");
      await loadRota();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorkingShiftId("");
    }
  }

  async function publishWeek() {
    if (!window.confirm("Publish every draft shift in this week?")) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await staffRotaApi.publishWeek(localDateKey(weekStart));
      setSuccess(`${result.published || 0} shift(s) published.`);
      await loadRota();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function attendanceAction(shift, action) {
    setWorkingShiftId(String(shift._id));
    setError("");
    setSuccess("");

    try {
      if (action === "clock-in") {
        await staffRotaApi.clockIn(shift._id);
        setSuccess(`${staffName(shift.staff)} clocked in.`);
      }

      if (action === "clock-out") {
        await staffRotaApi.clockOut(shift._id);
        setSuccess(`${staffName(shift.staff)} clocked out.`);
      }

      if (action === "absent") {
        await staffRotaApi.updateAttendance(shift._id, {
          status: "absent",
          notes: "Marked absent by management.",
        });
        setSuccess(`${staffName(shift.staff)} marked absent.`);
      }

      await loadRota();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorkingShiftId("");
    }
  }

  const summary = rota?.summary || {};
  const alerts = Array.isArray(rota?.alerts) ? rota.alerts : [];

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Phase 3 workforce operations
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Staff rota and attendance
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Schedule shifts, publish the week, record attendance and resolve
              overtime or coverage risks.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWeekStart((current) => addDays(current, -7))}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              type="button"
              onClick={() => setWeekStart(mondayOf(new Date()))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Current week
            </button>

            <button
              type="button"
              onClick={() => setWeekStart((current) => addDays(current, 7))}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Next
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              onClick={loadRota}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus size={16} />
                  Add shift
                </button>

                <button
                  type="button"
                  onClick={publishWeek}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Send size={16} />
                  Publish week
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-slate-800">
            {DATE_FORMATTER.format(weekStart)} – {DATE_FORMATTER.format(addDays(weekStart, 6))}
          </p>

          <label className="text-sm font-semibold text-slate-700">
            Staff filter
            <select
              value={selectedStaffId}
              onChange={(event) => setSelectedStaffId(event.target.value)}
              className="ml-3 rounded-lg border border-slate-300 px-3 py-2 font-normal"
            >
              <option value="">All staff</option>
              {staffDirectory.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={UsersRound}
          label="Staff"
          value={summary.staff || 0}
          detail={`${summary.shifts || 0} shifts this week`}
        />
        <MetricCard
          icon={CalendarClock}
          label="Scheduled"
          value={formatMinutes(summary.scheduledMinutes)}
          detail="Net hours after breaks"
        />
        <MetricCard
          icon={Clock3}
          label="Worked"
          value={formatMinutes(summary.workedMinutes)}
          detail="Recorded attendance"
        />
        <MetricCard
          icon={Timer}
          label="Overtime"
          value={formatMinutes(summary.overtimeMinutes)}
          detail="Above weekly threshold"
          warning={Number(summary.overtimeMinutes) > 0}
        />
        <MetricCard
          icon={UserX}
          label="Absence"
          value={summary.absences || 0}
          detail={`${summary.lateArrivals || 0} late arrival(s)`}
          warning={Number(summary.absences) > 0}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Alerts"
          value={summary.alerts || 0}
          detail="Coverage and rota risks"
          warning={Number(summary.alerts) > 0}
        />
      </section>

      {showForm ? (
        <section className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {form.id ? "Edit shift" : "Create shift"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Conflicting shifts and approved time off are blocked automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={saveShift} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-semibold text-slate-700">
              Staff member
              <select
                required
                value={form.staffId}
                onChange={(event) => updateForm("staffId", event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
              >
                <option value="">Select staff</option>
                {staffDirectory.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Date
              <input
                required
                type="date"
                value={form.date}
                onChange={(event) => updateForm("date", event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Start
              <input
                required
                type="time"
                value={form.start}
                onChange={(event) => updateForm("start", event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              End
              <input
                required
                type="time"
                value={form.end}
                onChange={(event) => updateForm("end", event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Break minutes
              <input
                type="number"
                min="0"
                step="5"
                value={form.breakMinutes}
                onChange={(event) => updateForm("breakMinutes", event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Role
              <input
                value={form.roleTitle}
                onChange={(event) => updateForm("roleTitle", event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Location
              <input
                value={form.location}
                onChange={(event) => updateForm("location", event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Status
              <select
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-4">
              Notes
              <textarea
                rows="3"
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
              />
            </label>

            <div className="flex gap-2 md:col-span-2 xl:col-span-4">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save shift"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {loading && !rota ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500">
              Loading staff rota…
            </div>
          ) : (
            days.map((day) => (
              <article key={day.key} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <h2 className="font-bold text-slate-900">
                      {DAY_FORMATTER.format(day.date)}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {day.coverage?.scheduledStaff || 0} staff · {day.coverage?.appointments || 0} appointments · {formatMinutes(day.coverage?.scheduledMinutes)} scheduled
                    </p>
                  </div>

                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => openCreate(day.key)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus size={14} />
                      Add shift
                    </button>
                  ) : null}
                </header>

                <div className="space-y-3 p-4">
                  {day.shifts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      No shifts scheduled.
                    </div>
                  ) : (
                    day.shifts.map((shift) => {
                      const attendance = shift.attendance || {};
                      const busy = workingShiftId === String(shift._id);

                      return (
                        <div
                          key={shift._id}
                          className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-slate-900">
                                {staffName(shift.staff)}
                              </p>
                              <span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClasses(shift.status)}`}>
                                {titleCase(shift.status)}
                              </span>
                              <span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClasses(attendance.status)}`}>
                                {titleCase(attendance.status || "scheduled")}
                              </span>
                            </div>

                            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                              <span>
                                {TIME_FORMATTER.format(new Date(shift.startsAt))} – {TIME_FORMATTER.format(new Date(shift.endsAt))}
                              </span>
                              <span>{formatMinutes(shift.scheduledMinutes)}</span>
                              <span>{shift.breakMinutes || 0}m break</span>
                              <span>{shift.location}</span>
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {shift.roleTitle}
                              {attendance.clockInAt
                                ? ` · In ${TIME_FORMATTER.format(new Date(attendance.clockInAt))}`
                                : ""}
                              {attendance.clockOutAt
                                ? ` · Out ${TIME_FORMATTER.format(new Date(attendance.clockOutAt))}`
                                : ""}
                              {attendance.workedMinutes
                                ? ` · ${formatMinutes(attendance.workedMinutes)} worked`
                                : ""}
                            </p>

                            {shift.notes ? (
                              <p className="mt-2 text-sm text-slate-500">{shift.notes}</p>
                            ) : null}
                          </div>

                          {canManage ? (
                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                              {!attendance.clockInAt && attendance.status !== "absent" ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => attendanceAction(shift, "clock-in")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  <LogIn size={14} />
                                  Clock in
                                </button>
                              ) : null}

                              {attendance.clockInAt && !attendance.clockOutAt ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => attendanceAction(shift, "clock-out")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                                >
                                  <LogOut size={14} />
                                  Clock out
                                </button>
                              ) : null}

                              {!attendance.clockInAt && attendance.status !== "absent" ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => attendanceAction(shift, "absent")}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  <UserX size={14} />
                                  Absent
                                </button>
                              ) : null}

                              {!attendance.clockInAt ? (
                                <button
                                  type="button"
                                  onClick={() => openEdit(shift)}
                                  className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                                  title="Edit shift"
                                >
                                  <Pencil size={15} />
                                </button>
                              ) : null}

                              {["draft", "cancelled"].includes(shift.status) && !attendance.clockInAt ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => removeShift(shift)}
                                  className="rounded-lg border border-red-300 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  title="Delete shift"
                                >
                                  <Trash2 size={15} />
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            ))
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Coverage alerts</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Overtime, time off and appointment coverage conflicts.
                </p>
              </div>
              <AlertTriangle size={20} className="text-amber-500" />
            </div>

            <div className="mt-4 space-y-3">
              {alerts.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center text-sm font-semibold text-emerald-700">
                  No rota conflicts detected.
                </div>
              ) : (
                alerts.map((alert, index) => (
                  <article
                    key={`${alert.type}-${alert.shiftId || alert.staffId || alert.date || index}`}
                    className={`rounded-xl border p-4 ${
                      alert.severity === "critical"
                        ? "border-red-200 bg-red-50"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <p
                      className={`text-sm font-bold ${
                        alert.severity === "critical"
                          ? "text-red-800"
                          : "text-amber-900"
                      }`}
                    >
                      {alert.title}
                    </p>
                    <p
                      className={`mt-1 text-xs leading-5 ${
                        alert.severity === "critical"
                          ? "text-red-700"
                          : "text-amber-800"
                      }`}
                    >
                      {alert.description}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Weekly staff totals</h2>
            <div className="mt-4 space-y-3">
              {staffDirectory.map((staff) => (
                <article key={staff.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-slate-900">{staff.name}</p>
                    {staff.overtimeMinutes > 0 ? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                        Overtime
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <span>Scheduled: {formatMinutes(staff.scheduledMinutes)}</span>
                    <span>Worked: {formatMinutes(staff.workedMinutes)}</span>
                    <span>Shifts: {staff.shifts || 0}</span>
                    <span>Absent: {staff.absent || 0}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
