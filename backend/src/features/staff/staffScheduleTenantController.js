import {
  cancelScopedCalendarBlock,
  createScopedCalendarBlock,
  scopedCalendarBlocks,
  scopedSelfDay,
  scopedStaffDay,
} from "../../services/staffScheduleTenantService.js";
import {
  recordAuditEvent,
} from "../../services/auditService.js";

function plain(value) {
  return value && typeof value.toObject === "function" ? value.toObject() : value;
}

export async function myDay(req, res) {
  res.json(
    await scopedSelfDay(
      req.user?._id,
      req.query.date,
      req.effectiveAuthority
    )
  );
}

export async function staffDay(req, res) {
  res.json(
    await scopedStaffDay(
      req.params.staffId,
      req.query.date,
      req.effectiveAuthority
    )
  );
}

export async function listCalendarBlocks(req, res) {
  res.json({
    items: await scopedCalendarBlocks(
      req.query,
      req.effectiveAuthority
    ),
  });
}

export async function createCalendarBlock(req, res) {
  const block = await createScopedCalendarBlock(
    req.params.staffId,
    req.body,
    req.user,
    req.effectiveAuthority
  );

  await recordAuditEvent({
    req,
    action: "staff.schedule_block_created",
    resourceType: "staffTimeOff",
    resourceId: block?._id,
    before: null,
    after: plain(block),
    metadata: {
      scope: "tenant",
      business: String(block?.business || ""),
      location: String(block?.location || ""),
      staff: String(block?.staff || ""),
    },
  });

  res.status(201).json(block);
}

export async function cancelCalendarBlock(req, res) {
  const before = await scopedCalendarBlocks(
    {},
    req.effectiveAuthority
  );
  const prior = before.find((block) => String(block?._id || "") === String(req.params.id));

  const block = await cancelScopedCalendarBlock(
    req.params.id,
    req.user,
    req.effectiveAuthority
  );

  await recordAuditEvent({
    req,
    action: "staff.schedule_block_cancelled",
    resourceType: "staffTimeOff",
    resourceId: block?._id || req.params.id,
    before: prior || null,
    after: plain(block),
    metadata: {
      scope: "tenant",
      business: String(block?.business || ""),
      location: String(block?.location || ""),
      staff: String(block?.staff || ""),
    },
  });

  res.json(block);
}

export default {
  cancelCalendarBlock,
  createCalendarBlock,
  listCalendarBlocks,
  myDay,
  staffDay,
};
