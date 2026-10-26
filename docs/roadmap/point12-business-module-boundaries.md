# Point 12 — Business Module Manual Acceptance

## Purpose

Point 12 packages AIIBP capabilities into distinctive business-facing modules that can be allocated to a Business without exposing internal engines as duplicate products.

The canonical module authority is the existing capability registry:

- `backend/src/platform/capabilities/capabilityRegistry.js`
- `backend/src/platform/capabilities/verticalPackRegistry.js`
- `docs/architecture/business-module-boundaries.md`

Internal engines remain installable dependencies, but tenant/business configuration should expose only `allocatableCapabilityPackKeys`.

## Core allocation model

Business-facing modules include Appointments & Booking, Workforce & Staff, Service Catalogue, Commerce, Communications, Calendar Integration, Integration Hub, Analytics & BI, CRM & Customer Intelligence, Marketing, AI Business Adviser, AI Receptionist, AI Retention Manager, AI Stylist Copilot, Memberships, Inventory & Purchasing, Loyalty and vertical-specific specialist modules.

The key Point 12 rule is:

**one allocatable Marketing module**

with these internal, non-allocatable engines:

- `marketing-data` — Windsor-style/provider-neutral ingestion, normalisation and lineage;
- `campaigns-attribution` — canonical campaigns, campaign executions, social publication and deterministic attribution;
- `marketing-automation` — triggers, approvals, schedules and automation-run orchestration.

The Marketing module composes those engines together with Integration Hub, CRM, Communications and Analytics & BI without duplicating their canonical state.

## Manual acceptance checklist

Use a non-production test Business and test Location. Do not enter production provider credentials or activate live sending unless a controlled provider acceptance step has been authorised.

### A. Module catalogue and allocation

1. Open the tenant/business product composition surface or inspect the resolved vertical composition.
2. Confirm `allocatableCapabilityPackKeys` includes business-facing modules such as `marketing`, `integrations`, `crm`, `analytics`, `ai-decision-support` and the vertical-appropriate AI assistants.
3. Confirm internal engines are **not** directly allocatable: `ai`, `marketing-data`, `campaigns-attribution`, `marketing-automation`.
4. Confirm allocating `marketing` automatically requires its internal dependencies rather than asking the Business to buy/configure them separately.
5. Confirm disabling/removing `marketing` does not remove unrelated modules such as Appointments, Workforce, Commerce or Integration Hub unless those are separately removed.

### B. Integration Hub separation

1. Allocate/enable `integrations` without `marketing`.
2. Open provider connection management.
3. Configure a supported sandbox/test provider.
4. Confirm credentials are stored securely and are not returned in plaintext after save.
5. Confirm provider connection/sync status can be inspected without exposing campaign automation controls.
6. Confirm disconnecting a provider does not delete canonical CRM customers, appointments, campaigns, orders or historical analytics evidence.

**Pass condition:** Integration Hub owns provider connection, credential and sync state only.

### C. CRM & Customer Intelligence separation

1. Allocate/enable `crm` without `marketing`.
2. Open Customer 360/lifecycle/segment views.
3. Verify deterministic lifecycle and segment evidence can be reviewed independently of campaign execution.
4. Change test consent/contactability through the canonical customer/consent workflow.
5. Confirm CRM reflects the change.
6. Confirm no marketing message is sent merely because a customer enters a segment or lifecycle state.

**Pass condition:** CRM owns customer intelligence/retention definitions and evidence, not campaign sending.

### D. Marketing module composition

1. Allocate/enable `marketing` with its required dependencies.
2. Confirm the Business sees a single Marketing product experience rather than separate Marketing Data, Campaign Attribution and Marketing Automation products.
3. Open marketing provider/data connections and confirm they use Integration Hub credentials/contracts rather than a second credential store.
4. Create or inspect a draft campaign or retention journey.
5. Select an existing CRM audience/segment.
6. Preview the audience and verify tenant/location scope.
7. Confirm customers without required channel consent/contactability are excluded or blocked.
8. Confirm the campaign workflow remains governed: Draft/Preview/Approve/Schedule/Execute/Measure, or the nearest current equivalent where execution is still gated.
9. Confirm campaign execution/attribution uses canonical `Campaign`/`CampaignExecution`/attribution evidence and does not create another campaign source of truth.
10. Confirm marketing-data evidence can be consumed without exposing `marketing-data` as a separately allocatable product.

**Pass condition:** one Marketing module orchestrates existing authorities without recreating them.

### E. Communications separation

1. Allocate/enable Communications independently.
2. Open templates, scheduled communications and delivery monitoring.
3. Confirm templates, channel transport, delivery state and retry evidence remain in Communications.
4. From Marketing, confirm approved campaign actions delegate actual delivery to Communications/provider contracts.
5. Trigger only an authorised sandbox/test delivery.
6. Confirm delivery evidence appears in Communications while campaign/journey orchestration remains in Marketing.

**Pass condition:** Communications owns message delivery; Marketing owns approved orchestration.

### F. Analytics & BI separation

1. Allocate/enable Analytics & BI without AI Decision Support.
2. Review campaign, revenue or operational reporting.
3. Confirm deterministic metrics are available without AI recommendations.
4. Confirm reporting cannot execute campaigns or mutate Customer, Appointment, Order, Campaign or Staff canonical records.

**Pass condition:** Analytics & BI is read/evidence authority only.

### G. AI Business Adviser / decision support

1. Allocate `ai-decision-support` for a test Business.
2. Confirm the shared internal `ai` foundation is not separately presented as a commercial module.
3. Open the Management Copilot/business-adviser surface.
4. Confirm output is evidence-grounded and human-review/advisory in nature.
5. Confirm a recommendation does not automatically send marketing, change pricing, alter staff, create bookings, charge customers or mutate canonical state.
6. Confirm inference/provenance evidence is recorded where the governed AI contract requires it.

**Pass condition:** AI assists decisions and does not silently become operational authority.

### H. AI Retention Manager

1. Allocate/enable the AI Retention Manager where supported.
2. Confirm it can recommend audiences, channels or next actions from CRM/BI evidence.
3. Confirm it cannot directly own or execute a campaign.
4. Confirm approved execution still passes through the Marketing module and Communications/provider contracts.

**Pass condition:** AI Retention advises; Marketing executes approved activity.

### I. AI Stylist Copilot

1. On a Salon business, allocate/enable AI Stylist Copilot.
2. Open a test appointment-scoped Copilot view.
3. Confirm recommendations are professional decision support only.
4. Confirm no autonomous customer message, canonical write, medical diagnosis or safety-rule override occurs.
5. Confirm Marketing functions are not exposed inside the Stylist Copilot.

**Pass condition:** professional AI decision support remains separate from marketing and general management AI.

### J. AI Receptionist

1. Allocate/enable AI Receptionist for a test Business.
2. Use a sandbox/test conversation.
3. Confirm the assistant can use only authorised booking/communications tools.
4. Confirm it cannot expose internal BI dashboards, campaign-building functions or professional Copilot content.
5. Confirm canonical Appointments/Communications remain authoritative after any approved tool action.

**Pass condition:** AI Receptionist is a governed customer-facing assistant, not a management or marketing engine.

## Non-duplication acceptance

The architecture passes when:

- every active canonical `ownedDomain` has one owner only;
- internal engines are hidden from tenant allocation when they are dependencies rather than products;
- `Marketing` is the single business-facing marketing module;
- provider connections remain owned by Integration Hub;
- CRM remains customer-intelligence authority;
- Communications remains delivery authority;
- Analytics & BI remains deterministic evidence authority;
- AI assistants remain within their declared advisory/tool-use boundaries;
- no module recreates another module's canonical database/state/business rules.
