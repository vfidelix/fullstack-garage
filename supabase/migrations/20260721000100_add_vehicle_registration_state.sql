alter table public.vehicles
  add column registration_state text,
  add constraint vehicles_registration_state_valid
    check (
      registration_state is null
      or registration_state in (
        'ACT',
        'NSW',
        'NT',
        'QLD',
        'SA',
        'TAS',
        'VIC',
        'WA'
      )
    );

grant insert (registration_state)
  on table public.vehicles
  to authenticated;

grant update (registration_state)
  on table public.vehicles
  to authenticated;
