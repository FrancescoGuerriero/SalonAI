# High Error Rate or Error-Budget Burn

## Confirm

Use Grafana or Prometheus to compare:

- `salonai:slo_backend_error_ratio:rate5m`
- `salonai:slo_backend_error_ratio:rate30m`
- `salonai:slo_backend_error_ratio:rate6h`
- `salonai:slo_backend_error_budget_remaining:ratio_24h`

## Investigate

1. Group HTTP 5xx metrics by path and method.
2. Search Loki for `statusCode` values from 500 to 599.
3. Follow trace IDs from error logs into Tempo.
4. Check dependency errors from MongoDB, AI service, payment, email, or external APIs.

## Mitigate

Disable or roll back the failing feature where possible. Avoid broad restarts when failures are isolated to one route or dependency.
