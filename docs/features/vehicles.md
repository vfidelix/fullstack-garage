# Vehicle Feature

Status: Decision-complete draft
Date: 2026-07-19
Architecture: [Fullstack Garage Architecture](../architecture/fullstack-garage-architecture.md)
Product: [Product Scope and Language](../product/fullstack-garage-product.md)
Related features: [Authentication and Access](authentication-access.md), [Service Records](service-records.md)

## 1. Purpose

The Vehicle feature lets the authenticated Garage Admin manage every Vehicle
serviced by the garage. A Vehicle is the ownership and history anchor for the
Service Record feature: a Service Record cannot exist without an accessible
Vehicle.

For the MVP, Fullstack Garage represents a mechanic-operated personal garage. The
Garage Admin may record work performed on their own Vehicles and on friends'
Vehicles. Friends do not need application accounts, and the application does not
store their identity or real-world Vehicle ownership details.

This document owns Vehicle-specific scope, fields, lifecycle, business rules,
presentation behavior, and acceptance criteria. The architecture owns
cross-feature structural decisions, and the product document owns cross-feature
scope and language.

## 2. Agreed Decisions

1. Each Vehicle records its odometer unit as either kilometres or miles.
2. A Vehicle without Service Records may be permanently deleted.
3. A Vehicle with Service Records must be archived instead of deleted.
4. Archived Vehicles remain available to historical Service Records but are
   excluded from normal Vehicle selection.
5. An archived Vehicle may be restored.
6. Authentication, application-user provisioning, roles, and session behavior
   are owned by the Authentication and Access feature.
7. Only the bootstrapped Garage Admin has application access in the MVP.
8. The Garage Admin may manage all Vehicles and Service Records.
9. Member accounts and member-specific behavior are outside the MVP.
10. The application does not store a Vehicle's legal or real-world owner.
11. Friends without accounts have no application access in the MVP.
12. Supported Vehicle years are fixed at 1900 through 9999 inclusive.
13. Make, model, registration, VIN, and engine accept at most 50 characters;
    notes accept at most 500 characters.
14. A new Vehicle form defaults the odometer unit to kilometres (`km`).
15. Compact Vehicle labels use make and model, with year prepended when present
    and registration appended after ` · ` when present. When a registration
    state is present, it is displayed with the registration.
16. Duplicate-looking Vehicles are accepted. The UI shows a non-blocking warning
    when another active or archived Vehicle has the same make, model,
    registration, and registration state after capitalization and spaces are
    ignored. Missing registration and registration state values match other
    missing values, and the current Vehicle is excluded when editing.

## 3. Operating Model

| Actor | Vehicle access | Service Record access |
| --- | --- | --- |
| Garage Admin | Manage all Vehicles | Manage all Service Records |
| Friend without an account | No application access | No application access |
| Unauthenticated or unauthorized identity | No application access | No application access |

The Garage Admin is the mechanic and operator of this Fullstack Garage instance.
The database `owner_id` remains the application-owned authorization and data
relationship required by the architecture; it is not real-world ownership data
and is never entered through a Vehicle form. Every Vehicle created in the MVP uses
the Garage Admin's stable `AppUserId` as `owner_id`.

This is a single-garage authorization model. Multi-garage tenancy and business
accounts remain outside the MVP.

## 4. MVP Scope

The MVP includes:

- Listing all active Vehicles for the Garage Admin.
- Creating a Vehicle.
- Viewing and editing a Vehicle.
- Permanently deleting a Vehicle that has no Service Records.
- Archiving and restoring a Vehicle.
- Viewing archived Vehicles separately from the active list.
- Supplying an active Vehicle selection to the Service Record workflow.

The MVP does not include:

- Shared or jointly owned Vehicles.
- Fleet or business account management.
- Legal or real-world Vehicle owner data.
- Customer profiles, contact management, member accounts, or friend login access.
- Vehicle data lookup by VIN.
- Vehicle data lookup by registration, which is owned by the
  [PlateAPI Vehicle Prefill](plateapi-vehicle-prefill.md) feature.
- Odometer conversion between kilometres and miles.
- Vehicle images, documents, or receipt storage.
- Automated service reminders.

## 5. Domain Model

A Vehicle contains:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Application-owned `VehicleId`. |
| `ownerId` | Yes | Stable app-owned authorization key derived from the Garage Admin identity. |
| `make` | Yes | Trimmed, non-empty text; maximum 50 characters. |
| `model` | Yes | Trimmed, non-empty text; maximum 50 characters. |
| `year` | No | Integer from 1900 through 9999 inclusive. |
| `registration` | No | Private data; not globally unique; maximum 50 characters. |
| `registrationState` | No | Australian registration state or territory code: `ACT`, `NSW`, `NT`, `QLD`, `SA`, `TAS`, `VIC`, or `WA`. |
| `vin` | No | Private data; not globally unique; maximum 50 characters. |
| `currentOdometer` | No | A non-negative whole number. |
| `odometerUnit` | Yes | `km` or `mi`. |
| `engine` | No | Free-text engine description; maximum 50 characters. |
| `notes` | No | Private free text; maximum 500 characters. |
| `archivedAt` | No | When present, the Vehicle is archived. |
| `createdAt` | Yes | System managed. |
| `updatedAt` | Yes | System managed. |

Normal application input types must not accept `ownerId`, timestamps, or archival
state from forms. Those values are set by the authenticated workflow or the
repository. Any future reassignment workflow must be a separate, explicit use
case.

The domain should use explicit unions for constrained values rather than
unrestricted strings:

```ts
export type OdometerUnit = 'km' | 'mi';

export type AustralianRegistrationState =
  | 'ACT'
  | 'NSW'
  | 'NT'
  | 'QLD'
  | 'SA'
  | 'TAS'
  | 'VIC'
  | 'WA';
```

## 6. Business Rules

- Make and model are required after trimming whitespace.
- Year, when supplied, must be an integer from 1900 through 9999 inclusive.
- Make, model, registration, VIN, and engine must not exceed 50 characters;
  notes must not exceed 500 characters.
- Registration state, when supplied, must be one of `ACT`, `NSW`, `NT`, `QLD`,
  `SA`, `TAS`, `VIC`, or `WA`.
- Current odometer, when supplied, must be zero or greater and contain no
  fractional value.
- Registration, registration state, and VIN are optional and are not uniqueness
  keys.
- Duplicate-looking Vehicles remain valid and may be saved. Duplicate comparison
  ignores capitalization and spaces in make, model, registration, and
  registration state; missing registration and registration state values compare
  as the same missing value. The comparison spans active and archived Vehicles
  and excludes the Vehicle currently being edited.
- Vehicle access requires the authenticated Garage Admin established by the
  Authentication and Access feature.
- The Garage Admin may manage every Vehicle.
- Archiving does not remove or alter Service Records.
- Permanent deletion succeeds only when the Vehicle has no Service Records.
- A Vehicle must be active before a new Service Record can be created for it.
- Historical Service Records remain readable when their Vehicle is archived.
- Changing the odometer unit after Service Records exist is not allowed because
  it would change the meaning of historical readings. No automatic unit
  conversion is performed.
- A Service Record odometer must not silently reduce `currentOdometer`. The
  Service Record workflow will define the confirmation and update behavior.

## 7. Application Use Cases

The application layer should expose business workflows rather than database
operations:

- `listActiveVehicles`
- `listArchivedVehicles`
- `getVehicle`
- `createVehicle`
- `updateVehicle`
- `archiveVehicle`
- `restoreVehicle`
- `deleteVehicle`

Once Service Record persistence exists, `deleteVehicle` must return an app-owned
conflict error when history exists. The UI can then offer archiving without
interpreting a database foreign-key or Supabase error. That error path is part of
the deferred integration described in Section 9, not the initial Vehicle
delivery.

Use cases obtain the current app-owned user from the application authentication
workflow. Owner IDs must not be accepted as untrusted authorization input.

## 8. Repository Port

The exact TypeScript types will be finalized during implementation, but the port
should have this business-oriented shape:

```ts
export interface VehicleRepository {
  listActive(): Promise<VehicleSummary[]>;
  listArchived(): Promise<VehicleSummary[]>;
  getById(id: VehicleId): Promise<Vehicle | null>;
  create(input: CreateVehicle): Promise<Vehicle>;
  update(id: VehicleId, input: UpdateVehicle): Promise<Vehicle>;
  archive(id: VehicleId): Promise<Vehicle>;
  restore(id: VehicleId): Promise<Vehicle>;
  delete(id: VehicleId): Promise<void>;
}
```

The repository returns application-owned models and errors. It must not expose
Supabase rows, query builders, error codes, table names, or arbitrary database
filters. List and mutation results contain the Vehicles authorized for the Garage
Admin by server-enforced policies.

## 9. Persistence

The Authentication and Access feature owns the `app_users`, `user_identities`,
role, and Garage Admin provisioning schema. The Vehicle feature depends only on
the stable app-owned `AppUserId` that authentication supplies.

The `vehicles` table defined by the architecture requires these additions:

- `odometer_unit text not null default 'km'`
- `registration_state text`
- `archived_at timestamptz`
- A check constraint limiting `odometer_unit` to `km` or `mi`.
- A check constraint limiting `registration_state` to `ACT`, `NSW`, `NT`, `QLD`,
  `SA`, `TAS`, `VIC`, or `WA` when present.

The table also requires:

- Check constraints for the supported year and approved field lengths.
- A non-negative check constraint for `current_odometer`.
- An index on `owner_id` for owner-scoped lists.
- An index that supports active owner-scoped lists, where `archived_at` is null.
- A uniqueness constraint on `(id, owner_id)` so Service Records can use the
  architecture's composite foreign key.

Deletion must be rejected when related Service Records exist. The foreign key
must not cascade from a Vehicle to its Service Records.

The initial Vehicle delivery precedes Service Record persistence. It creates the
Vehicle schema without a placeholder Service Record table and therefore cannot
yet enforce or exercise history-dependent delete blocking or odometer-unit
locking. The later Service Record persistence migration must add the composite
foreign key without delete cascade and atomically introduce both history checks.
Until then, every persisted Vehicle has no representable Service Record history,
so permanent deletion and odometer-unit changes remain available. This deferral
must not be reported as completed history enforcement.

Database schema, constraints, indexes, and RLS policies must be introduced in a
versioned Supabase migration.

## 10. Authorization and Privacy

- Every repository operation requires the current Garage Admin identity supplied
  by the application authentication workflow.
- Callers never provide an owner ID for authorization.
- RLS permits a Garage Admin to manage all Vehicles and Service Records.
- Unauthenticated and unauthorized identities receive no Vehicle data.
- Registration, VIN, odometer, engine details, and notes must not be included in
  logs or analytics payloads by default.
- Archive eligibility and current deletion authorization must be enforced by the
  database or an atomic database function, not only by a prior UI check. The
  later Service Record integration must add the atomic history-dependent delete
  and odometer-unit checks described in Section 9.
- RLS uses the stable current-user and Garage Admin role helpers supplied by the
  Authentication and Access feature.
- Garage Admin authorization must never expose or depend on a Supabase
  service-role key in the SPA.

## 11. Presentation Behavior

- The default Vehicle list shows active Vehicles only.
- The Garage Admin sees all Vehicles across the garage.
- Archived Vehicles are presented in a separate view or explicit filter.
- Archived Vehicles cannot be selected when creating a Service Record.
- The delete action explains that it is permanent.
- Once Service Record persistence exists, a deletion blocked by history offers
  the archive action and an odometer-unit change is disabled with a clear
  explanation. These two states are deferred from the initial Vehicle delivery
  under Section 9.
- A new Vehicle form defaults its odometer unit to kilometres.
- Compact labels render as `2021 Ferrari Roma · ABC 123 WA`,
  `2021 Ferrari Roma · ABC 123`, `2021 Ferrari Roma`, `Ferrari Roma · ABC 123
  WA`, `Ferrari Roma · ABC 123`, or `Ferrari Roma` according to which optional
  year, registration, and registration state values are present.
- A matching active or archived Vehicle produces a non-blocking duplicate
  warning but never prevents saving.
- Forms mirror domain validation for immediate feedback, while repositories and
  database constraints remain authoritative.

Detailed layout and styling must follow the root `DESIGN.md` when UI work begins.

## 12. Service Record Dependency

The Vehicle feature is ready to enable Service Records when it can provide:

- A stable `VehicleId` and the Garage Admin's app-owned data relationship.
- An active-Vehicle list for Service Record creation.
- Vehicle make, model, year, registration, registration state, VIN, odometer
  unit, and engine details for history displays and export snapshots.
- A database-level ownership relationship from Service Records to Vehicles.
- A lifecycle that preserves Vehicles referenced by historical records.
- Server-enforced access that lets the Garage Admin manage all Service Records.

The Service Record design must preserve the meaning of odometer readings and PDF
snapshots even if editable Vehicle details later change.

The Service Record persistence delivery also owns completing the deferred
cross-feature integration: add the non-cascading composite foreign key, reject
deletion when history exists, reject odometer-unit changes when history exists,
surface those app-owned conflict/eligibility states through the Vehicle
repository, and add database, repository, and UI coverage for both behaviors.

`performedBy` remains descriptive Service Record data and should default to the
Garage Admin's display name when the Garage Admin creates a record. It is not a
substitute for authorization or audit identity.

## 13. Verification Strategy

Unit tests should cover:

- Required make and model validation.
- The 1900 and 9999 year boundaries and rejected values outside them.
- Approved field-length boundaries.
- Supported odometer units.
- Supported Australian registration state codes and rejected unsupported codes.
- Non-negative whole-number odometers.
- Active and archived state behavior.
- Compact label fallbacks.
- Duplicate comparison ignoring capitalization and spaces, including missing
  registration, missing registration state, and current-Vehicle exclusion.
- Vehicle creation input excluding `ownerId` and authentication data.

Repository contract tests should cover:

- Create, read, update, active list, and archived list behavior.
- Archive and restore behavior.
- Permanent deletion without Service Records.
- Non-blocking duplicate lookup across active and archived Vehicles.
- Garage Admin access to all stored Vehicles and app-owned error mapping.

Rejected deletion with Service Records and rejected odometer-unit changes after
history exists are deferred to the Service Record persistence integration
described in Sections 9 and 12.

RLS integration tests must exercise the Garage Admin, a mapped non-admin identity,
an authenticated but unmapped identity where supported, and an unauthenticated
user for every operation.

## 14. Resolved Decisions

Resolved on 2026-07-20:

1. Supported Vehicle years are the fixed inclusive range 1900 through 9999.
2. Make, model, registration, VIN, and engine accept at most 50 characters;
   notes accept at most 500 characters.
3. `km` is the new-Vehicle form default as well as the database default.
4. Compact labels use the four exact optional-field forms documented in Section
   11.
5. Duplicate-looking Vehicles are accepted with a non-blocking warning under the
   exact comparison rule documented in Sections 2 and 6.
6. Vehicle persistence is delivered before Service Record persistence. No
   placeholder Service Record schema is created; history-dependent deletion and
   odometer-unit enforcement remains explicit deferred Service Record integration
   work.

Resolved on 2026-07-21:

7. Vehicles may store an optional Australian registration state or territory code
   to support registration lookup and clearer registration display.
