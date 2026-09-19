const APPOINTMENT_ELIGIBLE_FILTER = Object.freeze({
  isActive: true,
  acceptsAppointments: true,
});

const CUSTOMER_VISIBLE_FILTER = Object.freeze({
  isActive: true,
  profilePublished: true,
});

function compactText(value, maximum = 120) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximum);
}

export function isAppointmentEligibleStylist(stylist) {
  return Boolean(
    stylist &&
    stylist.isActive === true &&
    stylist.acceptsAppointments === true
  );
}

export function isCustomerVisibleStylist(stylist) {
  return Boolean(
    stylist &&
    stylist.isActive === true &&
    stylist.profilePublished === true
  );
}

export function filterCustomerVisibleStylists(stylists) {
  return (Array.isArray(stylists) ? stylists : [])
    .filter(isCustomerVisibleStylist);
}

export function appointmentEligibleStylistFilter() {
  return {
    ...APPOINTMENT_ELIGIBLE_FILTER,
  };
}

export function customerVisibleStylistFilter() {
  return {
    ...CUSTOMER_VISIBLE_FILTER,
  };
}

export function extractRequestedStylistName(
  message,
  {
    allowBareName = false,
  } = {}
) {
  const text = compactText(message, 4096);

  if (!text) {
    return "";
  }

  if (
    /\bany (?:available )?stylist\b/i.test(text) ||
    /\banyone(?: available)?\b/i.test(text)
  ) {
    return "";
  }

  const withMatch =
    /\bwith\s+(.+?)(?=\s+(?:on|at|for|tomorrow|today|next|this|in)\b|[,.!?;]|$)/i
      .exec(text);

  if (withMatch?.[1]) {
    return compactText(
      withMatch[1],
      120
    );
  }

  if (
    allowBareName &&
    /^[\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,3}$/u.test(text)
  ) {
    return compactText(
      text,
      120
    );
  }

  return "";
}

export default {
  appointmentEligibleStylistFilter,
  customerVisibleStylistFilter,
  extractRequestedStylistName,
  filterCustomerVisibleStylists,
  isAppointmentEligibleStylist,
  isCustomerVisibleStylist,
};
