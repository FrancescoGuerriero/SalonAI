# Stage 8 — Marketing provider executor wave 1

Authority: AIIBP Roadmap v2.9 Stage 8 and Issue #237.

## Scope

Wave 1 adds read-only reporting executors for Google Ads and Meta Ads behind the existing AIIBP Marketing Data Core provider contract.

These executors do not create a new ingestion framework. They feed provider records into the existing `MarketingDataSource` -> raw record -> normalised record -> Data Hub lineage pipeline.

## Google Ads

Implemented reporting contract:
- Google Ads API v26;
- OAuth bearer token through the existing encrypted credential authority;
- developer token from the connection's governed `api_key` credential role;
- customer ID normalised without separators;
- optional manager-account `login-customer-id` header;
- read-only GAQL campaign reporting through `googleAds:searchStream`;
- daily campaign facts for impressions, clicks, cost, conversions and conversion value;
- `cost_micros` converted to ordinary currency units before normalisation;
- bounded record count and date window;
- deterministic Data Hub checkpoint at the end of the accepted window.

No mutate endpoint or campaign/budget write contract is implemented.

## Meta Ads

Implemented reporting contract:
- Meta Graph/Marketing API v26.0;
- governed access-token credential;
- campaign-level Insights reads;
- daily `time_increment=1` reporting;
- campaign/date/impressions/clicks/spend facts;
- purchase conversion and value mapping using a precedence list so overlapping purchase aliases are not summed twice;
- bounded pagination and record count;
- deterministic Data Hub checkpoint at the end of the accepted window.

No campaign creation, editing, budget change or other write API is implemented.

## Execution lock

Both adapters are registered as available provider executors, but every Marketing-tab-created source remains provisioned with:
- `status: ready`;
- `syncMode: manual`;
- `sourceConfig.liveProviderExecution: false`.

`marketingProviderRunService` checks the execution-authorisation flag before provider dispatch. Therefore the existence of executor code does not activate a provider account.

## Activation remains separate

Before either provider may be used against a real account, require a controlled activation step that records:
1. authorised business/account;
2. least-privilege scopes and provider approval state;
3. accepted date window and expected volume;
4. quota/rate-limit expectations;
5. reconciliation thresholds;
6. connector health ownership;
7. explicit change of the source execution-authorisation flag;
8. smoke run and rollback/disable evidence.

No production provider request, production backfill, scheduled worker, campaign mutation or deployment is performed by this source change.
