# Point 12 — Business Module Boundaries and Manual Acceptance

## Purpose

Point 12 packages the existing AIIBP capabilities into distinct business modules that can be allocated to a Business through capability entitlements without duplicating authority.

The module catalogue sits above low-level capability packs. Existing canonical domains remain authoritative; this work does not create parallel Appointment, Customer, Campaign, Communication, Integration, BI or AI stores.

## Module catalogue

| Module | Primary purpose | External platform connection | AI assistance | Execution authority |
| --- | --- | --- | --- | --- |
| Booking & Operations | Appointments, availability, waitlist/reception and service scheduling | No | No | Canonical operational authority |
| Workforce & Staff | Employee records, staff roles/eligibility and staff availability | No | No | Canonical workforce authority |
| Commerce | Checkout, orders, payments/refunds/invoices, memberships and loyalty/stored value | Yes | No | Canonical financial/value authority |
| Inventory & Purchasing | Stock, suppliers, purchase orders and reorder workflow | Yes | No | Canonical stock/purchasing authority |
| CRM & Customer Intelligence | Customer 360, lifecycle, deterministic segmentation, consent/contactability and retention evidence | No | No | Canonical read-model/customer evidence authority |
| Communications | Templates, channel delivery, scheduled delivery and delivery status/retry | Yes | No | Canonical delivery authority |
| Integration Hub | Provider connections, credential governance, Windsor-style/provider-neutral ingestion, lineage and governed destinations | Yes | No | Integration control plane |
| Marketing Automation | Campaigns, journeys, audience activation, approvals/scheduling and attribution orchestration | Indirectly through Integration Hub | Yes | Human-approved automation |
| Analytics & BI | Deterministic metrics, dashboards, campaign performance and operational/revenue analysis | No | No | Read-only evidence |
| AI Decision Support | Copilots, predictions, recommendations, next-best-action and natural-language analysis | No | Yes | Advisory only |
| AI Receptionist | Customer-facing conversational front-desk workflows using governed booking/communication tools | No direct provider ownership | Yes | Governed tool execution |

## Non-duplication rules

1. Every primary responsibility has exactly one module owner.
2. The Integration Hub owns provider credentials and provider connectivity. Marketing Automation must not implement a second credential store or provider-connection framework.
3. CRM owns customer lifecycle, deterministic segments, consent and contactability evidence. Marketing Automation consumes those audiences but does not redefine customer authority.
4. Communications owns message transport, templates and delivery state. Marketing Automation chooses approved campaign/journey actions but delegates sending.
5. Analytics & BI owns deterministic reporting. AI Decision Support may interpret evidence but must not replace deterministic facts with model output.
6. AI Decision Support remains advisory by default and cannot silently mutate canonical business state, send campaigns, charge customers or override safety/consent policy.
7. AI Receptionist is a separate customer-facing conversational module. It must not become an internal management copilot or a marketing campaign engine.
8. Booking, workforce, commerce and inventory remain canonical operational modules. Other modules consume their evidence through governed contracts rather than recreating their state.

## Point 12 marketing architecture

Marketing Automation is the orchestration layer over existing capabilities:

`CRM audience/consent -> Marketing Automation -> approval/schedule -> Communications/provider execution -> CampaignExecution/Attribution -> Analytics & BI -> optional AI Decision Support`

Provider/data connections are separate:

`Business -> Integration Hub -> external platform -> Marketing Data Core/Data Hub -> Analytics/Marketing evidence`

This preserves the existing provider-neutral, Windsor-style first-party architecture while allowing a Business to receive only the modules it is entitled to use.

## Capability allocation

The platform capability registry now exposes explicit allocatable packs for:

- `integrations`
- `crm`
- `marketing-automation`
- `ai-decision-support`

`marketing-automation` depends on CRM, Communications, Analytics & BI and Integration Hub capability packs. AI Decision Support depends on the shared AI foundation and Analytics & BI.

## Manual acceptance checklist

Use a non-production test Business and test Location. Do not enter production provider credentials unless a controlled provider acceptance test has been authorised.

### A. Module visibility/allocation

1. Allocate only Booking & Operations capabilities. Confirm booking/service/calendar functions work and Marketing/AI-specific surfaces are unavailable or clearly marked as not entitled.
2. Add `integrations`. Confirm provider connection/data-connection surfaces become available without enabling campaign execution.
3. Add `crm`. Confirm Customer 360/lifecycle/segment evidence is available without creating/sending campaigns.
4. Add `marketing-automation` with its dependencies. Confirm campaign/journey controls become available.
5. Remove `marketing-automation` while retaining `integrations`. Confirm provider/data connections remain usable while marketing execution is unavailable.
6. Add `ai` + `ai-decision-support`. Confirm copilots/recommendations are available without automatically sending messages or changing canonical records.

### B. Integration Hub separation

1. Open Marketing/Integration connections.
2. Configure a test/sandbox provider where supported.
3. Confirm credentials are never returned in plaintext after save.
4. Confirm connection status/data ingestion can be inspected independently from campaign creation.
5. Confirm disconnecting a provider does not delete canonical CRM customers, campaigns, appointments or BI history.

### C. CRM separation

1. Open a test customer.
2. Review Customer 360, lifecycle and deterministic segment membership.
3. Change test consent/contactability through the canonical customer/consent workflow.
4. Confirm CRM reflects the change.
5. Confirm Marketing Automation respects the updated contactability rather than maintaining a separate consent flag.

### D. Marketing Automation

1. Create a draft campaign or retention journey.
2. Select an existing CRM segment/audience.
3. Preview the audience and verify tenant/location scoping.
4. Confirm customers without required channel consent are excluded or blocked.
5. Confirm provider credentials are referenced through Integration Hub rather than entered again in the campaign.
6. Confirm the workflow remains Draft/Preview/Approve/Schedule/Execute/Measure, with live execution still gated where provider activation is not approved.
7. Confirm CampaignExecution/attribution evidence records results without creating a second campaign source of truth.

### E. Communications separation

1. Open templates and scheduled communications.
2. Confirm templates/delivery state live in Communications, not inside Marketing Automation.
3. Trigger only an authorised test delivery.
4. Confirm delivery status/retry evidence appears in Communications while campaign/journey state remains in Marketing Automation.

### F. Analytics & BI separation

1. Open campaign/performance reporting.
2. Confirm spend, conversion, booking/revenue and other deterministic metrics are derived from canonical/normalised evidence.
3. Confirm reporting does not execute a campaign or mutate Customer/Campaign/Appointment records.

### G. AI Decision Support separation

1. Open Management Copilot or Stylist Copilot with a test Business.
2. Confirm outputs are labelled advisory/human-review-required.
3. Confirm AI can analyse relevant evidence and recommend an action.
4. Confirm accepting/viewing a recommendation does not automatically send a marketing message, charge a customer, create an appointment, alter consent or override professional/safety rules.
5. Confirm AI provenance/inference evidence is recorded where the existing governed AI contract requires it.

### H. AI Receptionist separation

1. Use a sandbox/test conversation.
2. Confirm the AI Receptionist handles front-desk intent and can use only authorised booking/communication tools.
3. Confirm it does not expose management BI, campaign-builder functions or internal professional-copilot content.

## Acceptance outcome

Point 12 module architecture passes manual acceptance when each module can be enabled/disabled independently through capability allocation, dependencies are enforced, no module recreates another module's canonical state, and AI/automation behaviour remains within its declared authority boundary.
