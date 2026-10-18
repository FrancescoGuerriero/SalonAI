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
  "DEV2 contextual error feedback regressions",
  () => {
    it(
      "keeps product editor failures inside the editor while page failures remain page-scoped",
      () => {
        const page = source(
          "src/pages/ProductManagementPage.jsx"
        );

        expect(page).toContain(
          "pageError"
        );
        expect(page).toContain(
          "formError"
        );
        expect(page).toContain(
          "setPageError("
        );
        expect(page).toContain(
          "setFormError("
        );
        expect(page).toContain(
          '"The product could not be saved."'
        );
        expect(page).toMatch(
          /\{formError \? \([\s\S]*?role="alert"[\s\S]*?\{formError\}/
        );
        expect(page).toMatch(
          /\{pageError \? \([\s\S]*?role="alert"[\s\S]*?\{pageError\}/
        );
      }
    );

    it(
      "separates appointment customer-search failures from appointment mutation failures",
      () => {
        const dialog = source(
          "src/components/calendar/AppointmentEditorDialog.jsx"
        );

        expect(dialog).toContain(
          "customerSearchError"
        );
        expect(dialog).toContain(
          "setCustomerSearchError("
        );
        expect(dialog).toContain(
          '"Customers could not be searched. Try again."'
        );
        expect(dialog).toMatch(
          /\{customerSearchError \? \([\s\S]*?role="alert"[\s\S]*?\{customerSearchError\}/
        );
        expect(dialog).toContain(
          "let active = true;"
        );
        expect(dialog).toContain(
          "active = false;"
        );
      }
    );

    it(
      "uses operation-specific walk-in errors and does not report a failed search as no results",
      () => {
        const dialog = source(
          "src/components/appointments/WalkInDialog.jsx"
        );

        expect(dialog).toContain(
          "optionError"
        );
        expect(dialog).toContain(
          "searchError"
        );
        expect(dialog).toContain(
          "submitError"
        );
        expect(dialog).toContain(
          '"Stylist and service options could not be loaded. Close and reopen the dialog or try again."'
        );
        expect(dialog).toContain(
          '"Customers could not be searched. Try again."'
        );
        expect(dialog).toContain(
          '"The walk-in could not be created."'
        );
        expect(dialog).toContain(
          "!searchError &&"
        );
        expect(dialog).toContain(
          "Boolean(optionError)"
        );
      }
    );
  }
);
