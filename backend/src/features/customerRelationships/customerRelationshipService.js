import Customer from "../../models/customer.js";
import CustomerRelationship from "./CustomerRelationship.js";
import { createServiceError } from "../../shared/serviceError.js";

function userId(user) {
  return user?._id || user?.id;
}

async function customerForUser(user) {
  if (user?.customerProfile) {
    const linked = await Customer.findOne({
      _id: user.customerProfile,
      status: { $ne: "deleted" },
    });
    if (linked) return linked;
  }

  const customer = await Customer.findOne({
    userAccount: userId(user),
    status: { $ne: "deleted" },
  });
  if (!customer) throw createServiceError("No salon customer profile is linked to this account.", 404);
  return customer;
}

function publicCustomer(customer) {
  return customer ? {
    id: customer._id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    preferredName: customer.preferredName,
  } : null;
}

function publicRelationship(record, selfId) {
  const sourceId = String(record.sourceCustomer?._id || record.sourceCustomer);
  const isSource = sourceId === String(selfId);
  return {
    id: record._id,
    relationshipType: record.relationshipType,
    status: record.status,
    direction: isSource ? "outgoing" : "incoming",
    person: publicCustomer(isSource ? record.targetCustomer : record.sourceCustomer),
    sharing: record.sharing,
    createdAt: record.createdAt,
    acceptedAt: record.acceptedAt,
    revokedAt: record.revokedAt,
  };
}

export async function listMyRelationships(user) {
  const self = await customerForUser(user);
  const records = await CustomerRelationship.find({
    $or: [{ sourceCustomer: self._id }, { targetCustomer: self._id }],
    status: { $ne: "revoked" },
  })
    .populate("sourceCustomer", "firstName lastName preferredName")
    .populate("targetCustomer", "firstName lastName preferredName")
    .sort({ createdAt: -1 });
  return records.map((record) => publicRelationship(record, self._id));
}

export async function inviteRelationship(payload, user) {
  const self = await customerForUser(user);
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email) throw createServiceError("An existing customer email is required.", 422);

  const relationshipType = String(payload.relationshipType || "family").trim().toLowerCase();
  const allowed = new Set(["partner", "spouse", "parent", "child", "guardian", "dependent", "family", "other"]);
  if (!allowed.has(relationshipType)) throw createServiceError("Relationship type is invalid.", 422);

  const target = await Customer.findOne({ email, status: { $ne: "deleted" } });
  if (!target) {
    // Do not reveal whether arbitrary emails are registered beyond this authenticated customer workflow.
    throw createServiceError("The relationship invitation could not be created for that customer.", 404);
  }
  if (String(target._id) === String(self._id)) throw createServiceError("You cannot create a relationship with your own profile.", 409);
  if (self.business && target.business && String(self.business) !== String(target.business)) {
    throw createServiceError("Household relationships must belong to the same business context.", 409);
  }

  const existing = await CustomerRelationship.findOne({
    $or: [
      { sourceCustomer: self._id, targetCustomer: target._id },
      { sourceCustomer: target._id, targetCustomer: self._id },
    ],
    status: { $in: ["pending", "active"] },
  });
  if (existing) throw createServiceError("A relationship between these customers is already pending or active.", 409);

  const relationship = await CustomerRelationship.create({
    business: self.business || target.business || undefined,
    sourceCustomer: self._id,
    targetCustomer: target._id,
    invitedBy: self._id,
    relationshipType,
    // Sharing is fail-closed. The Stage 4 model establishes consented linkage only.
    sharing: { appointments: false, loyalty: false, wallet: false, communications: false },
  });
  await relationship.populate("targetCustomer", "firstName lastName preferredName");
  return publicRelationship(relationship, self._id);
}

export async function respondToRelationship(relationshipId, decision, user) {
  const self = await customerForUser(user);
  const status = String(decision || "").trim().toLowerCase();
  if (!["active", "declined"].includes(status)) throw createServiceError("Relationship response is invalid.", 422);

  const relationship = await CustomerRelationship.findOne({
    _id: relationshipId,
    targetCustomer: self._id,
    status: "pending",
  });
  if (!relationship) throw createServiceError("Pending relationship invitation not found.", 404);

  relationship.status = status;
  relationship.acceptedAt = status === "active" ? new Date() : null;
  await relationship.save();
  return relationship;
}

export async function revokeRelationship(relationshipId, user) {
  const self = await customerForUser(user);
  const relationship = await CustomerRelationship.findOne({
    _id: relationshipId,
    status: { $in: ["pending", "active"] },
    $or: [{ sourceCustomer: self._id }, { targetCustomer: self._id }],
  });
  if (!relationship) throw createServiceError("Relationship not found.", 404);
  relationship.status = "revoked";
  relationship.revokedAt = new Date();
  await relationship.save();
  return relationship;
}

export default {
  inviteRelationship,
  listMyRelationships,
  respondToRelationship,
  revokeRelationship,
};
