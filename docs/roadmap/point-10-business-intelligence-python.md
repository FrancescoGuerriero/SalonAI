# Point 10 — Business Intelligence / Python (original Phase 12)

## Reconciliation

Original Phase 12 is implemented as a completion layer over the Stage 8 shared BI/AI architecture. Point 10 does not create a second Data Hub, metric catalogue, analytics authority or Python-owned operational database.

The canonical authorities remain:

- Node/Express/MongoDB for business, Location, appointments and operational facts;
- Metric Catalogue v2 for KPI definitions;
- canonical metric calculators for source-of-truth KPI values;
- Stage 8 Data Hub / evidence contracts for governed evidence;
- Python/FastAPI for bounded analytical interpretation only;
- AI Gateway / tool registry for governed Python capability routing.

## Tranche 1 — governed management BI

### Management BI contract

`GET /api/premium-analytics/management` returns `salonai.management-bi.v1` and requires trusted tenant context, effective authority and `premium-analytics:read`.

The canonical KPI bundle covers:

- bookings;
- completed appointments;
- completed revenue;
- no-show rate;
- cancellation rate.

Current and previous periods use the existing canonical appointment metric calculator. Every metric retains its Metric Catalogue version and definition evidence.

### Location ownership

Business-wide BI is not implemented as an unbounded business query. Effective authority is first resolved into concrete Location IDs. Appointment facts without a canonical Location are excluded rather than inferred or assigned.

This preserves the governing rule that management may aggregate authorised locations while operational facts remain Location-owned.

### Management evidence

The management snapshot produces bounded non-PII evidence with:

- business and authorised Location scope;
- period boundaries;
- canonical metric values;
- evidence ID and SHA-256 checksum;
- source-model and metric-authority provenance;
- explicit `pythonMayRecalculateCanonicalMetrics: false`;
- `modelInferenceExecuted: false`;
- `executionAuthorised: false`;
- `externalWriteAuthorised: false`.

### Governed Python statistical baseline

Python provides the `governed_management_evidence_v1` contract and `/api/v1/ai-gateway/management-analysis` service-key route for `management-copilot`.

It performs deterministic current-versus-previous statistical interpretation only. It does not import MongoDB/Mongoose operational models, query canonical data independently, execute model inference, train or promote a model, or authorise an external action.

The management-copilot registry is versioned at v1.3.0 and points at the governed AI Gateway route.

### Premium Analytics workspace

The former placeholder Premium Analytics page is replaced by the Point 10 Business Intelligence workspace. It reads only the Node backend and displays:

- canonical KPI cards;
- period-over-period movement;
- authority/location scope;
- evidence identity and matched-record count;
- Python governance boundary;
- metric provenance.

The browser never calls the Python service directly.

Implemented in PR #577.

## Tranche 2 — governed Node → Python execution bridge

`POST /api/premium-analytics/management/python-analysis` provides the only browser-facing path to the Python management baseline. The route requires trusted tenant context, effective authority, `premium-analytics:read` and `ai:use`.

The Node bridge:

- rebuilds canonical management BI evidence server-side rather than accepting caller-supplied KPI values;
- requires exactly one explicitly selected authorised Location for Python analysis;
- calls `/api/v1/ai-gateway/management-analysis` using the internal service-key boundary;
- binds and validates business ID, Location ID, evidence ID, evidence checksum and tool identity;
- fails closed on any identity or execution-contract mismatch;
- records the invocation in the existing location-owned `AiGatewayInvocation` ledger;
- records deterministic baseline status and the fact that model inference did not execute;
- never authorises an external write or autonomous action.

The frontend exposes an **Analyse with Python** action only through the Node API and surfaces the resulting audited invocation reference.

Implemented in PR #578.

## Deliberate single-location Python boundary

Business-wide deterministic BI may aggregate all Locations granted by effective authority because the underlying facts remain Location-owned and the aggregation is performed by the canonical Node BI layer.

Governed Python management analysis remains intentionally limited to one explicitly selected authorised Location. This avoids inventing a multi-location shortcut around the location-owned `AiGatewayInvocation` audit model. A future multi-location Python contract would require an explicit auditable ownership model before it can be enabled.

This is a deliberate Point 10 completion boundary, not an unfinished bypass.

## Completion criteria

Point 10 is complete when all of the following remain true:

1. Management BI values come from canonical Node metric authority.
2. Current-vs-previous metrics carry definition/provenance evidence.
3. Business-wide deterministic aggregation is restricted to authorised Location IDs.
4. Ambiguous legacy facts without canonical Location ownership are excluded.
5. Python receives bounded canonical management evidence only.
6. Python does not query operational databases or recalculate canonical KPI authority.
7. Node is the only orchestration boundary exposed to the frontend.
8. Python analysis identity is echoed and checked before results are accepted.
9. Python invocation is location-owned and auditable.
10. No model inference, training, promotion, autonomous action or external write is enabled.
11. Premium Analytics is a real provenance-aware BI workspace rather than a placeholder.
12. Point 10 contracts, Fast CI and CodeQL pass; the known unrelated Stage 1–6 baseline failure is not weakened or bypassed.

PRs #577 and #578 satisfy these criteria. Point 10 therefore requires no additional competing BI/Python architecture.

## Safety

Point 10 performs no production migration/backfill, deployment, scheduled analytics execution, external write, autonomous action, model training, model promotion or production predictive inference.

Refs #576 and parent architecture #237.
