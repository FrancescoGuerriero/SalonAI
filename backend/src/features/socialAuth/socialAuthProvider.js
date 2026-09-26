import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import jwt from "jsonwebtoken";

import { env } from "../../config/env.js";

const PROVIDERS = Object.freeze({
  google: {
    label: "Google",
    authorizeUrl:
      "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl:
      "https://oauth2.googleapis.com/token",
    profileUrl:
      "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  facebook: {
    label: "Facebook",
    scopes: ["email", "public_profile"],
  },
  microsoft: {
    label: "Microsoft",
    authorizeUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    profileUrl:
      "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
    scopes: [
      "openid",
      "profile",
      "email",
      "User.Read",
    ],
  },
  yahoo: {
    label: "Yahoo",
    authorizeUrl:
      "https://api.login.yahoo.com/oauth2/request_auth",
    tokenUrl:
      "https://api.login.yahoo.com/oauth2/get_token",
    profileUrl:
      "https://api.login.yahoo.com/openid/v1/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  linkedin: {
    label: "LinkedIn",
    authorizeUrl:
      "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl:
      "https://www.linkedin.com/oauth/v2/accessToken",
    profileUrl:
      "https://api.linkedin.com/v2/userinfo",
    scopes: ["openid", "profile", "email"],
  },
});

const SOCIAL_AUTH_TRANSACTION_TTL_MS =
  10 * 60 * 1000;

function socialAuthTransactionCookieName(
  provider,
  transactionId
) {
  if (!PROVIDERS[provider]) {
    const error = new Error(
      "Unsupported social sign-in provider."
    );
    error.statusCode = 400;
    throw error;
  }

  const id =
    text(
      transactionId
    );

  if (
    !/^[A-Za-z0-9_-]{16,128}$/.test(
      id
    )
  ) {
    const error = new Error(
      "Invalid social authentication transaction."
    );
    error.statusCode = 400;
    error.code =
      "INVALID_SOCIAL_AUTH_STATE";
    throw error;
  }

  return `salonai_social_auth_${provider}_${id}`;
}

export function socialAuthTransactionCookie(
  provider,
  transactionId
) {
  return {
    name:
      socialAuthTransactionCookieName(
        provider,
        transactionId
      ),
    options: {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path:
        `/api/auth/social/${provider}/callback`,
      maxAge:
        SOCIAL_AUTH_TRANSACTION_TTL_MS,
    },
  };
}

function browserBindingHash(value) {
  return createHash("sha256")
    .update(
      text(value),
      "utf8"
    )
    .digest("base64url");
}

function text(value) {
  return String(value ?? "").trim();
}

function providerSettings(provider) {
  const definition =
    PROVIDERS[provider];

  if (!definition) {
    const error = new Error(
      "Unsupported social sign-in provider."
    );
    error.statusCode = 400;
    throw error;
  }

  const prefix =
    `SOCIAL_${provider.toUpperCase()}_`;
  const clientId =
    text(
      process.env[
        `${prefix}CLIENT_ID`
      ]
    );
  const clientSecret =
    text(
      process.env[
        `${prefix}CLIENT_SECRET`
      ]
    );
  const redirectUri =
    text(
      process.env[
        `${prefix}REDIRECT_URI`
      ]
    );

  const facebookVersion =
    text(
      process.env
        .FACEBOOK_GRAPH_VERSION
    );

  const settings = {
    ...definition,
    provider,
    clientId,
    clientSecret,
    redirectUri,
  };

  if (
    provider === "facebook" &&
    facebookVersion
  ) {
    settings.authorizeUrl =
      `https://www.facebook.com/${facebookVersion}/dialog/oauth`;
    settings.tokenUrl =
      `https://graph.facebook.com/${facebookVersion}/oauth/access_token`;
    settings.profileUrl =
      `https://graph.facebook.com/${facebookVersion}/me?fields=id,name,email,picture.type(large)`;
  }

  settings.configured =
    Boolean(clientId) &&
    Boolean(clientSecret) &&
    Boolean(redirectUri) &&
    Boolean(settings.authorizeUrl) &&
    Boolean(settings.tokenUrl) &&
    Boolean(settings.profileUrl);

  return settings;
}

export function socialProviderAvailability() {
  return Object.keys(
    PROVIDERS
  ).map((provider) => {
    const settings =
      providerSettings(provider);

    return {
      provider,
      label:
        settings.label,
      configured:
        settings.configured,
    };
  });
}

function requireProvider(provider) {
  const settings =
    providerSettings(provider);

  if (!settings.configured) {
    const error = new Error(
      `${settings.label} sign-in is not configured for this SalonAI environment.`
    );
    error.statusCode = 503;
    error.code =
      "SOCIAL_PROVIDER_NOT_CONFIGURED";
    throw error;
  }

  return settings;
}

function safeReturnTo(value) {
  const path =
    text(value);

  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  ) {
    return "";
  }

  return path.slice(0, 500);
}

export function createSocialAuthorization({
  provider,
  returnTo = "",
  mode = "login",
  userId = "",
}) {
  const settings =
    requireProvider(provider);

  const browserBinding =
    randomBytes(32).toString(
      "base64url"
    );
  const transactionId =
    randomUUID();
  const transaction =
    socialAuthTransactionCookie(
      provider,
      transactionId
    );

  const state = jwt.sign(
    {
      provider,
      returnTo:
        safeReturnTo(returnTo),
      mode:
        mode === "link"
          ? "link"
          : "login",
      userId:
        mode === "link"
          ? text(userId)
          : "",
      tokenType:
        "social_auth_state",
      browserBindingHash:
        browserBindingHash(
          browserBinding
        ),
    },
    env.jwtSecret,
    {
      expiresIn: "10m",
      audience:
        "salonai-social-auth",
      issuer: "salonai",
      jwtid:
        transactionId,
    }
  );

  const params =
    new URLSearchParams({
      client_id:
        settings.clientId,
      redirect_uri:
        settings.redirectUri,
      response_type: "code",
      scope:
        settings.scopes.join(
          " "
        ),
      state,
    });

  if (
    provider === "google"
  ) {
    params.set(
      "prompt",
      "select_account"
    );
  }

  if (
    provider === "microsoft"
  ) {
    params.set(
      "response_mode",
      "query"
    );
  }

  return {
    provider,
    authorizationUrl:
      `${settings.authorizeUrl}?${params.toString()}`,
    transaction: {
      ...transaction,
      value:
        browserBinding,
    },
  };
}

export function verifySocialStateBrowserBinding(
  state,
  browserBinding
) {
  const expectedHash =
    text(
      state?.browserBindingHash
    );
  const actualBinding =
    text(
      browserBinding
    );

  if (
    !expectedHash ||
    !actualBinding
  ) {
    const error = new Error(
      "The social sign-in request is not bound to this browser or has already been used."
    );
    error.statusCode = 400;
    error.code =
      "SOCIAL_AUTH_BROWSER_BINDING_FAILED";
    throw error;
  }

  const actualHash =
    browserBindingHash(
      actualBinding
    );
  const expectedBuffer =
    Buffer.from(
      expectedHash,
      "utf8"
    );
  const actualBuffer =
    Buffer.from(
      actualHash,
      "utf8"
    );

  if (
    expectedBuffer.length !==
      actualBuffer.length ||
    !timingSafeEqual(
      expectedBuffer,
      actualBuffer
    )
  ) {
    const error = new Error(
      "The social sign-in request is not bound to this browser or has already been used."
    );
    error.statusCode = 400;
    error.code =
      "SOCIAL_AUTH_BROWSER_BINDING_FAILED";
    throw error;
  }

  return true;
}

export function readSocialState(
  value
) {
  try {
    const decoded =
      jwt.verify(
        text(value),
        env.jwtSecret,
        {
          audience:
            "salonai-social-auth",
          issuer: "salonai",
        }
      );

    if (
      decoded.tokenType !==
        "social_auth_state" ||
      !PROVIDERS[
        decoded.provider
      ]
    ) {
      throw new Error(
        "Invalid social state."
      );
    }

    return {
      provider:
        decoded.provider,
      returnTo:
        safeReturnTo(
          decoded.returnTo
        ),
      mode:
        decoded.mode === "link"
          ? "link"
          : "login",
      userId:
        text(
          decoded.userId
        ),
      browserBindingHash:
        text(
          decoded.browserBindingHash
        ),
      transactionId:
        text(
          decoded.jti
        ),
    };
  } catch {
    const error = new Error(
      "The social sign-in request is invalid or has expired."
    );
    error.statusCode = 400;
    error.code =
      "INVALID_SOCIAL_AUTH_STATE";
    throw error;
  }
}

async function responseJson(
  response
) {
  const payload =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload.error_description ||
        payload.error?.message ||
        payload.error ||
        "The identity provider request failed."
    );
    error.statusCode = 502;
    error.code =
      "SOCIAL_PROVIDER_REQUEST_FAILED";
    throw error;
  }

  return payload;
}

async function exchangeCode(
  settings,
  code
) {
  const params =
    new URLSearchParams({
      client_id:
        settings.clientId,
      client_secret:
        settings.clientSecret,
      redirect_uri:
        settings.redirectUri,
      code: text(code),
      grant_type:
        "authorization_code",
    });

  const response =
    settings.provider === "facebook"
      ? await fetch(
          settings.tokenUrl +
            "?" +
            params.toString()
        )
      : await fetch(
          settings.tokenUrl,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },
            body: params,
          }
        );

  const payload =
    await responseJson(
      response
    );

  const accessToken =
    text(
      payload.access_token
    );

  if (!accessToken) {
    throw new Error(
      "The identity provider did not return an access token."
    );
  }

  return accessToken;
}

async function loadProfile(
  settings,
  accessToken
) {
  const response =
    await fetch(
      settings.profileUrl,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );

  return responseJson(
    response
  );
}

export async function resolveSocialIdentity({
  provider,
  code,
}) {
  const settings =
    requireProvider(provider);
  const accessToken =
    await exchangeCode(
      settings,
      code
    );
  const profile =
    await loadProfile(
      settings,
      accessToken
    );

  if (
    provider ===
    "facebook"
  ) {
    return {
      provider,
      subject:
        text(profile.id),
      email:
        text(profile.email)
          .toLowerCase(),
      emailVerified: false,
      name:
        text(profile.name),
      pictureUrl:
        text(
          profile.picture
            ?.data?.url
        ),
    };
  }

  if (
    provider ===
    "microsoft"
  ) {
    return {
      provider,
      subject:
        text(profile.id),
      email:
        (
          text(profile.mail) ||
          text(
            profile.userPrincipalName
          )
        ).toLowerCase(),
      emailVerified: false,
      name:
        text(
          profile.displayName
        ),
      pictureUrl: "",
    };
  }

  return {
    provider,
    subject:
      text(profile.sub),
    email:
      text(profile.email)
        .toLowerCase(),
    emailVerified:
      profile.email_verified ===
        true ||
      profile.email_verified ===
        "true",
    name:
      text(
        profile.name ||
          profile.nickname
      ),
    pictureUrl:
      text(profile.picture),
  };
}

export function socialLinkFrontendRedirect({
  provider,
  status,
  returnTo = "/account/manage",
  code = "",
}) {
  const url = new URL(
    safeReturnTo(returnTo) ||
      "/account/manage",
    env.frontendUrl
  );

  url.searchParams.set(
    "socialLink",
    status
  );
  url.searchParams.set(
    "provider",
    provider
  );

  if (code) {
    url.searchParams.set(
      "socialCode",
      code
    );
  }

  return url.toString();
}

export function socialFrontendRedirect({
  provider,
  status,
  returnTo = "",
  code = "",
}) {
  const url = new URL(
    "/login",
    env.frontendUrl
  );

  url.searchParams.set(
    "social",
    status
  );
  url.searchParams.set(
    "provider",
    provider
  );

  if (
    safeReturnTo(returnTo)
  ) {
    url.searchParams.set(
      "returnTo",
      safeReturnTo(returnTo)
    );
  }

  if (code) {
    url.searchParams.set(
      "socialCode",
      code
    );
  }

  return url.toString();
}
