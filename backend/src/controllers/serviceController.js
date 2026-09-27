import mongoose from "mongoose";

import Service from "../models/service.js";
import {
  recordAuditEvent,
} from "../services/auditService.js";
import {
  managementServiceBusinessId,
  publicServiceBusinessId,
  scopedServiceFilter,
} from "../services/serviceTenantAuthorityService.js";
import {
  normaliseCatalogueImage,
} from "../utils/catalogueMedia.js";

function serialiseService(service) {
  const value =
    typeof service?.toObject ===
    "function"
      ? service.toObject()
      : {
          ...(service || {}),
        };

  const published =
    typeof value.published ===
    "boolean"
      ? value.published
      : value.active === true;

  const bookable =
    typeof value.bookable ===
    "boolean"
      ? value.bookable
      : value.onlineBookable !==
        false;

  delete value.onlineBookable;
  delete value.business;

  return {
    ...value,
    published,
    bookable,
  };
}

const PUBLIC_SERVICE_FILTER = {
  active: true,
  $or: [
    {
      published: true,
    },
    {
      published: {
        $exists: false,
      },
    },
  ],
};

function invalidServiceId(
  id
) {
  return !mongoose.isValidObjectId(
    id
  );
}

function serviceNotFound(
  res
) {
  return res.status(404).json({
    message:
      "Service not found.",
  });
}

export async function getServices(
  req,
  res,
  next
) {
  try {
    const businessId =
      publicServiceBusinessId(
        req
      );

    const services =
      await Service.find(
        scopedServiceFilter({
          businessId,
          domainFilter:
            PUBLIC_SERVICE_FILTER,
        })
      )
        .select(
          "+onlineBookable"
        )
        .sort({
          name: 1,
        });

    return res.json(
      services.map(
        serialiseService
      )
    );
  } catch (error) {
    return next(error);
  }
}

export async function getManagementServices(
  req,
  res,
  next
) {
  try {
    const businessId =
      managementServiceBusinessId(
        req
      );

    const services =
      await Service.find(
        scopedServiceFilter({
          businessId,
        })
      )
        .select(
          "+onlineBookable"
        )
        .sort({
          name: 1,
        });

    return res.json({
      success: true,
      services:
        services.map(
          serialiseService
        ),
    });
  } catch (error) {
    return next(error);
  }
}

export async function createService(
  req,
  res,
  next
) {
  try {
    const businessId =
      managementServiceBusinessId(
        req
      );

    const body =
      req.body &&
      typeof req.body ===
        "object"
        ? req.body
        : {};

    const payload = {
      ...body,
    };

    // Business ownership is trusted server-side tenancy state.
    // Never accept it from a client payload.
    delete payload.business;
    delete payload.onlineBookable;
    delete payload.published;

    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        "image"
      )
    ) {
      payload.image =
        normaliseCatalogueImage(
          payload.image
        );
    }

    const service =
      await Service.create({
        ...payload,
        business:
          businessId,
        active:
          typeof payload.active ===
          "boolean"
            ? payload.active
            : true,
        published: false,
        bookable:
          typeof payload.bookable ===
          "boolean"
            ? payload.bookable
            : true,
      });

    await recordAuditEvent({
      req,
      action:
        "service.created",
      resourceType:
        "service",
      resourceId:
        service._id,
      before: null,
      after:
        serialiseService(
          service
        ),
    });

    return res.status(201).json({
      message:
        "Service created successfully.",
      service:
        serialiseService(
          service
        ),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getServiceById(
  req,
  res,
  next
) {
  try {
    if (
      invalidServiceId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message:
          "The service identifier is invalid.",
      });
    }

    const businessId =
      publicServiceBusinessId(
        req
      );

    const service =
      await Service.findOne(
        scopedServiceFilter({
          businessId,
          domainFilter: {
            _id:
              req.params.id,
            ...PUBLIC_SERVICE_FILTER,
          },
        })
      ).select(
        "+onlineBookable"
      );

    if (!service) {
      return serviceNotFound(
        res
      );
    }

    return res.json(
      serialiseService(
        service
      )
    );
  } catch (error) {
    return next(error);
  }
}

export async function updateService(
  req,
  res,
  next
) {
  try {
    if (
      invalidServiceId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message:
          "The service identifier is invalid.",
      });
    }

    const businessId =
      managementServiceBusinessId(
        req
      );

    const payload = {
      ...req.body,
    };

    // Business ownership is trusted server-side tenancy state and
    // publication is a separate privileged action.
    delete payload.business;
    delete payload.published;
    delete payload.onlineBookable;

    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        "image"
      )
    ) {
      payload.image =
        normaliseCatalogueImage(
          payload.image
        );
    }

    const filter =
      scopedServiceFilter({
        businessId,
        domainFilter: {
          _id:
            req.params.id,
        },
      });

    const before =
      await Service.findOne(
        filter
      ).lean();

    if (!before) {
      return serviceNotFound(
        res
      );
    }

    const service =
      await Service.findOneAndUpdate(
        filter,
        payload,
        {
          new: true,
          runValidators: true,
        }
      ).select(
        "+onlineBookable"
      );

    if (!service) {
      return serviceNotFound(
        res
      );
    }

    await recordAuditEvent({
      req,
      action:
        "service.updated",
      resourceType:
        "service",
      resourceId:
        service._id,
      before,
      after:
        serialiseService(
          service
        ),
      metadata: {
        changedFields:
          Object.keys(
            payload
          ),
      },
    });

    return res.json({
      message:
        "Service updated successfully.",
      service:
        serialiseService(
          service
        ),
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteService(
  req,
  res,
  next
) {
  try {
    if (
      invalidServiceId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message:
          "The service identifier is invalid.",
      });
    }

    const businessId =
      managementServiceBusinessId(
        req
      );

    const service =
      await Service.findOneAndDelete(
        scopedServiceFilter({
          businessId,
          domainFilter: {
            _id:
              req.params.id,
          },
        })
      );

    if (!service) {
      return serviceNotFound(
        res
      );
    }

    await recordAuditEvent({
      req,
      action:
        "service.deleted",
      resourceType:
        "service",
      resourceId:
        service._id,
      before:
        service.toObject(),
      after: null,
    });

    return res.json({
      message:
        "Service deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateServicePublication(
  req,
  res,
  next
) {
  try {
    if (
      invalidServiceId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message:
          "The service identifier is invalid.",
      });
    }

    if (
      typeof req.body.published !==
      "boolean"
    ) {
      return res.status(400).json({
        message:
          "published must be true or false.",
      });
    }

    const businessId =
      managementServiceBusinessId(
        req
      );

    const filter =
      scopedServiceFilter({
        businessId,
        domainFilter: {
          _id:
            req.params.id,
        },
      });

    const before =
      await Service.findOne(
        filter
      ).lean();

    if (!before) {
      return serviceNotFound(
        res
      );
    }

    const service =
      await Service.findOneAndUpdate(
        filter,
        {
          published:
            req.body.published,
        },
        {
          new: true,
          runValidators: true,
        }
      ).select(
        "+onlineBookable"
      );

    if (!service) {
      return serviceNotFound(
        res
      );
    }

    await recordAuditEvent({
      req,
      action:
        "service.publication_updated",
      resourceType:
        "service",
      resourceId:
        service._id,
      before: {
        published:
          typeof before.published ===
          "boolean"
            ? before.published
            : before.active === true,
      },
      after: {
        published:
          service.published,
      },
      metadata: {
        name:
          service.name,
      },
    });

    return res.json({
      message:
        service.published
          ? "Service published."
          : "Service unpublished.",
      service:
        serialiseService(
          service
        ),
    });
  } catch (error) {
    return next(error);
  }
}
