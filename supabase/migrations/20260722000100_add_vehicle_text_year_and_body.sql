alter table public.vehicles
  drop constraint vehicles_year_range,
  alter column year type text using year::text,
  add column body text,
  add constraint vehicles_year_not_blank
    check (year is null or year ~ '[^[:space:]]'),
  add constraint vehicles_year_length
    check (char_length(year) <= 50),
  add constraint vehicles_body_length
    check (char_length(body) <= 50);

grant insert (body)
  on table public.vehicles
  to authenticated;

grant update (body)
  on table public.vehicles
  to authenticated;
