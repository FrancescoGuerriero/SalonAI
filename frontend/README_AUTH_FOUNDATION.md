# SalonAI Authentication Foundation

## Files added

- `src/context/AuthContext.jsx`
- `src/hooks/useAuth.js`
- `src/routes/ProtectedRoute.jsx`
- `src/routes/PublicRoute.jsx`
- `src/services/authService.js`
- `src/utils/token.js`
- `src/layouts/MainLayout.jsx`
- `src/components/Navbar.jsx`
- `src/pages/Unauthorized.jsx`

## Files replaced

- `src/api/axios.js`
- `src/App.jsx`
- `src/main.jsx`
- `src/pages/Login.jsx`
- `src/pages/Register.jsx`
- `src/pages/Dashboard.jsx`

## Installation

Copy the files into the frontend project, preserving the folder structure.

Create `.env` from `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Then run:

```powershell
npm install
npm run dev
```

## Backend compatibility

The login route must return a token under one of these fields:

```json
{
  "token": "..."
}
```

or:

```json
{
  "accessToken": "..."
}
```

An optional user object may also be returned:

```json
{
  "token": "...",
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "customer"
  }
}
```

If the token contains `name`, `email`, and `role` claims, the frontend derives the user from the JWT when no user object is returned.
