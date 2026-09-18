import bcrypt from "bcrypt";
import mongoose from "mongoose";

import User from "../models/user.js";
import Stylist from "../models/Stylist.js";
import Service from "../models/service.js";

import {
  normaliseProfileImage,
} from "../utils/profileMedia.js";
import {
  recordAuditEvent,
} from "../services/auditService.js";
import {
  EMPLOYEE_PERMISSION_SET,
} from "../constants/permissions.js";

export const STAFF_ROLES = Object.freeze([
  "stylist",
  "receptionist",
  "manager",
  "admin",
  "super_admin",
]);

const ASSIGNABLE_STAFF_ROLES = Object.freeze([
  "stylist",
  "receptionist",
  "manager",
  "admin",
]);

const EMPLOYEE_SETTING_FIELDS = Object.freeze([
  "role",
  "profilePublished",
  "acceptsAppointments",
  "permissions",
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

function assertStaffAccount(
  user
) {
  if (
    !user ||
    !STAFF_ROLES.includes(
      user.role
    )
  ) {
    throw httpError(
      "Employee account not found.",
      404
    );
  }

  return user;
}

const TIME_PATTERN =
  /^([01]\d|2[0-3]):[0-5]\d$/;

const WORKING_DAYS =
  Object.freeze([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);

function timeMinutes(value) {
  const [hours, minutes] =
    String(value)
      .split(":")
      .map(Number);

  return hours * 60 +
    minutes;
}

export function normaliseEmployeeSchedule(
  workingHours
) {
  if (
    !Array.isArray(
      workingHours
    )
  ) {
    throw httpError(
      "workingHours must be an array.",
      400
    );
  }

  const seen =
    new Set();

  return workingHours.map(
    (row) => {
      const day =
        cleanText(
          row?.day,
          20
        );
      const available =
        row?.available !==
        false;
      const start =
        cleanText(
          row?.start ||
            "09:00",
          5
        );
      const end =
        cleanText(
          row?.end ||
            "17:00",
          5
        );

      if (
        !WORKING_DAYS.includes(
          day
        ) ||
        seen.has(day)
      ) {
        throw httpError(
          "Each working day must be valid and appear only once.",
          400
        );
      }

      seen.add(day);

      if (
        !TIME_PATTERN.test(
          start
        ) ||
        !TIME_PATTERN.test(
          end
        ) ||
        timeMinutes(end) <=
          timeMinutes(start)
      ) {
        throw httpError(
          `${day} working hours must use a valid start and end time.`,
          400
        );
      }

      const breaks =
        (Array.isArray(
          row?.breaks
        )
          ? row.breaks
          : [])
          .map((pause) => ({
            start:
              cleanText(
                pause?.start,
                5
              ),
            end:
              cleanText(
                pause?.end,
                5
              ),
          }))
          .filter(
            (pause) =>
              pause.start ||
              pause.end
          );

      for (const pause of breaks) {
        if (
          !TIME_PATTERN.test(
            pause.start
          ) ||
          !TIME_PATTERN.test(
            pause.end
          ) ||
          timeMinutes(
            pause.end
          ) <=
            timeMinutes(
              pause.start
            ) ||
          timeMinutes(
            pause.start
          ) <
            timeMinutes(start) ||
          timeMinutes(
            pause.end
          ) >
            timeMinutes(end)
        ) {
          throw httpError(
            `${day} breaks must fall within working hours.`,
            400
          );
        }
      }

      const sortedBreaks =
        breaks.sort(
          (left, right) =>
            timeMinutes(
              left.start
            ) -
            timeMinutes(
              right.start
            )
        );

      for (
        let index = 1;
        index <
        sortedBreaks.length;
        index += 1
      ) {
        if (
          timeMinutes(
            sortedBreaks[index]
              .start
          ) <
          timeMinutes(
            sortedBreaks[
              index - 1
            ].end
          )
        ) {
          throw httpError(
            `${day} breaks must not overlap.`,
            400
          );
        }
      }

      return {
        day,
        start,
        end,
        available,
        breaks:
          sortedBreaks,
      };
    }
  );
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
    accountLinked:
      true,
    employeeType:
      "account",
    name:
      user.name,
    email:
      user.email,
    role:
      user.role,
    permissions:
      user.permissions || [],
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
              stylist.profilePublished ===
              true,
            acceptsAppointments:
              stylist.acceptsAppointments ===
              true,
            isActive:
              stylist.isActive ===
              true,
            workingHours:
              stylist.workingHours || [],
            services:
              stylist.services || [],
          }
        : null,
  };
}

function serialiseProfileOnlyEmployee(
  stylist
) {
  return {
    id:
      `profile:${stylist._id}`,
    accountLinked:
      false,
    employeeType:
      "profile-only",
    name:
      [stylist.firstName, stylist.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      stylist.email ||
      "Salon employee",
    email:
      stylist.email || "",
    role:
      "stylist",
    permissions: [],
    phone:
      stylist.phone || "",
    profilePhoto:
      stylist.profileImage || "",
    isActive:
      stylist.isActive === true,
    emailVerified:
      false,
    createdAt:
      stylist.createdAt,
    updatedAt:
      stylist.updatedAt,
    stylistProfile: {
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
        stylist.profilePublished === true,
      acceptsAppointments:
        stylist.acceptsAppointments === true,
      isActive:
        stylist.isActive === true,
      workingHours:
        stylist.workingHours || [],
      services:
        stylist.services || [],
    },
  };
}

async function stylistForUser(
  user
) {
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
  user,
  {
    profilePublished = false,
    acceptsAppointments = false,
  } = {}
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

    stylist.profilePublished =
      Boolean(
        profilePublished
      );

    stylist.acceptsAppointments =
      Boolean(
        acceptsAppointments
      );

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
        Boolean(
          profilePublished
        ),
      acceptsAppointments:
        Boolean(
          acceptsAppointments
        ),
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
        500,
        Math.max(
          1,
          Number(
            req.query.limit
          ) || 100
        )
      );

    const search =
      cleanText(
        req.query.search,
        120
      ).toLowerCase();

    const role =
      cleanText(
        req.query.role,
        30
      );

    if (
      role &&
      !STAFF_ROLES.includes(
        role
      )
    ) {
      throw httpError(
        "Invalid role filter.",
        400
      );
    }

    /*
     * Employee management is a union of staff login accounts and stylist
     * profiles. Production contains legacy stylist profiles that pre-date the
     * management User account model; starting the roster from User.find()
     * silently hid those employees.
     */
    const [
      staffUsers,
      stylistProfiles,
    ] =
      await Promise.all([
        User.find({
          role: {
            $in:
              STAFF_ROLES,
          },
        })
          .select(
            "name email role permissions phone profilePhoto isActive emailVerified createdAt updatedAt"
          )
          .sort({
            name: 1,
            email: 1,
          })
          .limit(500)
          .lean(),
        Stylist.find()
          .select(
            "userAccount email firstName lastName jobTitle profileImage profilePublished acceptsAppointments isActive workingHours services phone createdAt updatedAt"
          )
          .populate(
            "services",
            "name category active onlineBookable"
          )
          .sort({
            displayOrder: 1,
            firstName: 1,
            lastName: 1,
          })
          .limit(500)
          .lean(),
      ]);

    const userIds =
      new Set(
        staffUsers.map(
          (user) =>
            String(
              user._id
            )
        )
      );

    const userEmails =
      new Set(
        staffUsers.map(
          (user) =>
            String(
              user.email || ""
            ).toLowerCase()
        )
      );

    const stylistByUserId =
      new Map();
    const stylistByEmail =
      new Map();

    for (
      const stylist of
      stylistProfiles
    ) {
      if (
        stylist.userAccount
      ) {
        stylistByUserId.set(
          String(
            stylist.userAccount
          ),
          stylist
        );
      }

      if (stylist.email) {
        stylistByEmail.set(
          String(
            stylist.email
          ).toLowerCase(),
          stylist
        );
      }
    }

    const accountEmployees =
      staffUsers.map(
        (user) =>
          serialiseAdminUser(
            user,
            stylistByUserId.get(
              String(
                user._id
              )
            ) ||
              stylistByEmail.get(
                String(
                  user.email || ""
                ).toLowerCase()
              ) ||
              null
          )
      );

    const profileOnlyEmployees =
      stylistProfiles
        .filter(
          (stylist) =>
            !(
              stylist.userAccount &&
              userIds.has(
                String(
                  stylist.userAccount
                )
              )
            ) &&
            !userEmails.has(
              String(
                stylist.email || ""
              ).toLowerCase()
            )
        )
        .map(
          serialiseProfileOnlyEmployee
        );

    const allEmployees =
      [
        ...accountEmployees,
        ...profileOnlyEmployees,
      ]
        .filter(
          (employee) =>
            !role ||
            employee.role ===
              role
        )
        .filter(
          (employee) => {
            if (!search) {
              return true;
            }

            return [
              employee.name,
              employee.email,
              employee.phone,
              employee.role,
              employee.stylistProfile
                ?.jobTitle,
            ].some(
              (value) =>
                String(
                  value || ""
                )
                  .toLowerCase()
                  .includes(
                    search
                  )
            );
          }
        )
        .sort(
          (left, right) =>
            String(
              left.name || ""
            ).localeCompare(
              String(
                right.name || ""
              ),
              "en",
              {
                sensitivity:
                  "base",
              }
            )
        );

    const total =
      allEmployees.length;
    const offset =
      (page - 1) *
      limit;
    const users =
      allEmployees.slice(
        offset,
        offset + limit
      );

    return res.json({
      success: true,
      page,
      limit,
      total,
      pages:
        Math.max(
          1,
          Math.ceil(
            total / limit
          )
        ),
      users,
    });
  } catch (error) {
    return next(error);
  }
}

async function employeeAndProfile(
  employeeId,
  {
    createProfile = false,
  } = {}
) {
  if (
    !mongoose.isValidObjectId(
      employeeId
    )
  ) {
    throw httpError(
      "Employee identifier is invalid.",
      400
    );
  }

  const user =
    await User.findById(
      employeeId
    ).select(
      "name email role permissions phone profilePhoto isActive emailVerified createdAt updatedAt"
    );

  if (!user) {
    throw httpError(
      "Employee account not found.",
      404
    );
  }

  assertStaffAccount(
    user
  );

  let stylist =
    await stylistForUser(
      user
    );

  if (
    !stylist &&
    createProfile
  ) {
    stylist =
      await createOrLinkStylist(
        user
      );
  }

  if (stylist) {
    if (
      !stylist.userAccount
    ) {
      stylist.userAccount =
        user._id;
      await stylist.save();
    }

    await stylist.populate(
      "services",
      "name category price duration active onlineBookable"
    );
  }

  return {
    user,
    stylist,
  };
}

export async function getEmployeeManagementDetail(
  req,
  res,
  next
) {
  try {
    const {
      user,
      stylist,
    } =
      await employeeAndProfile(
        req.params.id
      );

    return res.json({
      success: true,
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

export async function updateEmployeeServices(
  req,
  res,
  next
) {
  try {
    if (
      !Array.isArray(
        req.body.services
      )
    ) {
      throw httpError(
        "services must be an array.",
        400
      );
    }

    const serviceIds =
      [
        ...new Set(
          req.body.services.map(
            (serviceId) =>
              String(
                serviceId ||
                  ""
              ).trim()
          )
        ),
      ].filter(Boolean);

    if (
      serviceIds.some(
        (serviceId) =>
          !mongoose.isValidObjectId(
            serviceId
          )
      )
    ) {
      throw httpError(
        "Every service must use a valid identifier.",
        400
      );
    }

    const serviceCount =
      await Service.countDocuments({
        _id: {
          $in:
            serviceIds,
        },
      });

    if (
      serviceCount !==
      serviceIds.length
    ) {
      throw httpError(
        "One or more selected services do not exist.",
        400
      );
    }

    const {
      user,
      stylist,
    } =
      await employeeAndProfile(
        req.params.id,
        {
          createProfile:
            true,
        }
      );
    const before =
      serialiseAdminUser(
        user,
        stylist
      );

    stylist.services =
      serviceIds;
    await stylist.save();
    await stylist.populate(
      "services",
      "name category price duration active onlineBookable"
    );

    const after =
      serialiseAdminUser(
        user,
        stylist
      );

    await recordAuditEvent({
      req,
      action:
        "employee.services_updated",
      resourceType:
        "employee",
      resourceId:
        user._id,
      before,
      after,
    });

    return res.json({
      success: true,
      message:
        "Employee services updated.",
      user:
        after,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateEmployeeSchedule(
  req,
  res,
  next
) {
  try {
    const workingHours =
      normaliseEmployeeSchedule(
        req.body.workingHours
      );
    const {
      user,
      stylist,
    } =
      await employeeAndProfile(
        req.params.id,
        {
          createProfile:
            true,
        }
      );
    const before =
      serialiseAdminUser(
        user,
        stylist
      );

    stylist.workingHours =
      workingHours;
    await stylist.save();

    const after =
      serialiseAdminUser(
        user,
        stylist
      );

    await recordAuditEvent({
      req,
      action:
        "employee.schedule_updated",
      resourceType:
        "employee",
      resourceId:
        user._id,
      before,
      after,
    });

    return res.json({
      success: true,
      message:
        "Employee schedule updated.",
      user:
        after,
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

    const profilePublished =
      req.body.profilePublished ===
      true;

    const acceptsAppointments =
      req.body.acceptsAppointments ===
      undefined
        ? false
        : req.body.acceptsAppointments ===
          true;

    const permissions =
      Array.isArray(
        req.body.permissions
      )
        ? normaliseEmployeeManagementUpdate({
            permissions:
              req.body.permissions,
          }).permissions
        : [];

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
      !ASSIGNABLE_STAFF_ROLES.includes(
        role
      )
    ) {
      throw httpError(
        "Staff role must be stylist, receptionist, manager or admin.",
        400
      );
    }

    if (
      req.user.role !==
        "super_admin" &&
      [
        "admin",
        "manager",
      ].includes(role)
    ) {
      throw httpError(
        "Only the Super Admin can create manager or administrator accounts.",
        403
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
        permissions:
          req.user.role ===
          "super_admin"
            ? permissions
            : [],
        phone,
        profilePhoto,
        createdBy:
          req.user._id,
      });

    const stylist =
      await createOrLinkStylist(
        createdUser,
        {
          profilePublished,
          acceptsAppointments,
        }
      );

    await recordAuditEvent({
      req,
      action:
        "employee.created",
      resourceType:
        "employee",
      resourceId:
        createdUser._id,
      after:
        serialiseAdminUser(
          createdUser,
          stylist
        ),
    });

    return res
      .status(201)
      .json({
        success: true,
        message:
          "Employee account and profile created successfully.",
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

export function normaliseEmployeeManagementUpdate(
  body = {}
) {
  const update = {};

  for (const field of EMPLOYEE_SETTING_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(
        body,
        field
      )
    ) {
      update[field] =
        body[field];
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      update,
      "role"
    )
  ) {
    update.role =
      cleanText(
        update.role,
        30
      );

    if (
      !ASSIGNABLE_STAFF_ROLES.includes(
        update.role
      )
    ) {
      throw httpError(
        "Staff role must be stylist, receptionist, manager or admin.",
        400
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      update,
      "permissions"
    )
  ) {
    if (
      !Array.isArray(
        update.permissions
      )
    ) {
      throw httpError(
        "permissions must be an array.",
        400
      );
    }

    const permissions =
      [
        ...new Set(
          update.permissions.map(
            (permission) =>
              cleanText(
                permission,
                80
              )
          )
        ),
      ];

    const invalid =
      permissions.filter(
        (permission) =>
          !EMPLOYEE_PERMISSION_SET.has(
            permission
          )
      );

    if (invalid.length) {
      throw httpError(
        `Unsupported permissions: ${invalid.join(", ")}.`,
        400
      );
    }

    update.permissions =
      permissions;
  }

  for (const field of [
    "profilePublished",
    "acceptsAppointments",
  ]) {
    if (
      Object.prototype.hasOwnProperty.call(
        update,
        field
      ) &&
      typeof update[field] !==
        "boolean"
    ) {
      throw httpError(
        `${field} must be true or false.`,
        400
      );
    }
  }

  if (
    Object.keys(update).length ===
    0
  ) {
    throw httpError(
      "Provide at least one employee setting to update.",
      400
    );
  }

  return update;
}

async function protectFinalSuperAdmin(
  user,
  update,
  actor
) {
  const removesOwnSuperAdminAccess =
    String(user._id) === String(actor._id) &&
    user.role === "super_admin" &&
    ((update.role && update.role !== "super_admin") ||
      update.isActive === false);

  if (removesOwnSuperAdminAccess) {
    throw httpError(
      "You cannot remove your own Super Admin access.",
      409
    );
  }

  const removesActiveSuperAdmin =
    user.role === "super_admin" &&
    user.isActive !== false &&
    ((update.role && update.role !== "super_admin") ||
      update.isActive === false);

  if (!removesActiveSuperAdmin) {
    return;
  }

  const activeSuperAdmins = await User.countDocuments({
    role: "super_admin",
    isActive: { $ne: false },
  });

  if (activeSuperAdmins <= 1) {
    throw httpError(
      "The final active Super Admin cannot be demoted or deactivated.",
      409
    );
  }
}

export async function updateEmployeeManagementSettings(
  req,
  res,
  next
) {
  try {
    const update =
      normaliseEmployeeManagementUpdate(
        req.body
      );

    const user =
      await User.findById(
        req.params.id
      );

    if (!user) {
      throw httpError(
        "Employee account not found.",
        404
      );
    }

    assertStaffAccount(
      user
    );

    await protectFinalSuperAdmin(
      user,
      update,
      req.user
    );

    if (
      req.user.role !==
        "super_admin" &&
      (Object.prototype.hasOwnProperty.call(
        update,
        "role"
      ) ||
        Object.prototype.hasOwnProperty.call(
          update,
          "permissions"
        ))
    ) {
      throw httpError(
        "Only the Super Admin can change employee roles or permissions.",
        403
      );
    }

    let stylist =
      await stylistForUser(
        user
      );

    if (!stylist) {
      stylist =
        await createOrLinkStylist(
          user,
          {
            profilePublished:
              update.profilePublished ===
              true,
            acceptsAppointments:
              update.acceptsAppointments ===
              undefined
                ? false
                : update.acceptsAppointments,
          }
        );
    }

    if (
      !stylist.userAccount
    ) {
      stylist.userAccount =
        user._id;
    }

    const before =
      serialiseAdminUser(
        user,
        stylist
      );

    if (update.role) {
      user.role =
        update.role;
    }

    if (
      Array.isArray(
        update.permissions
      )
    ) {
      user.permissions =
        update.permissions;
    }

    if (
      typeof update.isActive ===
      "boolean"
    ) {
      user.isActive =
        update.isActive;
      stylist.isActive =
        update.isActive;
    }

    if (
      typeof update.profilePublished ===
      "boolean"
    ) {
      stylist.profilePublished =
        update.profilePublished;
    }

    if (
      typeof update.acceptsAppointments ===
      "boolean"
    ) {
      stylist.acceptsAppointments =
        update.acceptsAppointments;
    }

    user.updatedBy =
      req.user._id;

    await user.save();
    await stylist.save();

    await stylist.populate(
      "services",
      "name category active onlineBookable"
    );

    const after =
      serialiseAdminUser(
        user,
        stylist
      );

    await recordAuditEvent({
      req,
      action:
        "employee.settings_updated",
      resourceType:
        "employee",
      resourceId:
        user._id,
      before,
      after,
      metadata: {
        changedFields:
          Object.keys(
            update
          ),
      },
    });

    return res.json({
      success: true,
      message:
        "Employee settings updated.",
      user:
        after,
    });
  } catch (error) {
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

    assertStaffAccount(
      user
    );

    if (
      user.role === "super_admin" &&
      req.user.role !== "super_admin"
    ) {
      throw httpError(
        "Only a Super Admin can change a Super Admin account.",
        403
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
        "super_admin" &&
      requested ===
        false
    ) {
      const activeSuperAdmins =
        await User.countDocuments({
          role:
            "super_admin",
          isActive: {
            $ne:
              false,
          },
        });

      if (
        activeSuperAdmins <= 1
      ) {
        throw httpError(
          "The final active Super Admin account cannot be deactivated.",
          409
        );
      }
    }

    let stylist =
      await stylistForUser(
        user
      );
    const before =
      serialiseAdminUser(
        user,
        stylist
      );

    user.isActive =
      requested;

    user.updatedBy =
      req.user._id;

    await user.save();

    if (stylist) {
      stylist.isActive =
        requested;

      await stylist.save();
      await stylist.populate(
        "services",
        "name category active onlineBookable"
      );
    }

    const after =
      serialiseAdminUser(
        user,
        stylist
      );

    await recordAuditEvent({
      req,
      action:
        "employee.status_updated",
      resourceType:
        "employee",
      resourceId:
        user._id,
      before,
      after,
      metadata: {
        changedFields: [
          "isActive",
        ],
      },
    });

    return res.json({
      success: true,
      message:
        requested
          ? "Staff account activated."
          : "Staff account deactivated.",
      user:
        after,
    });
  } catch (error) {
    return next(error);
  }
}
