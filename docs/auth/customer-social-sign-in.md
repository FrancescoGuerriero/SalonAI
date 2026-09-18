# Customer Social Sign-In

SalonAI customer authentication supports five entry methods:

- Google
- Facebook
- Microsoft
- Yahoo
- SalonAI email + password

## Identity model

The SalonAI `User` remains the canonical account. A `SocialIdentity` links one external provider subject to that account.

Provider access tokens are used only during the authentication exchange and are not stored as customer account credentials.

A customer created through a social provider may exist without a SalonAI password. If that customer later completes SalonAI password reset, password authentication becomes available in addition to the linked provider.

## Sign in vs authorization

Customer social sign-in requests identity/basic-profile scopes only.

It must not request:

- Google Calendar;
- Microsoft Calendar;
- Yahoo Mail/contacts/calendar;
- Facebook publishing/content permissions.

Staff external-calendar synchronization is a separate authorization flow and separate data model. Prefer separate OAuth client/app-registration credentials for customer sign-in and staff calendar synchronization so identity-only consent cannot accidentally expand into calendar access.

## Registration

When a provider subject has never been seen before and its email does not already belong to a SalonAI User:

1. create a `customer` User;
2. create the SocialIdentity;
3. create or attach the canonical Customer profile;
4. establish the normal SalonAI refresh/access-token session;
5. route the customer to the customer account experience.

The provider cannot choose the SalonAI role.

## Existing-account collision policy

A social sign-in must not silently claim an existing SalonAI account by matching only an email address.

If the provider email already belongs to a customer account but no provider identity is linked, SalonAI returns an account-link-required response. The customer must sign in through an existing method and explicitly link the provider from account settings in a follow-up increment.

If the email belongs to a staff/management account, public customer social sign-in must not link it. Staff social identity linking requires an authenticated staff session.

This policy prevents a customer OAuth callback from becoming a privilege-escalation path.

## Provider configuration

Secrets remain outside source control. Configure the matching Client ID, Client Secret and exact callback URI for each provider.

Google uses OpenID Connect identity scopes.

Microsoft uses OpenID Connect plus delegated `User.Read` to resolve the signed-in profile.

Yahoo uses OpenID Connect.

Facebook uses Facebook Login with email and public-profile identity information. `FACEBOOK_GRAPH_VERSION` must be explicitly configured rather than silently pinned in source.

## Frontend

Both Login and Create Account display all supported providers. Providers remain disabled until the backend reports that the required environment configuration exists.

After an OAuth callback, the backend sets the existing HttpOnly SalonAI refresh cookie and redirects to Login. The frontend completes the session through `/api/auth/refresh`; SalonAI access tokens are not placed in callback URLs.

Customers default to `/account`. Management roles default to `/dashboard`.
