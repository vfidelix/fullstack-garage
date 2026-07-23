# Authentication and Access Controlled Task Breakdown

Status: AUTH-29 complete; manual environment gates outstanding
Plan revision: AUTH-PLAN-002 (approved 2026-07-23)
Source: [Authentication and Access Feature](authentication-access.md)  
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)  
Prior planning: [Authentication and Access Implementation Breakdown](authentication-access-breakdown.md)

## 1. Purpose

This is the canonical execution plan for the controlled task loop. The earlier
implementation breakdown is preserved as the detailed scope source; this
document adds stable task IDs, dependencies, validation expectations, concurrency
boundaries, and completion gates.

Each worker must implement exactly one task. After its validation passes, a
reviewer must compare the feature specification, this plan, the progress ledger,
and the current git diff. High- and medium-severity findings must be fixed and
re-reviewed before the task is marked complete.

## 2. Repository Baseline

- The repository is a minimal React 19, Vite 8, and strict TypeScript 6 SPA.
- Node.js 24.18.0 and npm are required; `package-lock.json` is authoritative.
- No authentication, routing, Supabase, application, domain, or test modules
  exist yet.
- No test runner or `npm test` script exists yet.
- Supabase details must remain under `src/infrastructure/supabase/`; migrations
  and database tests belong under `supabase/`.
- UI work must use `DESIGN.md`, global tokens in `src/styles/global.css`, and
  colocated CSS Modules.

## 3. Task Status and Dependency Matrix

`Depends on` lists hard dependencies. Tasks with satisfied dependencies may run
in parallel only when their declared file areas do not overlap.

| ID | Task | Depends on | Primary file area | Task validation |
| --- | --- | --- | --- | --- |
| AUTH-01 | Add runtime and test dependencies; configure Vitest and `npm test` | None | package/config files | Empty/smoke test, typecheck, lint, build |
| AUTH-02 | Add `AppUserId`, `AppUserRole`, `AppUser`, and Garage Admin recognition | AUTH-01 | `src/domain/users/` | Domain unit tests, typecheck, lint, build |
| AUTH-03 | Define app-owned authentication states, results, errors, and `AuthGateway` | AUTH-02 | `src/application/ports/`, auth application models | Contract type/unit tests, typecheck, lint, build |
| AUTH-04 | Implement safe local return-path validation | AUTH-01 | `src/shared/validation/` | Return-path unit tests, typecheck, lint, build |
| AUTH-05 | Implement provider-neutral authentication workflows | AUTH-03, AUTH-04 | `src/application/use-cases/auth/` | Targeted workflow tests, typecheck, lint, build |
| AUTH-06 | Complete authentication state-transition coverage | AUTH-05 | Auth application tests | Targeted tests, typecheck, lint, build |
| AUTH-07 | Add `app_users` and `user_identities` schema migration | AUTH-01 | `supabase/migrations/` | Migration reset/lint when available; static SQL review |
| AUTH-08 | Add controlled deny-by-default user provisioning | AUTH-07 | New Supabase migration/database tests | Migration reset and targeted database tests |
| AUTH-09 | Add current-app-user and role SQL helpers | AUTH-08 | New Supabase migration/database tests | Migration reset and targeted database tests |
| AUTH-10 | Apply deny-by-default RLS to auth-owned tables | AUTH-09 | New Supabase migration/database tests | Role/access database tests |
| AUTH-11 | Add reusable Garage Admin SQL authorization helper | AUTH-09 | New Supabase migration/database tests | Helper database tests |
| AUTH-12 | Complete authentication database integration coverage | AUTH-10, AUTH-11 | `supabase/tests/` | Full database test suite and migration reset |
| AUTH-13 | Validate public browser Supabase configuration and add `.env.example` | AUTH-01 | `src/shared/config/`, `.env.example` | Config unit tests, typecheck, lint, build |
| AUTH-14 | Create the singleton Supabase client | AUTH-13 | `src/infrastructure/supabase/client.ts` | Targeted tests, typecheck, lint, build |
| AUTH-15 | Map Supabase failures to app-owned auth errors | AUTH-03, AUTH-14 | `src/infrastructure/supabase/auth/` | Error-mapping unit tests, typecheck, lint, build |
| AUTH-16 | Implement `SupabaseAuthGateway.restore()` | AUTH-02, AUTH-03, AUTH-09, AUTH-14, AUTH-15 | Supabase auth adapter | Targeted adapter tests, typecheck, lint, build |
| AUTH-17 | Implement Google OAuth sign-in, callback support, and sign-out | AUTH-04, AUTH-15, AUTH-16 | Supabase auth adapter | Targeted adapter tests, typecheck, lint, build |
| AUTH-18 | Add the reusable `AuthGateway` contract suite | AUTH-17 | Auth contract tests | Contract suite against Supabase adapter, typecheck, lint, build |
| AUTH-19 | Add the authentication composition root | AUTH-05, AUTH-17 | `src/app/` composition | Composition tests, typecheck, lint, build |
| AUTH-20 | Add the single React authentication provider | AUTH-06, AUTH-19 | `src/app/providers/` | Provider component tests, typecheck, lint, build |
| AUTH-21 | Add routes, callback handling, deep-link restoration, and protection | AUTH-04, AUTH-20 | `src/app/routes/` | Route/component tests, typecheck, lint, build |
| AUTH-22 | Build initialization, sign-in, unauthorized, and retry-error screens | AUTH-21 | `src/features/auth/`, global design tokens | Accessible UI tests, typecheck, lint, build |
| AUTH-23 | Add authenticated navigation with identity and sign-out | AUTH-22 | App shell/auth feature UI | Navigation tests, typecheck, lint, build |
| AUTH-24 | Add centralized private-state cleanup on sign-out and identity change | AUTH-20 | Auth application/provider modules | Cleanup/provider tests, typecheck, lint, build |
| AUTH-25 | Document environment setup and repeatable Garage Admin bootstrap | AUTH-08, AUTH-13, AUTH-17 | `docs/operations/` or feature runbook | Documentation/security review |
| AUTH-26 | Document privileged single-admin account recovery | AUTH-08, AUTH-09 | `docs/operations/` or feature runbook | Documentation/security review; product-owner decision gate |
| AUTH-27 | Run and remediate the final auth security audit | AUTH-12, AUTH-18, AUTH-23, AUTH-24, AUTH-25, AUTH-26 | Auth feature scope only | Audit searches plus all automated checks |
| AUTH-28 | Run final automated verification and record manual gates | AUTH-27 | Progress/runbook documentation | `npm test`, typecheck, lint, build, database suite |
| AUTH-29 | Preserve active workflows during background session reconciliation | AUTH-20, AUTH-21, AUTH-24 | Auth application/provider/event modules and focused workflow tests | Controller, provider, route, Vehicle, and Service Record regression tests; typecheck, lint, build |

## 4. Task Scope and Completion Criteria

The detailed behavior for AUTH-01 through AUTH-28 is the corresponding Task 1
through Task 28 in the preserved prior planning document. AUTH-29 is a
post-implementation remediation introduced by the approved 2026-07-23 feature
update. The following controls are additional and authoritative:

- AUTH-01 should add only dependencies required by the approved feature and its
  tests. It must not add authentication behavior.
- AUTH-03 must keep all public contract types provider-neutral and must not
  expose session or token values.
- AUTH-05 owns application state transitions; AUTH-20 adapts that owner to React
  and must not create a second source of truth.
- AUTH-07 through AUTH-12 must use additive, versioned migrations. Provisioning
  must assign `member` only; Garage Admin promotion remains a verified,
  privileged operation documented by AUTH-25.
- AUTH-11 must not create placeholder Vehicle or Service Record tables. It
  supplies the stable helper those later feature migrations will consume.
- AUTH-13 may expose only the public Supabase URL and publishable/anonymous key.
  Validation errors must not include configuration values.
- AUTH-16 and AUTH-17 must keep all Supabase SDK types, callbacks, errors, and
  storage behavior inside `src/infrastructure/supabase/`.
- AUTH-22 and AUTH-23 must use **Garage Admin**, include accessible states, and
  preserve the Ferrari sharp geometry and token system from `DESIGN.md`.
- AUTH-24 must provide registration-based cleanup without importing future
  Vehicle or Service Record implementations.
- AUTH-27 may remediate only Authentication and Access findings. Any required
  architecture change triggers the user's stop condition.
- AUTH-28 distinguishes repository-complete verification from the manual
  environment gates below; it must not claim unperformed staging verification.
- AUTH-29 must preserve the authenticated state and mounted protected route
  during same-user background reconciliation. It must not publish an
  intermediate `initializing` state for routine token refresh or browser
  refocus.
- AUTH-29 must retain full-page initialization for startup and authentication
  callback flows where no authenticated application user has been established.
- AUTH-29 must keep provider events behind a provider-neutral application port.
  Supabase event names, session objects, and token values must remain inside
  `src/infrastructure/supabase/`.
- AUTH-29 must preserve the existing newest-operation-wins protection and must
  transition fail closed on confirmed sign-out, session expiry or revocation,
  authorization loss, and application-user identity change. Private state must
  be cleared before another user can own it.
- AUTH-29 regression coverage must prove that partially entered Vehicle and
  Service Record forms remain mounted and unchanged through token refresh,
  browser refocus, and same-user reconciliation. It must also prove that
  sign-out, expiry, authorization loss, and identity change still remove access
  and run the required private-state cleanup.

## 5. Safe Parallelism

The controlled loop remains sequential by default. These lanes are safe only
after all dependencies are satisfied and only when workers keep to their primary
file areas:

- After AUTH-01: AUTH-02, AUTH-04, AUTH-07, AUTH-13, and the initial drafts for
  AUTH-25/AUTH-26 may proceed independently. AUTH-25/AUTH-26 cannot be completed
  until their listed technical dependencies are verified.
- After AUTH-03 and AUTH-14: AUTH-05 and AUTH-15 are separate application and
  infrastructure edits.
- After AUTH-09: AUTH-10 and AUTH-11 should be separate migrations and may run in
  parallel if migration filenames are coordinated before editing.
- After AUTH-20: AUTH-21 and AUTH-24 are logically independent, but they may run
  in parallel only if AUTH-24 does not edit the same provider file as AUTH-21.
- Test review, type checking, documentation review, and read-only security
  searches may run in parallel with implementation when they do not mutate the
  same files.

Do not run AUTH-16 and AUTH-17, AUTH-21 through AUTH-23, final remediation, or
AUTH-29 in parallel because those tasks touch tightly coupled modules. Wait for
every task in a parallel batch to finish and resolve conflicts before review.

## 6. Controlled Loop for Every Task

1. Confirm the task is unblocked in the dependency matrix.
2. Record it as `in_progress` in
   `authentication-access.progress.md`.
3. Assign one feature worker to that task only.
4. Run its targeted validation and the repository-wide checks listed in the
   matrix. For documentation-only tasks, run a documentation and secret review.
5. Assign a feature reviewer to inspect the three feature documents and current
   git diff.
6. Return high- and medium-severity findings to the same worker, rerun validation,
   and re-review until none remain.
7. Mark the task complete in the progress ledger with files, validation,
   decisions, and the next unblocked task.

If validation fails for an unrelated reason, parallel edits conflict, a
requirement is unclear, or an architecture change appears necessary, stop and ask
the user as instructed.

## 7. Manual and Cross-Feature Gates

Repository implementation cannot perform these deployment-owner actions:

- Supply Google and Supabase credentials for each environment.
- Confirm explicit local, staging, and production callback URLs.
- Verify the intended Supabase identity before privileged admin promotion.
- Execute the reviewed promotion and disable public sign-up.
- Confirm session controls and run the real Google staging smoke test.
- In the staging smoke test, verify that browser refocus and a real token refresh
  preserve partially entered Vehicle and Service Record data.

The feature specification also leaves the single-admin recovery procedure open.
AUTH-26 is therefore a product-owner decision gate: implementation must stop for
direction if the approved recovery mechanism cannot be derived without choosing
new operational policy.

Decision resolution (2026-07-20): The product owner approved atomic, no-overlap
replacement of the lost Google/Supabase identity mapping while preserving the
existing admin `AppUserId`, retaining the old auth row unmapped, and removing
only the replacement identity's orphaned provisional member. AUTH-26 is
unblocked for documentation under this policy.

Vehicle and Service Record tables do not exist in the current repository.
AUTH-11 must provide and verify the Garage Admin helper, while those feature
migrations must later apply it to their own tables. This is an explicit
cross-feature dependency, not permission to introduce placeholder tables.

## 8. Next Unblocked Task

None. AUTH-29 is complete; the remaining work is the manual environment gates
recorded in the progress ledger.
