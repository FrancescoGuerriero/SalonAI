import Customer from "../../models/customer.js";
import SocialIdentity from "../../models/SocialIdentity.js";
import User from "../../models/user.js";

function splitName(value) {
  const parts =
    String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: "SalonAI",
      lastName: "Customer",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "Customer",
    };
  }

  return {
    firstName: parts[0],
    lastName:
      parts.slice(1).join(" "),
  };
}

async function ensureCustomerProfile(
  user,
  identity
) {
  if (user.customerProfile) {
    return;
  }

  let customer =
    await Customer.findOne({
      userAccount: user._id,
    });

  if (!customer) {
    customer =
      await Customer.findOne({
        email: user.email,
      });
  }

  if (
    customer?.userAccount &&
    String(
      customer.userAccount
    ) !== String(user._id)
  ) {
    const error = new Error(
      "A customer profile for this email is already linked to another SalonAI account."
    );
    error.statusCode = 409;
    error.code =
      "CUSTOMER_PROFILE_ALREADY_LINKED";
    throw error;
  }

  if (!customer) {
    const names =
      splitName(
        identity.name ||
          user.name
      );

    customer =
      await Customer.create({
        userAccount: user._id,
        firstName:
          names.firstName,
        lastName:
          names.lastName,
        email:
          user.email,
        source:
          "social_media",
        createdBy:
          user._id,
        updatedBy:
          user._id,
      });
  } else if (
    !customer.userAccount
  ) {
    customer.userAccount =
      user._id;
    customer.updatedBy =
      user._id;
    await customer.save();
  }

  user.customerProfile =
    customer._id;
  await user.save();
}

function validateIdentity(identity) {
  if (
    !identity?.provider ||
    !identity.subject
  ) {
    const error = new Error(
      "The sign-in provider did not return a stable account identity."
    );
    error.statusCode = 502;
    error.code =
      "SOCIAL_IDENTITY_INCOMPLETE";
    throw error;
  }

  if (!identity.email) {
    const error = new Error(
      "SalonAI needs an email address to create your customer account. Please allow the provider to share your email or use email registration."
    );
    error.statusCode = 409;
    error.code =
      "SOCIAL_EMAIL_REQUIRED";
    throw error;
  }
}

export async function resolveSocialCustomer(
  identity
) {
  validateIdentity(identity);

  const linked =
    await SocialIdentity.findOne({
      provider:
        identity.provider,
      subject:
        identity.subject,
    });

  if (linked) {
    const user =
      await User.findById(
        linked.user
      );

    if (
      !user ||
      user.isActive === false
    ) {
      const error = new Error(
        "This SalonAI account is unavailable."
      );
      error.statusCode = 403;
      error.code =
        "SOCIAL_ACCOUNT_UNAVAILABLE";
      throw error;
    }

    linked.email =
      identity.email;
    linked.emailVerified =
      identity.emailVerified ===
      true;
    linked.displayName =
      identity.name || "";
    linked.pictureUrl =
      identity.pictureUrl || "";
    linked.lastLoginAt =
      new Date();
    await linked.save();

    return {
      user,
      created: false,
    };
  }

  const existingUser =
    await User.findOne({
      email:
        identity.email,
    });

  if (existingUser) {
    if (
      existingUser.role !==
      "customer"
    ) {
      const error = new Error(
        "This email belongs to a SalonAI staff account. Sign in with the staff account first before linking an external identity."
      );
      error.statusCode = 409;
      error.code =
        "STAFF_SOCIAL_LINK_REQUIRES_SESSION";
      throw error;
    }

    const error = new Error(
      "A SalonAI customer account already exists for this email. Sign in with your existing method first, then link this provider from your account settings."
    );
    error.statusCode = 409;
    error.code =
      "SOCIAL_ACCOUNT_LINK_REQUIRED";
    throw error;
  }

  const user =
    await User.create({
      name:
        identity.name ||
        identity.email.split(
          "@"
        )[0],
      email:
        identity.email,
      role: "customer",
      passwordAuthEnabled:
        false,
      emailVerified:
        identity.emailVerified ===
        true,
      emailVerificationRequired:
        false,
      profilePhoto:
        identity.pictureUrl || "",
    });

  try {
    await SocialIdentity.create({
      user: user._id,
      provider:
        identity.provider,
      subject:
        identity.subject,
      email:
        identity.email,
      emailVerified:
        identity.emailVerified ===
        true,
      displayName:
        identity.name || "",
      pictureUrl:
        identity.pictureUrl || "",
      lastLoginAt:
        new Date(),
    });

    await ensureCustomerProfile(
      user,
      identity
    );
  } catch (error) {
    await SocialIdentity.deleteMany({
      user: user._id,
    });
    await User.deleteOne({
      _id: user._id,
    });
    throw error;
  }

  return {
    user,
    created: true,
  };
}
