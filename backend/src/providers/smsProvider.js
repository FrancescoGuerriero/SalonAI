import twilio from "twilio";

const SIMULATED_MODES = new Set([
  "mock",
  "console",
  "demo",
  "sandbox",
]);

function text(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function boolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["true", "1", "yes", "on", "enabled"].includes(lower(value));
}

function deliveryEnabled() {
  return boolean(process.env.SMS_DELIVERY_ENABLED, false);
}

function globalDeliveryMode() {
  const mode = lower(process.env.MESSAGE_DELIVERY_MODE);

  if (!mode || SIMULATED_MODES.has(mode)) {
    return "sandbox";
  }

  return mode;
}

function providerMode() {
  const provider = lower(process.env.SMS_PROVIDER);

  if (provider) {
    return provider;
  }

  const legacyMode = lower(process.env.SMS_PROVIDER_MODE);

  if (!legacyMode) {
    return "console";
  }

  if (SIMULATED_MODES.has(legacyMode)) {
    return "console";
  }

  if (["twilio", "live"].includes(legacyMode)) {
    return "twilio";
  }

  return legacyMode;
}

function simulatedResult({ to, message }) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[SalonAI SMS:console]", {
      to,
      message,
    });
  }

  return {
    provider: "console",
    status: "mocked",
    delivered: false,
    messageId: `console_sms_${Date.now()}`,
  };
}

function twilioConfiguration() {
  return {
    accountSid: text(process.env.TWILIO_ACCOUNT_SID),
    authToken: text(process.env.TWILIO_AUTH_TOKEN),
    fromNumber: text(
      process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_SMS_FROM
    ),
    messagingServiceSid: text(process.env.TWILIO_MESSAGING_SERVICE_SID),
    statusCallbackUrl: text(process.env.TWILIO_STATUS_CALLBACK_URL),
  };
}

function assertTwilioConfiguration(config) {
  if (!config.accountSid || !config.authToken) {
    throw new Error(
      "Twilio SMS delivery is enabled but TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are not fully configured."
    );
  }

  if (!config.fromNumber && !config.messagingServiceSid) {
    throw new Error(
      "Twilio SMS delivery requires TWILIO_FROM_NUMBER/TWILIO_SMS_FROM or TWILIO_MESSAGING_SERVICE_SID."
    );
  }
}

export async function sendSms({ to, message }) {
  const provider = providerMode();
  const mode = globalDeliveryMode();
  const enabled = deliveryEnabled();
  const simulated =
    mode === "sandbox" ||
    SIMULATED_MODES.has(provider) ||
    provider === "console";

  if (!enabled) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Real SMS delivery is disabled in production. Set SMS_DELIVERY_ENABLED=true only after configuring Twilio."
      );
    }

    return simulatedResult({ to, message });
  }

  if (simulated) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Production SMS delivery cannot use mock, console or sandbox mode. Set SMS_PROVIDER=twilio and MESSAGE_DELIVERY_MODE=live."
      );
    }

    return simulatedResult({ to, message });
  }

  if (provider !== "twilio") {
    throw new Error(
      "SMS_PROVIDER must be twilio for live SMS delivery."
    );
  }

  if (mode !== "live") {
    throw new Error(
      "Live SMS delivery requires MESSAGE_DELIVERY_MODE=live."
    );
  }

  const config = twilioConfiguration();
  assertTwilioConfiguration(config);

  const client = twilio(
    config.accountSid,
    config.authToken
  );

  const payload = {
    to,
    body: message,
  };

  if (config.messagingServiceSid) {
    payload.messagingServiceSid = config.messagingServiceSid;
  } else {
    payload.from = config.fromNumber;
  }

  if (config.statusCallbackUrl) {
    payload.statusCallback = config.statusCallbackUrl;
  }

  const result = await client.messages.create(payload);

  return {
    provider: "twilio",
    status: result.status || "queued",
    delivered: result.status === "delivered",
    messageId: result.sid,
  };
}