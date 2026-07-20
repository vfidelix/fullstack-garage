# Authentication and Access Progress

Status: Repository implementation complete; manual environment gates outstanding  
Last updated: 2026-07-20  
Canonical plan: [Authentication and Access Controlled Task Breakdown](authentication-access.task-breakdown.md)

## Summary

- Completed: 28 of 28 tasks
- In progress: None
- Blocked: None
- Next unblocked task: None; repository task loop complete
- Manual environment gates remain outstanding until an authorized deployment
  owner supplies and verifies environment-specific configuration.

## Task Ledger

| ID | Status | Completed | Notes |
| --- | --- | --- | --- |
| AUTH-01 | Complete | 2026-07-20 | Validation and reviewer gate passed |
| AUTH-02 | Complete | 2026-07-20 | Validation and reviewer gate passed |
| AUTH-03 | Complete | 2026-07-20 | Validation and reviewer gate passed |
| AUTH-04 | Complete | 2026-07-20 | Validation and reviewer gate passed |
| AUTH-05 | Complete | 2026-07-20 | Medium race fixed; re-review passed |
| AUTH-06 | Complete | 2026-07-20 | Validation/review passed; one optional low test gap |
| AUTH-07 | Complete | 2026-07-20 | Static/repository validation and review passed |
| AUTH-08 | Complete | 2026-07-20 | Static/repository validation and review passed |
| AUTH-09 | Complete | 2026-07-20 | Static/repository validation and review passed |
| AUTH-10 | Complete | 2026-07-20 | Static/repository validation and review passed |
| AUTH-11 | Complete | 2026-07-20 | Static/repository validation and review passed |
| AUTH-12 | Complete | 2026-07-20 | Static/repository validation/review passed; live DB deferred |
| AUTH-13 | Complete | 2026-07-20 | Two medium security findings fixed; re-review passed |
| AUTH-14 | Complete | 2026-07-20 | Validation and reviewer gate passed |
| AUTH-15 | Complete | 2026-07-20 | Medium precedence issue fixed; re-review passed |
| AUTH-16 | Complete | 2026-07-20 | Medium status-envelope issue fixed; re-review passed |
| AUTH-17 | Complete | 2026-07-20 | Medium callback-init issue fixed; re-review passed |
| AUTH-18 | Complete | 2026-07-20 | Medium contract gap fixed; re-review passed |
| AUTH-19 | Complete | 2026-07-20 | Validation and reviewer gate passed |
| AUTH-20 | Complete | 2026-07-20 | Medium session-event race fixed; re-review passed |
| AUTH-21 | Complete | 2026-07-20 | Medium duplicate callback fixed; re-review passed |
| AUTH-22 | Complete | 2026-07-20 | Two medium design/language findings fixed; re-review passed |
| AUTH-23 | Complete | 2026-07-20 | Medium member fail-closed gap fixed; re-review passed |
| AUTH-24 | Complete | 2026-07-20 | Medium duplicate registration fixed; re-review passed |
| AUTH-25 | Complete | 2026-07-20 | Two medium runbook findings fixed; re-review passed |
| AUTH-26 | Complete | 2026-07-20 | Validation and documentation/security reviewer gate passed |
| AUTH-27 | Complete | 2026-07-20 | Medium build-time config leak risk fixed; re-review passed |
| AUTH-28 | Complete | 2026-07-20 | Final verification and reviewer gate passed; manual gates recorded |

## Completed Task Entries

### AUTH-01 — Add runtime and test dependencies; configure Vitest and `npm test`

- Implementation: Added the approved routing, Supabase, icon, Vitest, Testing
  Library, user-event, and jsdom dependencies; configured a jsdom Vitest
  environment, shared DOM cleanup and matchers, a repository-native `npm test`
  command, and a minimal application smoke test. No authentication behavior was
  introduced.
- Files changed: `package.json`, `package-lock.json`, `tsconfig.node.json`,
  `vite.config.ts`, `vitest.config.ts`, `src/test/setup.ts`, `src/App.test.tsx`.
- Validation run: `npm test -- src/App.test.tsx` (passed, 1 test); `npm test`
  (passed, 1 test); `npm run typecheck` (passed); `npm run lint` (passed);
  `npm run build` (passed).
- Decisions made: Kept Vitest configuration separate from the Cloudflare-enabled
  Vite build configuration and made test cleanup explicit. Normalized two
  pre-existing style issues in `vite.config.ts` required by the lint gate without
  changing build behavior.
- Review: Feature reviewer found no high-, medium-, or low-severity actionable
  findings; independent test, typecheck, lint, build, and diff checks passed.
- Next unblocked task: AUTH-02 — Add the application-owned user model. AUTH-04,
  AUTH-07, and AUTH-13 are also unblocked in separate file areas.

### AUTH-02 — Add the application-owned user model

- Implementation: Added the provider- and framework-neutral `AppUserId`,
  `AppUserRole`, and readonly `AppUser` domain model plus explicit MVP Garage
  Admin recognition based on the app-owned `admin` role.
- Files changed: `src/domain/users/appUser.ts`,
  `src/domain/users/appUser.test.ts`.
- Validation run: `npm test -- src/domain/users/appUser.test.ts` (passed, 2
  tests); `npm test` (passed, 3 tests); `npm run typecheck` (passed); `npm run
  lint` (passed); `npm run build` (passed); `git diff --check` (passed).
- Decisions made: Represented the application-owned ID and ISO timestamps as
  strings, matching the approved feature model and persistence representation.
  Garage Admin recognition depends only on `AppUser.role`; it does not inspect
  provider identity or profile data.
- Review: Feature reviewer found no high-, medium-, or low-severity actionable
  findings; independent targeted/full tests, typecheck, lint, build, and diff
  checks passed.
- Next unblocked task: AUTH-03 — Define app-owned authentication contracts.
  AUTH-04, AUTH-07, and AUTH-13 remain independently unblocked.

### AUTH-03 — Define app-owned authentication contracts

- Implementation: Added provider-neutral `AuthenticationState` and
  `AuthenticationResult` discriminated unions, structured authentication error
  categories with fixed UI-safe messages, and the `AuthGateway` port with
  `restore`, Google sign-in, and sign-out operations.
- Files changed:
  `src/application/authentication/authenticationModels.ts`,
  `src/application/authentication/authenticationError.ts`,
  `src/application/authentication/authenticationModels.test.ts`,
  `src/application/authentication/authenticationError.test.ts`,
  `src/application/ports/authGateway.ts`.
- Validation run: `npm test -- src/application/authentication` (passed, 9
  tests); `npm test` (passed, 12 tests); `npm run typecheck` (passed); `npm run
  lint` (passed); `npm run build` (passed); `git diff --check` (passed).
- Decisions made: Kept callback completion out of the gateway because the
  approved port restores authentication after callbacks. Represented lack of
  application access as `unauthorized`, not an infrastructure error. Error copy
  is selected from app-owned categories so raw provider details cannot enter the
  application state through this contract.
- Review: Feature reviewer found no high-, medium-, or low-severity actionable
  findings; structured errors were confirmed compatible with the approved
  state semantics, and all validation passed.
- Next unblocked task: AUTH-04 — Implement safe local return-path validation.
  AUTH-07 and AUTH-13 remain independently unblocked.

### AUTH-04 — Implement safe local return-path validation

- Implementation: Added a pure shared validator and resolver that preserve only
  local application paths, use `/dashboard` as the fixed fallback, and reject
  external URLs, protocol-relative values, schemes, backslashes, controls,
  malformed encodings, and direct or encoded authentication callback loops.
- Files changed: `src/shared/validation/safeReturnPath.ts`,
  `src/shared/validation/safeReturnPath.test.ts`.
- Validation run: `npm test -- src/shared/validation/safeReturnPath.test.ts`
  (passed, 37 tests); `npm test` (passed, 49 tests); `npm run typecheck`
  (passed); `npm run lint` (passed); `npm run build` (passed); `git diff
  --check` (passed).
- Decisions made: Valid paths may include query strings and fragments and are
  returned unchanged. Security analysis repeatedly decodes and URL-normalizes a
  separate copy to catch encoded separators and dot-segment callback bypasses.
  Invalid or absent input resolves to the explicit `/dashboard` default.
- Review: Feature reviewer found no high-, medium-, or low-severity actionable
  findings after adversarial redirect-bypass review; all validation passed.
- Next unblocked task: AUTH-05 — Implement provider-neutral authentication
  workflows. AUTH-07 and AUTH-13 remain independently unblocked.

### AUTH-05 — Implement provider-neutral authentication workflows

- Implementation: Added the single provider-neutral authentication controller
  exposing session restoration, Google sign-in, callback completion,
  current-app-user lookup, and sign-out workflows with explicit app-owned state
  transitions. Added operation generations so only the newest asynchronous
  operation can commit state.
- Files changed:
  `src/application/use-cases/auth/authenticationController.ts`,
  `src/application/use-cases/auth/authenticationController.test.ts`.
- Validation run: `npm test --
  src/application/use-cases/auth/authenticationController.test.ts` (passed, 16
  tests); `npm test` (passed, 65 tests); `npm run typecheck` (passed); `npm run
  lint` (passed); `npm run build` (passed); `git diff --check` (passed).
- Decisions made: The controller is the sole application state owner. Restore
  and callback completion map all gateway results directly; expired sessions
  become unauthenticated. Sign-in always receives a validated local return path.
  Thrown values are reduced to recognized categories and recreated with fixed
  safe copy. Sign-out removes the current user before calling the gateway, then
  resolves to unauthenticated or a safe sign-out error state. Each operation
  invalidates older operations; stale results and errors return the current state
  without overwriting a newer restore or re-authenticating after sign-out.
- Review: The reviewer identified one medium stale-operation race. Operation
  generation guards and three deferred-promise regression tests fixed it;
  re-review found no remaining high- or medium-severity findings.
- Next unblocked task: AUTH-06 — Complete authentication state-transition
  coverage. AUTH-07 and AUTH-13 remain independently unblocked.

### AUTH-06 — Complete authentication state-transition coverage

- Implementation: Expanded deterministic controller coverage for initial,
  pending, and final states; every restore and callback result; retry after safe
  errors; cancellation, provisioning, callback, expired-session, sign-out, and
  return-path behavior; and overlapping operations across restore, sign-in, and
  sign-out.
- Files changed:
  `src/application/use-cases/auth/authenticationController.test.ts`.
- Validation run: `npm test --
  src/application/use-cases/auth/authenticationController.test.ts` (passed, 27
  tests); `npm test` (passed, 76 tests); `npm run typecheck` (passed); `npm run
  lint` (passed); `npm run build` (passed); `git diff --check` (passed).
- Decisions made: No production changes were required. Garage Admin recognition
  remains a domain rule, while mapped non-admin denial remains an
  `unauthorized` gateway result consumed by the controller. Retry coverage uses
  repeated controller operations rather than provider-specific behavior.
  Deferred promises verify that stale sign-in and sign-out failures cannot
  overwrite newer state.
- Review: No high- or medium-severity findings. One optional low-severity gap
  remains for a direct assertion of the already-correct generic startup restore
  fallback; it does not block the requested review gate.
- Next unblocked task: AUTH-07 — Add the authentication schema migration.
  AUTH-13 remains independently unblocked.

### AUTH-07 — Add the authentication schema migration

- Implementation: Added one additive versioned migration creating only
  `public.app_users` and `public.user_identities` with independent generated UUID
  keys, required timestamps, deny-by-default member role, nonblank descriptive
  identity fields, provider-subject uniqueness, and the app-user foreign key.
- Files changed:
  `supabase/migrations/20260720000100_create_authentication_identity_tables.sql`.
- Validation run: Static migration scope and invariant searches passed; confirmed
  the migration contains both schema-qualified tables and required constraints
  and contains no `auth.users` foreign key, provisioning function, trigger, RLS,
  or policy. Supabase CLI, `psql`, `sqlfluff`, and `pg_format` are unavailable, so
  migration reset and parser-backed SQL validation were not run. `npm test`
  (passed, 76 tests); `npm run typecheck` (passed); `npm run lint` (passed); `npm
  run build` (passed); `git diff --check` (passed).
- Decisions made: `app_users.id` is generated independently and has no foreign
  key to `auth.users`. Identity rows use `ON DELETE CASCADE` so privileged
  application-user deletion cannot leave orphan mappings. Indexed `user_id`
  because PostgreSQL does not automatically index foreign-key columns and later
  user/identity lookups and cascades use it. RLS and provisioning remain deferred
  to their dedicated tasks.
- Review: No high-, medium-, or low-severity findings. Static/repository checks
  passed; database reset/parser validation remains unavailable until local
  Supabase/PostgreSQL tooling is installed. Do not deploy the partial migration
  set to a browser-accessible environment before AUTH-10 adds RLS.
- Next unblocked task: AUTH-08 — Add controlled deny-by-default user
  provisioning. AUTH-13 remains independently unblocked.

### AUTH-08 — Add controlled deny-by-default user provisioning

- Implementation: Added an additive migration with Google-only auth-user insert
  provisioning and a privileged missing-name operation. Provisioning creates an
  app user through the `member` default, records the immutable `supabase`
  identity mapping, copies a usable initial Google display name once, and never
  synchronizes later auth-user updates.
- Files changed:
  `supabase/migrations/20260720000200_add_controlled_user_provisioning.sql`,
  `supabase/tests/authenticationProvisioningMigration.test.mjs`.
- Validation run: `npm test --
  supabase/tests/authenticationProvisioningMigration.test.mjs` (passed, 5 static
  SQL tests); `npm test` (passed, 81 tests); `npm run typecheck` (passed); `npm
  run lint` (passed); `npm run build` (passed); `git diff --check` (passed).
  Supabase CLI and `psql` remain unavailable, so migration reset and live
  concurrency/trigger execution were not run.
- Decisions made: Automatic provisioning requires trusted auth app metadata to
  identify Google and uses only descriptive `full_name`/`name` user metadata.
  Missing or blank names leave the auth identity unprovisioned until the
  service-role-only operation receives an explicit nonblank name. Both
  security-definer functions use an empty search path; browser roles have no
  execute grant. An auth-user row lock plus transaction advisory lock serializes
  retries, and existing mappings are returned without profile updates or
  remapping. Inserts omit role so the database `member` default is authoritative.
- Review: No high-, medium-, or low-severity findings in static security review;
  all available validation passed. Live trigger/concurrency checks remain gated
  by unavailable Supabase/PostgreSQL tooling.
- Next unblocked task: AUTH-09 — Add current-app-user and role SQL helpers.
  AUTH-13 remains independently unblocked.

### AUTH-09 — Add current-app-user and role SQL helpers

- Implementation: Added an additive migration with zero-argument helpers for
  the current application-user ID, app-owned role, and complete profile. Every
  lookup derives its authority from `auth.uid()` through the immutable
  `supabase` identity mapping and accepts no caller-selected user ID.
- Files changed:
  `supabase/migrations/20260720000300_add_current_app_user_helpers.sql`,
  `supabase/tests/currentAppUserHelpersMigration.test.mjs`.
- Validation run: `npm test --
  supabase/tests/currentAppUserHelpersMigration.test.mjs` (passed, 5 static SQL
  tests); `npm test` (passed, 86 tests); `npm run typecheck` (passed); `npm run
  lint` (passed); `npm run build` (passed); `git diff --check` (passed). Static
  security/scope searches passed. Supabase CLI and `psql` remain unavailable, so
  migration reset and live null/unmapped result checks were not run.
- Decisions made: All three helpers are stable security-definer functions because
  they must continue reading authentication tables after deny-by-default RLS.
  They use an empty search path and schema-qualified tables, functions, and auth
  identity lookup. Only `authenticated` receives execute permission; anonymous
  callers cannot invoke the RPCs directly. With a null or unmapped `auth.uid()`,
  scalar helpers return null and the profile helper returns no rows. The profile
  exposes exactly `id`, `display_name`, `role`, `created_at`, and `updated_at` for
  direct adapter mapping. No boolean admin helper or RLS policy was added.
- Review: No high-, medium-, or low-severity findings in static SQL security
  review; all available validation passed. Live null/unmapped/RLS checks remain
  gated by unavailable Supabase/PostgreSQL tooling.
- Next unblocked task: AUTH-10 — Apply deny-by-default RLS to auth-owned tables.
  AUTH-11 and AUTH-13 remain independently unblocked.

### AUTH-10 — Apply deny-by-default RLS to auth-owned tables

- Implementation: Added an additive migration enabling RLS on `app_users` and
  `user_identities` and revoking all direct table privileges from `PUBLIC`,
  `anon`, and `authenticated`. No direct read, enumeration, insert, profile or
  role update, identity reassignment, or delete path is available to browsers.
- Files changed:
  `supabase/migrations/20260720000400_enable_authentication_rls.sql`,
  `supabase/tests/authenticationRlsMigration.test.mjs`.
- Validation run: `npm test --
  supabase/tests/authenticationRlsMigration.test.mjs` (passed, 4 static SQL
  tests); `npm test` (passed, 90 tests); `npm run typecheck` (passed); `npm run
  lint` (passed); `npm run build` (passed); `git diff --check` (passed). Supabase
  CLI and `psql` remain unavailable, so live role/access and helper-bypass checks
  were not run.
- Decisions made: Added no table policies; RLS therefore remains deny-by-default
  even if direct privileges are granted accidentally later. Did not use `FORCE
  ROW LEVEL SECURITY`, because the existing zero-argument security-definer
  helpers and controlled provisioning function must bypass table RLS as their
  owner while deriving identity internally. Function execute grants remain
  unchanged: authenticated users may call only their current-profile helpers,
  and service role may call only privileged provisioning.
- Review: No high-, medium-, or low-severity findings in static SQL security
  review; all available validation passed. Live role/helper-bypass checks remain
  gated by unavailable Supabase/PostgreSQL tooling.
- Next unblocked task: AUTH-11 — Add reusable Garage Admin SQL authorization
  helper. AUTH-13 remains independently unblocked.

### AUTH-11 — Add reusable Garage Admin SQL authorization helper

- Implementation: Added an additive migration defining the zero-argument
  `is_garage_admin()` helper for future protected Vehicle and Service Record RLS
  policies and database functions. It returns true only when the reviewed
  current-role helper resolves the acting application user to `admin`.
- Files changed:
  `supabase/migrations/20260720000500_add_garage_admin_helper.sql`,
  `supabase/tests/garageAdminHelperMigration.test.mjs`.
- Validation run: `npm test --
  supabase/tests/garageAdminHelperMigration.test.mjs` (passed, 5 static SQL
  tests); `npm test` (passed, 95 tests); `npm run typecheck` (passed); `npm run
  lint` (passed); `npm run build` (passed); `git diff --check` (passed). Supabase
  CLI and `psql` remain unavailable, so live anonymous, unmapped, member, and
  admin result checks were not run.
- Decisions made: The helper accepts no identity or role input and derives only
  from `current_app_user_role()`. `coalesce(..., false)` makes null auth identity,
  missing mapping, and missing role deny explicitly; `member` also compares
  false. The stable security-definer function has an empty search path. Execute
  is granted only to `anon` and `authenticated`: anonymous policy evaluation can
  safely return false, while `PUBLIC` and service role receive no direct grant.
  No policy or placeholder Vehicle/Service Record table was added.
- Review: No high-, medium-, or low-severity findings in static SQL security
  review; all available validation passed. Live role-matrix checks remain gated
  by unavailable Supabase/PostgreSQL tooling.
- Next unblocked task: AUTH-12 — Complete authentication database integration
  coverage. AUTH-13 remains independently unblocked.

### AUTH-12 — Complete authentication database integration coverage

- Implementation: Added a transactional 38-assertion pgTAP database suite for
  automatic and explicit provisioning, immutable initial display names,
  current-user/profile helpers, the Garage Admin role matrix, and rejected
  direct reads, role/profile mutation, identity insertion/reassignment, and
  deletion. Added the repository `npm run test:db` command and an executable
  static verifier for the deferred live suite.
- Files changed: `package.json`, `supabase/tests/authentication_access.test.sql`,
  `supabase/tests/authenticationDatabaseSuiteStatic.test.mjs`.
- Validation run: `npm test --
  supabase/tests/authenticationDatabaseSuiteStatic.test.mjs` (passed, 6 static
  verification tests); `npm test` (passed, 101 tests); `npm run typecheck`
  (passed); `npm run lint` (passed); `npm run build` (passed); `git diff --check`
  (passed). `npm run test:db` was not run because the Supabase CLI and local
  PostgreSQL stack are unavailable. The exact deferred command is `npm run
  test:db` after installing the CLI and starting the local Supabase stack.
- Decisions made: The pgTAP suite uses fixed synthetic UUIDs and `.invalid`
  addresses, begins a transaction, and rolls back all auth/application fixtures.
  It creates no product tables. Role-switched assertions exercise service-role
  provisioning, authenticated mapped admin/member/unmapped states, anonymous
  evaluation, and actual insufficient-privilege outcomes. A Node static test
  verifies required scenarios and command wiring but is explicitly not treated
  as database execution. Live compatibility with the installed `auth.users`
  schema and role-switched pgTAP permissions remains to be confirmed by the
  deferred command.
- Review: No high- or medium-severity findings. The reviewer confirmed the
  38-assertion plan, role/JWT switching, privilege matching, and required role
  matrix are internally coherent; live execution remains a recorded gate.
- Next unblocked task: AUTH-13 — Validate public browser Supabase configuration.

### AUTH-13 — Validate public browser Supabase configuration

- Implementation: Added a browser-only Supabase configuration boundary that
  reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, trims and
  validates both values, and returns fixed safe errors without echoing rejected
  configuration. The default read uses explicit property access rather than
  passing the whole `import.meta.env` object. Added a Vite build guard with an
  exact two-name public environment allowlist, typed Vite environment
  declarations, and a secret-free example environment file.
- Files changed: `.gitignore`, `.env.example`, `src/vite-env.d.ts`,
  `src/shared/config/supabaseConfig.ts`,
  `src/shared/config/supabaseConfig.test.ts`, `vite.config.ts`,
  `viteEnvironmentGuard.ts`, `viteEnvironmentGuard.test.ts`,
  `tsconfig.node.json`.
- Validation run: `npm test -- src/shared/config/supabaseConfig.test.ts
  viteEnvironmentGuard.test.ts` (passed, 30 tests); `npm test` (passed, 131
  tests); `npm run typecheck` (passed); `npm run lint` (passed); `npm run build`
  (passed); `git diff --check` (passed). A build with an injected generic
  unapproved `VITE_*` variable failed before bundling with the fixed safe error
  and did not print the sentinel value. Ignore-contract checks confirmed local
  `.env` variants are ignored while `.env.example` remains trackable.
- Decisions made: The supported key variable is the modern publishable-key name;
  legacy anonymous JWT values remain accepted through that same variable for
  Supabase compatibility, while secret keys and service-role JWTs are rejected.
  HTTPS origins are accepted; HTTP is limited to explicit loopback development
  hosts (`localhost`, `127.0.0.1`, and `[::1]`). Credentials, paths, queries, and
  fragments are rejected. Build-time environment loading uses Vite `loadEnv`
  for `VITE_` file variables and overlays `process.env` so shell variables keep
  their documented precedence. Only `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` are allowed; every other `VITE_*` name is
  rejected regardless of value, while non-Vite process variables are ignored.
  Variable names and values are never included in errors. Client creation
  remains deferred to AUTH-14.
- Review: Reviews found medium-severity gaps in whole-object environment access
  and the initial forbidden-name denylist. Narrow client reads and an exact
  build-time allowlist fixed both; final re-review found no remaining high- or
  medium-severity findings.
- Next unblocked task: AUTH-14 — Create the singleton Supabase client.

### AUTH-14 — Create the singleton Supabase client

- Implementation: Added an infrastructure-owned lazy Supabase client singleton
  and a narrow `getSupabaseClient()` accessor. Importing the module performs no
  configuration read or SDK construction; the first getter call validates the
  browser configuration and creates the client, and later calls reuse it.
- Files changed: `src/infrastructure/supabase/client.ts`,
  `src/infrastructure/supabase/client.test.ts`.
- Validation run: `npm test -- src/infrastructure/supabase/client.test.ts`
  (passed, 3 tests); `npm test` (passed, 134 tests); `npm run typecheck`
  (passed); `npm run lint` (passed); `npm run build` (passed); `git diff
  --check` (passed). A repository scan confirmed no Supabase SDK or
  infrastructure-client imports were introduced under domain, application, or
  feature modules.
- Decisions made: Client creation passes only the validated URL and publishable
  key to `createClient`; no auth options are supplied, preserving the Supabase
  SDK defaults for session persistence, token refresh, and callback session
  detection. The singleton remains lazy so unrelated imports and tests do not
  require browser configuration. Tests use module isolation rather than a
  production-exported reset seam. No app timer or custom token storage was
  introduced.
- Review: No high- or medium-severity findings; lazy singleton behavior, SDK
  defaults, test isolation, and infrastructure-only imports were verified.
- Next unblocked task: AUTH-15 — Map Supabase failures to app-owned auth errors.

### AUTH-15 — Map Supabase failures to app-owned auth errors

- Implementation: Added an infrastructure-only mapper from unknown Supabase
  Auth/PostgREST-style failures and explicit operation context to a throwable
  error containing an app-owned authentication category and its fixed safe
  message. No gateway behavior was introduced.
- Files changed:
  `src/infrastructure/supabase/auth/mapAuthenticationError.ts`,
  `src/infrastructure/supabase/auth/mapAuthenticationError.test.ts`.
- Validation run: `npm test --
  src/infrastructure/supabase/auth/mapAuthenticationError.test.ts` (passed, 18
  tests); `npm test` (passed, 152 tests); `npm run typecheck` (passed); `npm run
  lint` (passed); `npm run build` (passed); `git diff --check` (passed). An
  architecture scan confirmed Supabase SDK error types and guards remain absent
  from domain, application, and feature modules.
- Decisions made: Structured `access_denied` and abort failures map to
  cancellation only for sign-in/callback operations. Known OAuth state, PKCE,
  and flow errors map to invalid callback; session, JWT, and refresh-token errors
  map to expired session. SDK retryable failures, rate limits, server statuses,
  provider codes, and structured OAuth temporary errors map to sign-in
  unavailability, except restore uses its safe `unexpected` category. Profile
  and sign-out contexts always use their dedicated categories. Unknown failures
  use conservative operation-specific fallbacks. The mapped error retains no
  raw code, message, payload, cause, token, or query. Explicit retryable signals
  are evaluated before callback classifications, but callback-specific code and
  class names are evaluated before generic HTTP status fallback. An invalid
  token response is an invalid callback during callback handling and an expired
  session during restore.
- Review: Initial review found one medium-severity precedence issue where the
  HTTP 500 status on callback-specific SDK errors could hide the more precise
  invalid-callback classification. The ordering and invalid-token context were
  remediated with actual installed SDK error constructors; re-review found no
  remaining high- or medium-severity findings.
- Next unblocked task: AUTH-16 — Implement
  `SupabaseAuthGateway.restore()`.

### AUTH-16 — Implement `SupabaseAuthGateway.restore()`

- Implementation: Added the restore-only `SupabaseAuthGateway` adapter with a
  default lazy singleton client and a narrow injectable client boundary for
  tests. Restore reads the Supabase session, calls only the zero-argument
  `get_current_app_user` helper for a present session, validates the unknown row
  at runtime, maps snake_case fields to the readonly app-owned model, and
  authorizes only Garage Admin users. AUTH-17 sign-in and sign-out behavior
  remains explicitly unimplemented.
- Files changed:
  `src/infrastructure/supabase/auth/SupabaseAuthGateway.ts`,
  `src/infrastructure/supabase/auth/SupabaseAuthGateway.test.ts`,
  `src/infrastructure/supabase/auth/mapAuthenticationError.ts`,
  `src/infrastructure/supabase/auth/mapAuthenticationError.test.ts`.
- Validation run: `npm test --
  src/infrastructure/supabase/auth/SupabaseAuthGateway.test.ts
  src/infrastructure/supabase/auth/mapAuthenticationError.test.ts` (passed, 36
  tests); `npm test` (passed, 170 tests); `npm run typecheck` (passed); `npm run
  lint` (passed); `npm run build` (passed); `git diff --check` (passed). A static
  scan confirmed the adapter contains no direct table query and invokes only the
  named current-user helper without arguments.
- Decisions made: No session returns `unauthenticated`; no mapping and a valid
  `member` role return `unauthorized`. The helper must return exactly one row
  with a UUID, nonblank display name, supported role, and valid timestamps;
  malformed, multiple, or unsupported results fail safely as
  `provisioning_failed`. Returned or thrown session errors use restore mapping.
  Profile response-envelope status 401 maps to `session_expired`; the existing
  controller converts that category to `unauthenticated`. The adapter passes
  only a synthetic numeric status fact to the mapper rather than forwarding the
  PostgREST error or response. Non-401 profile failures map to
  `provisioning_failed`. No provider details are retained, and no caller-supplied
  ID reaches the RPC.
- Review: Initial review found one medium-severity mismatch between the
  PostgREST response-envelope status and its status-less error object. The
  adapter now classifies the envelope and passes only safe synthetic status;
  realistic 401 and non-401 response tests pass, and re-review found no remaining
  high- or medium-severity findings.
- Next unblocked task: AUTH-17 — Implement Google OAuth sign-in,
  callback support, and sign-out.

### AUTH-17 — Implement Google OAuth sign-in, callback support, and sign-out

- Implementation: Replaced the gateway stubs with Google OAuth initiation and
  current-session Supabase sign-out. Added an injectable browser-location
  boundary used for same-origin callback construction and callback-aware restore
  classification without inspecting callback query strings.
- Files changed:
  `src/infrastructure/supabase/auth/SupabaseAuthGateway.ts`,
  `src/infrastructure/supabase/auth/SupabaseAuthGateway.test.ts`.
- Validation run: `npm test --
  src/infrastructure/supabase/auth/SupabaseAuthGateway.test.ts
  src/infrastructure/supabase/auth/mapAuthenticationError.test.ts` (passed, 51
  tests); `npm test` (passed, 185 tests); `npm run typecheck` (passed); `npm run
  lint` (passed); `npm run build` (passed); `git diff --check` (passed). A static
  scan confirmed the adapter contains no token names, custom storage access,
  console logging, callback query access, or direct `window` dependency.
- Decisions made: Return paths are revalidated at the infrastructure boundary;
  unsafe, external, malformed, and callback-loop values fall back to
  `/dashboard`. The callback URL is built from the injected browser origin with
  the fixed `/auth/callback` path and an encoded local `returnPath`. OAuth calls
  include only the Google provider and `redirectTo`; Supabase continues to own
  redirects and session storage. Callback context is derived only from pathname;
  callback restore explicitly awaits the SDK's existing `initialize()` result
  before reading the session. Returned or thrown initialization errors stop
  before session/profile access and map cancellation or invalid PKCE/OAuth state
  correctly; successful initialization continues normal restore, while a
  callback with no resulting session is invalid. Non-callback restore does not
  call initialization explicitly. Sign-out uses `{ scope:
  'local' }` so other allowed active sessions remain intact. Returned and thrown
  OAuth/sign-out failures are mapped without raw retention.
- Review: Initial review found one medium-severity gap where callback processing
  did not await the SDK initialization result that owns OAuth query parsing. The
  callback-only initialization gate and early-stop tests remediated the issue;
  re-review found no remaining high- or medium-severity findings.
- Next unblocked task: AUTH-18 — Add the reusable `AuthGateway` contract suite.
  AUTH-19 is also unblocked in a separate application/provider file area.

### AUTH-18 — Add the reusable `AuthGateway` contract suite

- Implementation: Added a provider-neutral reusable contract suite beside the
  application authentication port and ran it against `SupabaseAuthGateway`
  through an infrastructure-owned harness. No future adapter was introduced.
- Files changed: `src/application/ports/authGateway.contract.ts`,
  `src/infrastructure/supabase/auth/SupabaseAuthGateway.contract.test.ts`.
- Validation run: `npm test --
  src/infrastructure/supabase/auth/SupabaseAuthGateway.contract.test.ts` (passed,
  19 tests); `npm test` (passed, 204 tests); `npm run typecheck` (passed); `npm
  run lint` (passed); `npm run build` (passed); `git diff --check` (passed). A
  static boundary scan confirmed the shared contract helper contains no
  Supabase, PostgREST, OAuth, or PKCE references.
- Decisions made: The reusable harness exposes only the app-owned `AuthGateway`,
  restore outcomes, authentication error categories, `AppUser`, local return
  paths, and synthetic private markers. It covers unauthenticated, unauthorized,
  mapped member denial, authenticated Garage Admin, safe deep links and unsafe
  fallback, ordinary restore expiry/unexpected failures, profile provisioning
  failure, sign-in cancellation/unavailability, successful callback restoration,
  callback invalid/cancelled/expired-session outcomes, sign-out success/failure,
  fixed safe messages, and absence of raw provider fields or private markers in
  `Error.name`/stack. Supabase error constructors, callback initialization,
  realistic RPC failure envelopes, database row fixtures, and generated
  redirect inspection stay entirely in the infrastructure harness, so a future
  HTTP adapter can reuse the same contract without provider types.
- Review: Initial review found a medium-severity coverage gap for ordinary
  restore failures, provisioning failure, and callback success. The shared
  operation/scenario model and Supabase harness now cover those behaviors while
  remaining provider-neutral; re-review found no remaining high- or
  medium-severity findings.
- Next unblocked task: AUTH-19 — Add the authentication composition root.

### AUTH-19 — Add the authentication composition root

- Implementation: Added one lazy app-level authentication composition module
  that selects `SupabaseAuthGateway`, injects it into `AuthenticationController`,
  and exposes only the app-owned controller getter for later UI integration.
  No React provider, route, app entry point, or feature module was changed.
- Files changed: `src/app/authenticationComposition.ts`,
  `src/app/authenticationComposition.test.ts`.
- Validation run: `npm test -- src/app/authenticationComposition.test.ts`
  (passed, 4 tests); `npm test` (passed, 208 tests); `npm run typecheck`
  (passed); `npm run lint` (passed); `npm run build` (passed); `git diff
  --check` (passed). A production-source scan confirmed
  `src/app/authenticationComposition.ts` is the sole non-test construction site
  for `SupabaseAuthGateway`.
- Decisions made: Importing the composition module performs no gateway,
  Supabase-client, or environment construction. The first getter call creates
  exactly one concrete gateway and one controller with verified injection;
  subsequent calls reuse the controller. Tests use module isolation rather than
  a production reset seam. Concrete adapter selection remains absent from
  features and the public composition API exposes no Supabase type.
- Review: Feature reviewer found no high- or medium-severity findings. The
  composition root is lazy, singleton-scoped, the sole production selector of
  `SupabaseAuthGateway`, and exposes no infrastructure types to presentation.
  Independent targeted tests and diff checks passed.
- Next unblocked task: AUTH-20 — Add the single React authentication provider.

### AUTH-20 — Add the single React authentication provider

- Implementation: Added the single app-level React authentication provider and
  provider-neutral context. React observes the application-owned
  `AuthenticationController` through `useSyncExternalStore`; the controller
  remains the sole authentication state machine and now notifies subscribers on
  initializing and committed state transitions. Added a provider-neutral
  `AuthenticationSessionEvents` port, a Supabase infrastructure event adapter,
  and lazy composition for that adapter.
- Files changed:
  `src/application/ports/authenticationSessionEvents.ts`,
  `src/application/use-cases/auth/authenticationController.ts`,
  `src/application/use-cases/auth/authenticationController.test.ts`,
  `src/infrastructure/supabase/auth/SupabaseAuthenticationSessionEvents.ts`,
  `src/infrastructure/supabase/auth/SupabaseAuthenticationSessionEvents.test.ts`,
  `src/app/authenticationComposition.ts`,
  `src/app/authenticationComposition.test.ts`,
  `src/app/providers/authenticationContext.ts`,
  `src/app/providers/AuthenticationProvider.tsx`,
  `src/app/providers/AuthenticationProvider.test.tsx`.
- Validation run: `npm test --
  src/app/providers/AuthenticationProvider.test.tsx
  src/application/use-cases/auth/authenticationController.test.ts
  src/infrastructure/supabase/auth/SupabaseAuthenticationSessionEvents.test.ts
  src/app/authenticationComposition.test.ts` (passed, 40 tests); `npm test`
  (passed, 217 tests); `npm run typecheck` (passed); `npm run lint` (passed);
  `npm run build` (passed); `git diff --check` (passed).
- Decisions made: A per-controller `WeakSet` deduplicates the startup restore
  across React StrictMode remounts without adding a second state owner. The
  initial `initializing` snapshot remains observable for later route protection.
  The provider alone subscribes to provider-neutral recovery events and
  unsubscribes on cleanup. A recovery event received during startup immediately
  begins a newer controller restore; the controller's operation generation
  prevents the older startup result from overwriting that recovery result.
  Supabase event names and listeners remain in infrastructure; the adapter
  ignores the initial SDK notification and forwards only signed-in, signed-out,
  token-refreshed, and user-updated recovery signals. No routes, screens,
  navigation, or private-cache cleanup were added.
- Review: Initial review found a medium-severity lost-event race during pending
  startup restoration. A deterministic deferred-startup regression now proves
  the recovery restore runs and the stale startup result cannot win. Targeted
  validation passes 40 tests and the full suite passes 217 tests; re-review
  found no remaining high- or medium-severity findings. The reviewer's
  frequent-event initialization flash remains a non-blocking low-severity
  observation and was not expanded into this task.
- Next unblocked task: AUTH-21 — Add routes, callback handling, deep-link
  restoration, and protection. AUTH-24 is also unblocked in the authentication
  provider/application area.

### AUTH-21 — Add routes, callback handling, deep-link restoration, and protection

- Implementation: Added React Router composition for sign-in, authentication
  callback, access-unavailable, dashboard, and protected application routes.
  Protected routes render only loading or safe public states until authentication
  settles, preserve validated local deep links including query and hash, and
  route unauthenticated and unauthorized users to distinct destinations. The
  callback consumes the provider's callback-aware startup restoration and
  navigates from its settled application-owned state.
- Files changed: `src/App.tsx`, `src/App.test.tsx`, `src/main.tsx`,
  `src/app/routes/AppRoutes.tsx`, `src/app/routes/AppRoutes.test.tsx`,
  `src/app/routes/ProtectedRoute.tsx`,
  `src/app/routes/PublicAuthenticationRoutes.tsx`,
  `src/app/routes/RoutePlaceholders.tsx`, `src/app/routes/routePaths.ts`.
- Validation run: `npm test -- src/app/routes/AppRoutes.test.tsx
  src/App.test.tsx` (passed, 15 tests); `npm test` (passed, 231 tests);
  `npm run typecheck` (passed); `npm run lint` (passed); `npm run build`
  (passed); `git diff --check` (passed).
- Decisions made: Routing consumes only the provider-neutral
  `useAuthentication` context; no route owns authentication state or listens to
  provider events. The complete pathname, query, and hash are encoded into one
  validated `returnPath`, while all other callback parameters are ignored.
  Invalid, external, or callback-loop paths fall back to `/dashboard`. Callback
  rendering remains in a loading placeholder until provider state settles,
  preventing premature navigation or a private-content flash. The provider's
  callback-aware startup restore is the sole automatic callback operation; only
  an explicit retry from the error state invokes
  `completeAuthenticationRedirect`. A real provider/controller integration test
  verifies one gateway restore under StrictMode and correct deep-link navigation.
  The redundant outer wildcard route was removed. Route UI is intentionally
  minimal because final visual and accessible screen design belongs to AUTH-22;
  navigation belongs to AUTH-23.
- Review: Initial review found a medium-severity duplicate callback restore. The
  route-local automatic completion was removed and deterministic integration
  coverage now verifies the single provider-owned restore. Targeted validation
  passes 15 tests and the full suite passes 231 tests; re-review found no
  remaining high- or medium-severity findings.
- Next unblocked task: AUTH-22 — Build initialization, sign-in, unauthorized,
  and retry-error screens. AUTH-24 remains independently unblocked in the
  authentication provider/application area.

### AUTH-22 — Build initialization, sign-in, unauthorized, and retry-error screens

- Implementation: Replaced route-local authentication placeholders with
  feature-owned initialization, sign-in, access-unavailable, and safe retry
  screens. Added a shared responsive editorial auth layout, existing Fullstack
  Garage brand asset, Lucide action/status icons, accessible status and error
  announcements, native action buttons, and local sign-out for unauthorized
  identities. Route protection and callback behavior remain unchanged.
- Files changed: `src/features/auth/AuthenticationScreens.tsx`,
  `src/features/auth/AuthenticationScreens.module.css`,
  `src/features/auth/AuthenticationScreens.test.tsx`,
  `src/app/routes/ProtectedRoute.tsx`,
  `src/app/routes/PublicAuthenticationRoutes.tsx`,
  `src/app/routes/AppRoutes.tsx`, `src/app/routes/AppRoutes.test.tsx`,
  `src/app/routes/RoutePlaceholders.tsx` (removed),
  `src/styles/global.css`.
- Validation run: `npm test --
  src/features/auth/AuthenticationScreens.test.tsx
  src/app/routes/AppRoutes.test.tsx src/App.test.tsx` (passed, 19 tests);
  `npm test` (passed, 235 tests); `npm run typecheck` (passed); `npm run lint`
  (passed); `npm run build` (passed); `git diff --check` (passed).
- Decisions made: The screen system follows `DESIGN.md` with a near-black
  canvas, white editorial display type, elevated hairline-divided content,
  sharp zero-radius controls, and the 8px spacing ladder. Rosso Corsa is reserved
  for the single Google sign-in CTA; retry and sign-out use outline actions.
  Shared visual values live in `src/styles/global.css` and the component CSS
  consumes those tokens. Controls retain a 48px minimum touch target, a visible
  focus ring, mobile/desktop layout changes, and reduced-motion behavior. The
  loading screen is a polite live status and never renders protected content.
  Error presentation reconstructs copy from the app-owned error category so raw
  provider details cannot be rendered. Product copy consistently uses Garage
  Admin, and sign-in exposes no registration, password, or alternate provider.
  The editorial statement uses the approved Vehicle and Service Record product
  nouns. Desktop and mobile headings use the exact display-xl and display-lg
  type roles from `DESIGN.md`. The Rosso Corsa hover token applies only to
  hover-capable fine pointers, with active styling ordered to retain precedence.
  Authenticated navigation remains deferred to AUTH-23.
- Review: Initial review found medium-severity product-language and mobile type
  role deviations, plus a low-severity missing documented primary hover state.
  The copy, exact named typography tokens, hover-capability guard, active
  precedence, and copy regression assertion now address those findings. Targeted
  validation passes 19 tests and the full suite passes 235 tests; re-review
  found no remaining high- or medium-severity findings.
- Next unblocked task: AUTH-23 — Add authenticated navigation with identity and
  sign-out. AUTH-24 remains independently unblocked in the
  authentication provider/application area.

### AUTH-23 — Add authenticated navigation with identity and sign-out

- Implementation: Added an app-owned authenticated application shell around the
  protected route outlet. The responsive dark header displays the existing
  Fullstack Garage logo, one Dashboard navigation target, the current app-owned
  display name, the Garage Admin role label, and local sign-out. The shell is
  created only by the authenticated `ProtectedRoute` branch and disappears as
  soon as the authentication controller begins sign-out.
- Files changed: `src/app/shell/AuthenticatedAppShell.tsx`,
  `src/app/shell/AuthenticatedAppShell.module.css`,
  `src/app/routes/ProtectedRoute.tsx`,
  `src/app/routes/AppRoutes.test.tsx`, `src/styles/global.css`.
- Validation run: `npm test -- src/app/routes/AppRoutes.test.tsx
  src/App.test.tsx src/features/auth/AuthenticationScreens.test.tsx` (passed,
  26 tests); `npm test` (passed, 242 tests); `npm run typecheck` (passed);
  `npm run lint` (passed); `npm run build` (passed); `git diff --check`
  (passed).
- Decisions made: The shell consumes only `AppUser` and `useAuthentication`
  through the authenticated route guard; it has no provider SDK, environment,
  token, or listener dependency. The role label is derived from the app-owned
  role and renders the approved Garage Admin language for the authenticated MVP
  user. Navigation intentionally exposes only Dashboard because Vehicle and
  Service Record screens are unfinished. The Dashboard `NavLink` supplies an
  accessible active-page state. Logo, navigation, and sign-out controls have
  visible focus treatment and 48px targets, while the header wraps into a
  compact mobile layout using shared design tokens and sharp geometry. A real
  provider/controller test holds the gateway sign-out pending and verifies the
  controller's synchronous initializing transition removes the protected shell.
  `ProtectedRoute` and the access-unavailable flow reuse the domain
  `isGarageAdmin` rule and fail closed for an anomalous authenticated member:
  no shell or protected outlet renders, the unavailable screen remains stable,
  and sign-out remains available. The shell therefore has no Member fallback and
  displays the exact Garage Admin label. AUTH-24 private-cache cleanup was not
  introduced.
- Review: Initial review found a medium-severity defense-in-depth gap where an
  anomalous authenticated member could reach the shell. The route now reuses the
  domain authorization rule, and a regression test verifies stable unavailable
  access, sign-out, and absence of shell/protected content. Targeted validation
  passes 26 tests and the full suite passes 242 tests; re-review found no
  remaining high- or medium-severity findings.
- Next unblocked task: AUTH-24 — Add centralized private-state cleanup on
  sign-out and identity change.

### AUTH-24 — Add centralized private-state cleanup on sign-out and identity change

- Implementation: Added an app-owned registration-based private-state cleanup
  registry and integrated user ownership into the authentication controller.
  Cleanup callbacks may be synchronous or asynchronous, unregister independently,
  all run even when one fails, and never expose callback values or failures.
  Sign-out hides authenticated state synchronously, releases ownership, starts
  cleanup, and proceeds with local gateway sign-out. Restore outcomes clear
  owned state when access is lost or the app-user ID changes while preserving
  same-user state across session/token restoration.
- Files changed:
  `src/application/authentication/privateStateCleanupRegistry.ts`,
  `src/application/authentication/privateStateCleanupRegistry.test.ts`,
  `src/application/use-cases/auth/authenticationController.ts`,
  `src/application/use-cases/auth/authenticationController.privateStateCleanup.test.ts`,
  `src/app/authenticationComposition.ts`,
  `src/app/authenticationComposition.test.ts`,
  `src/app/providers/authenticationContext.ts`,
  `src/app/providers/AuthenticationProvider.tsx`,
  `src/app/providers/AuthenticationProvider.test.tsx`, `src/App.test.tsx`,
  `src/app/routes/AppRoutes.test.tsx`.
- Validation run: `npm test -- src/app/routes/AppRoutes.test.tsx
  src/application/authentication/privateStateCleanupRegistry.test.ts
  src/application/use-cases/auth/authenticationController.test.ts
  src/application/use-cases/auth/authenticationController.privateStateCleanup.test.ts
  src/app/providers/AuthenticationProvider.test.tsx
  src/app/authenticationComposition.test.ts` (passed, 73 tests); `npm test`
  (passed, 255 tests); `npm run typecheck` (passed); `npm run lint` (passed);
  `npm run build` (passed); `git diff --check` (passed).
- Decisions made: The registry is provider-neutral and receives no feature,
  query-library, or vendor dependency. Composition lazily injects one registry
  into the singleton controller. The controller tracks only the app-owned user
  ID. A single cleanup barrier releases the prior owner before awaiting callbacks
  and assigns a next owner only after cleanup when that operation is still
  current. This makes A-to-B, loss-of-access, and overlapping stale restores
  deterministic without clearing same-user refreshes. Sign-out releases cleanup
  before calling the gateway, invokes the gateway in the same turn, and waits for
  both; callback failures cannot block the gateway or final app-owned state, and
  gateway failure cannot retain private ownership. The React context exposes a
  stable `registerPrivateStateCleanup` method and `usePrivateStateCleanup` hook;
  StrictMode registration cleanup and unmount unregistration are verified.
  Every registration has an independent entry token even when callback identity
  is shared. Each clear uses an immutable epoch snapshot: removal after an epoch
  starts does not cancel it, and later registrations wait until the next clear.
  The callback API documents its non-reentrant contract: cleanup must not invoke
  or await authentication-controller operations that may be blocked on the same
  cleanup barrier.
  AUTH-24 does not create or import Vehicle, Service Record, or cache/query
  implementations.
- Review: Initial review found a medium-severity callback-identity registration
  collision. Per-registration tokens and exact duplicate-callback regression
  coverage now preserve independent unregister handles. Snapshot epoch behavior
  and the non-reentrant callback contract also address the related low-severity
  observations. Targeted validation passes 73 tests and the full suite passes
  255 tests; re-review found no remaining high- or medium-severity findings.
- Next unblocked task: AUTH-25 — Document environment setup and
  repeatable Garage Admin bootstrap. AUTH-26 is also technically unblocked but
  retains its product-owner recovery-policy decision gate.

### AUTH-25 — Document environment setup and repeatable Garage Admin bootstrap

- Implementation: Added a focused operations runbook for isolated local,
  staging, and production configuration; public browser keys; exact Google and
  app callback boundaries; session-default verification; migration deployment;
  a supervised signup window; and post-bootstrap access checks. The runbook
  includes a serialized privileged transaction that verifies the live Google
  auth user, provisions a missing app-user mapping through the existing
  service-role-only API function, promotes only the verified mapped `member`,
  remains repeatable for that same admin, and aborts if a different admin or any
  identity invariant exists.
- Files changed: `docs/operations/authentication-access-runbook.md`,
  `docs/features/authentication-access.md`,
  `docs/features/authentication-access.progress.md`.
- Validation run: Documentation diff and whitespace checks passed; static secret
  pattern review found no embedded Supabase secrets, JWTs, OAuth client secrets,
  or service-role assignments; all external links target official Supabase or
  Google documentation; SQL names and grants were compared with the current
  migrations. `npm test` passed (255 tests); `npm run typecheck`, `npm run lint`,
  and `npm run build` passed. `npm run test:db` could not run because the
  Supabase CLI is not installed in this environment; the runbook records it as
  a required operator gate.
- Decisions made: Kept dashboard instructions purpose-based because UI labels
  can change. Used runtime `psql` prompts so sensitive identity values do not
  enter shell history, boolean-only verification output for redacted evidence,
  and a table lock plus exactly-one-admin assertions to serialize concurrent
  attempts. The procedure never changes grants/RLS or exposes a privileged key,
  closes signup on every abort path, and deliberately defers account recovery to
  AUTH-26.
- Review: Initial review found two medium-severity bootstrap-window and
  current-scope verification gaps, plus a low-severity environment-isolation
  gap. Remediation now requires an empty auth-user baseline, disables every
  non-Google creation/provider path, closes global signup immediately after the
  intended sign-in, re-audits before a transaction that locks and asserts the
  exactly-one-user baseline, and limits post-bootstrap evidence to current
  auth-owned route, table, and RPC controls. Separate hosted Google OAuth clients
  are mandatory unless a security-reviewed exception exists. Re-review found no
  remaining high- or medium-severity findings; live database validation remains
  an explicit operator gate because the Supabase CLI is unavailable locally.
- Next unblocked task after product-owner direction: AUTH-26 — Document
  privileged single-admin account recovery.

### AUTH-26 — Document privileged single-admin account recovery

- Implementation: Added a dedicated incident runbook for authorized,
  two-person-reviewed recovery of the sole Garage Admin identity. The procedure
  starts with signup closed and only Google enabled, verifies the exact
  single-admin baseline, opens signup only for one replacement Google identity,
  closes it immediately, and verifies the generated provisional member mapping.
  Its serialized transaction removes the old identity mapping, reassigns the
  replacement's existing mapping to the stable admin `AppUserId`, deletes only
  the now-orphaned provisional member, retains the old auth row unmapped, and
  exposes five boolean pre-commit assertions for two-person approval.
- Files changed:
  `docs/operations/authentication-access-recovery-runbook.md`,
  `docs/features/authentication-access.md`,
  `docs/features/authentication-access.task-breakdown.md`,
  `docs/features/authentication-access.progress.md`.
- Validation run: Documentation whitespace, official-link-domain, static secret,
  and schema/SQL/grant checks passed. `npm test` passed (255 tests); `npm run
  typecheck`, `npm run lint`, and `npm run build` passed. `npm run test:db` could
  not run because the Supabase CLI is not installed in this environment; live
  transaction and database-suite execution remain authorized environment gates.
- Decisions made: Applied the product-owner-approved atomic no-overlap policy and
  preserved the existing admin app identity rather than promoting a second app
  user. The old `auth.users` row is never modified or deleted and is retained
  without a mapping for audit. Runtime prompts and boolean-only output keep all
  identity values out of retained evidence. Commit is a separate explicit step
  after both reviewers approve; every error path keeps signup disabled and
  requires rollback before commit. Lost-login verification is not claimed.
- Review: Feature reviewer found no high- or medium-severity findings. Static
  SQL/security checks passed; live recovery and database execution remain
  explicit authorized-environment gates.
- Next unblocked task: AUTH-27 — Run and remediate the final authentication
  security audit.

### AUTH-27 — Run and remediate the final authentication security audit

- Implementation: Audited the full Authentication and Access diff, production
  code, adapter/composition boundaries, environment handling, routes and callback
  behavior, migrations and grants, tests, runbooks, and production bundle. Added
  the redacted audit report. Remediated one medium build-boundary issue by
  extracting the existing Supabase public-config value validation into a pure
  shared module and invoking it from both the browser reader and Vite guard, so
  a secret/service-role key, credential-bearing URL, malformed/incomplete pair,
  or unapproved public variable fails before Vite can embed it.
- Files changed: `viteEnvironmentGuard.ts`, `viteEnvironmentGuard.test.ts`,
  `src/shared/config/supabaseConfig.ts`,
  `src/shared/config/supabaseBrowserConfigValidation.ts`,
  `docs/operations/authentication-access-security-audit.md`,
  `docs/features/authentication-access.md`,
  `docs/features/authentication-access.progress.md`.
- Validation run: Targeted auth/config/redirect/composition/provider/route/
  Supabase/static database tests passed (22 files, 256 tests); `npm test` passed
  (24 files, 259 tests); `npm run typecheck`, `npm run lint`, `npm run build`,
  and `git diff --check` passed. Post-build marker-only scanning found zero
  secret-like key suffixes, JWT-shaped values, embedded publishable-key values,
  service-role markers, or private test markers. `npm run test:db` exited 127
  with `sh: 1: supabase: not found`; no live database pass is claimed.
- Decisions made: Reused one pure fixed-message validator at the Node build and
  browser runtime boundaries to prevent validation drift and avoid pulling
  `import.meta.env` into the Node TypeScript project. Search evidence was
  interpreted with source context: the Supabase dependency's literal secret-key
  prefix and OAuth error-field names are library code, while suffix/value scans
  confirm no configured secret or test payload reached the bundle. No
  architecture change, product-table policy, recovery execution, or unrelated
  remediation was introduced.
- Review: One medium finding was remediated. Independent re-review found no
  remaining high- or medium-severity findings and reproduced targeted/full
  tests, typecheck, lint, build, diff, adversarial config, and bundle checks.
- Next unblocked task: AUTH-28 — Run final automated verification and record
  manual gates.

### AUTH-28 — Run final automated verification and record manual gates

- Implementation: Re-ran final repository and targeted Authentication and
  Access verification, rebuilt and rescanned the production assets, confirmed
  that post-audit provider/config/logging boundaries have not drifted, reviewed
  the complete worktree scope, and recorded the deployment-owner checklist
  below. No production code, migration, privileged environment, or unrelated
  user/agent file was changed by AUTH-28.
- Files changed: `docs/features/authentication-access.progress.md` only.
- Validation run:
  - `npm test` — passed: 24 test files, 259 tests.
  - `npm run typecheck` — passed.
  - `npm run lint` — passed with zero warnings.
  - `npm run build` — passed; Vite transformed 1,848 modules and produced the
    production bundle.
  - `git diff --check` — passed.
  - `npm test -- viteEnvironmentGuard.test.ts src/shared/config
    src/shared/validation src/application/authentication
    src/application/use-cases/auth
    src/application/ports/authGateway.contract.ts
    src/app/authenticationComposition.test.ts src/app/providers src/app/routes
    src/features/auth src/infrastructure/supabase supabase/tests` — passed: 22
    test files, 256 tests, including auth security and database-static coverage.
  - Post-build value-shaped scans — zero secret-like Supabase key suffixes,
    JWT-shaped values, embedded publishable-key values, service-role markers,
    and private test markers.
  - Post-audit boundary searches — zero production Supabase SDK/API sites outside
    infrastructure, concrete adapter constructions outside composition,
    environment reads outside the shared config/build boundaries, and production
    logging/analytics sites.
  - `npm run test:db` — unavailable, exit 127: `sh: 1: supabase: not found`.
    Live migrations and pgTAP did not run and are not reported as passed.
  - `git status --short` and `git diff --stat` — reviewed. The worktree contains
    the Authentication and Access implementation plus pre-existing untracked
    `.codex/agents/` task-agent definitions; AUTH-28 did not modify, remove, or
    otherwise alter those unrelated/user-owned agent files.
- Decisions made: Available automated gates are green, so the Authentication and
  Access repository implementation is complete. This does not complete or imply
  the live database, provider, deployment, bootstrap, staging, or incident gates.
  The absence of the Supabase CLI is recorded as tooling unavailability, not an
  unrelated test failure and not a database pass.
- Review: Feature reviewer found no high- or medium-severity findings and
  independently reproduced the full/targeted tests, typecheck, zero-warning
  lint, build, diff, bundle, and boundary results. The unavailable live database
  result and every unchecked manual gate were confirmed accurate.
- Next unblocked task: None; all 28 repository tasks are complete. Only the
  manual deployment/cross-feature gates below remain.

#### Manual environment checklist — not executed by repository verification

- [ ] Supply isolated local, staging, and production Supabase projects,
  approved public SPA values, and Google credentials through approved secret
  management; confirm no secret/service-role value enters the SPA, Git, logs,
  history, or retained evidence.
- [ ] Verify exact environment-specific Google-to-Supabase redirect URIs and
  exact Supabase-to-app `/auth/callback` allowlists; use HTTPS in staging and
  production and localhost only for local development.
- [ ] Apply the complete migration set to the verified target, run reset and
  live pgTAP/database tests with the Supabase CLI, reconcile migration lists,
  and record redacted pass/fail evidence.
- [ ] Confirm maximum duration, inactivity, token lifetime, and concurrent
  session settings use documented Supabase defaults or the approved one-day
  lifetime/inactivity fallback.
- [ ] Execute the controlled initial Google signup/bootstrap with a verified
  intended identity, privileged member-to-admin promotion, exactly-one-admin
  assertions, and immediate public-signup closure; re-audit that every
  non-Google creation path remains disabled.
- [ ] In staging, complete real Google sign-in, cancellation, successful callback,
  and invalid/expired callback behavior without retaining callback/provider data.
- [ ] Verify startup session restoration after refresh and a protected deep link,
  including no protected shell/content during initialization.
- [ ] Verify an unmapped/outsider identity and an approved mapped-member fixture
  receive access unavailable, cannot render the protected shell/outlet, and
  are denied direct auth-owned table access, role mutation, and privileged
  provisioning RPC execution.
- [ ] Verify sign-out clears the local Supabase session and registered private
  client state, hides the shell immediately, and does not leak private values.
- [ ] Do not execute replacement recovery as a routine release check. It remains
  incident-authorized and two-person reviewed; the documented recovery procedure
  has not been executed by this feature verification.
- [ ] Defer Vehicle and Service Record row-level authorization claims until those
  tables/migrations exist and their runbooks prove policies based on
  `is_garage_admin()`.

## Planning Decisions

- Preserved `authentication-access-breakdown.md` unchanged as the prior detailed
  planning source.
- Added explicit dependencies and file ownership in the canonical plan rather
  than renumbering or rewriting the prior 28 tasks.
- Chose AUTH-01 first because the repository has no test runner and later tasks
  require deterministic targeted validation.
- Kept Vehicle and Service Record table policies outside this feature's current
  migrations because those tables do not exist and the approved breakdown
  forbids placeholder product tables.
- Marked privileged single-admin recovery as a decision gate because the feature
  specification intentionally leaves the recovery procedure open.
- Product-owner direction on 2026-07-20 resolved that gate with an atomic,
  no-overlap mapping replacement that preserves the admin `AppUserId`, retains
  the old auth row unmapped, and deletes only the orphaned provisional member.

## Outstanding Gates

- The real Google OAuth staging smoke test requires environment credentials and
  an authorized human operator.
- Garage Admin promotion and public sign-up disabling require a reviewed
  privileged operation in each environment.
- Executing account recovery remains an incident-authorized, two-person manual
  environment gate; the recovery policy itself is now approved and documented.
- Vehicle and Service Record feature migrations must consume the authorization
  helper introduced by AUTH-11 when those tables are implemented.
