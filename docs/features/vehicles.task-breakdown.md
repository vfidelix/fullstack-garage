# Vehicle Feature Controlled Task Breakdown

Status: VEH-PLAN-003 implementation complete
Plan revision: VEH-PLAN-003
Last updated: 2026-07-21  
Source: [Vehicle Feature](vehicles.md)  
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)  
Product: [Product Scope and Language](../product/fullstack-garage-product.md)  
Authentication dependency: [Authentication and Access](authentication-access.md)  
Service Record dependency: [Service Record Feature](service-records.md)

## 1. Purpose and Planning State

This is the canonical plan and progress document for the Vehicle feature. It
owns the stable execution task IDs, dependencies, task acceptance criteria,
validation requirements and outcomes, approval record, and reviewer finding
dispositions used by the controlled orchestration loop.

The user approved VEH-PLAN-002 and VEH-01 through VEH-13 on 2026-07-20 after
resolving the five product decisions and selecting a staged persistence boundary.
Implementation and review for VEH-PLAN-002 are complete.

VEH-PLAN-003 is an amendment plan for the Vehicle change introduced on
2026-07-21: Vehicles must store an optional Australian registration state or
territory code as `registrationState` to support PlateAPI registration lookup
and clearer registration display. Implementation for VEH-14 through VEH-18 is
complete and recorded in Section 6.

The current repository has no Service Record persistence, so history-dependent
delete blocking and odometer-unit locking remain explicitly deferred to the
Service Record persistence delivery.

Changing task scope, dependencies, or acceptance criteria requires a new plan
revision and clears the approval record. Updating task progress, concrete
validation outcomes, or review-finding dispositions does not change the plan
revision.

## 2. Repository Baseline

- The repository is a React 19, Vite 8, and strict TypeScript 6 SPA using Node.js
  24.18.0 and npm with an authoritative `package-lock.json`.
- Authentication and protected routing are implemented. The current
  `AuthenticationController` exposes the authenticated app-owned `AppUser`, and
  its private-state cleanup registry can clear Vehicle state during sign-out or
  identity changes.
- The authenticated shell currently exposes only Dashboard navigation. Unknown
  protected paths render a placeholder path view; no Vehicle routes or UI exist.
- No `src/domain/vehicles/`, Vehicle application port/use-case, Supabase Vehicle
  adapter, `vehicles` table, or Vehicle database test exists.
- Vitest, Testing Library, ESLint, strict type checking, and the production build
  are configured. `npm test`, `npm run typecheck`, `npm run lint`, and
  `npm run build` are current repository gates.
- The architecture calls for React Hook Form with Zod when forms are implemented
  and TanStack Query when remote feature state is implemented. None is currently
  installed.
- Existing database migrations provide `app_users`, identity mapping,
  `current_app_user_id()`, `current_app_user_role()`, and
  `is_garage_admin()` helpers. Supabase migrations and SDK access must stay in
  the infrastructure boundary.
- A Supabase CLI binary is present, but the sandboxed invocation currently fails
  while attempting to write telemetry under a read-only home directory. Live
  database validation will require a writable CLI home and an available local
  Supabase stack; static SQL tests must not be reported as live integration
  execution.
- The working tree was clean at VEH-PLAN-002 planning time. No production files
  were changed while creating VEH-PLAN-003.
- The current `docs/features/vehicles.md` differs from `origin/main` by adding
  optional persisted `registrationState`, Australian state/territory validation,
  database constraint expectations, compact label display with registration
  state, duplicate comparison including registration state, Service Record
  snapshot readiness, and verification coverage for the new field.

## 3. Delivery Boundaries

The approved Vehicle feature is expected to include:

- Provider-neutral Vehicle domain types, normalization, and validation.
- Business-oriented application errors, a repository port, and all eight
  specified use cases.
- A versioned `vehicles` migration with constraints, indexes, server-enforced
  Garage Admin authorization, caller-independent ownership, and atomic lifecycle
  enforcement.
- A Supabase repository adapter that maps only app-owned models and errors.
- Shared repository contract coverage and database authorization coverage.
- Active and archived Vehicle presentation; create, view, edit, archive,
  restore, and eligible permanent-delete workflows; and responsive accessible
  states that follow `DESIGN.md`.
- Query/cache composition that clears private Vehicle data on sign-out and
  identity changes.
- Persisted optional `registrationState` across domain models, form input,
  repository port contracts, Supabase persistence, list/detail display, duplicate
  warning comparison, and tests.

The work does not include Service Record editing, customer or owner profiles,
VIN lookup, unit conversion, images, documents, reminders, member behavior, or a
generic repository framework. Registration lookup behavior is owned by
[PlateAPI Vehicle Prefill](plateapi-vehicle-prefill.md); this breakdown owns the
Vehicle data-model and persistence support required by that feature.

## 4. Assumptions and Risks

### Assumptions

- Authentication remains the trusted source of the current Garage Admin and its
  stable `AppUserId`; Vehicle forms never accept `ownerId`.
- IDs and timestamps follow existing app-owned string conventions.
- Supabase remains the selected MVP adapter, but no Supabase SDK type or raw
  error crosses the infrastructure boundary.
- Routes, exact component decomposition, and internal query-key layout are
  implementation details as long as the approved behavior, deep-linking,
  accessibility, cache isolation, and responsive acceptance criteria are met.
- Domain rules remain plain TypeScript. Zod may mirror them at the presentation
  boundary but does not become the authoritative domain validator.
- Duplicate comparison spans active and archived Vehicles because the approved
  rule applies to another Vehicle without narrowing lifecycle state. It excludes
  the current Vehicle during edit, ignores capitalization and spaces in make,
  model, registration, and registration state, and treats missing registration
  and registration state values as equal.
- The initial Vehicle schema contains no representable Service Record history.
  Current Vehicle deletion and odometer-unit changes are therefore available;
  this is staged delivery, not a claim that future history checks are complete.
- Existing Vehicle rows created before VEH-PLAN-003 have no registration state.
  The migration must preserve them with `registration_state = null`.

### Risks

- `service_records` does not exist. Permanent-delete conflicts and odometer-unit
  locking cannot be implemented or tested in this delivery. The later Service
  Record migration must add both atomically with the non-cascading composite
  foreign key and extend Vehicle repository/UI coverage.
- The duplicate warning requires a deliberate repository capability across both
  lifecycle states. It must remain non-blocking and must not become an accidental
  database uniqueness constraint.
- Authentication database tests have recorded live-environment gaps. Vehicle RLS
  work must distinguish static SQL checks from a genuinely executed role matrix.
- Adding React Hook Form, Zod, and TanStack Query changes the dependency lock and
  composition root; the implementation should add only these architecture-owned
  dependencies and avoid a second application-state owner.
- Registration, VIN, odometer, engine, and notes are private. Raw provider
  failures, debug logs, analytics, snapshots, and tests must not leak real values.
- UI tasks touch shared tokens, routes, and the authenticated shell. They are
  intentionally ordered to avoid parallel write conflicts.

## 5. Resolved Decisions and Deferred Boundary

| Decision ID | Approved decision | Plan effect |
| --- | --- | --- |
| VEH-DEC-01 | Vehicle year is an integer from 1900 through 9999 inclusive; the maximum is fixed. | Domain, form, database, and tests use the same inclusive bounds. |
| VEH-DEC-02 | Make, model, registration, VIN, and engine have 50-character maxima; notes has a 500-character maximum. | UI, domain, adapter, and database validation use identical limits. |
| VEH-DEC-03 | New Vehicle forms default `odometerUnit` to `km`. | Form initialization and tests use `km`; users may select `mi`. |
| VEH-DEC-04 | Compact labels are `2021 Ferrari Roma · ABC 123`, `2021 Ferrari Roma`, `Ferrari Roma · ABC 123`, or `Ferrari Roma` depending on optional year/registration presence. | One app-owned formatter supplies list, detail, selector, and accessible labels. |
| VEH-DEC-05 | Save duplicates and show a non-blocking warning for another Vehicle with equal make, model, and registration after capitalization and spaces are ignored; two missing registrations match. | Add an all-lifecycle duplicate query/comparison, exclude the current edit ID, and add no uniqueness constraint. |
| VEH-DEC-06 | Implement Vehicle persistence now; defer Service Record-history-dependent delete blocking and odometer-unit locking until Service Record persistence. | No placeholder Service Record table and no current history-conflict claims or tests. The residual integration is recorded in Section 8. |
| VEH-DEC-07 | Store optional Australian registration state or territory as `registrationState`, limited to `ACT`, `NSW`, `NT`, `QLD`, `SA`, `TAS`, `VIC`, and `WA`. | Add a domain union, form field, database column/check constraint, repository mapping, duplicate comparison update, label display update, and coverage. |

There are no unresolved Vehicle product decisions in this revision. Explicit
user approval of VEH-PLAN-002 and its task IDs is recorded in Section 9.
VEH-PLAN-003 implementation outcomes are recorded in Section 6.

## 6. Task Summary and Dependency Matrix

Task status and validation outcomes are updated after each controlled worker run.
Normal dependency order is shown below; it does not authorize execution.
Write tasks must run sequentially under the orchestration workflow even when
their logical dependencies would otherwise permit parallel work.

| ID | Task | Depends on | Status | Required validation | Validation outcome |
| --- | --- | --- | --- | --- | --- |
| VEH-01 | Add Vehicle domain model, normalization, and invariants | None | Completed | Targeted domain tests; full test, typecheck, lint, build; diff check | Passed: 43 targeted tests; 302 full tests; typecheck, lint, build, and diff check passed |
| VEH-02 | Define Vehicle application errors and repository port | VEH-01 | Completed | Targeted contract/error tests; full repository gates | Passed: 10 targeted tests; 312 full tests; provider/deferred-boundary scans, typecheck, lint, build, and diff check passed |
| VEH-03 | Implement authenticated Vehicle use cases | VEH-02 | Completed | Targeted use-case tests; full repository gates | Passed: 24 targeted tests; 336 full tests; boundary scans, typecheck, lint, build, and diff check passed |
| VEH-04 | Add approved form/query dependencies and Vehicle composition foundation | None | Completed | Provider/composition tests; full repository gates; lockfile review | Passed: 8 targeted tests; 344 full tests; dependency/lockfile review, typecheck, lint, build, and diff check passed |
| VEH-05 | Add Vehicle schema, authorization, and lifecycle migration | VEH-01 | Completed | Static SQL tests; migration reset/lint and live constraints when available; full repository gates | Passed: 11 static tests; clean reset, database lint, transactional probes, and existing 38-test database suite; 355 full tests; typecheck, lint, build, and diff check passed |
| VEH-06 | Add Vehicle database role-matrix and invariant coverage | VEH-05 | Completed with live validation residual | Live database suite plus explicit static verifier; full repository gates | Implemented: 8 static verifier tests and all 363 repository tests passed; typecheck, lint, build, and diff check passed. Live database execution remains unavailable because Docker socket access was denied and escalated retries did not complete |
| VEH-07 | Implement the Supabase Vehicle repository and safe error mapping | VEH-02, VEH-05 | Completed | Targeted adapter/mapper tests; architecture scans; full repository gates | Passed: 33 targeted tests; 396 full tests; mapper, malformed-response, typed-harness, safe-error, architecture/privacy scans, typecheck, lint, build, and diff check passed |
| VEH-08 | Add the shared Vehicle repository contract suite | VEH-07 | Completed | Contract suite against Supabase harness; full repository gates | Passed: 27 shared contract tests; 423 full tests; privacy/provider/deferred-boundary scans, typecheck, lint, build, and diff check passed |
| VEH-09 | Compose Vehicle queries, mutations, and private-cache cleanup | VEH-03, VEH-04, VEH-07 | Completed | Query/cache/cleanup tests; full repository gates | Passed: 18 targeted tests; 441 full tests; identity-transition, stale-result, composition, architecture/privacy scans, typecheck, lint, build, and diff check passed |
| VEH-10 | Build active and archived Vehicle list views and navigation | VEH-09 | Completed with visual inspection residual | Route/component/accessibility tests at active, archived, empty, loading, error, desktop, and mobile states; full repository gates | Passed: 10 targeted route/component tests and all 451 repository tests; typecheck, lint, build, architecture/privacy/style scans, responsive source review, and diff check passed. Browser screenshot inspection was unavailable because no browser executable or Playwright harness is installed |
| VEH-11 | Build create, view, and edit Vehicle workflows | VEH-09, VEH-10 | Completed with visual inspection residual | Form/component tests for validation, privacy, persistence, duplicate warning, and responsive layout; full repository gates | Passed: 32 new focused form/workflow tests and 63 affected route/component tests; all 483 repository tests; typecheck, lint, build, privacy/provider/deferred-scope/style scans, responsive source review, and diff check passed. Browser screenshot inspection remains unavailable because no browser executable or Playwright harness is installed |
| VEH-12 | Build archive, restore, and current permanent-delete workflows | VEH-08, VEH-11 | Completed with visual inspection residual | Lifecycle UI/integration tests without deferred history-conflict claims; full repository gates | Passed: 6 new lifecycle workflow tests and 28 affected workflow/query tests; all 489 repository tests; typecheck, lint, build, privacy/deferred-scope/product-language/style scans, responsive source review, and diff check passed. Browser screenshot inspection was unavailable because no browser executable or Playwright harness is installed |
| VEH-13 | Run final end-to-end verification and document residual gates | VEH-06, VEH-08, VEH-12 | Completed with environment residuals | Full test, typecheck, lint, build, database suite, privacy/security searches, responsive smoke verification, diff check | Passed: 489 tests, typecheck, zero-warning lint, build, source/security/privacy/deferred-scope review, and diff check; post-review HTTP route/server smoke passed; live database, browser screenshots, and current registry audit remain unavailable; the bundle-size advisory remains |
| VEH-14 | Add registration state to Vehicle domain rules and labels | None | Completed | Targeted domain tests; full repository gates | Passed: targeted domain coverage included accepted/rejected codes, normalization, labels, and duplicate state comparison; 616 full tests, typecheck, lint, build, live database suite, and diff check passed |
| VEH-15 | Add registration state to Vehicle persistence and repository mapping | VEH-14 | Completed | Migration/static SQL tests, adapter/mapper/contract tests, full repository gates | Passed: migration/static SQL, mapper, adapter, shared contract, and live pgTAP coverage passed; `registration_state` round-trips through create/read/update/list/lifecycle/duplicate paths |
| VEH-16 | Add registration state to Vehicle forms, screens, and duplicate warning UI | VEH-14, VEH-15 | Completed | Form/workflow/component tests, accessibility checks, full repository gates | Passed: form schema, create/edit/detail/list/workflow, duplicate warning, and accessibility-oriented state-control tests passed; no PlateAPI lookup was added |
| VEH-17 | Update private-state cleanup, fixtures, and cross-feature docs for registration state | VEH-14, VEH-15, VEH-16 | Completed | Query/cache tests, fixture review, documentation consistency scan, full repository gates | Passed: query cleanup removes state-bearing list/detail/duplicate cache entries; fixtures include state-bearing and state-omitted Vehicles; Vehicle and Service Record docs were aligned |
| VEH-18 | Run VEH-PLAN-003 final verification and record residuals | VEH-14, VEH-15, VEH-16, VEH-17 | Completed | Full test, typecheck, lint, build, database checks where available, privacy/security scans, diff check | Passed: `npm test` 616 tests, typecheck, lint, build, `supabase db reset`, `npm run test:db` 118 pgTAP tests, static scans, and `git diff --check` passed; only existing jsdom navigation notice and Vite chunk-size advisory remain |

## 7. Detailed Task Contracts

### VEH-01 - Add Vehicle domain model, normalization, and invariants

- **Dependencies:** None.
- **Expected area:** `src/domain/vehicles/` and colocated tests only.
- **Acceptance criteria:** Add app-owned `VehicleId`, `OdometerUnit`, Vehicle,
  summary, create, and update types with readonly system-owned fields. Normal
  form inputs exclude owner, timestamps, and archive state. Normalize permitted
  text consistently; require trimmed make/model; enforce the inclusive integer
  year range 1900-9999 and exact 50/500-character limits; allow only `km`/`mi`;
  and accept only non-negative whole-number odometers. Add one app-owned compact
  label formatter for the four approved year/registration combinations. Add
  duplicate-key comparison that ignores capitalization and spaces in make,
  model, and registration, treats two missing registrations as equal, and can
  exclude the current Vehicle ID. Model active/archive state without React,
  Supabase, Zod, or provider imports.
- **Validation:** Targeted unit tests for every boundary and invalid case;
  compile-time/type assertions that create/update inputs exclude protected
  fields; `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`; `git
  diff --check`.
- **Status:** Completed.
- **Validation outcome:** Passed. All 43 targeted domain tests and all 302
  repository tests passed; typecheck, zero-warning lint, production build, and
  `git diff --check` passed.

### VEH-02 - Define Vehicle application errors and repository port

- **Dependencies:** VEH-01.
- **Expected area:** `src/application/vehicles/`, `src/application/ports/`, and
  colocated tests.
- **Acceptance criteria:** Define business-oriented results/errors for validation,
  not found, unauthorized, lifecycle state conflict, and temporary failure.
  Define the eight Vehicle workflows and the minimum all-lifecycle duplicate
  lookup capability using only app-owned types. A duplicate lookup excludes an
  optional current Vehicle ID and returns warning data, never a uniqueness error.
  No method accepts an owner ID, role, arbitrary filter, Supabase row/query
  builder, database object name, or provider error. Do not add history-conflict
  or odometer-unit-lock contracts before Service Record persistence exists.
- **Validation:** Targeted error and contract-shape tests/type assertions; provider
  boundary import scan; all repository gates and diff check.
- **Status:** Completed.
- **Validation outcome:** Passed. All 10 targeted application error and repository
  contract tests and all 312 repository tests passed; provider/deferred-boundary
  scans were empty; strict typecheck, zero-warning lint, production build, and
  `git diff --check` passed.

### VEH-03 - Implement authenticated Vehicle use cases

- **Dependencies:** VEH-02.
- **Expected area:** `src/application/use-cases/vehicles/` and colocated tests.
- **Acceptance criteria:** Implement `listActiveVehicles`,
  `listArchivedVehicles`, `getVehicle`, `createVehicle`, `updateVehicle`,
  `archiveVehicle`, `restoreVehicle`, and `deleteVehicle`. Every workflow fails
  closed without the current app-owned Garage Admin, never accepts caller-owned
  authorization fields, invokes only the business repository port, and returns
  app-owned safe outcomes. Creation/update uses the domain validation contract.
  Create/update may return a non-blocking duplicate warning after checking active
  and archived Vehicles under the approved comparison, but the warning never
  prevents persistence. Current deletion and odometer-unit changes are allowed
  because no Service Record history is representable. No React, query-library,
  or infrastructure dependency enters the use cases.
- **Validation:** Deterministic use-case tests covering admin success, missing or
  non-admin user denial, all repository outcomes, protected-input exclusion, and
  lifecycle rules; all repository gates and diff check.
- **Status:** Completed.
- **Validation outcome:** Passed. All 24 targeted use-case tests and all 336
  repository tests passed; provider/UI, protected-input, and deferred-boundary
  scans were empty; strict typecheck, zero-warning lint, production build, and
  `git diff --check` passed.

### VEH-04 - Add approved form/query dependencies and Vehicle composition foundation

- **Dependencies:** None.
- **Expected area:** `package.json`, `package-lock.json`, app provider/composition
  files, and focused tests.
- **Acceptance criteria:** Add only the architecture-specified React Hook Form,
  Zod, and TanStack Query runtime packages needed by Vehicle forms and remote
  state. Install one application-level query client/provider in the composition
  root with deterministic test construction and privacy-safe defaults. Do not
  add Vehicle behavior, a second authentication owner, speculative libraries,
  devtools, or provider configuration in feature code.
- **Validation:** Lockfile/version review; provider/composition tests; `npm test`;
  typecheck; lint; build; diff check.
- **Status:** Completed.
- **Validation outcome:** Passed. All 8 targeted provider/composition tests and
  all 344 repository tests passed; the dependency and lockfile review confirmed
  only the three approved direct runtime packages and their required transitive
  query core; strict typecheck, zero-warning lint, production build, and `git
  diff --check` passed.

### VEH-05 - Add Vehicle schema, authorization, and lifecycle migration

- **Dependencies:** VEH-01.
- **Expected area:** One additive versioned file in `supabase/migrations/` plus
  narrowly scoped static migration tests.
- **Acceptance criteria:** Create `vehicles` with the approved fields, exact
  length/year checks, nonblank make/model checks, non-negative whole odometer,
  `km`/`mi` constraint and approved default, timestamps, nullable archive time,
  `owner_id` foreign key, `(id, owner_id)` uniqueness, owner-list index, and
  active owner-list index. Enable RLS and expose only minimum browser privileges.
  Admin access derives from reviewed auth helpers; unauthenticated, unmapped, and
  non-admin identities receive no data. Creation derives owner from the current
  app user, and browser callers cannot choose owner or system fields. Archive,
  restore, update, and current delete authorization is atomic. Add no duplicate
  uniqueness constraint, placeholder/partial Service Record schema, history
  query, or claim of history-dependent delete/unit enforcement. Security-definer
  functions use a fixed safe search path and minimum grants.
- **Validation:** Parser/static tests for exact schema, constraints, grants,
  policies/functions, search paths, absence of a duplicate uniqueness constraint,
  and absence of placeholder Service Record objects;
  migration reset/lint and direct constraint probes when a local stack is
  available; all repository gates and diff check. Record unavailable live checks
  explicitly.
- **Status:** Completed.
- **Validation outcome:** Passed. All 11 static migration tests passed. A clean
  local Supabase reset applied the migration, database lint reported no schema
  errors, transactional synthetic probes verified representative constraints and
  minimum grants, and the existing 38-test database suite passed. All 355
  repository tests, strict typecheck, zero-warning lint, production build, and
  `git diff --check` passed. The CLI rejected the initial multi-statement direct
  probe file because it accepts one prepared statement; the corrected
  single-statement transactional probe passed.

### VEH-06 - Add Vehicle database role-matrix and invariant coverage

- **Dependencies:** VEH-05.
- **Expected area:** `supabase/tests/` only.
- **Acceptance criteria:** Add deterministic transactional database tests for an
  admin, mapped non-admin, authenticated unmapped identity, and unauthenticated
  caller across list, get, create, update, archive, restore, and delete. Verify
  caller-supplied owner/system fields cannot expand access; all schema
  constraints and active/archive list behavior; unauthorized direct table and
  RPC access; storage of duplicate-looking Vehicles; current permanent deletion;
  and current odometer-unit updates. Assert that no test claims Service Record
  history behavior in this delivery. Roll back fixtures and use synthetic
  values. Keep a static suite verifier separate and never present it as live
  execution.
- **Validation:** `npm run test:db` against a reset local database; targeted
  static verifier; full repository gates and diff check. Any unavailable live
  scenario remains a named blocking or residual gate rather than a pass.
- **Status:** Completed with live validation residual.
- **Validation outcome:** Implemented. The rollback-only suite contains 68
  deterministic pgTAP assertions for the complete four-caller operation matrix,
  protected fields, schema invariants, lifecycle behavior, direct access,
  duplicate storage, current deletion, and current odometer-unit changes. All 8
  static verifier tests and all 363 repository tests passed; strict typecheck,
  zero-warning lint, production build, and `git diff --check` passed. Live
  `npm run test:db` execution is not reported as passed: sandboxed Docker socket
  access failed, and two escalated retries did not complete before interruption.
  Executing the suite against a reset local database remains a named residual
  gate for VEH-13.

### VEH-07 - Implement the Supabase Vehicle repository and safe error mapping

- **Dependencies:** VEH-02 and VEH-05.
- **Expected area:** `src/infrastructure/supabase/repositories/` and focused
  tests.
- **Acceptance criteria:** Implement all Vehicle repository methods against the
  selected Supabase client. Validate unknown rows before mapping camel-cased,
  app-owned models. Support the minimum all-lifecycle duplicate lookup and
  current-ID exclusion without treating a match as an error. Map validation,
  not-found, authorization, lifecycle state, and temporary failures to fixed
  app-owned errors without leaking raw codes,
  relation/function names, payloads, registration, VIN, odometer, engine, notes,
  or query details. Do not accept owner IDs or expose Supabase response/query
  types. List ordering is deterministic and active/archive results cannot cross.
- **Validation:** Mapper boundary and malformed-response tests; safe error tests
  with private sentinels; CRUD/lifecycle adapter tests with a typed client
  harness; architecture and privacy scans; all repository gates and diff check.
- **Status:** Completed.
- **Validation outcome:** Passed 33 focused mapper, malformed-response,
  safe-error, and typed client-harness tests. All 35 test files and 396 tests,
  strict typecheck, zero-warning lint, production build, architecture/privacy
  scans, and `git diff --check` passed.

### VEH-08 - Add the shared Vehicle repository contract suite

- **Dependencies:** VEH-07.
- **Expected area:** application port contract tests and the Supabase adapter
  harness.
- **Acceptance criteria:** Define one provider-neutral contract suite covering
  create, get, update, active/archived lists, archive/restore, eligible permanent
  delete, current odometer-unit changes, allowed duplicate persistence,
  all-lifecycle duplicate warning lookup and edit-ID exclusion, Garage Admin
  access, not found, and safe error mapping. Do not include deferred
  Service Record-history behavior. Run it against the Supabase adapter harness
  so a future HTTP repository can reuse it. Contract fixtures use only synthetic
  private data and assert no provider detail crosses the port.
- **Validation:** Targeted contract suite plus all repository gates, privacy scan,
  and diff check.
- **Status:** Completed.
- **Validation outcome:** Passed. The provider-neutral suite ran 27 contract
  tests against the stateful Supabase adapter harness; all 36 test files and 423
  repository tests passed, together with strict typecheck, zero-warning lint,
  production build, privacy/provider/deferred-boundary scans, and `git diff
  --check`.

### VEH-09 - Compose Vehicle queries, mutations, and private-cache cleanup

- **Dependencies:** VEH-03, VEH-04, and VEH-07.
- **Expected area:** app composition and `src/features/vehicles/` query/state
  modules with focused tests.
- **Acceptance criteria:** Compose the Supabase repository only at the app
  boundary and expose feature hooks over approved use cases. Use distinct,
  app-owned query keys for active list, archived list, and Vehicle detail;
  invalidate/refetch the minimum state after mutations; prevent private data from
  surviving sign-out or identity change through the existing cleanup registry;
  and handle stale async results without reintroducing a former user's data.
  Feature modules do not read environment variables or select adapters.
- **Validation:** Query success/error/loading and invalidation tests; identity
  transition and sign-out cleanup tests; composition test; all repository gates,
  architecture scan, and diff check.
- **Status:** Completed.
- **Validation outcome:** Passed. All 18 focused composition, query, mutation,
  sign-out, identity-transition, and stale-result tests passed; all 441
  repository tests, strict typecheck, zero-warning lint, production build,
  architecture/privacy/deferred-boundary scans, and `git diff --check` passed.

### VEH-10 - Build active and archived Vehicle list views and navigation

- **Dependencies:** VEH-09.
- **Expected area:** Vehicle routes/screens/CSS, route paths/tests, authenticated
  shell navigation, and shared tokens only when required.
- **Acceptance criteria:** Add a protected Vehicles destination. The default view
  lists all active Vehicles for the Garage Admin; a separate explicit view or
  filter lists archived Vehicles. Both show deterministic approved labels and
  useful make/model/year/registration/odometer information without treating
  owner IDs as real-world ownership. Labels use the one approved app-owned
  formatter. Provide accessible loading, empty, error, retry, and selected
  navigation states. Use Lucide icons, Ferrari sharp
  geometry, existing/new shared tokens, dense operational layout, 44px-or-larger
  touch targets, and responsive narrow-screen rows without overlap. Do not add a
  marketing hero, nested cards, one-off colors, or Service Record creation UI.
- **Validation:** Route and component tests for active/archive separation,
  fallback labels, empty/loading/error/retry, accessible navigation/focus, and
  private-data-safe error copy; desktop/mobile rendering inspection; all
  repository gates and diff check.
- **Status:** Completed with visual inspection residual.
- **Validation outcome:** Passed. All 10 targeted route/component tests and all
  451 repository tests passed; strict typecheck, zero-warning lint, production
  build, architecture/privacy/style scans, responsive source review, and diff
  check passed. Runtime desktop/mobile screenshot inspection was unavailable
  because the repository has no Playwright harness and the environment exposes
  no browser executable.

### VEH-11 - Build create, view, and edit Vehicle workflows

- **Dependencies:** VEH-09 and VEH-10.
- **Expected area:** Vehicle form/detail components, routes, colocated CSS and
  tests, and shared tokens only when required.
- **Acceptance criteria:** The Garage Admin can create, deep-link to, view, and
  edit every approved Vehicle field except owner/system/archive fields. React
  Hook Form and Zod mirror the domain's exact limits and normalized optional
  semantics for immediate accessible feedback; the domain and database remain
  authoritative. The approved unit default is presented correctly. Unit change
  remains available in this delivery and performs no conversion. Matching active
  or archived Vehicles produce a visible non-blocking warning under the approved
  capitalization/space/missing-registration rule; editing excludes the current
  Vehicle, and save remains available. Server not-found, validation,
  authorization, lifecycle, and retryable failures have safe UI outcomes.
  Successful create/update refreshes relevant query state without retaining
  submitted private values in logs or URLs.
- **Validation:** Form tests at every boundary, whitespace normalization,
  optional clearing, odometer zero/integer handling, `km` initialization,
  protected-field exclusion, all duplicate comparison variants, non-blocking
  save, server errors, submit/retry, keyboard/focus behavior, and narrow/wide
  layouts; all repository gates, privacy scan, and diff check.
- **Status:** Completed with visual inspection residual.
- **Validation outcome:** Passed. All 32 new form-schema and create/detail/edit
  workflow tests, 63 affected route/component tests, and all 483 repository tests
  passed; strict typecheck, zero-warning lint, production build,
  architecture/privacy/deferred-scope/style scans, responsive source review, and
  `git diff --check` passed. Runtime desktop/mobile screenshot inspection was
  unavailable because the repository has no Playwright harness and the
  environment exposes no browser executable.

### VEH-12 - Build archive, restore, and current permanent-delete workflows

- **Dependencies:** VEH-08 and VEH-11.
- **Expected area:** Vehicle lifecycle presentation/state and focused tests.
- **Acceptance criteria:** Active Vehicles can be archived after explicit
  confirmation and disappear from normal selection/list state. Archived
  Vehicles remain viewable in the archived view and can be restored. Permanent
  delete is clearly described, requires deliberate confirmation, and is offered
  only through the approved workflow. Current deletion removes the Vehicle
  because no Service Record history is representable. Mutation state prevents
  duplicate submission, preserves safe retry behavior, and refreshes all affected
  lists and detail routes. Do not simulate a future history conflict or unit lock
  with UI-only flags.
- **Validation:** Component/integration tests for archive, restore, confirmed and
  cancelled current delete, failure/retry, duplicate-click prevention,
  navigation/cache refresh, accessibility, and responsive confirmation surfaces;
  all repository gates and diff check. No test may claim deferred history
  behavior.
- **Status:** Completed with visual inspection residual.
- **Validation outcome:** Passed. Six focused lifecycle workflow tests cover
  archive cancellation and focus return, modal focus containment, pending and
  duplicate-submit protection, safe failure and retry, restore, confirmed and
  cancelled permanent deletion from both lifecycle states, route destinations,
  and refreshed list outcomes. All 28 affected workflow/query tests and all 489
  repository tests passed. Strict typecheck, zero-warning lint, production
  build, privacy/deferred-scope/product-language/style scans, responsive source
  review, and `git diff --check` passed. Runtime desktop/mobile screenshot
  inspection remains unavailable because the repository has no Playwright
  harness and the environment exposes no browser executable. The build retains
  its existing greater-than-500 kB chunk advisory.

### VEH-13 - Run final end-to-end verification and document residual gates

- **Dependencies:** VEH-06, VEH-08, and VEH-12.
- **Expected area:** Feature plan progress/outcomes and only narrowly scoped fixes
  required by verification or approved review findings.
- **Acceptance criteria:** Exercise the complete active/archive/create/view/edit/
  lifecycle flow with the approved year, length, unit, label, duplicate, and
  Service Record boundary decisions. Confirm every Vehicle acceptance criterion,
  architecture dependency direction, server authorization matrix, private cache
  cleanup, safe error mapping, responsive UI, and absence of forbidden product
  language or secret/private logging that belongs to this staged delivery. Record
  the Service Record history integration in Section 8 as deferred, not passed.
  Record commands, exact results, manual evidence, unavailable environment gates,
  and residual risks in this canonical document. Do not broaden scope during
  remediation.
- **Validation:** `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`;
  `npm run test:db`; targeted privacy, provider-boundary, service-role-secret,
  and product-language searches; responsive desktop/mobile smoke verification;
  `git diff --check`; current diff review.
- **Status:** Completed with environment residuals.
- **Validation outcome:** Passed all available implementation gates. All 43 test
  files and 489 tests passed, as did strict typecheck, zero-warning lint, the
  production build, privacy/security/provider/product-language/deferred-scope
  scans, responsive source and component-coverage review, current diff review,
  dependency resolution, and `git diff --check`. The final build emitted the
  existing 623.56 kB main-chunk advisory. Live execution of the 68-assertion
  Vehicle pgTAP suite remains unavailable because Docker access was already
  denied during VEH-06 and was not retried after the bounded final instruction.
  No browser executable or Playwright harness is installed, so runtime
  desktop/mobile visual inspection remains unavailable. Post-review, the Vite
  dev server started outside the sandbox at `http://127.0.0.1:5173/` and an
  outside-sandbox `curl --head` returned `HTTP/1.1 200 OK`. The current npm
  registry audit was also unavailable: the sandboxed request failed DNS lookup
  and its escalated retry was interrupted without a result; VEH-04's earlier
  audit reported zero vulnerabilities. Deferred Service Record integration
  remains recorded in Section 8 and is not presented as passed.

### VEH-14 - Add registration state to Vehicle domain rules and labels

- **Dependencies:** None.
- **Expected area:** `src/domain/vehicles/` and colocated tests.
- **Acceptance criteria:** Add an app-owned `AustralianRegistrationState` union
  with exactly `ACT`, `NSW`, `NT`, `QLD`, `SA`, `TAS`, `VIC`, and `WA`. Add
  optional `registrationState` to Vehicle, summary, create, update, label, and
  duplicate-candidate types. Normalize and validate registration state without
  weakening existing make/model/year/registration/VIN/odometer/unit/engine/notes
  rules. Update compact labels to include registration state when both
  registration and state are present. Update duplicate comparison so make,
  model, registration, and registration state form the duplicate-looking key,
  with missing registration and state values matching other missing values.
  Domain code remains plain TypeScript with no React, Zod, Supabase, or PlateAPI
  dependency.
- **Validation:** Targeted domain tests for accepted and rejected state codes,
  optional omission, normalization, label combinations, duplicate comparison
  with same/different/missing states, protected-field exclusion, `npm test`,
  typecheck, lint, build, and diff check.
- **Status:** Completed.
- **Validation outcome:** Passed. Domain coverage now defines
  `AustralianRegistrationState`/`AUSTRALIAN_REGISTRATION_STATES`, normalizes
  blank and lowercase input, rejects unsupported codes with
  `invalid_registration_state`, formats labels such as
  `2021 Ferrari Roma · ABC 123 WA`, and treats same registration with different
  state as non-duplicate. Targeted domain coverage was included in the 173-test
  domain/form/repository/use-case run and the final 616-test suite.

### VEH-15 - Add registration state to Vehicle persistence and repository mapping

- **Dependencies:** VEH-14.
- **Expected area:** `supabase/migrations/`,
  `src/infrastructure/supabase/repositories/`,
  `src/application/ports/`, repository contract tests, mapper tests, and static
  database tests.
- **Acceptance criteria:** Add a versioned migration that introduces nullable
  `vehicles.registration_state` and a check constraint allowing only `ACT`,
  `NSW`, `NT`, `QLD`, `SA`, `TAS`, `VIC`, and `WA` when present. Existing rows
  remain valid with `registration_state = null`. Update Supabase row mapping,
  insert/update payloads, list/detail selection, duplicate lookup, safe error
  mapping where needed, and shared repository contracts so `registrationState`
  round-trips through create, read, update, active list, archived list, and
  duplicate-warning paths. No provider row type, SQL table name, or Supabase
  error crosses the infrastructure boundary.
- **Validation:** Migration/static SQL tests for nullable field and allowed-state
  constraint, mapper and adapter tests, shared repository contract tests,
  database reset/lint when available, `npm test`, typecheck, lint, build,
  privacy/provider-boundary scans, and diff check.
- **Status:** Completed.
- **Validation outcome:** Passed. Added migration
  `20260721000100_add_vehicle_registration_state.sql` with nullable
  `registration_state`, the eight-code check constraint, and authenticated
  insert/update column grants. Static migration/database tests passed, mapper and
  Supabase repository tests passed, shared repository contract coverage passed,
  `supabase db reset` applied the migration locally, and `npm run test:db`
  passed 118 pgTAP assertions.

### VEH-16 - Add registration state to Vehicle forms, screens, and duplicate warning UI

- **Dependencies:** VEH-14 and VEH-15.
- **Expected area:** `src/features/vehicles/`, route/workflow tests, and
  component CSS if needed.
- **Acceptance criteria:** Add a registration-state control to Vehicle create and
  edit forms using the approved eight Australian state/territory codes. The
  field is optional and saved only when selected. Form validation mirrors domain
  validation and keeps manual Vehicle creation available. List, detail, and
  duplicate-warning copy display registration state consistently with the
  updated formatter. UI follows `DESIGN.md`, existing module CSS patterns, and
  privacy/product-language rules. Do not implement PlateAPI lookup in this task.
- **Validation:** Form-schema tests, create/edit/detail/list workflow tests,
  duplicate-warning UI tests for same and different registration states,
  accessibility checks for the state control, responsive source review, `npm
  test`, typecheck, lint, build, product-language/privacy scans, and diff check.
- **Status:** Completed.
- **Validation outcome:** Passed. Vehicle forms now include an optional
  accessible "Registration state" selector with `Not recorded` plus the eight
  approved codes. Form schema, create/edit workflow, detail/list display, and
  duplicate-warning tests passed. Same registration in a different state is not
  warned; same normalized state is warned. No PlateAPI lookup UI or provider
  call was introduced.

### VEH-17 - Update private-state cleanup, fixtures, and cross-feature docs for registration state

- **Dependencies:** VEH-14, VEH-15, and VEH-16.
- **Expected area:** Query/cache tests, app composition tests, feature fixtures,
  and documentation touched by the registration-state addition.
- **Acceptance criteria:** Ensure cached Vehicle list/detail/query data that may
  contain registration state is still cleared on sign-out and identity changes.
  Update test builders and fixtures so registration-state coverage is deliberate
  instead of incidental. Check `docs/features/plateapi-vehicle-prefill.md`,
  `docs/features/service-records.md`, and architecture/product references for
  consistency where Vehicle snapshot or lookup behavior names registration
  state. Do not broaden into PlateAPI implementation or Service Record
  persistence.
- **Validation:** Query/cache cleanup tests where affected, fixture review,
  documentation consistency search, `npm test`, typecheck, lint, build, privacy
  scans, and diff check.
- **Status:** Completed.
- **Validation outcome:** Passed. Fixtures now deliberately include both
  state-bearing and state-omitted Vehicles. Query cleanup coverage confirms
  state-bearing list/detail/duplicate cache data is removed by Vehicle private
  cache cleanup. Documentation review updated Vehicle compact-label examples and
  Service Record snapshot field wording without adding Service Record
  persistence.

### VEH-18 - Run VEH-PLAN-003 final verification and record residuals

- **Dependencies:** VEH-14, VEH-15, VEH-16, and VEH-17.
- **Expected area:** Verification evidence and this task-breakdown document only,
  except for narrowly scoped fixes required by failed approved gates.
- **Acceptance criteria:** Verify the complete Vehicle registration-state change
  across domain, application, Supabase persistence, create/edit/list/detail UI,
  duplicate warnings, cache cleanup, and documentation. Confirm that
  registration state is optional, constrained to the approved Australian codes,
  persisted, displayed with registration, and included in duplicate-looking
  comparison. Record commands, exact results, unavailable environment gates, and
  residual risks. Do not claim PlateAPI lookup implementation or deferred
  Service Record history enforcement.
- **Validation:** `npm test`; `npm run typecheck`; `npm run lint`; `npm run
  build`; `npm run test:db` or documented unavailable database gate; privacy,
  provider-boundary, secret, product-language, and deferred-scope scans; current
  diff review; `git diff --check`.
- **Status:** Completed.
- **Validation outcome:** Passed. Final verification completed on 2026-07-21:
  `npm test` passed 616 tests; `npm run typecheck`, `npm run lint`, `npm run
  build`, `git diff --check`, static database tests, `supabase db reset`, and
  `npm run test:db` passed. The live database suite reported 118 pgTAP tests
  passing. Privacy/provider/deferred-scope scans found only expected
  documentation/test guardrail mentions and existing Supabase service-role grant
  tests; no PlateAPI implementation, service-role SPA exposure, duplicate
  uniqueness, Service Record placeholder schema, private-data logging, or
  invoice/payment/tax language was added. Residuals: jsdom still prints the
  existing "Not implemented: navigation to another Document" notice during
  workflow tests, and Vite build still emits the existing main-chunk size
  advisory.

## 8. Deferred Service Record Integration

The following work is deliberately outside VEH-PLAN-002 and VEH-PLAN-003 and
remains required when Service Record persistence is implemented:

- Add the non-cascading composite foreign key from
  `service_records(vehicle_id, owner_id)` to `vehicles(id, owner_id)`.
- Atomically reject Vehicle deletion when related Service Records exist and map
  that outcome to an app-owned history-conflict error.
- Atomically reject odometer-unit changes when related Service Records exist.
- Expose deletion eligibility and unit-lock state to Vehicle application/UI code
  without provider leakage or UI-only prechecks.
- Offer archive after a history-blocked delete and explain/disable a locked unit
  change.
- Extend live database, repository contract, application, and UI tests for both
  history-dependent behaviors and historical archived-Vehicle reads.

No Vehicle task may mark these items complete, create placeholder Service Record
persistence, or present their absence as successful enforcement.

## 9. Approval Record

Implementation is authorized only when this section records explicit user
approval of the current plan revision and exact task IDs.

| Approved plan revision | Approved task IDs | Approved by | Approval date | Record status |
| --- | --- | --- | --- | --- |
| VEH-PLAN-002 | VEH-01 through VEH-13 | User | 2026-07-20 | Approved: `I approve Vehicle plan revision VEH-PLAN-002 and tasks VEH-01 through VEH-13.` |
| VEH-PLAN-003 | VEH-14 through VEH-18 | None | Pending | Not approved |

## 10. Progress Summary

- **Completed:** 13 of 13 original tasks, VEH-01 through VEH-13, plus approved
  finding-derived fixes VEH-FIX-REV1-001, VEH-FIX-REV2-001, and
  VEH-FIX-REV3-001 through VEH-FIX-REV3-004, VEH-FIX-REV4-001, and
  VEH-FIX-REV4-002. VEH-06 and VEH-13 retain
  the named live database validation residual; VEH-10 through VEH-13 retain the
  named desktop/mobile runtime inspection residual. The post-review HTTP
  route/server smoke passed; VEH-13 still records the unavailable current audit.
- **In progress:** None.
- **Blocked:** VEH-PLAN-003 implementation is pending explicit user approval of
  VEH-14 through VEH-18.
- **Next unblocked task:** VEH-14 after VEH-PLAN-003 approval.
- **Latest full validation:** 43 test files and 592 tests, strict typecheck,
  zero-warning lint, production build, static database checks,
  privacy/provider/deferred-scope scans, current diff review, and `git diff
  --check` passed. The outside-sandbox Vite server and HTTP route smoke also
  passed at `http://127.0.0.1:5173/` with `HTTP/1.1 200 OK`.
- **Latest review status:** Round 5 reported no actionable findings for
  VEH-PLAN-002. VEH-PLAN-003 has not been implemented or reviewed.
- **Residuals:** Live execution of the 75-assertion Vehicle pgTAP suite,
  desktop/mobile screenshots, the current registry audit, and the 627.48 kB
  production bundle advisory remain. Service Record-dependent deletion blocking
  and odometer-unit locking remain deferred under Section 8.

## 11. Review Findings

The feature reviewer must add every finding here with a stable finding ID.
Actionable findings must link to the smallest finding-derived fix task, preserving
the finding ID in the fix task ID. Rejected findings require a concrete reason;
questions that require product direction remain awaiting user decision.

| Finding ID | Severity | Evidence | Disposition | Linked fix task | Verification outcome |
| --- | --- | --- | --- | --- | --- |
| VEH-REV1-001 | Medium | Inconsistent odometer numeric range across the form, domain, database, and row mapper permits a committed insert to be returned as a temporary failure and retried as a duplicate; empty validation issues can be silently consumed. | Fixed and verified in review round 5 | VEH-FIX-REV1-001 | Passed: all boundaries use `0..Number.MAX_SAFE_INTEGER`; create/update responses map the accepted maximum; unsafe digit strings are rejected before numeric conversion; empty validation issues render a form alert. Live pgTAP remains unavailable. |
| VEH-REV2-001 | Medium | In-flight Vehicle mutations can execute cache writes or invalidation and UI navigation after private-state cleanup, sign-out, or identity replacement, repopulating old private data or surfacing old-session feedback. | Fixed and verified in review round 5 | VEH-FIX-REV2-001 | Passed: all five mutations suppress stale side effects, share cleanup-covered MutationCache keys, remove pending/settled private entries across late settlement, and preserve new-session success. |
| VEH-REV3-001 | Medium | TanStack Query's Vehicle MutationCache retains private mutation variables and results after cleanup, including mutations that settle after cleanup. | Fixed and verified in review round 5 | VEH-FIX-REV3-001 | Passed: sign-out and identity-replacement cleanup removes pending and settled variables/results immediately and after late success/failure across all five hooks; fresh-session success remains functional. |
| VEH-REV3-002 | Medium | Form and domain text limits use UTF-16 `String.length`, while PostgreSQL `char_length` and row mapping can count non-BMP text differently, allowing committed writes to be reported as failures. | Fixed and verified in review round 5 | VEH-FIX-REV3-002 | Passed: one code-point counter aligns domain, form, accessible counts, and mapper validation with PostgreSQL `char_length`, including non-BMP boundaries through create/update/lifecycle mapping. |
| VEH-REV3-003 | Medium | Mapped non-admin and unmapped UPDATE pgTAP cases accept a null SQLSTATE without a privileged post-write assertion that the protected Vehicle row remained unchanged. | Fixed and verified in review round 5 | VEH-FIX-REV3-003 | Passed by source/static verification: both denied updates have privileged unchanged-row assertions and the suite plan is 75 assertions. Live pgTAP remains unavailable. |
| VEH-REV3-004 | Low | Generic HTTP 404 maps to `not_found`, hiding missing-table or missing-RPC deployment failures as absent Vehicle records. | Fixed and verified in review round 5 | VEH-FIX-REV3-004 | Passed: only explicit record absence maps to `not_found`; generic 404 and missing deployment resources map to safe `temporary_failure` with provider/private detail redaction. |
| VEH-REV4-001 | Medium | `createVehicle` and `updateVehicle` authorize once, then await duplicate lookup and may persist using a replacement Supabase session after sign-out or identity replacement. | Fixed and verified in review round 5 | VEH-FIX-REV4-001 | Passed: create/update capture the initiating Garage Admin ID and revalidate the same admin immediately before persistence; deferred sign-out, role-loss, and identity-replacement regressions prevent writes, while unchanged identity preserves duplicate-lookup semantics. |
| VEH-REV4-002 | Medium | Duplicate-warning feedback includes the private registration in router history state, which is outside Vehicle private-state cleanup and can survive sign-out or identity replacement. | Fixed and verified in review round 5 | VEH-FIX-REV4-002 | Passed: current-session create/update warnings use cleanup-covered Vehicle private state with accessible detail feedback and no route state; destination consumption, sign-out, identity replacement, and stale completion cannot retain or restore the private label. |

Review round 5 reported no actionable findings. Every finding from VEH-REV1-001
through VEH-REV4-002 is fixed and verified with its linked fix task complete.
Residuals remain live execution of the 75-assertion Vehicle pgTAP suite,
desktop/mobile screenshots, the current registry audit, and the 627.48 kB
production bundle advisory. HTTP route/server smoke is resolved by the
outside-sandbox Vite server and `HTTP/1.1 200 OK` response. Service
Record-dependent deletion blocking and odometer-unit locking remain deferred
under Section 8 and are not findings against VEH-PLAN-002.

### Finding-Derived Fix Tasks

| Fix task ID | Linked finding | Depends on | Status | Required validation | Validation outcome |
| --- | --- | --- | --- | --- | --- |
| VEH-FIX-REV1-001 | VEH-REV1-001 | VEH-01, VEH-05, VEH-07, VEH-11, VEH-13 | Complete | Targeted form/domain/database/mapper tests; create/update and boundary-mapping regressions; migration validation; full test, typecheck, lint, build, and diff check | Passed locally: 7 focused files/130 tests; 43 full files/498 tests; typecheck, lint, build, static migration checks, scans, and diff check. Live 70-assertion pgTAP unavailable due to the previously recorded Docker denial. |
| VEH-FIX-REV2-001 | VEH-REV2-001 | VEH-09, VEH-11, VEH-12, VEH-FIX-REV1-001 | Complete | Focused mutation/session-cleanup regressions; full test, typecheck, lint, build, privacy/deferred-scope scans, and diff check | Passed locally: 3 focused files/53 tests; 43 full files/519 tests; typecheck, lint, build, privacy/provider/deferred-scope scans, source review, and diff check passed. |
| VEH-FIX-REV3-001 | VEH-REV3-001 | VEH-09, VEH-FIX-REV2-001 | Complete | Focused MutationCache cleanup/late-settle tests across all five hooks; full test, typecheck, lint, build, privacy/deferred-scope scans, and diff check | Passed locally: 3 focused files/64 tests; 43 full files/530 tests; typecheck, lint, build, privacy/provider/deferred-scope scans, source review, and diff check passed. |
| VEH-FIX-REV3-002 | VEH-REV3-002 | VEH-01, VEH-05, VEH-07, VEH-11, VEH-FIX-REV1-001, VEH-FIX-REV3-001 | Complete | Focused non-BMP form/domain/mapper/database boundary tests; migration validation; full test, typecheck, lint, build, privacy/deferred-scope scans, and diff check | Passed locally: 7 focused files/165 tests; 43 full files/554 tests; typecheck, lint, build, static migration checks, privacy/provider/deferred-scope scans, source review, and diff check passed. Live 73-assertion pgTAP was unavailable because the sandboxed CLI could not write its telemetry file and the escalated retry was interrupted. |
| VEH-FIX-REV3-003 | VEH-REV3-003 | VEH-05, VEH-06, VEH-FIX-REV3-002 | Complete | Focused pgTAP/static-verifier authorization invariants; updated assertion plan/count; database validation; full repository gates and diff check | Passed locally: 9 static-verifier tests and all 43 files/555 tests passed; the pgTAP plan is exactly 75 assertions; typecheck, lint, build, security/privacy scans, source review, and diff check passed. Live pgTAP remains unavailable due to the previously recorded Supabase telemetry/Docker restrictions. |
| VEH-FIX-REV3-004 | VEH-REV3-004 | VEH-02, VEH-07, VEH-08, VEH-FIX-REV3-003 | Complete | Focused safe error-mapping and adapter/contract regressions; full test, typecheck, lint, build, privacy/provider scans, and diff check | Passed locally: 3 focused files/75 tests and all 43 files/579 tests passed; typecheck, zero-warning lint, build, privacy/provider/deferred-scope scans, source review, and diff check passed. |
| VEH-FIX-REV4-001 | VEH-REV4-001 | VEH-03, VEH-FIX-REV2-001, VEH-FIX-REV3-001 | Complete | Focused create/update authorization-race regressions; full test, typecheck, lint, build, privacy/provider/deferred-scope scans, and diff check | Passed locally: 34 focused tests and all 43 files/589 tests passed; strict typecheck, zero-warning lint, production build, privacy/provider/deferred-scope scans, source review, and diff check passed. |
| VEH-FIX-REV4-002 | VEH-REV4-002 | VEH-09, VEH-11, VEH-FIX-REV4-001 | Complete | Focused duplicate-feedback cleanup and route-state privacy regressions; full test, typecheck, lint, build, privacy/provider/deferred-scope scans, and diff check | Passed locally: 3 focused files/68 tests and all 43 files/592 tests passed; strict typecheck, zero-warning lint, production build, privacy/provider/deferred-scope scans, source review, and diff check passed. |

#### VEH-FIX-REV1-001 - Align odometer range and visible validation feedback

- **Finding:** VEH-REV1-001.
- **Dependencies:** VEH-01, VEH-05, VEH-07, VEH-11, and VEH-13 are complete.
- **Approval basis:** Fix approved within the existing VEH-PLAN-002 scope. It
  corrects the approved odometer validation and safe error behavior without
  changing product scope, dependencies, or original task acceptance criteria.
- **Expected area:** Vehicle form/schema, domain validation, Vehicle database
  constraint/migration coverage, Supabase Vehicle row mapper, and focused tests.
- **Acceptance criteria:** Select one safely representable non-negative whole
  odometer range and enforce the same inclusive bounds at form, domain, database,
  and row-mapping boundaries. A successful create or update must map its returned
  Vehicle instead of being converted to a temporary failure by a narrower layer,
  preventing duplicate retry risk. Every domain or server validation rejection
  must produce visible field-level or form-level feedback; an empty validation
  issue collection must not be silently consumed. Add create, update, accepted
  boundary, rejected boundary, mapper, and empty-issue regression tests. Keep the
  fix limited to VEH-REV1-001 and do not alter deferred Service Record behavior.
- **Validation:** Run focused form/domain/repository/mapper tests and static
  migration tests; validate the Vehicle migration and applicable database suite
  against a reset local database when available; run `npm test`, `npm run
  typecheck`, `npm run lint`, `npm run build`, relevant privacy/provider/deferred
  scope scans, and `git diff --check`. Record unavailable live validation rather
  than treating static checks as execution.
- **Status:** Complete - verified in review round 5.
- **Validation outcome:** The form, domain, database constraint, and row mapper
  enforce inclusive odometer bounds from 0 through `Number.MAX_SAFE_INTEGER`.
  Form digit strings are range-checked before `Number` conversion; create and
  update responses map the maximum; over-limit and unsafe digit inputs are
  rejected; provider validation without field issues produces an accessible
  form alert. Seven focused files/130 tests and the full 43 files/498 tests
  passed with typecheck, lint, build, scans, and diff check. Live pgTAP remains
  unavailable under the previously recorded Docker gate and is not claimed.

#### VEH-FIX-REV2-001 - Guard mutation completion by authentication ownership

- **Finding:** VEH-REV2-001.
- **Dependencies:** VEH-09, VEH-11, VEH-12, and VEH-FIX-REV1-001 are complete.
- **Approval basis:** Fix approved within the existing VEH-PLAN-002 scope. It
  corrects private cache isolation and authenticated Vehicle workflow behavior
  without changing product scope, dependencies, or original task acceptance
  criteria.
- **Expected area:** Existing Vehicle query/mutation state, authentication
  private-state cleanup integration, create/edit/lifecycle completion handlers,
  and focused tests. Do not introduce a generic session framework, cross-feature
  abstraction, or unrelated boilerplate.
- **Acceptance criteria:** Introduce a feature-scoped authentication owner or
  session-generation guard around mutation-completion cache and UI side effects.
  Private-state cleanup invalidates the active generation before clearing cached
  data. Completion of a stale create, update, archive, restore, or delete after
  sign-out or identity replacement cannot write or invalidate Vehicle cache,
  navigate, or surface success/error/duplicate feedback from the former session.
  A newly authenticated session and its mutations remain functional. Add
  deterministic regressions for sign-out and direct identity replacement across
  the affected mutation paths. Preserve current error mapping, query ownership,
  and deferred Service Record boundaries.
- **Validation:** Run focused Vehicle query/mutation, create/edit, lifecycle,
  sign-out cleanup, and identity-replacement tests; run `npm test`, `npm run
  typecheck`, `npm run lint`, `npm run build`, privacy/provider/deferred-scope
  scans, current diff review, and `git diff --check`.
- **Status:** Complete - verified in review round 5.
- **Validation outcome:** VehicleProvider now invalidates a feature-owned session
  generation before cache cleanup. Every mutation captures that generation via
  TanStack `onMutate`; stale create, update, archive, restore, and delete
  completions skip cache writes and invalidation. Form and lifecycle callers
  independently suppress stale navigation, duplicate state, errors, and dialog
  completion feedback. Sign-out and identity-replacement matrices cover every
  mutation and prove newly authenticated user-B operations still work. Three
  focused files/53 tests and all 43 files/519 tests passed with typecheck, lint,
  build, scans, source review, and diff check.

#### VEH-FIX-REV3-001 - Remove private Vehicle mutations during cleanup

- **Finding:** VEH-REV3-001; completes privacy verification linked from
  VEH-REV2-001.
- **Dependencies:** VEH-09 and VEH-FIX-REV2-001 are complete.
- **Approval basis:** Fix approved within existing VEH-PLAN-002 scope.
- **Expected area:** Existing Vehicle mutation hooks, feature cleanup, and focused
  query/provider tests. Do not add a generic mutation framework or unrelated
  abstraction.
- **Acceptance criteria:** Define one shared feature mutation-key root and apply
  it to create, update, archive, restore, and delete hooks. Cleanup invalidates
  the feature session generation first, then removes every matching pending or
  settled MutationCache entry along with the existing private query cleanup.
  Cache remains empty immediately after cleanup and after stale operations settle;
  no former-session variables or results return. A new session can execute all
  supported mutations normally. Cover sign-out and identity replacement across
  all five hooks, including late success and failure settlement.
- **Validation:** Focused MutationCache, Vehicle query/provider cleanup, sign-out,
  identity-replacement, and new-session tests; full test, typecheck, lint, build,
  privacy/provider/deferred-scope scans, current diff review, and diff check.
- **Status:** Complete - verified in review round 5.
- **Validation outcome:** A shared feature-owned Vehicle mutation-key root now
  identifies create, update, archive, restore, and delete entries. Cleanup still
  advances the session generation first, then removes all matching pending or
  settled MutationCache entries before cancelling and removing Vehicle queries.
  Sign-out and identity-replacement matrices prove that private variables and
  results disappear immediately, remain absent after late success or failure,
  and that fresh-session mutations remain functional. Unrelated mutations and
  queries remain intact. Three focused files/64 tests and all 43 files/530 tests
  passed with typecheck, lint, build, privacy/provider/deferred-scope scans,
  source review, and diff check.

#### VEH-FIX-REV3-002 - Align Unicode character counting

- **Finding:** VEH-REV3-002.
- **Dependencies:** VEH-01, VEH-05, VEH-07, VEH-11, VEH-FIX-REV1-001, and
  VEH-FIX-REV3-001 are complete.
- **Approval basis:** Fix approved within existing VEH-PLAN-002 scope.
- **Expected area:** Existing Vehicle form/schema, domain text validation,
  Supabase row mapper, migration constraint coverage, and focused tests. Do not
  change the user-visible 50- and 500-character limits.
- **Acceptance criteria:** Use one explicit PostgreSQL `char_length`-compatible
  Unicode character-count definition across form, domain, row mapper, and
  database enforcement. Non-BMP values at the approved 50- and 500-character
  boundaries are accepted consistently; values one character over are rejected
  before persistence and by the database; committed accepted rows always map
  successfully. Add create/update and optional/required-field non-BMP boundary
  regressions without changing normalization or product limits.
- **Validation:** Focused form/domain/mapper/repository tests, static migration
  tests, and applicable live migration/database validation when available; full
  test, typecheck, lint, build, privacy/provider/deferred-scope scans, current
  diff review, and diff check.
- **Status:** Complete - verified in review round 5.
- **Validation outcome:** One exported `Array.from` code-point counter now enforces
  the unchanged 50- and 500-character limits in domain and form validation, and
  the row mapper inherits that exact validation. Native UTF-16 `maxLength`
  enforcement was replaced by accessible live code-point counts. Create,
  update, archive, and restore responses map exact-bound non-BMP data, while
  over-bound create and update inputs fail before a provider write. Seven
  focused files/165 tests and all 43 files/554 tests passed with static
  73-assertion database-suite validation, typecheck, lint, production build,
  scans, source review, and diff check. Live pgTAP remains unavailable: the
  sandboxed Supabase CLI could not write its telemetry file and the escalated
  retry was interrupted without a result.

#### VEH-FIX-REV3-003 - Prove denied updates leave Vehicle rows unchanged

- **Finding:** VEH-REV3-003.
- **Dependencies:** VEH-05, VEH-06, and VEH-FIX-REV3-002 are complete.
- **Approval basis:** Fix approved within existing VEH-PLAN-002 scope.
- **Expected area:** Vehicle pgTAP suite and its static verifier only. Do not
  change production authorization behavior or add unrelated database fixtures.
- **Acceptance criteria:** After mapped non-admin and authenticated unmapped
  UPDATE attempts, switch to the privileged test context and assert the target
  Vehicle row's protected values are unchanged, independent of whether the
  denied command returns a null SQLSTATE. Update the pgTAP assertion plan/count
  and static verifier so both post-write invariants are mandatory and the suite
  remains transactional and synthetic.
- **Validation:** Focused static-verifier tests; source review of role switching,
  assertion count, and unchanged-row checks; reset database and run the full
  pgTAP suite when available; full test, typecheck, lint, build, security/privacy
  scans, and diff check. Record unavailable live execution explicitly.
- **Status:** Complete - verified in review round 5.
- **Validation outcome:** Both denied zero-row UPDATE cases now reset from the
  authenticated caller to the privileged test context, read the synthetic
  fixture, assert its model remains `Active Model`, and restore the caller role
  before continuing the role matrix. The plan is exactly 75 assertions and the
  static verifier requires each caller-specific transition and readback. Nine
  focused verifier tests and all 43 files/555 tests passed with typecheck,
  zero-warning lint, production build, security/privacy scans, source review,
  and diff check. Live pgTAP remains unavailable due to the previously recorded
  Supabase telemetry/Docker restrictions and is not reported as passed.

#### VEH-FIX-REV3-004 - Preserve deployment failures in safe error mapping

- **Finding:** VEH-REV3-004.
- **Dependencies:** VEH-02, VEH-07, VEH-08, and VEH-FIX-REV3-003 are complete.
- **Approval basis:** Fix approved within existing VEH-PLAN-002 scope.
- **Expected area:** Existing Supabase Vehicle error mapper and focused
  adapter/contract tests. Do not introduce a generic provider-error framework.
- **Acceptance criteria:** Keep code-specific record absence, including a null
  selected row and `P0002`, mapped to app-owned `not_found`. Map generic HTTP 404
  and missing RPC/table or schema-cache conditions, including `PGRST202` and
  `PGRST205`, to app-owned `temporary_failure`. Preserve fixed safe messages and
  ensure provider codes, relation/function names, payloads, and private data do
  not cross the infrastructure boundary. Add safe mapping and operation-level
  regressions for every changed case.
- **Validation:** Focused error-mapper, repository adapter, and shared-contract
  tests; full test, typecheck, lint, build, privacy/provider/deferred-scope scans,
  current diff review, and diff check.
- **Status:** Complete - verified in review round 5.
- **Validation outcome:** `not_found` is limited to the current explicit `P0002`
  record-absence path and successful null single-row responses. Generic HTTP 404,
  ambiguous `PGRST116`, missing-RPC `PGRST202`, and missing-table `PGRST205`
  failures map to fixed app-owned `temporary_failure` errors. Direct mapper
  regressions and shared contract/harness matrices cover generic 404 and missing
  resources across all nine repository operations, including private sentinel
  redaction; the existing missing-row matrix remains green for get, update,
  archive, restore, and delete. Three focused files/75 tests and all 43 files/579
  tests passed with strict typecheck, zero-warning lint, production build,
  privacy/provider/deferred-scope scans, source review, and `git diff --check`.

#### VEH-FIX-REV4-001 - Revalidate the initiating user before persistence

- **Finding:** VEH-REV4-001.
- **Dependencies:** VEH-03, VEH-FIX-REV2-001, and VEH-FIX-REV3-001 are complete.
- **Approval basis:** Fix approved within existing VEH-PLAN-002 scope.
- **Expected area:** Existing authenticated Vehicle create/update use cases and
  focused application tests. Keep the other six Vehicle use cases simple and do
  not introduce a generic authorization/session framework.
- **Acceptance criteria:** Bind the initiating authenticated Garage Admin's
  `AppUserId` before the duplicate lookup. Immediately before calling repository
  create or update, read the current app user again and require the same ID and
  Garage Admin role. If the current identity is null, unauthorized, or different,
  return the app-owned unauthorized outcome and never call persistence. Add
  deferred duplicate-lookup regressions for sign-out and direct identity
  replacement in both create and update, plus unchanged current-session success.
- **Validation:** Focused Vehicle use-case authorization and deferred-lookup
  tests; full test, typecheck, lint, build, privacy/provider/deferred-scope scans,
  current diff review, and diff check.
- **Status:** Complete - verified in review round 5.
- **Validation outcome:** The initiating Garage Admin's app-owned ID is captured
  before the duplicate lookup and compared with a fresh Garage Admin read
  immediately before create/update persistence. Deferred sign-out, same-ID role
  loss, and replacement-admin cases never persist; unchanged identity persists
  after both successful and unavailable duplicate lookups. All 34 focused tests
  and all 43 files/589 tests passed with strict typecheck, zero-warning lint,
  production build, bounded scans, source review, and diff check. The existing
  greater-than-500 kB build advisory remains.

#### VEH-FIX-REV4-002 - Keep duplicate feedback inside Vehicle private state

- **Finding:** VEH-REV4-002.
- **Dependencies:** VEH-09, VEH-11, and VEH-FIX-REV4-001 are complete.
- **Approval basis:** Fix approved within existing VEH-PLAN-002 scope.
- **Expected area:** Existing Vehicle-owned provider/query state, private cleanup,
  create/edit navigation, duplicate feedback rendering, and focused route tests.
  Do not add a generic state framework or unrelated store.
- **Acceptance criteria:** Move duplicate-warning feedback, including its private
  registration-bearing label, out of router history state and into Vehicle-owned
  private state covered by the existing feature cleanup/query root, or an
  equivalently cleanup-covered Vehicle store. Navigate without private route
  state. Sign-out and identity replacement clear the warning before the next
  session can render it and leave no private duplicate payload in history state;
  stale completion cannot restore it. Current-session create/update duplicate
  feedback remains functional and accessible. Add sign-out, identity-replacement,
  history-state absence, stale completion, and current-session regressions.
- **Validation:** Focused Vehicle provider/query cleanup, create/edit workflow,
  route/history-state, and duplicate-feedback tests; full test, typecheck, lint,
  build, privacy/provider/deferred-scope scans, current diff review, and diff
  check.
- **Status:** Complete - verified in review round 5.
- **Validation outcome:** Passed locally. Duplicate feedback now uses a
  generation-scoped query entry under the Vehicle private root and is consumed by
  the saved Vehicle detail screen. Current create/update feedback remains
  accessible with no router state; sign-out, identity replacement, and stale
  completion cannot retain or restore the private label. Three focused files and
  68 tests plus all 43 files and 592 tests passed; typecheck, lint, build, scans,
  source review, and diff check passed.

## 12. Validation Outcome Log

Append a row after every worker or final verification run. A failed or unavailable
check remains visible and must not be overwritten by a later pass.

| Date | Task or review | Command/check | Outcome | Evidence or residual gate |
| --- | --- | --- | --- | --- |
| 2026-07-20 | Planning | Repository/document inspection | Passed | Vehicle, design, architecture, product, authentication, Service Record, current source, migrations, tests, package, runtime, and git baseline inspected |
| 2026-07-20 | Planning | Decision revision | Passed | VEH-DEC-01 through VEH-DEC-06 recorded in the source specification and VEH-PLAN-002; deferred Service Record integration is excluded from current acceptance claims |
| 2026-07-20 | Approval | Exact user approval | Passed | `I approve Vehicle plan revision VEH-PLAN-002 and tasks VEH-01 through VEH-13.` |
| 2026-07-20 | Planning | Production implementation validation | Not run | Approved implementation has not started; VEH-01 is next |
| 2026-07-20 | VEH-01 TDD red | `npm test -- --run src/domain/vehicles/vehicle.test.ts` | Failed as expected | New domain suite could not resolve the not-yet-created `vehicle` module |
| 2026-07-20 | VEH-01 intermediate | Targeted tests, typecheck, and lint | Failed | 43 tests passed; strict optional fixture assignments and then six lint findings required correction |
| 2026-07-20 | VEH-01 targeted | Targeted tests, typecheck, and lint | Passed | 43 Vehicle domain tests passed; strict typecheck and zero-warning lint passed |
| 2026-07-20 | VEH-01 full gates | `npm test`; typecheck; lint; build; `git diff --check` | Passed | 25 test files and 302 tests passed; strict typecheck, zero-warning lint, Vite production build, and diff check passed |
| 2026-07-20 | VEH-02 TDD red | `npm test -- --run src/application/vehicles/vehicleResult.test.ts src/application/ports/vehicleRepository.test.ts` | Failed as expected | The new error suite could not resolve the not-yet-created `vehicleResult` module; the type-only port import was erased at runtime |
| 2026-07-20 | VEH-02 intermediate | Targeted tests, typecheck, and lint | Failed | Nine targeted tests passed; three compile-time assertions required runtime use to satisfy strict no-unused checks |
| 2026-07-20 | VEH-02 targeted | Targeted tests, typecheck, and lint | Passed | 10 application error and repository contract tests passed; strict typecheck and zero-warning lint passed |
| 2026-07-20 | VEH-02 boundaries | Provider and deferred-contract scans | Passed | No provider/React/query imports or details, authorization/filter inputs, history-conflict contract, odometer-unit-lock contract, or Service Record contract found in VEH-02 production files |
| 2026-07-20 | VEH-02 full gates | `npm test`; typecheck; lint; build; `git diff --check` | Passed | 27 test files and 312 tests passed; strict typecheck, zero-warning lint, Vite production build, and diff check passed |
| 2026-07-20 | VEH-03 TDD red | `npm test -- --run src/application/use-cases/vehicles/vehicleUseCases.test.ts` | Failed as expected | New use-case suite could not resolve the not-yet-created `vehicleUseCases` module |
| 2026-07-20 | VEH-03 intermediate | Targeted tests, typecheck, and lint | Failed | 24 use-case tests passed after correcting the create duplicate-lookup call shape; one unused import and test mock typing/indentation findings required correction |
| 2026-07-20 | VEH-03 targeted | Targeted tests, typecheck, and lint | Passed | 24 authenticated Vehicle use-case tests passed; strict typecheck and zero-warning lint passed |
| 2026-07-20 | VEH-03 boundaries | Provider/UI, protected-input, deferred-history, and repository-call scans | Passed | No provider, infrastructure, React, query-library, protected/system-input, Service Record, history, or unit-lock references found; production use cases call only the Vehicle repository port after app-owned Garage Admin authorization |
| 2026-07-20 | VEH-03 full gates | `npm test`; typecheck; lint; build; `git diff --check` | Passed | 28 test files and 336 tests passed; strict typecheck, zero-warning lint, Vite production build, and diff check passed |
| 2026-07-20 | VEH-04 dependencies | Install and lockfile/version review | Passed | Added only `@tanstack/react-query` 5.101.3, `react-hook-form` 7.82.0, and `zod` 4.4.3 as direct runtime dependencies; npm audit reported zero vulnerabilities and only TanStack Query's required query core was newly transitive |
| 2026-07-20 | VEH-04 targeted | Provider/composition tests | Passed | 2 test files and 8 tests passed for fresh test clients, the production singleton, privacy-safe defaults, one app-level provider, composition-root mounting, and explicit test injection |
| 2026-07-20 | VEH-04 full gates | `npm test`; typecheck; lint; build; dependency/boundary scans; `git diff --check` | Passed | 30 test files and 344 tests passed; strict typecheck, zero-warning lint, Vite production build, approved dependency/provider scans, and diff check passed |
| 2026-07-20 | VEH-05 TDD red | Targeted static migration test | Failed as expected | The new static suite could not read the not-yet-created Vehicle migration |
| 2026-07-20 | VEH-05 static intermediate | Targeted static migration test | Failed | Nine tests passed; two constraint assertions were formatting-sensitive and required whitespace normalization |
| 2026-07-20 | VEH-05 targeted | Static migration test | Passed | 11 tests verified the schema, constraints, indexes, RLS, grants, lifecycle functions, fixed search paths, and deferred-boundary exclusions |
| 2026-07-20 | VEH-05 live migration | Clean local reset and database lint | Passed | Supabase CLI 2.109.1 applied all six migrations from a clean database; public and extensions schema lint returned no errors |
| 2026-07-20 | VEH-05 direct probe attempt | Multi-statement `supabase db query --file` | Unavailable | CLI rejected multiple commands in one prepared statement; this invocation did not execute the probes and is not reported as a live pass |
| 2026-07-20 | VEH-05 live probes | Single-statement transactional direct probes | Passed | Synthetic probes verified valid defaults, representative blank/range/length/odometer/unit rejections, protected column grants, anonymous denial, and authenticated lifecycle-function grants; fixtures were removed in the same statement |
| 2026-07-20 | VEH-05 database regression | `npm run test:db` | Passed | Existing transactional authentication database suite passed 38 tests against the migrated local database |
| 2026-07-20 | VEH-05 intermediate gates | Full tests, typecheck, lint, build, and diff check | Failed | 355 tests, typecheck, build, and diff check passed; lint found two double-quoted SQL expectation literals in the new static test |
| 2026-07-20 | VEH-05 full gates | `npm test`; targeted retest; typecheck; lint; build; `git diff --check` | Passed | 31 test files and 355 tests passed; the 11-test targeted suite was rerun after the lint-only correction; strict typecheck, zero-warning lint, Vite production build, and diff check passed |
| 2026-07-20 | VEH-06 targeted static | `npm test -- supabase/tests/vehicleDatabaseSuiteStatic.test.mjs` | Passed | 8 source-verifier tests confirmed transactional synthetic fixtures, the complete four-caller operation matrix, protected fields, every constraint and accepted boundary, lifecycle/direct-access coverage, duplicate storage, current delete/unit behavior, and no deferred persistence claims |
| 2026-07-20 | VEH-06 live database | Reset local database and `npm run test:db` | Unavailable | The sandbox denied access to the Docker socket; two required escalated retries did not return a result before interruption. The 68-assertion pgTAP suite was not executed and is not reported as a live pass |
| 2026-07-20 | VEH-06 intermediate gates | Full tests, typecheck, lint, build, and diff check | Failed | 363 tests, typecheck, and build passed; lint found four double-quoted static-verifier literals and required a style-only correction |
| 2026-07-20 | VEH-06 full non-database gates | `npm test`; targeted static verifier; typecheck; lint; build; `git diff --check` | Passed | 32 test files and 363 tests passed; the 8-test static verifier was rerun after the lint-only correction; strict typecheck, zero-warning lint, Vite production build, and diff check passed. Live database execution remains the named residual above |
| 2026-07-20 | VEH-07 intermediate production | Typecheck and lint | Failed | Initial repository modules had one multiline assertion parse error and three unnecessary row-mapper assertions; the scoped typing/style findings were corrected before tests were finalized |
| 2026-07-20 | VEH-07 intermediate targeted | Focused adapter tests, typecheck, and lint | Failed | 32 of 33 tests and typecheck passed; one active-row absence assertion and seven test-only lint findings required correction |
| 2026-07-20 | VEH-07 targeted | `npm test -- src/infrastructure/supabase/repositories`; typecheck; lint | Passed | 3 focused test files and 33 tests passed for strict row mapping, malformed responses, fixed safe error mapping, every CRUD/lifecycle method through a typed client harness, deterministic lifecycle-separated lists, and all-lifecycle duplicate lookup with current-ID exclusion |
| 2026-07-20 | VEH-07 boundaries | Architecture, ownership, deferred-scope, and privacy scans | Passed | No Supabase/table/RPC access outside infrastructure, owner input path, Service Record expansion, console/logger call, or provider/private detail exposure was found; adapter outputs remain app-owned and provider-neutral |
| 2026-07-20 | VEH-07 full gates | `npm test`; typecheck; lint; build; `git diff --check` | Passed | 35 test files and 396 tests passed; strict typecheck, zero-warning lint, Vite production build, and diff check passed |
| 2026-07-20 | VEH-08 targeted | Shared contract suite and focused adapter regression | Passed | 27 provider-neutral contract tests passed against the stateful Supabase adapter harness; 36 combined contract and focused adapter tests passed |
| 2026-07-20 | VEH-08 boundaries | Provider, deferred-scope, and privacy scans | Passed | The shared contract imports only app-owned types; no Supabase/database detail or deferred Service Record behavior appears in it; all registration, VIN, engine, notes, and failure markers in the infrastructure harness are explicitly synthetic, with no logging or browser storage |
| 2026-07-20 | VEH-08 full gates | `npm test`; typecheck; lint; build; `git diff --check` | Passed | 36 test files and 423 tests passed; strict typecheck, zero-warning lint, Vite production build, and diff check passed |
| 2026-07-20 | VEH-09 TDD red | Targeted composition, query/cache, and cleanup suites | Failed as expected | Three new suites could not resolve the not-yet-created Vehicle composition, provider, and query modules |
| 2026-07-20 | VEH-09 intermediate | Targeted tests, typecheck, and lint | Failed | 16 of 17 focused tests and typecheck passed; the stale-cancellation assertion required an immediate rejection handler, and seven strict lint findings required provider-neutral Error adaptation plus style corrections |
| 2026-07-20 | VEH-09 targeted | Targeted composition, query/cache, mutation, and cleanup suites | Passed | 3 focused test files and 18 tests passed for lazy app-boundary composition, app-owned keys, safe loading/success/errors, duplicate-warning preservation, exact invalidation, sign-out and identity cleanup, and stale-result cancellation |
| 2026-07-20 | VEH-09 boundaries | Architecture, provider-selection, privacy, and deferred-scope scans | Passed | Supabase Vehicle repository construction appears only in the app composition module; feature production modules contain no adapter/config/environment selection, private logging, provider detail, or deferred Service Record behavior |
| 2026-07-20 | VEH-09 full gates | `npm test`; typecheck; lint; build; `git diff --check` | Passed | 39 test files and 441 tests passed; strict typecheck, zero-warning lint, Vite production build, and diff check passed |
| 2026-07-20 | VEH-11 focused intermediate | Form, workflow, list, and route suites | Failed | 39 of 42 tests passed; three test-harness assertions required unambiguous selectors and removal of an incompatible raw CSS-module import; production behavior under the other focused checks passed |
| 2026-07-20 | VEH-11 full intermediate | `npm test` | Failed | 42 of 43 files and 478 of 482 tests passed; four authentication-route fixtures used a path newly owned by the Vehicle detail route and were moved to an unrelated fallback path without changing authentication behavior |
| 2026-07-20 | VEH-11 targeted | Form schema, create/detail/edit workflows, and affected route/component suites | Passed | 32 new focused tests and 63 affected tests passed for exact boundaries, normalization, optional clearing, km default, protected-field exclusion, persistence, duplicate warning, detail/edit loading/error/not-found states, safe server validation/retry, privacy, focus, and responsive semantics |
| 2026-07-20 | VEH-11 boundaries | Architecture, privacy, deferred-scope, and style scans; responsive source review | Passed | No provider/config selection, private logging or browser storage, private route values, Service Record history simulation, lifecycle actions, one-off colors, gradients, broad transitions, or non-token radii were found; responsive wide/narrow grids and touch targets were reviewed in source |
| 2026-07-20 | VEH-11 visual inspection | Desktop/mobile browser screenshots | Unavailable | No browser executable or Playwright harness is installed; runtime screenshot inspection remains an explicit residual and is not reported as passed |
| 2026-07-20 | VEH-11 full gates | `npm test`; typecheck; lint; build; `git diff --check` | Passed | 43 test files and 483 tests passed; strict typecheck, zero-warning lint, Vite production build, and diff check passed |
| 2026-07-20 | VEH-13 final repository gates | `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`; `git diff --check` | Passed | 43 test files and 489 tests passed; strict typecheck, zero-warning lint, production build, and diff check passed |
| 2026-07-20 | VEH-13 build and dependency review | Production bundle inspection; `npm ls --depth=0` | Passed with advisory | Direct dependencies resolved at their locked versions; the build produced a 623.56 kB main JavaScript chunk and retained Vite's greater-than-500 kB advisory |
| 2026-07-20 | VEH-13 live database | Vehicle pgTAP suite against reset local database | Unavailable | Docker access was already denied during VEH-06; under the bounded final instruction no Docker or Supabase command was retried. The 68-assertion suite remains a named live gate and is not reported as passed |
| 2026-07-20 | VEH-13 boundaries | Privacy, security, provider, secret, product-language, and deferred-scope scans; current source/diff review | Passed | No Vehicle runtime logging or browser storage, provider leakage across domain/application/feature boundaries, embedded secret, forbidden financial language, placeholder Service Record persistence, or scope mismatch found. Expected `service_role` matches were SQL privilege revocations and synthetic configuration tests |
| 2026-07-20 | VEH-13 responsive verification | Responsive source and component-coverage review; browser executable discovery | Passed with runtime residual | Existing tests cover list/form/detail/lifecycle states and responsive semantics; source uses explicit narrow/wide layouts and stable touch targets. No browser executable or Playwright harness is installed, so desktop/mobile screenshot inspection is unavailable and not reported as passed |
| 2026-07-20 | VEH-13 HTTP smoke | Vite and static built-artifact server attempts | Unavailable | The sandbox prevented runtime serving through `uv_interface_addresses` and local socket permission errors. Route/component tests and the production build passed, but HTTP route smoke is not reported as passed |
| 2026-07-20 | VEH-13 dependency audit | `npm audit --audit-level=low` | Unavailable | The sandboxed registry request failed with `EAI_AGAIN`; its escalated retry was interrupted without a result. VEH-04's earlier audit reported zero vulnerabilities, but no current audit result is claimed |
| 2026-07-20 | VEH-13 deferred boundary | Section 8 and implementation scan | Passed | Service Record history-dependent deletion blocking and odometer-unit locking remain explicitly deferred; no placeholder schema or current enforcement claim was introduced |
| 2026-07-20 | Review round 1 | Full-feature senior review | Actionable finding | VEH-REV1-001 recorded as Medium and linked to approved within-scope fix VEH-FIX-REV1-001; feature completion awaits the fix and a fresh review. Residuals remain live 68-assertion pgTAP, screenshots and HTTP smoke, current registry audit, bundle advisory, and deferred Service Record integration |
| 2026-07-20 | VEH-FIX-REV1-001 TDD red | Focused form/domain/database/mapper/repository/workflow regressions | Failed as expected | Seven new boundary, mapping, response, migration, and empty-validation expectations failed before production implementation; 123 existing focused tests passed |
| 2026-07-20 | VEH-FIX-REV1-001 targeted | Seven focused test files | Passed | 130 tests passed for inclusive safe-integer boundaries, pre-conversion unsafe-digit rejection, full and summary row mapping, create/update response mapping, migration/database source constraints, and accessible empty-issue fallback |
| 2026-07-20 | VEH-FIX-REV1-001 intermediate | Typecheck, lint, and diff check | Failed | Typecheck and diff check passed; lint identified 13 indentation-only findings in the new parameterized tests, which were corrected before full verification |
| 2026-07-20 | VEH-FIX-REV1-001 full gates | `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`; `git diff --check` | Passed with advisory | 43 test files and 498 tests passed; strict typecheck, zero-warning lint, production build, and diff check passed. The build produced a 623.86 kB main JavaScript chunk and retained Vite's existing greater-than-500 kB advisory |
| 2026-07-20 | VEH-FIX-REV1-001 boundaries | Static migration/database checks; privacy, provider, product-language, and deferred-scope scans; source and diff review | Passed | Form, domain, SQL constraint, and mapper use the same `0..9007199254740991` range; no private logging/storage, provider leakage, forbidden financial language, Service Record expansion, or unrelated scope change was introduced |
| 2026-07-20 | VEH-FIX-REV1-001 live database | Reset local database and 70-assertion Vehicle pgTAP suite | Unavailable | Docker access was already denied and bounded worker instructions prohibited repeating escalation. Static migration and suite-source validation passed; live execution is not reported as passed |
| 2026-07-20 | Review round 2 | Full-feature senior review | Actionable finding | VEH-REV1-001 verified fixed; VEH-REV2-001 recorded as Medium and linked to approved within-scope fix VEH-FIX-REV2-001. Feature completion awaits the fix and a fresh review. Residuals remain live 70-assertion pgTAP, screenshots and HTTP smoke, current registry audit, bundle advisory, and deferred Service Record integration |
| 2026-07-20 | VEH-FIX-REV2-001 intermediate | Focused mutation/session-cleanup tests; typecheck; lint | Failed | 53 focused tests and typecheck passed; lint found a render-time ref read and one test callback inference issue, both corrected before final validation |
| 2026-07-20 | VEH-FIX-REV2-001 targeted | Vehicle query, provider cleanup, and workflow suites | Passed | 3 focused files and 53 tests passed, including sign-out and direct identity-replacement matrices across create, update, archive, restore, and delete; cache/invalidation/navigation/duplicate/error suppression and new-session success are covered |
| 2026-07-20 | VEH-FIX-REV2-001 full gates | `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`; `git diff --check` | Passed with advisory | 43 test files and 519 tests passed; strict typecheck, zero-warning lint, production build, and diff check passed. The build produced a 624.89 kB main JavaScript chunk and retained Vite's existing greater-than-500 kB advisory |
| 2026-07-20 | VEH-FIX-REV2-001 boundaries | Privacy, provider, deferred-scope, source, and current diff review | Passed | No private logging or browser storage, provider selection outside the app composition root, Service Record expansion, deferred history enforcement, generic session framework, or unrelated refactor was introduced |
| 2026-07-20 | Review round 3 | Full-feature senior review | Actionable findings | VEH-REV1-001 remains fixed and verified; VEH-REV2-001 side effects are fixed but mutation-cache privacy verification remains linked to VEH-REV3-001. VEH-REV3-001 through VEH-REV3-004 are linked to approved within-scope fixes in numeric execution order. Residuals remain the live Vehicle pgTAP suite, screenshots and HTTP smoke, current registry audit, bundle advisory, and deferred Service Record integration |
| 2026-07-20 | VEH-FIX-REV3-001 intermediate | Focused MutationCache cleanup suites; typecheck; lint | Failed | The initial 35-test focused run exposed eight stale fixture expectations after fresh-session results were corrected to user B. After correcting them, all 35 tests and typecheck passed; lint then identified two test-only `require-await` findings, which were corrected before final validation. |
| 2026-07-20 | VEH-FIX-REV3-001 targeted | Vehicle query, provider cleanup, and workflow suites | Passed | 3 focused files and 64 tests passed, including shared action keys, settled entry cleanup, pending variables removal, sign-out and identity-replacement matrices for all five hooks, late success/failure non-reappearance, side-effect suppression, unrelated-cache preservation, and fresh-session success. |
| 2026-07-20 | VEH-FIX-REV3-001 full gates | `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`; `git diff --check` | Passed with advisory | 43 test files and 530 tests passed; strict typecheck, zero-warning lint, production build, and diff check passed. The build produced a 625.23 kB main JavaScript chunk and retained Vite's existing greater-than-500 kB advisory. |
| 2026-07-20 | VEH-FIX-REV3-001 boundaries | Privacy, provider, deferred-scope, source, and current diff review | Passed | No private logging or browser storage, provider selection outside infrastructure/composition, Service Record expansion, deferred history enforcement, generic session framework, or unrelated refactor was introduced. Cleanup is scoped to the feature mutation-key root and preserves unrelated query and mutation entries. |
| 2026-07-20 | VEH-FIX-REV3-002 targeted | Domain, form schema/workflow, mapper, repository, migration, and database-suite source tests | Passed | 7 focused files and 165 tests passed for PostgreSQL-compatible non-BMP boundaries, accessible form counts without native UTF-16 truncation, accepted create/update/archive/restore response mapping, pre-write rejection, and 73-assertion database-suite source coverage. |
| 2026-07-20 | VEH-FIX-REV3-002 full gates | `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`; scans; `git diff --check` | Passed with advisory | 43 test files and 554 tests passed; strict typecheck, zero-warning lint, production build, privacy/provider/deferred-scope scans, source review, and diff check passed. The build produced a 626.97 kB main JavaScript chunk and retained Vite's existing greater-than-500 kB advisory. |
| 2026-07-20 | VEH-FIX-REV3-002 live database | Reset local database and 73-assertion Vehicle pgTAP suite | Unavailable | Static migration and suite-source validation passed. The sandboxed Supabase CLI could not write `/home/vfidelix/.supabase/telemetry.json`; the escalated retry was interrupted without a result, so live execution is not reported as passed. |
| 2026-07-20 | VEH-FIX-REV3-003 targeted | Vehicle pgTAP source and static verifier | Passed | 9 static-verifier tests passed; the suite contains exactly 75 pgTAP assertions and independently mandates privileged unchanged-row readbacks after the mapped non-admin and authenticated-unmapped zero-row UPDATE attempts before each caller role is restored. |
| 2026-07-20 | VEH-FIX-REV3-003 full gates | `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`; security/privacy scans; `git diff --check` | Passed with advisory | 43 test files and 555 tests passed; strict typecheck, zero-warning lint, production build, scoped source review, security/privacy scans, and diff check passed. The build produced a 626.97 kB main JavaScript chunk and retained Vite's existing greater-than-500 kB advisory. Production migrations and RLS were unchanged. |
| 2026-07-20 | VEH-FIX-REV3-003 live database | Reset local database and 75-assertion Vehicle pgTAP suite | Unavailable | The immediately available live path retains the previously recorded Supabase telemetry/Docker restrictions; under the bounded worker instruction no escalation or potentially hanging retry was attempted. Static suite validation passed, but live execution is not reported as passed. |
| 2026-07-20 | VEH-FIX-REV3-004 TDD red | Mapper and Supabase shared-contract regressions | Failed as expected | 23 new assertions failed before the mapper correction: generic HTTP 404 and missing table/RPC resource scenarios were returned as `not_found` across all nine repository operations, while direct mapper checks also exposed ambiguous `PGRST116` handling. |
| 2026-07-20 | VEH-FIX-REV3-004 targeted | Error mapper, Supabase repository adapter, and shared repository contract | Passed | 3 focused files and 75 tests passed. Explicit missing rows remain `not_found` for get, update, archive, restore, and delete; generic HTTP 404, `PGRST116`, `PGRST202`, and `PGRST205` are safe temporary failures, with all-operation private sentinel redaction coverage. |
| 2026-07-20 | VEH-FIX-REV3-004 full gates | `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`; `git diff --check` | Passed with advisory | 43 test files and 579 tests passed; strict typecheck, zero-warning lint, production build, and diff check passed. The build produced a 626.94 kB main JavaScript chunk and retained Vite's existing greater-than-500 kB advisory. |
| 2026-07-20 | VEH-FIX-REV3-004 boundaries | Privacy, provider, deferred-scope scans; source and current diff review | Passed | No Vehicle runtime logging or browser storage, provider terminology outside infrastructure, provider-code or private payload leakage, Service Record scope expansion, generic provider-error framework, or unrelated production change was introduced. Production behavior changed only in the existing Vehicle error mapper. |
| 2026-07-20 | Review round 4 | Full-feature senior review | Actionable findings | VEH-REV1-001, VEH-REV2-001, and VEH-REV3-001 through VEH-REV3-004 verified fixed. VEH-REV4-001 and VEH-REV4-002 recorded as Medium and linked to approved within-scope fixes in dependency order. Residuals remain the live 75-assertion Vehicle pgTAP suite, screenshots and HTTP smoke, current registry audit, bundle advisory, and deferred Service Record integration. |
| 2026-07-20 | VEH-FIX-REV4-001 TDD red | Deferred create/update duplicate-lookup authorization regressions | Failed as expected | Six new sign-out, same-ID role-loss, and replacement-admin cases persisted before the application-layer identity recheck; 28 existing and unchanged-identity tests passed. |
| 2026-07-20 | VEH-FIX-REV4-001 intermediate | Focused tests, typecheck, and lint | Failed | All 34 focused behavior tests and lint passed after the production fix; strict typecheck found one test-table generic result widened to `unknown`, which was corrected without changing production behavior. |
| 2026-07-20 | VEH-FIX-REV4-001 targeted | Vehicle use-case authorization and deferred duplicate-lookup suite | Passed | 34 tests passed. Create/update deny persistence after deferred sign-out, same-ID role loss, or replacement admin; unchanged identity persists after successful or unavailable duplicate lookup, and existing protected-input and safe-error coverage remains green. |
| 2026-07-20 | VEH-FIX-REV4-001 full gates | `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`; `git diff --check` | Passed with advisory | 43 test files and 589 tests passed; strict typecheck, zero-warning lint, production build, and diff check passed. The build produced a 627.20 kB main JavaScript chunk and retained Vite's existing greater-than-500 kB advisory. |
| 2026-07-20 | VEH-FIX-REV4-001 boundaries | Privacy, provider, deferred-scope scans; source and current diff review | Passed | The production change contains no private logging/storage, provider detail, or Service Record expansion; it changes only create/update's existing duplicate workflow, keeps the other six use cases simple, preserves protected inputs and fixed app-owned errors, and adds no generic session framework. |
| 2026-07-20 | VEH-FIX-REV4-002 TDD red | Vehicle query, provider cleanup, and create/edit workflow regressions | Failed as expected | Eight new assertions failed before production implementation: no feedback key existed and create/update still placed the registration-bearing warning in router state; 58 existing focused tests passed. |
| 2026-07-20 | VEH-FIX-REV4-002 observer red | Active duplicate-feedback observer across sign-out and direct identity replacement | Failed as expected | Both identity-transition cases showed that QueryCache removal alone left the mounted disabled-query observer displaying the old session's label, requiring the existing Vehicle generation to be published to consumers. |
| 2026-07-20 | VEH-FIX-REV4-002 intermediate | Focused StrictMode workflow verification | Failed | One test-only trailing comma caused a parse failure and the corrected run exposed a stale cache-data expectation after StrictMode correctly consumed the warning entry; both assertions were corrected before final verification without changing the accepted behavior. |
| 2026-07-20 | VEH-FIX-REV4-002 targeted | Vehicle query, provider cleanup, and create/edit workflow suites | Passed | 3 focused files and 68 tests passed for registration-bearing current-session create/update feedback, accessible rendering, generation-scoped query ownership, destination consumption, null router state, sign-out, direct identity replacement, and late stale-completion suppression. |
| 2026-07-20 | VEH-FIX-REV4-002 full gates | `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`; `git diff --check` | Passed with advisory | 43 test files and 592 tests passed; strict typecheck, zero-warning lint, production build, and diff check passed. The build produced a 627.48 kB main JavaScript chunk and retained Vite's existing greater-than-500 kB advisory. |
| 2026-07-20 | VEH-FIX-REV4-002 boundaries | Route-state, privacy, provider, deferred-scope scans; source and current diff review | Passed | Obsolete route-state types/parsing and private navigation state are absent. The scoped change adds no private logging or browser persistence, provider detail, Service Record expansion, generic state framework, or unrelated store; cleanup remains under the Vehicle query root and mutation generation guard. |
| 2026-07-21 | Review round 5 | Full-feature senior review | Passed - no actionable findings | All findings VEH-REV1-001, VEH-REV2-001, VEH-REV3-001 through VEH-REV3-004, and VEH-REV4-001 through VEH-REV4-002 are fixed and verified with linked fix tasks complete. Final available gates passed: 43 files/592 tests, typecheck, zero-warning lint, build, static database checks, privacy/provider/deferred-scope scans, current diff review, and diff check. Residuals remain live 75-assertion pgTAP, screenshots, current audit, 627.48 kB bundle advisory, and deferred Service Record-dependent invariants. HTTP smoke was subsequently resolved. |
| 2026-07-20 | Post-review HTTP smoke | Outside-sandbox Vite dev server and `curl --head http://127.0.0.1:5173/` | Passed | Server started at `http://127.0.0.1:5173/`; the outside-sandbox HEAD request returned `HTTP/1.1 200 OK`. The earlier sandboxed socket failure remains historical and the HTTP route/server smoke residual is resolved. |
