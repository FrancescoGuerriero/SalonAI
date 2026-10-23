import * as service from "./settlementService.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

function context(request) {
  const businessId =
    request.effectiveAuthority?.businessId ||
    request.tenantContext?.businessId ||
    null;
  if (!businessId) {
    throw createServiceError(
      "Trusted tenant authority is required for settlement reconciliation.",
      403,
      { code: "SETTLEMENT_TENANT_AUTHORITY_REQUIRED" }
    );
  }
  return {
    businessId,
    user: request.user,
    requestId:
      request.id ||
      request.requestId ||
      request.headers?.["x-request-id"] ||
      "",
  };
}

function body(request) {
  return request.body &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function projectLedgerEntry(request, response) {
  response.status(201).json({
    success: true,
    ...(await service.projectStoredValueSettlement(
      request.params.ledgerEntryId,
      context(request)
    )),
    paymentExecutionAllowed: false,
  });
}

export async function projectPending(request, response) {
  response.status(200).json({
    success: true,
    ...(await service.projectPendingStoredValueSettlements(
      request.query || {},
      context(request)
    )),
    paymentExecutionAllowed: false,
  });
}

export async function obligations(request, response) {
  response.json({
    success: true,
    items: await service.listCrossLocationObligations(
      request.query || {},
      context(request)
    ),
  });
}

export async function reviewObligation(request, response) {
  response.json({
    success: true,
    obligation: await service.reviewCrossLocationObligation(
      request.params.obligationId,
      body(request),
      context(request)
    ),
    paymentExecutionAllowed: false,
  });
}

export async function batches(request, response) {
  response.json({
    success: true,
    items: await service.listSettlementBatches(
      request.query || {},
      context(request)
    ),
  });
}

export async function createBatch(request, response) {
  response.status(201).json({
    success: true,
    batch: await service.createSettlementBatch(body(request), context(request)),
    paymentExecutionAllowed: false,
  });
}

export async function reviewBatch(request, response) {
  response.json({
    success: true,
    batch: await service.reviewSettlementBatch(
      request.params.batchId,
      body(request),
      context(request)
    ),
    paymentExecutionAllowed: false,
  });
}

export async function summary(request, response) {
  response.json({
    success: true,
    summary: await service.settlementReconciliationSummary(context(request)),
  });
}

export default {
  batches,
  createBatch,
  obligations,
  projectLedgerEntry,
  projectPending,
  reviewBatch,
  reviewObligation,
  summary,
};
