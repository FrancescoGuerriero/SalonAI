import {
  CheckCircle2,
  RotateCcw,
  Scissors,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import appointmentManagementApi from "../Services/appointmentManagementApi.js";
import servicePackageService from "../Services/servicePackageService.js";

function idOf(value) {
  return String(
    value?._id ||
      value?.id ||
      value ||
      ""
  ).trim();
}

function dateInput(
  date
) {
  return new Date(date)
    .toISOString()
    .slice(0, 10);
}

function appointmentLabel(
  appointment
) {
  const service =
    appointment?.service?.name ||
    "Service";
  const date =
    appointment?.appointmentDate
      ? new Date(
          appointment.appointmentDate
        ).toLocaleDateString(
          "en-GB"
        )
      : "";
  const time =
    appointment?.appointmentTime ||
    "";
  return [service, date, time]
    .filter(Boolean)
    .join(" · ");
}

function remainingServiceIds(
  entitlement
) {
  return new Set(
    (
      entitlement?.credits || []
    )
      .filter(
        (credit) =>
          Number(
            credit?.remaining || 0
          ) > 0
      )
      .map((credit) =>
        idOf(
          credit?.service
        )
      )
      .filter(Boolean)
  );
}

export default function ServicePackageRedemptionPanel({
  customerId,
  entitlements = [],
  canManage = false,
  onChanged = () => {},
}) {
  const [
    entitlementId,
    setEntitlementId,
  ] = useState("");
  const [
    appointmentId,
    setAppointmentId,
  ] = useState("");
  const [
    appointments,
    setAppointments,
  ] = useState([]);
  const [
    redemptions,
    setRedemptions,
  ] = useState([]);
  const [
    reversalReasons,
    setReversalReasons,
  ] = useState({});
  const [
    loading,
    setLoading,
  ] = useState(false);
  const [
    busy,
    setBusy,
  ] = useState(false);
  const [
    message,
    setMessage,
  ] = useState("");
  const [
    error,
    setError,
  ] = useState("");

  const selectedEntitlement =
    useMemo(
      () =>
        entitlements.find(
          (item) =>
            idOf(item) ===
            entitlementId
        ) || null,
      [
        entitlements,
        entitlementId,
      ]
    );

  const eligibleAppointments =
    useMemo(() => {
      const serviceIds =
        remainingServiceIds(
          selectedEntitlement
        );
      const activeRedemptionAppointments =
        new Set(
          redemptions
            .filter(
              (item) =>
                item?.status ===
                "active"
            )
            .map((item) =>
              idOf(
                item?.appointment
              )
            )
        );

      return appointments.filter(
        (appointment) =>
          serviceIds.has(
            idOf(
              appointment?.service
            )
          ) &&
          ![
            "cancelled",
            "no_show",
          ].includes(
            String(
              appointment?.status ||
                ""
            )
          ) &&
          !activeRedemptionAppointments.has(
            idOf(appointment)
          )
      );
    }, [
      appointments,
      redemptions,
      selectedEntitlement,
    ]);

  useEffect(() => {
    setEntitlementId("");
    setAppointmentId("");
    setRedemptions([]);
    setMessage("");
    setError("");
  }, [customerId]);

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      if (
        !customerId ||
        !canManage
      ) {
        setAppointments([]);
        return;
      }

      const today = new Date();
      const start = new Date(today);
      start.setDate(
        start.getDate() - 30
      );
      const end = new Date(today);
      end.setDate(
        end.getDate() + 180
      );

      try {
        const response =
          await appointmentManagementApi
            .getCalendar({
              customer:
                customerId,
              startDate:
                dateInput(start),
              endDate:
                dateInput(end),
              limit: 500,
            });

        if (active) {
          setAppointments(
            Array.isArray(
              response?.items
            )
              ? response.items
              : []
          );
        }
      } catch (requestError) {
        if (active) {
          setAppointments([]);
          setError(
            requestError?.response
              ?.data?.message ||
              "Customer appointments could not be loaded for package redemption."
          );
        }
      }
    }

    loadAppointments();

    return () => {
      active = false;
    };
  }, [
    customerId,
    canManage,
  ]);

  useEffect(() => {
    let active = true;

    async function loadRedemptions() {
      if (!entitlementId) {
        setRedemptions([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response =
          await servicePackageService
            .listRedemptions(
              entitlementId
            );

        if (active) {
          setRedemptions(
            Array.isArray(
              response?.items
            )
              ? response.items
              : []
          );
        }
      } catch (requestError) {
        if (active) {
          setRedemptions([]);
          setError(
            requestError?.response
              ?.data?.message ||
              "Package redemption history could not be loaded."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRedemptions();

    return () => {
      active = false;
    };
  }, [
    entitlementId,
  ]);

  async function refreshRedemptions() {
    if (!entitlementId) {
      return;
    }

    const response =
      await servicePackageService
        .listRedemptions(
          entitlementId
        );
    setRedemptions(
      Array.isArray(
        response?.items
      )
        ? response.items
        : []
    );
  }

  async function redeem(
    event
  ) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      if (
        !canManage ||
        !entitlementId ||
        !appointmentId
      ) {
        throw new Error(
          "Choose an entitlement and an eligible appointment."
        );
      }

      await servicePackageService
        .redeem(
          entitlementId,
          {
            appointment:
              appointmentId,
          }
        );

      setAppointmentId("");
      await refreshRedemptions();
      setMessage(
        "Package session redeemed against the appointment."
      );
      onChanged(
        "Package session redeemed against the appointment."
      );
    } catch (requestError) {
      setError(
        requestError?.response
          ?.data?.message ||
          requestError?.message ||
          "The package session could not be redeemed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function reverse(
    redemption
  ) {
    const redemptionId =
      idOf(redemption);
    const reason =
      String(
        reversalReasons[
          redemptionId
        ] || ""
      ).trim();

    setBusy(true);
    setMessage("");
    setError("");

    try {
      if (!reason) {
        throw new Error(
          "Enter a reversal reason before restoring the package credit."
        );
      }

      await servicePackageService
        .reverse(
          redemptionId,
          {
            reason,
          }
        );

      setReversalReasons(
        (current) => ({
          ...current,
          [redemptionId]: "",
        })
      );
      await refreshRedemptions();
      setMessage(
        "Redemption reversed and the package credit restored."
      );
      onChanged(
        "Redemption reversed and the package credit restored."
      );
    } catch (requestError) {
      setError(
        requestError?.response
          ?.data?.message ||
          requestError?.message ||
          "The redemption could not be reversed."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!customerId) {
    return (
      <section className="package-editor-card">
        <h2>Redeem package credits</h2>
        <p>
          Select a customer above to
          redeem or reverse package
          sessions.
        </p>
      </section>
    );
  }

  return (
    <section className="package-editor-card">
      <div className="package-section-heading">
        <div>
          <span className="commerce-eyebrow">
            Appointment settlement
          </span>
          <h2>
            Redeem package credits
          </h2>
          <p>
            Apply an available package
            session to an existing
            appointment. Reversals restore
            only the credit consumed by
            that redemption.
          </p>
          {!canManage ? (
            <p className="package-permission-note">
              Appointment update permission
              is required to redeem or
              reverse package sessions.
            </p>
          ) : null}
        </div>
        <Scissors
          size={28}
          aria-hidden="true"
        />
      </div>

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

      <form
        className="package-grant-form"
        onSubmit={redeem}
      >
        <label>
          Customer entitlement
          <select
            value={entitlementId}
            disabled={!canManage}
            required
            onChange={(event) => {
              setEntitlementId(
                event.target.value
              );
              setAppointmentId("");
            }}
          >
            <option value="">
              Select entitlement
            </option>
            {entitlements
              .filter(
                (item) =>
                  item?.status ===
                    "active" &&
                  remainingServiceIds(
                    item
                  ).size > 0
              )
              .map((item) => (
                <option
                  key={idOf(item)}
                  value={idOf(item)}
                >
                  {item
                    ?.servicePackage
                    ?.name ||
                    "Service package"}{" "}
                  ·{" "}
                  {Array.from(
                    remainingServiceIds(
                      item
                    )
                  ).length}{" "}
                  service type(s)
                </option>
              ))}
          </select>
        </label>

        <label>
          Eligible appointment
          <select
            value={appointmentId}
            disabled={
              !canManage ||
              !entitlementId
            }
            required
            onChange={(event) =>
              setAppointmentId(
                event.target.value
              )
            }
          >
            <option value="">
              Select appointment
            </option>
            {eligibleAppointments.map(
              (appointment) => (
                <option
                  key={idOf(
                    appointment
                  )}
                  value={idOf(
                    appointment
                  )}
                >
                  {appointmentLabel(
                    appointment
                  )}
                </option>
              )
            )}
          </select>
        </label>

        {entitlementId &&
        !loading &&
        eligibleAppointments.length ===
          0 ? (
          <p className="package-permission-note">
            No unredeemed matching
            appointments were found in the
            current 30-day history /
            180-day forward window.
          </p>
        ) : null}

        <button
          className="app-button app-button-primary"
          type="submit"
          disabled={
            busy ||
            !canManage ||
            !entitlementId ||
            !appointmentId
          }
        >
          <CheckCircle2
            size={17}
            aria-hidden="true"
          />
          {busy
            ? "Applying…"
            : "Redeem session"}
        </button>
      </form>

      <div className="package-customer-ledger">
        <h3>
          Redemption ledger
        </h3>
        {!entitlementId ? (
          <p>
            Select an entitlement to view
            its redemption history.
          </p>
        ) : loading ? (
          <p>
            Loading redemption history…
          </p>
        ) : redemptions.length ? (
          redemptions.map(
            (redemption) => {
              const redemptionId =
                idOf(redemption);
              const active =
                redemption?.status ===
                "active";

              return (
                <article
                  key={redemptionId}
                >
                  <span>
                    {redemption
                      ?.service?.name ||
                      "Service"}{" "}
                    ·{" "}
                    {appointmentLabel(
                      redemption?.appointment
                    )}
                  </span>
                  <strong>
                    {redemption.status}
                  </strong>
                  {active &&
                  canManage ? (
                    <>
                      <label>
                        Reversal reason
                        <input
                          maxLength="500"
                          value={
                            reversalReasons[
                              redemptionId
                            ] || ""
                          }
                          onChange={(
                            event
                          ) =>
                            setReversalReasons(
                              (
                                current
                              ) => ({
                                ...current,
                                [redemptionId]:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                          placeholder="Why is this credit being restored?"
                        />
                      </label>
                      <button
                        type="button"
                        className="app-button app-button-secondary"
                        disabled={busy}
                        onClick={() =>
                          reverse(
                            redemption
                          )
                        }
                      >
                        <RotateCcw
                          size={16}
                          aria-hidden="true"
                        />
                        Reverse
                      </button>
                    </>
                  ) : null}
                  {redemption
                    ?.reversalReason ? (
                    <small>
                      Reversal:{" "}
                      {
                        redemption.reversalReason
                      }
                    </small>
                  ) : null}
                </article>
              );
            }
          )
        ) : (
          <p>
            No redemptions recorded for
            this entitlement.
          </p>
        )}
      </div>
    </section>
  );
}
