# Frontend runtime unhealthy after security remediation

1. Inspect the health state:
   `docker inspect salonai-frontend --format '{{json .State.Health}}'`
2. Inspect Nginx startup logs:
   `docker logs salonai-frontend --tail 150`
3. Confirm the runtime user:
   `docker inspect salonai-frontend --format '{{.Config.User}}'`
4. Confirm the internal health endpoint:
   `docker exec salonai-frontend wget --quiet --tries=1 --spider http://127.0.0.1:8080/health`
5. Rebuild only the frontend after restoring a compatible unprivileged runtime image.
