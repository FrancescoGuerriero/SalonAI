# SalonAI Frontend

React 19 and Vite client for the SalonAI management application. Use Node.js 20.19+ or 22.12+ and npm 10+.

## Setup

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Install dependencies locally on the current operating system; do not reuse a `node_modules` folder copied from another platform.

The API base URL is configured through `VITE_API_URL` and defaults to `http://localhost:5000/api`.

## Build

```powershell
npm run build
```

The production output is written to `dist/` and is excluded from source control.
