import mongoose from "mongoose";

import Service from "../models/service.js";
import {
  recordAuditEvent,
} from "../services/auditService.js";

function canonicalService(service) {
  if (!service) {
    return service;
  }

  const value =
    typeof service.toObject ===
    "function"
      ? service.toObject()
      : { ...service };

  const legacyBookable =
    value.onlineBookable;

  value.published =
    typeof value.published ===
    "boolean"
      ? value.published
      : value.active === true;

  value.bookable =
    typeof value.bookable ===
    "boolean"
      ? value.bookable
      : legacyBookable !== false;

  delete value.onlineBookable;

  return value;
}

function publicServiceFilter(
  extra = {}
) {
  return {
    ...extra,
    active: {
      $ne: false,
    },
    $or: [
      {
        published: true,
      },
      {
        published: {
          $exists: false,
        },
        active: true,
      },
    ],
  };
}

export async function getServices(
  req,
  res,
  next
) {
  try {
    const services =
      await Service.find(
        publicServiceFilter()
      )
        .select(
          "+onlineBookable"
        )
        .sort({
          name: 1,
        });

    return res.json(
      services.map(
        canonicalService
      )
    );
  } catch (error) {
    next(error);
  }
}

export async function getManagementServices(
  req,
  res,
  next
) {
  try {
    const services =
      await Service.find()
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
          canonicalService
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
    const payload = {
      ...(req.body || {}),
    };

    delete payload.onlineBookable;
    delete payload.published;

    payload.active =
      typeof payload.active ===
      "boolean"
        ? payload.active
        : true;

    payload.bookable =
      typeof payload.bookable ===
      "boolean"
        ? payload.bookable
        : true;

    payload.published = false;

    const service =
      await Service.create(
        payload
      );

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
        canonicalService(
          service
        ),
    });

    return res.status(201).json({
      message:
        "Service created successfully.",
      service:
        canonicalService(
          service
        ),
    });
  } catch (error) {
    next(error);
  }
}

export async function getServiceById(
  req,
  res,
  next
) {
  try {
    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message:
          "The service identifier is invalid.",
      });
    }

    const service =
      await Service.findOne(
        publicServiceFilter({
          _id:
            req.params.id,
        })
      ).select(
        "+onlineBookable"
      );

    if (!service) {
      return res.status(404).json({
        message:
          "Service not found.",
      });
    }

    return res.json(
      canonicalService(
        service
      )
    );
  } catch (error) {
    next(error);
  }
}

export async function updateService(
  req,
  res,
  next
) {
  try {
    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message:
          "The service identifier is invalid.",
      });
    }

    const payload = {
      ...(req.body || {}),
    };

    // Publication remains a separate privileged action.
    delete payload.published;
    delete payload.onlineBookable;

    const before =
      await Service.findById(
        req.params.id
      )
        .select(
          "+onlineBookable"
        )
        .lean();

    if (!before) {
      return res.status(404).json({
        message:
          "Service not found.",
      });
    }

    const service =
      await Service.findByIdAndUpdate(
        req.params.id,
        payload,
        {
          new: true,
          runValidators: true,
        }
      ).select(
        "+onlineBookable"
      );

    await recordAuditEvent({
      req,
      action:
        "service.updated",
      resourceType:
        "service",
      resourceId:
        service._id,
      before:
        canonicalService(
          before
        ),
      after:
        canonicalService(
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
        canonicalService(
          service
        ),
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteService(
  req,
  res,
  next
) {
  try {
    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message:
          "The service identifier is invalid.",
      });
    }

    const service =
      await Service.findByIdAndDelete(
        req.params.id
      ).select(
        "+onlineBookable"
      );

    if (!service) {
      return res.status(404).json({
        message:
          "Service not found.",
      });
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
        canonicalService(
          service
        ),
      after: null,
    });

    return res.json({
      message:
        "Service deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
}

export async function updateServicePublication(
  req,
  res,
  next
) {
  try {
    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message:
          "The service identifier is invalid.",
      });
    }

    // req.body.active is accepted temporarily only for release compatibility.
    const published =
      typeof req.body.published ===
      "boolean"
        ? req.body.published
        : typeof req.body.active ===
            "boolean"
          ? req.body.active
          : null;

    if (
      typeof published !==
      "boolean"
    ) {
      return res.status(400).json({
        message:
          "published must be true or false.",
      });
    }

    const before =
      await Service.findById(
        req.params.id
      )
        .select(
          "+onlineBookable"
        )
        .lean();

    if (!before) {
      return res.status(404).json({
        message:
          "Service not found.",
      });
    }

    const service =
      await Service.findByIdAndUpdate(
        req.params.id,
        {
          published,
        },
        {
          new: true,
          runValidators: true,
        }
      ).select(
        "+onlineBookable"
      );

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
          canonicalService(
            before
          ).published,
      },
      after: {
        published:
          canonicalService(
            service
          ).published,
      },
      metadata: {
        name:
          service.name,
      },
    });

    return res.json({
      message:
        published
          ? "Service published."
          : "Service unpublished.",
      service:
        canonicalService(
          service
        ),
    });
  } catch (error) {
    return next(error);
  }
}
