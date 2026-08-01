# SalonAI Alert Catalogue

| Alert | Severity | Purpose | Runbook |
|---|---|---|---|
| `SalonAIBackendUnavailableSLO` | Critical | Backend readiness remains zero | `backend-unavailable.md` |
| `SalonAIBackendSLOBurnRateCritical` | Critical | Rapid 5xx error-budget burn | `high-error-rate.md` |
| `SalonAIBackendSLOBurnRateWarning` | Warning | Sustained elevated 5xx ratio | `high-error-rate.md` |
| `SalonAIBackendAvailabilitySLOBreach` | Warning | Rolling availability below 99.9% | `backend-unavailable.md` |
| `SalonAIBackendLatencySLOBreach` | Warning | p95 latency above one second | `high-latency.md` |
| `SalonAIBackendErrorBudgetLow` | Warning | Less than 25% of 24-hour budget remains | `high-error-rate.md` |
| `SalonAIEndpointProbeFailed` | Critical | Black-box endpoint probe failed | `backend-unavailable.md` |

Existing Phase 7.6 alerts remain loaded from `monitoring\alerts.yml`.
