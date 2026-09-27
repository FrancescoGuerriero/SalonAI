import mongoose from "mongoose";

const {
  Schema,
} = mongoose;

export const LOCATION_SERVICE_OFFERING_STATUSES =
  Object.freeze([
    "active",
    "inactive",
    "suspended",
    "archived",
  ]);

const locationServiceOfferingSchema =
  new Schema(
    {
      business: {
        type:
          Schema.Types.ObjectId,
        ref:
          "Business",
        required:
          true,
        index:
          true,
      },

      location: {
        type:
          Schema.Types.ObjectId,
        ref:
          "Location",
        required:
          true,
        index:
          true,
      },

      service: {
        type:
          Schema.Types.ObjectId,
        ref:
          "Service",
        required:
          true,
        index:
          true,
      },

      status: {
        type:
          String,
        enum:
          LOCATION_SERVICE_OFFERING_STATUSES,
        default:
          "active",
        index:
          true,
      },

      available: {
        type:
          Boolean,
        default:
          true,
      },

      bookableOverride: {
        type:
          Boolean,
        default:
          undefined,
      },

      priceOverride: {
        type:
          Number,
        min:
          0,
        default:
          undefined,
      },

      priceLabelOverride: {
        type:
          String,
        trim:
          true,
        maxlength:
          120,
        default:
          undefined,
      },

      priceOnConsultationOverride: {
        type:
          Boolean,
        default:
          undefined,
      },

      durationOverride: {
        type:
          Number,
        min:
          1,
        default:
          undefined,
      },

      durationEstimatedOverride: {
        type:
          Boolean,
        default:
          undefined,
      },

      publicationOverride: {
        type:
          Boolean,
        default:
          undefined,
      },

      metadata: {
        type:
          Schema.Types.Mixed,
        default:
          () => ({}),
      },

      createdBy: {
        type:
          Schema.Types.ObjectId,
        ref:
          "User",
        default:
          null,
      },

      updatedBy: {
        type:
          Schema.Types.ObjectId,
        ref:
          "User",
        default:
          null,
      },
    },
    {
      timestamps:
        true,
    }
  );

locationServiceOfferingSchema.index(
  {
    business:
      1,
    location:
      1,
    service:
      1,
  },
  {
    unique:
      true,
  }
);

locationServiceOfferingSchema.index({
  business:
    1,
  location:
    1,
  status:
    1,
  service:
    1,
});

locationServiceOfferingSchema.index({
  business:
    1,
  service:
    1,
  status:
    1,
});

const LocationServiceOffering =
  mongoose.models
    .LocationServiceOffering ||
  mongoose.model(
    "LocationServiceOffering",
    locationServiceOfferingSchema
  );

export default LocationServiceOffering;
