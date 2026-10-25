# Stage 8 — AI promotion proposal dossier

## Purpose

This tranche creates a non-executing change-planning dossier for an AI candidate that has already completed the governed evaluation and human promotion-proposal review chain.

It does not promote, deploy, activate, train or invoke a production model.

## Preconditions

A dossier may only be created from an `AiAdvisoryCandidateEvaluation` record for the active SALON AI location when all of the following are true:

- `promotionReviewStatus = accepted_for_promotion_proposal`;
- `eligibleForPromotionReview = true`;
- quality gate passed;
- deterministic/rules baseline comparison passed;
- artifact lifecycle/promotion eligibility passed;
- the full benchmark suite passed;
- governed model artifact provenance is present.

This retains the location boundary from canonical evidence through candidate evaluation into change planning.

## Dossier contents

`AiPromotionProposalDossier` snapshots bounded governance identifiers and planning evidence:

- source candidate evaluation ID;
- tool/candidate/model/artifact identity;
- registry/evaluation policy/baseline versions;
- assessment hash, evidence ID and evidence checksum;
- qualifying vs required benchmark cases;
- minimum repeated runs per case;
- rationale and expected benefit;
- risk assessment;
- rollback plan;
- monitoring plan;
- incident owner;
- proposed deployment window;
- planning checklist and creator/updater provenance.

Raw model bytes, canonical fact payloads, secrets and provider credentials are not stored in this dossier.

## Status model

The only dossier states are:

- `draft`;
- `ready_for_change_review`;
- `withdrawn`.

`ready_for_change_review` is explicitly a planning state, not an approval or deployment state.

Before that state can be set, the dossier must contain at least:

- rationale;
- expected benefit;
- risk assessment;
- rollback plan;
- monitoring plan;
- incident owner;
- proposed deployment window.

## Production boundary

The model hard-locks every dossier to:

- `productionPromotionAuthorised = false`;
- `productionInferenceAuthorised = false`;
- `deploymentAuthorised = false`;
- `externalWriteAuthorised = false`.

The API exposes only create/list/get/update planning operations. There is no `/promote`, `/activate`, `/deploy`, `/infer` or `/train` endpoint.

A later production change-control tranche, if authorised, must be separate and must include explicit approval, rollout, monitoring and rollback controls.
