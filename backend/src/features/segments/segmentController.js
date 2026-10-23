import * as service from "./segmentService.js";
import { createServiceError } from "../../shared/serviceError.js";

function businessId(request) {
  const value =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;
  if (!value) {
    throw createServiceError(
      "A trusted active business is required for segment operations.",
      400
    );
  }
  return value;
}

export async function create(req, res) {
  res.status(201).json(
    await service.createSegment(req.body, req.user, {
      businessId: businessId(req),
    })
  );
}

export async function list(req, res) {
  res.json(
    await service.listSegments(req.query, {
      businessId: businessId(req),
    })
  );
}

export async function get(req, res) {
  res.json(
    await service.getSegment(req.params.id, {
      businessId: businessId(req),
    })
  );
}

export async function update(req, res) {
  res.json(
    await service.updateSegment(
      req.params.id,
      req.body,
      req.user,
      { businessId: businessId(req) }
    )
  );
}

export async function remove(req, res) {
  res.json(
    await service.deleteSegment(req.params.id, {
      businessId: businessId(req),
    })
  );
}

export async function preview(req, res) {
  res.json(
    await service.previewSegment(req.params.id, {
      ...req.query,
      businessId: businessId(req),
    })
  );
}
