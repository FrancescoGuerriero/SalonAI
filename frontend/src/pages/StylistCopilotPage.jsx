import { useState } from "react";

import { getAiStylistCopilot } from "../Services/aiStylistCopilotService.js";

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function List({ items = [] }) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">No items available.</p>;
  }
  return (
    <ul className="space-y-2 text-sm text-slate-700">
      {items.map((item, index) => (
        <li key={`${index}-${String(item?.title || item).slice(0, 24)}`} className="rounded-lg bg-slate-50 px-3 py-2">
          {typeof item === "string" ? (
            item
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-slate-900">{item.title || item.category || "Recommendation"}</p>
              {item.rationale ? <p>{item.rationale}</p> : null}
              {item.requiresProfessionalReview ? (
                <p className="text-xs font-medium text-amber-700">Professional review required</p>
              ) : null}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function StylistCopilotPage() {
  const [appointmentId, setAppointmentId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadBrief(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await getAiStylistCopilot(appointmentId);
      setData(response);
    } catch (requestError) {
      setData(null);
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to load Stylist Copilot."
      );
    } finally {
      setLoading(false);
    }
  }

  const brief = data?.brief || null;
  const recommendations = brief?.recommendations || [];
  const safety = brief?.safetyBoundary || {};

  function recommendationsFor(category) {
    return recommendations.filter((item) => item?.category === category);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">AI decision support</p>
        <h1 className="text-3xl font-semibold text-slate-950">Stylist Copilot</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Review appointment, consultation and authorised customer history before a service. Copilot is advisory only; the stylist remains responsible for professional and safety decisions.
        </p>
      </header>

      <form onSubmit={loadBrief} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium text-slate-700">
          Appointment ID
          <input
            value={appointmentId}
            onChange={(event) => setAppointmentId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Paste the canonical appointment ID"
            required
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {loading ? "Preparing brief…" : "Prepare stylist brief"}
        </button>
      </form>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {brief ? (
        <>
          {brief.attentionFlags?.length ? (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <List items={brief.attentionFlags} />
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="Pre-appointment brief">
              <List items={brief.preAppointmentBrief || []} />
            </Section>
            <Section title="Consultation context">
              <List items={brief.consultationSummary || []} />
            </Section>
            <Section title="Visit history">
              <List items={brief.historySummary || []} />
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Consultation prompts">
              <List items={recommendationsFor("consultation")} />
            </Section>
            <Section title="Service context">
              <List items={recommendationsFor("service")} />
            </Section>
            <Section title="Product & aftercare context">
              <List items={[
                ...recommendationsFor("product"),
                ...recommendationsFor("aftercare"),
              ]} />
            </Section>
            <Section title="Follow-up & rebooking">
              <List items={recommendationsFor("follow-up")} />
            </Section>
          </div>

          <Section title="Safety and governance">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="font-medium text-slate-600">Human review</dt><dd>{safety.humanReviewRequired ? "Required" : "Not indicated"}</dd></div>
              <div><dt className="font-medium text-slate-600">Canonical writes</dt><dd>{safety.canonicalWritesPerformed ? "Performed" : "None"}</dd></div>
              <div><dt className="font-medium text-slate-600">Safety override</dt><dd>{safety.safetyOverridePerformed ? "Performed" : "None"}</dd></div>
              <div><dt className="font-medium text-slate-600">Inference ID</dt><dd className="break-all">{data.inferenceId || "Unavailable"}</dd></div>
            </dl>
          </Section>
        </>
      ) : null}
    </main>
  );
}
