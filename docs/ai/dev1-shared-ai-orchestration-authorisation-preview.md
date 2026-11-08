# DEV1 AIIBP v3 — Shared AI tool orchestration authorisation preview

Status: source-only internal contract; no execution, endpoint, deployment or tenant activation.

## Architecture

This slice extends the canonical `aiWorkforcePolicy`, `aiWorkforceToolRegistry`,
`effectiveAuthorityService` and tenant product-composition contracts.
It does **not** create another agent registry, permission model, provider gateway,
AI model store, workflow engine or tenant-specific AI installation.

`previewAiWorkforceToolInvocation` is a deterministic **non-executing** preflight.
It consumes only **server-resolved**, trusted effective authority, tenant product
composition and entitlement evidence. None of these values may be accepted from
an HTTP request body, AI response or prompt.

## Required gates

1. The effective membership has a trusted Business ID.
2. The resolved product composition has the same Business ID and an active manifest.
3. The shared `ai` capability is enabled in the resolved composition.
4. The agent declares the active vertical in its allowed-verticals contract.
5. If the agent requires an additional entitlement, it must be present in
   the **backend-resolved** entitlement evidence.
6. Explicit location requests must be inside the trusted membership.
7. The agent is active and explicitly grants the registered tool.
8. The request is A0; only low-risk, no-approval, non-mutating A0 read tools
   are eligible for this preview.
9. Both `ai:use` and the tool's canonical permission must pass effective
   authority checks, including selected-location requirements where applicable.

The output contains an evidence-only decision and always states
`executionAuthorised: false` and `mutationAuthorised: false`.

## Important limitations

- No network calls, model execution, DB write, provider activity or
  business operation is performed.
- This result is **not a bearer capability or an execution authorisation**.
  Future canonical handlers must independently recheck membership,
  location, entitlement, consent, resource ownership and permissions at use time.
- External task execution, A1 draft/proposal preparation, A2–A4 autonomy,
  spending, messaging and publication remain separate gated milestones.
- The current business-adviser agent's read tool contract is available for
  internal composition; activating a tenant-facing orchestration endpoint
  requires server-side composition loading, entitlement integration,
  audited invocation provenance and production acceptance.

## Regression evidence required

Run the Stage 1–6 backend/frontend regression suite, Fast CI and CodeQL.
Test absence of membership, suspended/foreign composition, disabled AI capability,
wrong vertical, missing entitlement, unknown tool, tool not granted, missing
permission, unauthorised location and attempted A1/proposal invocation.

Ownership: DEV1 exclusively. No production changes.
