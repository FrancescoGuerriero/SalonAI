import mongoose from "mongoose";

const { Schema } = mongoose;

const SOCIAL_AUTH_PROVIDERS = Object.freeze([
  "google",
  "facebook",
  "microsoft",
  "yahoo",
]);

const socialIdentitySchema =
  new Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      provider: {
        type: String,
        enum: SOCIAL_AUTH_PROVIDERS,
        required: true,
        index: true,
      },
      subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 512,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
        maxlength: 254,
      },
      emailVerified: {
        type: Boolean,
        default: false,
      },
      displayName: {
        type: String,
        trim: true,
        default: "",
        maxlength: 160,
      },
      pictureUrl: {
        type: String,
        trim: true,
        default: "",
        maxlength: 2000,
      },
      lastLoginAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

socialIdentitySchema.index(
  {
    provider: 1,
    subject: 1,
  },
  {
    unique: true,
  }
);

socialIdentitySchema.index(
  {
    user: 1,
    provider: 1,
  },
  {
    unique: true,
  }
);

const SocialIdentity =
  mongoose.models.SocialIdentity ||
  mongoose.model(
    "SocialIdentity",
    socialIdentitySchema
  );

export {
  SOCIAL_AUTH_PROVIDERS,
};

export default SocialIdentity;
