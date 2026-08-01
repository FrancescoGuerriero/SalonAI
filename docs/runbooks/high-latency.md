# High Backend Latency

## Confirm

Check `salonai:slo_backend_latency_p95_seconds:5m` and the request-duration histogram by path.

## Investigate

1. Compare slow routes and HTTP methods.
2. Inspect Tempo for the longest spans.
3. Check MongoDB latency, AI-service calls, event-loop delay, CPU, and memory.
4. Confirm request volume has not changed sharply.

## Mitigate

Reduce expensive work, disable the affected feature, or scale the bottleneck. Preserve at least one representative trace before restarting a service.
