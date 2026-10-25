# Stage 8 Marketing Hub — real connector contract

## Rule

A provider is not considered connected merely because credentials were saved. A Marketing Hub provider can be presented as connectable only when all of the following exist in source:

1. a provider-specific credential/account schema;
2. secure encrypted credential storage through the shared credential authority;
3. a real read-only provider account verification request to the provider's official API;
4. a successful verification result persisted on the IntegrationConnection;
5. fail-closed handling that returns the connection to `pending` when verification fails.

A successful account connection is distinct from a Data Hub ingestion adapter. The UI/API must state whether the account is verified and whether ingestion is available. No connector may imply live sync merely because account authentication succeeded.

## Verified account connectors currently implemented

The following providers now have provider-specific live account verification in `marketingAccountVerificationService.js`:

- Google Ads — OAuth refresh/access token + developer token; Google Ads API v26 customer query.
- Google Analytics 4 — OAuth; Data API `runReport` against the configured property.
- Google Search Console — OAuth; Sites collection and configured-property membership check.
- Google Business Profile — OAuth; Account Management API account-list check.
- YouTube — OAuth; authenticated `channels.list` check.
- Facebook Ads / Meta Ads — Meta access token; configured ad-account lookup.
- Facebook Page Insights — Meta access token; configured Page lookup.
- Instagram Organic — Meta access token; professional-account lookup.
- LinkedIn Ads — OAuth access token; configured ad-account lookup.
- LinkedIn Pages — OAuth access token; configured organisation lookup.
- TikTok Ads — advertiser access token; advertiser-scoped identity-list request.
- Mailchimp — API key; authenticated Marketing API ping.
- Stripe — restricted/secret API key; account retrieval.
- Shopify — Admin API access token; canonical shop retrieval.
- HubSpot — private-app/OAuth access token; account-info retrieval.
- OpenAI Ads / ChatGPT Ads — Advertiser API key; `GET /v1/ad_account`.
- GitHub — OAuth/fine-grained/PAT access token; authenticated-user retrieval.
- GitLab — OAuth/PAT access token; authenticated-user retrieval on GitLab.com.
- SendGrid — API key; authenticated user-profile retrieval.
- Twilio — Account SID + Auth Token; account-resource retrieval.
- Square — OAuth access token; seller locations retrieval.
- PayPal Transaction — client ID + client secret; OAuth client-credentials token exchange.

These connectors may be configured through the Marketing Hub. The connection is returned as `connected` only after verification succeeds.

## Account connection versus ingestion

Some verified accounts already have governed Data Hub ingestion adapters. Others currently provide a real authenticated account connection but do not yet have a normalisation/extraction adapter.

For verified accounts without a Stage-5 ingestion adapter, the API reports:

`dataHubSourceStatus = account_connected_adapter_pending`

This is not a placeholder account connection: credentials are validated against the provider. It explicitly means that extraction/normalisation remains a separate implementation tranche.

## Providers still disabled

Every provider from the requested Marketing Hub inventory remains visible for roadmap coverage, but any provider without a provider-specific verifier is returned as non-configurable / `verification_adapter_required`. The UI must not show a working Connect action for those entries.

Those providers must be implemented provider by provider using official authentication and read-only account/identity endpoints before they can become connectable.

## Credential handling

- Provider secrets are encrypted server-side and are never returned to the browser.
- Storing a secret sets verification state to `required`; it does not set `connected`.
- Successful provider verification sets `verificationStatus=verified`, `verifiedAt`, a bounded non-secret account summary and `status=connected`.
- Failed provider verification sets `verificationStatus=failed`, clears `connectedAt`, and leaves the connection `pending`.
- Disconnect revokes bound credential versions.

## Production boundary

This tranche does not activate scheduled live provider sync, production deployments, provider-side writes, campaigns, mutations or background workers. Account verification calls are read-only and exist only to prove that the supplied credentials belong to an accessible provider account.
