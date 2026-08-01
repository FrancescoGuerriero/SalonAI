# Backend or Endpoint Unavailable

## Confirm

```powershell
Invoke-RestMethod http://127.0.0.1:9090/api/v1/query?query=salonai_backend_ready
Invoke-RestMethod http://127.0.0.1:9090/api/v1/query?query=probe_success

docker compose --env-file .\.env.production -f .\docker-compose.production.yml -f .\docker-compose.observability.yml ps --all
```

## Investigate

1. Check `salonai-backend`, `salonai-mongo`, `salonai-ai-service`, and `salonai-edge` logs.
2. Confirm MongoDB and AI-service dependencies are healthy.
3. Search Loki using the incident time and service label.
4. Open a failing trace in Tempo where a trace ID exists.

## Mitigate

Restart only the failed service after collecting evidence. Roll back a recent change when the failure started immediately after deployment. Do not delete persistent volumes as a recovery shortcut.
