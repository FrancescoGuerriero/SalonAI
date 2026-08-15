import {
  notifyAppointmentCancelled,
  notifyAppointmentConfirmed,
  notifyAppointmentRescheduled,
  notifySafely,
} from "./appointmentNotificationService.js";

function normaliseText(value) {
  return String(value ?? "").trim();
}

function captureJsonBody(response) {
  if (response.locals?.salonaiLifecycleJsonCaptureInstalled) {
    return;
  }

  const originalJson = response.json.bind(response);

  response.locals.salonaiLifecycleJsonCaptureInstalled = true;
  response.json = (payload) => {
    response.locals.salonaiLifecycleResponseBody = payload;
    return originalJson(payload);
  };
}

function responseAppointmentId(request, response) {
  const payload = response.locals?.salonaiLifecycleResponseBody;
  const fromPayload =
    payload?.appointment?._id ||
    payload?.appointment?.id ||
    null;

  return normaliseText(
    fromPayload ||
      request.params?.id ||
      request.params?.appointmentId
  );
}

function actorId(request) {
  return request.user?._id || request.user?.id || null;
}

async function dispatchLifecycleNotification(mode, request, response) {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    return;
  }

  const appointmentId = responseAppointmentId(request, response);
  if (!appointmentId) {
    return;
  }

  const commonOptions = {
    actorId: actorId(request),
  };

  if (mode === "created") {
    await notifySafely(
      () => notifyAppointmentConfirmed(appointmentId, commonOptions),
      { event: "appointment.created", appointmentId }
    );
    return;
  }

  if (mode === "rescheduled") {
    await notifySafely(
      () => notifyAppointmentRescheduled(appointmentId, commonOptions),
      { event: "appointment.rescheduled", appointmentId }
    );
    return;
  }

  if (mode === "status") {
    const nextStatus = normaliseText(request.body?.status)
      .toLowerCase()
      .replaceAll("-", "_");

    if (nextStatus === "cancelled") {
      await notifySafely(
        () => notifyAppointmentCancelled(appointmentId, commonOptions),
        { event: "appointment.cancelled", appointmentId }
      );
      return;
    }

    if (nextStatus === "confirmed") {
      await notifySafely(
        () => notifyAppointmentConfirmed(appointmentId, commonOptions),
        { event: "appointment.confirmed", appointmentId }
      );
    }
  }
}

export function appointmentLifecycleNotification(mode) {
  return function appointmentLifecycleNotificationMiddleware(
    request,
    response,
    next
  ) {
    captureJsonBody(response);

    response.once("finish", () => {
      setImmediate(() => {
        void dispatchLifecycleNotification(mode, request, response)
          .catch((error) => {
            console.error("[SalonAI appointment lifecycle notification]", {
              mode,
              appointmentId: responseAppointmentId(request, response) || null,
              message: error?.message || "Appointment lifecycle notification failed.",
              code: error?.code || "APPOINTMENT_LIFECYCLE_NOTIFICATION_FAILED",
            });
          });
      });
    });

    next();
  };
}

export default appointmentLifecycleNotification;
