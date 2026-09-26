import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyTenantCoverage,
  summariseCollectionReadiness,
  summariseDatabaseReadiness,
} from "../platform/tenancy/tenantMigrationReadiness.js";
import {
  selectedCollectionNames,
} from "../../scripts/checkTenantMigrationReadiness.js";

test("tenant migration readiness classifies collection coverage", () => {
  assert.equal(
    classifyTenantCoverage({
      total: 0,
    }),
    "empty"
  );

  assert.equal(
    classifyTenantCoverage({
      total: 10,
      businessScoped: 0,
    }),
    "unscoped"
  );

  assert.equal(
    classifyTenantCoverage({
      total: 10,
      businessScoped: 4,
    }),
    "partially-business-scoped"
  );

  assert.equal(
    classifyTenantCoverage({
      total: 10,
      businessScoped: 10,
      locationScoped: 0,
    }),
    "business-scoped"
  );

  assert.equal(
    classifyTenantCoverage({
      total: 10,
      businessScoped: 10,
      locationScoped: 3,
    }),
    "business-scoped-partially-location-aware"
  );

  assert.equal(
    classifyTenantCoverage({
      total: 10,
      businessScoped: 10,
      locationScoped: 10,
    }),
    "business-and-location-scoped"
  );
});

test("tenant readiness reports global unique index candidates without changing them", () => {
  const summary =
    summariseCollectionReadiness({
      name: "services",
      total: 12,
      businessScoped: 0,
      locationScoped: 0,
      indexes: [
        {
          name: "_id_",
          key: {
            _id: 1,
          },
          unique: true,
        },
        {
          name: "slug_1",
          key: {
            slug: 1,
          },
          unique: true,
        },
        {
          name: "business_1_code_1",
          key: {
            business: 1,
            code: 1,
          },
          unique: true,
        },
      ],
    });

  assert.equal(
    summary.classification,
    "unscoped"
  );
  assert.equal(
    summary.globalUniqueCandidates.length,
    1
  );
  assert.equal(
    summary.globalUniqueCandidates[0].name,
    "slug_1"
  );
});

test("database readiness aggregates counts without document values", () => {
  const report =
    summariseDatabaseReadiness([
      {
        name: "services",
        total: 5,
        businessScoped: 0,
        locationScoped: 0,
      },
      {
        name: "locations",
        total: 2,
        businessScoped: 2,
        locationScoped: 0,
      },
    ]);

  assert.equal(
    report.readOnly,
    true
  );
  assert.equal(
    report.totals.collections,
    2
  );
  assert.equal(
    report.totals.documents,
    7
  );
  assert.equal(
    report.totals.unscopedCollections,
    1
  );
});

test("readiness collection selector de-duplicates explicit collection names", () => {
  assert.deepEqual(
    selectedCollectionNames([
      "--collection=services",
      "--collection=appointments",
      "--collection=services",
    ]),
    [
      "services",
      "appointments",
    ]
  );
});
