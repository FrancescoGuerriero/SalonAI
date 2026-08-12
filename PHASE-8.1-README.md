# SalonAI Phase 8.1 — Session Resilience

This package contains **complete replacement files** for the first post-v8.0.0 VS Code development increment.

## Goal

Replace the current single long-lived access-token session with:

- short-lived access JWTs;
- a separate refresh JWT signed by `JWT_REFRESH_SECRET`;
- an HttpOnly refresh cookie;
- refresh-token rotation;
- automatic one-time Axios refresh/retry on HTTP 401;
- client state synchronisation after token refresh;
- server-side refresh-cookie clearing during logout;
- environment validation that prevents identical access/refresh signing secrets;
- backend regression tests for token separation and cookie policy.

## Replacement files

Copy these files into the matching project paths, replacing the existing files:

1. `backend/src/config/env.js`
2. `backend/src/controllers/authController.js`
3. `backend/src/routes/authRoutes.js`
4. `frontend/src/api/axios.js`
5. `frontend/src/Services/authService.js`
6. `frontend/src/context/AuthContext.jsx`

Add this new test file:

7. `backend/src/test/authSession.test.js`

No npm dependency is added by this increment.

## Local environment

The existing config already has development-only fallback JWT secrets. For local testing you may keep those defaults, but using explicit local secrets is preferred.

Recommended local `.env` values:

```dotenv
ACCESS_TOKEN_MINUTES=15
REFRESH_TOKEN_DAYS=7
```

Production already has separate `JWT_SECRET` and `JWT_REFRESH_SECRET`; do not print or replace production secrets while doing local development.

## Validate from project root

### Backend

```powershell
cd .\backend
npm run validate
cd ..
```

### Frontend

```powershell
cd .\frontend
npm run validate
cd ..
```

### Git status

```powershell
git status --short
git diff --check
```

## Manual acceptance test

1. Start backend and frontend.
2. Log in.
3. Confirm normal authenticated pages work.
4. In browser DevTools > Application > Cookies, verify `salonai_refresh_token` is present and HttpOnly.
5. Confirm the refresh token is **not** present in Local Storage.
6. Reload the page; the account session should restore.
7. Test logout; the app should return to logged-out state and the refresh cookie should be cleared.
8. For a fast refresh test, temporarily set `ACCESS_TOKEN_MINUTES=1` locally, restart backend, log in, keep the app open for over one minute, then perform an authenticated action. It should succeed after an automatic refresh rather than forcing a new login.
9. Restore `ACCESS_TOKEN_MINUTES=15` after the test.

## Release discipline

Do not overwrite the immutable `v8.0.0` tag. After local validation, this should be committed on a new branch and released later as a new version (for example `v8.1.0`) through the existing protected release/deployment process.
