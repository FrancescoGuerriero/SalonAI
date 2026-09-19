import mongoose from "mongoose";

import StaffRole from "../models/StaffRole.js";
import User from "../models/user.js";
import {
  recordAuditEvent,
} from "../services/auditService.js";
import {
  assertCustomRoleKey,
  builtInRoleDefinition,
  isBuiltInStaffRoleKey,
  listStaffRoleDefinitions,
  normaliseRoleKey,
  normaliseRolePermissions,
  resolveStaffRole,
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
      value?.system
        ? value?.key
        : value?._id,
    key:
      value?.key,
    name:
      value?.name,
    description:
      value?.description || "",
    permissions:
      value?.permissions || [],
    baselinePermissions:
      value?.baselinePermissions || [],
    rolePermissions:
      value?.rolePermissions || [],
    editable:
      value?.editable !== false,
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
    const identifier =
      String(
        req.params.id || ""
      ).trim();

    let role = null;
    let builtIn =
      builtInRoleDefinition(
        identifier
      );

    if (
      !builtIn &&
      mongoose.isValidObjectId(
        identifier
      )
    ) {
      role =
        await StaffRole.findById(
          identifier
        );

      if (
        role &&
        isBuiltInStaffRoleKey(
          role.key
        )
      ) {
        builtIn =
          builtInRoleDefinition(
            role.key
          );
      }
    }

    if (builtIn) {
      if (
        builtIn.key ===
        "super_admin"
      ) {
        throw httpError(
          "Super Admin permissions are fixed and always include every capability.",
          409
        );
      }

      const beforeDefinition =
        await resolveStaffRole(
          builtIn.key,
          {
            activeOnly:
              false,
          }
        );

      const before =
        serialiseRole(
          beforeDefinition
        );

      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          "key"
        ) &&
        normaliseRoleKey(
          req.body.key
        ) !==
          builtIn.key
      ) {
        throw httpError(
          "Built-in role keys are protected.",
          400
        );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          "name"
        ) &&
        cleanText(
          req.body.name,
          80
        ) !==
          builtIn.name
      ) {
        throw httpError(
          "Built-in role names are protected.",
          400
        );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          "active"
        )
      ) {
        throw httpError(
          "Built-in roles cannot be deactivated.",
          400
        );
      }

      if (!role) {
        role =
          await StaffRole.findOne({
            key:
              builtIn.key,
          });
      }

      if (!role) {
        role =
          new StaffRole({
            key:
              builtIn.key,
            name:
              builtIn.name,
            description:
              "",
            permissions:
              [],
            active:
              true,
            createdBy:
              req.user?._id ||
              null,
          });
      }

      let permissionsChanged =
        false;

      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          "permissions"
        )
      ) {
        const selected =
          normaliseRolePermissions(
            req.body.permissions
          );

        const baseline =
          builtIn.baselinePermissions ||
          [];

        role.permissions =
          selected.filter(
            (permission) =>
              !baseline.includes(
                permission
              )
          );

        permissionsChanged =
          true;
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

      role.name =
        builtIn.name;
      role.active =
        true;
      role.updatedBy =
        req.user?._id ||
        null;

      await role.save();

      let assignedEmployeesUpdated =
        0;

      if (permissionsChanged) {
        const result =
          await User.updateMany(
            {
              role:
                builtIn.key,
            },
            {
              $set: {
                rolePermissions:
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

      const afterDefinition =
        await resolveStaffRole(
          builtIn.key,
          {
            activeOnly:
              false,
          }
        );

      const after =
        serialiseRole(
          afterDefinition
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
          systemRole:
            true,
        },
      });

      return res.json({
        success: true,
        message:
          "Built-in staff role updated.",
        role:
          after,
        assignedEmployeesUpdated,
      });
    }

    if (!role) {
      throw httpError(
        "Staff role not found.",
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
              rolePermissions:
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
        {
          ...role.toObject(),
          system:
            false,
          editable:
            true,
          baselinePermissions:
            [],
          rolePermissions:
            role.permissions,
        }
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
        systemRole:
          false,
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
    if (
      isBuiltInStaffRoleKey(
        req.params.id
      )
    ) {
      throw httpError(
        "Built-in staff roles cannot be deleted.",
        409
      );
    }

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

    if (
      isBuiltInStaffRoleKey(
        role.key
      )
    ) {
      throw httpError(
        "Built-in staff roles cannot be deleted.",
        409
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
