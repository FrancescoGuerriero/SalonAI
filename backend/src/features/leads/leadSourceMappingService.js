const CHANNELS = new Set([
  "web",
  "whatsapp",
  "sms",
  "phone",
  "email",
  "social",
  "google",
  "referral",
  "walk_in",
  "import",
  "api",
  "other",
]);

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function lower(value, max = 2000) {
  return text(value, max).toLowerCase();
}

function first(...values) {
  return values.find((value) => text(value)) ?? "";
}

function inferredChannel({ supplied, system, source, medium, googleClickId, metaClickId, microsoftClickId }) {
  const direct = lower(supplied, 80).replaceAll("-", "_");
  if (CHANNELS.has(direct)) return direct;

  const haystack = `${lower(system, 120)} ${lower(source, 160)} ${lower(medium, 120)}`;
  if (googleClickId || /\bgoogle\b|googleads|google_ads|adwords/.test(haystack)) return "google";
  if (metaClickId || /facebook|instagram|\bmeta\b|fb_ads|meta_ads/.test(haystack)) return "social";
  if (microsoftClickId || /\bbing\b|microsoft_ads|ms_ads/.test(haystack)) return "web";
  if (/whatsapp/.test(haystack)) return "whatsapp";
  if (/\bsms\b|text_message/.test(haystack)) return "sms";
  if (/email|newsletter/.test(haystack)) return "email";
  if (/phone|call/.test(haystack)) return "phone";
  if (/referral|refer_a_friend/.test(haystack)) return "referral";
  if (/walk[_ -]?in|kiosk/.test(haystack)) return "walk_in";
  if (/import|migration/.test(haystack)) return "import";
  if (/\bapi\b|partner/.test(haystack)) return "api";
  if (/website|web|organic|direct|seo|cpc|ppc|paid_search/.test(haystack)) return "web";
  return "other";
}

export function normaliseLeadAcquisitionPayload(payload = {}) {
  const input = payload && typeof payload === "object" ? payload : {};
  const suppliedSource = input.source && typeof input.source === "object" ? input.source : {};
  const acquisition = input.acquisition && typeof input.acquisition === "object"
    ? input.acquisition
    : {};

  const googleClickId = text(first(
    acquisition.googleClickId,
    acquisition.gclid,
    input.gclid,
    input.googleClickId,
    input.gbraid,
    input.wbraid
  ), 500);
  const metaClickId = text(first(
    acquisition.metaClickId,
    acquisition.fbclid,
    input.fbclid,
    input.metaClickId
  ), 500);
  const microsoftClickId = text(first(
    acquisition.microsoftClickId,
    acquisition.msclkid,
    input.msclkid,
    input.microsoftClickId
  ), 500);
  const rawSource = text(first(
    acquisition.source,
    acquisition.utmSource,
    input.utm_source,
    input.utmSource,
    suppliedSource.system,
    input.sourceSystem
  ), 160);
  const medium = text(first(
    acquisition.medium,
    acquisition.utmMedium,
    input.utm_medium,
    input.utmMedium,
    suppliedSource.medium,
    input.sourceMedium
  ), 120);
  const campaign = text(first(
    acquisition.campaign,
    acquisition.utmCampaign,
    input.utm_campaign,
    input.utmCampaign,
    suppliedSource.campaign,
    input.sourceCampaign
  ), 180);
  const system = lower(first(
    suppliedSource.system,
    input.sourceSystem,
    acquisition.system,
    googleClickId ? "google_ads" : "",
    metaClickId ? "meta_ads" : "",
    microsoftClickId ? "microsoft_ads" : "",
    rawSource
  ), 120);
  const channel = inferredChannel({
    supplied: first(suppliedSource.channel, input.sourceChannel, acquisition.channel),
    system,
    source: rawSource,
    medium,
    googleClickId,
    metaClickId,
    microsoftClickId,
  });
  const externalReference = text(first(
    suppliedSource.externalReference,
    input.externalReference,
    acquisition.externalReference,
    googleClickId,
    metaClickId,
    microsoftClickId
  ), 500);
  const term = text(first(acquisition.term, acquisition.utmTerm, input.utm_term, input.utmTerm), 300);
  const content = text(first(acquisition.content, acquisition.utmContent, input.utm_content, input.utmContent), 300);
  const landingPage = text(first(acquisition.landingPage, input.landingPage, input.pageUrl), 2000);
  const referrer = text(first(acquisition.referrer, input.referrer, input.referrerUrl), 2000);

  return {
    ...input,
    source: {
      ...suppliedSource,
      channel,
      system,
      campaign,
      medium,
      externalReference,
    },
    metadata: {
      ...(input.metadata && typeof input.metadata === "object" ? input.metadata : {}),
      acquisition: {
        source: rawSource,
        channel,
        system,
        campaign,
        medium,
        term,
        content,
        landingPage,
        referrer,
        googleClickId,
        metaClickId,
        microsoftClickId,
        externalReference,
        capturedAt: new Date().toISOString(),
      },
    },
  };
}

export function acquisitionSnapshotFromLead(lead) {
  const acquisition = lead?.metadata?.acquisition && typeof lead.metadata.acquisition === "object"
    ? lead.metadata.acquisition
    : {};
  return {
    channel: text(lead?.source?.channel || acquisition.channel || "other", 80),
    system: lower(lead?.source?.system || acquisition.system, 120),
    campaign: text(lead?.source?.campaign || acquisition.campaign, 180),
    medium: text(lead?.source?.medium || acquisition.medium, 120),
    term: text(acquisition.term, 300),
    content: text(acquisition.content, 300),
    landingPage: text(acquisition.landingPage, 2000),
    referrer: text(acquisition.referrer, 2000),
    googleClickId: text(acquisition.googleClickId, 500),
    metaClickId: text(acquisition.metaClickId, 500),
    microsoftClickId: text(acquisition.microsoftClickId, 500),
    externalReference: text(lead?.source?.externalReference || acquisition.externalReference, 500),
  };
}

export default {
  acquisitionSnapshotFromLead,
  normaliseLeadAcquisitionPayload,
};
