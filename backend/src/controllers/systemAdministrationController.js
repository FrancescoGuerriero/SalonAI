import SystemSetting from "../models/SystemSetting.js";
import AuditLog from "../models/AuditLog.js";
import DeadLetterRecord from "../models/DeadLetterRecord.js";
import { recordAuditEvent } from "../services/auditService.js";
import {
  featureSettingKey,
  listResolvedFeatureControls,
  normaliseFeatureControlUpdate,
  requireKnownFeature,
} from "../services/featureControlService.js";

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

export async function listFeatureControls(req, res) {
  const features = await listResolvedFeatureControls();

  res.json({ success: true, features });
}

export async function updateFeatureControl(req, res) {
  const { definition, key, enabled } = normaliseFeatureControlUpdate(
    req.params.featureId,
    req.body
  );
  const before = await SystemSetting.findOne({ key }).lean();
  const setting = await SystemSetting.findOneAndUpdate(
    { key },
    {
      value: enabled,
      category: "feature-controls",
      secret: false,
      updatedBy: req.user?._id,
    },
    { new: true, upsert: true, runValidators: true }
  );

  await recordAuditEvent({
    req,
    action: "feature_control.updated",
    resourceType: "FeatureControl",
    resourceId: definition.id,
    before: before
      ? { enabled: before.value, source: "admin" }
      : { enabled: definition.defaultEnabled, source: "code-default" },
    after: { enabled, source: "admin" },
    metadata: { label: definition.label, settingId: String(setting._id) },
  });

  const features = await listResolvedFeatureControls();
  res.json({
    success: true,
    feature: features.find(({ id }) => id === definition.id),
  });
}

export async function resetFeatureControl(req, res) {
  const definition = requireKnownFeature(req.params.featureId);

  if (definition.required) {
    const error = new Error("This required control cannot be overridden.");
    error.statusCode = 400;
    throw error;
  }

  const key = featureSettingKey(definition.id);
  const before = await SystemSetting.findOneAndDelete({ key }).lean();

  await recordAuditEvent({
    req,
    action: "feature_control.reset",
    resourceType: "FeatureControl",
    resourceId: definition.id,
    before: before
      ? { enabled: before.value, source: "admin" }
      : { enabled: definition.defaultEnabled, source: "code-default" },
    after: { enabled: definition.defaultEnabled, source: "code-default" },
    metadata: { label: definition.label },
  });

  res.json({
    success: true,
    feature: {
      ...definition,
      enabled: definition.defaultEnabled,
      source: "code-default",
      updatedAt: null,
      updatedBy: null,
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
