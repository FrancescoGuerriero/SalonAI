import { CheckCircle2, Loader2, RotateCcw, ToggleLeft, ToggleRight } from "lucide-react";
import { useEffect, useState } from "react";

import {
  createRetentionJourney,
  listRetentionJourneys,
  updateRetentionJourney,
} from "../../Services/retentionAutomationService.js";

const TEMPLATES = [
  {
    trigger: "membership_payment_failed",
    name: "Membership payment recovery",
    description:
      "Governed retention journey for customers whose recurring membership collection has failed. Financial retries remain owned by Stage 3.",
    body:
      "Hi {{customer.firstName}}, there is an issue with your membership payment. Please review your account or contact the salon if you need help.",
    stopIf: "membership_payment_recovered",
  },
  {
    trigger: "membership_payment_recovered",
    name: "Membership payment recovered",
    description:
      "Confirmation journey generated from canonical membership recovery evidence after a successful collection.",
    body:
      "Hi {{customer.firstName}}, your membership payment is back up to date. Thank you.",
    stopIf: "none",
  },
];

function message(error) {
  return error?.response?.data?.message || error?.message || "Recovery journey setup failed.";
}

export default function Stage7RecoveryJourneySetup() {
  const [journeys, setJourneys] = useState([]);
  const [workingTrigger, setWorkingTrigger] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    try {
      const result = await listRetentionJourneys();
      setJourneys(result.journeys || []);
    } catch (requestError) {
      setError(message(requestError));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function findJourney(trigger) {
    return journeys.find((journey) => journey.trigger === trigger) || null;
  }

  async function createTemplate(template) {
    setWorkingTrigger(template.trigger);
    setError("");
    setSuccess("");
    try {
      await createRetentionJourney({
        name: template.name,
        description: template.description,
        trigger: template.trigger,
        conditions: {},
        steps: [
          {
            delayMinutes: 0,
            channel: "email",
            subject: template.name,
            body: template.body,
            stopIf: template.stopIf,
          },
        ],
      });
      setSuccess(`${template.name} created in paused state.`);
      await load();
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setWorkingTrigger("");
    }
  }

  async function toggleJourney(journey) {
    setWorkingTrigger(journey.trigger);
    setError("");
    setSuccess("");
    try {
      await updateRetentionJourney(journey._id, { enabled: journey.enabled !== true });
      setSuccess(
        journey.enabled
          ? "Membership recovery definition paused."
          : "Membership recovery definition enabled. Live sending remains disabled by the Stage 7 execution gate."
      );
      await load();
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setWorkingTrigger("");
    }
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
      <div className="flex items-start gap-3">
        <RotateCcw size={20} className="mt-0.5 shrink-0 text-indigo-700" />
        <div>
          <h2 className="font-bold text-slate-900">Recurring-membership recovery journeys</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Create and govern the two Stage 7 definitions consumed by the canonical membership-recovery bridge. Enabling a definition permits enrolment evidence only; message execution remains unauthorised.
          </p>
        </div>
      </div>

      {error ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      {success ? <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={16} />{success}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {TEMPLATES.map((template) => {
          const journey = findJourney(template.trigger);
          const working = workingTrigger === template.trigger;
          return (
            <article key={template.trigger} className="rounded-xl border border-indigo-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{template.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{template.trigger}</p>
                </div>
                <span className={journey?.enabled ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600"}>
                  {journey ? (journey.enabled ? "Enabled" : "Paused") : "Missing"}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">{template.description}</p>
              <div className="mt-4">
                {journey ? (
                  <button
                    type="button"
                    onClick={() => void toggleJourney(journey)}
                    disabled={working}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 disabled:opacity-50"
                  >
                    {working ? <Loader2 size={14} className="animate-spin" /> : journey.enabled ? <ToggleLeft size={15} /> : <ToggleRight size={15} />}
                    {journey.enabled ? "Pause definition" : "Enable definition"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void createTemplate(template)}
                    disabled={working}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {working ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    Create paused definition
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
