# DEV1 AIIBP v3 — A0 invocation deadlines and cooperative cancellation

Status: **internal source-only**, no route, scheduler, autonomous action or production activation.

The canonical `business.metrics.read` tool now uses `withBoundedAiRead`:
- default timeout 8 seconds; accepted range 500–30,000 milliseconds;
- caller `AbortSignal` is accepted only from trusted backend integration;
- timeout and cancellation abort the delegated signal and return classified
  `AI_READ_TIMEOUT` / `AI_READ_CANCELLED` errors;
- invocation records remain failed on deadline expiry, with minimal failure
  category in `AuditLog`, never metric values or raw failure messages;
- invalid deadlines are refused before a run is created.

The canonical Appointment metrics query independently applies a MongoDB
`maxTimeMS` deadline and forwards the AbortSignal to the driver query.
This is important: cancelling a JavaScript promise does not by itself stop
database work. A non-cooperative dependency may continue after the caller
returns, so activation must additionally enforce query-side deadlines and
database resource quotas.

The trusted tenant entry point forwards optional timeout and cancellation
to the already governed invocation. These settings do not bypass tenant,
location, RBAC, entitlement, A0 policy, metric validation or mandatory audit.

Tests cover successful reads, timeout against unresolved read, cooperative
abort, caller cancellation, invalid deadlines and failed-run audit evidence.
Full Stage 1–6, Fast CI, CodeQL and AI validation must pass.

Still required: DB-backed multi-tenant isolation and query cancellation tests,
controlled retry policy (no automatic retries yet), tenant quotas, monitoring
and production activation review. Sole development owner: DEV1.
