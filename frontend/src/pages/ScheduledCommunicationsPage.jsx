import { useEffect, useState } from "react";
import {
  Clock3,
  Play,
  Ban,
  RefreshCcw,
} from "lucide-react";

import FeaturePageShell from "../components/features/FeaturePageShell.jsx";
import FeedbackBanner from "../components/features/FeedbackBanner.jsx";
import LoadingBlock from "../components/features/LoadingBlock.jsx";
import StatusBadge from "../components/features/StatusBadge.jsx";
import {
  schedulerApi,
} from "../services/futureFeaturesApi.js";

function customerName(customer = {}) {
  return (
    customer.fullName ||
    customer.name ||
    [customer.firstName, customer.lastName]
      .filter(Boolean)
      .join(" ") ||
    "Customer"
  );
}

export default function ScheduledCommunicationsPage() {
  const [jobs, setJobs] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    try {
      setLoading(true);
      const response = await schedulerApi.list({
        status: status || undefined,
      });
      setJobs(response.items || []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError.message
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  async function processNow() {
    try {
      setWorkingId("process");
      const response =
        await schedulerApi.process(50);
      setSuccess(
        `Processed ${
          response.items?.length || 0
        } communication job(s).`
      );
      await load();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError.message
      );
    } finally {
      setWorkingId("");
    }
  }

  async function cancel(job) {
    try {
      setWorkingId(job._id);
      await schedulerApi.cancel(job._id);
      setSuccess("Scheduled communication cancelled.");
      await load();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError.message
      );
    } finally {
      setWorkingId("");
    }
  }

  return (
    <FeaturePageShell
      title="Scheduled Communications"
      description="Review queued messages, process the scheduler and cancel pending communications."
      icon={Clock3}
      actions={
        <>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 font-semibold"
          >
            <RefreshCcw size={18} />
            Refresh
          </button>
          <button
            type="button"
            onClick={processNow}
            disabled={workingId === "process"}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            <Play size={18} />
            Process now
          </button>
        </>
      }
    >
      <FeedbackBanner type="error">
        {error}
      </FeedbackBanner>
      <FeedbackBanner type="success">
        {success}
      </FeedbackBanner>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
          className="rounded-lg border border-gray-300 px-3 py-2.5"
        >
          <option value="">All statuses</option>
          {[
            "queued",
            "processing",
            "sent",
            "delivered",
            "opened",
            "responded",
            "failed",
            "cancelled",
          ].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </section>

      {loading ? (
        <LoadingBlock rows={6} />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Scheduled",
                    "Customer",
                    "Channel",
                    "Campaign",
                    "Status",
                    "Attempts",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job._id}>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      {new Date(
                        job.scheduledFor
                      ).toLocaleString("en-GB")}
                    </td>
                    <td className="px-4 py-4">
                      {customerName(job.customer)}
                    </td>
                    <td className="px-4 py-4 capitalize">
                      {job.channel}
                    </td>
                    <td className="px-4 py-4">
                      {job.campaign?.name ||
                        job.communicationType.replaceAll(
                          "_",
                          " "
                        )}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge
                        status={job.status}
                      />
                    </td>
                    <td className="px-4 py-4">
                      {job.attempts || 0}
                    </td>
                    <td className="px-4 py-4">
                      {[
                        "queued",
                        "processing",
                      ].includes(job.status) ? (
                        <button
                          type="button"
                          onClick={() => cancel(job)}
                          disabled={
                            workingId === job._id
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                        >
                          <Ban size={15} />
                          Cancel
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </FeaturePageShell>
  );
}
