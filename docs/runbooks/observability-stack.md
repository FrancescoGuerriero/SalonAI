# Observability Stack Degraded

## Components

- Prometheus: metrics, recording rules, and alerts
- Alertmanager: routing and alert lifecycle
- Blackbox Exporter: endpoint probes
- Loki: logs
- Tempo: traces
- Alloy: log and trace collection
- Grafana: dashboards and investigation

## Checks

```powershell
Invoke-WebRequest http://127.0.0.1:9090/-/healthy -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:9093/-/healthy -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:9115/metrics -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3100/ready -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:3200/ready -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:12345/-/ready -UseBasicParsing
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

Recreate only the affected observability container. Persistent metrics, alert, Grafana, Loki, and Tempo volumes must not be deleted during routine recovery.
