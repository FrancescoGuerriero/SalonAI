import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

test(
  "customer account exposes self-service and canonical book-again journeys",
  async () => {
    const accountPage = await source(
      "../../../frontend/src/pages/CustomerAccountPage.jsx"
    );

    assert.match(
      accountPage,
      /BookingContext/
    );
    assert.match(
      accountPage,
      /setBooking\(\{[\s\S]*service:\s*appointment\.service,[\s\S]*stylist:\s*appointment\.stylist,[\s\S]*appointmentDate:\s*"",[\s\S]*appointmentTime:\s*""/
    );
    assert.match(
      accountPage,
      />Book again</
    );
    assert.match(
      accountPage,
      /to="\/experience\/appointments"/
    );
    assert.match(
      accountPage,
      /to="\/experience\/reviews"/
    );
    assert.match(
      accountPage,
      /to="\/experience"/
    );
  }
);
