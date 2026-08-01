# SalonAI Phase 7.13 — CI/CD and software-supply-chain automation

## Outcome

Phase 7.13 moves the Phase 7.12 security policy into GitHub-hosted automation. Pull requests and changes to `main` are validated before release. Semantic version tags build immutable GHCR images for the backend, frontend and AI service, generate CycloneDX SBOMs, create GitHub artifact attestations and publish release/rollback evidence.

This phase does not deploy to a production server. It creates trusted, verifiable release artifacts that a later deployment phase can consume.

## Installed controls

- Backend `npm run validate` on pull requests and `main`.
- Frontend clean install and Vite production build.
- AI-service dependency installation, byte-code compilation and pytest execution when tests are present.
- GitHub dependency review with HIGH severity enforcement.
- Trivy repository scanning using the controlled Phase 7.12 ignore file.
- Trivy SARIF upload to GitHub code scanning.
- CodeQL analysis for JavaScript/TypeScript and Python, including a weekly scan.
- Dependabot updates for GitHub Actions, backend/frontend npm dependencies, AI-service Python dependencies and all three Dockerfiles.
- GHCR publication for three production images.
- CycloneDX SBOM and Trivy evidence for every release image.
- GitHub provenance and SBOM attestations bound to immutable image digests.
- Consolidated release manifest, SHA-256 checksums and rollback metadata.

## First-time repository configuration

After committing and pushing the Phase 7.13 files:

1. Open the GitHub repository **Settings → Actions → General**.
2. Confirm GitHub Actions are enabled.
3. Under **Workflow permissions**, allow read and write permissions so the release workflow can publish GHCR images, attestations and GitHub release assets.
4. Open **Settings → Code security and analysis** and enable the dependency graph and code scanning features available to the public repository.
5. Open a pull request to allow `SalonAI CI` and `SalonAI CodeQL` to run once.
6. Open **Settings → Branches → Add branch protection rule** for `main`.
7. Require the checks listed in `config/release/phase7-13-policy.json` after GitHub has recorded their first runs.
8. Require pull requests before merging and prevent force pushes to `main`.

No external registry password is required. The release workflow authenticates to GHCR with the repository-scoped `GITHUB_TOKEN`.

## Local verification

```powershell
powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\verify-phase7-13.ps1" `
    -ProjectRoot "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI"
```

## Commit the phase

```powershell
Set-Location "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI"
git status
git add .github config/release scripts/ci scripts/release scripts/verify-phase7-13.ps1 docs/operations docs/runbooks
git commit -m "feat(ci): add Phase 7.13 release automation"
git push origin main
```

Review `git status` before committing so unrelated generated security reports, backups or environment files are not included.

## Publish a release

Create the next semantic version only after `main` is clean, pushed and passing:

```powershell
powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\release\publish-release-tag.ps1" `
    -ProjectRoot "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI" `
    -Version "7.3.0"
```

The script creates and pushes the annotated tag `v7.3.0`. The tag triggers the release workflow.

## Published image names

The owner is normalized to lowercase for OCI compatibility:

- `ghcr.io/francescoguerriero/salonai-backend:<release-tag>`
- `ghcr.io/francescoguerriero/salonai-frontend:<release-tag>`
- `ghcr.io/francescoguerriero/salonai-ai-service:<release-tag>`

The release manifest records immutable `image@sha256:digest` references. Later deployments and rollbacks should use the digest, not only a mutable tag.

## Verify attestations

After a successful release and `gh auth login`:

```powershell
powershell `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File ".\scripts\release\verify-ghcr-attestations.ps1" `
    -ReleaseTag "v7.3.0"
```

## Phase 7.12 exception expiry

The two approved dependency exceptions expire on **14 August 2026**. The GitHub Trivy gate uses `config/security/trivyignore.yaml`; once an exception expires, the release is expected to fail until the dependency is genuinely upgraded or a new, justified and time-limited decision is recorded.

## Operational boundary

Phase 7.13 publishes trusted artifacts but does not connect to a production host, run database migrations or replace running containers. Those responsibilities belong to the deployment phase and require environment-specific credentials, approvals, health checks and rollback execution.
