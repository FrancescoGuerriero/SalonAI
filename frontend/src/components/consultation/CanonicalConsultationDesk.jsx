import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import consultationService from "../../Services/consultationService.js";
import useAuth from "../../hooks/useAuth.js";
import { hasPermission } from "../../utils/permissions.js";
import ConsultationReviewWorkspace from "./ConsultationReviewWorkspace.jsx";

const idOf = (value) => String(value?._id ?? value?.id ?? value ?? "");

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

function statusCanApprove(status) {
  return ["awaiting_review", "in_person_required", "approved"].includes(status);
}

export default function CanonicalConsultationDesk() {
  const { user } = useAuth();
  const canRead = hasPermission(user, "consultation:read");
  const canReview = hasPermission(user, "consultation:review");
  const canApprove = hasPermission(user, "consultation:approve");
  const canAssist =
    hasPermission(user, "consultation:update") && hasPermission(user, "ai:use");

  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
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

  const selected = useMemo(
    () => sessions.find((item) => idOf(item) === selectedId) || null,
    [sessions, selectedId]
  );

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
            : selected.review?.reviewer
              ? "Assigned"
              : "Not decided",
        },
        {
          label: "Booking readiness",
          value: selected.deterministicAssessment?.bookingBlocked
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
        </div>
      ) : (
        <div className="experience-empty mt-4">
          <p>No canonical consultation sessions are currently visible in your authorised scope.</p>
        </div>
      )}
    </section>
  );
}
