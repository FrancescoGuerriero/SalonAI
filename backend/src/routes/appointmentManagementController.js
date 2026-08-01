import * as service from "./segmentService.js";

export async function create(req, res) {
  res.status(201).json(
    await service.createSegment(req.body, req.user)
  );
}

export async function list(req, res) {
  res.json(await service.listSegments(req.query));
}

export async function get(req, res) {
  res.json(await service.getSegment(req.params.id));
}

export async function update(req, res) {
  res.json(
    await service.updateSegment(
      req.params.id,
      req.body,
      req.user
    )
  );
}

export async function remove(req, res) {
  res.json(
    await service.deleteSegment(req.params.id)
  );
}

export async function preview(req, res) {
  res.json(
    await service.previewSegment(
      req.params.id,
      req.query
    )
  );
}
