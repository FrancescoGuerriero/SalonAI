import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function source(relativePath) {
  return fs.readFileSync(
    path.resolve(
      process.cwd(),
      relativePath
    ),
    "utf8"
  );
}

describe(
  "Stage 2 service package workflow",
  () => {
    it(
      "keeps package purchase inside the shared cart and canonical checkout",
      () => {
        const cartContext =
          source(
            "src/context/CartContext.jsx"
          );
        const checkout =
          source(
            "src/pages/Checkout.jsx"
          );
        const customerPage =
          source(
            "src/pages/ServicePackagesPage.jsx"
          );

        expect(
          cartContext
        ).toContain(
          "addServicePackage"
        );
        expect(
          cartContext
        ).toContain(
          'type: "service_package"'
        );
        expect(
          checkout
        ).toContain(
          'type: "service_package"'
        );
        expect(
          checkout
        ).toContain(
          "servicePackage: item.servicePackageId"
        );
        expect(
          customerPage
        ).toContain(
          "addServicePackage"
        );
        expect(
          customerPage
        ).not.toContain(
          "createPaymentIntent"
        );
        expect(
          customerPage
        ).not.toContain(
          "fetch("
        );
      }
    );

    it(
      "exposes customer packages and management as separate governed surfaces",
      () => {
        const app =
          source(
            "src/App.jsx"
          );
        const navigation =
          source(
            "src/components/navigation/managementNavigationConfig.js"
          );
        const api =
          source(
            "src/Services/servicePackageService.js"
          );

        expect(app).toContain(
          'path="packages"'
        );
        expect(app).toContain(
          'path="manage/service-packages"'
        );
        expect(app).toContain(
          '"service:read"'
        );
        expect(
          navigation
        ).toContain(
          '["/manage/service-packages", "Service packages"'
        );
        expect(api).toContain(
          '"/service-packages/mine"'
        );
        expect(api).toContain(
          '"/future/service-packages"'
        );
      }
    );

    it(
      "keeps package management inline and responsive instead of introducing an oversized modal",
      () => {
        const management =
          source(
            "src/pages/ServicePackageManagementPage.jsx"
          );
        const styles =
          source(
            "src/pages/ServicePackages.css"
          );

        expect(
          management
        ).toContain(
          "package-management-grid"
        );
        expect(
          management
        ).not.toContain(
          "createPortal"
        );
        expect(
          styles
        ).toContain(
          "@media (max-width: 700px)"
        );
        expect(
          styles
        ).toContain(
          "grid-template-columns: 1fr"
        );
      }
    );

    it(
      "exposes transactional redemption and reversal through the existing management workflow",
      () => {
        const api =
          source(
            "src/Services/servicePackageService.js"
          );
        const management =
          source(
            "src/pages/ServicePackageManagementPage.jsx"
          );
        const redemption =
          source(
            "src/pages/ServicePackageRedemptionPanel.jsx"
          );

        expect(api).toContain(
          "/redeem"
        );
        expect(api).toContain(
          "/reverse"
        );
        expect(management).toContain(
          "ServicePackageRedemptionPanel"
        );
        expect(management).toContain(
          '"appointment:update"'
        );
        expect(redemption).toContain(
          "appointmentManagementApi"
        );
        expect(redemption).toContain(
          ".getCalendar("
        );
        expect(redemption).toContain(
          "listRedemptions"
        );
        expect(redemption).toContain(
          ".redeem("
        );
        expect(redemption).toContain(
          ".reverse("
        );
        expect(redemption).not.toContain(
          "createManagedAppointment"
        );
        expect(redemption).not.toContain(
          "createPayment"
        );
      }
    );

    it(
      "keeps manual grants explicit and auditable",
      () => {
        const management =
          source(
            "src/pages/ServicePackageManagementPage.jsx"
          );

        expect(
          management
        ).toContain(
          "Audit reason"
        );
        expect(
          management
        ).toContain(
          "grantReason.trim()"
        );
        expect(
          management
        ).toContain(
          "servicePackageService"
        );
        expect(
          management
        ).toContain(
          ".grant("
        );
      }
    );
  }
);
