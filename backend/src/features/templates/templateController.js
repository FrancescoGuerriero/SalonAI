import * as templateService from "./templateService.js";

export async function create(req, res) {
  res.status(201).json(
    await templateService.createTemplate(
      req.body,
      req.user
    )
  );
}

export async function list(req, res) {
  res.json(
    await templateService.listTemplates(req.query)
  );
}

export async function get(req, res) {
  res.json(
    await templateService.getTemplate(req.params.id)
  );
}

export async function update(req, res) {
  res.json(
    await templateService.updateTemplate(
      req.params.id,
      req.body,
      req.user
    )
  );
}

export async function archive(req, res) {
  res.json(
    await templateService.archiveTemplate(
      req.params.id,
      req.user
    )
  );
}

export async function preview(req, res) {
  res.json(
    await templateService.renderTemplatePreview(
      req.params.id,
      req.body.context
    )
  );
}
