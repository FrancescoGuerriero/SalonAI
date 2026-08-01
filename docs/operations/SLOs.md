# SalonAI Service-Level Objectives

## Scope

Phase 7.9 introduces measurable reliability objectives for the production-facing SalonAI services. These objectives are operational targets, not contractual service-level agreements.

## Objectives

| Service indicator | Objective | Measurement |
|---|---:|---|
| Backend readiness | 99.9% | `salonai_backend_ready` over rolling windows |
| Backend request success | 99.9% | Requests excluding HTTP 5xx responses |
| Backend latency | p95 below 1 second | `salonai_http_request_duration_seconds` |
| Public/internal endpoints | 99.9% | Black-box `probe_success` for edge, backend, AI service, and frontend |

## Error budget

A 99.9% availability objective permits 0.1% unavailability. Phase 7.9 records rolling availability and calculates the approximate remaining 24-hour error budget.

Critical alerting uses a 14.4x burn threshold across short windows. Warning alerting uses a 6x threshold across longer windows. This reduces noise while detecting rapid and sustained reliability loss.

## Operational policy

1. Treat critical burn-rate or endpoint alerts as incidents.
2. Stop non-essential production changes while a critical SLO alert is firing.
3. Capture an incident snapshot before restarting services where practical.
4. Record the customer impact, trace IDs, request IDs, start time, mitigation, and follow-up work.
5. Review objectives after sufficient production traffic exists; do not relax them solely to suppress alerts.
