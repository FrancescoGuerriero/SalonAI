import {
  BadgePoundSterling,
  CheckCircle2,
  CircleOff,
  ClipboardCheck,
  Edit3,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Send,
  Trash2,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import servicePackageService from "../Services/servicePackageService.js";
import ServicePackageRedemptionPanel from "./ServicePackageRedemptionPanel.jsx";
import serviceService from "../Services/serviceService.js";
import useAuth from "../hooks/useAuth.js";
import { hasPermission } from "../utils/permissions.js";
import {
  getCustomerDisplayName,
  listCustomerProfiles,
} from "../Services/customerProfileService.js";
import { formatCurrency } from "../utils/currency.js";
import "./ServicePackages.css";

const EMPTY_FORM = {
  code: "",
  name: "",
  description: "",
  price: "",
  validityDays: 365,
  active: true,
  published: false,
  includedServices: [
    {
      service: "",
      sessions: 1,
    },
  ],
};

function listFrom(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  for (const key of [
    "items",
    "customers",
    "services",
    "data",
  ]) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  if (
    Array.isArray(
      payload?.data?.customers
    )
  ) {
    return payload.data.customers;
  }

  return [];
}

function idOf(value) {
  return String(
    value?._id ||
      value?.id ||
      value ||
      ""
  ).trim();
}

function definitionToForm(
  definition
) {
  return {
    code:
      definition?.code || "",
    name:
      definition?.name || "",
    description:
      definition?.description ||
      "",
    price:
      definition?.price ?? "",
    validityDays:
      definition?.validityDays ||
      365,
    active:
      definition?.active !==
      false,
    published:
      definition?.published ===
      true,
    includedServices:
      (
        definition?.includedServices ||
        []
      ).map((item) => ({
        service: idOf(
          item?.service
        ),
        sessions:
          item?.sessions || 1,
      })).length
        ? (
            definition?.includedServices ||
            []
          ).map((item) => ({
            service: idOf(
              item?.service
            ),
            sessions:
              item?.sessions ||
              1,
          }))
        : [
            {
              service: "",
              sessions: 1,
            },
          ],
  };
}

function remainingTotal(
  entitlement
) {
  return (
    entitlement?.credits ||
    []
  ).reduce(
    (sum, credit) =>
      sum +
      Number(
        credit?.remaining ||
          0
      ),
    0
  );
}

export default function ServicePackageManagementPage() {
  const {
    user,
  } = useAuth();

  const canCreatePackage =
    hasPermission(
      user,
      "service:create"
    );
  const canUpdatePackage =
    hasPermission(
      user,
      "service:update"
    );
  const canReadCustomers =
    hasPermission(
      user,
      "customer:read"
    );
  const canGrantPackage =
    canReadCustomers &&
    hasPermission(
      user,
      "customer:update"
    );
  const canManageRedemptions =
    canReadCustomers &&
    hasPermission(
      user,
      "appointment:update"
    );

  const [
    packages,
    setPackages,
  ] = useState([]);
  const [
    services,
    setServices,
  ] = useState([]);
  const [
    customers,
    setCustomers,
  ] = useState([]);
  const [
    form,
    setForm,
  ] = useState(EMPTY_FORM);
  const [
    editingId,
    setEditingId,
  ] = useState("");
  const [
    selectedCustomerId,
    setSelectedCustomerId,
  ] = useState("");
  const [
    selectedGrantPackageId,
    setSelectedGrantPackageId,
  ] = useState("");
  const [
    grantReason,
    setGrantReason,
  ] = useState("");
  const [
    customerEntitlements,
    setCustomerEntitlements,
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
    message,
    setMessage,
  ] = useState("");
  const [
    error,
    setError,
  ] = useState("");

  const loadWorkspace =
    useCallback(async () => {
      setLoading(true);
      setError("");

      const results =
        await Promise.allSettled(
          [
            servicePackageService
              .listManagement(),
            serviceService
              .getManagementServices(),
            canReadCustomers
              ? listCustomerProfiles({
                  page: 1,
                  limit: 100,
                })
              : Promise.resolve({
                  customers: [],
                }),
          ]
        );

      if (
        results[0].status ===
        "fulfilled"
      ) {
        setPackages(
          listFrom(
            results[0].value
          )
        );
      }

      if (
        results[1].status ===
        "fulfilled"
      ) {
        setServices(
          listFrom(
            results[1].value
          ).filter(
            (service) =>
              service?.active !==
              false
          )
        );
      }

      if (
        results[2].status ===
        "fulfilled"
      ) {
        setCustomers(
          listFrom(
            results[2].value
          )
        );
      }

      const failures =
        results.filter(
          (result) =>
            result.status ===
            "rejected"
        );

      if (failures.length) {
        setError(
          failures[0]?.reason
            ?.response?.data
            ?.message ||
            failures[0]?.reason
              ?.message ||
            "Some service-package management data could not be loaded."
        );
      }

      setLoading(false);
    }, [
      canReadCustomers,
    ]);

  useEffect(() => {
    loadWorkspace();
  }, [
    loadWorkspace,
  ]);

  useEffect(() => {
    let active = true;

    async function loadEntitlements() {
      if (
        !canReadCustomers ||
        !selectedCustomerId
      ) {
        setCustomerEntitlements(
          []
        );
        return;
      }

      try {
        const response =
          await servicePackageService
            .listCustomerEntitlements(
              selectedCustomerId
            );

        if (active) {
          setCustomerEntitlements(
            listFrom(response)
          );
        }
      } catch {
        if (active) {
          setCustomerEntitlements(
            []
          );
        }
      }
    }

    loadEntitlements();

    return () => {
      active = false;
    };
  }, [
    canReadCustomers,
    selectedCustomerId,
    message,
  ]);

  const selectedDefinition =
    useMemo(
      () =>
        packages.find(
          (item) =>
            idOf(item) ===
            selectedGrantPackageId
        ) || null,
      [
        packages,
        selectedGrantPackageId,
      ]
    );

  function resetEditor() {
    setForm({
      ...EMPTY_FORM,
      includedServices: [
        {
          service: "",
          sessions: 1,
        },
      ],
    });
    setEditingId("");
  }

  function editPackage(
    definition
  ) {
    setEditingId(
      idOf(definition)
    );
    setForm(
      definitionToForm(
        definition
      )
    );
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function updateServiceRow(
    index,
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        includedServices:
          current.includedServices.map(
            (
              item,
              itemIndex
            ) =>
              itemIndex ===
              index
                ? {
                    ...item,
                    [field]:
                      value,
                  }
                : item
          ),
      })
    );
  }

  function addServiceRow() {
    setForm(
      (current) => ({
        ...current,
        includedServices: [
          ...current.includedServices,
          {
            service: "",
            sessions: 1,
          },
        ],
      })
    );
  }

  function removeServiceRow(
    index
  ) {
    setForm(
      (current) => ({
        ...current,
        includedServices:
          current.includedServices
            .filter(
              (
                _,
                itemIndex
              ) =>
                itemIndex !==
                index
            ),
      })
    );
  }

  async function savePackage(
    event
  ) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const includedServices =
      form.includedServices
        .filter(
          (item) =>
            item.service
        )
        .map(
          (item) => ({
            service:
              item.service,
            sessions:
              Number(
                item.sessions
              ),
          })
        );

    try {
      if (
        editingId
          ? !canUpdatePackage
          : !canCreatePackage
      ) {
        throw new Error(
          editingId
            ? "You do not have permission to update service packages."
            : "You do not have permission to create service packages."
        );
      }

      const payload = {
        code:
          form.code.trim(),
        name:
          form.name.trim(),
        description:
          form.description.trim(),
        price:
          Number(form.price),
        validityDays:
          Number(
            form.validityDays
          ),
        active:
          Boolean(
            form.active
          ),
        published:
          Boolean(
            form.published
          ),
        includedServices,
      };

      if (editingId) {
        await servicePackageService
          .update(
            editingId,
            payload
          );
        setMessage(
          "Service package updated."
        );
      } else {
        await servicePackageService
          .create(payload);
        setMessage(
          "Service package created."
        );
      }

      resetEditor();
      await loadWorkspace();
    } catch (requestError) {
      setError(
        requestError?.response
          ?.data?.message ||
          requestError?.message ||
          "The service package could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublication(
    definition
  ) {
    setError("");
    setMessage("");

    try {
      if (!canUpdatePackage) {
        throw new Error(
          "You do not have permission to publish or unpublish service packages."
        );
      }

      await servicePackageService
        .update(
          idOf(definition),
          {
            published:
              !definition.published,
          }
        );

      setMessage(
        definition.published
          ? "Package unpublished."
          : "Package published."
      );

      await loadWorkspace();
    } catch (requestError) {
      setError(
        requestError?.response
          ?.data?.message ||
          "Package publication could not be changed."
      );
    }
  }

  async function grantPackage(
    event
  ) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!canGrantPackage) {
        throw new Error(
          "Customer read and update permissions are required to grant service packages."
        );
      }

      if (
        !selectedGrantPackageId ||
        !selectedCustomerId
      ) {
        throw new Error(
          "Choose both a package and a customer."
        );
      }

      if (
        !grantReason.trim()
      ) {
        throw new Error(
          "An audit reason is required for a manual package grant."
        );
      }

      await servicePackageService
        .grant(
          selectedGrantPackageId,
          {
            customer:
              selectedCustomerId,
            reason:
              grantReason.trim(),
          }
        );

      setMessage(
        `${selectedDefinition?.name || "Package"} granted to the selected customer.`
      );
      setGrantReason("");
    } catch (requestError) {
      setError(
        requestError?.response
          ?.data?.message ||
          requestError?.message ||
          "The package could not be granted."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page package-page package-management-page">
      <header className="package-hero">
        <div>
          <span className="commerce-eyebrow">
            Service catalogue
          </span>
          <h1>
            Service package
            management
          </h1>
          <p>
            Create prepaid service
            bundles, control publication,
            and grant audited
            entitlements without creating
            duplicate customer, service
            or payment records.
          </p>
        </div>
        <PackagePlus
          size={48}
          aria-hidden="true"
        />
      </header>

      {error ? (
        <div
          className="error-message"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          className="package-success"
          role="status"
        >
          <CheckCircle2
            size={18}
            aria-hidden="true"
          />
          {message}
        </div>
      ) : null}

      <section className="package-management-grid">
        <form
          className="package-editor-card"
          onSubmit={
            savePackage
          }
        >
          <div className="package-section-heading">
            <div>
              <span className="commerce-eyebrow">
                {editingId
                  ? "Edit definition"
                  : "New definition"}
              </span>
              <h2>
                {editingId
                  ? "Update service package"
                  : "Create service package"}
              </h2>
            </div>
            {editingId ? (
              <button
                type="button"
                className="app-button app-button-secondary"
                onClick={
                  resetEditor
                }
              >
                New package
              </button>
            ) : null}
          </div>

          <div className="package-form-grid">
            <label>
              Package code
              <input
                required
                maxLength="40"
                value={
                  form.code
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      code:
                        event
                          .target
                          .value
                          .toUpperCase(),
                    })
                  )
                }
                placeholder="COLOUR-3"
              />
            </label>

            <label>
              Package name
              <input
                required
                maxLength="160"
                value={
                  form.name
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      name:
                        event
                          .target
                          .value,
                    })
                  )
                }
                placeholder="Three colour visits"
              />
            </label>

            <label>
              Price (£)
              <input
                required
                min="0"
                step="0.01"
                type="number"
                value={
                  form.price
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      price:
                        event
                          .target
                          .value,
                    })
                  )
                }
              />
            </label>

            <label>
              Validity (days)
              <input
                required
                min="1"
                max="3650"
                type="number"
                value={
                  form.validityDays
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      validityDays:
                        event
                          .target
                          .value,
                    })
                  )
                }
              />
            </label>
          </div>

          <label>
            Customer description
            <textarea
              rows="4"
              maxLength="2000"
              value={
                form.description
              }
              onChange={(
                event
              ) =>
                setForm(
                  (current) => ({
                    ...current,
                    description:
                      event
                        .target
                        .value,
                  })
                )
              }
              placeholder="Explain who this package is for and what is included."
            />
          </label>

          <fieldset className="package-credit-editor">
            <legend>
              Included service credits
            </legend>

            {form.includedServices.map(
              (
                item,
                index
              ) => (
                <div
                  className="package-credit-editor-row"
                  key={index}
                >
                  <label>
                    Service
                    <select
                      required
                      value={
                        item.service
                      }
                      onChange={(
                        event
                      ) =>
                        updateServiceRow(
                          index,
                          "service",
                          event
                            .target
                            .value
                        )
                      }
                    >
                      <option value="">
                        Select
                        service
                      </option>
                      {services.map(
                        (
                          service
                        ) => (
                          <option
                            key={
                              idOf(
                                service
                              )
                            }
                            value={
                              idOf(
                                service
                              )
                            }
                          >
                            {
                              service.name
                            }{" "}
                            ·{" "}
                            {formatCurrency(
                              service.price
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label>
                    Sessions
                    <input
                      required
                      min="1"
                      max="100"
                      type="number"
                      value={
                        item.sessions
                      }
                      onChange={(
                        event
                      ) =>
                        updateServiceRow(
                          index,
                          "sessions",
                          event
                            .target
                            .value
                        )
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className="commerce-icon-danger package-remove-credit"
                    disabled={
                      form
                        .includedServices
                        .length ===
                      1
                    }
                    onClick={() =>
                      removeServiceRow(
                        index
                      )
                    }
                    aria-label={`Remove included service ${index + 1}`}
                  >
                    <Trash2
                      size={17}
                    />
                  </button>
                </div>
              )
            )}

            <button
              type="button"
              className="app-button app-button-secondary"
              onClick={
                addServiceRow
              }
            >
              <Plus
                size={17}
                aria-hidden="true"
              />
              Add service
            </button>
          </fieldset>

          <div className="package-checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={
                  form.active
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      active:
                        event
                          .target
                          .checked,
                    })
                  )
                }
              />
              Active
            </label>
            <label>
              <input
                type="checkbox"
                checked={
                  form.published
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      published:
                        event
                          .target
                          .checked,
                    })
                  )
                }
              />
              Published to
              customers
            </label>
          </div>

          <button
            className="app-button app-button-primary"
            type="submit"
            disabled={
              saving ||
              (editingId
                ? !canUpdatePackage
                : !canCreatePackage)
            }
          >
            <Save
              size={17}
              aria-hidden="true"
            />
            {saving
              ? "Saving…"
              : editingId
                ? "Save changes"
                : "Create package"}
          </button>
        </form>

        <section className="package-editor-card">
          <div className="package-section-heading">
            <div>
              <span className="commerce-eyebrow">
                Audited exception
              </span>
              <h2>
                Grant package
              </h2>
              <p>
                Use this only when a
                package should be issued
                without pretending a paid
                order occurred.
              </p>
              {!canGrantPackage ? (
                <p className="package-permission-note">
                  Customer read and update permissions are required for manual grants.
                </p>
              ) : null}
            </div>
            <UsersRound
              size={28}
              aria-hidden="true"
            />
          </div>

          <form
            className="package-grant-form"
            onSubmit={
              grantPackage
            }
          >
            <label>
              Package
              <select
                required
                value={
                  selectedGrantPackageId
                }
                onChange={(
                  event
                ) =>
                  setSelectedGrantPackageId(
                    event
                      .target
                      .value
                  )
                }
              >
                <option value="">
                  Select package
                </option>
                {packages
                  .filter(
                    (
                      definition
                    ) =>
                      definition
                        .active !==
                      false
                  )
                  .map(
                    (
                      definition
                    ) => (
                      <option
                        key={
                          idOf(
                            definition
                          )
                        }
                        value={
                          idOf(
                            definition
                          )
                        }
                      >
                        {
                          definition.name
                        }{" "}
                        ·{" "}
                        {formatCurrency(
                          definition.price
                        )}
                      </option>
                    )
                  )}
              </select>
            </label>

            <label>
              Customer
              <select
                required
                disabled={
                  !canReadCustomers
                }
                value={
                  selectedCustomerId
                }
                onChange={(
                  event
                ) =>
                  setSelectedCustomerId(
                    event
                      .target
                      .value
                  )
                }
              >
                <option value="">
                  Select customer
                </option>
                {customers.map(
                  (customer) => (
                    <option
                      key={
                        idOf(
                          customer
                        )
                      }
                      value={
                        idOf(
                          customer
                        )
                      }
                    >
                      {getCustomerDisplayName(
                        customer
                      )}
                      {customer.email
                        ? ` · ${customer.email}`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Audit reason
              <textarea
                required
                rows="3"
                maxLength="500"
                value={
                  grantReason
                }
                onChange={(
                  event
                ) =>
                  setGrantReason(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Example: goodwill recovery approved by salon manager."
              />
            </label>

            <button
              className="app-button app-button-primary"
              type="submit"
              disabled={
                saving ||
                !canGrantPackage
              }
            >
              <Send
                size={17}
                aria-hidden="true"
              />
              Grant package
            </button>
          </form>

          <div className="package-customer-ledger">
            <h3>
              Selected customer
              ledger
            </h3>
            {!selectedCustomerId ? (
              <p>
                Select a customer to
                review existing package
                entitlements.
              </p>
            ) : customerEntitlements.length ? (
              customerEntitlements.map(
                (
                  entitlement
                ) => (
                  <article
                    key={
                      entitlement._id
                    }
                  >
                    <span>
                      {
                        entitlement
                          ?.servicePackage
                          ?.name
                      }
                    </span>
                    <strong>
                      {remainingTotal(
                        entitlement
                      )}{" "}
                      remaining
                    </strong>
                    <small>
                      {
                        entitlement.source
                      }{" "}
                      ·{" "}
                      {
                        entitlement.status
                      }
                    </small>
                  </article>
                )
              )
            ) : (
              <p>
                No package
                entitlements found.
              </p>
            )}
          </div>
        </section>
      </section>

      <ServicePackageRedemptionPanel
        customerId={
          selectedCustomerId
        }
        entitlements={
          customerEntitlements
        }
        canManage={
          canManageRedemptions
        }
        onChanged={(
          statusMessage
        ) =>
          setMessage(
            statusMessage
          )
        }
      />

      <section className="package-section">
        <div className="package-section-heading">
          <div>
            <span className="commerce-eyebrow">
              Catalogue control
            </span>
            <h2>
              Existing packages
            </h2>
            <p>
              Publication controls
              customer visibility. Active
              controls whether the
              definition can be used for
              new grants or purchases.
            </p>
          </div>
          <button
            type="button"
            className="app-button app-button-secondary"
            onClick={
              loadWorkspace
            }
            disabled={
              loading
            }
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="package-empty">
            Loading package
            definitions…
          </div>
        ) : packages.length ? (
          <div className="package-management-list">
            {packages.map(
              (definition) => (
                <article
                  key={
                    idOf(
                      definition
                    )
                  }
                >
                  <div className="package-management-list-main">
                    <div className="package-card-topline">
                      <span className="package-code">
                        {
                          definition.code
                        }
                      </span>
                      <span
                        className={
                          definition.published
                            ? "package-status"
                            : "package-status package-status-muted"
                        }
                      >
                        {definition.published
                          ? "Published"
                          : "Unpublished"}
                      </span>
                      <span
                        className={
                          definition.active
                            ? "package-status"
                            : "package-status package-status-muted"
                        }
                      >
                        {definition.active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <h3>
                      {
                        definition.name
                      }
                    </h3>

                    <p>
                      {definition.description ||
                        "No customer description."}
                    </p>

                    <div className="package-definition-metrics">
                      <span>
                        <BadgePoundSterling
                          size={16}
                        />
                        {formatCurrency(
                          definition.price
                        )}
                      </span>
                      <span>
                        <ClipboardCheck
                          size={16}
                        />
                        {
                          definition
                            .validityDays
                        }{" "}
                        days
                      </span>
                      <span>
                        <Scissors
                          size={16}
                        />
                        {(
                          definition.includedServices ||
                          []
                        ).reduce(
                          (
                            total,
                            item
                          ) =>
                            total +
                            Number(
                              item.sessions ||
                                0
                            ),
                          0
                        )}{" "}
                        sessions
                      </span>
                    </div>
                  </div>

                  <div className="package-management-actions">
                    <button
                      type="button"
                      className="app-button app-button-secondary"
                      disabled={
                        !canUpdatePackage
                      }
                      onClick={() =>
                        editPackage(
                          definition
                        )
                      }
                    >
                      <Edit3
                        size={16}
                      />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="app-button app-button-secondary"
                      disabled={
                        !canUpdatePackage
                      }
                      onClick={() =>
                        togglePublication(
                          definition
                        )
                      }
                    >
                      {definition.published ? (
                        <CircleOff
                          size={16}
                        />
                      ) : (
                        <CheckCircle2
                          size={16}
                        />
                      )}
                      {definition.published
                        ? "Unpublish"
                        : "Publish"}
                    </button>
                  </div>
                </article>
              )
            )}
          </div>
        ) : (
          <div className="package-empty">
            No service packages have
            been created yet.
          </div>
        )}
      </section>
    </main>
  );
}
