import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCommunicationHistory,
  sendReminderNow,
  createPaymentCheckout,
} = vi.hoisted(() => ({
  getCommunicationHistory: vi.fn(),
  sendReminderNow: vi.fn(),
  createPaymentCheckout: vi.fn(),
}));

vi.mock("../../Services/appointmentManagementApi.js", () => ({
  default: {
    getCommunicationHistory,
    sendReminderNow,
    createPaymentCheckout,
  },
}));

import StaffAppointmentCommercePanel from "../../components/appointments/StaffAppointmentCommercePanel.jsx";

describe("StaffAppointmentCommercePanel", () => {
  beforeEach(() => {
    getCommunicationHistory.mockReset();
    sendReminderNow.mockReset();
    createPaymentCheckout.mockReset();

    getCommunicationHistory.mockResolvedValue({
      items: [],
    });
  });

  it("shows staff reminder and payment controls", async () => {
    render(
      <StaffAppointmentCommercePanel
        appointment={{
          _id: "507f1f77bcf86cd799439011",
          paymentStatus: "partially_paid",
          amountPaid: 25,
          balanceDue: 75,
          service: {
            name: "Cut and Finish",
            price: 100,
          },
        }}
      />
    );

    expect(
      screen.getByRole("button", { name: /send reminder now/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /request balance/i })
    ).toBeInTheDocument();
    expect(screen.getByText("£75.00")).toBeInTheDocument();

    await waitFor(() => {
      expect(getCommunicationHistory).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        { limit: 25 }
      );
    });
  });

  it("shows a settled state when nothing is outstanding", async () => {
    render(
      <StaffAppointmentCommercePanel
        appointment={{
          _id: "507f1f77bcf86cd799439012",
          paymentStatus: "paid",
          amountPaid: 100,
          balanceDue: 0,
          service: {
            name: "Colour Service",
            price: 100,
          },
        }}
      />
    );

    expect(
      screen.getByText(/no payment is currently outstanding/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(getCommunicationHistory).toHaveBeenCalled();
    });
  });
});
