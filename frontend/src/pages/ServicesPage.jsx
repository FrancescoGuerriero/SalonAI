import {
  Eye,
  EyeOff,
  ImageOff,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Scissors,
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

import serviceService from "../Services/serviceService.js";
import useAuth from "../hooks/useAuth.js";
import useModalFocusTrap from "../hooks/useModalFocusTrap.js";
import {
  hasPermission,
} from "../utils/permissions.js";

const EMPTY_SERVICE = {
  name: "",
  category: "",
  description: "",
  image: "",
  price: "",
  priceLabel: "",
  priceOnConsultation: false,
  duration: "60",
  durationEstimated: false,
  active: true,
  bookable: true,
};

function messageFrom(
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

function toForm(service = {}) {
  return {
    name: service.name || "",
    category:
      service.category || "",
    description:
      service.description || "",
    image:
      service.image || "",
    price:
      String(
        service.price ?? ""
      ),
    priceLabel:
      service.priceLabel || "",
    priceOnConsultation:
      service.priceOnConsultation ===
      true,
    duration:
      String(
        service.duration ?? 60
      ),
    durationEstimated:
      service.durationEstimated ===
      true,
    active:
      service.active !== false,
    bookable:
      service.bookable !== false,
  };
}

function servicePayload(form) {
  return {
    name:
      form.name.trim(),
    category:
      form.category.trim(),
    description:
      form.description.trim(),
    image:
      form.image.trim(),
    price:
      Number(form.price || 0),
    priceLabel:
      form.priceLabel.trim(),
    priceOnConsultation:
      form.priceOnConsultation,
    duration:
      Number(
        form.duration || 0
      ),
    durationEstimated:
      form.durationEstimated,
    active:
      form.active,
    bookable:
      form.bookable,
  };
}

function money(value) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    }
  ).format(
    Number(value || 0)
  );
}

function PublicationBadge({
  published,
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${
        published
          ? "border-amber-400 bg-amber-50 text-black"
          : "border-stone-300 bg-stone-100 text-stone-700"
      }`}
    >
      {published ? (
        <Eye size={13} />
      ) : (
        <EyeOff
          size={13}
        />
      )}
      {published
          ? "Published"
        : "Unpublished"}
    </span>
  );
}

export default function ServicesPage() {
  const {
    user,
  } = useAuth();

  const canCreate =
    hasPermission(
      user,
      "service:create"
    );
  const canUpdate =
    hasPermission(
      user,
      "service:update"
    );
  const canPublish =
    hasPermission(
      user,
      "service:publish"
    );
  const canDelete =
    hasPermission(
      user,
      "service:delete"
    );

  const [
    services,
    setServices,
  ] = useState([]);
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    saving,
    setSaving,
  ] = useState(false);
  const [
    actionId,
    setActionId,
  ] = useState("");
  const [
    search,
    setSearch,
  ] = useState("");
  const [
    publication,
    setPublication,
  ] = useState("all");
  const [
    editingId,
    setEditingId,
  ] = useState("");
  const [
    showForm,
    setShowForm,
  ] = useState(false);
  const editorPanelRef =
    useRef(null);
  const [
    form,
    setForm,
  ] = useState(
    EMPTY_SERVICE
  );
  const [
    error,
    setError,
  ] = useState("");
  const [
    success,
    setSuccess,
  ] = useState("");

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          setServices(
            await serviceService.getManagementServices()
          );
        } catch (
          requestError
        ) {
          setError(
            messageFrom(
              requestError,
              "The service catalogue could not be loaded."
            )
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    void load();
  }, [load]);

  const filtered =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return services.filter(
        (service) => {
          const matchesText =
            !term ||
            [
              service.name,
              service.category,
              service.description,
              service.priceLabel,
            ].some(
              (value) =>
                String(
                  value || ""
                )
                  .toLowerCase()
                  .includes(
                    term
                  )
            );

          const matchesStatus =
            publication ===
              "all" ||
            (publication ===
              "published" &&
              service.published ===
                true) ||
            (publication ===
              "unpublished" &&
              service.published !==
                true);

          return (
            matchesText &&
            matchesStatus
          );
        }
      );
    }, [
      publication,
      search,
      services,
    ]);

  function openCreate() {
    setEditingId("");
    setForm({
      ...EMPTY_SERVICE,
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(service) {
    setEditingId(
      String(service._id)
    );
    setForm(
      toForm(service)
    );
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  const closeForm =
    useCallback(() => {
      if (saving) {
        return;
      }

      setShowForm(false);
      setEditingId("");
      setForm({
        ...EMPTY_SERVICE,
      });
    }, [saving]);

  const setEditorOpen =
    useCallback(
      (nextOpen) => {
        if (nextOpen) {
          setShowForm(true);
          return;
        }

        closeForm();
      },
      [closeForm]
    );

  useModalFocusTrap({
    open: showForm,
    containerRef:
      editorPanelRef,
    setOpen:
      setEditorOpen,
  });

  useEffect(() => {
    if (!showForm) {
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
  }, [showForm]);

  function update(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  async function save(
    event
  ) {
    event.preventDefault();

    if (
      editingId &&
      !canUpdate
    ) {
      setError(
        "You do not have permission to edit services."
      );
      return;
    }

    if (
      !editingId &&
      !canCreate
    ) {
      setError(
        "You do not have permission to create services."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload =
        servicePayload(form);

      if (editingId) {
        await serviceService.updateService(
          editingId,
          payload
        );
        setSuccess(
          "Service details updated."
        );
      } else {
        await serviceService.createService(
          payload
        );
        setSuccess(
          "Service created as unpublished. Publish it when it is ready for customers."
        );
      }

      setShowForm(false);
      setEditingId("");
      setForm({
        ...EMPTY_SERVICE,
      });
      await load();
    } catch (
      requestError
    ) {
      setError(
        messageFrom(
          requestError,
          "The service could not be saved."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublication(
    service
  ) {
    if (!canPublish) {
      return;
    }

    try {
      setActionId(
        String(service._id)
      );
      setError("");
      setSuccess("");

      const next =
        service.published !==
        true;

      await serviceService.setPublication(
        service._id,
        next
      );

      setSuccess(
        next
          ? `${service.name} is now published.`
          : `${service.name} is now unpublished.`
      );

      await load();
    } catch (
      requestError
    ) {
      setError(
        messageFrom(
          requestError,
          "Publication could not be changed."
        )
      );
    } finally {
      setActionId("");
    }
  }

  async function remove(
    service
  ) {
    if (
      !canDelete ||
      !window.confirm(
        `Permanently delete ${service.name}? Use Unpublish instead when you only want to remove it from customer booking.`
      )
    ) {
      return;
    }

    try {
      setActionId(
        String(service._id)
      );
      setError("");
      await serviceService.deleteService(
        service._id
      );
      setSuccess(
        `${service.name} was permanently deleted.`
      );
      await load();
    } catch (
      requestError
    ) {
      setError(
        messageFrom(
          requestError,
          "The service could not be deleted."
        )
      );
    } finally {
      setActionId("");
    }
  }

  return (
    <main
      className="space-y-6 p-4 sm:p-6 lg:p-8"
      id="main-content"
      tabIndex="-1"
    >
      <header className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Catalogue management
            </p>
            <h1 className="mt-2 text-2xl font-bold text-black sm:text-3xl">
              Salon services
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              Maintain the customer-facing service catalogue. Editing service content and publishing it are separate permissions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-50"
              onClick={() =>
                void load()
              }
              disabled={
                loading
              }
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>

            {canCreate ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300"
                onClick={
                  openCreate
                }
              >
                <Plus
                  size={17}
                />
                Add service
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {error ? (
        <div
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-black"
          role="status"
        >
          {success}
        </div>
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="relative block">
            <span className="sr-only">
              Search services
            </span>
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-3 text-stone-500"
            />
            <input
              type="search"
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Search name, category or description..."
              className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-10 pr-3 text-sm text-black outline-none focus:border-black focus:ring-2 focus:ring-amber-300"
            />
          </label>

          <select
            value={
              publication
            }
            onChange={(
              event
            ) =>
              setPublication(
                event.target
                  .value
              )
            }
            className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold text-black"
            aria-label="Publication filter"
          >
            <option value="all">
              All services
            </option>
            <option value="published">
              Published
            </option>
            <option value="unpublished">
              Unpublished
            </option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-5 py-4">
          <h2 className="font-bold text-black">
            Service catalogue
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            {filtered.length} of {services.length} services shown
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm font-semibold text-stone-600">
            Loading services…
          </div>
        ) : filtered.length ===
          0 ? (
          <div className="p-10 text-center">
            <Scissors
              size={30}
              className="mx-auto text-stone-400"
            />
            <p className="mt-3 font-bold text-black">
              No matching services
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-200">
            {filtered.map(
              (service) => (
                <article
                  key={
                    service._id
                  }
                  className="grid gap-4 p-5 lg:grid-cols-[5rem_minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                    {service.image ? (
                      <img
                        src={
                          service.image
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageOff
                        size={22}
                        className="text-stone-400"
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-black">
                        {service.name}
                      </h3>
                      <PublicationBadge
                        published={
                          service.published ===
                          true
                        }
                      />
                      {service.bookable ? (
                        <span className="rounded-full border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700">
                          Bookable
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      {service.category}
                    </p>
                    <p className="mt-2 text-sm text-stone-600">
                      {service.description ||
                        "No description provided."}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-black">
                      {service.priceOnConsultation
                        ? service.priceLabel ||
                          "Price on consultation"
                        : money(
                            service.price
                          )}
                      {" · "}
                      {service.duration} min
                      {service.durationEstimated
                        ? " estimated"
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {canUpdate ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-black px-3 py-2 text-xs font-bold text-black hover:bg-amber-50"
                        onClick={() =>
                          openEdit(
                            service
                          )
                        }
                      >
                        <Pencil
                          size={14}
                        />
                        Edit
                      </button>
                    ) : null}

                    {canPublish ? (
                      <button
                        type="button"
                        className="rounded-lg border border-black bg-amber-400 px-3 py-2 text-xs font-bold text-black hover:bg-amber-300 disabled:opacity-50"
                        disabled={
                          actionId ===
                          String(
                            service._id
                          )
                        }
                        onClick={() =>
                          void togglePublication(
                            service
                          )
                        }
                      >
                        {service.published
          ? "Unpublish"
                          : "Publish"}
                      </button>
                    ) : null}

                    {canDelete ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-50"
                        onClick={() =>
                          void remove(
                            service
                          )
                        }
                      >
                        <Trash2
                          size={14}
                        />
                        Delete
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>

      {showForm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-form-title"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <form
            ref={editorPanelRef}
            className="max-h-[calc(100dvh-1rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)]"
            onSubmit={
              save
            }
          >
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-stone-200 bg-white p-4 sm:p-5">
              <div>
                <h2
                  id="service-form-title"
                  className="text-xl font-bold text-black"
                >
                  {editingId
                    ? "Edit service"
                    : "Add service"}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  New services are created unpublished.
                </p>
              </div>
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-lg p-2 text-black hover:bg-stone-100"
                onClick={
                  closeForm
                }
                aria-label="Close service editor"
              >
                <X size={20} />
              </button>
            </header>

            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <label className="text-sm font-semibold text-black">
                Service name
                <input
                  required
                  value={
                    form.name
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "name",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                />
              </label>

              <label className="text-sm font-semibold text-black">
                Category
                <input
                  required
                  value={
                    form.category
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "category",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                />
              </label>

              <label className="sm:col-span-2 text-sm font-semibold text-black">
                Description
                <textarea
                  rows="5"
                  value={
                    form.description
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "description",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                />
              </label>

              <label className="sm:col-span-2 text-sm font-semibold text-black">
                Image URL
                <input
                  type="url"
                  value={
                    form.image
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "image",
                      event.target
                        .value
                    )
                  }
                  placeholder="https://..."
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                />
              </label>

              {form.image ? (
                <div className="sm:col-span-2">
                  <img
                    src={
                      form.image
                    }
                    alt="Service preview"
                    className="h-40 w-full rounded-xl border border-stone-200 object-cover"
                  />
                </div>
              ) : null}

              <label className="text-sm font-semibold text-black">
                Base price (£)
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    form.price
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "price",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                />
              </label>

              <label className="text-sm font-semibold text-black">
                Price label
                <input
                  value={
                    form.priceLabel
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "priceLabel",
                      event.target
                        .value
                    )
                  }
                  placeholder="From £75"
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                />
              </label>

              <label className="text-sm font-semibold text-black">
                Duration (minutes)
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={
                    form.duration
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "duration",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                />
              </label>

              <div className="space-y-3 rounded-xl border border-stone-200 p-4">
                {[
                  [
                    "priceOnConsultation",
                    "Price on consultation",
                  ],
                  [
                    "durationEstimated",
                    "Duration is estimated",
                  ],
                  [
                    "active",
                    "Active service",
                  ],
                  [
                    "bookable",
                    "Bookable across enabled booking channels",
                  ],
                ].map(
                  ([
                    field,
                    label,
                  ]) => (
                    <label
                      key={
                        field
                      }
                      className="flex items-center gap-3 text-sm font-semibold text-black"
                    >
                      <input
                        type="checkbox"
                        checked={
                          form[
                            field
                          ]
                        }
                        onChange={(
                          event
                        ) =>
                          update(
                            field,
                            event
                              .target
                              .checked
                          )
                        }
                        className="h-4 w-4 accent-amber-500"
                      />
                      {label}
                    </label>
                  )
                )}
              </div>
            </div>

            <footer className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t border-stone-200 bg-white p-4 sm:flex-row sm:justify-end sm:p-5">
              <button
                type="button"
                className="rounded-xl border border-black bg-white px-4 py-2.5 text-sm font-bold text-black"
                onClick={
                  closeForm
                }
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  saving
                }
                className="rounded-xl border border-black bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50"
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Create service"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </main>
  );
}
