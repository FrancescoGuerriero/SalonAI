import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import consultationService from "../../Services/consultationService.js";
import serviceService from "../../Services/serviceService.js";
import stylistService from "../../Services/stylistService.js";
import useAuth from "../../hooks/useAuth.js";
import { hasPermission } from "../../utils/permissions.js";
import ConsultationModificationForm from "./ConsultationModificationForm.jsx";
import ConsultationReviewWorkspace from "./ConsultationReviewWorkspace.jsx";

const idOf = (value) => String(value?._id ?? value?.id ?? value ?? "");
const EMPTY_BOOKING = {
  serviceId: "",
  stylistId: "",
  appointmentDate: "",
  appointmentTime: "",
  totalPrice: "",
};

function formatStatus(value) {
  return String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "Not supplied";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function statusNeedsReview(status) {
  return ["awaiting_review", "in_person_required"].includes(status);
}

function statusCanAssist(status) {
  return ["draft", "in_progress", "more_information_required", "awaiting_review"].includes(status);
}

function statusCanAssign(status) {
  return [
    "draft",
    "in_progress",
    "awaiting_review",
    "more_information_required",
    "in_person_required",
  ].includes(status);
}

function statusCanApprove(status) {
  return ["awaiting_review", "in_person_required", "approved"].includes(status);
}

function statusCanRecommend(status) {
  return ["awaiting_review", "in_person_required", "approved", "booking_ready"].includes(status);
}

function serviceLabel(service) {
  return service?.name || service?.title || `Service ${idOf(service).slice(-6)}`;
}

function stylistLabel(stylist) {
  return (
    stylist?.name ||
    [stylist?.firstName, stylist?.lastName].filter(Boolean).join(" ") ||
    `Stylist ${idOf(stylist).slice(-6)}`
  );
}

function normaliseStylists(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.stylists)) return value.stylists;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

export default function CanonicalConsultationDesk() {
  const { user } = useAuth();
  const currentUserId = idOf(user);
  const canRead = hasPermission(user, "consultation:read");
  const canReview = hasPermission(user, "consultation:review");
  const canApprove = hasPermission(user, "consultation:approve");
  const canAssign = hasPermission(user, "consultation:assign");
  const canBook = canApprove && hasPermission(user, "appointment:create");
  const canAssist =
    hasPermission(user, "consultation:update") && hasPermission(user, "ai:use");
  const needsServiceOptions = canReview || canBook;

  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [booking, setBooking] = useState(EMPTY_BOOKING);
  const [loading, setLoading] = useState(false);
  const [bookingOptionsLoading, setBookingOptionsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError("");
    try {
      const payload = await consultationService.listConsultations({ limit: 50 });
      const next = Array.isArray(payload?.sessions) ? payload.sessions : [];
      setSessions(next);
      setSelectedId((current) => {
        if (current && next.some((item) => idOf(item) === current)) return current;
        return idOf(next[0]);
      });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "Consultation review work could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!needsServiceOptions) return undefined;
    let active = true;
    serviceService
      .getServices()
      .then((rows) => {
        if (active) setServices(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (active) setServices([]);
      });
    return () => {
      active = false;
    };
  }, [needsServiceOptions]);

  const selected = useMemo(
    () => sessions.find((item) => idOf(item) === selectedId) || null,
    [sessions, selectedId]
  );

  useEffect(() => {
    setBooking({
      ...EMPTY_BOOKING,
      serviceId: idOf(selected?.outcome?.recommendedService),
      stylistId: idOf(selected?.outcome?.recommendedStylist),
    });
  }, [selectedId, selected?.outcome?.recommendedService, selected?.outcome?.recommendedStylist]);

  useEffect(() => {
    if (!needsServiceOptions || !booking.serviceId) {
      setStylists([]);
      return undefined;
    }

    let active = true;
    setBookingOptionsLoading(true);
    stylistService
      .getBookingStylists(booking.serviceId)
      .then((value) => {
        if (!active) return;
        const next = normaliseStylists(value);
        setStylists(next);
        setBooking((current) => ({
          ...current,
          stylistId:
            current.stylistId && next.some((item) => idOf(item) === current.stylistId)
              ? current.stylistId
              : "",
        }));
      })
      .catch(() => {
        if (active) setStylists([]);
      })
      .finally(() => {
        if (active) setBookingOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [booking.serviceId, needsServiceOptions]);

  const run = useCallback(
    async (actionId, action, successMessage) => {
      setBusyAction(actionId);
      setError("");
      setNotice("");
      try {
        const updated = await action();
        setNotice(successMessage);
        if (updated) {
          const updatedId = idOf(updated);
          setSessions((current) =>
            current.map((item) => (idOf(item) === updatedId ? updated : item))
          );
          setSelectedId(updatedId);
        } else {
          await load();
        }
      } catch (requestError) {
        setError(
          requestError?.response?.data?.message ||
            "The consultation action could not be completed."
        );
      } finally {
        setBusyAction("");
      }
    },
    [load]
  );

  async function submitRecommendation(event) {
    event.preventDefault();
    if (!selected || !canReview) return;

    await run(
      "recommendation",
      () =>
        consultationService.setConsultationRecommendation(idOf(selected), {
          recommendedServiceId: booking.serviceId,
          recommendedStylistId: booking.stylistId,
        }),
      "Consultation recommendation saved."
    );
  }

  async function submitBooking(event) {
    event.preventDefault();
    if (!selected || !canBook) return;

    await run(
      "book",
      async () => {
        const result = await consultationService.bookConsultation(idOf(selected), {
          serviceId: booking.serviceId,
          stylistId: booking.stylistId,
          appointmentDate: booking.appointmentDate,
          appointmentTime: booking.appointmentTime,
          ...(booking.totalPrice !== ""
            ? { totalPrice: Number(booking.totalPrice) }
            : {}),
        });
        return result?.consultation;
      },
      "Appointment created from the approved consultation."
    );
  }

  if (!canRead) {
    return null;
  }

  const summaryItems = selected
    ? [
        { label: "Status", value: formatStatus(selected.status) },
        { label: "Consultation type", value: formatStatus(selected.consultationType) },
        { label: "Channel", value: formatStatus(selected.channel) },
        {
          label: "Human review",
          value: selected.review?.decision
            ? formatStatus(selected.review.decision)
            : idOf(selected.review?.reviewer) === currentUserId && currentUserId
              ? "Assigned to you"
              : selected.review?.reviewer
                ? "Assigned"
                : "Not decided",
        },
        {
          label: "Booking readiness",
          value: selected.outcome?.bookingConverted
            ? "Converted to appointment"
            : selected.deterministicAssessment?.bookingBlocked
              ? "Blocked by deterministic rules"
              : "No deterministic booking block",
        },
      ]
    : [];

  const structuredAnswers = selected
    ? [
        ...Object.entries(selected.structuredFeatures || {}).map(([key, value]) => ({
          id: `feature-${key}`,
          label: formatStatus(key),
          value: formatValue(value),
        })),
        ...(selected.responses || []).map((response, index) => ({
          id: response?._id || `response-${index}`,
          label: formatStatus(response?.key || `Answer ${index + 1}`),
          value: formatValue(response?.value),
        })),
      ]
    : [];

  const recommendation = selected?.ai?.recommendation
    ? {
        title:
          selected.ai.recommendation?.title ||
          selected.ai.recommendation?.summary ||
          selected.ai.recommendation?.serviceName ||
          "AI-assisted consultation recommendation",
        rationale: Array.isArray(selected.ai.rationale)
          ? selected.ai.rationale.join(" ")
          : "",
        confidenceLabel:
          typeof selected.ai.confidence === "number"
            ? `${Math.round(selected.ai.confidence * 100)}% confidence`
            : "",
      }
    : null;

  const actions = [];
  if (
    selected &&
    canAssign &&
    currentUserId &&
    statusCanAssign(selected.status) &&
    idOf(selected.review?.reviewer) !== currentUserId
  ) {
    const isReassignment = Boolean(selected.review?.reviewer);
    actions.push({
      id: "assign-reviewer",
      label: isReassignment ? "Reassign to me" : "Assign to me",
      onRequest: () =>
        run(
          "assign-reviewer",
          () =>
            consultationService.assignConsultationReviewer(
              idOf(selected),
              currentUserId
            ),
          isReassignment
            ? "Consultation reassigned to you."
            : "Consultation assigned to you."
        ),
    });
  }

  if (
    selected &&
    canAssist &&
    statusCanAssist(selected.status) &&
    !selected.review?.decision
  ) {
    actions.push({
      id: "assist",
      label: selected.ai?.state === "completed" ? "Refresh AI assistance" : "Run AI assistance",
      onRequest: () =>
        run(
          "assist",
          () => consultationService.requestConsultationAssistance(idOf(selected)),
          "AI assistance updated for human review."
        ),
    });
  }

  if (selected && canReview && statusNeedsReview(selected.status)) {
    actions.push(
      {
        id: "review-approved",
        label: "Approve review",
        variant: "primary",
        onRequest: () =>
          run(
            "review-approved",
            () =>
              consultationService.reviewConsultation(idOf(selected), {
                decision: "approved",
              }),
            "Human review approved."
          ),
      },
      {
        id: "more-information",
        label: "Ask another question",
        onRequest: () =>
          run(
            "more-information",
            () =>
              consultationService.reviewConsultation(idOf(selected), {
                decision: "more_information_required",
              }),
            "Consultation returned for more information."
          ),
      },
      {
        id: "in-person",
        label: "Require in-person consultation",
        onRequest: () =>
          run(
            "in-person",
            () =>
              consultationService.reviewConsultation(idOf(selected), {
                decision: "in_person_required",
              }),
            "In-person consultation required."
          ),
      }
    );
  }

  if (
    selected &&
    canApprove &&
    statusCanApprove(selected.status) &&
    selected.deterministicAssessment?.bookingBlocked !== true
  ) {
    actions.push({
      id: "booking-ready",
      label: "Approve for booking",
      variant: "primary",
      onRequest: () =>
        run(
          "booking-ready",
          () => consultationService.approveConsultation(idOf(selected)),
          "Consultation approved for booking."
        ),
    });
  }

  const selectedService = services.find((item) => idOf(item) === booking.serviceId) || null;
  const showRecommendationForm =
    selected &&
    canReview &&
    statusCanRecommend(selected.status) &&
    !selected.outcome?.bookingConverted;
  const showModificationForm = selected && canReview && statusNeedsReview(selected.status);
  const showBookingForm = selected?.status === "booking_ready" && !selected?.outcome?.bookingConverted;

  return (
    <section className="experience-management-panel" aria-busy={loading || Boolean(busyAction)}>
      <header>
        <div>
          <h2>Canonical consultation review</h2>
          <p>
            Review tenant-scoped consultation evidence, deterministic safety rules and AI assistance before booking decisions.
          </p>
        </div>
        <b>{sessions.length}</b>
      </header>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="min-w-0 flex-1 text-sm font-bold text-stone-700">
          Consultation
          <select
            className="mt-1 w-full"
            value={selectedId}
            disabled={loading || Boolean(busyAction) || sessions.length === 0}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {sessions.length === 0 ? <option value="">No consultations</option> : null}
            {sessions.map((session) => (
              <option key={idOf(session)} value={idOf(session)}>
                {formatStatus(session.status)} · {formatStatus(session.consultationType)} · {idOf(session).slice(-6)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="app-button app-button-secondary"
          onClick={load}
          disabled={loading || Boolean(busyAction)}
        >
          <RefreshCw size={17} />
          Refresh consultations
        </button>
      </div>

      {error ? (
        <div className="experience-message is-error mt-4" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="experience-message is-success mt-4" role="status">
          {notice}
        </div>
      ) : null}

      {selected ? (
        <div className="mt-5">
          <ConsultationReviewWorkspace
            title={`${formatStatus(selected.consultationType)} consultation`}
            customerLabel={`Customer ${idOf(selected.customer).slice(-6) || "record"}`}
            channelLabel={formatStatus(selected.channel)}
            statusLabel={formatStatus(selected.status)}
            summaryItems={summaryItems}
            answers={structuredAnswers}
            recommendation={recommendation}
            flags={selected.deterministicAssessment?.flags || []}
            actions={actions}
            busyAction={busyAction}
          />

          {showModificationForm ? (
            <ConsultationModificationForm
              consultation={selected}
              busy={Boolean(busyAction)}
              onSubmit={(correction) =>
                run(
                  "review-modified",
                  () =>
                    consultationService.reviewConsultation(idOf(selected), {
                      decision: "modified",
                      notes: "Approved with a documented reviewer correction.",
                      corrections: [correction],
                    }),
                  "Human review approved with a documented modification."
                )
              }
            />
          ) : null}

          {showRecommendationForm ? (
            <form
              className="mt-5 grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 md:grid-cols-2"
              onSubmit={submitRecommendation}
            >
              <div className="md:col-span-2">
                <h3 className="text-base font-bold text-stone-900">Human recommendation</h3>
                <p className="mt-1 text-sm text-stone-600">
                  Record the service and optional stylist recommended by the authorised reviewer. These fields remain separate from AI advice and are used later to compare the recommendation with the actual booking outcome.
                </p>
              </div>
              <label className="text-sm font-bold text-stone-700">
                Recommended service
                <select
                  className="mt-1 w-full"
                  required
                  value={booking.serviceId}
                  disabled={Boolean(busyAction)}
                  onChange={(event) =>
                    setBooking((current) => ({
                      ...current,
                      serviceId: event.target.value,
                      stylistId: "",
                      totalPrice: "",
                    }))
                  }
                >
                  <option value="">Choose a service</option>
                  {services
                    .filter((service) => service.active !== false)
                    .map((service) => (
                      <option key={idOf(service)} value={idOf(service)}>
                        {serviceLabel(service)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm font-bold text-stone-700">
                Recommended stylist
                <select
                  className="mt-1 w-full"
                  value={booking.stylistId}
                  disabled={!booking.serviceId || bookingOptionsLoading || Boolean(busyAction)}
                  onChange={(event) =>
                    setBooking((current) => ({ ...current, stylistId: event.target.value }))
                  }
                >
                  <option value="">
                    {bookingOptionsLoading ? "Loading stylists…" : "No specific stylist"}
                  </option>
                  {stylists.map((stylist) => (
                    <option key={idOf(stylist)} value={idOf(stylist)}>
                      {stylistLabel(stylist)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="app-button app-button-secondary"
                  disabled={Boolean(busyAction) || bookingOptionsLoading || !booking.serviceId}
                >
                  Save recommendation
                </button>
              </div>
            </form>
          ) : null}

          {showBookingForm ? (
            canBook ? (
              <form
                className="mt-5 grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 md:grid-cols-2"
                onSubmit={submitBooking}
              >
                <div className="md:col-span-2">
                  <h3 className="text-base font-bold text-stone-900">Create appointment</h3>
                  <p className="mt-1 text-sm text-stone-600">
                    This writes through the canonical appointment service and records the resulting appointment on the consultation.
                  </p>
                </div>
                <label className="text-sm font-bold text-stone-700">
                  Service
                  <select
                    className="mt-1 w-full"
                    required
                    value={booking.serviceId}
                    disabled={Boolean(busyAction)}
                    onChange={(event) =>
                      setBooking((current) => ({
                        ...current,
                        serviceId: event.target.value,
                        stylistId: "",
                        totalPrice: "",
                      }))
                    }
                  >
                    <option value="">Choose a service</option>
                    {services
                      .filter((service) => service.active !== false)
                      .map((service) => (
                        <option key={idOf(service)} value={idOf(service)}>
                          {serviceLabel(service)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm font-bold text-stone-700">
                  Stylist
                  <select
                    className="mt-1 w-full"
                    required
                    value={booking.stylistId}
                    disabled={!booking.serviceId || bookingOptionsLoading || Boolean(busyAction)}
                    onChange={(event) =>
                      setBooking((current) => ({ ...current, stylistId: event.target.value }))
                    }
                  >
                    <option value="">
                      {bookingOptionsLoading ? "Loading stylists…" : "Choose a stylist"}
                    </option>
                    {stylists.map((stylist) => (
                      <option key={idOf(stylist)} value={idOf(stylist)}>
                        {stylistLabel(stylist)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-bold text-stone-700">
                  Date
                  <input
                    className="mt-1 w-full"
                    type="date"
                    required
                    value={booking.appointmentDate}
                    disabled={Boolean(busyAction)}
                    onChange={(event) =>
                      setBooking((current) => ({
                        ...current,
                        appointmentDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="text-sm font-bold text-stone-700">
                  Time
                  <input
                    className="mt-1 w-full"
                    type="time"
                    required
                    value={booking.appointmentTime}
                    disabled={Boolean(busyAction)}
                    onChange={(event) =>
                      setBooking((current) => ({
                        ...current,
                        appointmentTime: event.target.value,
                      }))
                    }
                  />
                </label>
                {selectedService?.priceOnConsultation === true ? (
                  <label className="text-sm font-bold text-stone-700 md:col-span-2">
                    Agreed total price
                    <input
                      className="mt-1 w-full"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={booking.totalPrice}
                      disabled={Boolean(busyAction)}
                      onChange={(event) =>
                        setBooking((current) => ({
                          ...current,
                          totalPrice: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    className="app-button app-button-primary"
                    disabled={Boolean(busyAction) || bookingOptionsLoading}
                  >
                    Create appointment
                  </button>
                </div>
              </form>
            ) : (
              <div className="experience-message mt-4" role="status">
                Appointment creation permission is required to convert this approved consultation into a booking.
              </div>
            )
          ) : null}
        </div>
      ) : (
        <div className="experience-empty mt-4">
          <p>No canonical consultation sessions are currently visible in your authorised scope.</p>
        </div>
      )}
    </section>
  );
}
