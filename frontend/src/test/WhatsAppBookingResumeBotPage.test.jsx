import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirmWhatsAppBooking: vi.fn(),
  getWhatsAppConversation: vi.fn(),
  listWhatsAppConversations: vi.fn(),
  markWhatsAppConversationRead: vi.fn(),
  resumeWhatsAppBot: vi.fn(),
  sendOneOffWhatsAppMessage: vi.fn(),
  sendWhatsAppConversationMessage: vi.fn(),
  updateWhatsAppBookingSession: vi.fn(),
  updateWhatsAppConversationStatus: vi.fn(),
  getServices: vi.fn(),
  getBookingStylists: vi.fn(),
  getAvailability: vi.fn(),
}));

vi.mock("../Services/serviceService.js", () => ({
  default: {
    getServices: mocks.getServices,
  },
}));

vi.mock("../Services/stylistService.js", () => ({
  default: {
    getBookingStylists: mocks.getBookingStylists,
    getAvailability: mocks.getAvailability,
  },
}));

vi.mock("../Services/whatsappBookingService.js", () => ({
  confirmWhatsAppBooking: mocks.confirmWhatsAppBooking,
  getWhatsAppConversation: mocks.getWhatsAppConversation,
  listWhatsAppConversations: mocks.listWhatsAppConversations,
  markWhatsAppConversationRead: mocks.markWhatsAppConversationRead,
  resumeWhatsAppBot: mocks.resumeWhatsAppBot,
  sendOneOffWhatsAppMessage: mocks.sendOneOffWhatsAppMessage,
  sendWhatsAppConversationMessage: mocks.sendWhatsAppConversationMessage,
  updateWhatsAppBookingSession: mocks.updateWhatsAppBookingSession,
  updateWhatsAppConversationStatus: mocks.updateWhatsAppConversationStatus,
}));

import WhatsAppBookingPage from "../pages/WhatsAppBookingPage.jsx";

const humanConversation = {
  _id: "conversation-1",
  phone: "+447000000001",
  displayName: "Test Customer",
  status: "open",
  unreadCount: 0,
  lastInboundAt: new Date().toISOString(),
  messages: [
    {
      _id: "message-1",
      body: "I need some help",
      direction: "inbound",
      sentAt: new Date().toISOString(),
    },
  ],
  automation: {
    mode: "human",
    handoffRequested: true,
    handoffReason: "Staff review requested",
  },
  assignedTo: {
    firstName: "Salon",
    lastName: "Manager",
  },
  bookingSession: {},
};

const botConversation = {
  ...humanConversation,
  automation: {
    mode: "bot",
    handoffRequested: false,
    handoffReason: "",
  },
  assignedTo: null,
};

describe("WhatsAppBookingPage resume-bot management wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServices.mockResolvedValue([]);
    mocks.getBookingStylists.mockResolvedValue([]);
    mocks.listWhatsAppConversations.mockResolvedValue({
      conversations: [humanConversation],
      summary: {
        open: 1,
        awaitingConfirmation: 0,
        booked: 0,
        unread: 0,
      },
    });
    mocks.getWhatsAppConversation
      .mockResolvedValueOnce(humanConversation)
      .mockResolvedValue(botConversation);
    mocks.resumeWhatsAppBot.mockResolvedValue({
      success: true,
      resumed: true,
      staleBookingReset: false,
      conversation: {
        ...botConversation,
        messages: undefined,
      },
    });
  });

  it("requests the protected resume lifecycle and refreshes authoritative conversation state", async () => {
    const user = userEvent.setup();
    render(<WhatsAppBookingPage />);

    const resumeButton = await screen.findByRole("button", {
      name: "Return to AI",
    });

    expect(screen.getByText("Human handling")).toBeInTheDocument();
    expect(screen.getByText("I need some help")).toBeInTheDocument();

    await user.click(resumeButton);

    await waitFor(() => {
      expect(mocks.resumeWhatsAppBot).toHaveBeenCalledTimes(1);
      expect(mocks.resumeWhatsAppBot).toHaveBeenCalledWith("conversation-1");
    });

    expect(
      await screen.findByText("AI handling resumed for this conversation.")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.getWhatsAppConversation).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText("AI handling")).toBeInTheDocument();
    expect(screen.getByText("I need some help")).toBeInTheDocument();
    expect(mocks.listWhatsAppConversations).toHaveBeenCalledTimes(2);
  });
});
