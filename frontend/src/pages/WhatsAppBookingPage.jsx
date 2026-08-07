import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Inbox,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  UserRoundCheck,
  XCircle,
} from "lucide-react";

import serviceService from "../Services/serviceService.js";
import stylistService from "../Services/stylistService.js";
import {
  confirmWhatsAppBooking,
  getWhatsAppConversation,
  listWhatsAppConversations,
  markWhatsAppConversationRead,
  sendWhatsAppConversationMessage,
  updateWhatsAppBookingSession,
  updateWhatsAppConversationStatus,
} from "../Services/whatsappBookingService.js";
import {
  getStylistName,
  isStylistActive,
  stylistOffersService,
} from "../utils/stylists.js";
import "../styles/whatsappBooking.css";

const EMPTY_SUMMARY = {
  open: 0,
  awaitingConfirmation: 0,
  booked: 0,
  unread: 0,
};

const EMPTY_BOOKING = {
  displayName: "",
  serviceId: "",
  stylistId: "",
  appointmentDate: "",
  appointmentTime: "",
};

const STATUS_LABELS = {
  open: "Open",
  collecting_details: "Collecting details",
  awaiting_confirmation: "Ready to confirm",
  confirming: "Confirming",
  booked: "Booked",
  completed: "Completed",
  closed: "Closed",
  failed: "Needs attention",
};

function idOf(value) {
  return String(value?._id || value || "");
}

function dateInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function formatTimestamp(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

function customerName(conversation = {}) {
  const profile = conversation.customer || {};
  return (
    conversation.displayName ||
    profile.preferredName ||
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    "WhatsApp customer"
  );
}

function requestMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

export default function WhatsAppBookingPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [selectedId, setSelectedId] = useState("");
  const [conversation, setConversation] = useState(null);
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [slots, setSlots] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [booking, setBooking] = useState(EMPTY_BOOKING);
  const [outboundMessage, setOutboundMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeServices = useMemo(
    () => services.filter((service) => service.active !== false),
    [services]
  );

  const eligibleStylists = useMemo(
    () =>
      stylists.filter(
        (stylist) =>
          isStylistActive(stylist) &&
          stylistOffersService(stylist, booking.serviceId)
      ),
    [booking.serviceId, stylists]
  );

  async function loadList({ preserveSelection = true } = {}) {
    setLoading(true);
    setError("");

    try {
      const result = await listWhatsAppConversations({
        status,
        search: query.trim() || undefined,
        limit: 100,
      });
      const conversations = Array.isArray(result?.conversations)
        ? result.conversations
        : [];

      setRows(conversations);
      setSummary(result?.summary || EMPTY_SUMMARY);

      if (!preserveSelection || !conversations.some((item) => item._id === selectedId)) {
        setSelectedId(conversations[0]?._id || "");
      }
    } catch (requestError) {
      setError(requestMessage(requestError, "Unable to load WhatsApp conversations."));
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation(conversationId) {
    if (!conversationId) {
      setConversation(null);
      setBooking(EMPTY_BOOKING);
      return;
    }

    setDetailLoading(true);
    setError("");

    try {
      const item = await getWhatsAppConversation(conversationId);
      setConversation(item);
      setBooking({
        displayName: item?.displayName || customerName(item),
        serviceId: idOf(item?.bookingSession?.serviceId),
        stylistId: idOf(item?.bookingSession?.stylistId),
        appointmentDate: dateInputValue(item?.bookingSession?.appointmentDate),
        appointmentTime: item?.bookingSession?.appointmentTime || "",
      });
      setSlots([]);

      if (Number(item?.unreadCount) > 0) {
        await markWhatsAppConversationRead(conversationId);
        setRows((current) =>
          current.map((row) =>
            row._id === conversationId ? { ...row, unreadCount: 0 } : row
          )
        );
      }
    } catch (requestError) {
      setError(requestMessage(requestError, "Unable to load the conversation."));
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      serviceService.getServices(),
      stylistService.getStylists({ active: true, limit: 100 }),
    ])
      .then(([serviceRows, stylistResult]) => {
        setServices(Array.isArray(serviceRows) ? serviceRows : []);
        setStylists(
          Array.isArray(stylistResult)
            ? stylistResult
            : Array.isArray(stylistResult?.stylists)
              ? stylistResult.stylists
              : []
        );
      })
      .catch((requestError) =>
        setError(requestMessage(requestError, "Unable to load booking resources."))
      );
  }, []);

  useEffect(() => {
    loadList({ preserveSelection: true });
  }, [status]);

  useEffect(() => {
    loadConversation(selectedId);
  }, [selectedId]);

  async function refresh() {
    setNotice("");
    await loadList({ preserveSelection: true });
    if (selectedId) {
      await loadConversation(selectedId);
    }
  }

  async function checkAvailability() {
    if (!booking.serviceId || !booking.stylistId || !booking.appointmentDate) {
      setError("Choose a service, stylist, and date before checking availability.");
      return;
    }

    setAvailabilityLoading(true);
    setError("");
    setNotice("");

    try {
      const result = await stylistService.getAvailability(booking.stylistId, {
        service: booking.serviceId,
        date: booking.appointmentDate,
      });
      const availableSlots = Array.isArray(result?.slots) ? result.slots : [];
      setSlots(availableSlots);

      if (!availableSlots.length) {
        setNotice("No available times were found for that day.");
      }
    } catch (requestError) {
      setSlots([]);
      setError(requestMessage(requestError, "Unable to check appointment availability."));
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function saveBooking(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await updateWhatsAppBookingSession(selectedId, booking);
      setConversation(result.conversation);
      setNotice(result.message || "Booking details are ready to confirm.");
      await loadList({ preserveSelection: true });
    } catch (requestError) {
      setError(requestMessage(requestError, "Unable to save the booking details."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmBooking() {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await confirmWhatsAppBooking(selectedId);
      setConversation(result.conversation);
      setNotice(result.message || "WhatsApp appointment confirmed.");
      await loadList({ preserveSelection: true });
    } catch (requestError) {
      setError(requestMessage(requestError, "Unable to confirm the WhatsApp booking."));
    } finally {
      setSaving(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const body = outboundMessage.trim();
    if (!body) return;

    setSending(true);
    setError("");
    setNotice("");

    try {
      const result = await sendWhatsAppConversationMessage(selectedId, body);
      setConversation(result.conversation);
      setOutboundMessage("");
      setNotice("WhatsApp message sent.");
      await loadList({ preserveSelection: true });
    } catch (requestError) {
      setError(requestMessage(requestError, "Unable to send the WhatsApp message."));
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(nextStatus) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await updateWhatsAppConversationStatus(selectedId, nextStatus);
      setConversation(result.conversation);
      setNotice(nextStatus === "closed" ? "Conversation closed." : "Conversation reopened.");
      await loadList({ preserveSelection: true });
    } catch (requestError) {
      setError(requestMessage(requestError, "Unable to update the conversation."));
    } finally {
      setSaving(false);
    }
  }

  const messages = Array.isArray(conversation?.messages)
    ? conversation.messages
    : [];
  const alreadyBooked = Boolean(conversation?.bookingSession?.appointmentId);
  const readyToConfirm =
    conversation?.status === "awaiting_confirmation" && !alreadyBooked;

  return (
    <main className="whatsapp-workspace">
      <div className="whatsapp-workspace-inner">
        <header className="whatsapp-page-header">
          <div>
            <p className="app-eyebrow"><MessageCircle size={15} /> Customer channels</p>
            <h1>WhatsApp booking</h1>
            <p>
              Review incoming requests, verify a live appointment slot, create the real booking,
              and keep the customer conversation together.
            </p>
          </div>
          <button type="button" className="app-button app-button-secondary" onClick={refresh} disabled={loading}>
            <RefreshCw size={17} className={loading ? "app-spin" : ""} /> Refresh
          </button>
        </header>

        <section className="whatsapp-summary-grid" aria-label="WhatsApp booking summary">
          <article><span><Inbox size={19} /></span><div><strong>{summary.open}</strong><small>Open conversations</small></div></article>
          <article><span><Clock3 size={19} /></span><div><strong>{summary.awaitingConfirmation}</strong><small>Ready to confirm</small></div></article>
          <article><span><CalendarCheck size={19} /></span><div><strong>{summary.booked}</strong><small>Bookings created</small></div></article>
          <article><span><MessageCircle size={19} /></span><div><strong>{summary.unread}</strong><small>Unread conversations</small></div></article>
        </section>

        {error ? <div className="app-alert app-alert-error" role="alert"><XCircle size={19} /><div><strong>Action needed</strong>{error}</div></div> : null}
        {notice ? <div className="app-alert app-alert-success" role="status"><CheckCircle2 size={19} /><div>{notice}</div></div> : null}

        <section className="whatsapp-console">
          <aside className="whatsapp-inbox">
            <form
              className="whatsapp-inbox-filters"
              onSubmit={(event) => { event.preventDefault(); loadList({ preserveSelection: false }); }}
            >
              <label><Search size={16} /><span className="sr-only">Search conversations</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or number" /></label>
              <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter conversation status">
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="awaiting_confirmation">Ready to confirm</option>
                <option value="booked">Booked</option>
                <option value="closed">Closed</option>
                <option value="failed">Needs attention</option>
              </select>
            </form>

            <div className="whatsapp-conversation-list">
              {loading ? <div className="whatsapp-loading"><Loader2 className="app-spin" /> Loading conversations</div> : rows.map((item) => (
                <button
                  type="button"
                  key={item._id}
                  className={`whatsapp-conversation-row${selectedId === item._id ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(item._id)}
                >
                  <span className="whatsapp-customer-avatar">{customerName(item).charAt(0).toUpperCase()}</span>
                  <span className="whatsapp-conversation-copy">
                    <span><strong>{customerName(item)}</strong><small>{formatTimestamp(item.lastMessageAt)}</small></span>
                    <small>{item.phone}</small>
                    <p>{item.lastMessagePreview || "No message preview"}</p>
                    <span><em className={`whatsapp-status is-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</em>{item.unreadCount ? <b>{item.unreadCount}</b> : null}</span>
                  </span>
                </button>
              ))}
              {!loading && !rows.length ? <div className="whatsapp-empty"><Inbox size={28} /><strong>No conversations found</strong><p>Incoming verified WhatsApp messages will appear here.</p></div> : null}
            </div>
          </aside>

          <div className="whatsapp-detail">
            {!selectedId ? <div className="whatsapp-empty large"><MessageCircle size={36} /><strong>Select a conversation</strong><p>Choose an incoming request to review messages and prepare a booking.</p></div> : detailLoading ? <div className="whatsapp-loading large"><Loader2 className="app-spin" /> Loading conversation</div> : conversation ? (
              <>
                <header className="whatsapp-detail-header">
                  <div><span className="whatsapp-customer-avatar large">{customerName(conversation).charAt(0).toUpperCase()}</span><div><h2>{customerName(conversation)}</h2><p>{conversation.phone} · {STATUS_LABELS[conversation.status] || conversation.status}</p></div></div>
                  <button type="button" className="app-button app-button-secondary app-button-sm" onClick={() => changeStatus(conversation.status === "closed" ? "open" : "closed")} disabled={saving}>
                    {conversation.status === "closed" ? "Reopen" : "Close conversation"}
                  </button>
                </header>

                <div className="whatsapp-detail-grid">
                  <section className="whatsapp-thread" aria-label="WhatsApp messages">
                    <div className="whatsapp-message-list">
                      {messages.map((message, index) => (
                        <article key={message._id || `${message.sentAt}-${index}`} className={`whatsapp-message is-${message.direction}`}>
                          <p>{message.body}</p>
                          <small>{formatTimestamp(message.sentAt)}{message.direction === "outbound" ? ` · ${message.providerStatus || "sent"}` : ""}</small>
                          {message.error ? <em>{message.error}</em> : null}
                        </article>
                      ))}
                      {!messages.length ? <div className="whatsapp-empty"><MessageCircle size={26} /><p>No messages recorded.</p></div> : null}
                    </div>

                    <form className="whatsapp-reply-form" onSubmit={sendMessage}>
                      <label htmlFor="whatsapp-reply" className="sr-only">Reply on WhatsApp</label>
                      <textarea id="whatsapp-reply" rows={2} maxLength={4096} value={outboundMessage} onChange={(event) => setOutboundMessage(event.target.value)} placeholder="Write a clear booking reply…" />
                      <button type="submit" disabled={sending || !outboundMessage.trim()}><Send size={17} />{sending ? "Sending" : "Send"}</button>
                    </form>
                  </section>

                  <section className="whatsapp-booking-card">
                    <header><span><UserRoundCheck size={19} /></span><div><h3>Booking details</h3><p>Only confirmed live slots can be saved.</p></div></header>

                    {alreadyBooked ? (
                      <div className="whatsapp-booked-state"><CheckCircle2 size={24} /><div><strong>Appointment created</strong><p>{conversation.bookingSession?.serviceId?.name} · {dateInputValue(conversation.bookingSession?.appointmentDate)} at {conversation.bookingSession?.appointmentTime}</p></div></div>
                    ) : (
                      <form onSubmit={saveBooking} className="whatsapp-booking-form">
                        <label>Customer name<input required value={booking.displayName} onChange={(event) => setBooking((current) => ({ ...current, displayName: event.target.value }))} placeholder="Customer name" /></label>
                        <label>Service<select required value={booking.serviceId} onChange={(event) => setBooking((current) => ({ ...current, serviceId: event.target.value, stylistId: "", appointmentTime: "" }))}><option value="">Choose a service</option>{activeServices.map((service) => <option key={service._id} value={service._id}>{service.name} · £{Number(service.price || 0).toFixed(2)}</option>)}</select></label>
                        <label>Stylist<select required value={booking.stylistId} onChange={(event) => setBooking((current) => ({ ...current, stylistId: event.target.value, appointmentTime: "" }))}><option value="">Choose a stylist</option>{eligibleStylists.map((stylist) => <option key={stylist._id} value={stylist._id}>{getStylistName(stylist)}</option>)}</select></label>
                        <label>Date<input required type="date" min={new Date().toISOString().slice(0, 10)} value={booking.appointmentDate} onChange={(event) => setBooking((current) => ({ ...current, appointmentDate: event.target.value, appointmentTime: "" }))} /></label>
                        <button type="button" className="app-button app-button-secondary" onClick={checkAvailability} disabled={availabilityLoading}>{availabilityLoading ? <Loader2 size={16} className="app-spin" /> : <Clock3 size={16} />}Check availability</button>

                        {slots.length ? <fieldset className="whatsapp-slots"><legend>Available times</legend><div>{slots.map((slot) => <button type="button" key={slot} className={booking.appointmentTime === slot ? "is-selected" : ""} onClick={() => setBooking((current) => ({ ...current, appointmentTime: slot }))}>{slot}</button>)}</div></fieldset> : null}

                        <input type="hidden" value={booking.appointmentTime} required readOnly />
                        <button type="submit" className="app-button app-button-primary" disabled={saving || !booking.appointmentTime}>{saving ? <Loader2 size={16} className="app-spin" /> : <CalendarCheck size={16} />}Save verified slot</button>
                      </form>
                    )}

                    {readyToConfirm ? <button type="button" className="whatsapp-confirm-button" onClick={confirmBooking} disabled={saving}>{saving ? <Loader2 size={17} className="app-spin" /> : <CheckCircle2 size={17} />}Create appointment and send confirmation</button> : null}
                  </section>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
