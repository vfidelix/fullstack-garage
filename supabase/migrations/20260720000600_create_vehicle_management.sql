create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default public.current_app_user_id(),
  make text not null,
  model text not null,
  year integer,
  registration text,
  vin text,
  current_odometer bigint,
  odometer_unit text not null default 'km',
  engine text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_owner_id_fkey
    foreign key (owner_id)
    references public.app_users (id)
    on delete restrict,
  constraint vehicles_id_owner_id_key
    unique (id, owner_id),
  constraint vehicles_make_not_blank
    check (make ~ '[^[:space:]]'),
  constraint vehicles_make_length check (char_length(make) <= 50),
  constraint vehicles_model_not_blank
    check (model ~ '[^[:space:]]'),
  constraint vehicles_model_length check (char_length(model) <= 50),
  constraint vehicles_year_range check (year between 1900 and 9999),
  constraint vehicles_registration_length
    check (char_length(registration) <= 50),
  constraint vehicles_vin_length check (char_length(vin) <= 50),
  constraint vehicles_current_odometer_range
    check (current_odometer between 0 and 9007199254740991),
  constraint vehicles_odometer_unit_valid
    check (odometer_unit in ('km', 'mi')),
  constraint vehicles_engine_length check (char_length(engine) <= 50),
  constraint vehicles_notes_length check (char_length(notes) <= 500)
);

create index vehicles_owner_id_idx
  on public.vehicles (owner_id);

create index vehicles_active_owner_id_idx
  on public.vehicles (owner_id)
  where archived_at is null;

create function public.set_vehicle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

revoke all on function public.set_vehicle_updated_at()
  from public, anon, authenticated, service_role;

create trigger set_vehicle_updated_at
  before update on public.vehicles
  for each row
  execute function public.set_vehicle_updated_at();

alter table public.vehicles
  enable row level security;

create policy vehicles_select_admin
  on public.vehicles
  for select
  to authenticated
  using (public.is_garage_admin());

create policy vehicles_insert_admin
  on public.vehicles
  for insert
  to authenticated
  with check (
    public.is_garage_admin()
    and owner_id = public.current_app_user_id()
  );

create policy vehicles_update_admin
  on public.vehicles
  for update
  to authenticated
  using (public.is_garage_admin())
  with check (public.is_garage_admin());

create policy vehicles_delete_admin
  on public.vehicles
  for delete
  to authenticated
  using (public.is_garage_admin());

revoke all privileges
  on table public.vehicles
  from public, anon, authenticated;

grant select, delete
  on table public.vehicles
  to authenticated;

grant insert (
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
  on table public.vehicles
  to authenticated;

grant update (
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
  on table public.vehicles
  to authenticated;

create function public.archive_vehicle(p_vehicle_id uuid)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
begin
  if not public.is_garage_admin() then
    raise exception 'Vehicle access is not authorized.'
      using errcode = '42501';
  end if;

  update public.vehicles as vehicle
    set archived_at = statement_timestamp()
    where vehicle.id = p_vehicle_id
      and vehicle.archived_at is null
    returning vehicle.* into v_vehicle;

  if found then
    return v_vehicle;
  end if;

  if exists (
    select 1
      from public.vehicles as vehicle
      where vehicle.id = p_vehicle_id
  ) then
    raise exception 'Vehicle is already archived.'
      using errcode = '55000';
  end if;

  raise exception 'Vehicle was not found.'
    using errcode = 'P0002';
end;
$$;

revoke all on function public.archive_vehicle(uuid)
  from public, anon, service_role;
grant execute on function public.archive_vehicle(uuid)
  to authenticated;

create function public.restore_vehicle(p_vehicle_id uuid)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
begin
  if not public.is_garage_admin() then
    raise exception 'Vehicle access is not authorized.'
      using errcode = '42501';
  end if;

  update public.vehicles as vehicle
    set archived_at = null
    where vehicle.id = p_vehicle_id
      and vehicle.archived_at is not null
    returning vehicle.* into v_vehicle;

  if found then
    return v_vehicle;
  end if;

  if exists (
    select 1
      from public.vehicles as vehicle
      where vehicle.id = p_vehicle_id
  ) then
    raise exception 'Vehicle is already active.'
      using errcode = '55000';
  end if;

  raise exception 'Vehicle was not found.'
    using errcode = 'P0002';
end;
$$;

revoke all on function public.restore_vehicle(uuid)
  from public, anon, service_role;
grant execute on function public.restore_vehicle(uuid)
  to authenticated;
