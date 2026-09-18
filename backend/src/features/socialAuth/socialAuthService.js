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

export async function listLinkedSocialProviders(
  userId
) {
  const user =
    await User.findById(
      userId
    ).select(
      "role passwordAuthEnabled"
    );

  if (!user) {
    const error = new Error(
      "SalonAI account not found."
    );
    error.statusCode = 404;
    throw error;
  }

  const identities =
    await SocialIdentity.find({
      user: user._id,
    })
      .select(
        "provider email displayName lastLoginAt"
      )
      .lean();

  return {
    passwordAuthEnabled:
      user.passwordAuthEnabled !== false,
    identities,
  };
}

export async function linkSocialIdentity(
  userId,
  identity
) {
  validateIdentity(
    identity
  );

  const user =
    await User.findById(
      userId
    );

  if (
    !user ||
    user.isActive === false
  ) {
    const error = new Error(
      "SalonAI account is unavailable."
    );
    error.statusCode = 403;
    throw error;
  }

  if (
    user.role !== "customer"
  ) {
    const error = new Error(
      "Customer connected-account settings cannot modify a staff identity."
    );
    error.statusCode = 403;
    error.code =
      "CUSTOMER_SOCIAL_LINK_ONLY";
    throw error;
  }

  const subjectOwner =
    await SocialIdentity.findOne({
      provider:
        identity.provider,
      subject:
        identity.subject,
    });

  if (
    subjectOwner &&
    String(
      subjectOwner.user
    ) !== String(user._id)
  ) {
    const error = new Error(
      "This provider account is already linked to another SalonAI account."
    );
    error.statusCode = 409;
    error.code =
      "SOCIAL_IDENTITY_ALREADY_LINKED";
    throw error;
  }

  const currentProvider =
    await SocialIdentity.findOne({
      user: user._id,
      provider:
        identity.provider,
    });

  if (
    currentProvider &&
    currentProvider.subject !==
      identity.subject
  ) {
    const error = new Error(
      "A different account from this provider is already linked. Disconnect it before linking another."
    );
    error.statusCode = 409;
    error.code =
      "SOCIAL_PROVIDER_ALREADY_LINKED";
    throw error;
  }

  const linked =
    currentProvider ||
    new SocialIdentity({
      user: user._id,
      provider:
        identity.provider,
      subject:
        identity.subject,
    });

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

  return linked;
}

export async function unlinkSocialIdentity(
  userId,
  provider
) {
  const user =
    await User.findById(
      userId
    ).select(
      "role passwordAuthEnabled"
    );

  if (
    !user ||
    user.role !== "customer"
  ) {
    const error = new Error(
      "Customer account not found."
    );
    error.statusCode = 404;
    throw error;
  }

  const identities =
    await SocialIdentity.find({
      user: user._id,
    });

  const target =
    identities.find(
      (identity) =>
        identity.provider ===
        provider
    );

  if (!target) {
    return {
      provider,
      linked: false,
    };
  }

  if (
    user.passwordAuthEnabled ===
      false &&
    identities.length <= 1
  ) {
    const error = new Error(
      "You cannot disconnect your only sign-in method. Add a SalonAI password or link another provider first."
    );
    error.statusCode = 409;
    error.code =
      "LAST_SIGN_IN_METHOD";
    throw error;
  }

  await target.deleteOne();

  return {
    provider,
    linked: false,
  };
}
