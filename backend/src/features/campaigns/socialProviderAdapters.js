import { createServiceError } from "../../shared/serviceError.js";
import { resolveProviderCredential } from "../integrationPlatform/providerCredentialService.js";

const META_GRAPH_BASE = "https://graph.facebook.com";
const LINKEDIN_POSTS_ENDPOINT = "https://api.linkedin.com/rest/posts";
const GOOGLE_BUSINESS_BASE = "https://mybusiness.googleapis.com/v4";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

function text(value, max = 10000) {
  return String(value ?? "").trim().slice(0, max);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(60000, retryAfter * 1000);
  }
  return Math.min(15000, 1000 * (2 ** attempt));
}

function httpsUrl(value, field, { optional = true } = {}) {
  const raw = text(value, 3000);
  if (!raw && optional) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") throw new Error("HTTPS required");
    return url.toString();
  } catch {
    throw createServiceError(`${field} must be a public HTTPS URL.`, 400, { field });
  }
}

function requiredMetadata(connection, key, label = key) {
  const value = text(connection?.metadata?.[key], 1000);
  if (!value) {
    throw createServiceError(`${label} is required in integration connection metadata.`, 409, {
      code: "SOCIAL_PROVIDER_METADATA_REQUIRED",
      field: key,
    });
  }
  return value;
}

function metaVersion(connection) {
  const value = text(connection?.metadata?.apiVersion || process.env.META_GRAPH_API_VERSION, 20);
  if (!/^v\d+\.\d+$/.test(value)) {
    throw createServiceError(
      "A current Meta Graph API version is required before live publishing.",
      409,
      { code: "META_GRAPH_API_VERSION_REQUIRED" }
    );
  }
  return value;
}

function linkedinVersion(connection) {
  const value = text(connection?.metadata?.apiVersion || process.env.LINKEDIN_API_VERSION, 20);
  if (!/^\d{6}$/.test(value)) {
    throw createServiceError(
      "A current LinkedIn API version in YYYYMM format is required before live publishing.",
      409,
      { code: "LINKEDIN_API_VERSION_REQUIRED" }
    );
  }
  return value;
}

async function requestJson(url, options = {}, { retries = MAX_RETRIES } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const raw = await response.text();
      let body = {};
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = { raw: text(raw, 2000) };
        }
      }
      if (response.ok) return { response, body };

      const retryable = response.status === 429 || response.status >= 500;
      const error = createServiceError(
        `Social provider request failed with HTTP ${response.status}.`,
        response.status,
        {
          code: "SOCIAL_PROVIDER_HTTP_ERROR",
          providerStatus: response.status,
          providerBody: body,
        }
      );
      if (!retryable || attempt >= retries) throw error;
      lastError = error;
      await delay(retryDelay(response, attempt));
    } catch (error) {
      if (error?.name === "AbortError") {
        lastError = createServiceError("Social provider request timed out.", 504, {
          code: "SOCIAL_PROVIDER_TIMEOUT",
        });
      } else {
        lastError = error;
      }
      if (
        attempt >= retries ||
        (lastError?.statusCode && lastError.statusCode < 500 && lastError.statusCode !== 429)
      ) {
        throw lastError;
      }
      await delay(Math.min(15000, 1000 * (2 ** attempt)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || createServiceError("Social provider request failed.", 502);
}

async function accessToken(connection) {
  return (await resolveProviderCredential(connection, "access_token")).secret;
}

async function publishFacebook(connection, publication) {
  const token = await accessToken(connection);
  const pageId = requiredMetadata(connection, "pageId", "Facebook Page ID");
  const version = metaVersion(connection);
  const content = publication.content || {};
  const message = text(content.text, 10000);
  const link = httpsUrl(content.linkUrl, "content.linkUrl");
  const media = httpsUrl(content.mediaUrl, "content.mediaUrl");

  if (content.mediaType === "video" || content.mediaType === "document") {
    throw createServiceError(
      "Facebook video/document publishing requires the dedicated asset-upload workflow.",
      409,
      { code: "SOCIAL_PROVIDER_MEDIA_WORKFLOW_REQUIRED" }
    );
  }

  const form = new URLSearchParams();
  if (message) form.set(content.mediaType === "image" && media ? "caption" : "message", message);
  if (link && !(content.mediaType === "image" && media)) form.set("link", link);

  let endpoint = `${META_GRAPH_BASE}/${version}/${encodeURIComponent(pageId)}/feed`;
  if (content.mediaType === "image" && media) {
    endpoint = `${META_GRAPH_BASE}/${version}/${encodeURIComponent(pageId)}/photos`;
    form.set("url", media);
  }

  const { body } = await requestJson(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const externalPostId = text(body.post_id || body.id, 1000);
  if (!externalPostId) {
    throw createServiceError("Facebook did not return a post identifier.", 502, {
      code: "SOCIAL_PROVIDER_ID_MISSING",
    });
  }
  return {
    externalPostId,
    externalPostUrl: "",
    providerMetadata: { responseId: externalPostId },
  };
}

async function waitForInstagramContainer(connection, version, containerId, token) {
  const maxChecks = 12;
  for (let attempt = 0; attempt < maxChecks; attempt += 1) {
    const url = new URL(
      `${META_GRAPH_BASE}/${version}/${encodeURIComponent(containerId)}`
    );
    url.searchParams.set("fields", "status_code,status");
    const { body } = await requestJson(url.toString(), {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    }, { retries: 1 });
    const status = text(body.status_code || body.status, 100).toUpperCase();
    if (["FINISHED", "PUBLISHED"].includes(status)) return body;
    if (["ERROR", "EXPIRED"].includes(status)) {
      throw createServiceError("Instagram media container failed before publication.", 502, {
        code: "INSTAGRAM_CONTAINER_FAILED",
        providerBody: body,
      });
    }
    await delay(Math.min(5000, 1000 + attempt * 250));
  }
  throw createServiceError("Instagram media container was not ready in time.", 504, {
    code: "INSTAGRAM_CONTAINER_NOT_READY",
  });
}

async function publishInstagram(connection, publication) {
  const token = await accessToken(connection);
  const accountId = requiredMetadata(
    connection,
    "instagramProfessionalAccountId",
    "Instagram professional account ID"
  );
  const version = metaVersion(connection);
  const content = publication.content || {};
  const media = httpsUrl(content.mediaUrl, "content.mediaUrl", { optional: false });
  const mediaType = text(content.mediaType, 30).toLowerCase();
  if (!new Set(["image", "video"]).has(mediaType)) {
    throw createServiceError("Instagram publishing requires image or video media.", 400, {
      code: "INSTAGRAM_MEDIA_REQUIRED",
    });
  }

  const form = new URLSearchParams();
  form.set(mediaType === "video" ? "video_url" : "image_url", media);
  if (content.text) form.set("caption", text(content.text, 2200));
  if (content.altText && mediaType === "image") form.set("alt_text", text(content.altText, 1000));
  if (mediaType === "video") {
    form.set("media_type", "REELS");
    form.set("share_to_feed", "true");
  }

  const { body: container } = await requestJson(
    `${META_GRAPH_BASE}/${version}/${encodeURIComponent(accountId)}/media`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );
  const containerId = text(container.id, 1000);
  if (!containerId) {
    throw createServiceError("Instagram did not return a media container identifier.", 502, {
      code: "INSTAGRAM_CONTAINER_ID_MISSING",
    });
  }

  await waitForInstagramContainer(connection, version, containerId, token);
  const publishForm = new URLSearchParams({ creation_id: containerId });
  const { body } = await requestJson(
    `${META_GRAPH_BASE}/${version}/${encodeURIComponent(accountId)}/media_publish`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: publishForm.toString(),
    }
  );
  const externalPostId = text(body.id, 1000);
  if (!externalPostId) {
    throw createServiceError("Instagram did not return a published media identifier.", 502, {
      code: "SOCIAL_PROVIDER_ID_MISSING",
    });
  }
  return {
    externalPostId,
    externalPostUrl: "",
    providerMetadata: { containerId, responseId: externalPostId },
  };
}

async function publishLinkedIn(connection, publication) {
  const token = await accessToken(connection);
  const author = requiredMetadata(connection, "authorUrn", "LinkedIn author URN");
  const version = linkedinVersion(connection);
  const content = publication.content || {};
  if (content.mediaType && content.mediaType !== "none") {
    throw createServiceError(
      "LinkedIn media publishing requires a registered LinkedIn media/document asset.",
      409,
      { code: "SOCIAL_PROVIDER_MEDIA_WORKFLOW_REQUIRED" }
    );
  }

  const { response, body } = await requestJson(LINKEDIN_POSTS_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-restli-protocol-version": "2.0.0",
      "linkedin-version": version,
    },
    body: JSON.stringify({
      author,
      commentary: text(content.text, 3000),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  const externalPostId = text(
    response.headers.get("x-restli-id") || body.id,
    1000
  );
  if (!externalPostId) {
    throw createServiceError("LinkedIn did not return a post identifier.", 502, {
      code: "SOCIAL_PROVIDER_ID_MISSING",
    });
  }
  return {
    externalPostId,
    externalPostUrl: "",
    providerMetadata: { responseId: externalPostId },
  };
}

async function publishGoogleBusinessProfile(connection, publication) {
  const token = await accessToken(connection);
  const accountId = requiredMetadata(connection, "accountId", "Google Business Profile account ID");
  const locationId = requiredMetadata(connection, "locationId", "Google Business Profile location ID");
  const content = publication.content || {};
  const media = httpsUrl(content.mediaUrl, "content.mediaUrl");

  const bodyPayload = {
    languageCode: text(content.languageCode || "en-GB", 20),
    summary: text(content.text, 1500),
    topicType: "STANDARD",
  };
  if (media) {
    bodyPayload.media = [{ mediaFormat: "PHOTO", sourceUrl: media }];
  }

  const { body } = await requestJson(
    `${GOOGLE_BUSINESS_BASE}/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/localPosts`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    }
  );

  const externalPostId = text(body.name, 1000);
  if (!externalPostId) {
    throw createServiceError("Google Business Profile did not return a local-post identifier.", 502, {
      code: "SOCIAL_PROVIDER_ID_MISSING",
    });
  }
  return {
    externalPostId,
    externalPostUrl: text(body.searchUrl, 3000),
    providerMetadata: {
      state: text(body.state, 100),
      createTime: body.createTime || null,
    },
  };
}

export async function publishSocialProvider(connection, publication) {
  switch (publication.channel) {
    case "facebook":
      return publishFacebook(connection, publication);
    case "instagram":
      return publishInstagram(connection, publication);
    case "linkedin":
      return publishLinkedIn(connection, publication);
    case "google_business_profile":
      return publishGoogleBusinessProfile(connection, publication);
    default:
      throw createServiceError(
        `Social publishing is not implemented for channel: ${publication.channel}.`,
        409,
        { code: "SOCIAL_PROVIDER_EXECUTOR_NOT_AVAILABLE" }
      );
  }
}

export const SOCIAL_PROVIDER_ENDPOINTS = Object.freeze({
  metaGraph: META_GRAPH_BASE,
  linkedinPosts: LINKEDIN_POSTS_ENDPOINT,
  googleBusinessProfile: GOOGLE_BUSINESS_BASE,
});

export default {
  SOCIAL_PROVIDER_ENDPOINTS,
  publishSocialProvider,
};
