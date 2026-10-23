import mongoose from "mongoose";

import Appointment from "../models/Appointment.js";
import Customer from "../models/customer.js";
import User from "../models/user.js";

import {
  createAppointmentCheckout,
} from "../features/appointments/appointmentPaymentService.js";

function normaliseText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normaliseEmail(value) {
  return normaliseText(value)
    .toLowerCase();
}

function createHttpError(
  message,
  statusCode = 500,
  details = null
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.status = statusCode;
  error.details = details;

  return error;
}

function assertValidObjectId(
  value,
  fieldName
) {
  if (
    !mongoose.isValidObjectId(
      value
    )
  ) {
    throw createHttpError(
      `${fieldName} must be a valid identifier.`,
      400,
      {
        field: fieldName,
      }
    );
  }

  return value;
}

async function findCustomerProfile(
  user
) {
  if (!user?._id) {
    return null;
  }

  if (
    user.customerProfile &&
    mongoose.isValidObjectId(
      user.customerProfile
    )
  ) {
    const linkedCustomer =
      await Customer.findById(
        user.customerProfile
      );

    if (linkedCustomer) {
      return linkedCustomer;
    }
  }

  const accountCustomer =
    await Customer.findOne({
      userAccount: user._id,
    });

  if (accountCustomer) {
    return accountCustomer;
  }

  const email =
    normaliseEmail(
      user.email
    );

  if (!email) {
    return null;
  }

  return Customer.findOne({
    email,
  });
}

async function linkCustomerAndUser(
  customer,
  user
) {
  if (
    customer.userAccount &&
    String(
      customer.userAccount
    ) !==
      String(user._id)
  ) {
    throw createHttpError(
      "A customer profile with this email address is already linked to another account.",
      409
    );
  }

  let customerChanged =
    false;

  if (
    !customer.userAccount
  ) {
    customer.userAccount =
      user._id;

    customerChanged =
      true;
  }

  if (customerChanged) {
    await customer.save();
  }

  if (
    String(
      user.customerProfile || ""
    ) !==
      String(customer._id)
  ) {
    await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          customerProfile:
            customer._id,
        },
      },
      {
        runValidators: true,
      }
    );

    user.customerProfile =
      customer._id;
  }

  return customer;
}

export async function getAppointments(
  request,
  response,
  next
) {
  try {
    const customer =
      await findCustomerProfile(
        request.user
      );

    if (!customer) {
      return response
        .status(200)
        .json({
          success: true,
          appointments: [],
          total: 0,
        });
    }

    await linkCustomerAndUser(
      customer,
      request.user
    );

    const appointments =
      await Appointment.find({
        customer:
          customer._id,
      })
        .populate(
          "customer",
          "firstName lastName preferredName email phone alternativePhone"
        )
        .populate(
          "service",
          "name category description price duration active published bookable"
        )
        .populate(
          "stylist",
          "name firstName lastName email phone profileImage biography yearsExperience specialties rating isActive acceptsAppointments active"
        )
        .sort({
          startsAt: 1,
          appointmentDate: 1,
          appointmentTime: 1,
        });

    return response
      .status(200)
      .json({
        success: true,
        appointments,
        total:
          appointments.length,
      });
  } catch (error) {
    return next(error);
  }
}

export async function createAppointmentPaymentCheckout(
  request,
  response,
  next
) {
  try {
    const appointmentId =
      assertValidObjectId(
        request.params?.id,
        "appointmentId"
      );

    const customer =
      await findCustomerProfile(
        request.user
      );

    if (!customer) {
      throw createHttpError(
        "Customer profile not found.",
        404
      );
    }

    const ownedAppointment =
      await Appointment.exists({
        _id: appointmentId,
        customer: customer._id,
      });

    if (!ownedAppointment) {
      throw createHttpError(
        "Appointment not found.",
        404
      );
    }

    const result =
      await createAppointmentCheckout(
        appointmentId,
        request.body || {},
        request.user
      );

    return response
      .status(result.reused ? 200 : 201)
      .json({
        success: true,
        message: result.reused
          ? "Existing appointment payment checkout reused."
          : "Appointment payment checkout created successfully.",
        ...result,
      });
  } catch (error) {
    return next(error);
  }
}

export default {
  createAppointmentPaymentCheckout,
  getAppointments,
};
