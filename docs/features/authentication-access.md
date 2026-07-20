# Authentication and Access Feature

Status: Approved
Date: 2026-07-19
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)
Product: [Product Scope and Language](../product/fullstack-garage-product.md)
Related features: [Vehicles](vehicles.md), [Service Records](service-records.md)
Operations: [Authentication and Access Operations Runbook](../operations/authentication-access-runbook.md)
Recovery: [Garage Admin Identity Recovery Runbook](../operations/authentication-access-recovery-runbook.md)
Security audit: [Authentication and Access Security Audit](../operations/authentication-access-security-audit.md)

## 1. Purpose

The Authentication and Access feature signs users into Fullstack Garage, maps
external identities to application-owned users, and establishes the role used by
server-enforced authorization.

For the MVP, Fullstack Garage is a mechanic-operated personal garage. The initial
Garage Admin signs in with Google through Supabase Auth. Friends whose Vehicles
are serviced do not need application accounts.

Authentication proves who the user is. Authorization separately determines which
Vehicles and Service Records that user may access.

## 2. Agreed Decisions

1. Supabase Auth is the MVP authentication provider.
2. Google is the only interactive sign-in method for the MVP.
3. Google is configured directly through Supabase Auth; Auth0 is not used.
4. The initial Garage Admin is provisioned through a controlled privileged
   operation, never through client-provided profile data.
5. Public sign-up is disabled after the initial Garage Admin has been
   bootstrapped.
6. Friends without accounts have no application access in the MVP.
7. The app-owned role model reserves `admin` and `member`, but only the Garage
   Admin is provisioned as an application user and authorized for protected
   feature access in the MVP.
8. The Garage Admin may manage all Vehicles and Service Records.
9. Member provisioning and member-specific application behavior are outside the
   MVP.
10. Supabase and Google identities never replace application-owned user IDs.
11. The application display name is copied from Google during initial user
    provisioning and stored as app-owned profile data.
12. Session duration, inactivity, access-token lifetime, and concurrent-session
    behavior use Supabase defaults. If a deployment has no defined provider
    defaults, use one day for both maximum session lifetime and inactivity.
13. A second Garage Admin identity is not required before production.
14. Custom API migration compatibility is an MVP design constraint, but the
    custom API and its authentication adapter are not part of this feature's
    Definition of Done.

## 3. MVP Scope

The MVP includes:

- Sign in with Google through Supabase Auth.
- Handling the OAuth redirect back to the SPA.
- Restoring an existing Supabase session when the application starts.
- Mapping the Supabase Auth identity to an application user.
- Loading the application user's role.
- Protecting authenticated routes.
- Distinguishing unauthenticated, unauthorized, and loading states.
- Signing out and clearing the local session.
- Server-enforced Garage Admin authorization through RLS.
- Controlled initial Garage Admin provisioning.
- Provider-neutral application contracts and adapter composition that permit a
  future custom API without changing feature UI or application-owned user IDs.

The MVP does not include:

- Auth0 or another third-party identity broker.
- Email-and-password, magic-link, phone, or passkey login.
- Public registration or friend onboarding.
- Member provisioning or member-facing application behavior.
- Account linking or identity-provider migration UI.
- User administration or role-editing screens.
- Password reset flows because the application does not own a password.
- Application-managed Google access or refresh tokens.
- Access to Google APIs beyond basic identity information.
- Application-level multi-factor enrollment.
- Multiple garages or tenant-scoped administrator roles.
- A custom HTTP API or `HttpAuthGateway` implementation.
- API-owned cookies, token issuance, or Supabase JWT validation by a custom
  backend.
- Identity-provider cutover, migration, or rollback tooling.

## 4. Identity and Role Model

The application owns its user and role model:

```ts
export type AppUserRole = 'admin' | 'member';

export interface AppUser {
  readonly id: AppUserId;
  readonly displayName: string;
  readonly role: AppUserRole;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

`member` is reserved for a future release so the app-owned model can evolve
without changing stable user IDs. A mapped user whose role is not `admin` receives
no protected feature access in the MVP.

The exact timestamp representation will follow repository-wide domain
conventions when implementation begins. Domain and application modules must not
depend on Supabase `User`, `Session`, JWT, or Google profile types.

The architecture's identity mapping remains:

```text
Google identity
  -> Supabase Auth user
    -> user_identities(provider = "supabase", provider_subject = auth user ID)
      -> app_users
```

Google is the upstream login provider, but the MVP identity mapping records the
stable Supabase Auth user ID. This preserves the option to associate another
provider with the same application user later.

The initial `displayName` is copied from the Google identity during application
user provisioning. It becomes app-owned profile data after that copy and must not
be silently overwritten on every sign-in. If Google does not provide a usable
display name, the controlled bootstrap operation must supply one.

The Supabase Postgres role named `authenticated` is not the Fullstack Garage
`admin` role. Garage Admin authority comes only from the app-owned
`app_users.role` value.

## 5. Sign-In Flow

1. An unauthenticated user selects **Continue with Google**.
2. The authentication gateway starts the Supabase Google OAuth flow with an
   approved callback URL.
3. Google authenticates the user and redirects through the Supabase callback.
4. Supabase redirects the browser to the application's authentication callback.
5. The SPA restores the Supabase session through the authentication adapter.
6. The application resolves the Supabase Auth user ID through
   `user_identities`.
7. The application loads the mapped `app_users` record and role.
8. An authorized user enters the requested protected route or the default
   dashboard.
9. A valid external identity without an application mapping, or with a role that
   is unsupported in the MVP, receives an access-unavailable screen and cannot
   access protected data.

The application must preserve only validated, local return paths across the
redirect. It must not accept arbitrary external return URLs.

## 6. Session States

The application should model authentication state explicitly:

```ts
export type AuthenticationState =
  | { readonly status: 'initializing' }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'authenticated'; readonly user: AppUser }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'error'; readonly message: string };
```

- Protected content must not render while the initial session is loading.
- An expired or revoked session returns the user to the sign-in screen.
- Signing out clears authenticated application state and cached private data.
- Refresh and deep-link navigation must restore the intended protected route
  after successful authentication.
- Authentication state changes must have one application-level owner rather than
  independent route or feature listeners.

The MVP uses the Supabase session defaults:

- No maximum session lifetime is configured.
- No inactivity timeout is configured.
- Multiple active sessions are allowed.
- The access token uses Supabase's default one-hour lifetime and is refreshed by
  the Supabase client while the session remains valid.

These are provider configuration decisions rather than application timers. If an
environment cannot supply or document equivalent defaults, configure both a
one-day maximum session lifetime and a one-day inactivity timeout before that
environment is used.

## 7. Application Boundary

Presentation code depends on an app-owned gateway rather than the Supabase SDK:

```ts
export type AuthenticationResult =
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'authenticated'; readonly user: AppUser };

export interface AuthGateway {
  restore(): Promise<AuthenticationResult>;
  signInWithGoogle(returnPath?: string): Promise<void>;
  signOut(): Promise<void>;
}
```

`AuthenticationResult` distinguishes an absent session from a valid external
identity that has no Fullstack Garage access. Token refresh, browser storage,
cookies, provider callbacks, and session-change events are adapter details. The
application authentication controller owns state transitions and calls
`restore()` after startup, authentication callbacks, and recoverable session
failures.

For the MVP, a mapped application user is authorized only when its app-owned role
is `admin`. A mapped non-admin identity produces the `unauthorized` result.

The implementation dependency direction is:

```text
Authentication screen or provider
  -> application authentication workflow
    -> AuthGateway
      -> SupabaseAuthGateway
        -> Supabase Auth
```

Only modules under `src/infrastructure/supabase/auth/` may call Supabase Auth or
map Supabase session and error types. Feature hooks, route guards, and application
use cases consume app-owned states and errors. The selected adapter is installed
in the application composition root; features must not choose adapters or inspect
environment variables.

## 8. Application Use Cases

The application layer should expose these workflows:

- `restoreAuthentication`
- `signInWithGoogle`
- `completeAuthenticationRedirect`
- `getCurrentAppUser`
- `signOut`

Role assignment, account promotion, and identity reassignment are privileged
administrative operations and are not browser use cases in the MVP.

## 9. Persistence and Provisioning

The `app_users` table contains:

- `id uuid primary key`
- `display_name text not null`
- `role text not null default 'member'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- A check constraint limiting `role` to `admin` or `member`.

The `member` default is a deny-by-default provisioning state. It grants no
protected feature access in the MVP; the controlled bootstrap promotes only the
verified Garage Admin identity to `admin`.

The `user_identities` table contains:

- `id uuid primary key`
- `user_id uuid references app_users`
- `provider text not null`
- `provider_subject text not null`
- `created_at timestamptz not null`
- A unique constraint on `(provider, provider_subject)`.

For the MVP, `provider` is `supabase` and `provider_subject` is the Supabase Auth
user ID. A controlled onboarding function or trigger creates the application user
and identity mapping without trusting role, owner, or authorization values from
Google metadata or browser input. The function may copy Google's display name as
descriptive profile data, but that value has no authorization effect.

Initial Garage Admin bootstrap:

1. Configure Google authentication for the environment.
2. Allow the intended Garage Admin to complete the first sign-in.
3. Verify the expected Supabase identity and application-user mapping.
4. Promote that specific application user to `admin` through a reviewed migration
   or other privileged administrative operation.
5. Disable new user sign-up.
6. Verify that another Google identity cannot create an authorized application
   account or read protected data.

The bootstrap process must be repeatable for local, staging, and production
without committing an email address, provider subject, token, or secret to source
control.

## 10. Supabase and Google Configuration

Each environment requires its own approved configuration:

- Google OAuth client ID and secret.
- Authorized JavaScript origins.
- Supabase OAuth callback URL.
- Application site URL and allowed redirect URLs.
- Local development callback configuration.
- Supabase public project URL and publishable/anonymous key.
- Default Supabase session controls, unless an environment requires the documented
  one-day fallback.

The Google client secret belongs in Supabase provider configuration or an
approved local secret environment variable. It must not use a Vite-exposed
variable or enter the SPA bundle.

Only the Supabase public URL and publishable/anonymous key may be exposed to the
browser. A Supabase secret or service-role key must never be present in frontend
configuration, logs, source control, or build output.

Redirect URLs must be explicit for local, staging, and production environments.
Wildcard production redirects should be avoided. Custom Google consent-screen
branding and an authentication custom domain may be introduced before a broader
public launch.

## 11. Authorization

Route guards improve the user experience but do not enforce data security. RLS
and database functions remain authoritative.

Required behavior:

- A Garage Admin can manage every Vehicle and Service Record.
- A mapped identity whose role is not `admin` has no protected feature access in
  the MVP.
- An authenticated identity without an application-user mapping has no protected
  data access.
- An unauthenticated user has no protected data access.
- Browser users cannot read or change `app_users.role` through application data
  access.
- A browser caller cannot choose an owner ID or role to expand access.
- Aggregate Service Record functions resolve and enforce the acting application
  user and require the Garage Admin role inside the database transaction.

Stable SQL helpers should resolve the current application user ID and role from
the Supabase Auth identity. Any security-definer helper must use a fixed, safe
search path and the minimum privileges required.

## 12. Error Handling

Infrastructure errors must be mapped to app-owned outcomes suitable for the UI:

- Sign-in was cancelled.
- Google sign-in is temporarily unavailable.
- The OAuth callback is invalid or expired.
- The Supabase session expired or was revoked.
- The identity is valid but has no Fullstack Garage access.
- Application-user provisioning failed.
- Sign-out failed locally or remotely.

Screens should provide a safe retry path without displaying raw Supabase error
codes, tokens, callback parameters, or provider payloads.

## 13. Security and Privacy

- Do not log access tokens, refresh tokens, authorization codes, Google profile
  payloads, or callback query strings.
- Do not store Google provider tokens because the MVP does not call Google APIs.
- Let the Supabase client manage its own session; do not copy tokens into
  application state, analytics, or custom storage.
- Clear private query caches and feature state during sign-out and identity
  changes.
- Use HTTPS for staging and production callbacks.
- Require exact production redirect origins.
- Keep role assignment in app-owned database state rather than editable Google
  metadata or user-controlled JWT claims.
- Encourage the Garage Admin to enable multi-factor protection on their Google
  account. Application-level MFA may be added later if the risk warrants it.
- Document a privileged account-recovery procedure before production so loss of
  the initial Google identity does not make the garage data permanently
  inaccessible.
- A second Garage Admin is not required for production. Recovery must therefore
  not depend on another administrator already existing inside the application.

## 14. Presentation Behavior

- The sign-in screen offers one primary **Continue with Google** action.
- No registration, password, reset-password, or provider-selection controls are
  shown in the MVP.
- A full-page initialization state prevents protected content from flashing
  before session restoration completes.
- Cancelled sign-in returns to a usable sign-in screen.
- Unauthorized identities see an access-unavailable message and a sign-out
  action.
- Authenticated navigation identifies the current application user and provides
  a sign-out action.
- Product copy uses **Garage Admin** for the mechanic/operator role.

Detailed layout and styling must follow the root `DESIGN.md` when UI work begins.

## 15. Relationship to Vehicles and Service Records

Authentication is ready to enable the Vehicle feature when it provides:

- A stable `AppUserId` independent of Google and Supabase models.
- A trusted Garage Admin role.
- A current-user lookup available to application workflows.
- RLS helpers for application user and role resolution.
- Reliable sign-out cleanup for cached Vehicle data.

The Garage Admin may then manage Vehicles and Service Records across the garage.
Member behavior is outside the MVP. Friends without accounts are represented only
by the Vehicles being serviced; the application does not store their identity or
real-world Vehicle ownership data.

`performedBy` on a Service Record is descriptive maintenance data. It must not be
used as an authentication or authorization identity.

## 16. Verification Strategy

Unit tests should cover:

- Authentication-state transitions.
- App-owned mapping from adapter results to `AppUser`.
- Garage Admin role recognition and non-admin denial.
- Protected-route decisions.
- Safe local return-path validation.
- App-owned error mapping.

Adapter and integration tests should cover:

- Session restoration.
- Every `AuthenticationResult` outcome.
- Application-user and identity provisioning.
- Sign-out and private-cache cleanup.
- Rejected access for an unmapped identity.
- Environment-specific callback configuration.

Define the `AuthGateway` behavior once as a shared contract suite. The
`SupabaseAuthGateway` must pass it for the MVP. A future `HttpAuthGateway` must
pass the same suite before replacing the Supabase adapter.

RLS integration tests must exercise:

- A Garage Admin.
- A mapped non-admin identity.
- An authenticated but unprovisioned identity where supported by the test setup.
- An unauthenticated user.
- Rejected browser role escalation.

A staging smoke test should complete the real Google redirect, restore the
session after a page refresh, enter a deep-linked protected route, and sign out.
Automated tests must not depend on a developer's personal Google account.

## 17. Acceptance Criteria

- The initial Garage Admin can sign in with Google and reach protected routes.
- Refreshing the SPA preserves a valid session without exposing protected content
  during initialization.
- The application resolves an app-owned user and role before loading private
  feature data.
- The initial application display name is copied from Google and is not silently
  resynchronized on later sign-ins.
- Supabase default session controls are used, with the documented one-day fallback
  available for an environment without defined defaults.
- Public registration is disabled after bootstrap.
- Another Google identity cannot access protected data.
- A mapped non-admin identity cannot access protected feature data or promote
  itself.
- A Garage Admin can access every Vehicle and Service Record through
  server-enforced policies.
- Sign-out removes access and clears private client state.
- Presentation, domain, and application modules do not import Supabase types or
  inspect provider tokens.
- The composition root selects `SupabaseAuthGateway`; feature modules do not
  contain provider-selection logic.
- `SupabaseAuthGateway` passes the shared app-owned authentication contract tests.
- No Supabase secret key, Google client secret, or private token is present in the
  frontend bundle or logs.

## 18. Future Migration Compatibility — Not MVP Scope

This section constrains the MVP design so Supabase can be replaced safely. It
does not add the custom API, `HttpAuthGateway`, new identity provider, or migration
tooling to the current feature's Definition of Done.

### 18.1 MVP portability guardrails

The following guardrails are required by the MVP Definition of Done:

- Preserve `app_users.id` as the stable ownership ID used by Vehicles and Service
  Records.
- Keep external subjects in `user_identities`; do not use a Supabase or Google ID
  as a domain foreign key.
- Keep Supabase SDK types, tokens, callbacks, and errors inside the Supabase
  infrastructure adapter.
- Return only app-owned users, authentication results, and errors through
  `AuthGateway`.
- Select the concrete gateway in one composition root.
- Keep authorization roles in app-owned data rather than provider metadata.
- Express authorization behavior in application language so a future API can
  enforce the current Garage Admin rules and add future roles deliberately.
- Run the shared authentication contract suite against `SupabaseAuthGateway`.

These guardrails are implemented now because they prevent provider coupling. No
future adapter or backend endpoint needs to be built to satisfy them.

### 18.2 Deferred migration implementation

The following work is explicitly deferred and is not required for MVP completion:

- Building a custom authentication or application API.
- Implementing `HttpAuthGateway`.
- Moving token refresh or session storage to server-managed cookies.
- Validating Supabase-issued access tokens in a custom backend.
- Establishing credentials with a replacement identity provider.
- Running identity cutover, overlap, rollback, or Supabase retirement workflows.
- Replacing RLS with API authorization as the primary enforcement boundary.

### 18.3 Staged migration path

When a custom API becomes necessary, migrate in reversible stages:

1. Introduce the API while retaining Supabase Auth. The API validates the current
   Supabase-issued identity and resolves it to an app-owned user.
2. Move data access behind HTTP repository adapters without changing the SPA's
   application models, user IDs, or feature authorization rules.
3. Add `HttpAuthGateway` only when the custom API begins owning authentication
   sessions. It must satisfy the existing `AuthGateway` contract suite.
4. Add the replacement provider subject to `user_identities` and associate it
   with the existing `app_users.id`.
5. Run both identity paths during a controlled overlap period and verify owner
   access to Vehicles and Service Records.
6. Retire the Supabase identity only after the replacement path, recovery, and
   rollback procedures have been verified.

Once the custom API is the primary boundary, it derives the acting user from a
validated session and enforces the same app-owned roles. RLS may remain as defense
in depth during transition, but the API must not trust browser-supplied user IDs
or roles.

### 18.4 Stable migration invariants

Throughout migration:

```text
Authentication provider may change
Session transport may change
AuthGateway adapter may change

AppUserId does not change
Vehicle ownership does not change
Service Record ownership does not change
Feature UI and application use cases remain independent of provider contracts
```

## 19. Open Decisions

The following decisions remain before implementation or production release:

1. When to introduce a custom authentication domain and verified Google branding.
2. Whether application-level TOTP MFA should be required in a later release.

Resolved on 2026-07-20: loss of the sole Garage Admin Google identity uses an
authorized, two-person-reviewed, atomic no-overlap replacement of its Supabase
identity mapping. Recovery preserves the admin `AppUserId`, retains the old
`auth.users` row unmapped for audit, maps the verified replacement identity to
the existing admin, and removes only the orphaned provisional member. See the
[Garage Admin Identity Recovery Runbook](../operations/authentication-access-recovery-runbook.md).

## 20. Review History

Append a new row for every approved update. Existing review entries must remain
unchanged so the decision history is preserved.

| Date | Status | Reviewed by | Summary |
| --- | --- | --- | --- |
| 2026-07-19 | Approved | Product owner | Approved the MVP authentication and access design using Google through Supabase Auth. |
| 2026-07-19 | Approved update | Product owner | Approved Google-sourced initial display names, Supabase default session controls with a one-day fallback, and a single Garage Admin for production. |
| 2026-07-19 | Approved update | Product owner | Added custom API migration guardrails while keeping future adapters, backend implementation, and identity cutover outside the MVP Definition of Done. |
| 2026-07-19 | Approved update | Product owner | Limited MVP access to the Garage Admin and deferred member provisioning and member-specific behavior. |
| 2026-07-20 | Approved update | Product owner | Resolved sole-admin recovery with an authorized two-person atomic identity-mapping replacement that preserves the admin AppUserId and retains the old auth row unmapped for audit. |

## 21. Primary References

- [Supabase Auth overview](https://supabase.com/docs/guides/auth)
- [Supabase Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Auth general configuration](https://supabase.com/docs/guides/auth/general-configuration)
- [Supabase Auth users and server-only administration](https://supabase.com/docs/guides/auth/users)
- [Supabase user sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase multi-factor authentication](https://supabase.com/docs/guides/auth/auth-mfa)
