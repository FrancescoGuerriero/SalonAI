import mongoose from "mongoose";

import Service from "../models/service.js";

export async function getServices(
  req,
  res,
  next
) {
  try {
    const services = await Service.find({
      active: true
    }).sort({
      name: 1
    });

    return res.json(services);
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
    const services = await Service.find()
      .sort({
        name: 1,
      });

    return res.json({
      success: true,
      services,
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
    const service = await Service.create({
      ...req.body,
      active: false,
    });

    return res.status(201).json({
      message: "Service created successfully.",
      service
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
          "The service identifier is invalid."
      });
    }

    const service = await Service.findOne({
      _id:
        req.params.id,
      active: true,
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found."
      });
    }

    return res.json(service);
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
          "The service identifier is invalid."
      });
    }

    const payload = {
      ...req.body,
    };

    // Publication is a separate privileged action.
    delete payload.active;

    const service =
      await Service.findByIdAndUpdate(
        req.params.id,
        payload,
        {
          new: true,
          runValidators: true
        }
      );

    if (!service) {
      return res.status(404).json({
        message: "Service not found."
      });
    }

    return res.json({
      message: "Service updated successfully.",
      service
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
          "The service identifier is invalid."
      });
    }

    const service =
      await Service.findByIdAndDelete(
        req.params.id
      );

    if (!service) {
      return res.status(404).json({
        message: "Service not found."
      });
    }

    return res.json({
      message: "Service deleted successfully."
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

    if (
      typeof req.body.active !==
      "boolean"
    ) {
      return res.status(400).json({
        message:
          "active must be true or false.",
      });
    }

    const service =
      await Service.findByIdAndUpdate(
        req.params.id,
        {
          active:
            req.body.active,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!service) {
      return res.status(404).json({
        message:
          "Service not found.",
      });
    }

    return res.json({
      message:
        service.active
          ? "Service published."
          : "Service unpublished.",
      service,
    });
  } catch (error) {
    return next(error);
  }
}
