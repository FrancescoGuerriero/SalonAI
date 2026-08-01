import Customer from "../../models/customer.js";
import Appointment from "../../models/Appointment.js";
import CustomerContactLog from "../../models/customerContactLog.js";
import CustomerNote from "../../models/CustomerNote.js";
import CustomerTag from "./CustomerTag.js";
import CustomerTagAssignment from "./CustomerTagAssignment.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import { userId } from "../../shared/modelHelpers.js";

function featureNotePayload(payload = {}) {
  const isPrivate =
    payload.private === undefined
      ? undefined
      : Boolean(payload.private);

  return {
    title: String(payload.title || "").trim(),
    content: String(
      payload.content ?? payload.body ?? ""
    ).trim(),
    type: payload.type || payload.category || "general",
    visibility:
      payload.visibility ||
      (isPrivate === undefined
        ? "private"
        : isPrivate
          ? "private"
          : "staff"),
  };
}

function serializeFeatureNote(noteValue) {
  const note =
    typeof noteValue?.toObject === "function"
      ? noteValue.toObject()
      : { ...noteValue };

  return {
    ...note,
    body: note.content ?? note.body ?? "",
    category: note.type ?? note.category ?? "general",
    private:
      note.visibility
        ? note.visibility === "private"
        : Boolean(note.private),
  };
}

export async function getCustomerProfile(
  customerId
) {
  const customer = assertFound(
    await Customer.findById(customerId).lean(),
    "Customer not found."
  );

  const [
    appointments,
    notes,
    assignments,
    contacts,
    metricsRows,
  ] = await Promise.all([
    Appointment.find({
      customer: customerId,
    })
      .populate("service", "name price duration")
      .populate(
        "stylist",
        "name firstName lastName email"
      )
      .sort({
        appointmentDate: -1,
        appointmentTime: -1,
      })
      .limit(200)
      .lean(),

    CustomerNote.find({
      customer: customerId,
      deletedAt: null,
    })
      .populate(
        "createdBy updatedBy",
        "name firstName lastName email"
      )
      .sort({ createdAt: -1 })
      .lean(),

    CustomerTagAssignment.find({
      customer: customerId,
    })
      .populate("tag")
      .sort({ createdAt: -1 })
      .lean(),

    CustomerContactLog.find({
      customer: customerId,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),

    Appointment.aggregate([
      {
        $match: {
          customer: customer._id,
        },
      },
      {
        $group: {
          _id: null,
          appointmentCount: {
            $sum: {
              $cond: [
                {
                  $not: {
                    $in: [
                      "$status",
                      ["cancelled", "no_show"],
                    ],
                  },
                },
                1,
                0,
              ],
            },
          },
          completedAppointments: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "completed"],
                },
                1,
                0,
              ],
            },
          },
          noShowCount: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "no_show"],
                },
                1,
                0,
              ],
            },
          },
          totalSpend: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "completed"],
                },
                {
                  $ifNull: [
                    "$totalPrice",
                    {
                      $ifNull: ["$price", 0],
                    },
                  ],
                },
                0,
              ],
            },
          },
          lastAppointmentAt: {
            $max: "$appointmentDate",
          },
        },
      },
    ]),
  ]);

  const metrics = metricsRows[0] || {
    appointmentCount: 0,
    completedAppointments: 0,
    noShowCount: 0,
    totalSpend: 0,
    lastAppointmentAt: null,
  };

  return {
    customer,
    metrics,
    appointments,
    notes: notes.map(serializeFeatureNote),
    tags: assignments
      .map((assignment) => assignment.tag)
      .filter(Boolean),
    contacts,
  };
}

export async function createNote(
  customerId,
  payload,
  user
) {
  const customerExists = await Customer.exists({
    _id: customerId,
  });

  assertFound(customerExists, "Customer not found.");

  const notePayload = featureNotePayload(payload);

  if (!notePayload.content) {
    throw createServiceError(
      "Note body is required.",
      400
    );
  }

  const note = await CustomerNote.create({
    customer: customerId,
    ...notePayload,
    createdBy: userId(user),
    updatedBy: userId(user),
  });

  return serializeFeatureNote(note);
}

export async function updateNote(
  noteId,
  payload,
  user
) {
  const note = assertFound(
    await CustomerNote.findById(noteId),
    "Customer note not found."
  );

  const mappedFields = {
    title: payload.title,
    content: payload.content ?? payload.body,
    type: payload.type ?? payload.category,
    visibility:
      payload.visibility ??
      (payload.private === undefined
        ? undefined
        : payload.private
          ? "private"
          : "staff"),
  };

  for (const [field, value] of Object.entries(mappedFields)) {
    if (value !== undefined) {
      note[field] =
        typeof value === "string"
          ? value.trim()
          : value;
    }
  }

  note.updatedBy = userId(user);
  await note.save();

  return serializeFeatureNote(note);
}

export async function deleteNote(noteId, user) {
  const note = assertFound(
    await CustomerNote.findOne({
      _id: noteId,
      deletedAt: null,
    }),
    "Customer note not found."
  );

  const actorId = userId(user);
  note.deletedAt = new Date();
  note.deletedBy = actorId;
  note.updatedBy = actorId;
  await note.save();

  return {
    message: "Customer note deleted.",
    id: String(note._id),
  };
}

export async function listTags() {
  return CustomerTag.find({
    active: true,
  })
    .sort({ label: 1 })
    .lean();
}

export async function createTag(payload) {
  const label = String(payload.label || "").trim();

  if (!label) {
    throw createServiceError(
      "Tag label is required.",
      400
    );
  }

  const name = String(
    payload.name ||
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
  );

  return CustomerTag.findOneAndUpdate(
    { name },
    {
      $set: {
        label,
        description: String(
          payload.description || ""
        ).trim(),
        active: true,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
}

export async function assignTag(
  customerId,
  tagId,
  user
) {
  const [customer, tag] = await Promise.all([
    Customer.exists({ _id: customerId }),
    CustomerTag.exists({ _id: tagId }),
  ]);

  assertFound(customer, "Customer not found.");
  assertFound(tag, "Customer tag not found.");

  return CustomerTagAssignment.findOneAndUpdate(
    {
      customer: customerId,
      tag: tagId,
    },
    {
      $setOnInsert: {
        assignedBy: userId(user),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
    .populate("tag")
    .lean();
}

export async function removeTag(
  customerId,
  tagId
) {
  const assignment =
    await CustomerTagAssignment.findOneAndDelete({
      customer: customerId,
      tag: tagId,
    });

  assertFound(
    assignment,
    "Customer tag assignment not found."
  );

  return {
    message: "Customer tag removed.",
  };
}
