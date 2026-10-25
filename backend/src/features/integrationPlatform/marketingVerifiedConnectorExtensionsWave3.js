export const VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE3 = Object.freeze({
  quickbooks: Object.freeze({
    key: "quickbooks",
    label: "QuickBooks",
    category: "Finance & payments",
    description: "Connect QuickBooks Online using an OAuth access token and Company/realm ID and verify access with a read-only company query.",
    documentationUrl: "https://developer.intuit.com/app/developer/qbo/docs/get-started",
    fields: [
      { key: "realmId", label: "QuickBooks Company / realm ID", required: true, secret: false, placeholder: "1234567890" },
      { key: "environment", label: "Environment", required: true, secret: false, placeholder: "production", help: "Use production or sandbox." },
    ],
    credentials: [
      { key: "accessToken", label: "QuickBooks OAuth access token", role: "access_token", required: true, secret: true },
      { key: "refreshToken", label: "QuickBooks OAuth refresh token", role: "refresh_token", required: false, secret: true },
    ],
    scopes: ["com.intuit.quickbooks.accounting"],
  }),
  xero: Object.freeze({
    key: "xero",
    label: "Xero",
    category: "Finance & payments",
    description: "Connect Xero using OAuth 2.0 and verify the tenant list through the official connections endpoint.",
    documentationUrl: "https://developer.xero.com/documentation/guides/oauth2/tenants/",
    fields: [
      { key: "clientId", label: "Xero client ID", required: true, secret: false, placeholder: "" },
    ],
    credentials: [
      { key: "clientSecret", label: "Xero client secret", role: "client_secret", required: true, secret: true },
      { key: "refreshToken", label: "Xero OAuth refresh token", role: "refresh_token", required: true, secret: true },
      { key: "accessToken", label: "Xero OAuth access token", role: "access_token", required: false, secret: true },
    ],
    scopes: ["offline_access", "accounting.settings.read"],
  }),
  zoho_crm: Object.freeze({
    key: "zoho_crm",
    label: "Zoho CRM",
    category: "CRM & automation",
    description: "Connect Zoho CRM with OAuth and verify the authorised CRM organization using the Organization API v8.",
    documentationUrl: "https://www.zoho.com/crm/developer/docs/api/v8/get-org-data.html",
    fields: [
      { key: "clientId", label: "Zoho client ID", required: true, secret: false, placeholder: "" },
      { key: "accountsDomain", label: "Zoho Accounts domain", required: true, secret: false, placeholder: "https://accounts.zoho.com" },
    ],
    credentials: [
      { key: "clientSecret", label: "Zoho client secret", role: "client_secret", required: true, secret: true },
      { key: "refreshToken", label: "Zoho CRM refresh token", role: "refresh_token", required: true, secret: true },
      { key: "accessToken", label: "Zoho CRM access token", role: "access_token", required: false, secret: true },
    ],
    scopes: ["ZohoCRM.org.READ"],
  }),
  mailersend: Object.freeze({
    key: "mailersend",
    label: "MailerSend",
    category: "CRM & automation",
    description: "Connect MailerSend with an API token and verify read access through the Domains API.",
    documentationUrl: "https://developers.mailersend.com/api/v1/email/domains",
    fields: [],
    credentials: [
      { key: "apiKey", label: "MailerSend API token", role: "api_key", required: true, secret: true },
    ],
    scopes: ["domains:read"],
  }),
  surveymonkey: Object.freeze({
    key: "surveymonkey",
    label: "SurveyMonkey",
    category: "Surveys & voice of customer",
    description: "Connect SurveyMonkey with an OAuth access token and verify the current user with /v3/users/me.",
    documentationUrl: "https://api.surveymonkey.com/v3/docs",
    fields: [],
    credentials: [
      { key: "accessToken", label: "SurveyMonkey OAuth access token", role: "access_token", required: true, secret: true },
      { key: "refreshToken", label: "SurveyMonkey refresh token", role: "refresh_token", required: false, secret: true },
    ],
    scopes: ["users_read"],
  }),
  rocket_chat: Object.freeze({
    key: "rocket_chat",
    label: "Rocket.Chat",
    category: "Communications & collaboration",
    description: "Connect a Rocket.Chat workspace with a user ID and personal access token and verify it with /api/v1/me.",
    documentationUrl: "https://developer.rocket.chat/apidocs/authenticate-a-rest-client",
    fields: [
      { key: "workspaceUrl", label: "Rocket.Chat workspace URL", required: true, secret: false, placeholder: "https://chat.example.com" },
      { key: "userId", label: "Rocket.Chat user ID", required: true, secret: false, placeholder: "" },
    ],
    credentials: [
      { key: "accessToken", label: "Rocket.Chat personal access token", role: "access_token", required: true, secret: true },
    ],
    scopes: ["user:read"],
  }),
  microsoft_teams: Object.freeze({
    key: "microsoft_teams",
    label: "Microsoft Teams",
    category: "Communications & collaboration",
    description: "Connect Microsoft Teams through a delegated Microsoft Graph OAuth token and verify the signed-in user with Graph /me.",
    documentationUrl: "https://learn.microsoft.com/en-us/graph/call-api",
    fields: [],
    credentials: [
      { key: "accessToken", label: "Microsoft Graph OAuth access token", role: "access_token", required: true, secret: true },
      { key: "refreshToken", label: "Microsoft OAuth refresh token", role: "refresh_token", required: false, secret: true },
    ],
    scopes: ["User.Read", "Team.ReadBasic.All"],
  }),
  microsoft_dataverse: Object.freeze({
    key: "microsoft_dataverse",
    label: "Microsoft Dataverse",
    category: "Data & warehouse",
    description: "Connect a Dataverse environment with an OAuth token and verify the environment/user through the Web API WhoAmI function.",
    documentationUrl: "https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/whoami",
    fields: [
      { key: "environmentUrl", label: "Dataverse environment URL", required: true, secret: false, placeholder: "https://yourorg.crm.dynamics.com" },
    ],
    credentials: [
      { key: "accessToken", label: "Dataverse OAuth access token", role: "access_token", required: true, secret: true },
    ],
    scopes: ["user_impersonation"],
  }),
  microsoft_dynamics_365: Object.freeze({
    key: "microsoft_dynamics_365",
    label: "Microsoft Dynamics 365",
    category: "CRM & automation",
    description: "Connect Dynamics 365/Dataverse with an OAuth token and verify the organization/user through the Web API WhoAmI function.",
    documentationUrl: "https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/whoami",
    fields: [
      { key: "environmentUrl", label: "Dynamics 365 environment URL", required: true, secret: false, placeholder: "https://yourorg.crm.dynamics.com" },
    ],
    credentials: [
      { key: "accessToken", label: "Dynamics 365 OAuth access token", role: "access_token", required: true, secret: true },
    ],
    scopes: ["user_impersonation"],
  }),
});

export default VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE3;