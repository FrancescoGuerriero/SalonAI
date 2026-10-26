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

## First tranche

### Management BI contract

`GET /api/premium-analytics/management` returns `salonai.management-bi.v1` and requires trusted tenant context, effective authority and `premium-analytics:read`.

The first canonical KPI bundle covers:

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

Python adds the `governed_management_evidence_v1` contract and `/api/v1/ai-gateway/management-analysis` service-key route for `management-copilot`.

It performs deterministic current-versus-previous statistical interpretation only. It does not import MongoDB/Mongoose operational models, query canonical data independently, execute model inference, train or promote a model, or authorise an external action.

The management-copilot registry entry is upgraded to registry v1.3.0 and points at the governed gateway route.

### UI

The former placeholder Premium Analytics page becomes the Point 10 Business Intelligence workspace. It reads only the Node backend and displays:

- canonical KPI cards;
- period-over-period movement;
- authority/location scope;
- evidence identity and matched-record count;
- Python governance boundary;
- metric provenance.

The browser never calls the Python service directly.

## Deliberate boundary for the first tranche

Business-wide deterministic BI is supported across authorised locations. Governed Python analysis is considered safe only for a single trusted selected Location until the location-owned `AiGatewayInvocation` ledger has an explicit multi-location invocation/audit contract. Point 10 must not weaken that invariant merely to make business-wide Python analysis convenient.

## Safety

This tranche performs no production migration/backfill, deployment, scheduled analytics execution, external write, autonomous action, model training, model promotion or production predictive inference.

Refs #576 and parent architecture #237.
