import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

import { env } from "../../config/env.js";

const GOOGLE_SCOPES = Object.freeze([
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
]);

const OUTLOOK_SCOPES = Object.freeze([
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
]);

function text(value) {
  return String(value ?? "").trim();
}

function providerConfig(provider) {
  if (provider === "google") {
    return {
      provider,
      enabled:
        Boolean(text(process.env.GOOGLE_CALENDAR_CLIENT_ID)) &&
        Boolean(text(process.env.GOOGLE_CALENDAR_CLIENT_SECRET)) &&
        Boolean(text(process.env.GOOGLE_CALENDAR_REDIRECT_URI)),
      clientId: text(process.env.GOOGLE_CALENDAR_CLIENT_ID),
      clientSecret: text(process.env.GOOGLE_CALENDAR_CLIENT_SECRET),
      redirectUri: text(process.env.GOOGLE_CALENDAR_REDIRECT_URI),
      authorizeUrl:
        "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl:
        "https://oauth2.googleapis.com/token",
      profileUrl:
        "https://openidconnect.googleapis.com/v1/userinfo",
      scopes: GOOGLE_SCOPES,
    };
  }

  if (provider === "outlook") {
    const tenant =
      text(process.env.MICROSOFT_CALENDAR_TENANT) ||
      "common";

    return {
      provider,
      enabled:
        Boolean(text(process.env.MICROSOFT_CALENDAR_CLIENT_ID)) &&
        Boolean(text(process.env.MICROSOFT_CALENDAR_CLIENT_SECRET)) &&
        Boolean(text(process.env.MICROSOFT_CALENDAR_REDIRECT_URI)),
      clientId: text(process.env.MICROSOFT_CALENDAR_CLIENT_ID),
      clientSecret: text(process.env.MICROSOFT_CALENDAR_CLIENT_SECRET),
      redirectUri: text(process.env.MICROSOFT_CALENDAR_REDIRECT_URI),
      authorizeUrl:
        `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenUrl:
        `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      profileUrl:
        "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
      scopes: OUTLOOK_SCOPES,
    };
  }

  const error = new Error(
    `Unsupported calendar provider: ${provider}`
  );
  error.statusCode = 400;
  throw error;
}

function requireConfigured(provider) {
  const config = providerConfig(provider);

  if (!config.enabled) {
    const error = new Error(
      `${provider === "google" ? "Google Calendar" : "Microsoft Outlook"} connection is not configured for this SalonAI environment.`
    );
    error.statusCode = 503;
    error.code = "CALENDAR_PROVIDER_NOT_CONFIGURED";
    throw error;
  }

  return config;
}

export function providerAvailability() {
  return ["google", "outlook"].map(
    (provider) => {
      const config = providerConfig(provider);
      return {
        provider,
        configured: config.enabled,
      };
    }
  );
}

export function createCalendarAuthorization({
  provider,
  userId,
}) {
  const config = requireConfigured(provider);

  const state = jwt.sign(
    {
      sub: String(userId),
      provider,
      tokenType: "calendar_oauth_state",
    },
    env.jwtSecret,
    {
      expiresIn: "10m",
      audience: "salonai-calendar-oauth",
      issuer: "salonai",
      jwtid:
        randomUUID(),
    }
  );

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
  });

  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("include_granted_scopes", "true");
    params.set("prompt", "consent");
  } else {
    params.set("response_mode", "query");
  }

  return {
    provider,
    authorizationUrl:
      `${config.authorizeUrl}?${params.toString()}`,
  };
}

export function readCalendarOAuthState(state) {
  try {
    const decoded = jwt.verify(
      String(state || ""),
      env.jwtSecret,
      {
        audience: "salonai-calendar-oauth",
        issuer: "salonai",
      }
    );

    if (
      decoded.tokenType !== "calendar_oauth_state" ||
      !["google", "outlook"].includes(decoded.provider) ||
      !decoded.sub
    ) {
      throw new Error("Invalid calendar OAuth state.");
    }

    return decoded;
  } catch {
    const error = new Error(
      "The external calendar connection request is invalid or has expired."
    );
    error.statusCode = 400;
    error.code = "INVALID_CALENDAR_OAUTH_STATE";
    throw error;
  }
}

async function parseJson(response) {
  const body = await response.json().catch(
    () => ({})
  );

  if (!response.ok) {
    const error = new Error(
      body.error_description ||
        body.error?.message ||
        body.error ||
        "External calendar provider request failed."
    );
    error.statusCode = 502;
    error.code = "CALENDAR_PROVIDER_REQUEST_FAILED";
    throw error;
  }

  return body;
}

export async function exchangeCalendarAuthorizationCode({
  provider,
  code,
}) {
  const config = requireConfigured(provider);

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: text(code),
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const token = await parseJson(
    await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: params,
    })
  );

  const accessToken = text(token.access_token);

  if (!accessToken) {
    throw new Error(
      "Calendar provider did not return an access token."
    );
  }

  const profile = await parseJson(
    await fetch(config.profileUrl, {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
    })
  );

  return {
    accessToken,
    refreshToken:
      text(token.refresh_token),
    expiresIn:
      Number(token.expires_in) || 3600,
    scopes:
      text(token.scope)
        .split(" ")
        .filter(Boolean),
    account:
      provider === "google"
        ? {
            id: text(profile.sub),
            email: text(profile.email),
            name: text(profile.name),
          }
        : {
            id: text(profile.id),
            email:
              text(profile.mail) ||
              text(profile.userPrincipalName),
            name: text(profile.displayName),
          },
  };
}

export function calendarFrontendRedirect({
  provider,
  status,
}) {
  const url = new URL(
    "/calendar",
    env.frontendUrl
  );

  url.searchParams.set(
    "calendarProvider",
    provider
  );
  url.searchParams.set(
    "calendarConnection",
    status
  );

  return url.toString();
}
