import Payment from "../models/payment.js";
import Appointment from "../models/appointment.js";

class PaymentService {
  /**
   * Create a new payment
   */
  async createPayment(data) {
    const appointment = await Appointment.findById(data.appointment);

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const payment = await Payment.create({
      appointment: appointment._id,
      customer: appointment.customer,
      amount: data.amount,
      currency: data.currency || "GBP",
      type: data.type || "full_payment",
      method: data.method,
      status: "paid",
      transactionReference: data.transactionReference,
      notes: data.notes,
      paidAt: new Date(),
    });

    await this.updateAppointmentBalance(appointment._id);

    return payment;
  }

  /**
   * Calculate totals for an appointment
   */
  async updateAppointmentBalance(appointmentId) {
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const payments = await Payment.find({
      appointment: appointmentId,
      status: "paid",
    });

    const amountPaid = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    const balanceDue = Math.max(
      appointment.finalPrice - amountPaid,
      0
    );

    let paymentStatus = "pending";

    if (amountPaid === 0) {
      paymentStatus = "pending";
    } else if (balanceDue > 0) {
      paymentStatus = "partially_paid";
    } else {
      paymentStatus = "paid";
    }

    appointment.amountPaid = amountPaid;
    appointment.balanceDue = balanceDue;
    appointment.paymentStatus = paymentStatus;

    await appointment.save();

    return appointment;
  }

  /**
   * Refund a payment
   */
  async refundPayment(paymentId) {
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    payment.status = "refunded";

    await payment.save();

    await this.updateAppointmentBalance(payment.appointment);

    return payment;
  }

  /**
   * Retrieve payments for one appointment
   */
  async getAppointmentPayments(appointmentId) {
    return Payment.find({
      appointment: appointmentId,
    }).sort({
      createdAt: -1,
    });
  }

  /**
   * Total revenue
   */
  async getRevenue(startDate, endDate) {
    const payments = await Payment.find({
      status: "paid",
      paidAt: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    const revenue = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    return {
      revenue,
      transactions: payments.length,
    };
  }

  /**
   * Generate a receipt number
   */
  generateReceiptNumber() {
    const year = new Date().getFullYear();

    const random = Math.floor(
      100000 + Math.random() * 900000
    );

    return `SAL-${year}-${random}`;
  }
}

export default new PaymentService();