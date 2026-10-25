# Stage 8 — AI candidate evaluation ledger

## Purpose

This tranche adds the governed record layer between offline/shadow AI experiments and any future production promotion proposal for SALON AI.

The ledger does **not** train, tune, activate, promote or execute a production model. It stores bounded governance evidence only.

## Ownership model

Operational AI evidence is location-owned:

`Business → Location → canonical evidence → advisory candidate → evaluation record`

A model candidate evaluated for one SALON AI location is not automatically valid for another location. The governed model artifact dataset scope must explicitly include the selected location.

## Evaluation record

`AiAdvisoryCandidateEvaluation` records:

- Business and required Location;
- tool and requested advisory action;
- candidate kind (`deterministic_baseline`, `shadow_model`, `offline_model`);
- AI Gateway registry version and candidate/advisory version;
- candidate output SHA-256;
- model identity, algorithm, artifact checksum, manifest schema and artifact lifecycle;
- canonical evidence ID/checksum and bounded fact/provenance counts;
- evaluation policy version and deterministic baseline version;
- evaluation assessment hash and quality metrics;
- baseline-comparison result;
- blocker codes;
- repeated-run evidence;
- aggregate benchmark-suite readiness;
- human reviewer state and note;
- immutable production safety flags defaulting to false.

Raw canonical facts, provider credentials and secrets are not persisted in this ledger.

## Evidence integrity

Before evaluation, the backend verifies that the submitted `data_hub_evidence_v1` envelope:

1. belongs to the active Business;
2. belongs to the selected Location;
3. remains within the governed 500-fact / 200-provenance bounds;
4. contains the original Data Hub contract version;
5. reproduces the canonical SHA-256 evidence fingerprint.

The candidate must bind to the same evidence ID and location.

## Model artifact gate

Shadow/offline candidates require a `salonai.model-artifact.v1` manifest.

The ledger requires:

- trusted `single_business` dataset scope;
- deidentified dataset provenance;
- exact active Business match;
- explicit selected Location membership;
- valid model identity and algorithm;
- valid artifact SHA-256;
- `experiment` or `candidate` lifecycle;
- recorded deterministic/rules baseline comparison.

Only a `candidate` artifact that beats the recorded rules baseline can contribute to promotion readiness.

## Full benchmark-suite gate

A single passing output cannot make a model promotion-ready.

The service reads the active AI Gateway evaluation policy. Under `salonai-advisory-evaluation-v1` the current minimum is:

- **25 distinct canonical evidence cases** for the same location, artifact, candidate version, policy and baseline;
- **3 recorded runs per case**;
- the evaluated candidate output hash must be one of those recorded runs;
- the case must pass the evaluator quality gate;
- the model artifact must pass the baseline and artifact lifecycle gates.

Only when the full suite is satisfied can the newest qualifying record become `pending_review`.

## Human review semantics

Human review can only set:

- `accepted_for_promotion_proposal`; or
- `rejected`.

`accepted_for_promotion_proposal` means the evidence is sufficient to prepare a **future controlled promotion proposal**. It is not model promotion.

Review decisions are final for that evaluation record.

## Production boundary

Every record is hard-locked to:

- `productionPromotionAuthorised = false`;
- `productionInferenceAuthorised = false`;
- `externalWriteAuthorised = false`.

There is no `/promote`, `/activate`, `/infer` or `/train` route in this tranche.

Any future production promotion must be implemented as a separate explicit control plane with its own approval, deployment and rollback evidence.
