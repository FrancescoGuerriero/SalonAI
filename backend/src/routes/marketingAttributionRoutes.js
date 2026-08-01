import * as service from "./loyaltyService.js";

export async function account(req, res) {
  res.json(
    await service.getAccount(
      req.params.customerId
    )
  );
}

export async function transact(req, res) {
  res.json(
    await service.transact(
      req.params.customerId,
      req.body,
      req.user
    )
  );
}

export async function createMembership(req, res) {
  res.status(201).json(
    await service.createMembership(req.body)
  );
}

export async function listMemberships(req, res) {
  res.json({
    items: await service.listMemberships(
      req.query
    ),
  });
}

export async function updateMembership(req, res) {
  res.json(
    await service.updateMembership(
      req.params.id,
      req.body
    )
  );
}
