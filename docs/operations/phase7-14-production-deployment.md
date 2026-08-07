# Phase 7.14 Production Deployment

## Objective

Deploy the exact security-scanned SalonAI release images identified by the Phase
7.13 release manifest to a production Docker host with HTTPS, observability,
health verification, rollback capability and retained evidence.

## Prerequisites

- Phase 7.13 merged and verified.
- A published semantic GitHub release containing `release-manifest.json`.
- A production host with Docker Engine, Docker Compose v2 and PowerShell 7.
- DNS for `SALONAI_DOMAIN` resolving to the production host.
- TLS files `fullchain.pem` and `privkey.pem`.
- A GitHub environment named `production` with required reviewers.
- GitHub production environment secrets `PRODUCTION_HOST`, `PRODUCTION_USER`,
  `PRODUCTION_SSH_KEY` and `PRODUCTION_KNOWN_HOSTS`.
- An untracked `/opt/salonai/.env.production` owned by the restricted deployment user.
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

Application secrets remain only in the untracked server-side `.env.production`
file. GitHub stores only the SSH connection identity and pinned known-host record.
Example files contain placeholders. Never commit `.env.production`, certificates,
private keys or provider tokens.

## Release deployment

1. Publish an immutable semantic release through the Phase 7.13 release workflow.
2. Verify the GitHub release, image digests, SBOMs and attestations.
3. Configure DNS, TLS material and the protected GitHub `production` environment.
4. Trigger `SalonAI Production Deployment`.
5. Enter the release tag and type `DEPLOY`.
6. Approve the protected `production` environment.
7. A GitHub-hosted runner verifies every release checksum, opens a strict
   host-key-verified SSH connection, refreshes the stable deployment directory,
   injects immutable image references, validates the environment and merged
   Compose configuration, pulls images and deploys the stack.
8. HTTPS smoke tests run against edge, backend, AI-service and frontend.
9. GHCR credentials and remote staging files are removed, and deployment evidence
   is returned as a retained GitHub Actions artifact.

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
