import * as service from "./customerRelationshipService.js";

export async function listMine(request, response) {
  return response.json({
    success: true,
    relationships: await service.listMyRelationships(request.user),
  });
}

export async function invite(request, response) {
  return response.status(201).json({
    success: true,
    relationship: await service.inviteRelationship(request.body || {}, request.user),
  });
}

export async function respond(request, response) {
  return response.json({
    success: true,
    relationship: await service.respondToRelationship(
      request.params.id,
      request.body?.status,
      request.user
    ),
  });
}

export async function revoke(request, response) {
  return response.json({
    success: true,
    relationship: await service.revokeRelationship(request.params.id, request.user),
  });
}

export default { invite, listMine, respond, revoke };
