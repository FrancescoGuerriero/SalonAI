# Production Deployment

1. Provision MongoDB Atlas with private networking and least-privilege credentials.
2. Configure backend, frontend and AI-service production environment files.
3. Use 32+ character random JWT secrets.
4. Restrict CORS to the deployed frontend origin.
5. Store secrets in the hosting platform secret manager.
6. Build and scan container images.
7. Run database backup before release.
8. Deploy to staging.
9. Run the Phase 6 validation script and end-to-end tests.
10. Promote the same immutable image digests to production.
11. Verify `/api/health/live` and `/api/health/ready`.
12. Monitor error rate, latency, queue depth and provider delivery.
