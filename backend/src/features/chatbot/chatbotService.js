const MAX_MESSAGE_LENGTH = 600;

const DEFAULT_QUICK_REPLIES = [
  "Book an appointment",
  "View services",
  "Meet the stylists",
  "Haircare advice",
];

function normaliseText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normaliseCatalogue(items = []) {
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

function money(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function stylistName(stylist = {}) {
  return normaliseText(
    stylist.name ||
      [stylist.firstName, stylist.lastName]
        .filter(Boolean)
        .join(" ")
  );
}

function includesAny(message, terms) {
  return terms.some((term) => message.includes(term));
}

export function validateChatbotMessage(value) {
  const message = normaliseText(value);

  if (!message) {
    const error = new Error("Please enter a message for the salon assistant.");
    error.statusCode = 400;
    error.status = 400;
    error.details = { field: "message" };
    throw error;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    const error = new Error(
      `Messages cannot exceed ${MAX_MESSAGE_LENGTH} characters.`
    );
    error.statusCode = 400;
    error.status = 400;
    error.details = { field: "message" };
    throw error;
  }

  return message;
}

export function classifyChatbotIntent(value) {
  const message = normaliseText(value).toLowerCase();

  if (includesAny(message, ["human", "person", "someone", "contact", "phone", "whatsapp"])) {
    return "contact";
  }

  if (includesAny(message, ["cancel", "reschedule", "change my appointment", "move my appointment"])) {
    return "manage_booking";
  }

  if (includesAny(message, ["book", "appointment", "availability", "available", "slot"] )) {
    return "booking";
  }

  if (includesAny(message, ["price", "prices", "cost", "how much"])) {
    return "prices";
  }

  if (includesAny(message, ["service", "services", "treatment", "cut", "colour", "color", "blow dry", "blow-dry"])) {
    return "services";
  }

  if (includesAny(message, ["stylist", "stylists", "hairdresser", "team", "specialist"])) {
    return "stylists";
  }

  if (includesAny(message, ["hair", "scalp", "breakage", "dry", "frizz", "routine", "product advice"])) {
    return "haircare";
  }

  if (includesAny(message, ["login", "log in", "account", "password", "sign in", "register"])) {
    return "account";
  }

  if (includesAny(message, ["shop", "product", "products", "order", "delivery", "cart"] )) {
    return "shop";
  }

  if (includesAny(message, ["gift", "loyalty", "points", "reward", "referral"])) {
    return "rewards";
  }

  if (/^(hello|hi|hey|good morning|good afternoon|good evening)\b/.test(message)) {
    return "greeting";
  }

  return "fallback";
}

function serviceSummary(services, includePrices) {
  if (!services.length) {
    return "The live service catalogue is not available yet. A salon team member can help you choose, or you can check again once the catalogue has been published.";
  }

  const rows = services.slice(0, 5).map((service) => {
    const details = [];
    const price = money(service.price);

    if (includePrices && price) {
      details.push(price);
    }

    if (Number(service.duration) > 0) {
      details.push(`${Number(service.duration)} min`);
    }

    return details.length
      ? `${normaliseText(service.name)} (${details.join(", ")})`
      : normaliseText(service.name);
  });

  return `Here are some services currently available: ${rows.join("; ")}.`;
}

function stylistSummary(stylists) {
  const names = stylists
    .map(stylistName)
    .filter(Boolean)
    .slice(0, 5);

  if (!names.length) {
    return "The active stylist list has not been published yet. Please check again soon or ask the salon team for help.";
  }

  return `Our active salon professionals include ${names.join(", ")}. Open the stylist page to view their specialties and choose the right person for your appointment.`;
}

export function buildChatbotResponse({
  message,
  services = [],
  stylists = [],
} = {}) {
  const safeMessage = validateChatbotMessage(message);
  const intent = classifyChatbotIntent(safeMessage);
  const activeServices = normaliseCatalogue(services);
  const activeStylists = normaliseCatalogue(stylists);

  const responses = {
    greeting: {
      reply:
        "Hello! I’m the SalonAI assistant. I can help you explore services, choose a stylist, start a booking, or find the right support page.",
      quickReplies: DEFAULT_QUICK_REPLIES,
      actions: [{ label: "Start booking", to: "/services" }],
    },
    booking: {
      reply:
        "You can book online in a few steps: choose a service, select an available stylist, pick a date and time, then confirm while signed in.",
      quickReplies: ["View services", "Meet the stylists", "Manage my appointment"],
      actions: [{ label: "Book now", to: "/services" }],
    },
    manage_booking: {
      reply:
        "To review an existing appointment, sign in and open My account. If you need to cancel or change a booking and the option is unavailable, contact the salon team through Help.",
      quickReplies: ["Open my account", "Contact the salon"],
      actions: [
        { label: "My account", to: "/account" },
        { label: "Get help", to: "/help" },
      ],
    },
    services: {
      reply: serviceSummary(activeServices, false),
      quickReplies: ["Show prices", "Meet the stylists", "Book an appointment"],
      actions: [{ label: "Browse all services", to: "/services" }],
    },
    prices: {
      reply: `${serviceSummary(activeServices, true)} The final price shown during booking is based on the selected service.`,
      quickReplies: ["Book an appointment", "Meet the stylists"],
      actions: [{ label: "View services and prices", to: "/services" }],
    },
    stylists: {
      reply: stylistSummary(activeStylists),
      quickReplies: ["View services", "Book an appointment"],
      actions: [{ label: "Meet the stylists", to: "/stylists" }],
    },
    haircare: {
      reply:
        "I can offer general guidance, but hair and scalp needs vary. Tell your stylist about chemical treatments, allergies, sensitivities, breakage, or scalp concerns before a service. For colour or chemical services, follow the salon’s consultation and patch-test guidance.",
      quickReplies: ["Book a consultation", "View services", "Contact the salon"],
      actions: [
        { label: "Explore services", to: "/services" },
        { label: "Get help", to: "/help" },
      ],
    },
    account: {
      reply:
        "Use Log in for an existing account or Create account if you are new. Once signed in, My account shows your salon activity and booking information.",
      quickReplies: ["Book an appointment", "Contact the salon"],
      actions: [
        { label: "Log in", to: "/login" },
        { label: "Create account", to: "/register" },
      ],
    },
    shop: {
      reply:
        "The SalonAI shop lets you browse available haircare products, add items to your cart, and complete checkout while signed in.",
      quickReplies: ["View services", "Book an appointment"],
      actions: [{ label: "Open the shop", to: "/shop" }],
    },
    rewards: {
      reply:
        "Rewards, gift cards, and referrals depend on what the salon has activated for customers. Your account is the best place to view benefits linked to you.",
      quickReplies: ["Open my account", "Contact the salon"],
      actions: [{ label: "My account", to: "/account" }],
    },
    contact: {
      reply:
        "For help from a person, open the Help centre. It explains the quickest support route without asking you to share private account or payment information in this chat.",
      quickReplies: ["Book an appointment", "View services"],
      actions: [{ label: "Contact and help", to: "/help" }],
    },
    fallback: {
      reply:
        "I can help with salon services, prices, stylists, bookings, haircare guidance, accounts, orders, and support. Choose one of the options below or ask a short question.",
      quickReplies: DEFAULT_QUICK_REPLIES,
      actions: [{ label: "Visit the Help centre", to: "/help" }],
    },
  };

  return {
    intent,
    ...responses[intent],
    disclaimer:
      "SalonAI provides booking guidance and general salon information, not medical advice.",
  };
}

export { DEFAULT_QUICK_REPLIES, MAX_MESSAGE_LENGTH };

export default {
  buildChatbotResponse,
  classifyChatbotIntent,
  validateChatbotMessage,
};
