# Phase 7.14 Production Deployment

## Objective

Deploy the exact security-scanned SalonAI release images identified by the Phase
7.13 release manifest to a production Docker host with HTTPS, observability,
health verification, rollback capability and retained evidence.

## Prerequisites

- Phase 7.13 merged and verified.
- A published semantic GitHub release containing `release-manifest.json`.
- A production host with Docker Engine, Docker Compose v2, GitHub CLI and PowerShell 7.
- A self-hosted GitHub Actions runner labelled `salonai-production`.
- DNS for `SALONAI_DOMAIN` resolving to the production host.
- TLS files `fullchain.pem` and `privkey.pem`.
- A GitHub environment named `production` with required reviewers.
- Environment variable `SALONAI_DEPLOY_ROOT`.
- Environment secret `PRODUCTION_ENV_FILE`.
- Previously exposed MongoDB and JWT credentials rotated.

## Immutable release contract

The deployment workflow downloads `release-manifest.json` from the selected GitHub
release. It derives:

- `APP_VERSION`
- `RELEASE_SOURCE_COMMIT`
- `AI_SERVICE_IMAGE`
- `BACKEND_IMAGE`
- `FRONTEND_IMAGE`

Each application image must be an `image@sha256:digest` reference. Operators do not
manually choose application image tags.

## Secret handling

Real production values belong only in the untracked `.env.production` file or the
GitHub `production` environment secret. Example files contain placeholders. Never
commit `.env.production`, certificates, private keys or provider tokens.

The production secret must include all non-release-derived values from
`config/phase7-14.env.example`, including a rotated `JWT_SECRET`, MongoDB password
and Grafana administrator password.

## Release deployment

1. Publish an immutable semantic release through the Phase 7.13 release workflow.
2. Verify the GitHub release, image digests, SBOMs and attestations.
3. Configure DNS, TLS material and the protected GitHub `production` environment.
4. Trigger `SalonAI Production Deployment`.
5. Enter the release tag and type `DEPLOY`.
6. Approve the protected `production` environment.
7. The runner downloads the release manifest, refreshes the stable deployment
   directory, injects immutable image references, validates the environment,
   validates merged Compose configuration, pulls images and deploys the stack.
8. HTTPS smoke tests run against edge, backend, AI-service and frontend.
9. Download and retain the deployment evidence artifact.

## Observability compatibility

The production Compose file retains the base Prometheus service. The observability
overlay extends it and marks the shared Docker network and Prometheus data volume
as external. The deployment and rollback scripts create those resources when
needed without deleting existing data.

## Rollback

Download `release-manifest.json` from the previously verified GitHub release, then
run `Rollback-Production.ps1` with `-RollbackManifestPath`. The rollback script
backs up the current environment, restores all three immutable image references,
validates the production contract, recreates the stack and reruns HTTPS smoke tests.

## Operational rule

A deployment is not complete until its evidence contains the release tag, source
commit, release-manifest checksum, immutable image references and successful
smoke-test results.
