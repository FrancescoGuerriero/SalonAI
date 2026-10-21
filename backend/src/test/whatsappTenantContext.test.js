import assert from "node:assert/strict";
import test from "node:test";

import {
  extractWhatsAppDestination,
} from "../features/premium/whatsapp/whatsappTenantContextService.js";

test("Twilio destination is normalised without trusting the inbound customer number", () => {
  const result = extractWhatsAppDestination(
    {
      body: {
        From: "whatsapp:+447700900111",
        To: "whatsapp:+442071234567",
      },
    },
    "twilio"
  );

  assert.deepEqual(result, {
    provider: "twilio",
    destinationKey: "+442071234567",
  });
});

test("Meta destination uses the provider phone-number id", () => {
  const result = extractWhatsAppDestination(
    {
      body: {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: {
                    phone_number_id: "1234567890",
                  },
                },
              },
            ],
          },
        ],
      },
    },
    "meta"
  );

  assert.deepEqual(result, {
    provider: "meta",
    destinationKey: "1234567890",
  });
});

test("unsupported or missing provider destinations remain unscoped", () => {
  assert.equal(extractWhatsAppDestination({ body: {} }, "twilio"), null);
  assert.equal(extractWhatsAppDestination({ body: {} }, "meta"), null);
  assert.equal(extractWhatsAppDestination({ body: {} }, "console"), null);
});
