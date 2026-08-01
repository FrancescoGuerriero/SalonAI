import mongoose from "mongoose";

import Appointment from "../models/Appointment.js";
import Customer from "../models/Customer.js";
import Service from "../models/Service.js";
import Stylist from "../models/Stylist.js";
import User from "../models/User.js";

import {
  findConflict,
} from "../features/appointments/appointmentManagementService.js";

import {
  assertAppointmentWithinStaffAvailability,
} from "../features/staff/staffService.js";

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

function normaliseTime(value) {
  const time =
    normaliseText(value);

  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      time
    )
  ) {
    throw createHttpError(
      "Appointment time must use HH:mm format.",
      400,
      {
        field:
          "appointmentTime",
      }
    );
  }

  return time;
}

function combineDateAndTime(
  dateValue,
  timeValue
) {
  const time =
    normaliseTime(timeValue);

  const [
    hours,
    minutes,
  ] = time
    .split(":")
    .map(Number);

  let appointmentDate;

  if (
    typeof dateValue === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      dateValue
    )
  ) {
    const [
      year,
      month,
      day,
    ] = dateValue
      .split("-")
      .map(Number);

    appointmentDate =
      new Date(
        year,
        month - 1,
        day,
        hours,
        minutes,
        0,
        0
      );
  } else {
    appointmentDate =
      new Date(dateValue);

    if (
      !Number.isNaN(
        appointmentDate.getTime()
      )
    ) {
      appointmentDate.setHours(
        hours,
        minutes,
        0,
        0
      );
    }
  }

  if (
    Number.isNaN(
      appointmentDate.getTime()
    )
  ) {
    throw createHttpError(
      "The appointment date is invalid.",
      400,
      {
        field:
          "appointmentDate",
      }
    );
  }

  return appointmentDate;
}

function splitCustomerName(
  nameValue
) {
  const parts =
    normaliseText(nameValue)
      .split(" ")
      .filter(Boolean);

  if (
    parts.length === 0
  ) {
    return {
      firstName: "Salon",
      lastName: "Customer",
    };
  }

  if (
    parts.length === 1
  ) {
    return {
      firstName: parts[0],
      lastName: "Customer",
    };
  }

  return {
    firstName:
      parts[0],

    lastName:
      parts
        .slice(1)
        .join(" "),
  };
}

function getCustomerCreationDetails(
  user,
  body = {}
) {
  const nestedCustomer =
    body.customer &&
    typeof body.customer ===
      "object" &&
    !Array.isArray(
      body.customer
    )
      ? body.customer
      : {};

  const nameParts =
    splitCustomerName(
      nestedCustomer.name ||
        body.customerName ||
        user.name
    );

  return {
    firstName:
      normaliseText(
        nestedCustomer.firstName ||
          body.firstName ||
          body.customerFirstName
      ) ||
      nameParts.firstName,

    lastName:
      normaliseText(
        nestedCustomer.lastName ||
          body.lastName ||
          body.customerLastName
      ) ||
      nameParts.lastName,

    email:
      normaliseEmail(
        user.email
      ),

    phone:
      normaliseText(
        nestedCustomer.phone ||
          body.phone ||
          body.customerPhone
      ),
  };
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

async function resolveCustomerProfile(
  user,
  body = {}
) {
  if (!user?._id) {
    throw createHttpError(
      "An authenticated user is required.",
      401
    );
  }

  let customer =
    await findCustomerProfile(
      user
    );

  const details =
    getCustomerCreationDetails(
      user,
      body
    );

  if (!customer) {
    try {
      customer =
        await Customer.create({
          userAccount:
            user._id,

          firstName:
            details.firstName,

          lastName:
            details.lastName,

          email:
            details.email ||
            undefined,

          phone:
            details.phone ||
            undefined,

          source:
            "booking",

          createdBy:
            user._id,

          updatedBy:
            user._id,
        });
    } catch (error) {
      if (
        error?.code !== 11000
      ) {
        throw error;
      }

      customer =
        await findCustomerProfile(
          user
        );

      if (!customer) {
        throw createHttpError(
          "The customer profile could not be created because its email address or phone number is already in use.",
          409
        );
      }
    }
  }

  let customerChanged =
    false;

  if (
    !customer.phone &&
    details.phone
  ) {
    customer.phone =
      details.phone;

    customerChanged =
      true;
  }

  if (
    !customer.email &&
    details.email
  ) {
    customer.email =
      details.email;

    customerChanged =
      true;
  }

  if (customerChanged) {
    customer.updatedBy =
      user._id;

    await customer.save();
  }

  return linkCustomerAndUser(
    customer,
    user
  );
}

async function getBookingResources(
  serviceId,
  stylistId
) {
  assertValidObjectId(
    serviceId,
    "service"
  );

  assertValidObjectId(
    stylistId,
    "stylist"
  );

  const [
    service,
    stylist,
  ] = await Promise.all([
    Service.findById(
      serviceId
    ),

    Stylist.findById(
      stylistId
    ),
  ]);

  if (
    !service ||
    service.active === false
  ) {
    throw createHttpError(
      "The selected service was not found or is inactive.",
      404
    );
  }

  if (
    !stylist ||
    stylist.active === false
  ) {
    throw createHttpError(
      "The selected stylist was not found or is inactive.",
      404
    );
  }

  return {
    service,
    stylist,
  };
}

async function populateAppointment(
  appointmentId
) {
  return Appointment.findById(
    appointmentId
  )
    .populate(
      "customer",
      "firstName lastName preferredName email phone alternativePhone"
    )
    .populate(
      "service",
      "name category description price duration active"
    )
    .populate(
      "stylist",
      "name firstName lastName email phone active"
    );
}

export async function createAppointment(
  request,
  response,
  next
) {
  try {
    const body =
      request.body &&
      typeof request.body ===
        "object"
        ? request.body
        : {};

    const serviceId =
      normaliseText(
        body.service ||
          body.serviceId
      );

    const stylistId =
      normaliseText(
        body.stylist ||
          body.stylistId
      );

    const dateValue =
      body.appointmentDate ||
      body.date;

    const timeValue =
      body.appointmentTime ||
      body.time;

    if (
      !serviceId ||
      !stylistId ||
      !dateValue ||
      !timeValue
    ) {
      throw createHttpError(
        "Service, stylist, date and time are required.",
        400
      );
    }

    const {
      service,
      stylist,
    } = await getBookingResources(
      serviceId,
      stylistId
    );

    const customer =
      await resolveCustomerProfile(
        request.user,
        body
      );

    const startsAt =
      combineDateAndTime(
        dateValue,
        timeValue
      );

    const duration =
      Math.max(
        1,
        Math.min(
          1440,
          Number(
            body.duration ??
              service.duration ??
              60
          ) || 60
        )
      );

    const endsAt =
      new Date(
        startsAt.getTime() +
          duration * 60000
      );

    await assertAppointmentWithinStaffAvailability(
      stylist._id,
      startsAt,
      endsAt
    );

    const conflict =
      await findConflict({
        stylist:
          stylist._id,

        start:
          startsAt,

        end:
          endsAt,
      });

    if (conflict) {
      throw createHttpError(
        "The selected stylist already has an overlapping appointment.",
        409,
        {
          conflict,
        }
      );
    }

    const totalPrice =
      Math.max(
        0,
        Number(
          body.totalPrice ??
            body.price ??
            service.price ??
            0
        ) || 0
      );

    const appointment =
      await Appointment.create({
        customer:
          customer._id,

        service:
          service._id,

        stylist:
          stylist._id,

        appointmentDate:
          startsAt,

        appointmentTime:
          normaliseTime(
            timeValue
          ),

        startsAt,
        endsAt,
        duration,

        totalPrice,

        discount:
          Math.max(
            0,
            Number(
              body.discount
            ) || 0
          ),

        tax:
          Math.max(
            0,
            Number(
              body.tax
            ) || 0
          ),

        status:
          "pending",

        notes:
          normaliseText(
            body.notes
          ),

        createdBy:
          request.user._id,

        updatedBy:
          request.user._id,
      });

    const populatedAppointment =
      await populateAppointment(
        appointment._id
      );

    if (
      !customer.nextAppointment ||
      startsAt <
        new Date(
          customer.nextAppointment
        )
    ) {
      customer.nextAppointment =
        startsAt;

      customer.updatedBy =
        request.user._id;

      await customer.save();
    }

    return response
      .status(201)
      .json({
        success: true,

        message:
          "Appointment created successfully.",

        appointment:
          populatedAppointment,
      });
  } catch (error) {
    return next(error);
  }
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
          "name category description price duration active"
        )
        .populate(
          "stylist",
          "name firstName lastName email phone active"
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

export default {
  createAppointment,
  getAppointments,
};