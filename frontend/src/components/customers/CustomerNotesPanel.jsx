import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Loader2,
  LockKeyhole,
  MessageSquarePlus,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addCustomerTags,
  completeCustomerNoteFollowUp,
  createCustomerNote,
  deleteCustomerNote,
  formatCustomerNoteType,
  formatCustomerNoteVisibility,
  getCustomerNoteAuthorName,
  getCustomerNoteStatistics,
  getCustomerNoteStatus,
  listCustomerNotes,
  removeCustomerTags,
  reopenCustomerNoteFollowUp,
  restoreCustomerNote,
  setCustomerNotePinned,
  updateCustomerNote,
} from "../../Services/customerNoteService.js";

const NOTE_TYPES = [
  "general",
  "consultation",
  "service",
  "colour_formula",
  "allergy",
  "preference",
  "complaint",
  "follow_up",
  "safeguarding",
  "payment",
  "other",
];

const NOTE_VISIBILITIES = [
  "staff",
  "management",
  "private",
];

const EMPTY_NOTE_FORM = {
  title: "",
  content: "",
  type: "general",
  visibility: "staff",
  tags: "",
  pinned: false,
  requiresFollowUp: false,
  followUpAt: "",
};

function normaliseText(value) {
  return String(value ?? "").trim();
}

function parseTags(value) {
  return Array.from(
    new Set(
      normaliseText(value)
        .split(",")
        .map((tag) =>
          tag.trim().toLowerCase()
        )
        .filter(Boolean)
    )
  );
}

function tagsToInput(value) {
  return Array.isArray(value)
    ? value.join(", ")
    : "";
}

function formatDateTime(value) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function formatDate(value) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
    }
  ).format(date);
}

function toDateTimeLocal(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate =
    new Date(
      date.getTime() -
        date.getTimezoneOffset() *
          60000
    );

  return localDate
    .toISOString()
    .slice(0, 16);
}

function getErrorMessage(error) {
  return (
    error?.message ||
    "The customer-note operation failed."
  );
}

function getStoredUser() {
  try {
    const storedUser =
      localStorage.getItem(
        "salonai_user"
      );

    return storedUser
      ? JSON.parse(storedUser)
      : null;
  } catch {
    return null;
  }
}

function getNoteIdentifier(note) {
  return normaliseText(
    note?._id || note?.id
  );
}

function mapNoteToForm(note) {
  return {
    title:
      note?.title || "",

    content:
      note?.content || "",

    type:
      note?.type || "general",

    visibility:
      note?.visibility ||
      "staff",

    tags:
      tagsToInput(
        note?.tags
      ),

    pinned:
      Boolean(note?.pinned),

    requiresFollowUp:
      Boolean(
        note?.requiresFollowUp
      ),

    followUpAt:
      toDateTimeLocal(
        note?.followUpAt
      ),
  };
}

function buildNotePayload(form) {
  return {
    title:
      normaliseText(
        form.title
      ),

    content:
      normaliseText(
        form.content
      ),

    type: form.type,

    visibility:
      form.visibility,

    tags:
      parseTags(form.tags),

    pinned:
      Boolean(form.pinned),

    requiresFollowUp:
      Boolean(
        form.requiresFollowUp
      ),

    followUpAt:
      form.requiresFollowUp
        ? form.followUpAt ||
          null
        : null,
  };
}

function getStatusStyles(status) {
  switch (status) {
    case "deleted":
      return "border-red-200 bg-red-50 text-red-700";

    case "overdue":
      return "border-red-200 bg-red-50 text-red-700";

    case "follow_up":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function formatStatus(status) {
  switch (status) {
    case "follow_up":
      return "Follow-up";

    case "overdue":
      return "Overdue";

    case "completed":
      return "Follow-up complete";

    case "deleted":
      return "Deleted";

    default:
      return "Active";
  }
}

function getVisibilityIcon(
  visibility
) {
  switch (visibility) {
    case "private":
      return LockKeyhole;

    case "management":
      return ShieldAlert;

    default:
      return Eye;
  }
}

function Notice({
  type = "error",
  message,
  onClose,
}) {
  if (!message) {
    return null;
  }

  const successful =
    type === "success";

  return (
    <div
      className={[
        "flex items-start justify-between gap-4 rounded-xl border p-4",
        successful
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        {successful ? (
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0"
          />
        ) : (
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />
        )}

        <p className="text-sm font-medium">
          {message}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 transition hover:bg-black/5"
        aria-label="Close notification"
      >
        <X size={17} />
      </button>
    </div>
  );
}

function LoadingButton({
  loading = false,
  disabled = false,
  children,
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      disabled={
        loading || disabled
      }
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {loading ? (
        <Loader2
          size={16}
          className="animate-spin"
        />
      ) : null}

      {children}
    </button>
  );
}

function StatisticCard({
  label,
  value,
  icon: Icon,
  warning = false,
}) {
  return (
    <article
      className={[
        "rounded-xl border p-4",
        warning
          ? "border-red-200 bg-red-50"
          : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p
            className={[
              "text-xs font-bold uppercase tracking-wide",
              warning
                ? "text-red-600"
                : "text-slate-500",
            ].join(" ")}
          >
            {label}
          </p>

          <p
            className={[
              "mt-1 text-2xl font-bold",
              warning
                ? "text-red-800"
                : "text-slate-900",
            ].join(" ")}
          >
            {value}
          </p>
        </div>

        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-lg",
            warning
              ? "bg-red-100 text-red-700"
              : "bg-indigo-50 text-indigo-600",
          ].join(" ")}
        >
          <Icon size={19} />
        </div>
      </div>
    </article>
  );
}

function CustomerTagManager({
  customerId,
  tags,
  onTagsChanged,
  onError,
  onSuccess,
}) {
  const [
    tagInput,
    setTagInput,
  ] = useState("");

  const [
    changingTag,
    setChangingTag,
  ] = useState("");

  async function handleAddTags(
    event
  ) {
    event.preventDefault();

    const newTags =
      parseTags(tagInput);

    if (newTags.length === 0) {
      onError(
        "Enter at least one customer tag."
      );

      return;
    }

    setChangingTag("add");

    try {
      const response =
        await addCustomerTags(
          customerId,
          newTags
        );

      const updatedTags =
        response?.tags ||
        response?.customer?.tags ||
        [];

      onTagsChanged(
        updatedTags
      );

      setTagInput("");

      onSuccess(
        response?.message ||
          "Customer tags added successfully."
      );
    } catch (error) {
      onError(
        getErrorMessage(error)
      );
    } finally {
      setChangingTag("");
    }
  }

  async function handleRemoveTag(
    tag
  ) {
    setChangingTag(
      `remove:${tag}`
    );

    try {
      const response =
        await removeCustomerTags(
          customerId,
          [tag]
        );

      const updatedTags =
        response?.tags ||
        response?.customer?.tags ||
        [];

      onTagsChanged(
        updatedTags
      );

      onSuccess(
        response?.message ||
          "Customer tag removed successfully."
      );
    } catch (error) {
      onError(
        getErrorMessage(error)
      );
    } finally {
      setChangingTag("");
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Tag size={19} />
        </div>

        <div>
          <h3 className="font-bold text-slate-900">
            Customer tags
          </h3>

          <p className="text-xs text-slate-500">
            Categorise this customer
            for search and campaigns.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.length > 0 ? (
          tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
            >
              {tag}

              <button
                type="button"
                disabled={
                  Boolean(
                    changingTag
                  )
                }
                onClick={() =>
                  handleRemoveTag(
                    tag
                  )
                }
                className="rounded-full p-0.5 transition hover:bg-indigo-100 disabled:opacity-50"
                aria-label={`Remove ${tag} tag`}
              >
                {changingTag ===
                `remove:${tag}` ? (
                  <Loader2
                    size={13}
                    className="animate-spin"
                  />
                ) : (
                  <X size={13} />
                )}
              </button>
            </span>
          ))
        ) : (
          <p className="text-sm text-slate-500">
            No customer tags have
            been added.
          </p>
        )}
      </div>

      <form
        onSubmit={handleAddTags}
        className="mt-4 flex flex-col gap-2 sm:flex-row"
      >
        <input
          type="text"
          value={tagInput}
          onChange={(event) =>
            setTagInput(
              event.target.value
            )
          }
          placeholder="vip, colour-client, monthly"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />

        <LoadingButton
          type="submit"
          loading={
            changingTag === "add"
          }
          disabled={
            Boolean(
              changingTag
            )
          }
          className="bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add tag
        </LoadingButton>
      </form>

      <p className="mt-2 text-xs text-slate-500">
        Separate multiple tags with
        commas.
      </p>
    </section>
  );
}

function NoteEditor({
  editingNote,
  saving,
  onCancel,
  onSave,
}) {
  const [
    form,
    setForm,
  ] = useState(
    editingNote
      ? mapNoteToForm(
          editingNote
        )
      : EMPTY_NOTE_FORM
  );

  useEffect(() => {
    setForm(
      editingNote
        ? mapNoteToForm(
            editingNote
          )
        : EMPTY_NOTE_FORM
    );
  }, [editingNote]);

  function updateField(
    field,
    value
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (
      !normaliseText(
        form.content
      )
    ) {
      return;
    }

    onSave(
      buildNotePayload(form)
    );
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            {editingNote
              ? "Edit customer note"
              : "Add customer note"}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Record consultation,
            service or follow-up
            information.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100"
          aria-label="Close note editor"
        >
          <X size={18} />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-5 space-y-5"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="customer-note-title"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Title
            </label>

            <input
              id="customer-note-title"
              type="text"
              value={form.title}
              onChange={(event) =>
                updateField(
                  "title",
                  event.target.value
                )
              }
              placeholder="Optional note title"
              maxLength={150}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label
              htmlFor="customer-note-type"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Note type
            </label>

            <select
              id="customer-note-type"
              value={form.type}
              onChange={(event) =>
                updateField(
                  "type",
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {NOTE_TYPES.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {formatCustomerNoteType(
                      type
                    )}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="customer-note-content"
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            Note content
            <span className="ml-1 text-red-600">
              *
            </span>
          </label>

          <textarea
            id="customer-note-content"
            required
            rows={7}
            value={form.content}
            onChange={(event) =>
              updateField(
                "content",
                event.target.value
              )
            }
            maxLength={10000}
            placeholder="Enter the customer note..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <p className="mt-1 text-right text-xs text-slate-500">
            {form.content.length}
            /10,000
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="customer-note-visibility"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Visibility
            </label>

            <select
              id="customer-note-visibility"
              value={
                form.visibility
              }
              onChange={(event) =>
                updateField(
                  "visibility",
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {NOTE_VISIBILITIES.map(
                (visibility) => (
                  <option
                    key={
                      visibility
                    }
                    value={
                      visibility
                    }
                  >
                    {formatCustomerNoteVisibility(
                      visibility
                    )}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="customer-note-tags"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Note tags
            </label>

            <input
              id="customer-note-tags"
              type="text"
              value={form.tags}
              onChange={(event) =>
                updateField(
                  "tags",
                  event.target.value
                )
              }
              placeholder="consultation, colour, review"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                Pin note
              </span>

              <span className="mt-1 block text-xs text-slate-500">
                Keep this note at
                the top of the
                customer timeline.
              </span>
            </span>

            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(event) =>
                updateField(
                  "pinned",
                  event.target.checked
                )
              }
              className="mt-1 h-5 w-5 rounded border-slate-300"
            />
          </label>

          <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                Requires follow-up
              </span>

              <span className="mt-1 block text-xs text-slate-500">
                Add this note to
                the follow-up
                queue.
              </span>
            </span>

            <input
              type="checkbox"
              checked={
                form.requiresFollowUp
              }
              onChange={(event) =>
                updateField(
                  "requiresFollowUp",
                  event.target.checked
                )
              }
              className="mt-1 h-5 w-5 rounded border-slate-300"
            />
          </label>
        </div>

        {form.requiresFollowUp ? (
          <div>
            <label
              htmlFor="customer-note-follow-up"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Follow-up date and
              time
              <span className="ml-1 text-red-600">
                *
              </span>
            </label>

            <input
              id="customer-note-follow-up"
              type="datetime-local"
              required
              value={
                form.followUpAt
              }
              onChange={(event) =>
                updateField(
                  "followUpAt",
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>

          <LoadingButton
            type="submit"
            loading={saving}
            disabled={
              !normaliseText(
                form.content
              ) ||
              (
                form.requiresFollowUp &&
                !form.followUpAt
              )
            }
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Save size={16} />

            {editingNote
              ? "Save changes"
              : "Create note"}
          </LoadingButton>
        </div>
      </form>
    </section>
  );
}

function NoteCard({
  note,
  currentUser,
  processingAction,
  onEdit,
  onPin,
  onCompleteFollowUp,
  onReopenFollowUp,
  onDelete,
  onRestore,
}) {
  const noteId =
    getNoteIdentifier(note);

  const status =
    getCustomerNoteStatus(
      note
    );

  const VisibilityIcon =
    getVisibilityIcon(
      note.visibility
    );

  const isDeleted =
    Boolean(note.deletedAt);

  const currentUserId =
    normaliseText(
      currentUser?._id ||
        currentUser?.id
    );

  const authorId =
    normaliseText(
      note?.createdBy?._id ||
        note?.createdBy?.id ||
        note?.createdBy
    );

  const isAdministrator =
    currentUser?.role ===
    "admin";

  const canEditPrivate =
    note.visibility !==
      "private" ||
    isAdministrator ||
    (
      currentUserId &&
      currentUserId ===
        authorId
    );

  return (
    <article
      className={[
        "rounded-2xl border bg-white p-5 shadow-sm",
        note.pinned
          ? "border-indigo-300 ring-1 ring-indigo-100"
          : "border-slate-200",
        isDeleted
          ? "opacity-70"
          : "",
      ].join(" ")}
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {note.pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                <Pin size={13} />
                Pinned
              </span>
            ) : null}

            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {formatCustomerNoteType(
                note.type
              )}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
              <VisibilityIcon
                size={13}
              />

              {formatCustomerNoteVisibility(
                note.visibility
              )}
            </span>

            <span
              className={[
                "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                getStatusStyles(
                  status
                ),
              ].join(" ")}
            >
              {formatStatus(
                status
              )}
            </span>
          </div>

          <h3 className="mt-3 text-base font-bold text-slate-900">
            {note.title ||
              formatCustomerNoteType(
                note.type
              )}
          </h3>

          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {note.content}
          </div>

          {Array.isArray(
            note.tags
          ) &&
          note.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {note.tags.map(
                (tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                  >
                    <Tag size={12} />
                    {tag}
                  </span>
                )
              )}
            </div>
          ) : null}
        </div>

        {!isDeleted ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <LoadingButton
              type="button"
              loading={
                processingAction ===
                `pin:${noteId}`
              }
              disabled={
                Boolean(
                  processingAction
                )
              }
              onClick={() =>
                onPin(note)
              }
              className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              aria-label={
                note.pinned
                  ? "Unpin note"
                  : "Pin note"
              }
            >
              {note.pinned ? (
                <PinOff
                  size={15}
                />
              ) : (
                <Pin size={15} />
              )}
            </LoadingButton>

            {canEditPrivate ? (
              <button
                type="button"
                onClick={() =>
                  onEdit(note)
                }
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-100"
                aria-label="Edit note"
              >
                <Edit3 size={15} />
              </button>
            ) : null}

            {canEditPrivate ? (
              <LoadingButton
                type="button"
                loading={
                  processingAction ===
                  `delete:${noteId}`
                }
                disabled={
                  Boolean(
                    processingAction
                  )
                }
                onClick={() =>
                  onDelete(note)
                }
                className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                aria-label="Delete note"
              >
                <Trash2
                  size={15}
                />
              </LoadingButton>
            ) : null}
          </div>
        ) : isAdministrator ? (
          <LoadingButton
            type="button"
            loading={
              processingAction ===
              `restore:${noteId}`
            }
            disabled={
              Boolean(
                processingAction
              )
            }
            onClick={() =>
              onRestore(note)
            }
            className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            <RotateCcw
              size={15}
            />
            Restore
          </LoadingButton>
        ) : null}
      </div>

      {note.requiresFollowUp ? (
        <div
          className={[
            "mt-5 rounded-xl border p-4",
            status === "overdue"
              ? "border-red-200 bg-red-50"
              : note.followUpCompleted
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50",
          ].join(" ")}
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <CalendarClock
                size={19}
                className={[
                  "mt-0.5 shrink-0",
                  status === "overdue"
                    ? "text-red-600"
                    : note.followUpCompleted
                      ? "text-emerald-600"
                      : "text-amber-600",
                ].join(" ")}
              />

              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {note.followUpCompleted
                    ? "Follow-up completed"
                    : "Follow-up required"}
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  Scheduled for{" "}
                  {formatDateTime(
                    note.followUpAt
                  )}
                </p>

                {note.followUpCompletedAt ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Completed{" "}
                    {formatDateTime(
                      note.followUpCompletedAt
                    )}
                  </p>
                ) : null}
              </div>
            </div>

            {!isDeleted &&
            canEditPrivate ? (
              note.followUpCompleted ? (
                <LoadingButton
                  type="button"
                  loading={
                    processingAction ===
                    `reopen:${noteId}`
                  }
                  disabled={
                    Boolean(
                      processingAction
                    )
                  }
                  onClick={() =>
                    onReopenFollowUp(
                      note
                    )
                  }
                  className="border border-amber-300 bg-white text-amber-700 hover:bg-amber-100"
                >
                  <RotateCcw
                    size={15}
                  />
                  Reopen
                </LoadingButton>
              ) : (
                <LoadingButton
                  type="button"
                  loading={
                    processingAction ===
                    `complete:${noteId}`
                  }
                  disabled={
                    Boolean(
                      processingAction
                    )
                  }
                  onClick={() =>
                    onCompleteFollowUp(
                      note
                    )
                  }
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Check size={15} />
                  Complete
                </LoadingButton>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <UserRound size={14} />
          {getCustomerNoteAuthorName(
            note
          )}
        </span>

        <span className="inline-flex items-center gap-1.5">
          <Clock3 size={14} />
          {formatDateTime(
            note.createdAt
          )}
        </span>

        {note.isEdited ? (
          <span>
            Edited{" "}
            {formatDateTime(
              note.editedAt ||
                note.updatedAt
            )}
          </span>
        ) : null}

        {note.deletedAt ? (
          <span className="text-red-600">
            Deleted{" "}
            {formatDateTime(
              note.deletedAt
            )}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export default function CustomerNotesPanel({
  customerId,
  customerTags = [],
  onCustomerTagsChanged,
  className = "",
}) {
  const currentUser =
    useMemo(
      () => getStoredUser(),
      []
    );

  const isAdministrator =
    currentUser?.role ===
    "admin";

  const [
    notes,
    setNotes,
  ] = useState([]);

  const [
    statistics,
    setStatistics,
  ] = useState({
    totalNotes: 0,
    pinnedNotes: 0,
    pendingFollowUps: 0,
    overdueFollowUps: 0,
  });

  const [
    tags,
    setTags,
  ] = useState(
    Array.isArray(
      customerTags
    )
      ? customerTags
      : []
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    selectedType,
    setSelectedType,
  ] = useState("");

  const [
    followUpFilter,
    setFollowUpFilter,
  ] = useState("all");

  const [
    includeDeleted,
    setIncludeDeleted,
  ] = useState(false);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pagination,
    setPagination,
  ] = useState({
    page: 1,
    pages: 1,
    total: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    editorOpen,
    setEditorOpen,
  ] = useState(false);

  const [
    editingNote,
    setEditingNote,
  ] = useState(null);

  const [
    savingNote,
    setSavingNote,
  ] = useState(false);

  const [
    processingAction,
    setProcessingAction,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  useEffect(() => {
    setTags(
      Array.isArray(
        customerTags
      )
        ? customerTags
        : []
    );
  }, [customerTags]);

  const buildFilters =
    useCallback(() => {
      const filters = {
        page,
        limit: 10,
        search:
          normaliseText(search),
        type: selectedType,
        sortBy: "createdAt",
        sortDirection: "desc",
      };

      if (
        followUpFilter ===
        "pending"
      ) {
        filters.requiresFollowUp =
          true;

        filters.followUpCompleted =
          false;
      }

      if (
        followUpFilter ===
        "completed"
      ) {
        filters.requiresFollowUp =
          true;

        filters.followUpCompleted =
          true;
      }

      if (
        followUpFilter ===
        "overdue"
      ) {
        filters.overdueOnly =
          true;
      }

      if (
        isAdministrator &&
        includeDeleted
      ) {
        filters.includeDeleted =
          true;
      }

      return filters;
    }, [
      includeDeleted,
      isAdministrator,
      page,
      search,
      selectedType,
      followUpFilter,
    ]);

  const loadStatistics =
    useCallback(async () => {
      if (!customerId) {
        return;
      }

      try {
        const response =
          await getCustomerNoteStatistics(
            customerId
          );

        setStatistics(
          response?.statistics || {
            totalNotes: 0,
            pinnedNotes: 0,
            pendingFollowUps: 0,
            overdueFollowUps: 0,
          }
        );
      } catch {
        setStatistics({
          totalNotes: 0,
          pinnedNotes: 0,
          pendingFollowUps: 0,
          overdueFollowUps: 0,
        });
      }
    }, [customerId]);

  const loadNotes =
    useCallback(async () => {
      if (!customerId) {
        setNotes([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response =
          await listCustomerNotes(
            customerId,
            buildFilters()
          );

        setNotes(
          Array.isArray(
            response?.notes
          )
            ? response.notes
            : []
        );

        setPagination(
          response?.pagination || {
            page: 1,
            pages: 1,
            total: 0,
            hasPreviousPage: false,
            hasNextPage: false,
          }
        );
      } catch (requestError) {
        setNotes([]);

        setError(
          getErrorMessage(
            requestError
          )
        );
      } finally {
        setLoading(false);
      }
    }, [
      buildFilters,
      customerId,
    ]);

  useEffect(() => {
    const timeout =
      window.setTimeout(() => {
        void loadNotes();
      }, 300);

    return () =>
      window.clearTimeout(
        timeout
      );
  }, [loadNotes]);

  useEffect(() => {
    void loadStatistics();
  }, [loadStatistics]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedType,
    followUpFilter,
    includeDeleted,
  ]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function openCreateEditor() {
    clearMessages();
    setEditingNote(null);
    setEditorOpen(true);
  }

  function openEditEditor(note) {
    clearMessages();
    setEditingNote(note);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (savingNote) {
      return;
    }

    setEditingNote(null);
    setEditorOpen(false);
  }

  async function refreshNotes() {
    await Promise.all([
      loadNotes(),
      loadStatistics(),
    ]);
  }

  async function handleSaveNote(
    payload
  ) {
    setSavingNote(true);
    clearMessages();

    try {
      let response;

      if (editingNote) {
        response =
          await updateCustomerNote(
            getNoteIdentifier(
              editingNote
            ),
            payload
          );
      } else {
        response =
          await createCustomerNote(
            customerId,
            payload
          );
      }

      setSuccess(
        response?.message ||
          "Customer note saved successfully."
      );

      setEditorOpen(false);
      setEditingNote(null);

      await refreshNotes();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setSavingNote(false);
    }
  }

  async function handlePin(note) {
    const noteId =
      getNoteIdentifier(note);

    setProcessingAction(
      `pin:${noteId}`
    );

    clearMessages();

    try {
      const response =
        await setCustomerNotePinned(
          noteId,
          !note.pinned
        );

      setSuccess(
        response?.message ||
          "Note pin status updated."
      );

      await refreshNotes();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setProcessingAction("");
    }
  }

  async function handleCompleteFollowUp(
    note
  ) {
    const noteId =
      getNoteIdentifier(note);

    setProcessingAction(
      `complete:${noteId}`
    );

    clearMessages();

    try {
      const response =
        await completeCustomerNoteFollowUp(
          noteId
        );

      setSuccess(
        response?.message ||
          "Follow-up completed successfully."
      );

      await refreshNotes();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setProcessingAction("");
    }
  }

  async function handleReopenFollowUp(
    note
  ) {
    const defaultDate =
      toDateTimeLocal(
        note.followUpAt
      );

    const followUpAt =
      window.prompt(
        "Enter the new follow-up date and time in YYYY-MM-DDTHH:mm format:",
        defaultDate
      );

    if (followUpAt === null) {
      return;
    }

    if (
      !normaliseText(
        followUpAt
      )
    ) {
      setError(
        "A follow-up date and time is required."
      );

      return;
    }

    const noteId =
      getNoteIdentifier(note);

    setProcessingAction(
      `reopen:${noteId}`
    );

    clearMessages();

    try {
      const response =
        await reopenCustomerNoteFollowUp(
          noteId,
          followUpAt
        );

      setSuccess(
        response?.message ||
          "Follow-up reopened successfully."
      );

      await refreshNotes();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setProcessingAction("");
    }
  }

  async function handleDelete(note) {
    const confirmed =
      window.confirm(
        "Delete this customer note? It can only be restored by an administrator."
      );

    if (!confirmed) {
      return;
    }

    const noteId =
      getNoteIdentifier(note);

    setProcessingAction(
      `delete:${noteId}`
    );

    clearMessages();

    try {
      const response =
        await deleteCustomerNote(
          noteId
        );

      setSuccess(
        response?.message ||
          "Customer note deleted successfully."
      );

      await refreshNotes();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setProcessingAction("");
    }
  }

  async function handleRestore(note) {
    const noteId =
      getNoteIdentifier(note);

    setProcessingAction(
      `restore:${noteId}`
    );

    clearMessages();

    try {
      const response =
        await restoreCustomerNote(
          noteId
        );

      setSuccess(
        response?.message ||
          "Customer note restored successfully."
      );

      await refreshNotes();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError
        )
      );
    } finally {
      setProcessingAction("");
    }
  }

  function handleTagsChanged(
    updatedTags
  ) {
    const safeTags =
      Array.isArray(
        updatedTags
      )
        ? updatedTags
        : [];

    setTags(safeTags);

    onCustomerTagsChanged?.(
      safeTags
    );
  }

  return (
    <div
      className={[
        "space-y-6",
        className,
      ].join(" ")}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatisticCard
          label="Total notes"
          value={
            statistics.totalNotes ||
            0
          }
          icon={FileText}
        />

        <StatisticCard
          label="Pinned"
          value={
            statistics.pinnedNotes ||
            0
          }
          icon={Pin}
        />

        <StatisticCard
          label="Pending follow-ups"
          value={
            statistics.pendingFollowUps ||
            0
          }
          icon={CalendarClock}
        />

        <StatisticCard
          label="Overdue"
          value={
            statistics.overdueFollowUps ||
            0
          }
          icon={AlertCircle}
          warning={
            Number(
              statistics.overdueFollowUps
            ) > 0
          }
        />
      </div>

      <CustomerTagManager
        customerId={customerId}
        tags={tags}
        onTagsChanged={
          handleTagsChanged
        }
        onError={(message) => {
          setError(message);
          setSuccess("");
        }}
        onSuccess={(message) => {
          setSuccess(message);
          setError("");
        }}
      />

      <div className="space-y-3">
        <Notice
          type="error"
          message={error}
          onClose={() =>
            setError("")
          }
        />

        <Notice
          type="success"
          message={success}
          onClose={() =>
            setSuccess("")
          }
        />
      </div>

      {editorOpen ? (
        <NoteEditor
          editingNote={
            editingNote
          }
          saving={savingNote}
          onCancel={
            closeEditor
          }
          onSave={
            handleSaveNote
          }
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Customer notes
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Consultation history,
              staff notes and scheduled
              follow-ups.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                void refreshNotes()
              }
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={
                openCreateEditor
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <MessageSquarePlus
                size={17}
              />
              Add note
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[1fr_190px_190px_auto]">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search note content, title or tags"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <select
            value={selectedType}
            onChange={(event) =>
              setSelectedType(
                event.target.value
              )
            }
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">
              All note types
            </option>

            {NOTE_TYPES.map(
              (type) => (
                <option
                  key={type}
                  value={type}
                >
                  {formatCustomerNoteType(
                    type
                  )}
                </option>
              )
            )}
          </select>

          <select
            value={
              followUpFilter
            }
            onChange={(event) =>
              setFollowUpFilter(
                event.target.value
              )
            }
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">
              All follow-ups
            </option>

            <option value="pending">
              Pending follow-ups
            </option>

            <option value="overdue">
              Overdue follow-ups
            </option>

            <option value="completed">
              Completed follow-ups
            </option>
          </select>

          {isAdministrator ? (
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={
                  includeDeleted
                }
                onChange={(event) =>
                  setIncludeDeleted(
                    event.target.checked
                  )
                }
                className="h-4 w-4 rounded border-slate-300"
              />

              <EyeOff size={15} />
              Deleted
            </label>
          ) : (
            <div className="hidden lg:flex lg:items-center lg:justify-center">
              <Filter
                size={18}
                className="text-slate-300"
              />
            </div>
          )}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="space-y-4">
              {Array.from({
                length: 3,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-40 animate-pulse rounded-2xl bg-slate-100"
                  />
                )
              )}
            </div>
          ) : notes.length > 0 ? (
            <div className="space-y-4">
              {notes.map((note) => (
                <NoteCard
                  key={
                    getNoteIdentifier(
                      note
                    )
                  }
                  note={note}
                  currentUser={
                    currentUser
                  }
                  processingAction={
                    processingAction
                  }
                  onEdit={
                    openEditEditor
                  }
                  onPin={
                    handlePin
                  }
                  onCompleteFollowUp={
                    handleCompleteFollowUp
                  }
                  onReopenFollowUp={
                    handleReopenFollowUp
                  }
                  onDelete={
                    handleDelete
                  }
                  onRestore={
                    handleRestore
                  }
                />
              ))}
            </div>
          ) : (
            <div className="py-14 text-center">
              <FileText
                size={40}
                className="mx-auto text-slate-300"
              />

              <h3 className="mt-4 font-bold text-slate-900">
                No customer notes found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {search ||
                selectedType ||
                followUpFilter !==
                  "all"
                  ? "No notes match the selected filters."
                  : "Add the first note to begin the customer timeline."}
              </p>

              {!search &&
              !selectedType &&
              followUpFilter ===
                "all" ? (
                <button
                  type="button"
                  onClick={
                    openCreateEditor
                  }
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Plus size={16} />
                  Add first note
                </button>
              ) : null}
            </div>
          )}
        </div>

        {pagination.pages > 1 ? (
          <div className="flex flex-col justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-500">
              Page{" "}
              <span className="font-semibold text-slate-700">
                {pagination.page}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {pagination.pages}
              </span>
              {" · "}
              {pagination.total} notes
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={
                  !pagination.hasPreviousPage ||
                  loading
                }
                onClick={() =>
                  setPage(
                    (current) =>
                      Math.max(
                        1,
                        current - 1
                      )
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft
                  size={16}
                />
                Previous
              </button>

              <button
                type="button"
                disabled={
                  !pagination.hasNextPage ||
                  loading
                }
                onClick={() =>
                  setPage(
                    (current) =>
                      current + 1
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight
                  size={16}
                />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}