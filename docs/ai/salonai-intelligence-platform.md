# SalonAI Intelligence Platform

## Purpose

AI is a horizontal SalonAI platform capability. The goal is not to place an unrelated chatbot on every page. The goal is to make every relevant workflow capable of contributing governed data to, and consuming evidence from, a shared intelligence layer.

The Management Copilot evolves into **SalonAI Adviser**: one permission-aware interface that can retrieve SalonAI facts, call predictive models, retrieve governed knowledge, explain evidence, and propose actions.

## Four data layers

### 1. Operational truth

Existing canonical application models remain authoritative:

- Appointments
- Customers
- Staff/stylists
- Services
- Products/inventory
- Orders/payments
- Communications
- Campaigns
- Feedback and reviews

AI never becomes the source of truth for these records.

### 2. Feature/training data

`AiFeatureSnapshot` stores versioned, time-aware model observations. Training features must represent what would actually have been known at the prediction time. This prevents target leakage.

Examples:

- no-show features measured 48 hours before an appointment;
- rebooking/churn features measured after a completed visit;
- daily demand features measured at close of business;
- inventory demand features measured before a reorder decision.

Direct identifiers should not be training features unless a documented task genuinely requires them. Prefer pseudonymous entity keys.

`AiTrainingDataset` freezes the dataset definition, observation window, feature version, split policy, lineage hashes and quality information used by an experiment.

### 3. Model/inference governance

`AiModelVersion` records model lifecycle, algorithm, dataset, metrics, limitations and artifact location.

`AiInferenceLog` records the production model/version, prediction, confidence, explanation, eventual outcome and human usefulness feedback. This makes later evaluation possible.

A model should not become production merely because it trains successfully. It must beat an explicit baseline on a frozen test set and meet task-specific calibration/quality requirements.

### 4. Adviser knowledge / RAG

`AiKnowledgeDocument` stores reviewed domain knowledge separately from ML training data. Its `searchText` is the field intended for semantic/vector retrieval.

Use retrieval for changing factual/domain knowledge; do not fine-tune a generative model merely to memorise appointment, product, price, stock or policy facts.

Knowledge retrieval must filter by audience and permissions before context is supplied to a generative model.

## First trained model: no-show prediction

The current no-show implementation is a useful deterministic baseline, not a trained model.

The first supervised learning experiment should predict appointment no-show probability at a defined operational decision time, initially 48 hours before the appointment.

Candidate features, measured without future leakage:

- previous completed appointment count;
- previous no-show count/rate;
- previous cancellation count/rate;
- days since previous completed visit;
- booking lead time;
- service/category;
- stylist historical context;
- day of week and time bucket;
- booking source;
- appointment value;
- payment/deposit state known at prediction time;
- reminder state known at prediction time;
- reschedules that occurred before prediction time.

Label:

- 1 = appointment ultimately recorded as no_show;
- 0 = resolved eligible comparison appointment that did not become no_show.

Cancelled appointments need an explicit modelling policy rather than being silently treated as attended.

### Evaluation

Use temporal splits so future appointments never train a model that is evaluated on the past.

At minimum compare:

- deterministic SalonAI rules baseline;
- logistic regression baseline;
- tree/boosting candidate.

Record:

- ROC-AUC;
- PR-AUC;
- precision/recall at operational thresholds;
- Brier score / probability calibration;
- confusion matrix;
- subgroup/data-volume diagnostics;
- business utility such as high-risk confirmations converted and no-show reduction.

## Adviser architecture

```text
User question / contextual Ask SalonAI
              |
              v
       permission gateway
              |
              v
        Adviser orchestrator
       /        |          \
      /         |           \
live tools   predictive ML   knowledge retrieval
(DB/APIs)    model registry  RAG/vector search
      \         |           /
       \        |          /
              v
      evidence-grounded answer
       + confidence/limitations
       + suggested next actions
              |
              v
 human-confirmed application action
```

The Adviser must never bypass the application's RBAC layer. Any mutating action still passes the same backend permission and business-rule boundary as a human UI action.

## Global AI product surfaces

### Dashboard / executive
- explain KPI movements;
- anomaly detection;
- daily/weekly intelligent brief;
- forecast comparison;
- ask why a metric changed.

### Calendar / appointments
- no-show risk;
- cancellation/fill-risk;
- recommended reminder timing;
- waitlist fill recommendation;
- capacity optimisation;
- Ask SalonAI about today's schedule.

### Customer CRM
- customer summary;
- likely rebooking window;
- churn risk;
- lifetime value;
- next-best service/product;
- communication preference/timing;
- staff-facing conversation preparation.

### Staff
- utilisation and capacity insight;
- rota recommendations;
- training/service demand insight;
- workload balance;
- performance trends with evidence and guardrails.

### Services / products / inventory
- demand forecasts;
- margin/performance insight;
- stock/reorder forecasts;
- dead-stock risk;
- cross-sell recommendations;
- service trend detection.

### Communications / marketing
- audience selection;
- send-time optimisation;
- campaign copy assistance;
- predicted response/conversion;
- campaign post-analysis;
- retention journey recommendations.

### Customer-facing AI tool
- salon/service discovery;
- haircare/service education grounded in approved knowledge;
- appointment preparation and aftercare information;
- product/service recommendations using explicit preferences;
- booking assistance.

Customer-facing AI must make clear when information is general guidance and route safety/medical questions outside ordinary salon advice.

## Research/academic track

The project should intentionally preserve:

- reproducible dataset snapshots;
- experiment configuration;
- baseline comparisons;
- model metrics;
- calibration;
- feature importance/explainability;
- versioned model artifacts;
- drift monitoring;
- outcome feedback;
- ablation experiments;
- documented limitations.

This turns SalonAI into an appropriate software-engineering + applied-AI research platform rather than a collection of API calls.

## Recommended technical evolution

Near term:

- keep the FastAPI AI service;
- add offline training dependencies separately from runtime inference dependencies;
- start with scikit-learn-compatible tabular baselines;
- keep MongoDB as the operational/feature metadata store;
- use Atlas Vector Search for the governed knowledge/RAG collection when the Atlas tier/index is configured;
- add model artifact storage and experiment tracking once real experiments begin.

Later:

- MLflow or equivalent experiment/model registry service;
- gradient-boosted models for tabular prediction where justified;
- time-series models for demand/revenue;
- ranking/recommendation models;
- embedding-based retrieval and hybrid search;
- LLM tool orchestration for Adviser;
- fine-tuning only when measured evaluation shows a clear advantage over prompting/RAG/tools.
