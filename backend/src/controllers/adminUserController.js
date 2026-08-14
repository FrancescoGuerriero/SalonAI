import bcrypt from "bcrypt";

import User from "../models/user.js";
import Stylist from "../models/Stylist.js";

import {
  normaliseProfileImage,
} from "../utils/profileMedia.js";

export const STAFF_ROLES = Object.freeze([
  "stylist",
  "receptionist",
  "manager",
  "admin",
]);

function httpError(
  message,
  statusCode
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;
  error.status =
    statusCode;

  return error;
}

function cleanText(
  value,
  maximumLength
) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(/\s+/g, " ")
    .slice(
      0,
      maximumLength
    );
}

function normaliseEmail(
  value
) {
  return cleanText(
    value,
    254
  ).toLowerCase();
}

function splitName(
  value
) {
  const parts =
    cleanText(
      value,
      120
    )
      .split(/\s+/)
      .filter(Boolean);

  if (!parts.length) {
    return {
      firstName: "Salon",
      lastName: "Professional",
    };
  }

  if (
    parts.length === 1
  ) {
    return {
      firstName:
        parts[0],
      lastName:
        "Professional",
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

function serialiseAdminUser(
  user,
  stylist = null
) {
  return {
    id:
      user._id,
    name:
      user.name,
    email:
      user.email,
    role:
      user.role,
    phone:
      user.phone || "",
    profilePhoto:
      user.profilePhoto || "",
    isActive:
      user.isActive !== false,
    emailVerified:
      Boolean(
        user.emailVerified
      ),
    createdAt:
      user.createdAt,
    updatedAt:
      user.updatedAt,
    stylistProfile:
      stylist
        ? {
            id:
              stylist._id,
            firstName:
              stylist.firstName,
            lastName:
              stylist.lastName,
            jobTitle:
              stylist.jobTitle,
            profileImage:
              stylist.profileImage || "",
            profilePublished:
              stylist.profilePublished !==
              false,
            isActive:
              stylist.isActive !==
              false,
          }
        : null,
  };
}

async function stylistForUser(
  user
) {
  if (
    user.role !==
    "stylist"
  ) {
    return null;
  }

  return Stylist.findOne({
    $or: [
      {
        userAccount:
          user._id,
      },
      {
        email:
          user.email,
      },
    ],
  });
}

async function createOrLinkStylist(
  user
) {
  let stylist =
    await Stylist.findOne({
      email:
        user.email,
    });

  if (
    stylist?.userAccount &&
    String(
      stylist.userAccount
    ) !==
      String(user._id)
  ) {
    throw httpError(
      "A stylist profile with this email is already linked to another account.",
      409
    );
  }

  if (stylist) {
    stylist.userAccount =
      user._id;

    if (
      !stylist.phone &&
      user.phone
    ) {
      stylist.phone =
        user.phone;
    }

    if (
      !stylist.profileImage &&
      user.profilePhoto
    ) {
      stylist.profileImage =
        user.profilePhoto;
    }

    stylist.isActive =
      user.isActive !==
      false;

    await stylist.save();

    return stylist;
  }

  const {
    firstName,
    lastName,
  } = splitName(
    user.name
  );

  stylist =
    await Stylist.create({
      userAccount:
        user._id,
      firstName,
      lastName,
      email:
        user.email,
      phone:
        user.phone || "",
      profileImage:
        user.profilePhoto || "",
      jobTitle:
        "Hair professional",
      profilePublished:
        false,
      isActive:
        user.isActive !==
        false,
    });

  return stylist;
}

export async function listAdminUsers(
  req,
  res,
  next
) {
  try {
    const page =
      Math.max(
        1,
        Number(
          req.query.page
        ) || 1
      );

    const limit =
      Math.min(
        100,
        Math.max(
          1,
          Number(
            req.query.limit
          ) || 50
        )
      );

    const search =
      cleanText(
        req.query.search,
        120
      );

    const role =
      cleanText(
        req.query.role,
        30
      );

    const filter = {};

    if (role) {
      if (
        !STAFF_ROLES.includes(
          role
        ) &&
        role !== "customer"
      ) {
        throw httpError(
          "Invalid role filter.",
          400
        );
      }

      filter.role =
        role;
    }

    if (search) {
      filter.$or = [
        {
          name: {
            $regex:
              search,
            $options:
              "i",
          },
        },
        {
          email: {
            $regex:
              search,
            $options:
              "i",
          },
        },
      ];
    }

    const [
      total,
      users,
    ] =
      await Promise.all([
        User.countDocuments(
          filter
        ),
        User.find(
          filter
        )
          .select(
            "name email role phone profilePhoto isActive emailVerified createdAt updatedAt"
          )
          .sort({
            name: 1,
            email: 1,
          })
          .skip(
            (page - 1) *
              limit
          )
          .limit(
            limit
          )
          .lean(),
      ]);

    const stylistLinks =
      await Stylist.find({
        userAccount: {
          $in:
            users.map(
              (user) =>
                user._id
            ),
        },
      })
        .select(
          "userAccount firstName lastName jobTitle profileImage profilePublished isActive"
        )
        .lean();

    const stylistMap =
      new Map(
        stylistLinks.map(
          (stylist) => [
            String(
              stylist.userAccount
            ),
            stylist,
          ]
        )
      );

    return res.json({
      success: true,
      page,
      limit,
      total,
      pages:
        Math.ceil(
          total / limit
        ),
      users:
        users.map(
          (user) =>
            serialiseAdminUser(
              user,
              stylistMap.get(
                String(
                  user._id
                )
              ) || null
            )
        ),
    });
  } catch (error) {
    return next(error);
  }
}

export async function createStaffUserByAdmin(
  req,
  res,
  next
) {
  let createdUser =
    null;

  try {
    const name =
      cleanText(
        req.body.name,
        120
      );

    const email =
      normaliseEmail(
        req.body.email
      );

    const password =
      String(
        req.body.password ||
          ""
      );

    const role =
      cleanText(
        req.body.role,
        30
      );

    const phone =
      cleanText(
        req.body.phone,
        30
      );

    const profilePhoto =
      normaliseProfileImage(
        req.body.profilePhoto
      );

    if (
      !name ||
      !email ||
      !password
    ) {
      throw httpError(
        "Name, email and password are required.",
        400
      );
    }

    if (
      password.length < 8
    ) {
      throw httpError(
        "Password must contain at least 8 characters.",
        400
      );
    }

    if (
      !STAFF_ROLES.includes(
        role
      )
    ) {
      throw httpError(
        "Staff role must be stylist, receptionist, manager or admin.",
        400
      );
    }

    const existingUser =
      await User.findOne({
        email,
      });

    if (existingUser) {
      throw httpError(
        "An account already exists for this email address.",
        409
      );
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    createdUser =
      await User.create({
        name,
        email,
        password:
          hashedPassword,
        role,
        phone,
        profilePhoto,
        createdBy:
          req.user._id,
      });

    let stylist =
      null;

    if (
      role ===
      "stylist"
    ) {
      stylist =
        await createOrLinkStylist(
          createdUser
        );
    }

    return res
      .status(201)
      .json({
        success: true,
        message:
          role ===
          "stylist"
            ? "Staff account created and linked to a stylist profile."
            : "Staff account created successfully.",
        user:
          serialiseAdminUser(
            createdUser,
            stylist
          ),
      });
  } catch (error) {
    if (
      createdUser?._id
    ) {
      try {
        await Stylist.updateMany(
          {
            userAccount:
              createdUser._id,
          },
          {
            $unset: {
              userAccount:
                1,
            },
          }
        );

        await User.deleteOne({
          _id:
            createdUser._id,
        });
      } catch (
        rollbackError
      ) {
        console.error(
          "Unable to roll back failed staff account creation:",
          rollbackError
        );
      }
    }

    return next(error);
  }
}

export async function updateAdminUserStatus(
  req,
  res,
  next
) {
  try {
    const requested =
      req.body.isActive;

    if (
      typeof requested !==
      "boolean"
    ) {
      throw httpError(
        "isActive must be true or false.",
        400
      );
    }

    const user =
      await User.findById(
        req.params.id
      );

    if (!user) {
      throw httpError(
        "User account not found.",
        404
      );
    }

    if (
      String(user._id) ===
        String(
          req.user._id
        ) &&
      requested === false
    ) {
      throw httpError(
        "You cannot deactivate your own administrator account.",
        409
      );
    }

    if (
      user.role ===
        "admin" &&
      requested ===
        false
    ) {
      const activeAdmins =
        await User.countDocuments({
          role:
            "admin",
          isActive: {
            $ne:
              false,
          },
        });

      if (
        activeAdmins <= 1
      ) {
        throw httpError(
          "The final active administrator account cannot be deactivated.",
          409
        );
      }
    }

    user.isActive =
      requested;

    user.updatedBy =
      req.user._id;

    await user.save();

    let stylist =
      await stylistForUser(
        user
      );

    if (stylist) {
      stylist.isActive =
        requested;

      await stylist.save();
    }

    return res.json({
      success: true,
      message:
        requested
          ? "Staff account activated."
          : "Staff account deactivated.",
      user:
        serialiseAdminUser(
          user,
          stylist
        ),
    });
  } catch (error) {
    return next(error);
  }
}
