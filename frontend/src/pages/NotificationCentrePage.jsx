import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Filter,
  RefreshCw,
  Search,
  Send,
  TriangleAlert,
} from "lucide-react";

import { getPremiumFeatureData } from "../services/premiumFeaturesService.js";
import NotificationRecordCard from "../components/notifications/NotificationRecordCard.jsx";
import NotificationSummaryCard from "../components/notifications/NotificationSummaryCard.jsx";

function unwrapNotifications(result) {
  if (Array.isArray(result?.notifications)) return result.notifications;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.results)) return result.results;
  return Array.isArray(result) ? result : [];
}

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

export default function NotificationCentrePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");

  async function load({ refresh = false } = {}) {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const result = await getPremiumFeatureData("/notifications");
      setRecords(unwrapNotifications(result));
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to load notifications."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const channels = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((record) => normalise(record?.channel))
            .filter(Boolean)
        )
      ).sort(),
    [records]
  );

  const statuses = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((record) => normalise(record?.status))
            .filter(Boolean)
        )
      ).sort(),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const query = normalise(search);

    return records.filter((record) => {
      const recordChannel = normalise(record?.channel);
      const recordStatus = normalise(record?.status);
      const haystack = [
        record?.name,
        record?.title,
        record?.recipient,
        record?.audience,
        record?.description,
        record?.code,
      ]
        .map(normalise)
        .join(" ");

      const matchesSearch = !query || haystack.includes(query);
      const matchesChannel =
        channel === "all" || recordChannel === channel;
      const matchesStatus =
        status === "all" || recordStatus === status;

      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [records, search, channel, status]);

  const delivered = records.filter((record) =>
    ["sent", "delivered", "complete", "completed"].includes(
      normalise(record?.status)
    )
  ).length;

  const failed = records.filter((record) =>
    ["failed", "error", "rejected"].includes(normalise(record?.status))
  ).length;

  const pending = records.filter((record) =>
    ["queued", "pending", "scheduled", "draft"].includes(
      normalise(record?.status)
    )
  ).length;

  return (
    <main className="notification-centre-page">
      <section className="notification-hero">
        <div>
          <span className="notification-eyebrow">
            <BellRing size={16} />
            Customer communications
          </span>
          <h1>Notification Centre</h1>
          <p>
            Review scheduled, delivered and failed communications across every
            configured SalonAI channel.
          </p>
        </div>

        <button
          type="button"
          className="notification-refresh-button"
          onClick={() => load({ refresh: true })}
          disabled={refreshing}
        >
          <RefreshCw
            size={18}
            className={refreshing ? "is-spinning" : ""}
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </section>

      {error ? (
        <section className="notification-alert" role="alert">
          <TriangleAlert size={20} />
          <span>{error}</span>
          <button type="button" onClick={() => load()}>
            Try again
          </button>
        </section>
      ) : null}

      <section
        className="notification-summary-grid"
        aria-label="Notification summary"
      >
        <NotificationSummaryCard
          label="Total records"
          value={records.length}
          detail="across all channels"
          icon={BellRing}
        />
        <NotificationSummaryCard
          label="Delivered"
          value={delivered}
          detail="successfully completed"
          icon={CheckCircle2}
        />
        <NotificationSummaryCard
          label="Pending"
          value={pending}
          detail="queued or scheduled"
          icon={Send}
        />
        <NotificationSummaryCard
          label="Failed"
          value={failed}
          detail="requiring attention"
          icon={TriangleAlert}
        />
      </section>

      <section className="notification-workspace">
        <header className="notification-workspace-header">
          <div>
            <h2>Communication records</h2>
            <p>{filteredRecords.length} matching records</p>
          </div>

          <div className="notification-filters">
            <label className="notification-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search recipient or title"
                aria-label="Search notifications"
              />
            </label>

            <label className="notification-select">
              <Filter size={17} aria-hidden="true" />
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                aria-label="Filter by channel"
              >
                <option value="all">All channels</option>
                {channels.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="notification-select">
              <Filter size={17} aria-hidden="true" />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                {statuses.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {loading ? (
          <div className="notification-loading" role="status">
            <RefreshCw className="is-spinning" size={24} />
            Loading communication records…
          </div>
        ) : filteredRecords.length ? (
          <div className="notification-record-list">
            {filteredRecords.map((item, index) => (
              <NotificationRecordCard
                key={item?._id || item?.id || `${index}-${item?.code || ""}`}
                item={item}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="notification-empty">
            <BellRing size={30} />
            <h3>No matching notifications</h3>
            <p>
              Adjust the filters or refresh to check for new communication
              records.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
