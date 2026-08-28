import assert from "node:assert/strict";
import {
  spawnSync,
} from "node:child_process";
import {
  fileURLToPath,
} from "node:url";
import path from "node:path";
import test from "node:test";

const testDirectory =
  path.dirname(
    fileURLToPath(import.meta.url)
  );

const backendRoot =
  path.resolve(
    testDirectory,
    "../.."
  );

test(
  "WhatsAppConversation registers the User model in an isolated process",
  () => {
    const script = `
      import mongoose from "mongoose";

      await import(
        "./src/features/premium/whatsapp/WhatsAppConversation.js"
      );

      if (!mongoose.models.WhatsAppConversation) {
        console.error(
          "WhatsAppConversation model was not registered."
        );
        process.exit(10);
      }

      if (!mongoose.models.User) {
        console.error(
          "User model was not registered."
        );
        process.exit(11);
      }

      const conversationModel =
        mongoose.models.WhatsAppConversation;

      const assignedTo =
        conversationModel.schema.path(
          "assignedTo"
        );

      const confirmedBy =
        conversationModel.schema.path(
          "bookingSession.confirmedBy"
        );

      if (
        assignedTo?.options?.ref !==
        "User"
      ) {
        console.error(
          "assignedTo does not reference User."
        );
        process.exit(12);
      }

      if (
        confirmedBy?.options?.ref !==
        "User"
      ) {
        console.error(
          "bookingSession.confirmedBy does not reference User."
        );
        process.exit(13);
      }

      mongoose.model("User");

      console.log(
        "WhatsApp User model registration verified."
      );
    `;

    const result =
      spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          script,
        ],
        {
          cwd: backendRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            NODE_ENV: "test",
          },
        }
      );

    assert.equal(
      result.status,
      0,
      [
        "Isolated WhatsApp model registration failed.",
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n")
    );

    assert.match(
      result.stdout,
      /WhatsApp User model registration verified\./
    );
  }
);