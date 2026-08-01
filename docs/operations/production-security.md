# SalonAI production security baseline

## Scope

Phase 7.11 adds repeatable security assurance without changing SalonAI runtime behaviour. It audits the production Compose model, verifies secret-handling controls, scans source dependencies and container images, and records evidence under `security-reports`.

## Controls

- Docker services must not use privileged mode, host networking, host PID namespaces, or unreviewed added capabilities.
- Internal application and database services must not publish host ports.
- Non-edge operational ports must bind to loopback.
- Every runtime service must use `no-new-privileges:true`.
- Production environment files must remain outside Git and must not use known default credentials.
- The repository is scanned for fixable vulnerabilities, secrets, and infrastructure misconfiguration.
- Local SalonAI images are scanned for fixable high and critical vulnerabilities.
- CycloneDX JSON SBOMs are generated for the repository and available local application images.

## Reports

Generated evidence is stored under:

- `security-reports/compose`
- `security-reports/secrets`
- `security-reports/trivy`
- `security-reports/release-gate`
- `security-reports/sbom`

These reports deliberately exclude production environment values and database backup content.

## Audit versus enforcement

Audit mode always produces evidence and reports policy breaches without blocking development. Enforcement mode blocks a release when the thresholds in `config/security/release-policy.json` are exceeded.
