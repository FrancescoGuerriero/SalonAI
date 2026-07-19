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

export async function createService(
  req,
  res,
  next
) {
  try {
    const service =
      await Service.create(req.body);

    return res.status(201).json({
      message:
        "Service created successfully.",
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

    const service =
      await Service.findById(
        req.params.id
      );

    if (!service) {
      return res.status(404).json({
        message:
          "Service not found."
      });
    }

    return res.json(service);
  } catch (error) {
    next(error);
  }
}