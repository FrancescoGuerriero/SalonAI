import bcrypt from "bcrypt";
import mongoose from "mongoose";

import BusinessMembership from "../models/BusinessMembership.js";
import Stylist from "../models/Stylist.js";
import User from "../models/user.js";
import Service from "../models/service.js";
import {
  buildAdminWorkforceRoster,
  normaliseEmployeeManagementUpdate,
  normaliseEmployeeSchedule,
  normaliseEmployeeSignInRequest,
} from "./adminUserController.js";
import {
  hasRequestPermission,
} from "../middleware/permissionMiddleware.js";
import {
  normaliseProfileImage,
} from "../utils/profileMedia.js";
import {
  recordAuditEvent,
} from "../services/auditService.js";
import {
  resolveTenantStaffRole,
} from "../services/tenantStaffRoleRegistryService.js";
import {
  scopedWorkforceFilter,
  workforceCreationOwnership,
} from "../services/workforceAuthorityService.js";
import {
  newStaffMembershipPayload,
  staffAccountBusinessId,
  staffMembershipManagementFilter,
} from "../services/staffAccountAuthorityService.js";

function httpError(message, statusCode) {
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

function normaliseEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function splitName(value) {
  const parts = cleanText(value, 120).split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "Salon", lastName: "Professional" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "Professional" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function rolePermissions(roleDefinition) {
  return [
    ...(
      roleDefinition?.rolePermissions ||
      (roleDefinition?.system === false
        ? roleDefinition.permissions
        : []) ||
      []
    ),
  ];
}

async function resolveAssignableRole(req, roleKey) {
  const definition = await resolveTenantStaffRole(
    roleKey,
    {
      businessId: staffAccountBusinessId(req.effectiveAuthority),
      activeOnly: true,
    }
  );

  if (!definition || definition.assignable === false) {
    throw httpError("Select an active, assignable staff role.", 400);
  }

  if (
    definition.superAdminOnly === true &&
    !hasRequestPermission(req, "employee:role:update")
  ) {
    throw httpError("Only the Super Admin can assign this staff role.", 403);
  }

  return definition;
}

async function scopedServiceIds(req, values) {
  if (values === undefined) return [];
  if (!Array.isArray(values)) throw httpError("services must be an array.", 400);

  const ids = [...new Set(values.map((value) => String(value || "").trim()))].filter(Boolean);
  if (ids.some((id) => !mongoose.isValidObjectId(id))) {
    throw httpError("Every service must use a valid identifier.", 400);
  }

  const count = await Service.countDocuments({
    _id: { $in: ids },
    business: staffAccountBusinessId(req.effectiveAuthority),
  });

  if (count !== ids.length) {
    throw httpError("One or more selected services do not exist in this Business.", 400);
  }

  return ids;
}

async function scopedMembership(req, userId, { session = null } = {}) {
  if (!mongoose.isValidObjectId(userId)) {
    throw httpError("Employee identifier is invalid.", 400);
  }

  let query = BusinessMembership.findOne(
    staffMembershipManagementFilter(
      req.effectiveAuthority,
      { user: userId }
    )
  );
  if (session) query = query.session(session);
  const membership = await query;

  if (!membership) throw httpError("Employee account not found.", 404);
  return membership;
}

async function scopedStylistByUser(req, user, { session = null } = {}) {
  let query = Stylist.findOne(
    scopedWorkforceFilter(
      req.effectiveAuthority,
      {
        $or: [
          { userAccount: user._id },
          { email: normaliseEmail(user.email) },
        ],
      }
    )
  );
  if (session) query = query.session(session);
  return query;
}

async function scopedStaffRecord(req, recordId, { session = null } = {}) {
  if (!mongoose.isValidObjectId(recordId)) {
    throw httpError("Staff profile identifier is invalid.", 400);
  }

  let query = Stylist.findOne(
    scopedWorkforceFilter(
      req.effectiveAuthority,
      { _id: recordId }
    )
  );
  if (session) query = query.session(session);
  const stylist = await query;
  if (!stylist) throw httpError("Staff profile not found.", 404);
  return stylist;
}

function userForTenant(user, membership) {
  const value = typeof user.toObject === "function" ? user.toObject() : { ...user };
  return {
    ...value,
    role: membership?.roleKey || value.role,
  };
}

function serialiseTenantUser(user, stylist, membership) {
  const { roster } = buildAdminWorkforceRoster(
    [userForTenant(user, membership)],
    stylist ? [typeof stylist.toObject === "function" ? stylist.toObject() : stylist] : []
  );
  return roster[0] || null;
}

function serialiseNoSignIn(stylist) {
  const { roster } = buildAdminWorkforceRoster(
    [],
    [typeof stylist.toObject === "function" ? stylist.toObject() : stylist]
  );
  return roster[0] || null;
}

async function userAndProfile(req, userId) {
  const membership = await scopedMembership(req, userId);
  const user = await User.findById(userId).select(
    "name email role permissions rolePermissions phone profilePhoto isActive emailVerified createdAt updatedAt"
  );
  if (!user || user.role === "customer") throw httpError("Employee account not found.", 404);

  const stylist = await scopedStylistByUser(req, user);
  if (!stylist) {
    throw httpError(
      "This staff account does not have a tenant-owned employee profile. Reconcile workforce ownership before managing it.",
      409
    );
  }

  return { user, stylist, membership };
}

async function protectFinalBusinessSuperAdmin(req, membership, nextRoleKey = null, nextActive = null) {
  if (membership.roleKey !== "super_admin" || membership.status !== "active") return;

  const removes =
    (nextRoleKey && nextRoleKey !== "super_admin") ||
    nextActive === false;
  if (!removes) return;

  if (String(membership.user) === String(req.user._id)) {
    throw httpError("You cannot remove your own Super Admin access.", 409);
  }

  const count = await BusinessMembership.countDocuments({
    business: membership.business,
    roleKey: "super_admin",
    status: "active",
  });
  if (count <= 1) {
    throw httpError("The final active Super Admin for this Business cannot be removed.", 409);
  }
}

export async function listTenantAdminUsers(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const search = cleanText(req.query.search, 120).toLowerCase();
    const role = cleanText(req.query.role, 40).toLowerCase();
    const accessView = req.query.view === "access";

    const memberships = await BusinessMembership.find(
      staffMembershipManagementFilter(req.effectiveAuthority)
    )
      .select("user roleKey status locationAccessMode locations")
      .lean();

    const membershipByUser = new Map(
      memberships.map((membership) => [String(membership.user), membership])
    );
    const userIds = [...membershipByUser.keys()];

    const stylistQuery = Stylist.find(
      scopedWorkforceFilter(req.effectiveAuthority)
    ).select(
      accessView
        ? "userAccount email firstName lastName phone jobTitle profileImage profilePublished acceptsAppointments isActive createdAt updatedAt"
        : "userAccount email firstName lastName phone jobTitle biography specialties profileImage profilePublished acceptsAppointments isActive workingHours services createdAt updatedAt"
    );
    if (!accessView) {
      stylistQuery.populate(
        "services",
        "name category active published bookable onlineBookable"
      );
    }

    const [users, stylists] = await Promise.all([
      User.find({
        _id: { $in: userIds },
        role: { $ne: "customer" },
      })
        .select("name email role permissions rolePermissions phone profilePhoto isActive emailVerified createdAt updatedAt")
        .sort({ name: 1, email: 1 })
        .lean(),
      stylistQuery.lean(),
    ]);

    const tenantUsers = users.map((user) =>
      userForTenant(user, membershipByUser.get(String(user._id)))
    );
    const { signInEnabledRows, signInDisabledRows, roster: allRows } =
      buildAdminWorkforceRoster(tenantUsers, stylists);

    let roster = [...allRows];
    if (role) {
      roster = roster.filter(
        (employee) => employee.signInEnabled !== false && employee.role === role
      );
    }
    if (search) {
      roster = roster.filter((employee) =>
        [
          employee.name,
          employee.email,
          employee.phone,
          employee.role,
          employee.roleLabel,
          employee.stylistProfile?.jobTitle,
        ].some((value) => String(value || "").toLowerCase().includes(search))
      );
    }

    roster.sort((left, right) =>
      String(left.name || "").localeCompare(String(right.name || ""), "en", {
        sensitivity: "base",
      })
    );

    const total = roster.length;
    const offset = (page - 1) * limit;
    return res.json({
      success: true,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      signInEnabledTotal: signInEnabledRows.length,
      signInDisabledTotal: signInDisabledRows.length,
      users: roster.slice(offset, offset + limit),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getTenantEmployeeManagementDetail(req, res, next) {
  try {
    const { user, stylist, membership } = await userAndProfile(req, req.params.id);
    await stylist.populate("services", "name category price duration active onlineBookable");
    return res.json({ success: true, user: serialiseTenantUser(user, stylist, membership) });
  } catch (error) {
    return next(error);
  }
}

export async function getTenantEmployeeWithoutSignInManagementDetail(req, res, next) {
  try {
    const stylist = await scopedStaffRecord(req, req.params.id);
    if (stylist.userAccount) {
      throw httpError("Sign-in is already enabled for this employee. Open the employee account instead.", 409);
    }
    await stylist.populate("services", "name category active published bookable");
    return res.json({ success: true, user: serialiseNoSignIn(stylist) });
  } catch (error) {
    return next(error);
  }
}

export async function updateTenantEmployeeRecordServices(req, res, next) {
  try {
    const services = await scopedServiceIds(req, req.body.services);
    const stylist = await scopedStaffRecord(req, req.params.id);
    if (stylist.userAccount) throw httpError("Sign-in is already enabled for this employee.", 409);
    stylist.services = services;
    await stylist.save();
    await stylist.populate("services", "name category active published bookable");
    return res.json({ success: true, message: "Employee services updated.", user: serialiseNoSignIn(stylist) });
  } catch (error) {
    return next(error);
  }
}

export async function updateTenantEmployeeRecordSchedule(req, res, next) {
  try {
    const stylist = await scopedStaffRecord(req, req.params.id);
    if (stylist.userAccount) throw httpError("Sign-in is already enabled for this employee.", 409);
    stylist.workingHours = normaliseEmployeeSchedule(req.body.workingHours);
    await stylist.save();
    return res.json({ success: true, message: "Employee schedule updated.", user: serialiseNoSignIn(stylist) });
  } catch (error) {
    return next(error);
  }
}

async function createTenantIdentity({ req, stylist, email, password, role, roleDefinition }) {
  const businessId = staffAccountBusinessId(req.effectiveAuthority);
  if (String(stylist.business || "") !== String(businessId)) {
    throw httpError("Employee record not found.", 404);
  }
  const workingLocations = (stylist.workingLocations || []).map(String);
  if (workingLocations.length === 0) {
    throw httpError("Employee working-location ownership must be configured before sign-in can be enabled.", 409);
  }

  const session = await mongoose.startSession();
  let createdUser;
  try {
    await session.withTransaction(async () => {
      const existingUser = await User.findOne({ email }).session(session);
      if (existingUser) throw httpError("An account already exists for this email address.", 409);

      const name = cleanText([stylist.firstName, stylist.lastName].filter(Boolean).join(" "), 120) || "Salon employee";
      [createdUser] = await User.create(
        [{
          name,
          email,
          password: await bcrypt.hash(password, 10),
          role,
          permissions: [],
          rolePermissions: rolePermissions(roleDefinition),
          phone: stylist.phone || "",
          profilePhoto: stylist.profileImage || "",
          isActive: stylist.isActive !== false,
          createdBy: req.user._id,
        }],
        { session }
      );

      const payload = newStaffMembershipPayload({
        authority: req.effectiveAuthority,
        userId: createdUser._id,
        roleKey: role,
        workingLocationIds: workingLocations,
        actorId: req.user._id,
        isDefault: true,
      });
      await BusinessMembership.create([payload], { session });

      stylist.email = email;
      stylist.userAccount = createdUser._id;
      await stylist.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return createdUser;
}

export async function enableTenantEmployeeSignIn(req, res, next) {
  try {
    const { email, password, role } = normaliseEmployeeSignInRequest(req.body);
    const roleDefinition = await resolveAssignableRole(req, role);
    const stylist = await scopedStaffRecord(req, req.params.id);
    if (stylist.userAccount) throw httpError("Sign-in is already enabled for this employee. Open the employee account instead.", 409);

    const before = serialiseNoSignIn(stylist);
    const user = await createTenantIdentity({ req, stylist, email, password, role, roleDefinition });
    await stylist.populate("services", "name category price duration active onlineBookable");
    const membership = await BusinessMembership.findOne({ user: user._id, business: staffAccountBusinessId(req.effectiveAuthority) });
    const after = serialiseTenantUser(user, stylist, membership);

    await recordAuditEvent({
      req,
      action: "employee.sign_in_enabled",
      resourceType: "employee",
      resourceId: user._id,
      before,
      after,
      metadata: { staffRecordId: stylist._id, assignedRole: role, businessId: membership.business },
    });

    return res.status(201).json({ success: true, message: "Employee sign-in enabled successfully.", user: after });
  } catch (error) {
    return next(error);
  }
}

export async function createTenantStaffUserByAdmin(req, res, next) {
  try {
    const name = cleanText(
      req.body.name || [req.body.firstName, req.body.lastName].filter(Boolean).join(" "),
      120
    );
    const email = normaliseEmail(req.body.email);
    const password = String(req.body.password || "");
    const role = cleanText(req.body.role, 40).toLowerCase();
    if (!name || !email || password.length < 8) {
      throw httpError("Name, valid email and password of at least 8 characters are required.", 400);
    }

    const roleDefinition = await resolveAssignableRole(req, role);
    const ownership = workforceCreationOwnership(req.effectiveAuthority);
    const services = Object.prototype.hasOwnProperty.call(req.body, "services")
      ? await scopedServiceIds(req, req.body.services)
      : [];
    const workingHours = Object.prototype.hasOwnProperty.call(req.body, "workingHours")
      ? normaliseEmployeeSchedule(req.body.workingHours)
      : undefined;
    const permissions = Array.isArray(req.body.permissions)
      ? normaliseEmployeeManagementUpdate({ permissions: req.body.permissions }).permissions
      : [];

    if (permissions.length && !hasRequestPermission(req, "employee:permissions:update")) {
      throw httpError("You do not have permission to assign employee permissions during account creation.", 403);
    }
    if (services.length && !hasRequestPermission(req, "employee:services:update")) {
      throw httpError("You do not have permission to assign employee services during account creation.", 403);
    }
    if (workingHours && !hasRequestPermission(req, "employee:schedule:update")) {
      throw httpError("You do not have permission to configure employee schedules during account creation.", 403);
    }

    const split = splitName(name);
    const firstName = cleanText(req.body.firstName || split.firstName, 60);
    const lastName = cleanText(req.body.lastName || split.lastName, 60);
    const profilePhoto = normaliseProfileImage(req.body.profilePhoto);
    const session = await mongoose.startSession();
    let user;
    let stylist;
    let membership;
    try {
      await session.withTransaction(async () => {
        if (await User.findOne({ email }).session(session)) {
          throw httpError("An account already exists for this email address.", 409);
        }
        if (await Stylist.findOne({ email }).session(session)) {
          throw httpError("A staff profile already exists for this email. Use Enable sign-in instead.", 409);
        }

        [user] = await User.create(
          [{
            name,
            email,
            password: await bcrypt.hash(password, 10),
            role,
            permissions,
            rolePermissions: rolePermissions(roleDefinition),
            phone: cleanText(req.body.phone, 40),
            profilePhoto,
            isActive: req.body.isActive !== false,
            createdBy: req.user._id,
          }],
          { session }
        );

        const payload = newStaffMembershipPayload({
          authority: req.effectiveAuthority,
          userId: user._id,
          roleKey: role,
          workingLocationIds: ownership.workingLocationIds,
          actorId: req.user._id,
          isDefault: true,
        });
        [membership] = await BusinessMembership.create([payload], { session });

        [stylist] = await Stylist.create(
          [{
            business: ownership.businessId,
            workingLocations: ownership.workingLocationIds,
            userAccount: user._id,
            firstName,
            lastName,
            email,
            phone: user.phone || "",
            profileImage: profilePhoto,
            jobTitle: cleanText(req.body.jobTitle, 120) || "Salon professional",
            biography: cleanText(req.body.biography, 2000),
            specialties: Array.isArray(req.body.specialties) ? req.body.specialties.map((value) => cleanText(value, 120)).filter(Boolean).slice(0, 12) : [],
            services,
            ...(workingHours ? { workingHours } : {}),
            profilePublished: req.body.profilePublished === true,
            acceptsAppointments: req.body.acceptsAppointments === true,
            isActive: req.body.isActive !== false,
          }],
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    await stylist.populate("services", "name category price duration active onlineBookable");
    const created = serialiseTenantUser(user, stylist, membership);
    await recordAuditEvent({
      req,
      action: "employee.created",
      resourceType: "employee",
      resourceId: user._id,
      after: created,
      metadata: { businessId: membership.business, initialServices: services, scheduleConfigured: Boolean(workingHours) },
    });

    return res.status(201).json({ success: true, message: "Employee account, membership and profile created successfully.", user: created });
  } catch (error) {
    return next(error);
  }
}

export async function updateTenantEmployeeServices(req, res, next) {
  try {
    const services = await scopedServiceIds(req, req.body.services);
    const { user, stylist, membership } = await userAndProfile(req, req.params.id);
    const before = serialiseTenantUser(user, stylist, membership);
    stylist.services = services;
    await stylist.save();
    await stylist.populate("services", "name category price duration active onlineBookable");
    const after = serialiseTenantUser(user, stylist, membership);
    await recordAuditEvent({ req, action: "employee.services_updated", resourceType: "employee", resourceId: user._id, before, after });
    return res.json({ success: true, message: "Employee services updated.", user: after });
  } catch (error) {
    return next(error);
  }
}

export async function updateTenantEmployeeSchedule(req, res, next) {
  try {
    const { user, stylist, membership } = await userAndProfile(req, req.params.id);
    const before = serialiseTenantUser(user, stylist, membership);
    stylist.workingHours = normaliseEmployeeSchedule(req.body.workingHours);
    await stylist.save();
    const after = serialiseTenantUser(user, stylist, membership);
    await recordAuditEvent({ req, action: "employee.schedule_updated", resourceType: "employee", resourceId: user._id, before, after });
    return res.json({ success: true, message: "Employee schedule updated.", user: after });
  } catch (error) {
    return next(error);
  }
}

export async function updateTenantEmployeeManagementSettings(req, res, next) {
  try {
    const update = normaliseEmployeeManagementUpdate(req.body);
    const { user, stylist, membership } = await userAndProfile(req, req.params.id);
    const before = serialiseTenantUser(user, stylist, membership);

    let roleDefinition = null;
    if (update.role) {
      if (!hasRequestPermission(req, "employee:role:update")) {
        throw httpError("You do not have permission to change employee access roles.", 403);
      }
      roleDefinition = await resolveAssignableRole(req, update.role);
      await protectFinalBusinessSuperAdmin(req, membership, update.role, null);
    }

    let nonRevokedMembershipCount = null;
    if (update.role || Array.isArray(update.permissions)) {
      nonRevokedMembershipCount = await BusinessMembership.countDocuments({
        user: user._id,
        status: { $ne: "revoked" },
      });
    }

    if (Array.isArray(update.permissions)) {
      if (!hasRequestPermission(req, "employee:permissions:update")) {
        throw httpError("You do not have permission to change employee permissions.", 403);
      }
      if (nonRevokedMembershipCount > 1) {
        throw httpError(
          "Direct User permission overrides are global legacy state and cannot be changed for a multi-Business employee. Assign a tenant role instead.",
          409
        );
      }
      user.permissions = update.permissions;
    }

    const mirrorLegacyRole = Boolean(update.role) && nonRevokedMembershipCount === 1;
    if (update.role) {
      membership.roleKey = update.role;
      membership.updatedBy = req.user._id;
      if (mirrorLegacyRole) {
        user.role = update.role;
        user.rolePermissions = rolePermissions(roleDefinition);
      }
    }
    if (typeof update.profilePublished === "boolean") stylist.profilePublished = update.profilePublished;
    if (typeof update.acceptsAppointments === "boolean") stylist.acceptsAppointments = update.acceptsAppointments;

    user.updatedBy = req.user._id;
    await Promise.all([user.save(), stylist.save(), membership.save()]);
    await stylist.populate("services", "name category active onlineBookable");
    const after = serialiseTenantUser(user, stylist, membership);
    await recordAuditEvent({
      req,
      action: "employee.settings_updated",
      resourceType: "employee",
      resourceId: user._id,
      before,
      after,
      metadata: {
        businessId: membership.business,
        changedFields: Object.keys(update),
        mirroredLegacyRole,
      },
    });
    return res.json({ success: true, message: "Employee settings updated.", user: after });
  } catch (error) {
    return next(error);
  }
}

export async function updateTenantAdminUserStatus(req, res, next) {
  try {
    const requested = req.body.isActive;
    if (typeof requested !== "boolean") throw httpError("isActive must be true or false.", 400);

    const { user, stylist, membership } = await userAndProfile(req, req.params.id);
    if (membership.roleKey === "super_admin" && !hasRequestPermission(req, "employee:role:update")) {
      throw httpError("Only a Super Admin can change a Super Admin account.", 403);
    }
    if (String(user._id) === String(req.user._id) && requested === false) {
      throw httpError("You cannot deactivate your own administrator account.", 409);
    }
    await protectFinalBusinessSuperAdmin(req, membership, null, requested);

    const before = serialiseTenantUser(user, stylist, membership);
    membership.status = requested ? "active" : "suspended";
    membership.updatedBy = req.user._id;
    stylist.isActive = requested;

    if (requested) {
      user.isActive = true;
    } else {
      const otherActiveMemberships = await BusinessMembership.countDocuments({
        user: user._id,
        business: { $ne: membership.business },
        status: "active",
      });
      if (otherActiveMemberships === 0) user.isActive = false;
    }
    user.updatedBy = req.user._id;

    await Promise.all([membership.save(), stylist.save(), user.save()]);
    const after = serialiseTenantUser(user, stylist, membership);
    await recordAuditEvent({
      req,
      action: "employee.status_updated",
      resourceType: "employee",
      resourceId: user._id,
      before,
      after,
      metadata: { businessId: membership.business, membershipStatus: membership.status },
    });
    return res.json({ success: true, message: requested ? "Staff membership activated." : "Staff membership suspended.", user: after });
  } catch (error) {
    return next(error);
  }
}

export default {
  createTenantStaffUserByAdmin,
  enableTenantEmployeeSignIn,
  getTenantEmployeeManagementDetail,
  getTenantEmployeeWithoutSignInManagementDetail,
  listTenantAdminUsers,
  updateTenantAdminUserStatus,
  updateTenantEmployeeManagementSettings,
  updateTenantEmployeeRecordSchedule,
  updateTenantEmployeeRecordServices,
  updateTenantEmployeeSchedule,
  updateTenantEmployeeServices,
};