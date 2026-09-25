# Production Deployment

1. Validate production environment variables.
2. Build and test the backend, frontend and AI service.
3. Back up the production database.
4. Deploy first to staging.
5. Verify health and readiness endpoints.
6. Promote the tested release to production.
7. Monitor errors, latency and provider delivery.
8. Roll back to the previous release when validation fails.

## AI route namespace

Browser management pages under `/ai/*` are React SPA routes and must be served by the frontend.
Application AI APIs are exposed through the authenticated Node backend under `/api/ai/*`; the backend then calls the Python AI service over the private Docker network.

The only direct public AI-service exception is the exact `/ai/health` health endpoint used by production smoke checks. Do not add a generic Nginx `location /ai/` proxy because it would intercept the React AI pages before the SPA can load.
