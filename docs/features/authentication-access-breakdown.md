# Authentication and Access Implementation Breakdown

Status: Ready for implementation
Source: [Authentication and Access Feature](authentication-access.md)
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)

## Execution Guidance

Complete these tasks in order unless a task explicitly identifies a dependency
that is not yet available. Each task is intended to be executed in a separate
Codex turn. Codex should read the repository `AGENTS.md` and the linked feature
specification before starting a task, limit changes to that task, and report the
files changed and verification performed.

After every code change, run the relevant targeted tests plus:

```text
npm run typecheck
npm run lint
npm run build
```

Once the test runner is installed, also run `npm test` for every affected test
suite. UI tasks must read the root `DESIGN.md` before making changes.

## Phase 1: Foundations and Contracts

- [ ] **Task 1: Add authentication and test dependencies**

  Add React Router, Supabase JS, Vitest, Testing Library, and jsdom using npm.
  Configure a repository-native `npm test` command without implementing
  authentication behavior. Confirm the locked Node.js and npm conventions remain
  intact.

- [ ] **Task 2: Create the application-owned user model**

  Add `AppUserId`, `AppUserRole`, and `AppUser` under `src/domain/users/`. Keep
  the model independent of React, Supabase, JWT, session, and Google profile
  types. Add an explicit helper for recognizing an MVP Garage Admin.

- [ ] **Task 3: Define authentication contracts**

  Add `AuthenticationState`, `AuthenticationResult`, app-owned authentication
  errors, and `AuthGateway` under `src/application/`. Ensure vendor types cannot
  cross the application port.

- [ ] **Task 4: Implement safe return-path validation**

  Create and test a utility that accepts only validated local application paths.
  Reject absolute external URLs, protocol-relative URLs, malformed paths, and
  authentication callback loops.

- [ ] **Task 5: Implement authentication workflows**

  Add the `restoreAuthentication`, `signInWithGoogle`,
  `completeAuthenticationRedirect`, `getCurrentAppUser`, and `signOut` use cases.
  Model transitions between initializing, unauthenticated, authenticated,
  unauthorized, and error states. Keep React out of this layer.

- [ ] **Task 6: Test authentication state behavior**

  Add deterministic tests for state transitions, Garage Admin recognition,
  non-admin denial, retryable errors, redirect completion, and expired-session
  handling.

## Phase 2: Database Identity and Authorization

- [ ] **Task 7: Create the authentication schema migration**

  Add a versioned Supabase migration for `app_users` and `user_identities`,
  including foreign keys, unique constraints, timestamps, and the `admin` or
  `member` role constraint. The application user ID must remain independent of
  the Supabase Auth user ID.

- [ ] **Task 8: Implement controlled user provisioning**

  Add database provisioning logic that creates a deny-by-default `member`
  application user and a Supabase identity mapping. Copy a usable initial Google
  display name without treating provider metadata as authorization data or
  resynchronizing it during later sign-ins.

- [ ] **Task 9: Add current-user SQL functions**

  Add stable functions for resolving the current `AppUserId`, app-owned role,
  and complete `AppUser`. Security-definer functions must have fixed search paths
  and minimum grants.

- [ ] **Task 10: Apply deny-by-default RLS**

  Enable RLS on authentication-owned tables. Prevent browser role changes,
  identity reassignment, arbitrary application-user enumeration, and ownership
  expansion through browser-supplied values.

- [ ] **Task 11: Add Garage Admin policy helpers**

  Create reusable SQL authorization helpers for protected Vehicle and Service
  Record policies. Apply them only after those tables exist; do not create
  placeholder product tables solely for authentication.

- [ ] **Task 12: Add database integration tests**

  Test a Garage Admin, a mapped `member`, an authenticated but unmapped identity,
  an unauthenticated user, and a browser attempting role escalation. Verify that
  only the Garage Admin qualifies for protected feature access.

## Phase 3: Supabase Adapter

- [ ] **Task 13: Add browser environment configuration**

  Define and validate only the public Supabase URL and publishable or anonymous
  key. Add a safe example environment file. Reject missing configuration without
  printing configuration values.

- [ ] **Task 14: Create the Supabase client**

  Add the singleton client under `src/infrastructure/supabase/client.ts`. No
  feature, domain, or application module may import the Supabase SDK.

- [ ] **Task 15: Implement Supabase error mapping**

  Translate provider failures into app-owned outcomes for cancellation,
  unavailable login, invalid callback, revoked session, provisioning failure,
  and sign-out failure. Never expose callback data, tokens, or raw provider
  payloads.

- [ ] **Task 16: Implement session restoration**

  Implement `SupabaseAuthGateway.restore()`. Resolve the Supabase user through
  `user_identities`, load the application-owned user, authorize only `admin`, and
  distinguish absent, unauthorized, and authenticated sessions.

- [ ] **Task 17: Implement OAuth sign-in and sign-out**

  Implement Google sign-in, validated return-path preservation, callback
  completion support, and sign-out. Let the Supabase client own token storage and
  token refresh behavior.

- [ ] **Task 18: Create the shared gateway contract suite**

  Define reusable `AuthGateway` behavior tests and run them against
  `SupabaseAuthGateway`. Cover every authentication result, provider failures,
  and sign-out. Keep the suite reusable by a future adapter without building an
  `HttpAuthGateway` now.

## Phase 4: React Integration and Presentation

- [ ] **Task 19: Create the authentication composition root**

  Instantiate `SupabaseAuthGateway` in one composition location and inject it
  into the application authentication workflow. Feature components must not
  inspect environment variables or select adapters.

- [ ] **Task 20: Create the application authentication provider**

  Add the single React owner for authentication state. Restore the session once
  at startup, handle recoverable session changes, and prevent independent
  route-level authentication listeners.

- [ ] **Task 21: Add routing and route protection**

  Configure routes for sign-in, authentication callback, protected application
  content, and unavailable access. Support refreshes and protected deep links
  without rendering private content during session restoration.

- [ ] **Task 22: Build authentication screens**

  Build responsive and accessible initialization, sign-in, access-unavailable,
  and safe retry-error screens using the root `DESIGN.md`. Offer only the primary
  **Continue with Google** action; do not add registration or password controls.

- [ ] **Task 23: Add authenticated navigation**

  Display the current application user, use **Garage Admin** product language,
  and provide a sign-out action matching the repository design system.

- [ ] **Task 24: Implement private-state cleanup**

  Add a centralized cleanup mechanism invoked during sign-out and identity
  changes. It must clear authentication state and registered private feature
  caches without coupling authentication to future feature repositories.

## Phase 5: Operations and Completion

- [ ] **Task 25: Document environment setup and bootstrap**

  Add a runbook for Google and Supabase callbacks, environment separation,
  initial sign-in, verified application-user promotion, public sign-up disabling,
  session defaults, secret handling, and repeatable bootstrap commands. Do not
  commit an email address, provider subject, token, or secret.

- [ ] **Task 26: Document privileged account recovery**

  Record a reviewed procedure for recovering from loss of the only Garage Admin
  Google identity. Recovery must preserve the existing `AppUserId` and must not
  depend on a second administrator already existing in the application.

- [ ] **Task 27: Run the final security audit**

  Check for Supabase imports outside infrastructure, exposed secrets, raw
  provider logging, unsafe redirects, browser role changes, and unprotected
  initialization states. Fix only issues within the Authentication and Access
  feature scope.

- [ ] **Task 28: Run final verification**

  Run the complete automated test suite, typecheck, lint, and production build.
  Follow the staging checklist for real Google login, refresh restoration,
  protected deep linking, unauthorized-identity rejection, and sign-out. Record
  any manual verification that remains.

## Manual Environment Gates

Codex can create the repository code, migrations, tests, scripts, and runbooks,
but completing the feature also requires an authorized person to:

- Supply and configure the Google OAuth and Supabase credentials.
- Verify the intended Supabase identity before its promotion.
- Authorize and execute the privileged Garage Admin promotion.
- Disable public sign-up after bootstrap.
- Confirm session and redirect configuration in every environment.
- Perform the real Google staging smoke test.

## Explicitly Deferred Work

Do not add a custom API, `HttpAuthGateway`, API-owned cookies, provider migration
tooling, application MFA, member-facing behavior, account linking, or user and
role administration screens as part of this breakdown.
