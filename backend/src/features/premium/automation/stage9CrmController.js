import {
  createClientTechnicalRecord,
  listClientTechnicalRecords,
  listRetentionQueue,
} from "./stage9CrmService.js";

function actorId(request) {
  return request?.user?._id || request?.user?.id || null;
}

export async function getTechnicalRecords(request, response) {
  const result = await listClientTechnicalRecords(request.params.customerId, {
    effectiveAuthority: request.effectiveAuthority,
    limit: request.query.limit,
  });
  response.status(200).json(result);
}

export async function createTechnicalRecord(request, response) {
  const record = await createClientTechnicalRecord(
    request.params.customerId,
    request.body || {},
    {
      effectiveAuthority: request.effectiveAuthority,
      actorId: actorId(request),
    }
  );
  response.status(201).json({ record });
}

export async function getRetentionQueue(request, response) {
  const result = await listRetentionQueue({
    effectiveAuthority: request.effectiveAuthority,
    limit: request.query.limit,
    state: request.query.state || "",
  });
  response.status(200).json(result);
}
