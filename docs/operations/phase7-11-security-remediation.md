# SalonAI Phase 7.11 Security Remediation

## Scope

This remediation addresses the blockers identified by the Phase 7.11 enforced release gate:

- critical vulnerabilities in the backend runtime image caused by the npm toolchain bundled in the Node base image;
- critical OpenSSL vulnerabilities inherited from the frontend Alpine 3.21 runtime image;
- the high-severity non-root-user misconfiguration in `ai-service/Dockerfile`.

## Changes

### Backend

The production runtime stage is moved to `node:22.23.1-alpine3.24`, Alpine packages are upgraded during the build, and npm/npx are removed from the final runtime layer. npm remains available in earlier build stages and is not required to run the Express API.

### Frontend

The Nginx runtime stage is moved to `nginx:1.30.4-alpine3.24`, and Alpine packages are upgraded during the build.

### AI development image

The development Dockerfile runs under numeric user and group `10001:10001` with a writable temporary home directory.

## Non-blocking dependency advisories

The repository report also identifies three HIGH dependency advisories. They do not block the current release policy:

- React Router 7.18.1 has an advisory affecting unstable React Server Components APIs. The patched release is React Router 8.3.0, which is a major-version migration and therefore requires a separate compatibility sprint.
- Two backend lockfile findings remain visible even when their packages are absent from the final production runtime image. They should be removed during the dependency-maintenance sprint rather than by unsafe forced overrides.

## Rollback

The remediation script creates a timestamped backup under `backups/phase7-11-security-remediation-*` before changing application Dockerfiles.
