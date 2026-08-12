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
import {
  normaliseProfileImage,
  normalisePublicProfileUrl,
} from "../utils/profileMedia.js";

const PUBLIC_STYLIST_FIELDS = [
  "firstName",
  "lastName",
  "jobTitle",
  "biography",
  "profileImage",
  "yearsExperience",
  "specialties",
  "services",
  "languages",
  "instagram",
  "facebook",
  "website",
  "rating",
  "reviews",
  "displayOrder",
  "profilePublished",
  "isActive",
].join(" ");

function createHttpError(message, statusCode, details = null) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.status = statusCode;
  error.details = details;

  return error;
}

function cleanText(value, maximumLength) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximumLength);
}

function cleanList(value, maximumItems, maximumLength) {
  const input = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(",");

  const unique = new Set();

  for (const item of input) {
    const cleaned = cleanText(
      item,
      maximumLength
    );

    if (cleaned) {
      unique.add(cleaned);
    }

    if (unique.size >= maximumItems) {
      break;
    }
  }

  return [...unique];
}

function splitUserName(name) {
  const parts = cleanText(
    name,
    120
  ).split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return {
      firstName: "Salon",
      lastName: "Professional",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "Stylist",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function normaliseStaffProfileUpdate(body = {}) {
  const yearsExperience =
    Number(body.yearsExperience);

  return {
    jobTitle: cleanText(
      body.jobTitle || "Hair professional",
      120
    ),
    biography: cleanText(
      body.biography,
      2000
    ),
    profileImage:
      normaliseProfileImage(
        body.profileImage
      ),
    yearsExperience:
      Number.isFinite(
        yearsExperience
      )
        ? Math.min(
            80,
            Math.max(
              0,
              Math.round(
                yearsExperience
              )
            )
          )
        : 0,
    specialties: cleanList(
      body.specialties,
      12,
      120
    ),
    languages: cleanList(
      body.languages,
      10,
      80
    ),
    instagram:
      normalisePublicProfileUrl(
        body.instagram,
        {
          allowHandle: true,
        }
      ),
    facebook:
      normalisePublicProfileUrl(
        body.facebook
      ),
    website:
      normalisePublicProfileUrl(
        body.website
      ),
    profilePublished:
      body.profilePublished !==
      false,
  };
}

async function findOwnedStylist(
  user,
  {
    createForStylist = false,
  } = {}
) {
  let stylist =
    await Stylist.findOne({
      $or: [
        {
          userAccount:
            user._id,
        },
        {
          email:
            String(
              user.email ||
                ""
            )
              .trim()
              .toLowerCase(),
        },
      ],
    });

  if (
    !stylist &&
    createForStylist &&
    user.role === "stylist"
  ) {
    const {
      firstName,
      lastName,
    } = splitUserName(
      user.name
    );

    stylist =
      await Stylist.create({
        userAccount:
          user._id,
        firstName,
        lastName,
        email:
          String(
            user.email
          )
            .trim()
            .toLowerCase(),
        phone:
          user.phone || "",
        jobTitle:
          "Hair professional",
        profilePublished:
          false,
      });
  }

  if (
    stylist &&
    !stylist.userAccount
  ) {
    stylist.userAccount =
      user._id;

    await stylist.save();
  }

  return stylist;
}

/*
    GET /api/stylists
    Public legacy catalogue route.
*/
export async function getStylists(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      active,
      sort = "firstName",
    } = req.query;

    const pageNumber =
      Math.max(
        1,
        Number(page) || 1
      );
    const limitNumber =
      Math.min(
        100,
        Math.max(
          1,
          Number(limit) || 10
        )
      );

    const filter = {};

    if (search) {
      filter.$or = [
        {
          firstName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          lastName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          specialties: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    if (
      active !==
      undefined
    ) {
      filter.isActive =
        active === "true";
    }

    const total =
      await Stylist.countDocuments(
        filter
      );

    const stylists =
      await Stylist.find(
        filter
      )
        .populate(
          "services"
        )
        .sort(sort)
        .skip(
          (pageNumber - 1) *
            limitNumber
        )
        .limit(
          limitNumber
        );

    return res.json({
      total,
      page:
        pageNumber,
      pages:
        Math.ceil(
          total /
            limitNumber
        ),
      stylists,
    });
  } catch (error) {
    console.error(
      error
    );

    return res
      .status(500)
      .json({
        message:
          error.message,
      });
  }
}

/*
    GET /api/stylists/public
    Public, privacy-minimised team catalogue for About/team pages.
*/
export async function getPublicStylists(
  req,
  res,
  next
) {
  try {
    const stylists =
      await Stylist.find({
        isActive: {
          $ne: false,
        },
        profilePublished: {
          $ne: false,
        },
      })
        .select(
          PUBLIC_STYLIST_FIELDS
        )
        .populate(
          "services",
          "name category price duration active"
        )
        .sort({
          displayOrder: 1,
          firstName: 1,
          lastName: 1,
        })
        .limit(50)
        .lean();

    return res.json({
      success: true,
      total:
        stylists.length,
      stylists,
    });
  } catch (error) {
    return next(
      error
    );
  }
}

/*
    GET /api/stylists/me/profile
    Authenticated stylist/management self-service public profile.
*/
export async function getMyStylistProfile(
  req,
  res,
  next
) {
  try {
    const stylist =
      await findOwnedStylist(
        req.user,
        {
          createForStylist:
            true,
        }
      );

    if (!stylist) {
      throw createHttpError(
        "No stylist profile is linked to this account. Ask an administrator to create a stylist record using your sign-in email.",
        404
      );
    }

    return res.json({
      success: true,
      stylist,
    });
  } catch (error) {
    return next(
      error
    );
  }
}

/*
    PATCH /api/stylists/me/profile
    Lets a linked staff member publish only public-facing profile fields.
*/
export async function updateMyStylistProfile(
  req,
  res,
  next
) {
  try {
    const stylist =
      await findOwnedStylist(
        req.user,
        {
          createForStylist:
            true,
        }
      );

    if (!stylist) {
      throw createHttpError(
        "No stylist profile is linked to this account.",
        404
      );
    }

    const update =
      normaliseStaffProfileUpdate(
        req.body
      );

    Object.assign(
      stylist,
      update
    );

    await stylist.save();

    return res.json({
      success: true,
      message:
        update.profilePublished
          ? "Your public stylist profile has been published."
          : "Your stylist profile has been saved as unpublished.",
      stylist,
    });
  } catch (error) {
    return next(
      error
    );
  }
}

/*
    GET /api/stylists/:id
*/
export async function getStylist(req, res) {
  try {
    const stylist =
      await Stylist.findById(
        req.params.id
      ).populate(
        "services"
      );

    if (!stylist) {
      return res
        .status(404)
        .json({
          message:
            "Stylist not found",
        });
    }

    return res.json(
      stylist
    );
  } catch (error) {
    return res
      .status(500)
      .json({
        message:
          error.message,
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
    const payload = {
      ...req.body,
      profileImage:
        normaliseProfileImage(
          req.body?.profileImage
        ),
    };

    const stylist =
      await Stylist.create(
        payload
      );

    const populated =
      await Stylist.findById(
        stylist._id
      ).populate(
        "services"
      );

    return res
      .status(201)
      .json(
        populated
      );
  } catch (error) {
    return res
      .status(
        error.statusCode ||
          500
      )
      .json({
        message:
          error.message,
      });
  }
}

/*
    PUT /api/stylists/:id
*/
export async function updateStylist(req, res) {
  try {
    const payload = {
      ...req.body,
    };

    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        "profileImage"
      )
    ) {
      payload.profileImage =
        normaliseProfileImage(
          payload.profileImage
        );
    }

    const stylist =
      await Stylist.findByIdAndUpdate(
        req.params.id,
        payload,
        {
          new: true,
          runValidators: true,
        }
      ).populate(
        "services"
      );

    if (!stylist) {
      return res
        .status(404)
        .json({
          message:
            "Stylist not found",
        });
    }

    return res.json(
      stylist
    );
  } catch (error) {
    return res
      .status(
        error.statusCode ||
          500
      )
      .json({
        message:
          error.message,
      });
  }
}

/*
    DELETE /api/stylists/:id
*/
export async function deleteStylist(req, res) {
  try {
    const stylist =
      await Stylist.findByIdAndDelete(
        req.params.id
      );

    if (!stylist) {
      return res
        .status(404)
        .json({
          message:
            "Stylist not found",
        });
    }

    return res.json({
      message:
        "Stylist deleted successfully",
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        message:
          error.message,
      });
  }
}

/*
    PATCH /api/stylists/:id/status
*/
export async function toggleStylistStatus(req, res) {
  try {
    const stylist =
      await Stylist.findById(
        req.params.id
      );

    if (!stylist) {
      return res
        .status(404)
        .json({
          message:
            "Stylist not found",
        });
    }

    stylist.isActive =
      !stylist.isActive;

    await stylist.save();

    return res.json(
      stylist
    );
  } catch (error) {
    return res
      .status(500)
      .json({
        message:
          error.message,
      });
  }
}
