import * as service from "./futureCustomerProfileService.js";

export async function profile(req, res) {
  res.json(
    await service.getCustomerProfile(
      req.params.customerId
    )
  );
}

export async function createNote(req, res) {
  res.status(201).json(
    await service.createNote(
      req.params.customerId,
      req.body,
      req.user
    )
  );
}

export async function updateNote(req, res) {
  res.json(
    await service.updateNote(
      req.params.noteId,
      req.body,
      req.user
    )
  );
}

export async function deleteNote(req, res) {
  res.json(
    await service.deleteNote(req.params.noteId, req.user)
  );
}

export async function listTags(_req, res) {
  res.json({
    items: await service.listTags(),
  });
}

export async function createTag(req, res) {
  res.status(201).json(
    await service.createTag(req.body)
  );
}

export async function assignTag(req, res) {
  res.status(201).json(
    await service.assignTag(
      req.params.customerId,
      req.body.tagId,
      req.user
    )
  );
}

export async function removeTag(req, res) {
  res.json(
    await service.removeTag(
      req.params.customerId,
      req.params.tagId
    )
  );
}
