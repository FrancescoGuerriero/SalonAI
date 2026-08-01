import mongoose from "mongoose";

import Customer from "../models/Customer.js";
import User from "../models/User.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAXIMUM_LIMIT = 100;

const CUSTOMER_STATUSES = [
  "active",
  "inactive",
  "archived",
  "deleted",
];

const SORT_FIELDS = {
  name: "firstName",
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  lastVisit: "lastVisit",
  nextAppointment: "nextAppointment",
  totalSpent: "totalSpent",
  visitCount: "visitCount",
  loyaltyPoints: "loyaltyPoints",
};

const PROTECTED_UPDATE_FIELDS = new Set([
  "_id",
  "id",
  "__v",
  "userAccount",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "visitCount",
  "completedAppointmentCount",
  "cancelledAppointmentCount",
  "noShowCount",
  "firstVisit",
  "lastVisit",
  "nextAppointment",
  "totalSpent",
  "averageSpend",
  "lastSpendAmount",
  "loyaltyPoints",
]);

const PROFILE_POPULATE_OPTIONS = [
  {
    path: "userAccount",
    select:
      "name email role isActive emailVerified lastLoginAt",
  },
  {
    path: "preferredStylist",
    select:
      "name firstName lastName email phone status",
  },
  {
    path: "preferredServices",
    select:
      "name category description price duration image active",
  },
  {
    path: "referredBy",
    select:
      "firstName lastName preferredName email phone status",
  },
  {
    path: "createdBy",
    select:
      "name email role",
  },
  {
    path: "updatedBy",
    select:
      "name email role",
  },
];

function createCustomerProfileError(
  message,
  {
    statusCode = 400,
    code = "CUSTOMER_PROFILE_ERROR",
    field = null,
    details = null,
    cause = null,
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;
  error.field = field;
  error.details = details;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseLowercase(value) {
  return normaliseText(value).toLowerCase();
}

function normaliseBoolean(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalisedValue =
    normaliseLowercase(value);

  if (
    [
      "true",
      "1",
      "yes",
      "on",
      "enabled",
      "subscribed",
    ].includes(normalisedValue)
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
      "disabled",
      "unsubscribed",
    ].includes(normalisedValue)
  ) {
    return false;
  }

  return fallback;
}

function normaliseInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsedValue)
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      parsedValue
    )
  );
}

function normaliseNumber(
  value,
  fallback = 0,
  minimum = 0
) {
  const parsedValue =
    Number(value);

  if (
    !Number.isFinite(parsedValue)
  ) {
    return fallback;
  }

  return Math.max(
    minimum,
    parsedValue
  );
}

function normaliseObject(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return {
    ...value,
  };
}

function normaliseStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) =>
          normaliseText(entry)
        )
        .filter(Boolean)
    )
  );
}

function normaliseTagArray(value) {
  return normaliseStringArray(
    value
  ).map((tag) =>
    tag.toLowerCase()
  );
}

function normaliseObjectIdArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) =>
          String(
            entry?._id ||
              entry?.id ||
              entry
          )
        )
        .filter((identifier) =>
          mongoose.isValidObjectId(
            identifier
          )
        )
    )
  );
}

function parseOptionalDate(
  value,
  fieldName
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw createCustomerProfileError(
      `${fieldName} must be a valid date.`,
      {
        statusCode: 400,
        code:
          "INVALID_CUSTOMER_PROFILE_DATE",
        field: fieldName,
      }
    );
  }

  return date;
}

function escapeRegularExpression(
  value
) {
  return normaliseText(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function getActorId(actor) {
  const actorId =
    actor?._id ||
    actor?.id ||
    actor ||
    null;

  return mongoose.isValidObjectId(
    actorId
  )
    ? actorId
    : null;
}

function assertValidObjectId(
  value,
  fieldName = "identifier"
) {
  if (
    !mongoose.isValidObjectId(
      value
    )
  ) {
    throw createCustomerProfileError(
      `${fieldName} must be a valid identifier.`,
      {
        statusCode: 400,
        code:
          "INVALID_CUSTOMER_PROFILE_IDENTIFIER",
        field: fieldName,
      }
    );
  }
}

function getCustomerIdentifierQuery(
  identifier
) {
  const value =
    normaliseText(identifier);

  if (!value) {
    throw createCustomerProfileError(
      "A customer identifier is required.",
      {
        statusCode: 400,
        code:
          "CUSTOMER_IDENTIFIER_REQUIRED",
      }
    );
  }

  if (
    mongoose.isValidObjectId(value)
  ) {
    return {
      _id: value,
    };
  }

  if (value.includes("@")) {
    return {
      email:
        value.toLowerCase(),
    };
  }

  return {
    phone: value,
  };
}

function stripProtectedFields(
  payload
) {
  return Object.fromEntries(
    Object.entries(
      normaliseObject(payload)
    ).filter(
      ([field]) =>
        !PROTECTED_UPDATE_FIELDS.has(
          field
        )
    )
  );
}

function normaliseAddress(
  address
) {
  const value =
    normaliseObject(address);

  return {
    line1:
      normaliseText(
        value.line1
      ),

    line2:
      normaliseText(
        value.line2
      ),

    city:
      normaliseText(
        value.city
      ),

    county:
      normaliseText(
        value.county
      ),

    postcode:
      normaliseText(
        value.postcode
      ).toUpperCase(),

    country:
      normaliseText(
        value.country
      ) || "United Kingdom",
  };
}

function normaliseEmergencyContact(
  emergencyContact
) {
  const value =
    normaliseObject(
      emergencyContact
    );

  return {
    name:
      normaliseText(
        value.name
      ),

    relationship:
      normaliseText(
        value.relationship
      ),

    phone:
      normaliseText(
        value.phone
      ),
  };
}

function normaliseHairProfile(
  hairProfile
) {
  const value =
    normaliseObject(
      hairProfile
    );

  return {
    ...value,

    hairType:
      normaliseText(
        value.hairType
      ),

    naturalHairColour:
      normaliseText(
        value.naturalHairColour
      ),

    currentHairColour:
      normaliseText(
        value.currentHairColour
      ),

    hairColour:
      normaliseText(
        value.hairColour
      ),

    hairLength:
      normaliseLowercase(
        value.hairLength
      ),

    texture:
      normaliseText(
        value.texture
      ),

    density:
      normaliseLowercase(
        value.density
      ),

    porosity:
      normaliseLowercase(
        value.porosity
      ),

    scalpCondition:
      normaliseText(
        value.scalpCondition
      ),

    concerns:
      normaliseStringArray(
        value.concerns
      ),

    allergies:
      normaliseStringArray(
        value.allergies
      ),

    sensitivities:
      normaliseStringArray(
        value.sensitivities
      ),

    preferredProducts:
      normaliseStringArray(
        value.preferredProducts
      ),

    productsToAvoid:
      normaliseStringArray(
        value.productsToAvoid
      ),

    chemicalHistory:
      normaliseText(
        value.chemicalHistory
      ),

    consultationNotes:
      normaliseText(
        value.consultationNotes
      ),

    lastPatchTestAt:
      parseOptionalDate(
        value.lastPatchTestAt,
        "hairProfile.lastPatchTestAt"
      ),

    patchTestResult:
      normaliseLowercase(
        value.patchTestResult
      ),
  };
}

function normaliseBookingPreferences(
  bookingPreferences
) {
  const value =
    normaliseObject(
      bookingPreferences
    );

  return {
    preferredDays:
      normaliseStringArray(
        value.preferredDays
      ).map((day) =>
        day.toLowerCase()
      ),

    preferredTimeOfDay:
      normaliseLowercase(
        value.preferredTimeOfDay
      ),

    preferredReminderChannel:
      normaliseLowercase(
        value.preferredReminderChannel
      ) || "email",

    accessibilityRequirements:
      normaliseText(
        value.accessibilityRequirements
      ),

    additionalRequirements:
      normaliseText(
        value.additionalRequirements
      ),
  };
}

function normaliseCommunicationPreferences(
  communicationPreferences,
  currentPreferences = {}
) {
  const supplied =
    normaliseObject(
      communicationPreferences
    );

  const current =
    normaliseObject(
      currentPreferences
    );

  return {
    preferredChannel:
      normaliseLowercase(
        supplied.preferredChannel ??
          current.preferredChannel
      ) || "email",

    appointmentReminders:
      normaliseBoolean(
        supplied.appointmentReminders,
        current.appointmentReminders ??
          true
      ),

    promotionalMessages:
      normaliseBoolean(
        supplied.promotionalMessages,
        current.promotionalMessages ??
          true
      ),

    serviceUpdates:
      normaliseBoolean(
        supplied.serviceUpdates,
        current.serviceUpdates ??
          true
      ),

    birthdayMessages:
      normaliseBoolean(
        supplied.birthdayMessages,
        current.birthdayMessages ??
          true
      ),

    feedbackRequests:
      normaliseBoolean(
        supplied.feedbackRequests,
        current.feedbackRequests ??
          true
      ),

    emailUnsubscribed:
      normaliseBoolean(
        supplied.emailUnsubscribed,
        current.emailUnsubscribed ??
          false
      ),

    smsUnsubscribed:
      normaliseBoolean(
        supplied.smsUnsubscribed,
        current.smsUnsubscribed ??
          false
      ),

    unsubscribed:
      normaliseBoolean(
        supplied.unsubscribed,
        current.unsubscribed ??
          false
      ),

    consentUpdatedAt:
      supplied.consentUpdatedAt !==
      undefined
        ? parseOptionalDate(
            supplied.consentUpdatedAt,
            "communicationPreferences.consentUpdatedAt"
          )
        : current.consentUpdatedAt ||
          null,

    consentSource:
      normaliseText(
        supplied.consentSource ??
          current.consentSource
      ),
  };
}

function normaliseMarketingPreferences(
  marketing,
  currentMarketing = {},
  communicationPreferences = {}
) {
  const supplied =
    normaliseObject(marketing);

  const current =
    normaliseObject(
      currentMarketing
    );

  const emailUnsubscribed =
    Boolean(
      communicationPreferences
        .emailUnsubscribed ||
        communicationPreferences
          .unsubscribed
    );

  const smsUnsubscribed =
    Boolean(
      communicationPreferences
        .smsUnsubscribed ||
        communicationPreferences
          .unsubscribed
    );

  return {
    emailConsent:
      emailUnsubscribed
        ? false
        : normaliseBoolean(
            supplied.emailConsent,
            current.emailConsent ??
              true
          ),

    smsConsent:
      smsUnsubscribed
        ? false
        : normaliseBoolean(
            supplied.smsConsent,
            current.smsConsent ??
              false
          ),

    emailConsentUpdatedAt:
      supplied.emailConsentUpdatedAt !==
      undefined
        ? parseOptionalDate(
            supplied.emailConsentUpdatedAt,
            "marketing.emailConsentUpdatedAt"
          )
        : current
            .emailConsentUpdatedAt ||
          null,

    smsConsentUpdatedAt:
      supplied.smsConsentUpdatedAt !==
      undefined
        ? parseOptionalDate(
            supplied.smsConsentUpdatedAt,
            "marketing.smsConsentUpdatedAt"
          )
        : current
            .smsConsentUpdatedAt ||
          null,

    consentSource:
      normaliseText(
        supplied.consentSource ??
          communicationPreferences
            .consentSource ??
          current.consentSource
      ),
  };
}

function normaliseCustomerPayload(
  payload,
  {
    currentCustomer = null,
    partial = false,
  } = {}
) {
  const supplied =
    stripProtectedFields(payload);

  const result = {};

  const assignText = (
    field,
    {
      lowercase = false,
      uppercase = false,
    } = {}
  ) => {
    if (
      !partial ||
      supplied[field] !==
        undefined
    ) {
      let value =
        normaliseText(
          supplied[field]
        );

      if (lowercase) {
        value =
          value.toLowerCase();
      }

      if (uppercase) {
        value =
          value.toUpperCase();
      }

      result[field] =
        value || undefined;
    }
  };

  assignText("title");
  assignText("firstName");
  assignText("lastName");
  assignText("preferredName");
  assignText("pronouns");
  assignText("email", {
    lowercase: true,
  });
  assignText("phone");
  assignText(
    "alternativePhone"
  );
  assignText("notes");
  assignText(
    "internalWarnings"
  );
  assignText("photo");
  assignText(
    "membershipName"
  );
  assignText("referralCode", {
    uppercase: true,
  });

  if (
    !partial ||
    supplied.dateOfBirth !==
      undefined
  ) {
    result.dateOfBirth =
      parseOptionalDate(
        supplied.dateOfBirth,
        "dateOfBirth"
      );
  }

  if (
    !partial ||
    supplied.gender !== undefined
  ) {
    result.gender =
      normaliseLowercase(
        supplied.gender
      ) ||
      "prefer_not_to_say";
  }

  if (
    supplied.address !==
    undefined
  ) {
    result.address =
      normaliseAddress(
        supplied.address
      );
  }

  if (
    supplied.emergencyContact !==
    undefined
  ) {
    result.emergencyContact =
      normaliseEmergencyContact(
        supplied.emergencyContact
      );
  }

  if (
    supplied.hairProfile !==
    undefined
  ) {
    result.hairProfile =
      normaliseHairProfile(
        supplied.hairProfile
      );
  }

  if (
    supplied.bookingPreferences !==
    undefined
  ) {
    result.bookingPreferences =
      normaliseBookingPreferences(
        supplied.bookingPreferences
      );
  }

  const existingCommunicationPreferences =
    currentCustomer
      ?.communicationPreferences
      ?.toObject?.() ||
    currentCustomer
      ?.communicationPreferences ||
    {};

  const existingMarketing =
    currentCustomer
      ?.marketing
      ?.toObject?.() ||
    currentCustomer?.marketing ||
    {};

  if (
    supplied.communicationPreferences !==
      undefined ||
    supplied.marketing !==
      undefined
  ) {
    const communicationPreferences =
      normaliseCommunicationPreferences(
        supplied.communicationPreferences,
        existingCommunicationPreferences
      );

    result.communicationPreferences =
      communicationPreferences;

    result.marketing =
      normaliseMarketingPreferences(
        supplied.marketing,
        existingMarketing,
        communicationPreferences
      );
  }

  if (
    supplied.preferredStylist !==
    undefined
  ) {
    if (
      supplied.preferredStylist ===
        null ||
      supplied.preferredStylist ===
        ""
    ) {
      result.preferredStylist =
        null;
    } else {
      assertValidObjectId(
        supplied.preferredStylist,
        "preferredStylist"
      );

      result.preferredStylist =
        supplied.preferredStylist;
    }
  }

  if (
    supplied.preferredServices !==
    undefined
  ) {
    result.preferredServices =
      normaliseObjectIdArray(
        supplied.preferredServices
      );
  }

  if (
    supplied.referredBy !==
    undefined
  ) {
    if (
      supplied.referredBy ===
        null ||
      supplied.referredBy ===
        ""
    ) {
      result.referredBy =
        null;
    } else {
      assertValidObjectId(
        supplied.referredBy,
        "referredBy"
      );

      result.referredBy =
        supplied.referredBy;
    }
  }

  if (
    supplied.tags !== undefined
  ) {
    result.tags =
      normaliseTagArray(
        supplied.tags
      );
  }

  if (
    supplied.loyaltyTier !==
    undefined
  ) {
    result.loyaltyTier =
      normaliseLowercase(
        supplied.loyaltyTier
      );
  }

  if (
    supplied.membershipStatus !==
    undefined
  ) {
    result.membershipStatus =
      normaliseLowercase(
        supplied.membershipStatus
      );
  }

  if (
    supplied.membershipStartedAt !==
    undefined
  ) {
    result.membershipStartedAt =
      parseOptionalDate(
        supplied.membershipStartedAt,
        "membershipStartedAt"
      );
  }

  if (
    supplied.membershipExpiresAt !==
    undefined
  ) {
    result.membershipExpiresAt =
      parseOptionalDate(
        supplied.membershipExpiresAt,
        "membershipExpiresAt"
      );
  }

  if (
    supplied.source !== undefined
  ) {
    result.source =
      normaliseLowercase(
        supplied.source
      );
  }

  if (
    supplied.status !== undefined
  ) {
    const status =
      normaliseLowercase(
        supplied.status
      );

    if (
      !CUSTOMER_STATUSES.includes(
        status
      )
    ) {
      throw createCustomerProfileError(
        `Unsupported customer status: ${status}.`,
        {
          statusCode: 400,
          code:
            "INVALID_CUSTOMER_STATUS",
          field: "status",
        }
      );
    }

    result.status = status;
  }

  return result;
}

async function populateCustomerProfile(
  customer
) {
  if (!customer) {
    return null;
  }

  await customer.populate(
    PROFILE_POPULATE_OPTIONS
  );

  return customer;
}

async function assertUserCanLinkToCustomer(
  userId,
  customerId = null
) {
  assertValidObjectId(
    userId,
    "userAccountId"
  );

  const user =
    await User.findById(userId);

  if (!user) {
    throw createCustomerProfileError(
      "The selected user account was not found.",
      {
        statusCode: 404,
        code:
          "USER_ACCOUNT_NOT_FOUND",
      }
    );
  }

  if (user.role !== "customer") {
    throw createCustomerProfileError(
      "Only user accounts with the customer role can be linked to customer profiles.",
      {
        statusCode: 409,
        code:
          "USER_ACCOUNT_IS_NOT_CUSTOMER",
      }
    );
  }

  if (
    user.customerProfile &&
    String(
      user.customerProfile
    ) !== String(
      customerId || ""
    )
  ) {
    throw createCustomerProfileError(
      "The selected user account is already linked to another customer profile.",
      {
        statusCode: 409,
        code:
          "USER_ACCOUNT_ALREADY_LINKED",
      }
    );
  }

  return user;
}

async function createCustomerProfile(
  payload,
  {
    userAccountId = null,
    createdBy = null,
  } = {}
) {
  const actorId =
    getActorId(createdBy);

  const customerData =
    normaliseCustomerPayload(
      payload,
      {
        partial: false,
      }
    );

  if (!customerData.firstName) {
    throw createCustomerProfileError(
      "Customer first name is required.",
      {
        statusCode: 400,
        code:
          "CUSTOMER_FIRST_NAME_REQUIRED",
        field: "firstName",
      }
    );
  }

  if (!customerData.lastName) {
    throw createCustomerProfileError(
      "Customer last name is required.",
      {
        statusCode: 400,
        code:
          "CUSTOMER_LAST_NAME_REQUIRED",
        field: "lastName",
      }
    );
  }

  let user = null;

  if (userAccountId) {
    user =
      await assertUserCanLinkToCustomer(
        userAccountId
      );

    customerData.userAccount =
      user._id;
  }

  customerData.createdBy =
    actorId;

  customerData.updatedBy =
    actorId;

  const customer =
    await Customer.create(
      customerData
    );

  if (user) {
    try {
      user.customerProfile =
        customer._id;

      user.updatedBy =
        actorId;

      await user.save();
    } catch (error) {
      await Customer.deleteOne({
        _id: customer._id,
      });

      throw createCustomerProfileError(
        "The customer profile could not be linked to the user account.",
        {
          statusCode: 500,
          code:
            "CUSTOMER_USER_LINK_FAILED",
          cause: error,
        }
      );
    }
  }

  return populateCustomerProfile(
    customer
  );
}

async function findCustomerProfile(
  identifier,
  {
    includeDeleted = false,
    populate = true,
  } = {}
) {
  const query =
    getCustomerIdentifierQuery(
      identifier
    );

  if (!includeDeleted) {
    query.status = {
      $ne: "deleted",
    };
  }

  const customer =
    await Customer.findOne(
      query
    );

  if (!customer) {
    throw createCustomerProfileError(
      "Customer profile not found.",
      {
        statusCode: 404,
        code:
          "CUSTOMER_PROFILE_NOT_FOUND",
      }
    );
  }

  return populate
    ? populateCustomerProfile(
        customer
      )
    : customer;
}

async function findCustomerProfileByUser(
  userId,
  {
    includeDeleted = false,
  } = {}
) {
  assertValidObjectId(
    userId,
    "userId"
  );

  const query = {
    userAccount: userId,
  };

  if (!includeDeleted) {
    query.status = {
      $ne: "deleted",
    };
  }

  const customer =
    await Customer.findOne(
      query
    );

  if (!customer) {
    throw createCustomerProfileError(
      "No customer profile is linked to this user account.",
      {
        statusCode: 404,
        code:
          "CUSTOMER_PROFILE_NOT_LINKED",
      }
    );
  }

  return populateCustomerProfile(
    customer
  );
}

function buildCustomerProfileQuery(
  filters = {}
) {
  const supplied =
    normaliseObject(filters);

  const query = {};

  const status =
    normaliseLowercase(
      supplied.status
    );

  if (status) {
    if (
      !CUSTOMER_STATUSES.includes(
        status
      )
    ) {
      throw createCustomerProfileError(
        `Unsupported customer status: ${status}.`,
        {
          statusCode: 400,
          code:
            "INVALID_CUSTOMER_STATUS",
          field: "status",
        }
      );
    }

    query.status = status;
  } else if (
    !normaliseBoolean(
      supplied.includeDeleted,
      false
    )
  ) {
    query.status = {
      $ne: "deleted",
    };
  }

  const search =
    normaliseText(
      supplied.search
    );

  if (search) {
    const expression =
      new RegExp(
        escapeRegularExpression(
          search
        ),
        "i"
      );

    query.$or = [
      {
        firstName: expression,
      },
      {
        lastName: expression,
      },
      {
        preferredName:
          expression,
      },
      {
        email: expression,
      },
      {
        phone: expression,
      },
      {
        referralCode:
          expression,
      },
      {
        tags: expression,
      },
    ];
  }

  const tags =
    normaliseTagArray(
      Array.isArray(
        supplied.tags
      )
        ? supplied.tags
        : normaliseText(
            supplied.tags
          )
            .split(",")
            .filter(Boolean)
    );

  if (tags.length > 0) {
    query.tags = {
      $all: tags,
    };
  }

  if (
    supplied.preferredStylist
  ) {
    assertValidObjectId(
      supplied.preferredStylist,
      "preferredStylist"
    );

    query.preferredStylist =
      supplied.preferredStylist;
  }

  if (
    supplied.loyaltyTier
  ) {
    query.loyaltyTier =
      normaliseLowercase(
        supplied.loyaltyTier
      );
  }

  if (
    supplied.membershipStatus
  ) {
    query.membershipStatus =
      normaliseLowercase(
        supplied.membershipStatus
      );
  }

  if (
    supplied.source
  ) {
    query.source =
      normaliseLowercase(
        supplied.source
      );
  }

  if (
    supplied.hasEmail !==
    undefined
  ) {
    query.email =
      normaliseBoolean(
        supplied.hasEmail,
        false
      )
        ? {
            $exists: true,
            $nin: [
              null,
              "",
            ],
          }
        : {
            $in: [
              null,
              "",
            ],
          };
  }

  if (
    supplied.hasPhone !==
    undefined
  ) {
    query.phone =
      normaliseBoolean(
        supplied.hasPhone,
        false
      )
        ? {
            $exists: true,
            $nin: [
              null,
              "",
            ],
          }
        : {
            $in: [
              null,
              "",
            ],
          };
  }

  if (
    supplied.marketingEligible !==
    undefined
  ) {
    const eligible =
      normaliseBoolean(
        supplied.marketingEligible,
        false
      );

    if (eligible) {
      query.status = "active";

      query[
        "communicationPreferences.unsubscribed"
      ] = {
        $ne: true,
      };

      query.$and = [
        ...(query.$and || []),

        {
          $or: [
            {
              "marketing.emailConsent":
                true,
            },
            {
              "marketing.smsConsent":
                true,
            },
          ],
        },
      ];
    }
  }

  const minimumSpend =
    supplied.minimumSpend ??
    supplied.minSpend;

  const maximumSpend =
    supplied.maximumSpend ??
    supplied.maxSpend;

  if (
    minimumSpend !==
      undefined ||
    maximumSpend !==
      undefined
  ) {
    query.totalSpent = {};

    if (
      minimumSpend !==
      undefined &&
      minimumSpend !== ""
    ) {
      query.totalSpent.$gte =
        normaliseNumber(
          minimumSpend,
          0
        );
    }

    if (
      maximumSpend !==
      undefined &&
      maximumSpend !== ""
    ) {
      query.totalSpent.$lte =
        normaliseNumber(
          maximumSpend,
          0
        );
    }
  }

  return query;
}

async function listCustomerProfiles(
  filters = {}
) {
  const page =
    normaliseInteger(
      filters.page,
      DEFAULT_PAGE,
      1,
      1000000
    );

  const limit =
    normaliseInteger(
      filters.limit,
      DEFAULT_LIMIT,
      1,
      MAXIMUM_LIMIT
    );

  const sortField =
    SORT_FIELDS[
      filters.sortBy
    ] ||
    "createdAt";

  const sortDirection =
    normaliseLowercase(
      filters.sortDirection
    ) === "asc"
      ? 1
      : -1;

  const query =
    buildCustomerProfileQuery(
      filters
    );

  const [
    customers,
    total,
  ] = await Promise.all([
    Customer.find(query)
      .populate(
        PROFILE_POPULATE_OPTIONS
      )
      .sort({
        [sortField]:
          sortDirection,

        _id: sortDirection,
      })
      .skip(
        (page - 1) *
          limit
      )
      .limit(limit),

    Customer.countDocuments(
      query
    ),
  ]);

  return {
    customers,

    pagination: {
      page,
      limit,
      total,

      pages:
        Math.max(
          1,
          Math.ceil(
            total / limit
          )
        ),

      hasPreviousPage:
        page > 1,

      hasNextPage:
        page <
        Math.ceil(
          total / limit
        ),
    },

    filters: {
      status:
        filters.status ||
        "",

      search:
        filters.search ||
        "",

      sortBy: sortField,

      sortDirection:
        sortDirection === 1
          ? "asc"
          : "desc",
    },
  };
}

async function updateCustomerProfile(
  identifier,
  payload,
  {
    updatedBy = null,
  } = {}
) {
  const customer =
    await findCustomerProfile(
      identifier,
      {
        populate: false,
      }
    );

  const update =
    normaliseCustomerPayload(
      payload,
      {
        currentCustomer:
          customer,

        partial: true,
      }
    );

  const actorId =
    getActorId(updatedBy);

  for (
    const [
      field,
      value,
    ] of Object.entries(update)
  ) {
    customer.set(
      field,
      value
    );
  }

  customer.updatedBy =
    actorId;

  await customer.save();

  return populateCustomerProfile(
    customer
  );
}

async function linkCustomerUserAccount(
  customerId,
  userAccountId,
  {
    updatedBy = null,
  } = {}
) {
  assertValidObjectId(
    customerId,
    "customerId"
  );

  const customer =
    await findCustomerProfile(
      customerId,
      {
        populate: false,
      }
    );

  const user =
    await assertUserCanLinkToCustomer(
      userAccountId,
      customer._id
    );

  if (
    customer.userAccount &&
    String(
      customer.userAccount
    ) !== String(
      user._id
    )
  ) {
    throw createCustomerProfileError(
      "This customer profile is already linked to another user account.",
      {
        statusCode: 409,
        code:
          "CUSTOMER_PROFILE_ALREADY_LINKED",
      }
    );
  }

  const actorId =
    getActorId(updatedBy);

  const previousCustomerUser =
    customer.userAccount;

  customer.userAccount =
    user._id;

  customer.updatedBy =
    actorId;

  await customer.save();

  try {
    user.customerProfile =
      customer._id;

    user.updatedBy =
      actorId;

    await user.save();
  } catch (error) {
    customer.userAccount =
      previousCustomerUser ||
      null;

    await customer.save();

    throw createCustomerProfileError(
      "The customer profile could not be linked to the user account.",
      {
        statusCode: 500,
        code:
          "CUSTOMER_USER_LINK_FAILED",
        cause: error,
      }
    );
  }

  return populateCustomerProfile(
    customer
  );
}

async function unlinkCustomerUserAccount(
  customerId,
  {
    updatedBy = null,
  } = {}
) {
  assertValidObjectId(
    customerId,
    "customerId"
  );

  const customer =
    await findCustomerProfile(
      customerId,
      {
        populate: false,
      }
    );

  if (!customer.userAccount) {
    return populateCustomerProfile(
      customer
    );
  }

  const actorId =
    getActorId(updatedBy);

  const linkedUserId =
    customer.userAccount;

  customer.userAccount =
    null;

  customer.updatedBy =
    actorId;

  await customer.save();

  try {
    await User.updateOne(
      {
        _id: linkedUserId,
        customerProfile:
          customer._id,
      },
      {
        $unset: {
          customerProfile: 1,
        },

        $set: {
          updatedBy:
            actorId,
        },
      }
    );
  } catch (error) {
    customer.userAccount =
      linkedUserId;

    await customer.save();

    throw createCustomerProfileError(
      "The user account could not be unlinked from the customer profile.",
      {
        statusCode: 500,
        code:
          "CUSTOMER_USER_UNLINK_FAILED",
        cause: error,
      }
    );
  }

  return populateCustomerProfile(
    customer
  );
}

async function updateCustomerConsent(
  customerId,
  consentPayload,
  {
    updatedBy = null,
    source = "management",
  } = {}
) {
  const customer =
    await findCustomerProfile(
      customerId,
      {
        populate: false,
      }
    );

  const supplied =
    normaliseObject(
      consentPayload
    );

  const now = new Date();

  const communicationPreferences =
    normaliseCommunicationPreferences(
      {
        ...supplied
          .communicationPreferences,

        preferredChannel:
          supplied.preferredChannel ??
          supplied
            .communicationPreferences
            ?.preferredChannel,

        emailUnsubscribed:
          supplied.emailUnsubscribed ??
          supplied
            .communicationPreferences
            ?.emailUnsubscribed,

        smsUnsubscribed:
          supplied.smsUnsubscribed ??
          supplied
            .communicationPreferences
            ?.smsUnsubscribed,

        unsubscribed:
          supplied.unsubscribed ??
          supplied
            .communicationPreferences
            ?.unsubscribed,

        consentUpdatedAt: now,

        consentSource:
          normaliseText(
            supplied.consentSource ||
              source
          ),
      },
      customer
        .communicationPreferences
        ?.toObject?.() ||
        customer
          .communicationPreferences
    );

  const marketing =
    normaliseMarketingPreferences(
      {
        ...supplied.marketing,

        emailConsent:
          supplied.emailConsent ??
          supplied.marketing
            ?.emailConsent,

        smsConsent:
          supplied.smsConsent ??
          supplied.marketing
            ?.smsConsent,

        emailConsentUpdatedAt:
          supplied.emailConsent !==
            undefined ||
          supplied.marketing
            ?.emailConsent !==
            undefined
            ? now
            : customer.marketing
                ?.emailConsentUpdatedAt,

        smsConsentUpdatedAt:
          supplied.smsConsent !==
            undefined ||
          supplied.marketing
            ?.smsConsent !==
            undefined
            ? now
            : customer.marketing
                ?.smsConsentUpdatedAt,

        consentSource:
          normaliseText(
            supplied.consentSource ||
              source
          ),
      },
      customer.marketing
        ?.toObject?.() ||
        customer.marketing,
      communicationPreferences
    );

  customer.communicationPreferences =
    communicationPreferences;

  customer.marketing =
    marketing;

  customer.updatedBy =
    getActorId(updatedBy);

  await customer.save();

  return populateCustomerProfile(
    customer
  );
}

async function archiveCustomerProfile(
  customerId,
  {
    updatedBy = null,
  } = {}
) {
  const customer =
    await findCustomerProfile(
      customerId,
      {
        populate: false,
      }
    );

  customer.status =
    "archived";

  customer.archivedAt =
    new Date();

  customer.updatedBy =
    getActorId(updatedBy);

  await customer.save();

  return populateCustomerProfile(
    customer
  );
}

async function restoreCustomerProfile(
  customerId,
  {
    updatedBy = null,
  } = {}
) {
  const customer =
    await findCustomerProfile(
      customerId,
      {
        includeDeleted: true,
        populate: false,
      }
    );

  customer.status =
    "active";

  customer.archivedAt =
    null;

  customer.updatedBy =
    getActorId(updatedBy);

  await customer.save();

  return populateCustomerProfile(
    customer
  );
}

async function softDeleteCustomerProfile(
  customerId,
  {
    updatedBy = null,
  } = {}
) {
  const customer =
    await findCustomerProfile(
      customerId,
      {
        includeDeleted: true,
        populate: false,
      }
    );

  if (customer.userAccount) {
    await User.updateOne(
      {
        _id:
          customer.userAccount,
        customerProfile:
          customer._id,
      },
      {
        $unset: {
          customerProfile: 1,
        },

        $set: {
          updatedBy:
            getActorId(
              updatedBy
            ),
        },
      }
    );
  }

  customer.userAccount =
    null;

  customer.status =
    "deleted";

  customer.archivedAt =
    new Date();

  customer.updatedBy =
    getActorId(updatedBy);

  await customer.save();

  return customer;
}

async function getCustomerProfileStatistics() {
  const [
    summary,
    loyaltyTiers,
    membershipStatuses,
  ] = await Promise.all([
    Customer.aggregate([
      {
        $match: {
          status: {
            $ne: "deleted",
          },
        },
      },
      {
        $group: {
          _id: null,

          totalCustomers: {
            $sum: 1,
          },

          activeCustomers: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "active",
                  ],
                },
                1,
                0,
              ],
            },
          },

          archivedCustomers: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "archived",
                  ],
                },
                1,
                0,
              ],
            },
          },

          linkedAccounts: {
            $sum: {
              $cond: [
                {
                  $ne: [
                    "$userAccount",
                    null,
                  ],
                },
                1,
                0,
              ],
            },
          },

          totalRevenue: {
            $sum: {
              $ifNull: [
                "$totalSpent",
                0,
              ],
            },
          },

          totalVisits: {
            $sum: {
              $ifNull: [
                "$visitCount",
                0,
              ],
            },
          },

          totalLoyaltyPoints: {
            $sum: {
              $ifNull: [
                "$loyaltyPoints",
                0,
              ],
            },
          },

          emailConsentCustomers: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$marketing.emailConsent",
                    true,
                  ],
                },
                1,
                0,
              ],
            },
          },

          smsConsentCustomers: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$marketing.smsConsent",
                    true,
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),

    Customer.aggregate([
      {
        $match: {
          status: {
            $ne: "deleted",
          },
        },
      },
      {
        $group: {
          _id:
            "$loyaltyTier",

          total: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          total: -1,
        },
      },
    ]),

    Customer.aggregate([
      {
        $match: {
          status: {
            $ne: "deleted",
          },
        },
      },
      {
        $group: {
          _id:
            "$membershipStatus",

          total: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          total: -1,
        },
      },
    ]),
  ]);

  const totals =
    summary[0] || {
      totalCustomers: 0,
      activeCustomers: 0,
      archivedCustomers: 0,
      linkedAccounts: 0,
      totalRevenue: 0,
      totalVisits: 0,
      totalLoyaltyPoints: 0,
      emailConsentCustomers: 0,
      smsConsentCustomers: 0,
    };

  return {
    ...totals,

    averageCustomerSpend:
      totals.totalCustomers > 0
        ? Number(
            (
              totals.totalRevenue /
              totals.totalCustomers
            ).toFixed(2)
          )
        : 0,

    averageCustomerVisits:
      totals.totalCustomers > 0
        ? Number(
            (
              totals.totalVisits /
              totals.totalCustomers
            ).toFixed(2)
          )
        : 0,

    loyaltyTiers:
      Object.fromEntries(
        loyaltyTiers.map(
          (entry) => [
            entry._id ||
              "standard",
            entry.total,
          ]
        )
      ),

    membershipStatuses:
      Object.fromEntries(
        membershipStatuses.map(
          (entry) => [
            entry._id || "none",
            entry.total,
          ]
        )
      ),
  };
}

export {
  CUSTOMER_STATUSES,
  archiveCustomerProfile,
  createCustomerProfile,
  createCustomerProfileError,
  findCustomerProfile,
  findCustomerProfileByUser,
  getCustomerProfileStatistics,
  linkCustomerUserAccount,
  listCustomerProfiles,
  restoreCustomerProfile,
  softDeleteCustomerProfile,
  unlinkCustomerUserAccount,
  updateCustomerConsent,
  updateCustomerProfile,
};

export default {
  archiveCustomerProfile,
  createCustomerProfile,
  findCustomerProfile,
  findCustomerProfileByUser,
  getCustomerProfileStatistics,
  linkCustomerUserAccount,
  listCustomerProfiles,
  restoreCustomerProfile,
  softDeleteCustomerProfile,
  unlinkCustomerUserAccount,
  updateCustomerConsent,
  updateCustomerProfile,
};