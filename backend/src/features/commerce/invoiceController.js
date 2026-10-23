import {
  getAppointmentInvoice,
  getOrderInvoice,
  invoicePublicView,
  issueAppointmentInvoice,
  issueOrderInvoice,
} from "./invoiceService.js";

export async function createAppointmentInvoice(request, response) {
  const invoice = await issueAppointmentInvoice(
    request.params.id,
    request.user || null
  );

  return response.status(201).json({
    success: true,
    invoice: invoicePublicView(invoice),
  });
}

export async function readAppointmentInvoice(request, response) {
  const invoice = await getAppointmentInvoice(request.params.id);

  return response.status(200).json({
    success: true,
    invoice: invoicePublicView(invoice),
  });
}

export async function createOrderInvoice(request, response) {
  const invoice = await issueOrderInvoice(
    request.params.id,
    request.user || null
  );

  return response.status(201).json({
    success: true,
    invoice: invoicePublicView(invoice),
  });
}

export async function readOrderInvoice(request, response) {
  const invoice = await getOrderInvoice(request.params.id);

  return response.status(200).json({
    success: true,
    invoice: invoicePublicView(invoice),
  });
}

export default {
  createAppointmentInvoice,
  createOrderInvoice,
  readAppointmentInvoice,
  readOrderInvoice,
};
