begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(35);

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
  ('31000000-0000-4000-8000-000000000001', 'Synthetic Service Record Admin', 'admin'),
  ('31000000-0000-4000-8000-000000000002', 'Synthetic Service Record Member', 'member');

insert into public.user_identities (id, user_id, provider, provider_subject)
values
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'supabase', '30000000-0000-4000-8000-000000000001'),
  ('32000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000002', 'supabase', '30000000-0000-4000-8000-000000000002');

insert into public.vehicles (id, owner_id, make, model, year, current_odometer, odometer_unit)
values
  ('33000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'Synthetic', 'Service Record Vehicle', '2024', 12000, 'km'),
  ('33000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 'Synthetic', 'Archive Rollback Vehicle', '2024', 5000, 'km');

select pg_catalog.set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select extensions.is(
  (select count(*)::integer from public.create_service_record_draft('33000000-0000-4000-8000-000000000001', '2026-01-10', 12000)),
  1,
  'mapped admin can create a Service Record draft through the RPC'
);
select extensions.is(
  (select owner_id from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001'),
  '31000000-0000-4000-8000-000000000001'::uuid,
  'draft ownership is derived from the active application identity'
);
select extensions.ok(
  (select display_number is null and status = 'draft' and version = 1 from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001'),
  'draft numbering, status, and version are app-owned defaults'
);

select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.save_service_record_draft(
      (select id from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001'),
      1,
      '{"serviceDate":"2026-01-10","odometer":"12000","summary":"Service","items":[{"id":"34000000-0000-4000-8000-000000000001","kind":"part","name":"Filter","purchaseCostMinor":"2500","sortOrder":"0"}]}'::jsonb
    )
  $statement$),
  null::text,
  'mapped admin can atomically save a valid ordered draft'
);
select extensions.is(
  (select version from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001'),
  2,
  'a draft save increments its version exactly once'
);
select extensions.is(
  (select count(*)::integer from public.service_record_items where service_record_id = (select id from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001')),
  1,
  'a draft save persists its item aggregate'
);
select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.save_service_record_draft(
      (select id from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001'),
      1,
      '{"serviceDate":"2026-01-10","odometer":"12000","summary":"Stale","items":[]}'::jsonb
    )
  $statement$),
  '40001',
  'stale saves are rejected by the expected-version concurrency guard'
);
select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.save_service_record_draft(
      (select id from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001'),
      2,
      '{"serviceDate":"2026-01-10","odometer":"12000","summary":"Bad order","items":[{"id":"34000000-0000-4000-8000-000000000002","kind":"work","name":"Work","sortOrder":"1"}]}'::jsonb
    )
  $statement$),
  '22023',
  'draft item ordering must be contiguous from zero'
);

select extensions.is(
  pg_temp.sqlstate_for($statement$
    insert into public.service_record_items (id, service_record_id, kind, name, sort_order)
    values ('34000000-0000-4000-8000-000000000003', (select id from public.service_records limit 1), 'work', 'Direct insert', 9)
  $statement$),
  '42501',
  'direct item writes are denied to authenticated callers'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.service_records', 'insert, update, delete')
    and not has_table_privilege('authenticated', 'public.service_record_items', 'insert, update, delete')
    and not has_table_privilege('authenticated', 'public.service_record_exports', 'insert, update, delete'),
  'authenticated callers only have direct read privileges on Service Record tables'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.complete_service_record(uuid, integer)', 'execute')
    and not has_function_privilege('anon', 'public.complete_service_record(uuid, integer)', 'execute'),
  'completion RPC is available only to authenticated callers'
);

select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.complete_service_record((select id from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001'), 2)
  $statement$),
  null::text,
  'mapped admin can complete a valid Service Record'
);
select extensions.ok(
  (select status = 'completed' and display_number ~ '^SR-[0-9]{6,}$' and version = 3 from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001'),
  'completion assigns an immutable global display number and increments version'
);
select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.complete_service_record((select id from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001'), 2)
  $statement$),
  null::text,
  'the approved completion retry version is idempotent'
);
select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.complete_service_record((select id from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001'), 1)
  $statement$),
  '40001',
  'an unapproved completion retry version conflicts'
);
select extensions.is(
  pg_temp.sqlstate_for($statement$
    update public.service_records set summary = 'Changed' where vehicle_id = '33000000-0000-4000-8000-000000000001'
  $statement$),
  '42501',
  'completed aggregate direct updates remain denied by table privileges'
);

select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.create_service_record_export(
      jsonb_build_object('id', '35000000-0000-4000-8000-000000000001', 'serviceRecordId', (select id from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001'), 'serviceRecordVersion', 3, 'snapshot', jsonb_build_object('title', 'Synthetic'), 'schemaVersion', 1, 'templateVersion', 1, 'brandingVersion', 1)
    )
  $statement$),
  null::text,
  'mapped admin can append a version-matched completed export'
);
select extensions.is(
  pg_temp.sqlstate_for($statement$
    update public.service_record_exports set snapshot = '{}'::jsonb where id = '35000000-0000-4000-8000-000000000001'
  $statement$),
  '42501',
  'completed exports cannot be changed through direct table access'
);

-- Item-parent access and completed immutability are protected even for a privileged migration context.
reset role;
select extensions.is(
  pg_temp.sqlstate_for($statement$
    update public.service_records set summary = 'Changed' where vehicle_id = '33000000-0000-4000-8000-000000000001'
  $statement$),
  '55000',
  'completed aggregate trigger rejects privileged mutation'
);
select extensions.is(
  pg_temp.sqlstate_for($statement$
    delete from public.service_record_items where id = '34000000-0000-4000-8000-000000000001'
  $statement$),
  '55000',
  'completed item trigger rejects privileged mutation'
);
select extensions.is(
  pg_temp.sqlstate_for($statement$
    delete from public.service_record_exports where id = '35000000-0000-4000-8000-000000000001'
  $statement$),
  '55000',
  'append-only export trigger rejects privileged deletion'
);
set local role authenticated;

select pg_catalog.set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select extensions.is((select count(*)::integer from public.service_records), 0, 'mapped non-admin cannot read Service Record rows');
select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.create_service_record_draft('33000000-0000-4000-8000-000000000001', '2026-01-11', 12001)
  $statement$),
  '42501',
  'mapped non-admin cannot create a Service Record draft'
);

select pg_catalog.set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000099', true);
select extensions.is((select count(*)::integer from public.service_records), 0, 'authenticated unmapped identity cannot read Service Record rows');
select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.create_service_record_draft('33000000-0000-4000-8000-000000000001', '2026-01-11', 12001)
  $statement$),
  '42501',
  'authenticated unmapped identity cannot create a Service Record draft'
);
reset role;
select pg_catalog.set_config('request.jwt.claim.sub', null, true);
set local role anon;
select extensions.is(
  pg_temp.sqlstate_for('select count(*) from public.service_records'),
  '42501',
  'unauthenticated caller cannot read Service Record rows'
);
select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.create_service_record_draft('33000000-0000-4000-8000-000000000001', '2026-01-11', 12001)
  $statement$),
  '42501',
  'unauthenticated caller cannot create a Service Record draft'
);
reset role;

-- Archive rollback: a foreign-key failure after draft deletion rolls back the whole archive transaction.
select pg_catalog.set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select public.create_service_record_draft('33000000-0000-4000-8000-000000000002', '2026-02-01', 5000);
reset role;
create temporary table archive_failures (vehicle_id uuid primary key);
insert into archive_failures values ('33000000-0000-4000-8000-000000000002');
create function pg_temp.fail_archive_after_update()
returns trigger language plpgsql as $$ begin if exists (select 1 from archive_failures where vehicle_id = new.id) then raise exception 'Synthetic archive failure'; end if; return new; end; $$;
create trigger synthetic_archive_failure before update on public.vehicles for each row execute function pg_temp.fail_archive_after_update();
set local role authenticated;
select extensions.is(
  pg_temp.sqlstate_for($statement$ select public.archive_vehicle('33000000-0000-4000-8000-000000000002') $statement$),
  'P0001',
  'archive failure rolls back its draft deletion atomically'
);
reset role;
select extensions.is(
  (select count(*)::integer from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000002' and status = 'draft'),
  1,
  'archive rollback preserves the draft when the archive update fails'
);
drop trigger synthetic_archive_failure on public.vehicles;
set local role authenticated;
select extensions.is(pg_temp.sqlstate_for($statement$ select public.archive_vehicle('33000000-0000-4000-8000-000000000002') $statement$), null::text, 'archive succeeds after the synthetic failure is removed');
reset role;
select extensions.is((select count(*)::integer from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000002'), 0, 'archive removes drafts but retains no draft history');

select extensions.is(
  pg_temp.sqlstate_for($statement$ update public.vehicles set odometer_unit = 'mi' where id = '33000000-0000-4000-8000-000000000001' $statement$),
  '55000',
  'completed history blocks Vehicle odometer-unit changes'
);
select extensions.is(
  pg_temp.sqlstate_for($statement$ delete from public.vehicles where id = '33000000-0000-4000-8000-000000000001' $statement$),
  '55000',
  'completed history blocks Vehicle deletion'
);
select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.create_service_record_draft('33000000-0000-4000-8000-000000000001', '2026-01-09', 12001)
  $statement$),
  '22023',
  'draft creation rejects odometers below known completed history without persistence'
);
select public.create_service_record_draft('33000000-0000-4000-8000-000000000001', '2026-01-09', 11999);
select extensions.is(
  pg_temp.sqlstate_for($statement$
    select public.save_service_record_draft(
      (select id from public.service_records where vehicle_id = '33000000-0000-4000-8000-000000000001' and status = 'draft'),
      1,
      '{"serviceDate":"2026-01-09","odometer":"12001","summary":"Invalid chronology","items":[{"id":"34000000-0000-4000-8000-000000000004","kind":"work","name":"Work","sortOrder":"0"}]}'::jsonb
    )
  $statement$),
  '22023',
  'draft saves reject known completed-history odometer conflicts atomically'
);

select * from extensions.finish();

rollback;
