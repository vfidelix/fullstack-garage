create sequence public.service_record_display_number_sequence
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no maxvalue;

create table public.service_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default public.current_app_user_id(),
  vehicle_id uuid not null,
  display_number text,
  status text not null default 'draft',
  service_date date not null,
  odometer bigint not null,
  performed_by text,
  location text,
  summary text,
  notes text,
  next_service_due_date date,
  next_service_due_odometer bigint,
  currency_code text not null default 'AUD',
  version integer not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  constraint service_records_vehicle_owner_fkey
    foreign key (vehicle_id, owner_id)
    references public.vehicles (id, owner_id)
    on delete restrict,
  constraint service_records_display_number_key unique (owner_id, display_number),
  constraint service_records_status_valid check (status in ('draft', 'completed')),
  constraint service_records_display_number_state check (
    (status = 'draft' and display_number is null and completed_at is null)
    or (status = 'completed' and display_number ~ '^SR-[0-9]{6,}$' and completed_at is not null)
  ),
  constraint service_records_currency_valid check (currency_code = 'AUD'),
  constraint service_records_odometer_valid check (odometer between 0 and 9007199254740991),
  constraint service_records_version_valid check (version >= 1),
  constraint service_records_performed_by_length check (char_length(performed_by) <= 100),
  constraint service_records_location_length check (char_length(location) <= 200),
  constraint service_records_summary_length check (char_length(summary) <= 200),
  constraint service_records_notes_length check (char_length(notes) <= 2000),
  constraint service_records_next_odometer_valid check (
    next_service_due_odometer is null
    or next_service_due_odometer between 0 and 9007199254740991
  ),
  constraint service_records_next_date_after_service check (
    next_service_due_date is null or next_service_due_date > service_date
  ),
  constraint service_records_next_odometer_after_service check (
    next_service_due_odometer is null or next_service_due_odometer > odometer
  )
);

create index service_records_vehicle_history_idx
  on public.service_records (
    vehicle_id,
    service_date desc,
    odometer desc,
    completed_at desc nulls last,
    id desc
  );

create table public.service_record_items (
  id uuid primary key,
  service_record_id uuid not null references public.service_records (id) on delete cascade,
  kind text not null,
  category text,
  name text not null,
  brand text,
  specification text,
  part_number text,
  supplier text,
  quantity numeric,
  unit text,
  purchase_cost_minor bigint,
  notes text,
  sort_order integer not null,
  constraint service_record_items_kind_valid check (
    kind in ('work', 'part', 'fluid', 'consumable', 'inspection', 'other')
  ),
  constraint service_record_items_name_not_blank check (name ~ '[^[:space:]]'),
  constraint service_record_items_category_length check (char_length(category) <= 50),
  constraint service_record_items_name_length check (char_length(name) <= 200),
  constraint service_record_items_brand_length check (char_length(brand) <= 100),
  constraint service_record_items_specification_length check (char_length(specification) <= 200),
  constraint service_record_items_part_number_length check (char_length(part_number) <= 100),
  constraint service_record_items_supplier_length check (char_length(supplier) <= 100),
  constraint service_record_items_unit_length check (char_length(unit) <= 20),
  constraint service_record_items_notes_length check (char_length(notes) <= 1000),
  constraint service_record_items_quantity_valid check (quantity is null or (quantity > 0 and quantity <> 'NaN'::numeric)),
  constraint service_record_items_purchase_cost_valid check (
    purchase_cost_minor is null or purchase_cost_minor between 0 and 9007199254740991
  ),
  constraint service_record_items_cost_kind_valid check (
    purchase_cost_minor is null or kind in ('part', 'fluid', 'consumable')
  ),
  constraint service_record_items_sort_order_valid check (sort_order >= 0),
  constraint service_record_items_sort_order_key unique (service_record_id, sort_order)
);

create table public.service_record_exports (
  id uuid primary key,
  owner_id uuid not null references public.app_users (id) on delete restrict,
  service_record_id uuid not null references public.service_records (id) on delete restrict,
  service_record_version integer not null,
  snapshot jsonb not null,
  schema_version integer not null,
  template_version integer not null,
  branding_version integer not null,
  created_by_id uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint service_record_exports_version_valid check (service_record_version >= 1),
  constraint service_record_exports_schema_version_valid check (schema_version >= 1),
  constraint service_record_exports_template_version_valid check (template_version >= 1),
  constraint service_record_exports_branding_version_valid check (branding_version >= 1),
  constraint service_record_exports_snapshot_object check (jsonb_typeof(snapshot) = 'object')
);

create index service_record_exports_record_created_idx
  on public.service_record_exports (service_record_id, created_at desc, id desc);

create function public.set_service_record_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create function public.prevent_completed_service_record_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'completed' then
    raise exception 'Completed Service Records are immutable.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create function public.prevent_completed_service_record_item_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.service_records as record
    where record.id = coalesce(new.service_record_id, old.service_record_id)
      and record.status = 'completed'
  ) then
    raise exception 'Completed Service Record items are immutable.' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;

create function public.prevent_service_record_export_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Service Record exports are append-only.' using errcode = '55000';
end;
$$;

create trigger set_service_record_updated_at
  before update on public.service_records
  for each row execute function public.set_service_record_updated_at();

create trigger service_record_completed_immutable
  before update on public.service_records
  for each row execute function public.prevent_completed_service_record_change();

create trigger service_record_item_completed_immutable
  before insert or update or delete on public.service_record_items
  for each row execute function public.prevent_completed_service_record_item_change();

create trigger service_record_exports_append_only
  before update or delete on public.service_record_exports
  for each row execute function public.prevent_service_record_export_change();

alter table public.service_records enable row level security;
alter table public.service_record_items enable row level security;
alter table public.service_record_exports enable row level security;

create policy service_records_select_admin on public.service_records
  for select to authenticated using (public.is_garage_admin());
create policy service_record_items_select_admin on public.service_record_items
  for select to authenticated using (
    public.is_garage_admin()
    and exists (select 1 from public.service_records as record where record.id = service_record_id)
  );
create policy service_record_exports_select_admin on public.service_record_exports
  for select to authenticated using (public.is_garage_admin());

revoke all privileges on table public.service_records, public.service_record_items, public.service_record_exports
  from public, anon, authenticated;
grant select on table public.service_records, public.service_record_items, public.service_record_exports to authenticated;

create function public.assert_service_record_draft_json(p_draft jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
  v_index integer;
begin
  if jsonb_typeof(p_draft) <> 'object' or jsonb_typeof(p_draft->'items') <> 'array' then
    raise exception 'Service Record draft is invalid.' using errcode = '22023';
  end if;
  if (p_draft->>'serviceDate') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Service Record service date is invalid.' using errcode = '22023';
  end if;
  perform (p_draft->>'serviceDate')::date;
  if (p_draft->>'odometer') !~ '^\d+$' or (p_draft->>'odometer')::bigint > 9007199254740991 then
    raise exception 'Service Record odometer is invalid.' using errcode = '22023';
  end if;
  if p_draft ? 'nextServiceDueDate' and p_draft->>'nextServiceDueDate' is not null then
    if (p_draft->>'nextServiceDueDate') !~ '^\d{4}-\d{2}-\d{2}$'
      or (p_draft->>'nextServiceDueDate')::date <= (p_draft->>'serviceDate')::date then
      raise exception 'Service Record next service date is invalid.' using errcode = '22023';
    end if;
  end if;
  if p_draft ? 'nextServiceDueOdometer' and p_draft->>'nextServiceDueOdometer' is not null then
    if (p_draft->>'nextServiceDueOdometer') !~ '^\d+$'
      or (p_draft->>'nextServiceDueOdometer')::bigint <= (p_draft->>'odometer')::bigint
      or (p_draft->>'nextServiceDueOdometer')::bigint > 9007199254740991 then
      raise exception 'Service Record next service odometer is invalid.' using errcode = '22023';
    end if;
  end if;
  if char_length(p_draft->>'performedBy') > 100 or char_length(p_draft->>'location') > 200
    or char_length(p_draft->>'summary') > 200 or char_length(p_draft->>'notes') > 2000 then
    raise exception 'Service Record text is too long.' using errcode = '22023';
  end if;

  for v_item, v_index in select value, ordinal::integer from jsonb_array_elements(p_draft->'items') with ordinality as item(value, ordinal)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or (v_item->>'id') is null
      or (v_item->>'kind') not in ('work', 'part', 'fluid', 'consumable', 'inspection', 'other')
      or btrim(coalesce(v_item->>'name', '')) = ''
      or (v_item->>'sortOrder') !~ '^\d+$'
      or (v_item->>'sortOrder')::integer <> v_index - 1 then
      raise exception 'Service Record items must be complete and consecutively ordered.' using errcode = '22023';
    end if;
    perform (v_item->>'id')::uuid;
    if char_length(v_item->>'category') > 50 or char_length(v_item->>'name') > 200
      or char_length(v_item->>'brand') > 100 or char_length(v_item->>'specification') > 200
      or char_length(v_item->>'partNumber') > 100 or char_length(v_item->>'supplier') > 100
      or char_length(v_item->>'unit') > 20 or char_length(v_item->>'notes') > 1000 then
      raise exception 'Service Record item text is too long.' using errcode = '22023';
    end if;
    if v_item ? 'quantity' and v_item->>'quantity' is not null
      and ((v_item->>'quantity')::numeric <= 0 or (v_item->>'quantity')::numeric = 'NaN'::numeric) then
      raise exception 'Service Record item quantity is invalid.' using errcode = '22023';
    end if;
    if v_item ? 'purchaseCostMinor' and v_item->>'purchaseCostMinor' is not null then
      if (v_item->>'purchaseCostMinor') !~ '^\d+$'
        or (v_item->>'purchaseCostMinor')::bigint > 9007199254740991
        or (v_item->>'kind') not in ('part', 'fluid', 'consumable') then
        raise exception 'Service Record item Purchase Cost is invalid.' using errcode = '22023';
      end if;
    end if;
  end loop;
end;
$$;

create function public.assert_service_record_odometer_chronology(
  p_vehicle_id uuid,
  p_service_date date,
  p_odometer bigint,
  p_exclude_record_id uuid default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_lower bigint; v_upper bigint;
begin
  perform 1 from public.service_records
    where vehicle_id = p_vehicle_id and status = 'completed'
    for update;
  select max(odometer) into v_lower from public.service_records
    where vehicle_id = p_vehicle_id and status = 'completed'
      and service_date < p_service_date and id is distinct from p_exclude_record_id;
  select min(odometer) into v_upper from public.service_records
    where vehicle_id = p_vehicle_id and status = 'completed'
      and service_date > p_service_date and id is distinct from p_exclude_record_id;
  if v_lower is not null and p_odometer < v_lower then
    raise exception 'Service Record odometer is below earlier completed history.' using errcode = '22023';
  end if;
  if v_upper is not null and p_odometer > v_upper then
    raise exception 'Service Record odometer is above later completed history.' using errcode = '22023';
  end if;
end;
$$;

create function public.create_service_record_draft(
  p_vehicle_id uuid,
  p_service_date date,
  p_odometer bigint
)
returns public.service_records
language plpgsql security definer set search_path = ''
as $$
declare v_record public.service_records;
begin
  if not public.is_garage_admin() then raise exception 'Service Record access is not authorized.' using errcode = '42501'; end if;
  if p_odometer < 0 or p_odometer > 9007199254740991 then raise exception 'Service Record odometer is invalid.' using errcode = '22023'; end if;
  if not exists (select 1 from public.vehicles where id = p_vehicle_id and archived_at is null) then
    raise exception 'Vehicle is inactive or was not found.' using errcode = 'P0002';
  end if;
  perform public.assert_service_record_odometer_chronology(p_vehicle_id, p_service_date, p_odometer);
  insert into public.service_records (vehicle_id, service_date, odometer, performed_by)
  values (p_vehicle_id, p_service_date, p_odometer, (select display_name from public.app_users where id = public.current_app_user_id()))
  returning * into v_record;
  return v_record;
end;
$$;

create function public.save_service_record_draft(p_record_id uuid, p_expected_version integer, p_draft jsonb)
returns public.service_records
language plpgsql security definer set search_path = ''
as $$
declare v_record public.service_records; v_item jsonb;
begin
  if not public.is_garage_admin() then raise exception 'Service Record access is not authorized.' using errcode = '42501'; end if;
  perform public.assert_service_record_draft_json(p_draft);
  select * into v_record from public.service_records where id = p_record_id for update;
  if not found then raise exception 'Service Record was not found.' using errcode = 'P0002'; end if;
  if v_record.status <> 'draft' then raise exception 'Service Record is not editable.' using errcode = '55000'; end if;
  if v_record.version <> p_expected_version then raise exception 'Service Record version conflict.' using errcode = '40001'; end if;
  if not exists (select 1 from public.vehicles where id = v_record.vehicle_id and archived_at is null for key share) then
    raise exception 'Vehicle is inactive or was not found.' using errcode = '55000';
  end if;
  perform public.assert_service_record_odometer_chronology(v_record.vehicle_id, (p_draft->>'serviceDate')::date, (p_draft->>'odometer')::bigint, p_record_id);
  update public.service_records set service_date = (p_draft->>'serviceDate')::date, odometer = (p_draft->>'odometer')::bigint,
    performed_by = nullif(btrim(p_draft->>'performedBy'), ''), location = nullif(btrim(p_draft->>'location'), ''),
    summary = nullif(btrim(p_draft->>'summary'), ''), notes = nullif(btrim(p_draft->>'notes'), ''),
    next_service_due_date = nullif(p_draft->>'nextServiceDueDate', '')::date,
    next_service_due_odometer = nullif(p_draft->>'nextServiceDueOdometer', '')::bigint, version = version + 1
    where id = p_record_id returning * into v_record;
  delete from public.service_record_items where service_record_id = p_record_id;
  for v_item in select value from jsonb_array_elements(p_draft->'items') loop
    insert into public.service_record_items (id, service_record_id, kind, category, name, brand, specification, part_number, supplier, quantity, unit, purchase_cost_minor, notes, sort_order)
    values ((v_item->>'id')::uuid, p_record_id, v_item->>'kind', nullif(btrim(v_item->>'category'), ''), btrim(v_item->>'name'), nullif(btrim(v_item->>'brand'), ''), nullif(btrim(v_item->>'specification'), ''), nullif(btrim(v_item->>'partNumber'), ''), nullif(btrim(v_item->>'supplier'), ''), nullif(v_item->>'quantity', '')::numeric, nullif(btrim(v_item->>'unit'), ''), nullif(v_item->>'purchaseCostMinor', '')::bigint, nullif(btrim(v_item->>'notes'), ''), (v_item->>'sortOrder')::integer);
  end loop;
  return v_record;
end;
$$;

create function public.delete_service_record_draft(p_record_id uuid, p_expected_version integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_record public.service_records;
begin
  if not public.is_garage_admin() then raise exception 'Service Record access is not authorized.' using errcode = '42501'; end if;
  select * into v_record from public.service_records where id = p_record_id for update;
  if not found then raise exception 'Service Record was not found.' using errcode = 'P0002'; end if;
  if v_record.status <> 'draft' then raise exception 'Service Record is not editable.' using errcode = '55000'; end if;
  if v_record.version <> p_expected_version then raise exception 'Service Record version conflict.' using errcode = '40001'; end if;
  delete from public.service_records where id = p_record_id;
end;
$$;

create function public.complete_service_record(p_record_id uuid, p_expected_version integer)
returns public.service_records
language plpgsql security definer set search_path = ''
as $$
declare v_record public.service_records;
begin
  if not public.is_garage_admin() then raise exception 'Service Record access is not authorized.' using errcode = '42501'; end if;
  select * into v_record from public.service_records where id = p_record_id for update;
  if not found then raise exception 'Service Record was not found.' using errcode = 'P0002'; end if;
  if v_record.status = 'completed' then
    if p_expected_version = v_record.version or p_expected_version = v_record.version - 1 then return v_record; end if;
    raise exception 'Service Record version conflict.' using errcode = '40001';
  end if;
  if v_record.version <> p_expected_version then raise exception 'Service Record version conflict.' using errcode = '40001'; end if;
  if nullif(btrim(v_record.summary), '') is null and not exists (select 1 from public.service_record_items where service_record_id = p_record_id) then
    raise exception 'Service Record completion requires a summary or item.' using errcode = '22023';
  end if;
  perform 1 from public.vehicles where id = v_record.vehicle_id and archived_at is null for update;
  if not found then raise exception 'Vehicle is inactive or was not found.' using errcode = '55000'; end if;
  perform public.assert_service_record_odometer_chronology(v_record.vehicle_id, v_record.service_date, v_record.odometer, p_record_id);
  update public.service_records set status = 'completed', display_number = 'SR-' || lpad(nextval('public.service_record_display_number_sequence')::text, 6, '0'), completed_at = statement_timestamp(), version = version + 1 where id = p_record_id returning * into v_record;
  update public.vehicles set current_odometer = greatest(coalesce(current_odometer, v_record.odometer), v_record.odometer) where id = v_record.vehicle_id;
  return v_record;
end;
$$;

create function public.create_service_record_export(p_export jsonb)
returns public.service_record_exports
language plpgsql security definer set search_path = ''
as $$
declare v_export public.service_record_exports; v_record public.service_records;
begin
  if not public.is_garage_admin() then raise exception 'Service Record access is not authorized.' using errcode = '42501'; end if;
  if jsonb_typeof(p_export) <> 'object' then raise exception 'Service Record export is invalid.' using errcode = '22023'; end if;
  select * into v_record from public.service_records where id = (p_export->>'serviceRecordId')::uuid and status = 'completed';
  if not found then raise exception 'Completed Service Record was not found.' using errcode = 'P0002'; end if;
  if (p_export->>'serviceRecordVersion')::integer <> v_record.version then raise exception 'Service Record export version is invalid.' using errcode = '22023'; end if;
  insert into public.service_record_exports (id, owner_id, service_record_id, service_record_version, snapshot, schema_version, template_version, branding_version, created_by_id)
  values ((p_export->>'id')::uuid, v_record.owner_id, v_record.id, v_record.version, p_export->'snapshot', (p_export->>'schemaVersion')::integer, (p_export->>'templateVersion')::integer, (p_export->>'brandingVersion')::integer, public.current_app_user_id())
  returning * into v_export;
  return v_export;
end;
$$;

create function public.vehicle_completed_history_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (tg_op = 'DELETE' or old.odometer_unit is distinct from new.odometer_unit)
    and exists (select 1 from public.service_records where vehicle_id = old.id and status = 'completed') then
    if tg_op = 'DELETE' then raise exception 'Vehicle cannot be deleted while completed Service Record history exists.' using errcode = '55000'; end if;
    raise exception 'Vehicle odometer unit cannot change while completed Service Record history exists.' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger vehicle_completed_history_guard
  before update or delete on public.vehicles
  for each row execute function public.vehicle_completed_history_guard();

create or replace function public.archive_vehicle(p_vehicle_id uuid)
returns public.vehicles
language plpgsql security definer set search_path = ''
as $$
declare v_vehicle public.vehicles;
begin
  if not public.is_garage_admin() then raise exception 'Vehicle access is not authorized.' using errcode = '42501'; end if;
  select * into v_vehicle from public.vehicles where id = p_vehicle_id and archived_at is null for update;
  if not found then
    if exists (select 1 from public.vehicles where id = p_vehicle_id) then raise exception 'Vehicle is already archived.' using errcode = '55000'; end if;
    raise exception 'Vehicle was not found.' using errcode = 'P0002';
  end if;
  delete from public.service_records as record where record.vehicle_id = p_vehicle_id and record.status = 'draft';
  update public.vehicles set archived_at = statement_timestamp() where id = p_vehicle_id returning * into v_vehicle;
  return v_vehicle;
end;
$$;

revoke all on function public.set_service_record_updated_at(), public.prevent_completed_service_record_change(), public.prevent_completed_service_record_item_change(), public.prevent_service_record_export_change(), public.assert_service_record_draft_json(jsonb), public.assert_service_record_odometer_chronology(uuid, date, bigint, uuid), public.vehicle_completed_history_guard() from public, anon, authenticated, service_role;
revoke all on function public.create_service_record_draft(uuid, date, bigint), public.save_service_record_draft(uuid, integer, jsonb), public.delete_service_record_draft(uuid, integer), public.complete_service_record(uuid, integer), public.create_service_record_export(jsonb) from public, anon, service_role;
grant execute on function public.create_service_record_draft(uuid, date, bigint), public.save_service_record_draft(uuid, integer, jsonb), public.delete_service_record_draft(uuid, integer), public.complete_service_record(uuid, integer), public.create_service_record_export(jsonb) to authenticated;
