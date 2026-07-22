# Service Record Feature

Status: Approved
Date: 2026-07-19
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)
Product: [Product Scope and Language](../product/fullstack-garage-product.md)
Related features: [Authentication and Access](authentication-access.md), [Vehicles](vehicles.md)

## 1. Purpose

The Service Record feature stores the maintenance history for a Vehicle. It
captures when and where maintenance occurred, the Vehicle odometer, who performed
the work, the work completed, inspection findings, parts and consumables used,
their actual Purchase Cost, notes, and the next recommended service.

A Service Record is a maintenance history document, not a commercial billing
document. It must provide the useful mechanical detail normally retained after a
garage visit without customer accounts, labour pricing, markups, commercial
totals, balances, or financial-settlement workflows.

Only the authenticated Garage Admin can create, view, edit, or complete Service
Records in the MVP. Friends whose Vehicles are serviced do not need accounts, and
the Service Record does not store their identity or real-world Vehicle ownership
data.

This document owns Service Record-specific scope, fields, lifecycle, business
rules, presentation behavior, and acceptance criteria. The architecture owns
cross-feature structural decisions, and the product document owns cross-feature
scope and language.

## 2. Feature Decisions

1. Every Service Record belongs to exactly one Vehicle.
2. Only the bootstrapped Garage Admin has Service Record access in the MVP.
3. Service Records have `draft` and `completed` states.
4. Drafts are editable. Completed records are read-only in the MVP so stored
   maintenance history cannot be silently rewritten.
5. Completing a record assigns one immutable Service Record display number.
6. A Service Record and all its items form one aggregate and are saved in one
   transaction.
7. Work performed is stored as structured `work` items rather than as labour
   pricing.
8. Parts, fluids, and consumables may record their actual Purchase Cost. Purchase
   Cost is never presented as a charge to another person.
9. Inspection findings may be recorded without a Purchase Cost.
10. Item order is meaningful and must be preserved.
11. Currency is set once at Service Record level and inherited by all item costs.
12. The Total Parts & Consumables value is calculated from item Purchase Costs and
    is not persisted as mutable record data.
13. Draft saves and completion use optimistic concurrency through `version`.
14. Completed Service Records are not permanently deleted in the MVP.
15. PDF downloads use an immutable, versioned snapshot of the completed record.

## 3. Product Language and Record Boundary

Use maintenance language throughout the feature:

- Service Record
- Service Record Number
- Work Performed
- Parts & Consumables
- Purchase Cost
- Total Parts & Consumables
- Performed By
- Inspection Findings
- Recommendations
- Next Service Due

The feature must not contain commercial billing, customer balance, labour charge,
markup, settlement, or accounts-receivable concepts. The Garage Admin's actual
out-of-pocket Purchase Cost is useful maintenance context; it is not a selling
price or a sum owed by someone else.

## 4. MVP Scope

The MVP includes:

- Creating a draft Service Record for an active Vehicle.
- Listing a Vehicle's Service Record history.
- Viewing a complete Service Record.
- Editing and atomically saving a draft and its ordered items.
- Recording work performed, inspections, parts, fluids, consumables, and other
  maintenance details.
- Recording optional Purchase Costs for eligible items.
- Calculating Total Parts & Consumables.
- Completing a valid draft and assigning its Service Record number.
- Updating the Vehicle's current odometer without silently reducing it.
- Showing historical records for archived Vehicles.
- Creating a versioned snapshot and downloading a branded PDF.

The MVP does not include:

- Member accounts or member-specific Service Record behavior.
- Customer profiles, contact details, or real-world Vehicle owner information.
- Labour pricing, hourly rates, markups, or commercial financial workflows.
- Inventory, supplier catalogue, or purchase-order management.
- Images, attachments, scanned documents, or receipt storage.
- Automated maintenance schedules or reminders.
- Permanently deleting completed Service Records.
- Editing, reopening, or formally amending a completed Service Record.
- Persisting generated PDF files in object storage.
- Multi-currency conversion.

## 5. Service Record Domain Model

A Service Record contains:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Application-owned `ServiceRecordId`. |
| `ownerId` | Yes | Garage Admin's stable app-owned authorization key; never form input. |
| `vehicleId` | Yes | References the Vehicle being serviced. |
| `displayNumber` | Completed only | Assigned once during completion. |
| `status` | Yes | `draft` or `completed`. |
| `serviceDate` | Yes | Calendar date on which the maintenance occurred. |
| `odometer` | Yes | Non-negative whole number in the Vehicle's stored unit. |
| `performedBy` | No | Descriptive name; defaults to the Garage Admin display name. |
| `location` | No | Private descriptive service location. |
| `summary` | No | Concise overview of the maintenance. |
| `notes` | No | Private record-level notes. |
| `nextServiceDueDate` | No | Recommended next service date. |
| `nextServiceDueOdometer` | No | Recommended next odometer in the Vehicle's unit. |
| `currencyCode` | Yes | ISO 4217 code used by every item Purchase Cost; defaults to `AUD`. |
| `items` | Yes | Ordered work, material, inspection, and other items. |
| `version` | Yes | Positive integer used for optimistic concurrency. |
| `createdAt` | Yes | System managed. |
| `updatedAt` | Yes | System managed. |

Application input types must not accept `ownerId`, `displayNumber`, status,
version increments, or timestamps as caller-controlled values. The authenticated
workflow and transactional repository operations own those fields.

Use explicit status and item-kind unions:

```ts
export type ServiceRecordStatus = 'draft' | 'completed';

export type ServiceRecordItemKind =
  | 'work'
  | 'part'
  | 'fluid'
  | 'consumable'
  | 'inspection'
  | 'other';

export type VehicleOdometerDecision =
  | 'advanceToServiceOdometer'
  | 'leaveUnchanged';
```

Dates are calendar-date values, not timestamps. Their exact TypeScript
representation will follow repository-wide domain conventions during
implementation.

## 6. Service Record Items

Every item contains:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Application-owned `ServiceRecordItemId`. |
| `kind` | Yes | One of the explicit `ServiceRecordItemKind` values. |
| `category` | No | Maintenance area such as engine, brakes, cooling, or tyres. |
| `name` | Yes | Work, item, or inspection label after trimming. |
| `brand` | No | Relevant for parts, fluids, and consumables. |
| `specification` | No | Grade, size, standard, or technical specification. |
| `partNumber` | No | Manufacturer or supplier part number. |
| `supplier` | No | Descriptive supplier name. |
| `quantity` | No | Positive decimal quantity. |
| `unit` | No | Unit such as `each`, `L`, or `mL`. |
| `purchaseCostMinor` | No | Total actual Purchase Cost for the line in minor units. |
| `notes` | No | Work detail, inspection result, recommendation, or fitment note. |
| `sortOrder` | Yes | Non-negative integer preserving display order. |

Kind-specific behavior:

- `work` records a maintenance action, such as replacing brake pads or changing
  engine oil. It has no Purchase Cost.
- `part`, `fluid`, and `consumable` record materials used and may include brand,
  specification, part number, supplier, quantity, unit, and Purchase Cost.
- `inspection` records a check and its result or recommendation. It has no
  Purchase Cost.
- `other` is a maintenance detail that does not fit another kind. It has no
  Purchase Cost; purchased materials use `part`, `fluid`, or `consumable`.

The record should use separate items when both work and materials are important.
For example, “Change engine oil” is a `work` item; the oil and filter are `fluid`
and `part` items.

## 7. Purchase Cost and Totals

Purchase Costs are represented as non-negative integer minor units. For AUD,
`7299` represents `$72.99`. Floating-point currency values must not cross the
domain or repository boundary.

`purchaseCostMinor` is the total actual Purchase Cost for its line. Quantity is
descriptive and does not multiply the Purchase Cost automatically in the MVP.
This avoids ambiguity when only part of a purchased pack or fluid container was
used.

The domain calculates:

```text
Total Parts & Consumables = sum of every non-null item Purchase Cost
```

The total is derived when records are displayed or exported. It must not be stored
as a mutable column on `service_records`. A zero Purchase Cost remains distinct
from an unknown or unrecorded Purchase Cost.

## 8. Business Rules

- A new Service Record may be created only for an active Vehicle.
- Historical Service Records remain readable when their Vehicle is archived.
- Service date is required.
- Odometer is required, non-negative, and a whole number.
- The Service Record inherits the Vehicle's odometer unit; the form does not
  select a different unit.
- `performedBy` defaults to the current Garage Admin's app-owned display name but
  remains descriptive maintenance data, not an authorization identity.
- A completed record must contain a non-empty summary or at least one item.
- Every item name is required after trimming.
- Quantity, when present, must be greater than zero.
- Purchase Cost, when present, must be zero or greater and within the supported
  safe integer range.
- `work`, `inspection`, and `other` items must not contain a Purchase Cost.
- All item Purchase Costs inherit the record currency.
- Next service date, when supplied, must be after the service date.
- Next service odometer, when supplied, must be greater than the service
  odometer.
- Item `sortOrder` values must be unique within a record.
- Completion requires the expected current version.
- Completing an already completed record is idempotent and returns the existing
  display number.
- Completed records, display numbers, and their item sets are immutable in the
  MVP.

If the Service Record odometer is lower than the Vehicle's current odometer, the
workflow must require explicit confirmation and leave the Vehicle value unchanged.
If it is higher, completion may advance the Vehicle current odometer inside the
same transaction. It must never reduce the Vehicle value automatically.

## 9. Lifecycle and Application Use Cases

The primary flow is:

1. The Garage Admin selects an active Vehicle.
2. The application creates or opens a draft.
3. The Garage Admin enters service details and ordered items.
4. `saveServiceRecordDraft` atomically saves the header and complete current item
   set using the expected version.
5. The application displays the derived Total Parts & Consumables.
6. `completeServiceRecord` validates the aggregate, assigns the display number,
   preserves item order, and optionally advances the Vehicle odometer in one
   transaction.
7. The completed record appears in the Vehicle Service History and may be
   downloaded as a branded PDF.

The application layer should expose:

- `listServiceRecordsForVehicle`
- `getServiceRecord`
- `saveServiceRecordDraft`
- `completeServiceRecord`
- `createServiceRecordSnapshot`
- `downloadServiceRecordPdf`

Use cases obtain the current Garage Admin from the application authentication
workflow. They do not accept caller-provided owner IDs, roles, display numbers, or
version increments.

## 10. Repository and Renderer Ports

The repository stays business-oriented:

```ts
export interface ServiceRecordRepository {
  getById(id: ServiceRecordId): Promise<ServiceRecord | null>;
  listForVehicle(vehicleId: VehicleId): Promise<ServiceRecordSummary[]>;
  saveDraft(input: SaveServiceRecordDraft): Promise<ServiceRecord>;
  complete(
    id: ServiceRecordId,
    expectedVersion: number,
    odometerDecision: VehicleOdometerDecision,
  ): Promise<ServiceRecord>;
}
```

`SaveServiceRecordDraft` contains the expected current version and the entire
ordered item set. The repository must return app-owned models and errors rather
than Supabase rows, query builders, RPC payloads, or database error codes.

PDF rendering uses a separate provider-neutral port:

```ts
export interface ServiceRecordPdfRenderer {
  render(snapshot: ServiceRecordSnapshot): Promise<Blob>;
}
```

The composition root selects the Supabase repository and client-side PDF renderer
for the MVP. Feature code must not select adapters or inspect provider settings.

## 11. Persistence and Transaction Boundaries

The architecture's `service_records` table stores:

- The app-owned owner and Vehicle relationship.
- Draft or completed status.
- Service date, odometer, performer, location, summary, and notes.
- Next-service recommendations.
- Record-level currency.
- Immutable display number after completion.
- Optimistic concurrency version and system timestamps.

The `service_items` table stores the ordered item set. Its `kind` constraint must
include `work`, `part`, `fluid`, `consumable`, `inspection`, and `other`.

Persistence requires:

- A composite foreign key from `(vehicle_id, owner_id)` to
  `vehicles(id, owner_id)`.
- A unique constraint on `(owner_id, display_number)` when a display number is
  present.
- An index supporting Vehicle history ordered by service date descending.
- Constraints for status, currency format, non-negative odometers, positive
  versions, non-negative Purchase Costs, positive quantities, and non-negative
  item ordering.
- A unique constraint on `(service_record_id, sort_order)`.
- Atomic replacement of the exact draft item set while completed records and
  their items remain immutable.

`saveDraft` must execute as one PostgreSQL function called through the Supabase
adapter. It resolves the current Garage Admin, verifies the Vehicle is active,
checks the expected version, validates the aggregate, saves the record and exact
item set, increments the version, and returns the updated app-owned aggregate.

`complete` must lock the draft, resolve and verify Garage Admin authorization,
check the expected version, validate completion rules, allocate the display
number, mark the aggregate completed, increment the version, and apply the chosen
Vehicle odometer behavior in the same transaction. Retrying completion must not
allocate another display number.

## 12. Authorization, Privacy, and Errors

- Every operation requires the current Garage Admin established by the
  Authentication and Access feature.
- RLS permits the Garage Admin to manage every Service Record and its items.
- A mapped non-admin, an unmapped authenticated identity, and an unauthenticated
  user receive no Service Record data.
- Item access is authorized through the parent Service Record.
- Callers cannot choose an owner ID, role, or display number.
- Security-definer functions use a fixed safe search path and minimum privileges.
- Service location, Vehicle registration and VIN, odometer, notes, supplier, part
  number, and Purchase Cost are private data and are excluded from logs and
  analytics by default.
- Raw Supabase errors, table names, function names, and provider payloads must not
  reach feature code or the UI.

Infrastructure failures map to app-owned outcomes including not found,
unauthorized, validation, version conflict, inactive Vehicle, record not editable,
and temporarily unavailable. The UI must offer safe reload and retry paths for
recoverable failures.

## 13. Presentation Behavior

The editor is organized into clear maintenance sections:

1. Vehicle and Service Details
2. Work Performed
3. Parts & Consumables
4. Inspections and Recommendations
5. Next Service Due
6. Notes

Presentation requirements:

- The selected Vehicle identity and odometer unit remain visible while editing.
- Draft and completed states use compact status badges.
- The item editor supports add, edit, remove, and reorder actions for drafts.
- Item fields adapt to their kind so irrelevant cost or part fields are not shown.
- Total Parts & Consumables is visible near the item list and completion action.
- Completion presents a clear review step and warns that the record becomes
  read-only.
- A lower Service Record odometer triggers an explicit confirmation explaining
  that the Vehicle odometer will remain unchanged.
- Completed records emphasize maintenance history and technical details rather
  than financial totals.
- Archived Vehicles expose their history but do not offer a new-record action.
- On narrow screens, item rows collapse into readable stacked sections while
  retaining their order and primary actions.

UI implementation must use tokens from `src/styles/global.css` and follow
`DESIGN.md`: near-black and light editorial surfaces, sharp card and button
geometry, the named spacing ladder, FerrariSans typography, and scarce Rosso
Corsa reserved for the primary action. Lucide icons accompany icon-only actions.

## 14. PDF Snapshot and Download

Only a completed Service Record may be downloaded as the canonical branded PDF.
The application converts the saved aggregate to a versioned
`ServiceRecordSnapshot` before rendering.

The snapshot contains:

- Snapshot schema version and PDF template version.
- Service Record UUID, display number, status, and record version.
- Service and generation dates.
- Vehicle make, model, year, registration, registration state, VIN, engine, and
  odometer unit as available at generation time.
- Service odometer, performer, location, summary, notes, and next-service details.
- Ordered work, material, inspection, and other items.
- Each recorded Purchase Cost, derived Total Parts & Consumables, and currency.
- Brand information and generation timestamp.

The PDF title and number identify it as a Service Record. It uses maintenance
language and does not present customer identity, labour pricing, commercial
totals, balances, or settlement instructions.

The MVP renders and downloads the PDF in the browser without persistent file
storage. A future authoritative export may persist the immutable snapshot, file,
template version, checksum, generation time, and creating app-user ID through the
existing provider-neutral storage boundary.

## 15. Verification Strategy

Unit tests should cover:

- Required service date and odometer validation.
- Draft and completed state rules.
- Completion requiring a summary or item.
- Item-kind narrowing and kind-specific Purchase Cost rules.
- Item name, quantity, cost, and ordering validation.
- Integer minor-unit Purchase Cost totals.
- Next-service date and odometer validation.
- Vehicle odometer advance and lower-reading confirmation decisions.
- Snapshot mapping and preservation of item order.

Repository contract tests should cover:

- Draft creation and updates with the complete aggregate.
- Atomic replacement of ordered items.
- Version increments and stale-version conflicts.
- Completion validation and display-number allocation.
- Idempotent completion retries.
- Completed-record immutability.
- Active-Vehicle creation rules and archived-Vehicle history reads.
- Garage Admin access and app-owned error mapping.

RLS and database integration tests must exercise the Garage Admin, a mapped
non-admin identity, an authenticated but unmapped identity where supported, and
an unauthenticated user. They must also test transaction rollback, concurrent
draft saves, concurrent completion, composite Vehicle ownership, and item access
through the parent record.

End-to-end coverage should create a Vehicle, save and refresh a draft, add and
reorder items, observe a stale-version conflict, complete the record, verify it in
Vehicle Service History, refresh the page, and download the PDF.

## 16. Acceptance Criteria

- The Garage Admin can create a draft for an active Vehicle.
- A draft atomically persists its details and complete ordered item set.
- Work performed, materials used, inspections, recommendations, and next-service
  information can be represented without commercial billing concepts.
- Eligible item Purchase Costs use integer minor units and produce the correct
  Total Parts & Consumables.
- The UI never presents Purchase Cost as money owed by another person.
- Stale updates return an app-owned conflict without overwriting newer data.
- Completing a valid draft assigns one stable Service Record number.
- Completion is idempotent and completed records are read-only.
- Vehicle odometer behavior follows the explicit lower-reading rule and never
  silently reduces the Vehicle value.
- Archived Vehicle history remains readable, but new records require an active
  Vehicle.
- The Garage Admin can access every Service Record through server-enforced
  authorization; every other identity state is denied.
- Sign-out and identity changes clear cached Service Record data.
- A completed Service Record produces a branded, versioned PDF snapshot.
- Feature, domain, and application code remain independent of Supabase types and
  provider errors.

## 17. Open Decisions

The following decisions remain before implementation:

1. The Service Record display-number format and sequence reset policy.
2. Field length limits for summary, performer, location, notes, item names,
   specifications, suppliers, part numbers, and recommendations.
3. Whether item categories use a fixed list, free text, or suggested values with
   custom entry.
4. Which ISO currencies are selectable in addition to the default `AUD`.
5. Whether location should default from a Garage Admin profile setting in a later
   feature.
6. The future amendment model for correcting a completed Service Record while
   preserving a visible audit history.

## 18. Review History

Append a new row for every approved update. Existing review entries must remain
unchanged so the decision history is preserved.

| Date | Status | Reviewed by | Summary |
| --- | --- | --- | --- |
| 2026-07-19 | Approved | Product owner | Approved the MVP Service Record design for structured maintenance history, Purchase Costs, atomic drafts, immutable completion, and branded PDF snapshots. |
