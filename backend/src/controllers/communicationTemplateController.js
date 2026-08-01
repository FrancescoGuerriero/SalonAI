import communicationTemplateService from "../services/communicationTemplateService.js";

function sendSuccess(
  response,
  {
    statusCode = 200,
    message,
    data,
  }
) {
  const payload = {
    success: true,
  };

  if (message) {
    payload.message = message;
  }

  if (data !== undefined) {
    Object.assign(payload, data);
  }

  return response.status(statusCode).json(payload);
}

function getRequestUser(request) {
  return (
    request.user ||
    request.auth?.user ||
    null
  );
}

function getTemplateFilters(request) {
  return {
    page: request.query.page,
    limit: request.query.limit,
    search: request.query.search,
    campaignType: request.query.campaignType,
    channel: request.query.channel,
    active: request.query.active,
    isSystemTemplate:
      request.query.isSystemTemplate,
    createdBy: request.query.createdBy,
    tag: request.query.tag,
    sort: request.query.sort,
  };
}

function getSummaryFilters(request) {
  return {
    search: request.query.search,
    campaignType: request.query.campaignType,
    channel: request.query.channel,
    active: request.query.active,
    isSystemTemplate:
      request.query.isSystemTemplate,
    createdBy: request.query.createdBy,
    tag: request.query.tag,
  };
}

export async function createCommunicationTemplate(
  request,
  response,
  next
) {
  try {
    const template =
      await communicationTemplateService.createCommunicationTemplate(
        request.body,
        getRequestUser(request)
      );

    return sendSuccess(response, {
      statusCode: 201,
      message:
        "Communication template created successfully.",
      data: {
        template,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCommunicationTemplates(
  request,
  response,
  next
) {
  try {
    const result =
      await communicationTemplateService.listCommunicationTemplates(
        getTemplateFilters(request)
      );

    return sendSuccess(response, {
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCommunicationTemplate(
  request,
  response,
  next
) {
  try {
    const template =
      await communicationTemplateService.getCommunicationTemplate(
        request.params.templateId
      );

    return sendSuccess(response, {
      data: {
        template,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCommunicationTemplateBySlug(
  request,
  response,
  next
) {
  try {
    const template =
      await communicationTemplateService.getCommunicationTemplateBySlug(
        request.params.slug
      );

    return sendSuccess(response, {
      data: {
        template,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateCommunicationTemplate(
  request,
  response,
  next
) {
  try {
    const template =
      await communicationTemplateService.updateCommunicationTemplate(
        request.params.templateId,
        request.body,
        getRequestUser(request)
      );

    return sendSuccess(response, {
      message:
        "Communication template updated successfully.",
      data: {
        template,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function setCommunicationTemplateStatus(
  request,
  response,
  next
) {
  try {
    const template =
      await communicationTemplateService.setCommunicationTemplateStatus(
        request.params.templateId,
        request.body.active,
        getRequestUser(request)
      );

    const statusLabel = template.active
      ? "activated"
      : "deactivated";

    return sendSuccess(response, {
      message: `Communication template ${statusLabel} successfully.`,
      data: {
        template,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteCommunicationTemplate(
  request,
  response,
  next
) {
  try {
    const result =
      await communicationTemplateService.deleteCommunicationTemplate(
        request.params.templateId
      );

    return sendSuccess(response, {
      message: result.message,
      data: {
        templateId: result.templateId,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function renderCommunicationTemplate(
  request,
  response,
  next
) {
  try {
    const variables =
      request.body?.variables &&
      typeof request.body.variables === "object" &&
      !Array.isArray(request.body.variables)
        ? request.body.variables
        : {};

    const options =
      request.body?.options &&
      typeof request.body.options === "object" &&
      !Array.isArray(request.body.options)
        ? request.body.options
        : {};

    const renderedTemplate =
      await communicationTemplateService.renderCommunicationTemplate(
        request.params.templateId,
        variables,
        {
          requireActive:
            options.requireActive !== false,

          requireAllVariables:
            options.requireAllVariables === true,

          recordUsage:
            options.recordUsage === true,
        }
      );

    return sendSuccess(response, {
      message:
        renderedTemplate.complete
          ? "Communication template rendered successfully."
          : "Communication template rendered with missing variables.",
      data: {
        renderedTemplate,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function duplicateCommunicationTemplate(
  request,
  response,
  next
) {
  try {
    const template =
      await communicationTemplateService.duplicateCommunicationTemplate(
        request.params.templateId,
        request.body,
        getRequestUser(request)
      );

    return sendSuccess(response, {
      statusCode: 201,
      message:
        "Communication template duplicated successfully.",
      data: {
        template,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCommunicationTemplateSummary(
  request,
  response,
  next
) {
  try {
    const result =
      await communicationTemplateService.getCommunicationTemplateSummary(
        getSummaryFilters(request)
      );

    return sendSuccess(response, {
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

const communicationTemplateController = {
  createCommunicationTemplate,
  listCommunicationTemplates,
  getCommunicationTemplate,
  getCommunicationTemplateBySlug,
  updateCommunicationTemplate,
  setCommunicationTemplateStatus,
  deleteCommunicationTemplate,
  renderCommunicationTemplate,
  duplicateCommunicationTemplate,
  getCommunicationTemplateSummary,
};

export default communicationTemplateController;