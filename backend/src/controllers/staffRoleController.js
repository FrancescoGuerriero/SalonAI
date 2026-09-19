import StaffRole from "../models/StaffRole.js";
import User from "../models/user.js";
import {
  recordAuditEvent,
} from "../services/auditService.js";
import {
  assertCustomRoleKey,
  listStaffRoleDefinitions,
  normaliseRoleKey,
  normaliseRolePermissions,
} from "../services/staffRoleRegistryService.js";

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

function serialiseRole(
  role
) {
  const value =
    typeof role?.toObject ===
    "function"
      ? role.toObject()
      : role;

  return {
    id:
      value?._id,
    key:
      value?.key,
    name:
      value?.name,
    description:
      value?.description || "",
    permissions:
      value?.permissions || [],
    active:
      value?.active !== false,
    system:
      Boolean(
        value?.system
      ),
    assignable:
      value?.assignable !==
      false,
    superAdminOnly:
      value?.superAdminOnly ===
      true,
    createdAt:
      value?.createdAt,
    updatedAt:
      value?.updatedAt,
  };
}

export async function listStaffRoles(
  req,
  res,
  next
) {
  try {
    const roles =
      await listStaffRoleDefinitions();

    return res.json({
      success: true,
      roles:
        roles.map(
          serialiseRole
        ),
    });
  } catch (error) {
    return next(error);
  }
}

export async function createStaffRole(
  req,
  res,
  next
) {
  try {
    const name =
      cleanText(
        req.body.name,
        80
      );

    if (!name) {
      throw httpError(
        "Role name is required.",
        400
      );
    }

    const key =
      assertCustomRoleKey(
        normaliseRoleKey(
          req.body.key ||
            name
        )
      );

    const permissions =
      normaliseRolePermissions(
        req.body.permissions ||
          []
      );

    const existing =
      await StaffRole.findOne({
        key,
      }).lean();

    if (existing) {
      throw httpError(
        "A custom staff role already uses this key.",
        409
      );
    }

    const role =
      await StaffRole.create({
        key,
        name,
        description:
          cleanText(
            req.body.description,
            500
          ),
        permissions,
        active:
          req.body.active !==
          false,
        createdBy:
          req.user?._id ||
          null,
        updatedBy:
          req.user?._id ||
          null,
      });

    const after =
      serialiseRole(
        role
      );

    await recordAuditEvent({
      req,
      action:
        "staff_role.created",
      resourceType:
        "staffRole",
      resourceId:
        role._id,
      before: null,
      after,
    });

    return res
      .status(201)
      .json({
        success: true,
        message:
          "Custom staff role created.",
        role:
          after,
      });
  } catch (error) {
    return next(error);
  }
}

export async function updateStaffRole(
  req,
  res,
  next
) {
  try {
    const role =
      await StaffRole.findById(
        req.params.id
      );

    if (!role) {
      throw httpError(
        "Custom staff role not found.",
        404
      );
    }

    const before =
      serialiseRole(
        role
      );

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "key"
      ) &&
      normaliseRoleKey(
        req.body.key
      ) !==
        role.key
    ) {
      throw httpError(
        "Role keys are immutable after creation.",
        400
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "name"
      )
    ) {
      const name =
        cleanText(
          req.body.name,
          80
        );

      if (!name) {
        throw httpError(
          "Role name is required.",
          400
        );
      }

      role.name =
        name;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "description"
      )
    ) {
      role.description =
        cleanText(
          req.body.description,
          500
        );
    }

    let permissionsChanged =
      false;

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "permissions"
      )
    ) {
      role.permissions =
        normaliseRolePermissions(
          req.body.permissions
        );
      permissionsChanged =
        true;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "active"
      )
    ) {
      if (
        typeof req.body.active !==
        "boolean"
      ) {
        throw httpError(
          "active must be true or false.",
          400
        );
      }

      role.active =
        req.body.active;
    }

    role.updatedBy =
      req.user?._id ||
      null;

    await role.save();

    let assignedEmployeesUpdated =
      0;

    if (
      permissionsChanged
    ) {
      const result =
        await User.updateMany(
          {
            role:
              role.key,
          },
          {
            $set: {
              permissions:
                role.permissions,
              updatedBy:
                req.user?._id ||
                null,
            },
          }
        );

      assignedEmployeesUpdated =
        result.modifiedCount ||
        0;
    }

    const after =
      serialiseRole(
        role
      );

    await recordAuditEvent({
      req,
      action:
        "staff_role.updated",
      resourceType:
        "staffRole",
      resourceId:
        role._id,
      before,
      after,
      metadata: {
        assignedEmployeesUpdated,
      },
    });

    return res.json({
      success: true,
      message:
        "Custom staff role updated.",
      role:
        after,
      assignedEmployeesUpdated,
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteStaffRole(
  req,
  res,
  next
) {
  try {
    const role =
      await StaffRole.findById(
        req.params.id
      );

    if (!role) {
      throw httpError(
        "Custom staff role not found.",
        404
      );
    }

    const assignedEmployees =
      await User.countDocuments({
        role:
          role.key,
      });

    if (
      assignedEmployees >
      0
    ) {
      throw httpError(
        "Reassign employees before deleting this custom role.",
        409
      );
    }

    const before =
      serialiseRole(
        role
      );

    await role.deleteOne();

    await recordAuditEvent({
      req,
      action:
        "staff_role.deleted",
      resourceType:
        "staffRole",
      resourceId:
        role._id,
      before,
      after: null,
    });

    return res.json({
      success: true,
      message:
        "Custom staff role deleted.",
    });
  } catch (error) {
    return next(error);
  }
}
