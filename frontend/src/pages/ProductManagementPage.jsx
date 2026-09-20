import {
  Eye,
  EyeOff,
  ImageOff,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import CatalogueImagePicker from "../components/catalogue/CatalogueImagePicker.jsx";
import commerceService from "../Services/commerceService.js";
import useAuth from "../hooks/useAuth.js";
import useModalFocusTrap from "../hooks/useModalFocusTrap.js";
import {
  hasPermission,
} from "../utils/permissions.js";
import {
  formatCurrency,
} from "../utils/currency.js";

const EMPTY_PRODUCT = {
  name: "",
  sku: "",
  brand: "",
  category: "Haircare",
  collectionName: "",
  badge: "",
  size: "",
  description: "",
  officialDescription: "",
  price: "",
  costPrice: "",
  images: "",
  featured: false,
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

function imageLines(value) {
  return Array.isArray(value)
    ? value.join("\n")
    : "";
}

function imageArray(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}

function toForm(product = {}) {
  return {
    name: product.name || "",
    sku: product.sku || "",
    brand: product.brand || "",
    category:
      product.category ||
      "Haircare",
    collectionName:
      product.collectionName ||
      "",
    badge: product.badge || "",
    size: product.size || "",
    description:
      product.description || "",
    officialDescription:
      product.officialDescription ||
      "",
    price:
      String(
        product.price ?? ""
      ),
    costPrice:
      product.costPrice ===
      undefined
        ? ""
        : String(
            product.costPrice
          ),
    images:
      imageLines(
        product.images
      ),
    featured:
      product.featured ===
      true,
  };
}

function productPayload(
  form,
  canReadCost
) {
  const payload = {
    name:
      form.name.trim(),
    sku:
      form.sku.trim(),
    brand:
      form.brand.trim(),
    category:
      form.category.trim(),
    collectionName:
      form.collectionName.trim(),
    badge:
      form.badge.trim(),
    size:
      form.size.trim(),
    description:
      form.description.trim(),
    officialDescription:
      form.officialDescription.trim(),
    price:
      Number(form.price || 0),
    images:
      imageArray(
        form.images
      ),
    featured:
      form.featured,
  };

  if (
    canReadCost &&
    form.costPrice !== ""
  ) {
    payload.costPrice =
      Number(
        form.costPrice
      );
  }

  return payload;
}

function StatusBadge({
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

export default function ProductManagementPage() {
  const {
    user,
  } = useAuth();

  const canCreate =
    hasPermission(
      user,
      "product:create"
    );
  const canUpdate =
    hasPermission(
      user,
      "product:update"
    );
  const canPublish =
    hasPermission(
      user,
      "product:publish"
    );
  const canReadCost =
    hasPermission(
      user,
      "product:cost:read"
    );

  const [
    products,
    setProducts,
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
  ] = useState({
    ...EMPTY_PRODUCT,
  });
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
          const result =
            await commerceService.listInventoryProducts({
              limit: 250,
              sort: "name",
            });

          setProducts(
            Array.isArray(
              result?.items
            )
              ? result.items
              : []
          );
        } catch (
          requestError
        ) {
          setError(
            messageFrom(
              requestError,
              "The product catalogue could not be loaded."
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

      return products.filter(
        (product) => {
          const matchesText =
            !term ||
            [
              product.name,
              product.sku,
              product.brand,
              product.category,
              product.collectionName,
              product.description,
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
              product.active ===
                true) ||
            (publication ===
              "unpublished" &&
              product.active !==
                true);

          return (
            matchesText &&
            matchesStatus
          );
        }
      );
    }, [
      products,
      publication,
      search,
    ]);

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

  function openCreate() {
    setEditingId("");
    setForm({
      ...EMPTY_PRODUCT,
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(product) {
    setEditingId(
      String(product._id)
    );
    setForm(
      toForm(product)
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

  async function save(
    event
  ) {
    event.preventDefault();

    if (
      editingId &&
      !canUpdate
    ) {
      setError(
        "You do not have permission to edit products."
      );
      return;
    }

    if (
      !editingId &&
      !canCreate
    ) {
      setError(
        "You do not have permission to create products."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload =
        productPayload(
          form,
          canReadCost
        );

      if (editingId) {
        await commerceService.updateProduct(
          editingId,
          payload
        );
        setSuccess(
          "Product details updated."
        );
      } else {
        await commerceService.createProduct(
          payload
        );
        setSuccess(
          "Product created as unpublished. Publish it when the catalogue information is ready."
        );
      }

      setShowForm(false);
      setEditingId("");
      setForm({
        ...EMPTY_PRODUCT,
      });

      await load();
    } catch (
      requestError
    ) {
      setError(
        messageFrom(
          requestError,
          "The product could not be saved."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublication(
    product
  ) {
    if (!canPublish) {
      return;
    }

    try {
      setActionId(
        String(product._id)
      );
      setError("");
      setSuccess("");

      const next =
        product.active !==
        true;

      await commerceService.setProductPublication(
        product._id,
        next
      );

      setSuccess(
        next
          ? `${product.name} is now published in the Shop.`
          : `${product.name} is now unpublished from the Shop.`
      );

      await load();
    } catch (
      requestError
    ) {
      setError(
        messageFrom(
          requestError,
          "Product publication could not be changed."
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
              Products
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              Manage retail product content and Shop publication. Inventory quantities and stock adjustments remain in the Inventory workspace.
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
                Add product
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
              Search products
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
              placeholder="Search product, SKU, brand or category..."
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
              All products
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
            Product catalogue
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            {filtered.length} of {products.length} products shown
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm font-semibold text-stone-600">
            Loading products…
          </div>
        ) : filtered.length ===
          0 ? (
          <div className="p-10 text-center">
            <Package
              size={30}
              className="mx-auto text-stone-400"
            />
            <p className="mt-3 font-bold text-black">
              No matching products
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-200">
            {filtered.map(
              (product) => (
                <article
                  key={
                    product._id
                  }
                  className="grid gap-4 p-5 lg:grid-cols-[5rem_minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                    {product
                      .images?.[0] ? (
                      <img
                        src={
                          product
                            .images[0]
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
                        {product.name}
                      </h3>
                      <StatusBadge
                        published={
                          product.active ===
                          true
                        }
                      />
                      {product.featured ? (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-bold text-black">
                          Featured
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      {product.brand ||
                        "No brand"}{" "}
                      ·{" "}
                      {product.category}
                      {product.size
                        ? ` · ${product.size}`
                        : ""}
                    </p>

                    <p className="mt-2 text-sm text-stone-600">
                      {product.description ||
                        "No description provided."}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-black">
                      <span>
                        {formatCurrency(
                          product.price
                        )}
                      </span>
                      <span>
                        Stock:{" "}
                        {product.stockQuantity}
                      </span>
                      {canReadCost &&
                      product.costPrice !==
                        undefined ? (
                        <span>
                          Cost:{" "}
                          {formatCurrency(
                            product.costPrice
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {canUpdate ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-black px-3 py-2 text-xs font-bold text-black hover:bg-amber-50"
                        onClick={() =>
                          openEdit(
                            product
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
                            product._id
                          )
                        }
                        onClick={() =>
                          void togglePublication(
                            product
                          )
                        }
                      >
                        {product.active
                          ? "Unpublish"
                          : "Publish"}
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
          aria-labelledby="product-form-title"
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
            className="max-h-[calc(100dvh-1rem)] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)]"
            onSubmit={
              save
            }
          >
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-stone-200 bg-white p-4 sm:p-5">
              <div>
                <h2
                  id="product-form-title"
                  className="text-xl font-bold text-black"
                >
                  {editingId
                    ? "Edit product"
                    : "Add product"}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Product content is separate from Shop publication and inventory movements.
                </p>
              </div>

              <button
                type="button"
                className="min-h-11 min-w-11 rounded-lg p-2 text-black hover:bg-stone-100"
                onClick={
                  closeForm
                }
                aria-label="Close product editor"
              >
                <X size={20} />
              </button>
            </header>

            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              {[
                [
                  "name",
                  "Product name",
                  true,
                ],
                [
                  "sku",
                  "SKU",
                  true,
                ],
                [
                  "brand",
                  "Brand",
                  false,
                ],
                [
                  "category",
                  "Category",
                  true,
                ],
                [
                  "collectionName",
                  "Collection",
                  false,
                ],
                [
                  "badge",
                  "Badge",
                  false,
                ],
                [
                  "size",
                  "Size",
                  false,
                ],
              ].map(
                ([
                  field,
                  label,
                  required,
                ]) => (
                  <label
                    key={
                      field
                    }
                    className="text-sm font-semibold text-black"
                  >
                    {label}
                    <input
                      required={
                        required
                      }
                      value={
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
                            .value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                    />
                  </label>
                )
              )}

              <label className="text-sm font-semibold text-black">
                Retail price (£)
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

              {canReadCost ? (
                <label className="text-sm font-semibold text-black">
                  Cost price (£)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.costPrice
                    }
                    onChange={(
                      event
                    ) =>
                      update(
                        "costPrice",
                        event.target
                          .value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                  />
                </label>
              ) : null}

              <label className="sm:col-span-2 text-sm font-semibold text-black">
                Shop description
                <textarea
                  rows="4"
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
                Full / official description
                <textarea
                  rows="6"
                  value={
                    form.officialDescription
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "officialDescription",
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                />
              </label>

              <CatalogueImagePicker
                images={
                  imageArray(
                    form.images
                  )
                }
                onChange={(
                  images
                ) =>
                  update(
                    "images",
                    images.join(
                      "\n"
                    )
                  )
                }
                multiple
                label="Product images"
                help="Use + Add image to upload one or more JPEG, PNG or WebP files. You can also add existing HTTPS/app image paths. The first image is the primary Shop image."
                disabled={
                  saving
                }
              />

              <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-stone-200 p-4 text-sm font-semibold text-black">
                <input
                  type="checkbox"
                  checked={
                    form.featured
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "featured",
                      event.target
                        .checked
                    )
                  }
                  className="h-4 w-4 accent-amber-500"
                />
                Featured product
              </label>
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
                    : "Create product"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </main>
  );
}
