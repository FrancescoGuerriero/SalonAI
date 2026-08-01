import mongoose from "mongoose";

const customerTagAssignmentSchema =
  new mongoose.Schema(
    {
      customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
        index: true,
      },
      tag: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CustomerTag",
        required: true,
        index: true,
      },
      assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    {
      timestamps: true,
    }
  );

customerTagAssignmentSchema.index(
  {
    customer: 1,
    tag: 1,
  },
  {
    unique: true,
  }
);

const CustomerTagAssignment =
  mongoose.models.CustomerTagAssignment ||
  mongoose.model(
    "CustomerTagAssignment",
    customerTagAssignmentSchema
  );

export default CustomerTagAssignment;
