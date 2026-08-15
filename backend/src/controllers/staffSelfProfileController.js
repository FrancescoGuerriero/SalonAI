import Stylist from "../models/Stylist.js";
import {
  normaliseStaffProfileUpdate,
} from "./stylistController.js";

const MANAGEMENT_ROLES = new Set([
  "stylist",
  "receptionist",
  "manager",
  "admin",
]);

const DEFAULT_JOB_TITLES = {
  stylist: "Hair professional",
  receptionist: "Receptionist",
  manager: "Salon manager",
  admin: "Salon administrator",
};

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  return error;
}

function cleanText(value, maximumLength = 120) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximumLength);
}

function splitUserName(name) {
  const parts = cleanText(name)
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: "Salon",
      lastName: "Professional",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "Professional",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function normalisedEmail(user) {
  return String(user?.email || "")
    .trim()
    .toLowerCase();
}

function assertManagementUser(user) {
  if (!user || !MANAGEMENT_ROLES.has(user.role)) {
    throw createHttpError(
      "A staff or administrator account is required.",
      403
    );
  }
}

async function findOrCreateOwnedProfile(user) {
  assertManagementUser(user);

  const email = normalisedEmail(user);

  let stylist = await Stylist.findOne({
    userAccount: user._id,
  });

  if (!stylist && email) {
    stylist = await Stylist.findOne({
      email,
    });
  }

  if (stylist) {
    if (!stylist.userAccount) {
      stylist.userAccount = user._id;
    }

    if (
      !stylist.profileImage &&
      user.profilePhoto
    ) {
      stylist.profileImage = user.profilePhoto;
    }

    if (stylist.isModified()) {
      await stylist.save();
    }

    return stylist;
  }

  if (!email) {
    throw createHttpError(
      "This staff account needs an email address before a profile can be created.",
      400
    );
  }

  const {
    firstName,
    lastName,
  } = splitUserName(user.name);

  return Stylist.create({
    userAccount: user._id,
    firstName,
    lastName,
    email,
    phone: user.phone || "",
    jobTitle:
      DEFAULT_JOB_TITLES[user.role] ||
      "Salon professional",
    profileImage:
      user.profilePhoto || "",
    profilePublished: false,
  });
}

export async function getMyStaffProfile(
  request,
  response,
  next
) {
  try {
    const stylist =
      await findOrCreateOwnedProfile(
        request.user
      );

    return response.json({
      success: true,
      stylist,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateMyStaffProfile(
  request,
  response,
  next
) {
  try {
    const stylist =
      await findOrCreateOwnedProfile(
        request.user
      );

    const update =
      normaliseStaffProfileUpdate(
        request.body
      );

    Object.assign(
      stylist,
      update
    );

    await stylist.save();

    if (
      Object.prototype.hasOwnProperty.call(
        request.body || {},
        "profileImage"
      ) &&
      request.user
    ) {
      request.user.profilePhoto =
        update.profileImage;
      await request.user.save();
    }

    return response.json({
      success: true,
      message:
        update.profilePublished
          ? "Your public staff profile has been published."
          : "Your staff profile has been saved as unpublished.",
      stylist,
    });
  } catch (error) {
    return next(error);
  }
}

export default {
  getMyStaffProfile,
  updateMyStaffProfile,
};
