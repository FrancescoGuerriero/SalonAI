/*
 * Point 12 — Windsor-backed Marketing connector catalogue.
 *
 * This is product metadata, not an authentication contract. Windsor remains
 * authoritative for the live connector id/auth type/credential fields through
 * its list-connectors and connect-info APIs. Entries are deliberately grouped
 * by business task so the SaaS UI can expose a distinctive Marketing module
 * without presenting sources, sellers, destinations and AI destinations as the
 * same thing.
 */

export const WINDSOR_CONNECTOR_KINDS = Object.freeze([
  "source",
  "seller",
  "data-platform",
  "destination",
  "ai-destination",
]);

function item(key, label, category, kind = "source", aliases = []) {
  return Object.freeze({
    key,
    label,
    category,
    kind,
    aliases: Object.freeze([...new Set([key, ...aliases].map((value) => String(value).trim().toLowerCase()).filter(Boolean))]),
  });
}

const C = [
  item("activecampaign", "ActiveCampaign", "CRM & automation"),
  item("ahrefs", "Ahrefs", "SEO & competitive intelligence"),
  item("amazon_ads", "Amazon Ads", "Advertising"),
  item("amazon_dsp", "Amazon DSP", "Advertising"),
  item("amazon_redshift", "Amazon Redshift", "Data platforms", "data-platform", ["redshift"]),
  item("amazon_s3", "Amazon S3", "Data platforms", "data-platform", ["s3"]),
  item("amazon_sp", "Amazon Seller Central (Amazon SP)", "Sellers", "seller", ["amazon_seller_central"]),
  item("amazon_sqs", "Amazon SQS", "Data & developer infrastructure"),
  item("amazon_vendor", "Amazon Vendor Central", "Sellers", "seller", ["amazon_vendor_central"]),
  item("appfollow", "AppFollow", "App analytics & reputation"),
  item("apple_search_ads", "Apple Search Ads", "Advertising"),
  item("bing_webmaster", "Bing Webmaster Tools", "Analytics & search", "source", ["bing_webmaster_tools"]),
  item("bling", "Bling!", "Commerce & ERP", "source", ["bling_"] ),
  item("chatgpt", "ChatGPT", "AI destinations", "ai-destination"),
  item("claude", "Claude", "AI destinations", "ai-destination"),
  item("copilot_agent", "Copilot Agent", "AI destinations", "ai-destination", ["microsoft_copilot_agent"]),
  item("docker_hub", "Docker Hub", "Data & developer infrastructure"),
  item("exchange_rates", "Exchange Rates", "Finance & payments"),
  item("facebook", "Facebook Ads (Meta)", "Advertising", "source", ["facebook_ads", "meta_ads"]),
  item("facebook_lead_ads", "Facebook Lead Ads (Meta)", "Advertising"),
  item("facebook_page_insights", "Facebook Page Insights (Meta)", "Organic social", "source", ["facebook_pages"]),
  item("github", "GitHub", "Data & developer infrastructure"),
  item("gitlab", "GitLab", "Data & developer infrastructure"),
  item("google_ad_manager", "Google Ad Manager", "Advertising"),
  item("google_ads", "Google Ads", "Advertising"),
  item("ga4", "Google Analytics 4", "Analytics & search", "source", ["google_analytics_4", "google_analytics"]),
  item("google_bigquery", "Google BigQuery", "Data platforms", "data-platform", ["bigquery"]),
  item("google_campaign_manager_360", "Google Campaign Manager 360 (CM360)", "Advertising", "source", ["cm360"]),
  item("google_display_video_360", "Google Display & Video 360 (DV360)", "Advertising", "source", ["dv360"]),
  item("google_merchant_center", "Google Merchant Center", "Commerce & marketplaces"),
  item("google_business_profile", "Google My Business", "Local & reputation", "source", ["google_my_business"]),
  item("google_pagespeed_insights", "Google PageSpeed Insights", "Analytics & search"),
  item("google_search_ads_360", "Google Search Ads 360 (SA360)", "Advertising", "source", ["sa360"]),
  item("google_search_console", "Google Search Console", "Analytics & search"),
  item("google_sheets", "Google Sheets", "Data platforms", "data-platform"),
  item("google_webfonts", "Google Webfonts", "Web & content"),
  item("gravity_forms", "Gravity Forms", "CRM & automation"),
  item("hubspot", "HubSpot", "CRM & automation"),
  item("instagram_insights", "Instagram Insights", "Organic social", "source", ["instagram_organic"]),
  item("instagram_public_data", "Instagram Public Data", "Organic social"),
  item("klaviyo", "Klaviyo", "CRM & automation"),
  item("linkedin", "LinkedIn Ads", "Advertising", "source", ["linkedin_ads"]),
  item("linkedin_pages", "LinkedIn Pages", "Organic social"),
  item("mailersend", "MailerSend", "CRM & automation"),
  item("microsoft_ads", "Microsoft Ads (Bing Ads)", "Advertising", "source", ["bing_ads"]),
  item("microsoft_clarity", "Microsoft Clarity", "Analytics & search"),
  item("microsoft_dataverse", "Microsoft Dataverse", "Data platforms", "data-platform", ["dataverse"]),
  item("microsoft_dynamics_365", "Microsoft Dynamics 365", "CRM & automation", "source", ["dynamics_365"]),
  item("microsoft_teams", "Microsoft Teams", "Communications & collaboration"),
  item("mixpanel", "Mixpanel", "Analytics & search"),
  item("mntn", "MNTN (mountain.com)", "Advertising", "source", ["mountain"]),
  item("monday", "Monday", "Work management", "source", ["monday_com"]),
  item("mongodb", "MongoDB", "Data platforms", "data-platform"),
  item("mysql", "MySQL", "Data platforms", "data-platform"),
  item("openai_ads", "OpenAI Ads / ChatGPT Ads", "Advertising"),
  item("paypal", "Paypal Transaction", "Finance & payments", "source", ["paypal_transactions"]),
  item("pinterest_ads", "Pinterest Ads", "Advertising"),
  item("pinterest_organic", "Pinterest Organic", "Organic social"),
  item("power_bi", "Power BI", "BI destinations", "destination", ["powerbi"]),
  item("quickbooks", "QuickBooks", "Finance & payments"),
  item("quora_ads", "Quora Ads", "Advertising"),
  item("rakuten_advertising", "Rakuten Advertising", "Advertising", "source", ["rakuten"]),
  item("reddit_ads", "Reddit Ads", "Advertising"),
  item("reply_io", "Reply.io", "CRM & automation"),
  item("rocket_chat", "Rocket.Chat", "Communications & collaboration"),
  item("rss", "RSS", "Web & content"),
  item("salesforce", "Salesforce", "CRM & automation"),
  item("salesforce_marketing_cloud", "Salesforce Marketing Cloud", "CRM & automation"),
  item("semrush", "Semrush", "SEO & competitive intelligence"),
  item("sendgrid", "SendGrid", "CRM & automation"),
  item("shopee_ads", "Shopee Ads", "Advertising"),
  item("shopify", "Shopify", "Commerce & marketplaces"),
  item("slack", "Slack", "Communications & collaboration"),
  item("snapchat_ads", "Snapchat Ads", "Advertising"),
  item("spotify_ads", "Spotify Ads", "Advertising"),
  item("square", "Square", "Finance & payments"),
  item("stripe", "Stripe", "Finance & payments"),
  item("survey_sparrow", "Survey Sparrow", "Surveys & voice of customer", "source", ["surveysparrow"]),
  item("surveymonkey", "Surveymonkey", "Surveys & voice of customer", "source", ["survey_monkey"]),
  item("threads", "Threads", "Organic social"),
  item("tiktok_ads", "TikTok Ads", "Advertising"),
  item("tiktok_organic", "TikTok Organic", "Organic social"),
  item("tiktok_shop", "TikTok Shop", "Sellers", "seller"),
  item("twilio", "Twilio", "Communications & collaboration"),
  item("twilio_taskrouter", "Twilio TaskRouter", "Communications & collaboration"),
  item("twitter_ads", "Twitter Ads", "Advertising", "source", ["x_ads"]),
  item("twitter_organic", "Twitter Organic (Legacy)", "Organic social", "source", ["twitter_organic_legacy"]),
  item("xero", "Xero", "Finance & payments"),
  item("yahoo_finance", "Yahoo! Finance Price", "Finance & markets", "source", ["yahoo_finance_price"]),
  item("yahoo_japan", "Yahoo! Japan", "Advertising"),
  item("yandex_metrica", "Yandex Metrica", "Analytics & search"),
  item("yotpo", "Yotpo", "Local & reputation"),
  item("youtube", "Youtube", "Organic social", "source", ["youtube_analytics"]),
  item("zoho_crm", "Zoho CRM", "CRM & automation"),
  item("zoom", "Zoom", "Communications & collaboration"),
  item("ebay", "eBay", "Sellers", "seller"),
];

export const WINDSOR_MARKETING_CONNECTORS = Object.freeze(C);

const BY_KEY = new Map(C.map((entry) => [entry.key, entry]));

export function windsorMarketingConnector(key) {
  return BY_KEY.get(String(key || "").trim().toLowerCase()) || null;
}

export function listWindsorMarketingConnectors({ kind = "", category = "" } = {}) {
  const wantedKind = String(kind || "").trim().toLowerCase();
  const wantedCategory = String(category || "").trim().toLowerCase();
  return C.filter((entry) =>
    (!wantedKind || entry.kind === wantedKind) &&
    (!wantedCategory || entry.category.toLowerCase() === wantedCategory)
  );
}

export default WINDSOR_MARKETING_CONNECTORS;
