import mongoose from "mongoose";

const {
  Schema,
} = mongoose;

const CUSTOMER_NOTE_TYPES = [
  "general",
  "consultation",
  "service",
  "colour_formula",
  "allergy",
  "preference",
  "complaint",
  "follow_up",
  "safeguarding",
  "payment",
  "other",
];

const CUSTOMER_NOTE_VISIBILITIES = [
  "management",
  "staff",
  "private",
];

const customerNoteSchema =
  new Schema(
    {
      customer: {
        type: Schema.Types.ObjectId,
        ref: "Customer",
        required: [
          true,
          "A customer is required.",
        ],
        index: true,
      },

      title: {
        type: String,
        trim: true,
        default: "",
        maxlength: [
          150,
          "Note title cannot exceed 150 characters.",
        ],
      },

      content: {
        type: String,
        required: [
          true,
          "Note content is required.",
        ],
        trim: true,
        maxlength: [
          10000,
          "Note content cannot exceed 10,000 characters.",
        ],
      },

      type: {
        type: String,
        enum: {
          values:
            CUSTOMER_NOTE_TYPES,

          message:
            "Unsupported customer note type.",
        },
        default: "general",
        index: true,
      },

      visibility: {
        type: String,
        enum: {
          values:
            CUSTOMER_NOTE_VISIBILITIES,

          message:
            "Unsupported customer note visibility.",
        },
        default: "staff",
        index: true,
      },

      tags: [
        {
          type: String,
          trim: true,
          lowercase: true,
          maxlength: [
            100,
            "A note tag cannot exceed 100 characters.",
          ],
        },
      ],

      appointment: {
        type: Schema.Types.ObjectId,
        ref: "Appointment",
        default: null,
      },

      service: {
        type: Schema.Types.ObjectId,
        ref: "Service",
        default: null,
      },

      stylist: {
        type: Schema.Types.ObjectId,
        ref: "Stylist",
        default: null,
      },

      pinned: {
        type: Boolean,
        default: false,
        index: true,
      },

      requiresFollowUp: {
        type: Boolean,
        default: false,
        index: true,
      },

      followUpAt: {
        type: Date,
        default: null,
      },

      followUpCompleted: {
        type: Boolean,
        default: false,
      },

      followUpCompletedAt: {
        type: Date,
        default: null,
      },

      followUpCompletedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      attachments: [
        {
          name: {
            type: String,
            trim: true,
            required: true,
            maxlength: 255,
          },

          url: {
            type: String,
            trim: true,
            required: true,
            maxlength: 2000,
          },

          mimeType: {
            type: String,
            trim: true,
            default: "",
            maxlength: 150,
          },

          sizeBytes: {
            type: Number,
            default: 0,
            min: 0,
          },

          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],

      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [
          true,
          "The note author is required.",
        ],
      },

      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      isEdited: {
        type: Boolean,
        default: false,
      },

      editedAt: {
        type: Date,
        default: null,
      },

      deletedAt: {
        type: Date,
        default: null,
        index: true,
      },

      deletedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    {
      timestamps: true,

      toJSON: {
        virtuals: true,
      },

      toObject: {
        virtuals: true,
      },
    }
  );

/*
|--------------------------------------------------------------------------
| Virtual fields
|--------------------------------------------------------------------------
*/

customerNoteSchema
  .virtual("isDeleted")
  .get(function getDeletedStatus() {
    return Boolean(
      this.deletedAt
    );
  });

customerNoteSchema
  .virtual("isFollowUpOverdue")
  .get(function getFollowUpStatus() {
    if (
      !this.requiresFollowUp ||
      this.followUpCompleted ||
      !this.followUpAt
    ) {
      return false;
    }

    return (
      new Date(
        this.followUpAt
      ).getTime() <
      Date.now()
    );
  });

/*
|--------------------------------------------------------------------------
| Validation and normalisation
|--------------------------------------------------------------------------
*/

customerNoteSchema.pre(
  "validate",
  function normaliseCustomerNote() {
    if (
      Array.isArray(this.tags)
    ) {
      this.tags = Array.from(
        new Set(
          this.tags
            .map((tag) =>
              String(tag)
                .trim()
                .toLowerCase()
            )
            .filter(Boolean)
        )
      );
    }

    if (
      !this.requiresFollowUp
    ) {
      this.followUpAt =
        null;

      this.followUpCompleted =
        false;

      this.followUpCompletedAt =
        null;

      this.followUpCompletedBy =
        null;
    }

    if (
      this.followUpCompleted
    ) {
      this.requiresFollowUp =
        true;

      if (
        !this.followUpCompletedAt
      ) {
        this.followUpCompletedAt =
          new Date();
      }
    } else {
      this.followUpCompletedAt =
        null;

      this.followUpCompletedBy =
        null;
    }

    if (
      this.deletedAt &&
      !this.deletedBy
    ) {
      this.invalidate(
        "deletedBy",
        "The user deleting the note is required."
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Note methods
|--------------------------------------------------------------------------
*/

customerNoteSchema.methods.markEdited =
  function markEdited(
    updatedBy
  ) {
    this.updatedBy =
      updatedBy || null;

    this.isEdited = true;

    this.editedAt =
      new Date();

    return this;
  };

customerNoteSchema.methods.completeFollowUp =
  function completeFollowUp(
    completedBy
  ) {
    this.requiresFollowUp =
      true;

    this.followUpCompleted =
      true;

    this.followUpCompletedAt =
      new Date();

    this.followUpCompletedBy =
      completedBy || null;

    return this;
  };

customerNoteSchema.methods.reopenFollowUp =
  function reopenFollowUp() {
    this.requiresFollowUp =
      true;

    this.followUpCompleted =
      false;

    this.followUpCompletedAt =
      null;

    this.followUpCompletedBy =
      null;

    return this;
  };

customerNoteSchema.methods.softDelete =
  function softDelete(
    deletedBy
  ) {
    this.deletedAt =
      new Date();

    this.deletedBy =
      deletedBy;

    return this;
  };

customerNoteSchema.methods.restore =
  function restore() {
    this.deletedAt =
      null;

    this.deletedBy =
      null;

    return this;
  };

/*
|--------------------------------------------------------------------------
| Query helpers
|--------------------------------------------------------------------------
*/

customerNoteSchema.query.notDeleted =
  function notDeleted() {
    return this.where({
      deletedAt: null,
    });
  };

customerNoteSchema.query.forCustomer =
  function forCustomer(
    customerId
  ) {
    return this.where({
      customer: customerId,
    });
  };

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

customerNoteSchema.index({
  customer: 1,
  pinned: -1,
  createdAt: -1,
});

customerNoteSchema.index({
  customer: 1,
  type: 1,
  createdAt: -1,
});

customerNoteSchema.index({
  customer: 1,
  tags: 1,
});

customerNoteSchema.index({
  requiresFollowUp: 1,
  followUpCompleted: 1,
  followUpAt: 1,
});

customerNoteSchema.index({
  customer: 1,
  deletedAt: 1,
});

customerNoteSchema.index({
  title: "text",
  content: "text",
  tags: "text",
});

const CustomerNote =
  mongoose.models
    .CustomerNote ||
  mongoose.model(
    "CustomerNote",
    customerNoteSchema
  );

export {
  CUSTOMER_NOTE_TYPES,
  CUSTOMER_NOTE_VISIBILITIES,
};

export default CustomerNote;