import mongoose from "mongoose";

import Appointment from "../models/Appointment.js";
import Service from "../models/service.js";
import Stylist from "../models/Stylist.js";

export async function createAppointment(
  req,
  res,
  next
) {
  try {
    const {
      service,
      stylist,
      date,
      time
    } = req.body;

    if (
      !service ||
      !stylist ||
      !date ||
      !time
    ) {
      return res.status(400).json({
        message:
          "Service, stylist, date and time are required."
      });
    }

    if (
      !mongoose.isValidObjectId(service) ||
      !mongoose.isValidObjectId(stylist)
    ) {
      return res.status(400).json({
        message:
          "The selected service or stylist is invalid."
      });
    }

    const appointmentDate = new Date(date);

    if (
      Number.isNaN(appointmentDate.getTime())
    ) {
      return res.status(400).json({
        message:
          "The appointment date is invalid."
      });
    }

    const [serviceExists, stylistExists] =
      await Promise.all([
        Service.exists({
          _id: service,
          active: true
        }),
        Stylist.exists({
          _id: stylist,
          active: true
        })
      ]);

    if (!serviceExists) {
      return res.status(404).json({
        message:
          "The selected service was not found."
      });
    }

    if (!stylistExists) {
      return res.status(404).json({
        message:
          "The selected stylist was not found."
      });
    }

    const appointment =
      await Appointment.create({
        customer: req.user._id,
        service,
        stylist,
        date: appointmentDate,
        time
      });

    const populatedAppointment =
      await Appointment.findById(
        appointment._id
      )
        .populate(
          "customer",
          "name email"
        )
        .populate("service")
        .populate("stylist");

    return res.status(201).json({
      message:
        "Appointment created successfully.",
      appointment: populatedAppointment
    });
  } catch (error) {
    next(error);
  }
}

export async function getAppointments(
  req,
  res,
  next
) {
  try {
    const appointments =
      await Appointment.find({
        customer: req.user._id
      })
        .populate(
          "customer",
          "name email"
        )
        .populate("service")
        .populate("stylist")
        .sort({
          date: 1,
          time: 1
        });

    return res.json(appointments);
  } catch (error) {
    next(error);
  }
}