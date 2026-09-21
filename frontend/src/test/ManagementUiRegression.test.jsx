import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function source(
  relativePath
) {
  return fs.readFileSync(
    path.resolve(
      process.cwd(),
      relativePath
    ),
    "utf8"
  );
}

describe(
  "management UI regressions",
  () => {
    it(
      "integrates individual employee access management into Staff Roles",
      () => {
        const page =
          source(
            "src/pages/StaffRoleManagementPage.jsx"
          );

        expect(
          page
        ).toContain(
          "EmployeeAccessPanel"
        );
        expect(
          page
        ).toContain(
          "canReadEmployees"
        );
      }
    );


    it(
      "keeps the Add Employee dialog inside the viewport with a fixed shell and internal scrolling",
      () => {
        const modal =
          source(
            "src/components/employees/AddEmployeeModal.jsx"
          );

        expect(
          modal
        ).toContain(
          "createPortal"
        );
        expect(
          modal
        ).toContain(
          "z-[400]"
        );
        expect(
          modal
        ).toContain(
          "max-h-[calc(100dvh-1rem)]"
        );
        expect(
          modal
        ).toContain(
          "flex-col overflow-hidden"
        );
        expect(
          modal
        ).toContain(
          "overflow-x-hidden overflow-y-auto"
        );
        expect(
          modal
        ).toContain(
          "shrink-0 flex items-start justify-between"
        );
        expect(
          modal
        ).toContain(
          "shrink-0 flex flex-col-reverse"
        );
        expect(
          modal
        ).not.toContain(
          "fixed inset-0 z-50 flex items-center justify-center"
        );
        expect(
          modal
        ).not.toContain(
          "sticky top-0"
        );
        expect(
          modal
        ).not.toContain(
          "sticky bottom-0"
        );
      }
    );

    it(
      "renders the product editor at the application overlay layer with internal scrolling",
      () => {
        const page =
          source(
            "src/pages/ProductManagementPage.jsx"
          );

        expect(
          page
        ).toContain(
          "createPortal"
        );
        expect(
          page
        ).toContain(
          "z-[400]"
        );
        expect(
          page
        ).toContain(
          "max-h-[calc(100dvh-1rem)]"
        );
        expect(
          page
        ).toContain(
          "flex-col overflow-hidden"
        );
        expect(
          page
        ).toContain(
          "overflow-x-hidden overflow-y-auto"
        );
        expect(
          page
        ).toContain(
          "shrink-0 flex flex-col-reverse"
        );
        expect(
          page
        ).not.toContain(
          "fixed inset-0 z-50 flex items-center justify-center"
        );
      }
    );
  }
);
