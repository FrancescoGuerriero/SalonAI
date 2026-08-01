const VARIABLE_PATTERN =
  /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function nestedValue(source, path) {
  return String(path)
    .split(".")
    .reduce((value, key) => value?.[key], source);
}

export function extractTemplateVariables(text = "") {
  return [
    ...new Set(
      [...String(text).matchAll(VARIABLE_PATTERN)].map(
        (match) => match[1]
      )
    ),
  ];
}

export function renderTemplate(
  text,
  context,
  { strict = false } = {}
) {
  return String(text || "").replace(
    VARIABLE_PATTERN,
    (_match, variable) => {
      const value = nestedValue(context, variable);

      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        if (strict) {
          throw new Error(
            `Missing template variable: ${variable}`
          );
        }

        return "";
      }

      return String(value);
    }
  );
}

export function buildCustomerContext(
  customer = {},
  appointment = {},
  service = {},
  stylist = {}
) {
  const fullName =
    customer.fullName ||
    customer.name ||
    [customer.firstName, customer.lastName]
      .filter(Boolean)
      .join(" ");

  const stylistName =
    stylist.name ||
    stylist.fullName ||
    [stylist.firstName, stylist.lastName]
      .filter(Boolean)
      .join(" ");

  return {
    customer: {
      firstName:
        customer.firstName ||
        fullName.split(" ")[0] ||
        "",
      lastName: customer.lastName || "",
      fullName,
      email: customer.email || "",
      phone:
        customer.phone ||
        customer.phoneNumber ||
        customer.mobile ||
        "",
    },
    appointment: {
      date:
        appointment.appointmentDate ||
        appointment.startsAt ||
        "",
      time: appointment.appointmentTime || "",
      service: service.name || "",
      stylist: stylistName,
    },
    salon: {
      name: process.env.SALON_NAME || "SalonAI",
      phone: process.env.SALON_PHONE || "",
      address: process.env.SALON_ADDRESS || "",
    },
  };
}
