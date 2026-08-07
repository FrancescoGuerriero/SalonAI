import mongoose from "mongoose";

const { Schema } = mongoose;

const importFailureSchema = new Schema(
  {
    rowNumber: {
      type: Number,
      required: true,
      min: 2,
    },
    code: {
      type: String,
      trim: true,
      default: "IMPORT_ROW_FAILED",
      maxlength: 100,
    },
    message: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

const importSummarySchema = new Schema(
  {
    total: { type: Number, default: 0, min: 0 },
    created: { type: Number, default: 0, min: 0 },
    updated: { type: Number, default: 0, min: 0 },
    skipped: { type: Number, default: 0, min: 0 },
    failed: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const dataImportJobSchema = new Schema(
  {
    entityType: {
      type: String,
      enum: ["customers", "products"],
      required: true,
      index: true,
    },
    duplicatePolicy: {
      type: String,
      enum: ["skip", "update"],
      required: true,
    },
    fileName: {
      type: String,
      trim: true,
      required: true,
      maxlength: 255,
    },
    fileHash: {
      type: String,
      trim: true,
      required: true,
      maxlength: 64,
    },
    status: {
      type: String,
      enum: ["processing", "completed", "partial", "failed"],
      default: "processing",
      index: true,
    },
    summary: {
      type: importSummarySchema,
      default: () => ({}),
    },
    failures: {
      type: [importFailureSchema],
      default: [],
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

dataImportJobSchema.index({ createdAt: -1, entityType: 1 });

const DataImportJob =
  mongoose.models.DataImportJob ||
  mongoose.model("DataImportJob", dataImportJobSchema);

export default DataImportJob;
