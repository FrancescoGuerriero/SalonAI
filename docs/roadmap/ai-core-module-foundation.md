# AIIBP AI Core Module Foundation

## Purpose

AI is a first-class shared core module of AIIBP. Vertical and business modules consume governed AI capabilities from this foundation rather than creating isolated AI stacks or duplicating model, provenance, training and evaluation logic.

The AI Core does not become a new source of truth for appointments, customers, services, commerce, staff, marketing, communications or regulated records. Canonical business modules remain authoritative for their domains.

## AI Core responsibilities

The AI Core owns shared platform concerns for:

- AI gateway and governed inference routing;
- tool and capability registration;
- evidence/provenance contracts;
- model registry and model-artifact lifecycle;
- training-data catalogue and eligibility policy;
- feature-definition and dataset-version provenance;
- offline/shadow experiments;
- baseline comparison and candidate evaluation;
- model promotion gates;
- safety, human-review and external-action policy;
- AI observability and audit evidence.

AI assistants such as AI Business Adviser, AI Receptionist, AI Retention Manager and AI Stylist Copilot consume AI Core services. They remain distinct product capabilities and retain their domain-specific user experience.

## Training-data boundary

The first governed training-data catalogue covers canonical data from:

1. appointments and booking history;
2. customer lifecycle and behaviour;
3. service and product catalogues;
4. commerce history;
5. marketing performance and attribution;
6. communications outcomes;
7. workforce capacity.

Clinical/special-category records are explicitly not training-eligible by default. They require a dedicated regulated-data policy before any model-development use.

All eligible training data remains scoped to the owning Business and Location by default. Cross-tenant training is disabled. Direct identifiers and raw credentials are not allowed in the training contract. Personal data must be pseudonymised or aggregated as appropriate, with consent or another valid lawful basis enforced by the relevant canonical domain.

## Training and promotion lifecycle

The intended lifecycle is:

`canonical source -> governed dataset -> pseudonymisation/aggregation -> feature definition -> dataset fingerprint -> offline training candidate -> holdout/baseline evaluation -> repeated validation -> human review -> governed model artifact -> controlled promotion proposal -> production approval`

No stage may silently bypass the previous stage.

## Current safety state

This foundation does **not** enable automatic training, production training, automatic model promotion, provider writes, autonomous consequential actions or cross-tenant learning.

The platform remains fail-closed:

- training default: disabled;
- production training: disabled;
- automatic model promotion: disabled;
- external writes: disabled unless a separate governed capability explicitly authorises them;
- consequential actions: human approval required;
- tenant/location evidence isolation: required;
- provenance and dataset fingerprints: required.

## Next development slices

1. Build the AI Core management surface for dataset readiness, model candidates, experiments, evaluation and promotion state.
2. Add governed dataset builders that read canonical modules without copying their ownership semantics.
3. Extend offline model-training pipelines for forecasting, no-show risk, retention and recommendation candidates.
4. Add model/feature performance monitoring and drift detection.
5. Expand AI assistant orchestration so all assistants consume AI Core through the same tool, evidence and policy contracts.
6. Add opt-in tenant learning policies only after privacy, legal, commercial and technical acceptance.
