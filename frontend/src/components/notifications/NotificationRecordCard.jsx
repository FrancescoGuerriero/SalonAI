import {
  BellRing,
  Mail,
  MessageCircle,
  Smartphone,
} from "lucide-react";

const channelIcons = {
  email: Mail,
  sms: Smartphone,
  whatsapp: MessageCircle,
  push: BellRing,
  notification: BellRing,
};

function normaliseChannel(value) {
  return String(value || "notification").toLowerCase();
}

export default function NotificationRecordCard({ item, index }) {
  const channel = normaliseChannel(item?.channel);
  const Icon = channelIcons[channel] || BellRing;
  const title =
    item?.name ||
    item?.title ||
    item?.code ||
    item?.recipient ||
    `Notification ${index + 1}`;

  const status = String(item?.status || "active").toLowerCase();

  return (
    <article className="notification-record-card">
      <span className="notification-record-icon" aria-hidden="true">
        <Icon size={20} />
      </span>

      <div className="notification-record-copy">
        <div className="notification-record-heading">
          <div>
            <h2>{title}</h2>
            <p>
              {item?.recipient ||
                item?.audience ||
                item?.description ||
                "SalonAI communication"}
            </p>
          </div>

          <span className={`notification-status notification-status-${status}`}>
            {status}
          </span>
        </div>

        <div className="notification-record-meta">
          <span>{channel}</span>
          {item?.scheduledFor ? (
            <span>
              Scheduled {new Date(item.scheduledFor).toLocaleString("en-GB")}
            </span>
          ) : null}
          {item?.createdAt ? (
            <span>
              Created {new Date(item.createdAt).toLocaleDateString("en-GB")}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
