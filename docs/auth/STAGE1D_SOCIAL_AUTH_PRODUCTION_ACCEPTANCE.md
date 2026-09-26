# Stage 1D — Customer Social Identity Production Acceptance

**Roadmap:** AI Intelligent Business Platform v2.9  
**Reference vertical:** SalonAI  
**Issue:** #253  
**Implementation owner:** Developer 1  
**Providers:** Google, Facebook, Microsoft, Yahoo  
**Depends on:** Stage 1A identity boundary and Stage 1C HCI/browser acceptance

## 1. Scope

Stage 1D completes the production acceptance contract for customer social identity without creating a second account system.

The canonical SalonAI `User` remains the application identity. External providers are authentication factors represented through `SocialIdentity`. Customer social sign-in remains separate from staff Google/Outlook calendar OAuth.

This stage has two layers:

1. **source and browser security acceptance** that can be automated in CI;
2. **provider-backed production acceptance** that can only be declared complete when production provider credentials, redirect URIs and controlled provider test accounts are available.

No provider secret or external test-account credential is stored in source control.

## 2. Security research basis

The implementation was reviewed against current OAuth/OIDC guidance.

### OAuth 2.0 Security BCP

RFC 9700 requires clients to prevent CSRF. If PKCE or a validated OIDC nonce is not providing that protection, one-time state must be securely bound to the user agent. For confidential clients PKCE is recommended as an additional defence against authorization-code injection.

Reference:
- https://www.rfc-editor.org/rfc/rfc9700

### Google

Google's server-side OpenID Connect guidance requires an anti-forgery state token to be stored in the user's session and matched on return. Google's web-server OAuth guidance also describes hashing a cookie/client-state value into `state` to prove request and response originated in the same browser.

References:
- https://developers.google.com/identity/openid-connect/openid-connect
- https://developers.google.com/identity/protocols/oauth2/web-server

### Microsoft

Microsoft recommends Authorization Code + PKCE + OIDC for standard server-based applications as well as other supported application types.

Reference:
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow

### Yahoo

Yahoo documents PKCE parameters and explicitly recommends a unique state token cryptographically bound to a browser cookie for CSRF mitigation.

Reference:
- https://developer.yahoo.com/sign-in-with-yahoo/

## 3. Browser-bound OAuth transaction

Before Stage 1D, SalonAI signed the state JWT, which protected its contents against tampering, but the state was not independently bound to the browser that started the flow.

Stage 1D adds a provider-specific browser transaction:

1. SalonAI generates 32 random bytes using Node's cryptographic RNG.
2. Only the SHA-256 hash of that value is included in the signed, 10-minute OAuth state JWT.
3. The raw random value is stored in an HttpOnly browser cookie.
4. The cookie name is provider- and transaction-specific, so concurrent same-provider flows in separate tabs do not overwrite each other; it is scoped to that provider's callback path.
5. The cookie uses `SameSite=Lax`, allowing it on the top-level redirect back from the identity provider while reducing unrelated cross-site cookie delivery.
6. Production cookies use `Secure`.
7. The callback verifies the state signature, provider and browser-binding hash.
8. The hash comparison uses `timingSafeEqual`.
9. A valid transaction cookie is cleared before cancellation handling, code exchange, account linking or login completion, giving normal browser flows one-use semantics.
10. A missing or mismatched cookie fails with `SOCIAL_AUTH_BROWSER_BINDING_FAILED`.

The state and cookie expire on the same 10-minute security window.

## 4. Secret-handling boundary

The OAuth start/link response deliberately returns only:

- `success`;
- `provider`;
- `authorizationUrl`.

The browser transaction value is set only through `Set-Cookie`; it is never included in JSON, query parameters, application local storage or source-controlled configuration.

The cookie is:

- `HttpOnly`;
- `SameSite=Lax`;
- `Secure` in production;
- named with both provider and signed transaction ID so concurrent flows remain isolated;\n- scoped to `/api/auth/social/{provider}/callback`;
- limited to ten minutes.

Both social start/link responses and callback responses use no-store/no-cache headers.

## 5. Identity and privilege invariants

Stage 1D preserves the already-established security boundaries:

- a new provider-only account is always created as `customer`;
- provider email does not silently claim an existing SalonAI account;
- an existing same-email customer must explicitly link the provider from the authenticated account;
- an identity matching a staff account cannot use the customer social-link shortcut;
- a provider identity cannot be linked to multiple SalonAI users;
- unlinking cannot remove the customer's final usable sign-in method;
- customer identity scopes remain identity-only;
- staff calendar authorization remains a separate OAuth subsystem;
- the callback never promotes role or permission data from a provider profile.

## 6. Automated acceptance implemented

`backend/src/test/socialAuth.test.js` now verifies:

- all four supported customer providers remain present;
- generated state contains a browser-binding hash and a signed unique transaction ID;
- the raw browser transaction value validates only against its matching state;
- a missing or different browser value returns `SOCIAL_AUTH_BROWSER_BINDING_FAILED`;
- transaction cookies are HttpOnly, Lax, callback-scoped and ten minutes;\n- two concurrent same-provider authorizations receive different signed transaction IDs and different cookie names;
- the start endpoint sets the transaction cookie and uses no-store;
- the transaction secret is absent from the JSON response;
- a valid cancellation callback consumes/clears the cookie;
- a mismatched-browser callback is rejected before provider processing;
- rejected callbacks expose a controlled error code for frontend recovery;
- the login and connected-account UI contain recovery copy for this condition;
- identity scopes remain separate from calendar/mail scopes.

Existing readiness, account-linking and final-sign-in-method tests remain part of the same gate.

## 7. Production readiness workflow

SalonAI already has the protected manual workflow:

`.github/workflows/production-social-auth-readiness.yml`

and runtime checker:

`backend/scripts/checkSocialAuthReadiness.js`.

The readiness contract verifies, without printing secrets:

- provider client ID exists;
- provider client secret exists;
- provider redirect URI exists;
- redirect URI is syntactically valid;
- callback path exactly matches the provider;
- production redirects use HTTPS and are not loopback addresses;
- redirect URIs contain no credentials, query or fragment;
- Facebook Graph version is configured where required;
- production container release/version evidence matches the requested release.

This workflow is deliberately read-only. It does not mutate accounts and does not pretend that configuration readiness proves provider authentication.

## 8. SalonAI production activation values

For the current SalonAI production domain, register these exact web-server callback URIs with the identity providers:

- Google: `https://salonai.francescopicardi.co.uk/api/auth/social/google/callback`
- Facebook: `https://salonai.francescopicardi.co.uk/api/auth/social/facebook/callback`
- Microsoft: `https://salonai.francescopicardi.co.uk/api/auth/social/microsoft/callback`
- Yahoo: `https://salonai.francescopicardi.co.uk/api/auth/social/yahoo/callback`

The production backend reads the following environment variables from the protected server environment:

- `SOCIAL_GOOGLE_CLIENT_ID`
- `SOCIAL_GOOGLE_CLIENT_SECRET`
- `SOCIAL_GOOGLE_REDIRECT_URI`
- `SOCIAL_FACEBOOK_CLIENT_ID`
- `SOCIAL_FACEBOOK_CLIENT_SECRET`
- `SOCIAL_FACEBOOK_REDIRECT_URI`
- `FACEBOOK_GRAPH_VERSION`
- `SOCIAL_MICROSOFT_CLIENT_ID`
- `SOCIAL_MICROSOFT_CLIENT_SECRET`
- `SOCIAL_MICROSOFT_REDIRECT_URI`
- `SOCIAL_YAHOO_CLIENT_ID`
- `SOCIAL_YAHOO_CLIENT_SECRET`
- `SOCIAL_YAHOO_REDIRECT_URI`

Do not place client secrets in source control, GitHub issues, chat messages, screenshots or browser-delivered configuration. Store them only in the protected production environment used by the backend.

After configuration, restart/redeploy the backend and verify **System Administration → Sign-in providers**. The Login and Create Account pages automatically enable each provider reported as configured; no frontend code switch is required.

## 9. Provider-backed acceptance matrix

A provider is **Accepted** only after the configured production environment has passed all applicable rows below using controlled test accounts.

| Acceptance | Google | Facebook | Microsoft | Yahoo |
| --- | --- | --- | --- | --- |
| Readiness checker reports configured and valid | Required | Required | Required | Required |
| Start endpoint sets browser-bound transaction cookie | Required | Required | Required | Required |
| Provider authorization screen opens using intended identity scopes | Required | Required | Required | Required |
| Cancel returns safely and consumes transaction | Required | Required | Required | Required |
| New customer social registration succeeds | Required | Required | Required | Required |
| Existing linked customer login succeeds | Required | Required | Required | Required |
| Explicit account link succeeds from authenticated customer settings | Required | Required | Required | Required |
| Link cannot attach provider identity to another SalonAI user | Required | Required | Required | Required |
| Unlink succeeds when another sign-in method remains | Required | Required | Required | Required |
| Final usable sign-in method cannot be removed | Required | Required | Required | Required |
| Cross-browser/replayed callback is rejected | Required | Required | Required | Required |
| Staff-email collision does not become customer sign-in | Required | Required | Required | Required |
| Callback/refresh tokens are absent from browser URL/local storage | Required | Required | Required | Required |
| Login/link error and cancellation recovery are understandable | Required | Required | Required | Required |

Evidence should record provider, release tag, UTC timestamp, test case, result and sanitized diagnostic code. It must not record provider access tokens, authorization codes, client secrets, passwords or raw browser-binding cookies.

## 10. PKCE position

PKCE is not being enabled indiscriminately across all four providers in this change.

RFC 9700 recommends PKCE for confidential clients; Microsoft and Yahoo explicitly document it. Provider support and registration behaviour must be verified per provider before changing the production exchange contract. The browser-bound state implemented here is provider-neutral and immediately closes the CSRF/session-binding gap without assuming undocumented provider behaviour.

A future provider-specific PKCE change must include:

- S256 only;
- cryptographically random transaction-specific verifier;
- verifier stored outside the authorization URL/state;
- code challenge on the authorization request;
- verifier on the token exchange;
- callback consumption/replay tests;
- verified provider documentation and production acceptance.

This is a security-hardening follow-up, not a substitute for the Stage 1D browser-binding requirement.

## 10. User recovery behaviour

If the callback is stale, already consumed or opened in a different browser session:

- login shows a specific message explaining that the connected-account sign-in must be restarted from SalonAI;
- account linking shows a specific message and confirms the existing SalonAI sign-in remains unchanged;
- the failure does not create, link, unlink or authenticate an account.

## 11. Stage 1D completion rule

Source implementation is complete when CI, security, CodeQL and production-smoke gates pass.

Provider-backed production acceptance remains an **external configuration gate** until the production credentials/redirect registrations and controlled provider test accounts are available. The repository must not mark a provider Accepted solely because configuration variables exist.

After all four provider rows have evidence, DEV1 can close Stage 1D and proceed through the Stage 1 final integration gate.
