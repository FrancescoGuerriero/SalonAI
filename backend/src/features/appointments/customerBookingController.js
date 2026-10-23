import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import Service from "../../models/service.js";
import Stylist from "../../models/Stylist.js";
import User from "../../models/user.js";

import {
  combineDateAndTime,
  createManagedAppointment,
} from "./appointmentManagementService.js";
import {
  stylistOffersService,
} from "../../services/bookingAvailabilityService.js";
import {
  isAppointmentEligibleStylist,
} from "../../services/stylistBookingEligibilityService.js";

function normaliseText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normaliseEmail(value) {
  return normaliseText(value).toLowerCase();
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
  if (!mongoose.isValidObjectId(value)) {
    throw createHttpError(
      `${fieldName} must be a valid identifier.`,
      400,
      { field: fieldName }
    );
  }

  return value;
}

function splitCustomerName(nameValue) {
  const parts = normaliseText(nameValue)
    .split(" ")
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: "Salon",
      lastName: "Customer",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "Customer",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function getCustomerCreationDetails(
  user,
  body = {}
) {
  const nestedCustomer =
    body.customer &&
    typeof body.customer === "object" &&
    !Array.isArray(body.customer)
      ? body.customer
      : {};

  const nameParts = splitCustomerName(
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
      ) || nameParts.firstName,

    lastName:
      normaliseText(
        nestedCustomer.lastName ||
          body.lastName ||
          body.customerLastName
      ) || nameParts.lastName,

    email: normaliseEmail(user.email),

    phone: normaliseText(
      nestedCustomer.phone ||
        body.phone ||
        body.customerPhone
    ),
  };
}

async function findCustomerProfile(user) {
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

  const email = normaliseEmail(
    user.email
  );

  if (!email) {
    return null;
  }

  return Customer.findOne({ email });
}

async function linkCustomerAndUser(
  customer,
  user
) {
  if (
    customer.userAccount &&
    String(customer.userAccount) !==
      String(user._id)
  ) {
    throw createHttpError(
      "A customer profile with this email address is already linked to another account.",
      409
    );
  }

  if (!customer.userAccount) {
    customer.userAccount = user._id;
    await customer.save();
  }

  if (
    String(
      user.customerProfile || ""
    ) !== String(customer._id)
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
    await findCustomerProfile(user);

  const details =
    getCustomerCreationDetails(
      user,
      body
    );

  if (!customer) {
    try {
      customer = await Customer.create({
        userAccount: user._id,
        firstName: details.firstName,
        lastName: details.lastName,
        email:
          details.email ||
          undefined,
        phone:
          details.phone ||
          undefined,
        source: "booking",
        createdBy: user._id,
        updatedBy: user._id,
      });
    } catch (error) {
      if (error?.code !== 11000) {
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

  let customerChanged = false;

  if (
    !customer.phone &&
    details.phone
  ) {
    customer.phone =
      details.phone;
    customerChanged = true;
  }

  if (
    !customer.email &&
    details.email
  ) {
    customer.email =
      details.email;
    customerChanged = true;
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

async function getCustomerBookingResources(
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
    ).select(
      "+onlineBookable"
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
    service.published === false
  ) {
    throw createHttpError(
      "The selected service is not published.",
      409,
      { field: "service" }
    );
  }

  const serviceBookable =
    typeof service.bookable ===
    "boolean"
      ? service.bookable
      : service.onlineBookable !==
        false;

  if (serviceBookable === false) {
    throw createHttpError(
      "The selected service is not available for booking.",
      409,
      { field: "service" }
    );
  }

  if (
    !isAppointmentEligibleStylist(
      stylist
    ) ||
    stylist.active === false
  ) {
    throw createHttpError(
      "The selected stylist was not found or is not currently bookable.",
      404
    );
  }

  if (
    !stylistOffersService(
      stylist,
      service._id
    )
  ) {
    throw createHttpError(
      "The selected stylist does not offer this service.",
      409,
      { field: "service" }
    );
  }

  return {
    service,
    stylist,
  };
}

async function populateCustomerAppointment(
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
      "name category description price duration active published bookable"
    )
    .populate(
      "stylist",
      "name firstName lastName email phone profileImage biography yearsExperience specialties rating isActive acceptsAppointments active"
    );
}

function preserveCustomerConflictMessage(
  error
) {
  if (
    error?.statusCode === 409 &&
    error?.message ===
      "The stylist already has an overlapping appointment."
  ) {
    error.message =
      "The selected stylist already has an overlapping appointment.";
  }

  return error;
}

export async function createCustomerAppointment(
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
    } =
      await getCustomerBookingResources(
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

    if (startsAt <= new Date()) {
      throw createHttpError(
        "The appointment date and time must be in the future.",
        409,
        {
          field:
            "appointmentDate",
        }
      );
    }

    const duration = Math.max(
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

    const totalPrice = Math.max(
      0,
      Number(
        body.totalPrice ??
          body.price ??
          service.price ??
          0
      ) || 0
    );

    const appointment =
      await createManagedAppointment(
        {
          customer:
            customer._id,
          service:
            service._id,
          stylist:
            stylist._id,
          startsAt,
          duration,
          totalPrice,
          discount: Math.max(
            0,
            Number(
              body.discount
            ) || 0
          ),
          tax: Math.max(
            0,
            Number(body.tax) || 0
          ),
          status: "pending",
          notes: normaliseText(
            body.notes
          ),
        },
        {
          actor: request.user,
          bookingSource:
            "website",
          returnPopulated:
            false,
        }
      );

    const populatedAppointment =
      await populateCustomerAppointment(
        appointment._id
      );

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
    return next(
      preserveCustomerConflictMessage(
        error
      )
    );
  }
}

export default {
  createCustomerAppointment,
};
