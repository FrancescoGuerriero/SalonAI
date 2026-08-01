import Customer from "../models/customer.js";

import * as customerProfileService from "../services/customerProfileService.js";

function createControllerError(
  message,
  {
    statusCode = 400,
    code = "CUSTOMER_PROFILE_REQUEST_ERROR",
    field = null,
    details = null,
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;
  error.field = field;
  error.details = details;

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
    ].includes(normalisedValue)
  ) {
    return false;
  }

  return fallback;
}

function getAuthenticatedUser(request) {
  return request.user || null;
}

function getAuthenticatedUserId(request) {
  return (
    request.user?._id ||
    request.user?.id ||
    null
  );
}

function getAuthenticatedUserRole(request) {
  return normaliseLowercase(
    request.user?.role
  );
}

function isAdministrator(request) {
  return (
    getAuthenticatedUserRole(
      request
    ) === "admin"
  );
}

function getCustomerIdentifier(request) {
  const identifier =
    normaliseText(
      request.params?.customerId ||
        request.params?.identifier ||
        request.params?.id
    );

  if (!identifier) {
    throw createControllerError(
      "A customer identifier is required.",
      {
        statusCode: 400,
        code:
          "CUSTOMER_IDENTIFIER_REQUIRED",
        field: "customerId",
      }
    );
  }

  return identifier;
}

function getUserAccountIdentifier(request) {
  const identifier =
    normaliseText(
      request.body?.userAccountId ||
        request.body?.userId ||
        request.params?.userAccountId
    );

  if (!identifier) {
    throw createControllerError(
      "A user-account identifier is required.",
      {
        statusCode: 400,
        code:
          "USER_ACCOUNT_IDENTIFIER_REQUIRED",
        field: "userAccountId",
      }
    );
  }

  return identifier;
}

function serialiseDocument(document) {
  if (!document) {
    return null;
  }

  if (
    typeof document.toJSON ===
    "function"
  ) {
    return document.toJSON();
  }

  return document;
}

function getServiceMethod(
  possibleNames
) {
  for (const name of possibleNames) {
    if (
      typeof customerProfileService[
        name
      ] === "function"
    ) {
      return customerProfileService[
        name
      ];
    }
  }

  throw createControllerError(
    `Customer profile service method is unavailable: ${possibleNames.join(
      " or "
    )}.`,
    {
      statusCode: 500,
      code:
        "CUSTOMER_PROFILE_SERVICE_METHOD_MISSING",
      details: {
        expectedMethods:
          possibleNames,
      },
    }
  );
}

function stripSelfServiceProtectedFields(
  payload
) {
  const supplied =
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload)
      ? {
          ...payload,
        }
      : {};

  const protectedFields = [
    "_id",
    "id",
    "__v",
    "status",
    "source",
    "userAccount",
    "createdBy",
    "updatedBy",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "deletedBy",
    "archivedAt",
    "archivedBy",
    "restoredAt",
    "restoredBy",
    "visitCount",
    "lastVisit",
    "lastVisitAt",
    "totalSpent",
    "totalSpend",
    "loyaltyPoints",
    "loyaltyTier",
    "membershipStatus",
    "membershipName",
    "membershipStartedAt",
    "membershipExpiresAt",
    "internalWarnings",
    "notes",
    "tags",
    "referralCode",
    "referredBy",
    "preferredStylist",
    "preferredServices",
  ];

  for (const field of protectedFields) {
    delete supplied[field];
  }

  return supplied;
}

function stripSelfServiceConsentFields(
  payload
) {
  const supplied =
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload)
      ? {
          ...payload,
        }
      : {};

  return {
    preferredChannel:
      supplied.preferredChannel,

    emailConsent:
      supplied.emailConsent,

    smsConsent:
      supplied.smsConsent,

    emailUnsubscribed:
      supplied.emailUnsubscribed,

    smsUnsubscribed:
      supplied.smsUnsubscribed,

    unsubscribed:
      supplied.unsubscribed,

    consentSource:
      supplied.consentSource,

    communicationPreferences:
      supplied.communicationPreferences,

    marketing:
      supplied.marketing,
  };
}

async function findProfileForAuthenticatedUser(
  request
) {
  const userId =
    getAuthenticatedUserId(
      request
    );

  if (!userId) {
    throw createControllerError(
      "An authenticated user is required.",
      {
        statusCode: 401,
        code:
          "AUTHENTICATED_USER_REQUIRED",
      }
    );
  }

  const directCustomerId =
    request.user?.customerProfile?._id ||
    request.user?.customerProfile ||
    null;

  if (directCustomerId) {
    const findProfile =
      getServiceMethod([
        "findCustomerProfile",
        "getCustomerProfile",
      ]);

    return findProfile(
      directCustomerId,
      {
        includeDeleted: false,
      }
    );
  }

  const query = {
    status: {
      $ne: "deleted",
    },

    $or: [
      {
        userAccount: userId,
      },
    ],
  };

  const email =
    normaliseLowercase(
      request.user?.email
    );

  if (email) {
    query.$or.push({
      email,
    });
  }

  const customer =
    await Customer.findOne(query)
      .populate(
        "userAccount",
        "name email role isActive"
      )
      .populate(
        "preferredStylist"
      )
      .populate(
        "preferredServices"
      );

  if (!customer) {
    throw createControllerError(
      "No customer profile is linked to this user account.",
      {
        statusCode: 404,
        code:
          "CUSTOMER_PROFILE_NOT_LINKED",
      }
    );
  }

  return customer;
}

/*
|--------------------------------------------------------------------------
| Management profile collection
|--------------------------------------------------------------------------
*/

async function createProfile(
  request,
  response,
  next
) {
  try {
    const createCustomerProfile =
      getServiceMethod([
        "createCustomerProfile",
        "createProfile",
      ]);

    const customer =
      await createCustomerProfile(
        request.body || {},
        {
          actorId:
            getAuthenticatedUserId(
              request
            ),

          actor:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(201)
      .json({
        success: true,
        message:
          "Customer profile created successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

async function listProfiles(
  request,
  response,
  next
) {
  try {
    const listCustomerProfiles =
      getServiceMethod([
        "listCustomerProfiles",
        "listProfiles",
      ]);

    const result =
      await listCustomerProfiles(
        request.query || {},
        {
          viewer:
            getAuthenticatedUser(
              request
            ),
        }
      );

    const customers =
      Array.isArray(result)
        ? result
        : result?.customers ||
          result?.data ||
          [];

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Customer profiles retrieved successfully.",
        customers:
          Array.isArray(customers)
            ? customers.map(
                serialiseDocument
              )
            : [],
        pagination:
          result?.pagination || null,
        filters:
          result?.filters || null,
      });
  } catch (error) {
    return next(error);
  }
}

async function getProfileStatistics(
  request,
  response,
  next
) {
  try {
    const getStatistics =
      getServiceMethod([
        "getCustomerProfileStatistics",
        "getProfileStatistics",
      ]);

    const statistics =
      await getStatistics(
        request.query || {},
        {
          viewer:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Customer profile statistics retrieved successfully.",
        statistics,
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Management profile retrieval and update
|--------------------------------------------------------------------------
*/

async function getProfile(
  request,
  response,
  next
) {
  try {
    const findCustomerProfile =
      getServiceMethod([
        "findCustomerProfile",
        "getCustomerProfile",
      ]);

    const customer =
      await findCustomerProfile(
        getCustomerIdentifier(
          request
        ),
        {
          includeDeleted:
            isAdministrator(
              request
            ) &&
            normaliseBoolean(
              request.query
                ?.includeDeleted,
              false
            ),

          viewer:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Customer profile retrieved successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(
  request,
  response,
  next
) {
  try {
    const updateCustomerProfile =
      getServiceMethod([
        "updateCustomerProfile",
        "updateProfile",
      ]);

    const customer =
      await updateCustomerProfile(
        getCustomerIdentifier(
          request
        ),
        request.body || {},
        {
          actorId:
            getAuthenticatedUserId(
              request
            ),

          actor:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Customer profile updated successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Customer self-service profile
|--------------------------------------------------------------------------
*/

async function getMyProfile(
  request,
  response,
  next
) {
  try {
    const customer =
      await findProfileForAuthenticatedUser(
        request
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Customer profile retrieved successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

async function updateMyProfile(
  request,
  response,
  next
) {
  try {
    const existingCustomer =
      await findProfileForAuthenticatedUser(
        request
      );

    const updateCustomerProfile =
      getServiceMethod([
        "updateCustomerProfile",
        "updateProfile",
      ]);

    const customer =
      await updateCustomerProfile(
        existingCustomer._id,
        stripSelfServiceProtectedFields(
          request.body
        ),
        {
          actorId:
            getAuthenticatedUserId(
              request
            ),

          actor:
            getAuthenticatedUser(
              request
            ),

          selfService: true,
        }
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Your customer profile was updated successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| User-account linking
|--------------------------------------------------------------------------
*/

async function linkUserAccount(
  request,
  response,
  next
) {
  try {
    const linkCustomerUserAccount =
      getServiceMethod([
        "linkCustomerUserAccount",
        "linkUserAccount",
      ]);

    const customer =
      await linkCustomerUserAccount(
        getCustomerIdentifier(
          request
        ),
        getUserAccountIdentifier(
          request
        ),
        {
          actorId:
            getAuthenticatedUserId(
              request
            ),

          actor:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Customer profile linked to the user account successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

async function unlinkUserAccount(
  request,
  response,
  next
) {
  try {
    const unlinkCustomerUserAccount =
      getServiceMethod([
        "unlinkCustomerUserAccount",
        "unlinkUserAccount",
      ]);

    const customer =
      await unlinkCustomerUserAccount(
        getCustomerIdentifier(
          request
        ),
        {
          actorId:
            getAuthenticatedUserId(
              request
            ),

          actor:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Customer profile unlinked from the user account successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Communication consent
|--------------------------------------------------------------------------
*/

async function updateConsent(
  request,
  response,
  next
) {
  try {
    const updateCustomerConsent =
      getServiceMethod([
        "updateCustomerConsent",
        "updateConsent",
      ]);

    const customer =
      await updateCustomerConsent(
        getCustomerIdentifier(
          request
        ),
        request.body || {},
        {
          actorId:
            getAuthenticatedUserId(
              request
            ),

          actor:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Customer communication consent updated successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

async function updateMyConsent(
  request,
  response,
  next
) {
  try {
    const existingCustomer =
      await findProfileForAuthenticatedUser(
        request
      );

    const updateCustomerConsent =
      getServiceMethod([
        "updateCustomerConsent",
        "updateConsent",
      ]);

    const customer =
      await updateCustomerConsent(
        existingCustomer._id,
        stripSelfServiceConsentFields(
          request.body
        ),
        {
          actorId:
            getAuthenticatedUserId(
              request
            ),

          actor:
            getAuthenticatedUser(
              request
            ),

          selfService: true,
        }
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Your communication consent was updated successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Profile lifecycle
|--------------------------------------------------------------------------
*/

async function archiveProfile(
  request,
  response,
  next
) {
  try {
    const archiveCustomerProfile =
      getServiceMethod([
        "archiveCustomerProfile",
        "archiveProfile",
      ]);

    const customer =
      await archiveCustomerProfile(
        getCustomerIdentifier(
          request
        ),
        {
          actorId:
            getAuthenticatedUserId(
              request
            ),

          actor:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Customer profile archived successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

async function restoreProfile(
  request,
  response,
  next
) {
  try {
    const restoreCustomerProfile =
      getServiceMethod([
        "restoreCustomerProfile",
        "restoreProfile",
      ]);

    const customer =
      await restoreCustomerProfile(
        getCustomerIdentifier(
          request
        ),
        {
          actorId:
            getAuthenticatedUserId(
              request
            ),

          actor:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Customer profile restored successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

async function deleteProfile(
  request,
  response,
  next
) {
  try {
    if (!isAdministrator(request)) {
      throw createControllerError(
        "Only an administrator can delete a customer profile.",
        {
          statusCode: 403,
          code:
            "ADMINISTRATOR_REQUIRED",
        }
      );
    }

    const softDeleteCustomerProfile =
      getServiceMethod([
        "softDeleteCustomerProfile",
        "deleteCustomerProfile",
        "deleteProfile",
      ]);

    const customer =
      await softDeleteCustomerProfile(
        getCustomerIdentifier(
          request
        ),
        {
          actorId:
            getAuthenticatedUserId(
              request
            ),

          actor:
            getAuthenticatedUser(
              request
            ),
        }
      );

    return response
      .status(200)
      .json({
        success: true,
        message:
          "Customer profile deleted successfully.",
        customer:
          serialiseDocument(
            customer
          ),
      });
  } catch (error) {
    return next(error);
  }
}

/*
|--------------------------------------------------------------------------
| Exports and compatibility aliases
|--------------------------------------------------------------------------
*/

export {
  archiveProfile,
  archiveProfile as archive,
  archiveProfile as archiveCustomerProfile,

  createProfile,
  createProfile as create,
  createProfile as createCustomerProfile,

  deleteProfile,
  deleteProfile as deleteCustomerProfile,
  deleteProfile as removeProfile,

  getMyProfile,
  getMyProfile as getMy,

  getProfile,
  getProfile as get,
  getProfile as getCustomerProfile,

  getProfileStatistics,
  getProfileStatistics as statistics,
  getProfileStatistics as getCustomerProfileStatistics,

  linkUserAccount,
  linkUserAccount as link,
  linkUserAccount as linkCustomerUserAccount,

  listProfiles,
  listProfiles as list,
  listProfiles as listCustomerProfiles,

  restoreProfile,
  restoreProfile as restore,
  restoreProfile as restoreCustomerProfile,

  unlinkUserAccount,
  unlinkUserAccount as unlink,
  unlinkUserAccount as unlinkCustomerUserAccount,

  updateConsent,
  updateConsent as updateCustomerConsent,

  updateMyConsent,

  updateMyProfile,
  updateMyProfile as updateMy,

  updateProfile,
  updateProfile as update,
  updateProfile as updateCustomerProfile,
};

export default {
  archiveProfile,
  createProfile,
  deleteProfile,
  getMyProfile,
  getProfile,
  getProfileStatistics,
  linkUserAccount,
  listProfiles,
  restoreProfile,
  unlinkUserAccount,
  updateConsent,
  updateMyConsent,
  updateMyProfile,
  updateProfile,
};