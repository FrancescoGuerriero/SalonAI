# SalonAI Phase 8.4.2 — Local API Origin Fix

## Problem

The frontend was being opened at `http://127.0.0.1:5173`, while the Axios
client defaulted to `http://localhost:5000/api` and the backend development
CORS origin defaulted to `http://localhost:5173`.

Because `localhost` and `127.0.0.1` are different browser origins, API-backed
pages could fail with generic frontend messages such as:

`Products could not be loaded.`

## Fix

- Vite development now always calls the same-origin `/api` path.
- The existing Vite proxy forwards `/api` to `http://127.0.0.1:5000`.
- The access-token refresh client uses the same origin strategy.
- Production still supports an explicit `VITE_API_URL`; otherwise `/api` is
  used behind the deployed edge.
- Shop and Product Details now display `collectionName` consistently.

## Scope

Frontend only. No database mutation. No production deployment.

## Acceptance

After installing:

1. restart Vite;
2. open `http://127.0.0.1:5173/shop`;
3. confirm the Davines catalogue loads;
4. confirm Services/Stylists/About still work;
5. run the frontend production build.
