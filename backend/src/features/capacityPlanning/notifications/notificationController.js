import Notification from "./Notification.js";

export async function listNotifications(req, res) {
  const query = {};
  if (req.query.channel) query.channel = req.query.channel;
  if (req.query.status) query.status = req.query.status;
  res.json({ success: true, notifications: await Notification.find(query).sort({ createdAt: -1 }).limit(500).lean() });
}

export async function queueNotification(req, res) {
  const notification = await Notification.create({
    ...req.body,
    status: req.body.scheduledFor ? "scheduled" : "queued",
  });
  res.status(201).json({ success: true, notification });
}
