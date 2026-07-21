begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(80);

create function pg_temp.sqlstate_for(p_statement text)
returns text
language plpgsql
as $$
begin
  execute p_statement;
  return null;
exception
  when others then
    return sqlstate;
end;
$$;

insert into public.app_users (id, display_name, role)
values
  ('21000000-0000-4000-8000-000000000001', 'Synthetic Vehicle Admin', 'admin'),
  ('21000000-0000-4000-8000-000000000002', 'Synthetic Vehicle Member', 'member');

insert into public.user_identities (
  id,
  user_id,
  provider,
  provider_subject
)
values
  (
    '22000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    'supabase',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000002',
    'supabase',
    '20000000-0000-4000-8000-000000000002'
  );

insert into public.vehicles (
  id,
  owner_id,
  make,
  model,
  year,
  registration,
  registration_state,
  vin,
  current_odometer,
  odometer_unit,
  engine,
  notes,
  archived_at
)
values
  (
    '23000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    'Synthetic Make',
    'Active Model',
    2024,
    'SYN ACTIVE',
    'WA',
    'SYNTHETIC-VIN-ACTIVE',
    12000,
    'km',
    'Synthetic Engine',
    'Synthetic active fixture',
    null
  ),
  (
    '23000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000001',
    'Synthetic Make',
    'Archived Model',
    2023,
    'SYN ARCHIVE',
    null,
    null,
    8000,
    'mi',
    null,
    null,
    statement_timestamp()
  );

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select extensions.is(
  (select count(*)::integer from public.vehicles where archived_at is null),
  1,
  'mapped admin can list active Vehicles'
);
select extensions.is(
  (select count(*)::integer from public.vehicles where archived_at is not null),
  1,
  'mapped admin can list archived Vehicles separately'
);
select extensions.is(
  (
    select model
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000001'
  ),
  'Active Model'::text,
  'mapped admin can get one Vehicle'
);
select extensions.is(
  (
    select registration_state
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000001'
  ),
  'WA'::text,
  'mapped admin can read persisted registration state'
);
select extensions.is(
  (
    select registration_state
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000002'
  ),
  null::text,
  'existing compatible Vehicles may omit registration state'
);

insert into public.vehicles (make, model, registration_state)
values (
  'Created Make',
  'Created Model',
  'NSW'
);

select extensions.ok(
  (
    select owner_id
      = '21000000-0000-4000-8000-000000000001'::uuid
      and registration_state = 'NSW'
    from public.vehicles
    where make = 'Created Make'
      and model = 'Created Model'
  ),
  'mapped admin can create a Vehicle with registration state and caller-owned ownership'
);

update public.vehicles
set model = 'Updated Model',
  registration_state = 'VIC'
where make = 'Created Make'
  and model = 'Created Model';

select extensions.ok(
  (
    select model = 'Updated Model'
      and registration_state = 'VIC'
    from public.vehicles
    where make = 'Created Make'
      and model = 'Updated Model'
  ),
  'mapped admin can update a Vehicle registration state'
);
select extensions.ok(
  (
    select archived_at is not null
    from public.archive_vehicle((
      select id
      from public.vehicles
      where make = 'Created Make'
        and model = 'Updated Model'
    ))
  ),
  'mapped admin can archive an active Vehicle atomically'
);
select extensions.ok(
  (
    select archived_at is null
    from public.restore_vehicle((
      select id
      from public.vehicles
      where make = 'Created Make'
        and model = 'Updated Model'
    ))
  ),
  'mapped admin can restore an archived Vehicle atomically'
);

delete from public.vehicles
where make = 'Created Make'
  and model = 'Updated Model';

select extensions.is(
  (
    select count(*)::integer
    from public.vehicles
    where make = 'Created Make'
      and model = 'Updated Model'
  ),
  0,
  'mapped admin can permanently delete a current Vehicle'
);

select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model)
      values (
        '21000000-0000-4000-8000-000000000002',
        'Injected Owner Make',
        'Injected Owner Model'
      )
    $statement$
  ),
  '42501'::text,
  'caller-supplied owner cannot expand create access'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (id, make, model)
      values (
        '23000000-0000-4000-8000-000000000004',
        'Injected ID Make',
        'Injected ID Model'
      )
    $statement$
  ),
  '42501'::text,
  'caller-supplied ID is rejected on create'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (make, model, archived_at)
      values ('Injected Archive Make', 'Injected Archive Model', now())
    $statement$
  ),
  '42501'::text,
  'caller-supplied archive state is rejected on create'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (make, model, created_at)
      values ('Injected Time Make', 'Injected Time Model', now())
    $statement$
  ),
  '42501'::text,
  'caller-supplied creation time is rejected on create'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      update public.vehicles
      set owner_id = '21000000-0000-4000-8000-000000000002'
      where id = '23000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501'::text,
  'caller-supplied owner cannot expand update access'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      update public.vehicles
      set archived_at = now()
      where id = '23000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501'::text,
  'caller cannot bypass the archive RPC through the table'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      update public.vehicles
      set updated_at = now()
      where id = '23000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501'::text,
  'caller-supplied update time is rejected'
);

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select extensions.is(
  (select count(*)::integer from public.vehicles where archived_at is null),
  0,
  'mapped non-admin cannot list active Vehicles'
);
select extensions.is(
  (select count(*)::integer from public.vehicles where archived_at is not null),
  0,
  'mapped non-admin cannot list archived Vehicles'
);
select extensions.is(
  (
    select count(*)::integer
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000001'
  ),
  0,
  'mapped non-admin cannot get a Vehicle'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (make, model)
      values ('Member Create Make', 'Member Create Model')
    $statement$
  ),
  '42501'::text,
  'mapped non-admin cannot create a Vehicle'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      update public.vehicles
      set model = 'Member Update Model'
      where id = '23000000-0000-4000-8000-000000000001'
    $statement$
  ),
  null::text,
  'mapped non-admin update cannot reach a Vehicle row'
);

reset role;

select extensions.is(
  (
    select model
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000001'
  ),
  'Active Model'::text,
  'mapped non-admin update leaves the protected Vehicle row unchanged'
);

set local role authenticated;

select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      select *
      from public.archive_vehicle('23000000-0000-4000-8000-000000000001')
    $statement$
  ),
  '42501'::text,
  'mapped non-admin cannot invoke archive behavior'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      select *
      from public.restore_vehicle('23000000-0000-4000-8000-000000000002')
    $statement$
  ),
  '42501'::text,
  'mapped non-admin cannot invoke restore behavior'
);

delete from public.vehicles
where id = '23000000-0000-4000-8000-000000000001';

select extensions.is(
  (select count(*)::integer from public.vehicles),
  0,
  'mapped non-admin delete cannot reach a Vehicle row'
);

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;

select extensions.is(
  (select count(*)::integer from public.vehicles where archived_at is null),
  0,
  'authenticated unmapped identity cannot list active Vehicles'
);
select extensions.is(
  (select count(*)::integer from public.vehicles where archived_at is not null),
  0,
  'authenticated unmapped identity cannot list archived Vehicles'
);
select extensions.is(
  (
    select count(*)::integer
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000001'
  ),
  0,
  'authenticated unmapped identity cannot get a Vehicle'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (make, model)
      values ('Unmapped Create Make', 'Unmapped Create Model')
    $statement$
  ),
  '42501'::text,
  'authenticated unmapped identity cannot create a Vehicle'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      update public.vehicles
      set model = 'Unmapped Update Model'
      where id = '23000000-0000-4000-8000-000000000001'
    $statement$
  ),
  null::text,
  'authenticated unmapped identity update cannot reach a Vehicle row'
);

reset role;

select extensions.is(
  (
    select model
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000001'
  ),
  'Active Model'::text,
  'authenticated unmapped identity update leaves the protected Vehicle row unchanged'
);

set local role authenticated;

select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      select *
      from public.archive_vehicle('23000000-0000-4000-8000-000000000001')
    $statement$
  ),
  '42501'::text,
  'authenticated unmapped identity cannot invoke archive behavior'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      select *
      from public.restore_vehicle('23000000-0000-4000-8000-000000000002')
    $statement$
  ),
  '42501'::text,
  'authenticated unmapped identity cannot invoke restore behavior'
);

delete from public.vehicles
where id = '23000000-0000-4000-8000-000000000001';

select extensions.is(
  (select count(*)::integer from public.vehicles),
  0,
  'authenticated unmapped identity delete cannot reach a Vehicle row'
);

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
set local role anon;

select extensions.is(
  pg_temp.sqlstate_for('select * from public.vehicles where archived_at is null'),
  '42501'::text,
  'unauthenticated caller cannot list active Vehicles'
);
select extensions.is(
  pg_temp.sqlstate_for('select * from public.vehicles where archived_at is not null'),
  '42501'::text,
  'unauthenticated caller cannot list archived Vehicles'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      select *
      from public.vehicles
      where id = '23000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501'::text,
  'unauthenticated caller cannot get a Vehicle'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (make, model)
      values ('Anonymous Create Make', 'Anonymous Create Model')
    $statement$
  ),
  '42501'::text,
  'unauthenticated caller cannot create a Vehicle'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      update public.vehicles
      set model = 'Anonymous Update Model'
      where id = '23000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501'::text,
  'unauthenticated caller cannot update a Vehicle'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      select *
      from public.archive_vehicle('23000000-0000-4000-8000-000000000001')
    $statement$
  ),
  '42501'::text,
  'unauthenticated caller cannot invoke archive RPC'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      select *
      from public.restore_vehicle('23000000-0000-4000-8000-000000000002')
    $statement$
  ),
  '42501'::text,
  'unauthenticated caller cannot invoke restore RPC'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      delete from public.vehicles
      where id = '23000000-0000-4000-8000-000000000001'
    $statement$
  ),
  '42501'::text,
  'unauthenticated caller cannot delete a Vehicle'
);

reset role;

select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model)
      values (
        '21999999-0000-4000-8000-000000000099',
        'Constraint Make',
        'Constraint Model'
      )
    $statement$
  ),
  '23503'::text,
  'owner foreign-key constraint rejects an unknown app user'
);
select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.vehicles'::regclass
      and conname = 'vehicles_id_owner_id_key'
      and contype = 'u'
  ),
  'composite Vehicle and owner uniqueness constraint is installed'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model)
      values (
        '21000000-0000-4000-8000-000000000001',
        '   ',
        'Constraint Model'
      )
    $statement$
  ),
  '23514'::text,
  'make must not be blank'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model)
      values (
        '21000000-0000-4000-8000-000000000001',
        repeat('M', 51),
        'Constraint Model'
      )
    $statement$
  ),
  '23514'::text,
  'make cannot exceed 50 characters'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        E'\t  '
      )
    $statement$
  ),
  '23514'::text,
  'model must not be blank'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        repeat('M', 51)
      )
    $statement$
  ),
  '23514'::text,
  'model cannot exceed 50 characters'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, year)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        1899
      )
    $statement$
  ),
  '23514'::text,
  'year cannot be below 1900'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, year)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        10000
      )
    $statement$
  ),
  '23514'::text,
  'year cannot exceed 9999'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, registration)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        repeat('R', 51)
      )
    $statement$
  ),
  '23514'::text,
  'registration cannot exceed 50 characters'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, registration_state)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        'NZ'
      )
    $statement$
  ),
  '23514'::text,
  'registration state must be an approved Australian code'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, registration_state)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        'wa'
      )
    $statement$
  ),
  '23514'::text,
  'registration state rejects lowercase codes'
);
insert into public.vehicles (owner_id, make, model, registration_state)
select
  '21000000-0000-4000-8000-000000000001',
  'Allowed State Make',
  'Allowed State ' || code,
  code
from unnest(array['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']) as code;

select extensions.is(
  (
    select count(*)::integer
    from public.vehicles
    where make = 'Allowed State Make'
  ),
  8,
  'all approved registration state codes are accepted'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, vin)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        repeat('V', 51)
      )
    $statement$
  ),
  '23514'::text,
  'VIN cannot exceed 50 characters'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, current_odometer)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        -1
      )
    $statement$
  ),
  '23514'::text,
  'odometer cannot be negative'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, current_odometer)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        9007199254740992
      )
    $statement$
  ),
  '23514'::text,
  'odometer cannot exceed the safe integer maximum'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, odometer_unit)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        'yards'
      )
    $statement$
  ),
  '23514'::text,
  'odometer unit must be km or mi'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, engine)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        repeat('E', 51)
      )
    $statement$
  ),
  '23514'::text,
  'engine cannot exceed 50 characters'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, notes)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        repeat('N', 501)
      )
    $statement$
  ),
  '23514'::text,
  'notes cannot exceed 500 characters'
);

select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model)
      values (
        '21000000-0000-4000-8000-000000000001',
        repeat(U&'\+01F600', 51),
        'Constraint Model'
      )
    $statement$
  ),
  '23514'::text,
  'non-BMP text one code point over the limit is rejected'
);

select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      insert into public.vehicles (owner_id, make, model, notes)
      values (
        '21000000-0000-4000-8000-000000000001',
        'Constraint Make',
        'Constraint Model',
        repeat(U&'\+01F600', 501)
      )
    $statement$
  ),
  '23514'::text,
  'non-BMP notes one code point over the limit are rejected'
);

insert into public.vehicles (
  id,
  owner_id,
  make,
  model,
  year,
  registration,
  vin,
  current_odometer,
  odometer_unit,
  engine,
  notes
)
values (
  '23000000-0000-4000-8000-000000000005',
  '21000000-0000-4000-8000-000000000001',
  repeat('M', 50),
  repeat('D', 50),
  1900,
  repeat('R', 50),
  repeat('V', 50),
  0,
  'km',
  repeat('E', 50),
  repeat('N', 500)
);

select extensions.is(
  (
    select year
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000005'
  ),
  1900,
  'lower boundaries and exact text limits are accepted'
);

insert into public.vehicles (
  id,
  owner_id,
  make,
  model,
  registration,
  vin,
  engine,
  notes
)
values (
  '23000000-0000-4000-8000-000000000007',
  '21000000-0000-4000-8000-000000000001',
  repeat(U&'\+01F600', 50),
  repeat(U&'\+01F600', 50),
  repeat(U&'\+01F600', 50),
  repeat(U&'\+01F600', 50),
  repeat(U&'\+01F600', 50),
  repeat(U&'\+01F600', 500)
);

select extensions.ok(
  (
    select char_length(make) = 50
      and char_length(model) = 50
      and char_length(registration) = 50
      and char_length(vin) = 50
      and char_length(engine) = 50
      and char_length(notes) = 500
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000007'
  ),
  'non-BMP exact code-point limits are accepted for every text field'
);

insert into public.vehicles (id, owner_id, make, model, year, current_odometer)
values (
  '23000000-0000-4000-8000-000000000006',
  '21000000-0000-4000-8000-000000000001',
  'Upper Year Make',
  'Upper Year Model',
  9999,
  9007199254740991
);

select extensions.is(
  (
    select odometer_unit
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000006'
  ),
  'km'::text,
  'upper year boundary is accepted and odometer unit defaults to km'
);

select extensions.is(
  (
    select current_odometer
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000006'
  ),
  9007199254740991::bigint,
  'safe integer odometer maximum is accepted'
);

insert into public.vehicles (owner_id, make, model, registration)
values
  (
    '21000000-0000-4000-8000-000000000001',
    'Dupe Make',
    'Dupe Model',
    'DUP 001'
  ),
  (
    '21000000-0000-4000-8000-000000000001',
    'dupe make',
    'DUPEMODEL',
    'dup001'
  );

select extensions.is(
  (
    select count(*)::integer
    from public.vehicles
    where lower(replace(make, ' ', '')) = 'dupemake'
      and lower(replace(model, ' ', '')) = 'dupemodel'
      and lower(replace(registration, ' ', '')) = 'dup001'
  ),
  2,
  'duplicate-looking Vehicles are stored without a uniqueness error'
);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      select *
      from public.archive_vehicle('23000000-0000-4000-8000-000000000002')
    $statement$
  ),
  '55000'::text,
  'archive rejects an already archived Vehicle'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      select *
      from public.restore_vehicle('23000000-0000-4000-8000-000000000001')
    $statement$
  ),
  '55000'::text,
  'restore rejects an already active Vehicle'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      select *
      from public.archive_vehicle('23999999-0000-4000-8000-000000000099')
    $statement$
  ),
  'P0002'::text,
  'archive rejects a missing Vehicle'
);
select extensions.is(
  pg_temp.sqlstate_for(
    $statement$
      select *
      from public.restore_vehicle('23999999-0000-4000-8000-000000000099')
    $statement$
  ),
  'P0002'::text,
  'restore rejects a missing Vehicle'
);

update public.vehicles
set odometer_unit = 'mi'
where id = '23000000-0000-4000-8000-000000000001';

select extensions.is(
  (
    select odometer_unit
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000001'
  ),
  'mi'::text,
  'mapped admin can currently change the odometer unit'
);

delete from public.vehicles
where id = '23000000-0000-4000-8000-000000000001';

select extensions.is(
  (
    select count(*)::integer
    from public.vehicles
    where id = '23000000-0000-4000-8000-000000000001'
  ),
  0,
  'mapped admin can currently permanently delete the Vehicle fixture'
);

reset role;

select extensions.ok(
  has_table_privilege('authenticated', 'public.vehicles', 'select'),
  'authenticated role has direct Vehicle read capability guarded by RLS'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.vehicles', 'select'),
  'anonymous role has no direct Vehicle read capability'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.archive_vehicle(uuid)',
    'execute'
  ),
  'authenticated role can invoke the archive RPC subject to authorization'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.archive_vehicle(uuid)', 'execute'),
  'anonymous role cannot invoke the archive RPC directly'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.restore_vehicle(uuid)',
    'execute'
  ),
  'authenticated role can invoke the restore RPC subject to authorization'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.restore_vehicle(uuid)', 'execute'),
  'anonymous role cannot invoke the restore RPC directly'
);

select * from extensions.finish();

rollback;
