import SystemSetting from "../models/SystemSetting.js";
import AuditLog from "../models/AuditLog.js";
import DeadLetterRecord from "../models/DeadLetterRecord.js";
import { recordAuditEvent } from "../services/auditService.js";

export async function listSettings(req, res) {
  const settings = await SystemSetting.find()
    .sort({ category: 1, key: 1 })
    .lean();

  res.json({
    success: true,
    settings: settings.map((item) => ({
      ...item,
      value: item.secret ? "********" : item.value,
    })),
  });
}

export async function updateSetting(req, res) {
  const before = await SystemSetting.findOne({
    key: req.params.key,
  }).lean();

  const setting = await SystemSetting.findOneAndUpdate(
    { key: req.params.key },
    {
      value: req.body.value,
      category: req.body.category || "general",
      secret: Boolean(req.body.secret),
      updatedBy: req.user?._id,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );

  await recordAuditEvent({
    req,
    action: "system_setting.updated",
    resourceType: "SystemSetting",
    resourceId: setting._id,
    before,
    after: setting.toObject(),
  });

  res.json({
    success: true,
    setting: {
      ...setting.toObject(),
      value: setting.secret ? "********" : setting.value,
    },
  });
}

export async function listAuditLogs(req, res) {
  const logs = await AuditLog.find()
    .populate("actor", "name email")
    .sort({ occurredAt: -1 })
    .limit(500)
    .lean();

  res.json({ success: true, logs });
}

export async function listDeadLetters(req, res) {
  const records = await DeadLetterRecord.find()
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  res.json({ success: true, records });
}
