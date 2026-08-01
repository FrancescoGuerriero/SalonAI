# SalonAI Incident Response

## Severity

- **Critical:** customer-facing outage, failed endpoint probe, backend unavailable, rapid error-budget burn, data-integrity risk, or security concern.
- **Warning:** sustained latency, elevated error rate, low error budget, or partial degradation without a confirmed outage.

## First ten minutes

1. Acknowledge the alert and record the incident start time.
2. Run `scripts\collect-incident-snapshot.ps1`.
3. Check Grafana: **SalonAI SLO and Incident Readiness**.
4. Identify affected services through Prometheus targets, Loki logs, and Tempo traces.
5. Use the matching runbook under `docs\runbooks`.
6. Prefer reversible mitigation: rollback, disable a feature flag, reduce traffic, or restart only the unhealthy service.

## Evidence to preserve

- Alert name and labels
- Relevant trace IDs and request IDs
- Prometheus query results
- Container state and recent logs
- Deployment version and recent changes
- Customer-visible symptoms

## Resolution

An incident is resolved when customer impact has stopped, critical alerts have cleared, and service health is stable. Create follow-up actions for root cause, tests, monitoring gaps, and documentation changes.
