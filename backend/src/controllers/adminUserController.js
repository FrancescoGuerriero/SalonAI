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
import {
  hasUserPermission,
} from "../middleware/permissionMiddleware.js";
import {
  BUILT_IN_STAFF_ROLE_KEYS,
  isPotentialStaffRole,
  resolveStaffRole,
} from "../services/staffRoleRegistryService.js";

export const STAFF_ROLES =
  BUILT_IN_STAFF_ROLE_KEYS;

const EMPLOYEE_SETTING_FIELDS = Object.freeze([
  "role",
  "profilePublished",
  "acceptsAppointments",
  "permissions",
]);


const DEFAULT_JOB_TITLES = Object.freeze({
  stylist:
    "Hair professional",
  receptionist:
    "Receptionist",
  manager:
    "Salon manager",
  admin:
    "Salon administrator",
});

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


function cleanList(
  value,
  maximumItems,
  maximumLength
) {
  const input =
    Array.isArray(value)
      ? value
      : String(
          value ?? ""
        ).split(",");

  const unique =
    new Set();

  for (
    const item of input
  ) {
    const cleaned =
      cleanText(
        item,
        maximumLength
      );

    if (cleaned) {
      unique.add(
        cleaned
      );
    }

    if (
      unique.size >=
      maximumItems
    ) {
      break;
    }
  }

  return [
    ...unique,
  ];
}

function booleanField(
  value,
  field,
  defaultValue
) {
  if (
    value ===
    undefined
  ) {
    return defaultValue;
  }

  if (
    typeof value !==
    "boolean"
  ) {
    throw httpError(
      `${field} must be true or false.`,
      400
    );
  }

  return value;
}

async function normaliseServiceIds(
  services
) {
  if (
    services ===
    undefined
  ) {
    return [];
  }

  if (
    !Array.isArray(
      services
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
        services.map(
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

  return serviceIds;
}

function assertStaffAccount(
  user
) {
  if (
    !user ||
    !isPotentialStaffRole(
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
            biography:
              stylist.biography || "",
            specialties:
              stylist.specialties || [],
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
  options = {}
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

  const split =
    splitName(
      user.name
    );

  const firstName =
    cleanText(
      options.firstName ||
        split.firstName,
      60
    );

  const lastName =
    cleanText(
      options.lastName ||
        split.lastName,
      60
    );

  const has =
    (field) =>
      Object.prototype.hasOwnProperty.call(
        options,
        field
      );

  if (stylist) {
    stylist.userAccount =
      user._id;

    if (
      has(
        "firstName"
      ) &&
      firstName
    ) {
      stylist.firstName =
        firstName;
    }

    if (
      has(
        "lastName"
      ) &&
      lastName
    ) {
      stylist.lastName =
        lastName;
    }

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

    if (
      has(
        "jobTitle"
      )
    ) {
      stylist.jobTitle =
        options.jobTitle;
    }

    if (
      has(
        "biography"
      )
    ) {
      stylist.biography =
        options.biography;
    }

    if (
      has(
        "specialties"
      )
    ) {
      stylist.specialties =
        options.specialties;
    }

    if (
      has(
        "services"
      )
    ) {
      stylist.services =
        options.services;
    }

    if (
      has(
        "workingHours"
      )
    ) {
      stylist.workingHours =
        options.workingHours;
    }

    stylist.isActive =
      user.isActive !==
      false;

    if (
      has(
        "profilePublished"
      )
    ) {
      stylist.profilePublished =
        Boolean(
          options.profilePublished
        );
    }

    if (
      has(
        "acceptsAppointments"
      )
    ) {
      stylist.acceptsAppointments =
        Boolean(
          options.acceptsAppointments
        );
    }

    await stylist.save();

    return stylist;
  }

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
        options.jobTitle ||
        DEFAULT_JOB_TITLES[
          user.role
        ] ||
        "Salon professional",
      biography:
        options.biography ||
        "",
      specialties:
        options.specialties ||
        [],
      services:
        options.services ||
        [],
      ...(options.workingHours
        ? {
            workingHours:
              options.workingHours,
          }
        : {}),
      profilePublished:
        Boolean(
          options.profilePublished
        ),
      acceptsAppointments:
        Boolean(
          options.acceptsAppointments
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
    const page = Math.max(
      1,
      Number(req.query.page) || 1
    );

    const limit = Math.min(
      500,
      Math.max(
        1,
        Number(req.query.limit) || 100
      )
    );

    const search = cleanText(
      req.query.search,
      120
    );

    const role = cleanText(
      req.query.role,
      30
    );

    /*
     * Employee management is based on canonical staff User accounts.
     * Stylist documents are attached public/booking profiles, not independent
     * employee identities. Historical Stylist records must never inflate this
     * roster or create anonymous fallback employees.
     */
    const query = {
      role: role
        ? role
        : {
            $ne:
              "customer",
          },
    };

    if (search) {
      const escaped = search.replace(
        /[.*+?^\${}()|[\]\\]/g,
        "\\$&"
      );
      const expression =
        new RegExp(escaped, "i");

      query.$or = [
        { name: expression },
        { email: expression },
        { phone: expression },
      ];
    }

    const offset =
      (page - 1) * limit;

    const [staffUsers, total] =
      await Promise.all([
        User.find(query)
          .select(
            "name email role permissions phone profilePhoto isActive emailVerified createdAt updatedAt"
          )
          .sort({
            name: 1,
            email: 1,
          })
          .skip(offset)
          .limit(limit)
          .lean(),
        User.countDocuments(query),
      ]);

    const userIds =
      staffUsers.map(
        (user) => user._id
      );

    const emails =
      staffUsers
        .map((user) =>
          String(
            user.email || ""
          ).toLowerCase()
        )
        .filter(Boolean);

    const profileQuery = [];

    if (userIds.length) {
      profileQuery.push({
        userAccount: {
          $in: userIds,
        },
      });
    }

    if (emails.length) {
      profileQuery.push({
        email: {
          $in: emails,
        },
      });
    }

    const stylistProfiles =
      profileQuery.length
        ? await Stylist.find({
            $or: profileQuery,
          })
            .select(
              "userAccount email firstName lastName jobTitle profileImage profilePublished acceptsAppointments isActive workingHours services phone createdAt updatedAt"
            )
            .populate(
              "services",
              "name category active onlineBookable"
            )
            .lean()
        : [];

    const stylistByUserId =
      new Map();
    const stylistByEmail =
      new Map();

    for (const stylist of stylistProfiles) {
      if (stylist.userAccount) {
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

    const users =
      staffUsers.map((user) =>
        serialiseAdminUser(
          user,
          stylistByUserId.get(
            String(user._id)
          ) ||
            stylistByEmail.get(
              String(
                user.email || ""
              ).toLowerCase()
            ) ||
            null
        )
      );

    return res.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.max(
        1,
        Math.ceil(total / limit)
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
    const serviceIds =
      await normaliseServiceIds(
        req.body.services
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
  let linkedStylist =
    null;
  let existingStylistBefore =
    null;

  try {
    const suppliedFirstName =
      cleanText(
        req.body.firstName,
        60
      );

    const suppliedLastName =
      cleanText(
        req.body.lastName,
        60
      );

    const requestedName =
      cleanText(
        req.body.name,
        120
      );

    const name =
      requestedName ||
      cleanText(
        [
          suppliedFirstName,
          suppliedLastName,
        ]
          .filter(Boolean)
          .join(" "),
        120
      );

    const nameParts =
      splitName(
        name
      );

    const firstName =
      suppliedFirstName ||
      nameParts.firstName;

    const lastName =
      suppliedLastName ||
      nameParts.lastName;

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

    const isActive =
      booleanField(
        req.body.isActive,
        "isActive",
        true
      );

    const profilePublished =
      booleanField(
        req.body.profilePublished,
        "profilePublished",
        false
      );

    const acceptsAppointments =
      booleanField(
        req.body.acceptsAppointments,
        "acceptsAppointments",
        false
      );


    const roleDefinition =
      await resolveStaffRole(
        role
      );

    if (
      !roleDefinition ||
      roleDefinition.assignable ===
        false
    ) {
      throw httpError(
        "Select an active, assignable staff role.",
        400
      );
    }

    if (
      roleDefinition.superAdminOnly ===
        true &&
      req.user.role !==
        "super_admin"
    ) {
      throw httpError(
        "Only the Super Admin can assign this staff role.",
        403
      );
    }

    const hasFirstName =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "firstName"
      );

    const hasLastName =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "lastName"
      );

    const hasJobTitle =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "jobTitle"
      );

    const hasBiography =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "biography"
      );

    const hasSpecialties =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "specialties"
      );

    const hasServices =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "services"
      );

    const hasWorkingHours =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "workingHours"
      );

    const jobTitle =
      hasJobTitle
        ? cleanText(
            req.body.jobTitle,
            120
          )
        : undefined;

    const biography =
      hasBiography
        ? cleanText(
            req.body.biography,
            2000
          )
        : undefined;

    const specialties =
      hasSpecialties
        ? cleanList(
            req.body.specialties,
            12,
            120
          )
        : undefined;

    const serviceIds =
      hasServices
        ? await normaliseServiceIds(
            req.body.services
          )
        : undefined;

    const workingHours =
      hasWorkingHours
        ? normaliseEmployeeSchedule(
            req.body.workingHours
          )
        : undefined;

    let permissions =
      Array.isArray(
        req.body.permissions
      )
        ? normaliseEmployeeManagementUpdate({
            permissions:
              req.body.permissions,
          }).permissions
        : [];

    if (
      roleDefinition.system ===
      false
    ) {
      permissions = [
        ...(
          roleDefinition.permissions ||
          []
        ),
      ];
    }

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
      !firstName ||
      !lastName
    ) {
      throw httpError(
        "First name and last name are required.",
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
      req.user.role !==
        "super_admin" &&
      permissions.length >
        0
    ) {
      throw httpError(
        "Only the Super Admin can assign employee permissions during account creation.",
        403
      );
    }


    if (
      hasServices &&
      !hasUserPermission(
        req.user,
        "employee:services:update"
      )
    ) {
      throw httpError(
        "You do not have permission to assign employee services during account creation.",
        403
      );
    }

    if (
      hasWorkingHours &&
      !hasUserPermission(
        req.user,
        "employee:schedule:update"
      )
    ) {
      throw httpError(
        "You do not have permission to configure employee schedules during account creation.",
        403
      );
    }

    if (
      isActive ===
        false &&
      !hasUserPermission(
        req.user,
        "employee:deactivate"
      )
    ) {
      throw httpError(
        "You do not have permission to create an inactive employee account.",
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

    const existingStylist =
      await Stylist.findOne({
        email,
      });

    if (
      existingStylist?.userAccount
    ) {
      throw httpError(
        "A staff profile with this email is already linked to another account.",
        409
      );
    }

    existingStylistBefore =
      existingStylist
        ? existingStylist.toObject({
            depopulate:
              true,
          })
        : null;

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
        isActive,
        createdBy:
          req.user._id,
      });

    linkedStylist =
      await createOrLinkStylist(
        createdUser,
        {
          ...(hasFirstName
            ? {
                firstName,
              }
            : {}),
          ...(hasLastName
            ? {
                lastName,
              }
            : {}),
          ...(hasJobTitle
            ? {
                jobTitle,
              }
            : {}),
          ...(hasBiography
            ? {
                biography,
              }
            : {}),
          ...(hasSpecialties
            ? {
                specialties,
              }
            : {}),
          ...(hasServices
            ? {
                services:
                  serviceIds,
              }
            : {}),
          ...(hasWorkingHours
            ? {
                workingHours,
              }
            : {}),
          profilePublished,
          acceptsAppointments,
        }
      );

    await linkedStylist.populate(
      "services",
      "name category price duration active onlineBookable"
    );

    const created =
      serialiseAdminUser(
        createdUser,
        linkedStylist
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
        created,
      metadata: {
        initialServices:
          serviceIds || [],
        scheduleConfigured:
          hasWorkingHours,
      },
    });

    return res
      .status(201)
      .json({
        success: true,
        message:
          "Employee account and profile created successfully.",
        user:
          created,
      });
  } catch (error) {
    if (
      createdUser?._id
    ) {
      try {
        if (
          existingStylistBefore?._id
        ) {
          await Stylist.replaceOne(
            {
              _id:
                existingStylistBefore._id,
            },
            existingStylistBefore
          );
        } else if (
          linkedStylist?._id
        ) {
          await Stylist.deleteOne({
            _id:
              linkedStylist._id,
            userAccount:
              createdUser._id,
          });
        } else {
          await Stylist.deleteMany({
            userAccount:
              createdUser._id,
          });
        }

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
      !/^[a-z][a-z0-9_]{2,39}$/.test(
        update.role
      )
    ) {
      throw httpError(
        "Staff role must use a valid SalonAI role key.",
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

    const currentRoleDefinition =
      await resolveStaffRole(
        user.role,
        {
          activeOnly:
            false,
        }
      );

    if (
      Array.isArray(
        update.permissions
      ) &&
      !update.role &&
      currentRoleDefinition?.system ===
        false
    ) {
      throw httpError(
        "Permissions for a custom role are managed from the role registry.",
        409
      );
    }

    if (update.role) {
      const nextRoleDefinition =
        await resolveStaffRole(
          update.role
        );

      if (
        !nextRoleDefinition ||
        nextRoleDefinition.assignable ===
          false
      ) {
        throw httpError(
          "Select an active, assignable staff role.",
          400
        );
      }

      if (
        nextRoleDefinition.system ===
        false
      ) {
        update.permissions = [
          ...(
            nextRoleDefinition.permissions ||
            []
          ),
        ];
      }
    }

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
