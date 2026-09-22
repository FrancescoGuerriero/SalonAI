import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";
import mongoose from "mongoose";

import CustomerServicePackage from "../features/servicePackages/CustomerServicePackage.js";
import ServicePackage from "../features/servicePackages/ServicePackage.js";
import ServicePackageRedemption from "../features/servicePackages/ServicePackageRedemption.js";

async function source(
  relativePath
) {
  return readFile(
    new URL(
      relativePath,
      import.meta.url
    ),
    "utf8"
  );
}

test(
  "service package definitions reuse existing Service identifiers and session counts",
  () => {
    const serviceId =
      new mongoose.Types.ObjectId();
    const definition =
      new ServicePackage({
        code: "COLOUR-3",
        name: "Three colour visits",
        includedServices: [
          {
            service: serviceId,
            sessions: 3,
          },
        ],
        price: 250,
        validityDays: 365,
      });

    assert.equal(
      definition.includedServices.length,
      1
    );
    assert.equal(
      String(
        definition.includedServices[0]
          .service
      ),
      String(serviceId)
    );
    assert.equal(
      definition.includedServices[0]
        .sessions,
      3
    );
    assert.equal(
      definition.active,
      true
    );
    assert.equal(
      definition.published,
      false
    );
  }
);

test(
  "customer package entitlement snapshots purchased and remaining credits",
  () => {
    const serviceId =
      new mongoose.Types.ObjectId();
    const entitlement =
      new CustomerServicePackage({
        customer:
          new mongoose.Types.ObjectId(),
        servicePackage:
          new mongoose.Types.ObjectId(),
        credits: [
          {
            service: serviceId,
            purchased: 4,
            remaining: 4,
          },
        ],
        expiresAt:
          new Date(
            Date.now() +
              86_400_000
          ),
      });

    assert.equal(
      entitlement.source,
      "manual"
    );
    assert.equal(
      entitlement.status,
      "active"
    );
    assert.equal(
      entitlement.credits[0]
        .purchased,
      4
    );
    assert.equal(
      entitlement.credits[0]
        .remaining,
      4
    );
  }
);

test(
  "redemption model protects only active appointment redemptions so reversals remain reusable",
  () => {
    const indexes =
      ServicePackageRedemption.schema.indexes();

    const activeUnique =
      indexes.find(
        ([keys, options]) =>
          keys.appointment === 1 &&
          options.unique === true
      );

    assert.ok(activeUnique);
    assert.deepEqual(
      activeUnique[1]
        .partialFilterExpression,
      {
        status: "active",
      }
    );
  }
);

test(
  "package redemption consumes existing appointments instead of creating package bookings",
  async () => {
    const service =
      await source(
        "../features/servicePackages/servicePackageService.js"
      );

    const start =
      service.indexOf(
        "export async function redeemServicePackage"
      );
    const end =
      service.indexOf(
        "export async function reverseServicePackageRedemption",
        start
      );
    const redemption =
      service.slice(
        start,
        end
      );

    assert.match(
      redemption,
      /session\.withTransaction/
    );
    assert.match(
      redemption,
      /Appointment[\s\S]*?\.findById\(/
    );
    assert.match(
      redemption,
      /appointment\.customer/
    );
    assert.match(
      redemption,
      /appointment\.service/
    );
    assert.match(
      redemption,
      /credit\.remaining -= 1/
    );
    assert.match(
      redemption,
      /ServicePackageRedemption\.create\(/
    );
    assert.doesNotMatch(
      redemption,
      /Appointment\.create\(/
    );
    assert.doesNotMatch(
      redemption,
      /Customer\.create\(/
    );
    assert.doesNotMatch(
      redemption,
      /Payment\.create\(/
    );
  }
);

test(
  "package redemption reversal is transactional and restores only the consumed service credit",
  async () => {
    const service =
      await source(
        "../features/servicePackages/servicePackageService.js"
      );

    const start =
      service.indexOf(
        "export async function reverseServicePackageRedemption"
      );
    const end =
      service.indexOf(
        "export async function listPackageRedemptions",
        start
      );
    const reversal =
      service.slice(
        start,
        end
      );

    assert.match(
      reversal,
      /session\.withTransaction/
    );
    assert.match(
      reversal,
      /redemption\.service/
    );
    assert.match(
      reversal,
      /credit\.remaining =/
    );
    assert.match(
      reversal,
      /Math\.min\(/
    );
    assert.match(
      reversal,
      /redemption\.status =[\s\S]*?"reversed"/
    );
    assert.match(
      reversal,
      /reversalReason/
    );
  }
);

test(
  "package routes reuse existing service customer and appointment permissions",
  async () => {
    const routes =
      await source(
        "../features/servicePackages/servicePackageRoutes.js"
      );
    const futureRoutes =
      await source(
        "../features/futureFeatureRoutes.js"
      );

    assert.match(
      routes,
      /"service:read"/
    );
    assert.match(
      routes,
      /"service:create"/
    );
    assert.match(
      routes,
      /"service:update"/
    );
    assert.match(
      routes,
      /"customer:read"/
    );
    assert.match(
      routes,
      /"customer:update"/
    );
    assert.match(
      routes,
      /"appointment:update"/
    );
    assert.doesNotMatch(
      routes,
      /package:[a-z]+/
    );
    assert.match(
      futureRoutes,
      /"\/service-packages"[\s\S]*?servicePackageRoutes/
    );
  }
);

test(
  "manual entitlement grants are explicit and auditable rather than pretending to be paid orders",
  async () => {
    const service =
      await source(
        "../features/servicePackages/servicePackageService.js"
      );

    const start =
      service.indexOf(
        "export async function grantServicePackage"
      );
    const end =
      service.indexOf(
        "export async function listCustomerPackages",
        start
      );
    const grant =
      service.slice(
        start,
        end
      );

    assert.match(
      grant,
      /reason/
    );
    assert.match(
      grant,
      /source: "manual"/
    );
    assert.match(
      grant,
      /assignedBy:/
    );
    assert.doesNotMatch(
      grant,
      /source: "order"/
    );
    assert.doesNotMatch(
      grant,
      /Payment\.create\(/
    );
  }
);
