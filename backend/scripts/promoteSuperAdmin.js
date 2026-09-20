import dotenv from "dotenv";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import User from "../src/models/user.js";

dotenv.config();

const APPLY = "--apply";
const VERIFY = "--verify";
const CONFIRM =
  "--confirm=salonai-super-admin-promotion";
const LEGACY_CONFIRM =
  "--confirm=salonai-initial-super-admin";

export function argumentValues(
  name,
  args = process.argv.slice(2)
) {
  const prefix = `--${name}=`;

  return [
    ...new Set(
      args
        .filter((value) =>
          String(value).startsWith(prefix)
        )
        .map((value) =>
          String(value)
            .slice(prefix.length)
            .trim()
        )
        .filter(Boolean)
    ),
  ];
}

export function selectedMode(
  args = process.argv.slice(2)
) {
  const apply =
    args.includes(APPLY);
  const verify =
    args.includes(VERIFY);

  if (apply && verify) {
    throw new Error(
      "--apply and --verify cannot be used together."
    );
  }

  if (
    apply &&
    !args.includes(CONFIRM) &&
    !args.includes(LEGACY_CONFIRM)
  ) {
    throw new Error(
      `Applying a Super Admin promotion requires ${CONFIRM}.`
    );
  }

  return apply
    ? "apply"
    : verify
      ? "verify"
      : "dry-run";
}

export function selectorPlan(
  args = process.argv.slice(2)
) {
  const userIds =
    argumentValues(
      "user-id",
      args
    );
  const userNames =
    argumentValues(
      "user-name",
      args
    );

  if (
    userIds.length === 0 &&
    userNames.length === 0
  ) {
    throw new Error(
      "Provide at least one --user-id=<MongoDB User ID> or --user-name=<exact account name>."
    );
  }

  for (const userId of userIds) {
    if (
      !mongoose.isValidObjectId(
        userId
      )
    ) {
      throw new Error(
        `Invalid --user-id value: ${userId}.`
      );
    }
  }

  return {
    userIds,
    userNames,
  };
}

export function exactNameExpression(
  name
) {
  const cleaned =
    String(name || "")
      .trim();

  if (!cleaned) {
    throw new Error(
      "Super Admin account name cannot be empty."
    );
  }

  const escaped =
    cleaned.replace(
      /[-/\\^$*+?.()|[\]{}]/g,
      "\\$&"
    );

  return new RegExp(
    `^${escaped}$`,
    "i"
  );
}

function mongoUri() {
  const uri =
    String(
      process.env.MONGODB_URI ||
        process.env.MONGO_URI ||
        ""
    ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required."
    );
  }

  return uri;
}

function assertEligibleCandidate(
  user,
  selectorDescription
) {
  if (!user) {
    throw new Error(
      `No SalonAI user exists for ${selectorDescription}.`
    );
  }

  if (
    user.isActive === false
  ) {
    throw new Error(
      `The selected account for ${selectorDescription} is inactive.`
    );
  }

  if (
    String(user.role || "") ===
    "customer"
  ) {
    throw new Error(
      `The selected account for ${selectorDescription} is a customer account, not a staff account.`
    );
  }

  return user;
}

async function candidateById(
  userId
) {
  const user =
    await User.findById(
      userId
    ).select(
      "name role isActive"
    );

  return assertEligibleCandidate(
    user,
    `User ID ${userId}`
  );
}

async function candidateByExactName(
  userName
) {
  const users =
    await User.find({
      name:
        exactNameExpression(
          userName
        ),
      isActive: {
        $ne: false,
      },
      role: {
        $ne: "customer",
      },
    })
      .select(
        "name role isActive"
      )
      .limit(2);

  if (
    users.length === 0
  ) {
    throw new Error(
      `No active SalonAI staff user exists with exact name "${userName}".`
    );
  }

  if (
    users.length > 1
  ) {
    throw new Error(
      `More than one active SalonAI staff user has exact name "${userName}". Use --user-id for an unambiguous promotion.`
    );
  }

  return users[0];
}

async function resolveCandidates(
  plan
) {
  const candidates = [];

  for (
    const userId of
      plan.userIds
  ) {
    candidates.push(
      await candidateById(
        userId
      )
    );
  }

  for (
    const userName of
      plan.userNames
  ) {
    candidates.push(
      await candidateByExactName(
        userName
      )
    );
  }

  const byId =
    new Map();

  for (const user of candidates) {
    byId.set(
      String(user._id),
      user
    );
  }

  return [
    ...byId.values(),
  ];
}

function candidateSummary(
  user
) {
  return {
    id:
      String(user._id),
    name:
      user.name,
    role:
      user.role,
    isActive:
      user.isActive !== false,
    changeRequired:
      user.role !==
      "super_admin",
  };
}

async function verifyCandidates(
  candidateIds
) {
  const users =
    await User.find({
      _id: {
        $in:
          candidateIds,
      },
    }).select(
      "name role isActive"
    );

  const byId =
    new Map(
      users.map(
        (user) => [
          String(user._id),
          user,
        ]
      )
    );

  const failures = [];

  for (
    const candidateId of
      candidateIds
  ) {
    const user =
      byId.get(
        String(candidateId)
      );

    if (
      !user ||
      user.isActive === false ||
      user.role !==
        "super_admin"
    ) {
      failures.push(
        String(candidateId)
      );
    }
  }

  if (failures.length) {
    throw new Error(
      `Super Admin verification failed for ${failures.length} selected account(s).`
    );
  }

  return users;
}

export async function main(
  args = process.argv.slice(2)
) {
  const mode =
    selectedMode(args);
  const plan =
    selectorPlan(args);

  await mongoose.connect(
    mongoUri()
  );

  const candidates =
    await resolveCandidates(
      plan
    );

  if (!candidates.length) {
    throw new Error(
      "No Super Admin candidates were resolved."
    );
  }

  console.log(
    JSON.stringify(
      {
        mode,
        candidates:
          candidates.map(
            candidateSummary
          ),
        selectedAccounts:
          candidates.length,
      },
      null,
      2
    )
  );

  const candidateIds =
    candidates.map(
      (user) =>
        user._id
    );

  if (mode === "verify") {
    await verifyCandidates(
      candidateIds
    );

    console.log(
      "[PASS] All selected Super Admin identities are active and verified."
    );
    return;
  }

  if (mode === "dry-run") {
    console.log(
      "[PASS] Super Admin promotion dry-run completed. No database changes were made."
    );
    return;
  }

  await User.updateMany(
    {
      _id: {
        $in:
          candidateIds,
      },
      isActive: {
        $ne: false,
      },
      role: {
        $ne: "customer",
      },
    },
    {
      $set: {
        role:
          "super_admin",
      },
    }
  );

  await verifyCandidates(
    candidateIds
  );

  console.log(
    "[PASS] All selected Super Admin promotions were applied and verified."
  );
}

const executedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url ===
    pathToFileURL(
      process.argv[1]
    ).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error(
        "[FAIL] Super Admin promotion:",
        error.message
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
