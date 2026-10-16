import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();

vi.mock("../api/axios.js", () => ({
  default: {
    post,
  },
}));

import { resumeWhatsAppBot } from "../Services/whatsappBookingService.js";

describe("WhatsApp booking service resume-bot client", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("uses the existing protected conversation resume endpoint and returns authoritative server data", async () => {
    const payload = {
      success: true,
      resumed: true,
      staleBookingReset: false,
      conversation: {
        _id: "conversation-1",
        automation: { mode: "bot", handoffRequested: false },
      },
    };

    post.mockResolvedValue({ data: payload });

    await expect(resumeWhatsAppBot("conversation-1")).resolves.toEqual(payload);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      "/whatsapp/conversations/conversation-1/resume-bot"
    );
  });
});
