# AI Workforce runtime foundation

## Purpose

The AI Workforce is the governed specialist-agent layer described in AIIBP Roadmap v3.0. It extends the existing SalonAI AI governance foundation; it does not create a second model registry, permission system, booking engine or mutation path.

Operational Node/Express/MongoDB domains remain authoritative. Python/FastAPI and generative/predictive models provide intelligence. Agents may reason over governed evidence and registered tools, but consequential state changes continue through canonical application APIs and approval boundaries.

## Runtime contracts

### Agent Definition

`AiAgentDefinition` is the versioned registry record for an agent. It records:

- stable agent key and version;
- display name and purpose;
- draft / active / retired lifecycle;
- allowed verticals;
- required entitlement metadata;
- explicitly allowed tool keys;
- autonomy ceiling;
- preferred/fallback model metadata;
- evaluation-suite key and minimum quality/policy thresholds.

An agent is not authorised merely because a record exists. Activation must pass registry validation and later entitlement/tenant policy gates.

### Registered tools

`aiWorkforceToolRegistry.js` is the initial code-owned tool catalogue. Each tool has:

- stable key;
- domain;
- required application permission;
- mutation classification;
- risk level;
- maximum autonomy;
- human-approval requirement.

Agents cannot invent a tool name or gain a tool through prompting. Unknown tools fail closed. Tool registration describes the contract only; it does not grant database access or bypass canonical services.

Initial registered contracts are deliberately narrow:

- `business.metrics.read` — A0 read-only;
- `availability.search` — A0 read-only;
- `appointment.reschedule.propose` — A1 proposal only;
- `communications.campaign.draft` — A1 draft only;
- `inventory.restock.propose` — A1 proposal only.

No direct mutating agent tool is activated in this foundation.

### Agent Run

`AiAgentRun` is tenant-owned execution provenance. Every run requires:

- canonical Business ownership;
- optional Location ownership;
- authenticated initiating user;
- agent key/version and optional registry reference;
- requested/effective autonomy;
- model identity;
- registered-tool invocation summaries;
- linked action proposals;
- timings/status;
- outcome telemetry such as task success, approval, override, reversal, policy violation and later business metric impact.

Do not store unrestricted prompts, direct customer identifiers or sensitive provider secrets merely for observability.

### Existing Action Proposal

The existing `AiActionProposal` remains the action-governance authority. The Workforce foundation adds optional Business/Location, AgentRun, agent key, autonomy, risk, evidence and rollback provenance. Its existing execution state remains blocked by default.

This is intentional: AI Workforce does not introduce a new direct-write action object.

## Autonomy contract

- **A0 — Explain:** read-only analysis and evidence. Activated.
- **A1 — Draft:** draft/proposal creation for explicit human action. Activated as the current maximum.
- **A2 — Confirmed action:** contract recognised, but execution is not activated by this foundation. A later gate must require exact authorised confirmation and canonical API execution.
- **A3 — Policy automation:** not activated. Requires bounded policies, thresholds, rollback and production outcome evidence.
- **A4 — Autonomous optimisation:** long-term only. Requires separate governance, monitored closed-loop safety and kill-switch design.

`AI_WORKFORCE_ACTIVE_AUTONOMY_CEILING` is currently `A1`. Registry validation prevents an active agent from claiming a higher ceiling.

## Policy checks

Before a tool invocation can be considered allowed, the policy layer verifies:

1. the agent is active;
2. the tool is registered;
3. the agent explicitly owns that tool key;
4. requested autonomy is within the current release ceiling;
5. requested autonomy is within the agent ceiling;
6. requested autonomy is within the tool ceiling;
7. the tool is not a direct mutation;
8. high/critical-risk tools are not invoked through this initial path.

Later runtime integration must additionally resolve trusted Business/Location context, capability entitlement, effective user permission, consent/data sensitivity and canonical target ownership before the tool handler is called.

## First pilot sequence

The lowest-risk production sequence is:

1. **AI Business Adviser A0** — governed aggregate metric explanation with evidence; no mutation.
2. **AI Business Adviser A1** — create reviewable recommendations/proposals only.
3. **AI Receptionist / Retention pilots** — only after their booking/CRM/communications tools are tenant-safe and registered.
4. A2 execution only after an exact-confirmation orchestration contract and rollback/reconciliation evidence exist.

This sequence follows the v3.0 principle that agents use registered tools only and that consequential actions remain approval-governed.

## Metrics before autonomy increases

Promotion beyond A1 requires measured evidence, including where applicable:

- task success;
- factual/tool accuracy;
- approval rate;
- edit/override/reversal rate;
- policy violations;
- latency;
- cost per successful outcome;
- downstream business result.

No model or agent may silently retrain, promote or raise its autonomy ceiling from outcome data.
