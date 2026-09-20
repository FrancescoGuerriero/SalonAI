import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  argumentValues,
  exactNameExpression,
  selectedMode,
  selectorPlan,
} from "../../scripts/promoteSuperAdmin.js";

test("Super Admin promotion accepts repeated exact-name selectors", () => {
  const args = [
    "--user-name=Francesco",
    "--user-name=Francesco Guerriero",
  ];

  assert.deepEqual(
    argumentValues(
      "user-name",
      args
    ),
    [
      "Francesco",
      "Francesco Guerriero",
    ]
  );

  assert.deepEqual(
    selectorPlan(args),
    {
      userIds: [],
      userNames: [
        "Francesco",
        "Francesco Guerriero",
      ],
    }
  );
});

test("Super Admin promotion de-duplicates repeated selectors", () => {
  const userId =
    new mongoose.Types.ObjectId()
      .toString();

  assert.deepEqual(
    selectorPlan([
      `--user-id=${userId}`,
      `--user-id=${userId}`,
      "--user-name=Francesco",
      "--user-name=Francesco",
    ]),
    {
      userIds: [
        userId,
      ],
      userNames: [
        "Francesco",
      ],
    }
  );
});

test("Super Admin apply mode requires explicit confirmation", () => {
  assert.throws(
    () =>
      selectedMode([
        "--apply",
      ]),
    /requires --confirm=salonai-super-admin-promotion/
  );

  assert.equal(
    selectedMode([
      "--apply",
      "--confirm=salonai-super-admin-promotion",
    ]),
    "apply"
  );
});

test("legacy initial-super-admin confirmation remains backward compatible", () => {
  assert.equal(
    selectedMode([
      "--apply",
      "--confirm=salonai-initial-super-admin",
    ]),
    "apply"
  );
});

test("verify and apply cannot be combined", () => {
  assert.throws(
    () =>
      selectedMode([
        "--apply",
        "--verify",
        "--confirm=salonai-super-admin-promotion",
      ]),
    /cannot be used together/
  );
});

test("selector plan rejects invalid or missing ids", () => {
  assert.throws(
    () =>
      selectorPlan([]),
    /Provide at least one/
  );

  assert.throws(
    () =>
      selectorPlan([
        "--user-id=not-an-object-id",
      ]),
    /Invalid --user-id/
  );
});

test("exact account-name matching is anchored and case-insensitive", () => {
  const expression =
    exactNameExpression(
      "Francesco Guerriero"
    );

  assert.equal(
    expression.test(
      "Francesco Guerriero"
    ),
    true
  );
  assert.equal(
    expression.test(
      "francesco guerriero"
    ),
    true
  );
  assert.equal(
    expression.test(
      "Francesco Guerriero Extra"
    ),
    false
  );
});
