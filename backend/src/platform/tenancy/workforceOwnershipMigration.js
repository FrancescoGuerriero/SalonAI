import mongoose from "mongoose";

function ownershipError(
  message,
  code = "INVALID_WORKFORCE_OWNERSHIP_PLAN"
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function idText(value) {
  const candidate =
    value &&
    typeof value === "object" &&
    "_id" in value
      ? value._id
      : value;

  return String(
    candidate || ""
  ).trim();
}

function requiredObjectId(
  value,
  label
) {
  const id = idText(value);

  if (
    !mongoose.Types.ObjectId.isValid(
      id
    )
  ) {
    throw ownershipError(
      `${label} must be a valid ObjectId.`
    );
  }

  return id;
}

function emailText(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function roleKey(value) {
  const role =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (
    !/^[a-z][a-z0-9_]{2,39}$/.test(
      role
    ) ||
    role === "customer"
  ) {
    return null;
  }

  return role;
}

function uniqueIds(values) {
  return [
    ...new Set(
      (
        Array.isArray(values)
          ? values
          : []
      )
        .map(idText)
        .filter(Boolean)
    ),
  ];
}

function membershipKey(
  userId,
  businessId
) {
  return `${userId}:${businessId}`;
}

export function buildWorkforceOwnershipReadiness({
  stylists = [],
  users = [],
  memberships = [],
  businessId,
  locationId,
} = {}) {
  const targetBusinessId =
    requiredObjectId(
      businessId,
      "businessId"
    );
  const targetLocationId =
    requiredObjectId(
      locationId,
      "locationId"
    );

  const userById =
    new Map(
      (
        Array.isArray(users)
          ? users
          : []
      ).map(
        (user) => [
          idText(user?._id),
          user,
        ]
      )
    );

  const usersByEmail =
    new Map();

  for (
    const user of
      Array.isArray(users)
        ? users
        : []
  ) {
    const email =
      emailText(
        user?.email
      );

    if (!email) {
      continue;
    }

    const list =
      usersByEmail.get(
        email
      ) || [];

    list.push(user);
    usersByEmail.set(
      email,
      list
    );
  }

  const membershipByUserBusiness =
    new Map();

  for (
    const membership of
      Array.isArray(memberships)
        ? memberships
        : []
  ) {
    const userId =
      idText(
        membership?.user
      );
    const membershipBusinessId =
      idText(
        membership?.business
      );

    if (
      !userId ||
      !membershipBusinessId
    ) {
      continue;
    }

    membershipByUserBusiness.set(
      membershipKey(
        userId,
        membershipBusinessId
      ),
      membership
    );
  }

  const stylistEmailCounts =
    new Map();

  for (
    const stylist of
      Array.isArray(stylists)
        ? stylists
        : []
  ) {
    const email =
      emailText(
        stylist?.email
      );

    if (email) {
      stylistEmailCounts.set(
        email,
        (
          stylistEmailCounts.get(
            email
          ) || 0
        ) + 1
      );
    }
  }

  const plans = [];
  const blockers = [];
  const membershipCreates = [];
  const manualLinkCandidates = [];

  for (
    const stylist of
      Array.isArray(stylists)
        ? stylists
        : []
  ) {
    const stylistId =
      requiredObjectId(
        stylist?._id,
        "stylist._id"
      );
    const currentBusinessId =
      idText(
        stylist?.business
      );
    const currentLocations =
      uniqueIds(
        stylist?.workingLocations
      );
    const linkedUserId =
      idText(
        stylist?.userAccount
      );
    const email =
      emailText(
        stylist?.email
      );
    const recordBlockers = [];

    if (
      currentBusinessId &&
      currentBusinessId !==
        targetBusinessId
    ) {
      recordBlockers.push(
        "stylist-owned-by-other-business"
      );
    }

    if (
      email &&
      (
        stylistEmailCounts.get(
          email
        ) || 0
      ) > 1
    ) {
      recordBlockers.push(
        "duplicate-stylist-email"
      );
    }

    let signInState =
      "no-sign-in";
    let membershipAction =
      "not-required";
    let resolvedUserId =
      null;

    if (linkedUserId) {
      signInState =
        "linked-user";
      resolvedUserId =
        linkedUserId;

      const user =
        userById.get(
          linkedUserId
        );

      if (!user) {
        recordBlockers.push(
          "linked-user-missing"
        );
      } else {
        const nextRoleKey =
          roleKey(
            user.role
          );

        if (!nextRoleKey) {
          recordBlockers.push(
            "linked-user-not-staff-role"
          );
        }

        const membership =
          membershipByUserBusiness.get(
            membershipKey(
              linkedUserId,
              targetBusinessId
            )
          );

        if (!membership) {
          membershipAction =
            "create";

          if (nextRoleKey) {
            membershipCreates.push({
              stylistId,
              userId:
                linkedUserId,
              business:
                targetBusinessId,
              roleKey:
                nextRoleKey,
              locationAccessMode:
                "selected",
              locations: [
                targetLocationId,
              ],
            });
          }
        } else if (
          membership.status ===
            "active"
        ) {
          membershipAction =
            "reuse";
        } else {
          membershipAction =
            "manual-review";
          recordBlockers.push(
            "existing-membership-not-active"
          );
        }
      }
    } else if (email) {
      const candidates =
        usersByEmail.get(
          email
        ) || [];

      if (
        candidates.length === 1
      ) {
        signInState =
          "email-candidate-manual-review";

        manualLinkCandidates.push({
          stylistId,
          email,
          candidateUserId:
            idText(
              candidates[0]._id
            ),
        });
      } else if (
        candidates.length > 1
      ) {
        signInState =
          "ambiguous-email-candidate";
        recordBlockers.push(
          "ambiguous-email-user-match"
        );
      }
    }

    const businessAction =
      currentBusinessId ===
        targetBusinessId
        ? "reuse"
        : currentBusinessId
          ? "conflict"
          : "assign";

    const locationAction =
      currentLocations.includes(
        targetLocationId
      )
        ? "reuse"
        : "add-primary-location";

    const plan =
      Object.freeze({
        stylistId,
        businessAction,
        locationAction,
        currentLocations:
          Object.freeze([
            ...currentLocations,
          ]),
        signInState,
        resolvedUserId,
        membershipAction,
        blockers:
          Object.freeze([
            ...recordBlockers,
          ]),
      });

    plans.push(plan);

    for (
      const blocker of
        recordBlockers
    ) {
      blockers.push({
        stylistId,
        blocker,
      });
    }
  }

  const summary =
    Object.freeze({
      stylists:
        plans.length,
      alreadyBusinessOwned:
        plans.filter(
          (item) =>
            item.businessAction ===
            "reuse"
        ).length,
      businessAssignments:
        plans.filter(
          (item) =>
            item.businessAction ===
            "assign"
        ).length,
      locationAssignments:
        plans.filter(
          (item) =>
            item.locationAction ===
            "add-primary-location"
        ).length,
      linkedSignIn:
        plans.filter(
          (item) =>
            item.signInState ===
            "linked-user"
        ).length,
      noSignIn:
        plans.filter(
          (item) =>
            item.signInState ===
            "no-sign-in"
        ).length,
      manualEmailLinkCandidates:
        manualLinkCandidates.length,
      membershipCreates:
        membershipCreates.length,
      blockers:
        blockers.length,
    });

  return Object.freeze({
    businessId:
      targetBusinessId,
    locationId:
      targetLocationId,
    safeForBackfill:
      blockers.length === 0,
    summary,
    plans:
      Object.freeze(plans),
    membershipCreates:
      Object.freeze(
        membershipCreates.map(
          (item) =>
            Object.freeze({
              ...item,
              locations:
                Object.freeze([
                  ...item.locations,
                ]),
            })
        )
      ),
    manualLinkCandidates:
      Object.freeze(
        manualLinkCandidates.map(
          (item) =>
            Object.freeze({
              ...item,
            })
        )
      ),
    blockers:
      Object.freeze(
        blockers.map(
          (item) =>
            Object.freeze({
              ...item,
            })
        )
      ),
  });
}

export default {
  buildWorkforceOwnershipReadiness,
};
