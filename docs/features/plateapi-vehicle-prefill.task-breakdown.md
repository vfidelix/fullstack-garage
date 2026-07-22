# PlateAPI Vehicle Prefill Controlled Task Breakdown

Status: PLATEAPI-PLAN-003 completed and approved by senior review
Plan revision: PLATEAPI-PLAN-003
Last updated: 2026-07-22
Source: [PlateAPI Vehicle Prefill Feature](plateapi-vehicle-prefill.md)
Vehicle dependency: [Vehicle Feature](vehicles.md)
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)
Design: [Ferrari design source](../../DESIGN.md)
Operations: [PlateAPI runbook](../operations/plateapi-vehicle-prefill-runbook.md)

## 1. Purpose and Planning State

This is the canonical plan and progress document for the PlateAPI Vehicle
Prefill feature. It owns stable task IDs, dependency order, acceptance criteria,
required validation, concrete validation outcomes, the approval record, and
review-finding dispositions for the controlled orchestration workflow.

`PLATEAPI-PLAN-002` and tasks `PLATEAPI-01` through `PLATEAPI-05` delivered the
existing authenticated lookup proxy, app-owned lookup boundary, create-Vehicle
lookup interaction, privacy/runbook material, and initial verification. They are
preserved in Section 6 as implementation history.

`PLATEAPI-PLAN-003` extends that implementation with persisted text Year,
persisted Body, PlateAPI year-range/body/detailed-description mapping, editable
provider Year rules, Notes append and preservation rules, precise lookup locking,
lookup-clear restoration for Body, and Body presentation. It does not reopen the
existing proxy, authorization, alternative-selection, privacy, or manual-fallback
decisions except where the approved field mapping requires a detailed provider
response.

Changing approved scope, dependencies, or acceptance criteria requires a new
plan revision and clears the approval record. Updating status, validation
outcomes, or review-finding dispositions does not change the revision.

## 2. Approval Record

The user explicitly approved plan revision `PLATEAPI-PLAN-003` and task IDs
`PLATEAPI-06`, `PLATEAPI-07`, `PLATEAPI-08`, `PLATEAPI-09`, `PLATEAPI-10`, and
`PLATEAPI-11` on 2026-07-22 by directing implementation of the supplied
"PlateAPI Vehicle Prefill Extension" plan and identifying it as the source of
user intent.

Approved revision: `PLATEAPI-PLAN-003`
Approved task IDs: `PLATEAPI-06` through `PLATEAPI-11`
Approval date: 2026-07-22
Approval scope: exactly the current task contracts in Section 7

## 3. Repository Baseline

- The repository is a React, Vite, and strict TypeScript SPA. Vehicle domain,
  use-case, Supabase repository, form, list/detail screens, migrations, Vitest,
  and pgTAP coverage already exist.
- The current PlateAPI implementation uses a same-origin Cloudflare Pages
  Function, validates the Supabase session and Garage Admin role, keeps the API
  key server-side, maps provider responses to an app-owned suggestion, presents
  alternatives explicitly, and supports apply/clear behavior in create Vehicle.
- `Vehicle.year` is currently a number in the domain and Supabase mapping, an
  integer in Postgres, and a numeric form field. The current lookup maps only
  equal numeric `lowest_year`/`highest_year` bounds and locks Year after apply.
- Vehicle has no `body` field. PlateAPI `body`, `year_range`, and
  `detailed_description` are not currently included in the normalized
  suggestion. Notes are not changed by lookup.
- Current lookup restoration snapshots Make, Model, Year, and Engine. It does
  not snapshot Body because Body does not yet exist.
- The working tree contains unrelated and earlier PlateAPI changes. Workers must
  re-read current files, preserve all unrelated changes, and avoid broad
  formatting or rewrites.
- `DESIGN.md` requires existing global tokens, sharp geometry, restrained color,
  and readable form contrast. No new one-off visual tokens are approved.
- No architecture mismatch exists: provider field names remain in the edge
  adapter, app-owned types cross inward, and Vehicle persistence continues
  through the existing use cases and Supabase repository.

## 4. Delivery Boundaries, Assumptions, and Risks

### In scope

- Change optional Vehicle Year from integer/number to trimmed bounded text in the
  domain, create/update inputs, form output, repository mapping, and persistence.
- Preserve strict manual Year entry as exactly four digits and numeric 1900-9999
  while accepting an untouched provider value such as `2018-2021`.
- Add optional bounded Body across domain, create/update, form, Supabase mapping,
  writes, create/edit UI, and Vehicle detail UI.
- Prefer PlateAPI `year_range`; use equal valid year bounds only when
  `year_range` is absent; map `body` and `detailed_description` into app-owned
  `body` and `detailedDescription` suggestion properties.
- Lock and visually distinguish only provider-filled Make, Model, Engine, and
  Body. Keep Year and Notes editable.
- Append trimmed detailed description to Notes only when it is non-empty and not
  already contained under a case-insensitive comparison. Preserve Notes during
  lookup clearing.
- Restore pre-lookup Make, Model, Engine, Year, and Body when lookup is cleared.
- Add a forward migration, minimum column grants, RLS/grant regression coverage,
  repository tests, UI tests, and the required full validation gates.

### Out of scope

- Body in compact Vehicle labels or summary list labels.
- Persisting provider provenance, description, alternatives, source, duration,
  sandbox, quota, timestamps, or other PlateAPI metadata.
- Lookup on the Vehicle edit screen, VIN lookup, automatic Vehicle save,
  Service Record changes, or a second persistence/authentication path.
- Truncating provider text, rewriting Notes on clear, or silently choosing a year
  from unequal numeric bounds.

### Assumptions and constraints

- Persisted Year accepts non-empty trimmed provider text within the approved
  Vehicle text limit because lookup values may be ranges. Strict 1900-9999
  four-digit validation is a manual-form rule, not a database constraint.
- Body uses the existing 50-character Vehicle text limit. Detailed description
  is validated at the external boundary against the existing 500-character Notes
  limit. Existing Notes validation remains authoritative after append; provider
  text is never silently truncated.
- `year_range` wins whenever present and valid. Equal numeric bound fallback is
  evaluated only when `year_range` is absent.
- "Already appears" means the trimmed detailed description is a
  case-insensitive substring of current Notes. Append uses exactly one blank
  line (`\n\n`) between non-empty existing Notes and the description.
- The provider request enables its detailed response on the server. The browser
  cannot supply or override provider-specific request flags.
- Existing rows migrate with their numeric Year rendered as its decimal text and
  with Body null. Current RLS policies remain authoritative.

### Risks

- The form needs explicit provider-Year provenance state; value shape alone
  cannot distinguish an untouched provider range from manual range input.
- Notes are user-owned after append. Snapshotting or clearing Notes would violate
  the approved rule even if it appears to simplify lookup rollback.
- A forward `integer`-to-`text` migration must preserve data, replace the numeric
  check, update grants, and remain compatible with lifecycle functions returning
  `public.vehicles`.
- Read-only controls must remain visibly distinct and readable; HTML disabled
  controls would omit values from form submission, so implementation must retain
  the existing safe form-submission behavior.

## 5. Dependency Order

```text
PLATEAPI-06
  |-- PLATEAPI-07
  |-- PLATEAPI-08
  |     `-- PLATEAPI-09
  |-- PLATEAPI-09 (also depends on PLATEAPI-06)
  `-- PLATEAPI-10 (also depends on PLATEAPI-07 and PLATEAPI-09)

PLATEAPI-07 + PLATEAPI-08 + PLATEAPI-09 + PLATEAPI-10
  `-- PLATEAPI-11
```

Write tasks run sequentially under the orchestration workflow even where the
logical dependency graph permits independent investigation.

## 6. Task Summary and Progress

| ID | Task | Depends on | Status | Required validation | Concrete validation outcome |
| --- | --- | --- | --- | --- | --- |
| PLATEAPI-01 | Add authenticated server-side PlateAPI proxy | None | Completed under PLATEAPI-PLAN-002 | Proxy authorization, input, timeout, response-size, secret, and error mapping checks | Implemented in the existing baseline; deployment secret remains runbook-gated. |
| PLATEAPI-02 | Add app-owned lookup contract and adapter | PLATEAPI-01 | Completed under PLATEAPI-PLAN-002 | Domain/use-case/adapter unit coverage and provider-boundary review | Implemented in the existing baseline. |
| PLATEAPI-03 | Add create-Vehicle lookup/apply/clear flow | PLATEAPI-02 | Completed under PLATEAPI-PLAN-002 | Component coverage for alternatives, stale input, locking, clear, and manual fallback | Implemented in the existing baseline. |
| PLATEAPI-04 | Add privacy notice and operations runbook | PLATEAPI-01 | Completed under PLATEAPI-PLAN-002 | Documentation and deployment checklist review | Implemented; production enablement remains deployment-gated. |
| PLATEAPI-05 | Run PLATEAPI-PLAN-002 verification | PLATEAPI-01–04 | Historical status: in progress | Repository gates and local function validation | Prior canonical outcome recorded as in progress; PLATEAPI-PLAN-003 does not rewrite that history. |
| PLATEAPI-06 | Change Vehicle Year contract to text and add Body | None | Completed | Targeted domain and form-schema tests; typecheck; lint; diff check | Passed 2026-07-22: 11 affected Vitest files, 284 tests; `npm run typecheck`; `npm run lint`; and `git diff --check`. The legacy integer-row mapper temporarily converts Year to domain text until PLATEAPI-07 replaces the persistence boundary. |
| PLATEAPI-07 | Migrate and map text Year and Body persistence | PLATEAPI-06 | Completed | Migration/static tests, repository/mapper/contract tests, grants/RLS/pgTAP, database reset/lint where available | Passed 2026-07-22: focused persistence/static suites passed 7 files and 123 tests; local Supabase reset applied the forward migration; database lint found no schema errors; pgTAP passed 137 assertions across both suites, including 99 Vehicle assertions; full Vitest passed 48 files and 647 tests; typecheck, lint, build, and diff check passed. |
| PLATEAPI-08 | Extend normalized PlateAPI suggestion mapping | PLATEAPI-06 | Completed | Domain boundary, proxy, worker, and Cloudflare adapter tests | Passed 2026-07-22: 4 focused Vitest files, 43 tests; `npm run typecheck`; `npm run lint`; and `git diff --check`. |
| PLATEAPI-09 | Implement lookup Year, Notes, locking, and restoration behavior | PLATEAPI-06, PLATEAPI-08 | Completed | Form/component tests for Year modes, Notes matrix, exact locks, visual state, and clear restoration | Passed 2026-07-22: 4 affected Vitest files, 87 tests; `npm run typecheck`; `npm run lint`; production build with a writable temporary Wrangler config directory; and `git diff --check`. |
| PLATEAPI-10 | Add Body to create/edit/detail presentation without compact labels | PLATEAPI-06, PLATEAPI-07, PLATEAPI-09 | Completed | Workflow/detail/list regression tests and responsive/accessibility source review | Passed 2026-07-22: 5 affected Vitest files, 98 tests; `npm run typecheck`; `npm run lint`; production build with a writable temporary Wrangler config directory; and `git diff --check`. Source review confirmed existing design tokens, responsive layouts, accessible form descriptions/errors, and unchanged compact labels. |
| PLATEAPI-11 | Run full verification and record outcomes | PLATEAPI-07, PLATEAPI-08, PLATEAPI-09, PLATEAPI-10 | Completed | `npm test`; typecheck; lint; build; `npm run test:db`; migration checks; diff check | Passed 2026-07-22: 49 Vitest files and 696 tests; strict typecheck and lint, including the server proxy; production build with no local `.dev.vars` artifact or PlateAPI key marker in client output; local reset and schema lint; 137 pgTAP assertions; boundary/privacy/product-language/architecture/compact-label searches; and staged, unstaged, and combined diff checks. Details and non-failing diagnostics are recorded in the task outcome below. |

## 7. Detailed PLATEAPI-PLAN-003 Task Contracts

### PLATEAPI-06 - Change Vehicle Year contract to text and add Body

- **Dependencies:** None.
- **Expected files:** `src/domain/vehicles/vehicle.ts`,
  `src/domain/vehicles/vehicle.test.ts`,
  `src/features/vehicles/vehicleFormSchema.ts`,
  `src/features/vehicles/vehicleFormSchema.test.ts`, plus directly affected
  app-owned type/fixture tests.
- **Acceptance criteria:** Change `Vehicle.year`, `CreateVehicle.year`, and
  `UpdateVehicle.year` from optional number to optional string. Normalize Year as
  optional trimmed text and validate it as non-empty bounded persisted text,
  without applying manual-only numeric rules in the domain. Add optional `body`
  to Vehicle/create/update types, normalization, length validation, and
  validation issue fields. Change form output to string Year and add Body to form
  values/defaults. Manual Year accepts exactly `1900`, `2026`, and `9999` and
  rejects short, long, decimal, signed, alphabetic, range, and below-minimum
  values. Preserve label output for both exact and range text without adding Body
  to compact labels.
- **Validation:** Focused domain/form tests for normalization, boundaries, invalid
  manual shapes, Body length, label behavior, and protected fields; `npm run
  typecheck`; `npm run lint`; `git diff --check`.
- **Status:** Completed.
- **Concrete validation outcome:** Passed 2026-07-22: the focused domain/form
  and directly affected compatibility suites passed with 11 files and 284 tests;
  `npm run typecheck`, `npm run lint`, and `git diff --check` passed. The current
  integer-row mapper retains its legacy numeric boundary and converts Year to
  app-owned text as a temporary PLATEAPI-06 compatibility step; PLATEAPI-07 will
  replace that persistence boundary with text Year and Body mapping.

### PLATEAPI-07 - Migrate and map text Year and Body persistence

- **Dependencies:** PLATEAPI-06.
- **Expected files:** one new forward file under `supabase/migrations/`,
  `src/infrastructure/supabase/repositories/SupabaseVehicleRepository.ts`,
  `src/infrastructure/supabase/repositories/mapVehicleRow.ts`, their focused
  tests, `src/application/ports/vehicleRepository.contract.ts`, repository
  contract fixtures/tests, `supabase/tests/vehicleManagementMigration.test.mjs`,
  a new migration static test where appropriate, and
  `supabase/tests/vehicle_management.test.sql`.
- **Acceptance criteria:** Add one forward migration that converts every existing
  integer Year to equivalent text, removes the numeric year-range constraint,
  enforces nullable nonblank bounded text Year, adds nullable Body with the
  approved text-length constraint, and grants authenticated insert/update only
  for the new Body column while retaining Year access. Preserve existing data,
  RLS, policies, ownership, triggers, indexes, and lifecycle functions. Add Year
  and Body to repository selections, row validation/mapping, create/update
  writes, and shared contracts. Invalid external rows fail safely. Do not add
  Body to summary/compact labels unless needed only to satisfy an existing full
  Vehicle contract.
- **Validation:** Focused mapper/repository/shared-contract tests; migration
  parser/static tests; database reset and lint where available; pgTAP coverage
  for conversion, constraints, grants, RLS, and create/read/update round trips;
  `npm test`; typecheck; lint; build; diff check. Record environment-unavailable
  database checks precisely rather than reporting them as passed.
- **Status:** Completed.
- **Concrete validation outcome:** Passed 2026-07-22. Focused mapper,
  repository, shared-contract, migration-static, and database-suite-static
  coverage passed 7 files and 123 tests. Local `supabase db reset` applied the
  new forward migration; `supabase db lint` reported no schema errors; and
  `npm run test:db` passed 137 assertions across both pgTAP suites, including
  all 99 Vehicle assertions for conversion, constraints, grants, RLS, and
  create/read/update behavior. `npm test` passed 48 files and 647 tests;
  `npm run typecheck`, `npm run lint`, `npm run build` (with a writable temporary
  Wrangler config directory), and `git diff --check` passed. The build retained
  the existing non-failing large-chunk warning.

### PLATEAPI-08 - Extend normalized PlateAPI suggestion mapping

- **Dependencies:** PLATEAPI-06.
- **Expected files:** `src/domain/vehicles/registrationLookup.ts`,
  `src/domain/vehicles/registrationLookup.test.ts`,
  `functions/api/vehicle-registration-lookup.ts`,
  `src/infrastructure/cloudflare/CloudflareVehicleRegistrationLookup.ts`,
  `src/worker.test.ts`, and directly affected lookup tests.
- **Acceptance criteria:** Extend the app-owned suggestion with optional string
  `year`, optional `body`, and optional `detailedDescription`. Keep
  `registrationState` app-owned. Validate every provider value from `unknown` at
  the proxy boundary; keep `year_range`, `body`, and `detailed_description`
  names inside the provider adapter. Prefer trimmed valid `year_range`; only
  when it is absent, map equal valid `lowest_year`/`highest_year` to exact-year
  text. Map valid Body and trimmed detailed description. Reject mistyped,
  blank, or over-limit provided fields safely, tolerate unknown extra fields,
  preserve alternative ordering, and request the provider's detailed response
  server-side without accepting a browser-controlled provider flag.
- **Validation:** Unit/adapter tests for year-range precedence, exact-year
  fallback, unequal-bound omission, Body, detailed description, blank/over-limit
  and mistyped fields, unknown fields, primary plus alternatives, and safe
  browser-response validation; typecheck; lint; diff check.
- **Status:** Completed.
- **Concrete validation outcome:** Passed 2026-07-22: the focused app-owned
  domain boundary, server proxy/worker, Cloudflare browser adapter, and directly
  affected lookup-form suites passed with 4 files and 43 tests. `npm run
  typecheck`, `npm run lint`, and `git diff --check` passed. Provider mapping now
  returns trimmed string Year with `year_range` precedence and exact-year text
  fallback, Body, and detailed description; retains the caller-selected app-owned
  registration state and alternative order; tolerates unknown provider fields;
  rejects unusable supplied values; and sets server-owned `detailed=true`.

### PLATEAPI-09 - Implement lookup Year, Notes, locking, and restoration behavior

- **Dependencies:** PLATEAPI-06, PLATEAPI-08.
- **Expected files:** `src/features/vehicles/VehicleForm.tsx`,
  `src/features/vehicles/VehicleForm.module.css`,
  `src/features/vehicles/VehicleForm.registrationLookup.test.tsx`, and focused
  form-schema/component tests.
- **Acceptance criteria:** Applying a suggestion snapshots Make, Model, Engine,
  Year, and Body and fills each provided value. Only provider-filled Make, Model,
  Engine, and Body become read-only; each receives the same explicit disabled
  visual state using existing design tokens and readable contrast. Year remains
  editable. An untouched provider Year, including a range, bypasses manual Year
  shape validation; its first user edit switches it to strict manual validation
  for the current lookup application. Notes remain editable. Applying lookup
  trims detailed description, ignores empty text, skips a case-insensitive
  duplicate already contained in Notes, otherwise appends with `\n\n`, and does
  not duplicate on repeated application. Clearing or invalidating lookup restores
  the snapshot fields including Body, resets Year provenance, unlocks fields,
  and leaves current Notes byte-for-byte unchanged. Existing stale-response,
  explicit-alternative, registration/state, and manual-fallback behavior remains.
- **Validation:** Component tests for untouched range, first edit, all manual
  Year cases, field-by-field `readOnly` state and visual marker/class, empty and
  existing Notes, case-insensitive duplicates, repeated apply, Notes user edits,
  lookup clear/invalidation, full snapshot restoration, alternatives, and stale
  responses; typecheck; lint; build; diff check.
- **Status:** Completed.
- **Concrete validation outcome:** Passed 2026-07-22: the focused form-schema,
  lookup-component, Vehicle workflow, and route suites passed with 4 files and
  87 tests. `npm run typecheck`, `npm run lint`, `npm run build` with a writable
  temporary Wrangler config directory, and `git diff --check` passed. The build
  retained the existing non-failing large-chunk warning. Coverage verifies
  provider Year provenance through first edit, exact per-field locking and the
  common token-based visual marker, Body snapshot restoration, the Notes append
  and duplicate matrix, clear/invalidation preservation, alternatives, and stale
  responses.

### PLATEAPI-10 - Add Body to create/edit/detail presentation without compact labels

- **Dependencies:** PLATEAPI-06, PLATEAPI-07, PLATEAPI-09.
- **Expected files:** `src/features/vehicles/VehicleForm.tsx`,
  `src/features/vehicles/VehicleDetailScreen.tsx`, Vehicle workflow/detail/list
  tests, and only directly affected fixtures.
- **Acceptance criteria:** Show optional Body in create and edit forms and in the
  Vehicle detail definition list, with existing character-count, error,
  accessibility, layout, and responsive patterns. Existing saved Body populates
  edit defaults and persists through update. The detail view uses `Not recorded`
  when absent. Compact active/archived list labels and the shared compact label
  formatter remain unchanged and contain no Body.
- **Validation:** Create/edit/detail component and workflow tests for present and
  absent Body, update persistence, errors, accessible labels/descriptions, and a
  regression assertion that compact list labels omit Body; responsive/design
  token source review; full affected tests; typecheck; lint; build; diff check.
- **Status:** Completed.
- **Concrete validation outcome:** Passed 2026-07-22: 5 affected Vitest files
  and 98 tests; `npm run typecheck`; `npm run lint`; `npm run build` with a
  writable temporary Wrangler config directory; and `git diff --check`.
  Coverage verifies optional Body creation, existing Body edit defaults and
  update persistence, Body validation and accessible count/error descriptions,
  present and absent detail values, and omission from active and archived
  compact labels. Source review confirmed the existing token-based form/detail
  styling and desktop, tablet, and mobile grid behavior remain in use. The build
  retained the existing non-failing large-chunk warning.

### PLATEAPI-11 - Run full verification and record outcomes

- **Dependencies:** PLATEAPI-07, PLATEAPI-08, PLATEAPI-09, PLATEAPI-10.
- **Expected files:** this canonical progress document and only narrowly scoped
  test/document corrections required by failed approved checks.
- **Acceptance criteria:** Run the complete approved repository and database
  gates, review the final diff for provider-boundary leakage, secret/privacy
  regressions, architecture violations, product-language regressions, Body in
  compact labels, overengineering, and unrelated changes. Update every
  PLATEAPI-PLAN-003 task with an exact command/test-count outcome and residual
  environment limitations. Do not weaken tests or checks to obtain a pass.
- **Validation:** `npm test`; `npm run typecheck`; `npm run lint`; `npm run
  build`; `npm run test:db`; applicable Supabase migration reset/lint; privacy,
  secret, provider-name, and product-language searches; `git diff --check`.
- **Status:** Completed.
- **Concrete validation outcome:** Passed 2026-07-22. `npm test` passed
  49 files and 696 tests. `npm run typecheck` passed with the new server adapter
  included in `tsconfig.app.json`; `npm run lint` passed with zero warnings after
  removing the `functions/**` exclusion, so the adapter is covered by the normal
  strict lint gate. `npm run build` passed with a writable temporary
  `XDG_CONFIG_HOME`; a narrow build-output guard removed Cloudflare's generated
  local `.dev.vars` asset, and explicit checks confirmed that asset was absent
  and no `PLATEAPI_API_KEY` marker appeared in `dist/client`. The build retained
  the existing non-failing 640.16 kB client-chunk warning.

  `env HOME=/tmp/supabase-cli-home SUPABASE_TELEMETRY_DISABLED=true supabase db
  reset` recreated the local database and applied
  `20260722000100_add_vehicle_text_year_and_body.sql`; the CLI noted the
  intentionally absent `supabase/seed.sql`, warned that local Google OAuth
  variables were unset, and emitted a telemetry network warning only after the
  reset succeeded. `env HOME=/tmp/supabase-cli-home
  SUPABASE_TELEMETRY_DISABLED=true supabase db lint` reported no schema errors.
  `env HOME=/tmp/supabase-cli-home SUPABASE_TELEMETRY_DISABLED=true npm run
  test:db` passed both pgTAP files and all 137 assertions.

  Focused regression checks passed 15 environment-guard tests and 27 proxy and
  browser-adapter tests. Searches found no raw `year_range`, `lowest_year`,
  `highest_year`, `detailed_description`, or `X-API-Key` names outside the
  server adapter; no application logging calls; no forbidden invoice, payment,
  tax, or amount-due language; no Supabase SDK import outside the Supabase
  infrastructure boundary; and no Body reference in compact-list production
  code. Review of the full diff found no committed secret, private-data logging,
  provider-contract leakage, test weakening, new generic scaffolding, or lost
  unrelated worktree change. `git diff --check`, `git diff --cached --check`,
  and `git diff HEAD --check` all passed. Vitest retained jsdom's non-failing
  `Not implemented: navigation to another Document` diagnostic. No environment
  limitation prevented an approved gate from running or passing.

## 8. Review Findings

Reviewers must record findings first in severity order with a stable ID, file and
line evidence, disposition, smallest linked fix task, and concrete verification
outcome. New PLATEAPI-PLAN-003 findings use IDs beginning
`PLATEAPI-R3-F001`; finding-derived fixes use the matching ID in the task name.

| Finding ID | Severity and finding | Disposition | Linked fix task | Verification outcome |
| --- | --- | --- | --- | --- |
| PLATEAPI-DOC-001 | Historical: server-only key and authenticated proxy required. | Implemented under PLATEAPI-PLAN-002. | PLATEAPI-01 | Existing baseline contains the authenticated same-origin proxy. |
| PLATEAPI-DOC-002 | Historical: provider disclosure requires a public notice and deployment checklist. | Implemented under PLATEAPI-PLAN-002. | PLATEAPI-04 | Existing privacy notice and runbook remain in place. |
| PLATEAPI-DOC-003 | Historical: alternatives require explicit peer selection and stale results must be discarded. | Implemented under PLATEAPI-PLAN-002. | PLATEAPI-03 | Existing component coverage records both behaviors. |
| PLATEAPI-DOC-004 | Historical: reuse persisted `registrationState`; no registration-state migration. | Implemented under PLATEAPI-PLAN-002. | PLATEAPI-02 | Existing Vehicle registration-state path remains unchanged. |
| PLATEAPI-R3-F001 | Medium: the eight-second proxy timeout starts only after authorization, and neither Supabase authorization fetch receives its abort signal, so stalled user or admin verification can leave the request open indefinitely (`functions/api/vehicle-registration-lookup.ts`). | Fixed and verified. | PLATEAPI-R3-F001-FIX | One request-scoped controller now covers both Supabase authorization fetches and the provider fetch. Fake-timer coverage verifies user, admin, and provider stalls abort at eight seconds, share one signal, retain the safe error response, and clear the timer; focused tests, typecheck, lint, build, and diff check passed. |
| PLATEAPI-R3-F002 | Medium: lookup invalidation calls React Hook Form `setValue` during render (`src/features/vehicles/VehicleForm.tsx`), risking render-phase updates and React warnings. | Fixed and verified. | PLATEAPI-R3-F002-FIX | Snapshot restoration now runs outside React state updaters. Explicit-clear and invalidation coverage observes `console.error` without suppressing it and verifies no render-phase warnings; focused and full tests, typecheck, lint, build, and diff checks passed. |
| PLATEAPI-R3-F004 | Medium: edit forms start with provider-Year provenance disabled and have no lookup control, so an untouched persisted text Year such as `2018-2021` fails manual-only validation and blocks unrelated edits (`src/features/vehicles/VehicleForm.tsx`). | Fixed and verified. | PLATEAPI-R3-F004-FIX | Edit forms now preserve a non-empty initial persisted Year under non-manual provenance until its first input change. Workflow coverage verifies unrelated Body and Notes edits preserve `2018-2021`, edit-and-revert remains strict, and untouched exact `2021` still persists; focused and full tests, typecheck, lint, build, and diff checks passed. |
| PLATEAPI-R3-F005 | Medium: the Cloudflare lookup adapter imports and calls Supabase Auth outside `src/infrastructure/supabase/`, and a rejected access-token retrieval occurs outside its result-normalizing `try`, violating the architecture boundary and allowing the lookup promise to reject without an app-owned result (`src/infrastructure/cloudflare/CloudflareVehicleRegistrationLookup.ts`). | Fixed and verified. | PLATEAPI-R3-F005-FIX | An app-owned access-token port now isolates the Supabase session adapter under `src/infrastructure/supabase/auth`; returned errors and rejections are normalized without vendor details, the Cloudflare adapter maps token-provider rejection to `temporary_unavailable`, and the UI restores lookup readiness with its safe error. Focused and full tests, typecheck, lint, build, database tests, architecture source checks, and diff checks passed. |
| PLATEAPI-R3-F003 | Low: Body is absent from alternative suggestion labels (`src/features/vehicles/VehicleForm.tsx`), so otherwise similar alternatives can remain hard to distinguish. | Fixed and verified. | PLATEAPI-R3-F003-FIX | Alternative labels now include Body after Year, Make, Model, and Engine. RTL coverage proves otherwise-identical Coupe and Convertible recommendations have distinct visible and accessible names and that the selected Body is applied; focused tests, typecheck, lint, build, and diff checks passed. |
| PLATEAPI-R3-Q001 | Reviewer question: should PlateAPI's general `description` be displayed as suggestion context? The feature specification says it is displayed, while the PLATEAPI-PLAN-003 boundary excludes general description persistence and does not define an app-owned mapping or UI behavior. | Deferred outside PLATEAPI-PLAN-003 as non-actionable; awaiting a future product decision because of the pre-existing specification inconsistency. | None; no automatic fix. | No code change authorized or made; the latest senior review confirmed this does not block PLATEAPI-PLAN-003 approval. |

### Senior review round 3 closeout

Senior review round 3 approved `PLATEAPI-PLAN-003` on 2026-07-22 with no
actionable findings. The reviewer confirmed that `PLATEAPI-R3-F001` through
`PLATEAPI-R3-F005` retain fixed-and-verified dispositions and that their linked
fix outcomes satisfy the recorded intended outcomes without changing the
approved revision, scope, dependencies, acceptance criteria, or task
definitions. `PLATEAPI-R3-Q001` remains a deferred, non-actionable product
decision outside this plan.

Reviewer verification passed 8 focused Vitest files and 141 tests, `npm run
typecheck`, `npm run lint`, and the combined `git diff HEAD --check`. The review
covered the complete combined feature diff and found no remaining correctness,
regression, security, architecture, migration, test, maintainability,
overengineering, or unnecessary-boilerplate issue requiring action under the
approved plan.

### Reviewer-derived fix tasks

#### PLATEAPI-R3-F001-FIX - Apply one request-scoped proxy timeout

- **Approval basis:** Preserves the approved authenticated-proxy timeout and
  security scope; it does not change PLATEAPI-PLAN-003 requirements.
- **Reviewer evidence:** The current timeout and `AbortController` are created
  after `authorize`, while the user and admin verification fetches have no
  signal.
- **Intended outcome:** Start one eight-second timeout before authorization,
  pass its signal to both Supabase authorization fetches and the PlateAPI fetch,
  retain existing privacy-safe error mapping, and clear the timer on every
  outcome.
- **Scope limit:** Do not address PLATEAPI-R3-F002, PLATEAPI-R3-F003, or the
  deferred general-description question.
- **Status:** Completed.
- **Required validation:** Deterministic fake-timer tests for stalled
  authorization and provider requests; focused proxy/worker tests; typecheck;
  lint; build where relevant; diff check.
- **Concrete validation outcome:** Passed 2026-07-22. The implementation starts
  one eight-second timer before authorization, passes the same abort signal to
  user verification, admin verification, and provider lookup, maps aborts to the
  existing `temporary_unavailable` 503 response, and clears the timer through a
  single `finally` block on all post-validation outcomes. Deterministic fake
  timers cover stalls in all three phases and an early missing-configuration
  return. Focused proxy and browser-adapter Vitest passed 2 files and 30 tests;
  `npm run typecheck`, `npm run lint`, the production build with writable
  temporary `XDG_CONFIG_HOME`, and `git diff --check` passed. The build retained
  the existing non-failing large-chunk advisory. PLATEAPI-R3-F002,
  PLATEAPI-R3-F003, and PLATEAPI-R3-Q001 were not changed.

#### PLATEAPI-R3-F002-FIX - Restore lookup snapshots outside state updaters

- **Approval basis:** Preserves the approved lookup clear, invalidation,
  restoration, and private-state cleanup scope; it does not change
  PLATEAPI-PLAN-003 requirements.
- **Reviewer evidence:** `clearLookup` calls React Hook Form `setValue` from
  inside the `setSnapshot` functional updater, allowing parent form updates
  while React renders `RegistrationLookup`.
- **Intended outcome:** Restore Make, Model, Year, Engine, and Body from the
  current manual snapshot outside every React state updater, then clear the
  snapshot and lookup provenance without changing Notes, locks, stale-request
  handling, or private-state cleanup.
- **Scope limit:** Do not address PLATEAPI-R3-F003 or the deferred general-
  description question.
- **Status:** Completed.
- **Required validation:** Component regression coverage proving explicit clear
  and lookup invalidation emit no React `console.error` render-phase warning
  without global suppression; focused lookup and affected workflow tests; full
  `npm test`; typecheck; lint; build; diff check.
- **Concrete validation outcome:** Passed 2026-07-22. `clearLookup` reads the
  latest manual snapshot from a stable ref, restores all five approved fields
  directly, then clears the ref, snapshot state, lookup result, selection,
  lookup input, locks, and provider-Year provenance. Notes remain untouched,
  request-generation invalidation is retained, and the stable callback remains
  registered for private-state cleanup. The existing explicit-clear and lookup-
  invalidation scenarios now use test-local, call-through `console.error` spies
  and assert that no warning is emitted. The focused lookup suite passed 1 file
  and 15 tests; affected lookup, workflow, and route suites passed 3 files and
  49 tests; and full Vitest passed 49 files and 699 tests without the reported
  React warning. `npm run typecheck`, `npm run lint`, the production build with
  writable temporary `XDG_CONFIG_HOME`, and staged, unstaged, and combined diff
  checks passed. The full suite retained jsdom's non-failing cross-document
  navigation diagnostic, and the build retained the existing non-failing large-
  chunk advisory. PLATEAPI-R3-F003 and PLATEAPI-R3-Q001 were not changed.

#### PLATEAPI-R3-F003-FIX - Distinguish alternatives by Body

- **Approval basis:** Preserves the approved explicit peer-alternative
  selection and Body mapping scope; it does not change PLATEAPI-PLAN-003
  requirements.
- **Reviewer evidence:** The alternative label includes Year, Make, Model, and
  Engine but omits Body, so otherwise-identical Coupe and Convertible results
  have the same visible and accessible radio name.
- **Intended outcome:** Include Body in the existing stable alternative label
  order so Body-differentiated recommendations are visibly and accessibly
  distinct and retain the existing explicit selection/application behavior.
- **Scope limit:** Do not change compact persisted-Vehicle labels or formatters,
  the deferred general-description question, field mapping, or lookup behavior
  beyond the alternative label.
- **Status:** Completed.
- **Required validation:** RTL coverage with otherwise-identical alternatives
  differentiated only by Body; focused lookup tests; typecheck; lint; build;
  staged, unstaged, and combined diff checks.
- **Concrete validation outcome:** Passed 2026-07-22. Suggestion labels now use
  the stable order Year, Make, Model, Engine, then Body. The RTL regression
  verifies that otherwise-identical Coupe and Convertible recommendations have
  distinct visible text and exact accessible radio names, then selects the
  Convertible recommendation and verifies its Model and Body are applied. The
  focused lookup suite passed 1 file and 15 tests; `npm run typecheck`,
  `npm run lint`, the production build with writable temporary
  `XDG_CONFIG_HOME`, and staged, unstaged, and combined diff checks passed. The
  build retained the existing non-failing large-chunk advisory. Compact saved-
  Vehicle labels and formatters, PLATEAPI-R3-Q001, and the approved revision and
  scope were unchanged.

#### PLATEAPI-R3-F004-FIX - Preserve an untouched persisted text Year while editing

- **Approval basis:** Preserves the approved persisted provider-Year and
  first-edit manual-validation behavior; it does not change PLATEAPI-PLAN-003
  requirements.
- **Reviewer evidence:** `VehicleForm` initializes `providerYearUntouched` as
  false, while the edit screen has no registration lookup. An untouched saved
  Year such as `2018-2021` therefore receives the manual-schema error and blocks
  an unrelated edit.
- **Intended outcome:** On an edit form, accept the exact non-empty initial
  persisted Year until the Year input's first user change. After that first
  change, permanently apply strict manual Year validation for the form session,
  including when the user restores the original text. Keep create forms without
  lookup strict, preserve existing lookup behavior, and treat an empty initial
  Year as manual.
- **Scope limit:** Do not address PLATEAPI-R3-F005, alter lookup mapping or
  clearing, broaden persisted-Year validation, or change the approved database
  contract.
- **Status:** Completed.
- **Required validation:** Workflow/component regressions for saving unrelated
  Body or Notes changes while preserving an untouched persisted range, strict
  manual validation after first edit even when reverted, and an exact persisted
  Year regression; focused form/workflow tests; full `npm test` where practical;
  typecheck; lint; build; staged, unstaged, and combined diff checks.
- **Concrete validation outcome:** Passed 2026-07-22. Edit forms now initialize
  non-manual Year provenance only for a non-empty persisted Year. The existing
  first-change handler permanently switches that form session to strict manual
  validation, including after restoring the original range; create forms and an
  empty initial Year remain manual, while lookup provenance behavior is
  unchanged. The workflow regression saves unrelated Body and Notes changes
  while preserving untouched `2018-2021`, blocks an edited-then-restored range,
  and the existing exact-Year edit regression preserves `2021`. The focused
  workflow and lookup suites passed 2 files and 49 tests; full Vitest passed 49
  files and 701 tests; `npm run typecheck`, `npm run lint`, the production build
  with writable temporary `XDG_CONFIG_HOME`, and staged, unstaged, and combined
  diff checks passed. The full suite retained jsdom's non-failing cross-document
  navigation diagnostic, and the build retained the existing non-failing
  large-chunk advisory. PLATEAPI-R3-F005 remains planned and untouched.

#### PLATEAPI-R3-F005-FIX - Isolate and normalize lookup access-token retrieval

- **Approval basis:** Preserves the approved authenticated lookup and
  app-owned result contract while enforcing the existing Supabase
  infrastructure boundary; it does not change PLATEAPI-PLAN-003 requirements.
- **Reviewer evidence:** `CloudflareVehicleRegistrationLookup` imports
  `getSupabaseClient` and awaits Supabase Auth outside
  `src/infrastructure/supabase/`; that await is also outside the adapter's
  result-normalizing `try`, so a rejection escapes the lookup result contract
  and can leave the lookup UI loading.
- **Intended outcome:** Inject a narrow app-owned access-token provider with its
  Supabase implementation under `src/infrastructure/supabase/auth`, normalize
  retrieval failures into the existing app-owned lookup error, and restore UI
  readiness after rejection.
- **Scope limit:** Do not implement this task in PLATEAPI-R3-F004-FIX or alter
  lookup authorization policy, provider mapping, or Vehicle form behavior.
- **Status:** Completed.
- **Required validation:** Adapter and UI coverage for rejected session
  retrieval and restored lookup readiness; architecture-boundary source checks;
  focused tests; typecheck; lint; build; diff checks.
- **Concrete validation outcome:** Passed 2026-07-22. A narrow app-owned
  access-token result port distinguishes an available token, an absent session,
  and temporary retrieval failure without exposing Supabase types or errors.
  `SupabaseAccessTokenProvider` is contained under
  `src/infrastructure/supabase/auth`, catches rejected session requests, maps
  returned session errors to `temporary_unavailable`, and retains
  `unauthenticated` for a successful response with no session. The Cloudflare
  adapter receives that provider from the app composition root, preserves the
  existing Bearer authorization header, has no Supabase import, and also catches
  an unexpectedly rejecting provider so lookup always resolves an app-owned
  result. Component coverage verifies the safe temporary-unavailable message is
  shown and the lookup button is enabled again after that rejection.

  The focused access-token provider, Cloudflare adapter, Vehicle form, and
  composition suites passed 4 files and 38 tests. Full Vitest passed 50 files
  and 712 tests; `npm run typecheck` and `npm run lint` passed; the production
  build passed with a writable temporary `XDG_CONFIG_HOME` and retained the
  existing non-failing large-chunk advisory; and `npm run test:db` passed both
  pgTAP files and all 137 assertions. Source assertions and a direct search
  found no Supabase client or SDK access outside
  `src/infrastructure/supabase/`. Staged, unstaged, and combined diff checks
  passed. Full Vitest retained jsdom's non-failing cross-document navigation
  diagnostic. The approved revision and scope are unchanged, and
  PLATEAPI-R3-Q001 remains deferred without a code change.

## 9. Completion Conditions

Completion status: completed and senior-review approved on 2026-07-22.

Tasks `PLATEAPI-06` through `PLATEAPI-11` are completed with concrete outcomes;
all required repository and database checks passed; senior review round 3 found
no actionable issues; `PLATEAPI-R3-F001` through `PLATEAPI-R3-F005` are fixed
and verified; and `PLATEAPI-R3-Q001` is explicitly deferred as non-actionable.
The final combined-diff review found no lost approved behavior or unrelated
dirty-worktree change. These results satisfy the completion conditions for
`PLATEAPI-PLAN-003` without changing the approved revision or task contracts.

The following operational risks and follow-up gates remain after repository
completion and do not represent actionable senior-review findings:

- Apply the forward Supabase migration before deploying the application build.
- Configure the Worker's Supabase environment and keep the PlateAPI key in its
  server-only secret configuration.
- Obtain the required privacy acceptance before production enablement.
- Run an authorized live PlateAPI smoke test in the deployed environment.
- Track the existing non-failing client bundle-size advisory.
- Resolve the deferred general `description` display decision separately from
  `PLATEAPI-PLAN-003`.
