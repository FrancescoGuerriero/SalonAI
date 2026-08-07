import mongoose from "mongoose";

import Stylist from "../models/Stylist.js";
import Service from "../models/service.js";
import {
  dayAvailability,
} from "../features/staff/staffService.js";
import {
  buildAvailableSlots,
  parseBookingDate,
  stylistOffersService,
} from "../services/bookingAvailabilityService.js";

function createHttpError(message, statusCode, details = null) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.status = statusCode;
  error.details = details;

  return error;
}

/*
    GET /api/stylists
    Public
*/
export async function getStylists(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      active,
      sort = "firstName"
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        {
          firstName: {
            $regex: search,
            $options: "i"
          }
        },
        {
          lastName: {
            $regex: search,
            $options: "i"
          }
        },
        {
          specialties: {
            $regex: search,
            $options: "i"
          }
        }
      ];
    }

    if (active !== undefined) {
      filter.isActive = active === "true";
    }

    const total = await Stylist.countDocuments(filter);

    const stylists = await Stylist.find(filter)
      .populate("services")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      stylists
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message
    });
  }
}

/*
    GET /api/stylists/:id
*/
export async function getStylist(req, res) {
  try {

    const stylist = await Stylist.findById(req.params.id)
      .populate("services");

    if (!stylist) {
      return res.status(404).json({
        message: "Stylist not found"
      });
    }

    res.json(stylist);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }
}

/*
    GET /api/stylists/:id/availability
    Public booking-safe availability. No customer or appointment details are exposed.
*/
export async function getStylistAvailability(req, res, next) {
  try {
    const stylistId = String(req.params.id || "").trim();
    const serviceId = String(req.query.service || "").trim();
    const dateText = String(req.query.date || "").trim();

    if (!mongoose.isValidObjectId(stylistId)) {
      throw createHttpError(
        "The stylist identifier is invalid.",
        400,
        { field: "stylist" }
      );
    }

    if (!mongoose.isValidObjectId(serviceId)) {
      throw createHttpError(
        "A valid service identifier is required.",
        400,
        { field: "service" }
      );
    }

    const targetDate = parseBookingDate(dateText);
    const stylistObjectId = new mongoose.Types.ObjectId(stylistId);
    const serviceObjectId = new mongoose.Types.ObjectId(serviceId);
    const [service, stylist] = await Promise.all([
      Service.findOne({
        _id: serviceObjectId,
        active: { $ne: false },
      }).lean(),
      Stylist.findById(stylistObjectId)
        .select("services isActive")
        .lean(),
    ]);

    if (!service) {
      throw createHttpError(
        "The selected service was not found or is inactive.",
        404
      );
    }

    if (!stylist || stylist.isActive === false) {
      throw createHttpError(
        "The selected stylist was not found or is inactive.",
        404
      );
    }

    if (!stylistOffersService(stylist, serviceObjectId)) {
      throw createHttpError(
        "The selected stylist does not offer this service.",
        409,
        { field: "service" }
      );
    }

    const availability = await dayAvailability(
      stylistObjectId,
      targetDate
    );

    const ranges = availability.availability?.ranges || [];
    const slots = buildAvailableSlots({
      date: targetDate,
      ranges,
      appointments: availability.appointments,
      timeOff: availability.timeOff,
      duration: service.duration,
    });

    return res.json({
      success: true,
      date: dateText,
      stylist: stylistId,
      service: {
        _id: service._id,
        name: service.name,
        duration: service.duration,
      },
      ranges,
      slots,
      available: slots.length > 0,
    });
  } catch (error) {
    return next(error);
  }
}

/*
    POST /api/stylists
*/
export async function createStylist(req, res) {

  try {

    const stylist = await Stylist.create(req.body);

    const populated = await Stylist.findById(stylist._id)
      .populate("services");

    res.status(201).json(populated);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

}

/*
    PUT /api/stylists/:id
*/
export async function updateStylist(req, res) {

  try {

    const stylist = await Stylist.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate("services");

    if (!stylist) {

      return res.status(404).json({
        message: "Stylist not found"
      });

    }

    res.json(stylist);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

}

/*
    DELETE /api/stylists/:id
*/
export async function deleteStylist(req, res) {

  try {

    const stylist = await Stylist.findByIdAndDelete(
      req.params.id
    );

    if (!stylist) {

      return res.status(404).json({
        message: "Stylist not found"
      });

    }

    res.json({
      message: "Stylist deleted successfully"
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

}

/*
    PATCH /api/stylists/:id/status
*/
export async function toggleStylistStatus(req, res) {

  try {

    const stylist = await Stylist.findById(
      req.params.id
    );

    if (!stylist) {

      return res.status(404).json({
        message: "Stylist not found"
      });

    }

    stylist.isActive = !stylist.isActive;

    await stylist.save();

    res.json(stylist);

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

}
