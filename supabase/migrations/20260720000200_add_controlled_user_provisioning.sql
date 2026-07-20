create function public.provision_app_user(
  p_auth_user_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app_user_id uuid;
  v_auth_provider text;
  v_display_name text;
begin
  if p_auth_user_id is null then
    raise exception 'Authentication user ID is required.'
      using errcode = '22004';
  end if;

  v_display_name := pg_catalog.regexp_replace(
    coalesce(p_display_name, ''),
    '^[[:space:]]+|[[:space:]]+$',
    '',
    'g'
  );

  if v_display_name = '' then
    raise exception 'A nonblank display name is required.'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_auth_user_id::text, 0)
  );

  select auth_user.raw_app_meta_data ->> 'provider'
    into v_auth_provider
    from auth.users as auth_user
    where auth_user.id = p_auth_user_id
    for key share;

  if not found then
    raise exception 'Authentication user was not found.'
      using errcode = '23503';
  end if;

  if v_auth_provider is distinct from 'google' then
    raise exception 'Authentication user is not a Google identity.'
      using errcode = '22023';
  end if;

  select identity.user_id
    into v_app_user_id
    from public.user_identities as identity
    where identity.provider = 'supabase'
      and identity.provider_subject = p_auth_user_id::text;

  if found then
    return v_app_user_id;
  end if;

  insert into public.app_users (display_name)
    values (v_display_name)
    returning id into v_app_user_id;

  insert into public.user_identities (
    user_id,
    provider,
    provider_subject
  )
  values (
    v_app_user_id,
    'supabase',
    p_auth_user_id::text
  );

  return v_app_user_id;
end;
$$;

revoke all on function public.provision_app_user(uuid, text) from public;
revoke all on function public.provision_app_user(uuid, text)
  from anon, authenticated;
grant execute on function public.provision_app_user(uuid, text)
  to service_role;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  if new.raw_app_meta_data ->> 'provider' is distinct from 'google' then
    return new;
  end if;

  v_display_name := pg_catalog.regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    '^[[:space:]]+|[[:space:]]+$',
    '',
    'g'
  );

  if v_display_name = '' then
    v_display_name := pg_catalog.regexp_replace(
      coalesce(new.raw_user_meta_data ->> 'name', ''),
      '^[[:space:]]+|[[:space:]]+$',
      '',
      'g'
    );
  end if;

  if v_display_name = '' then
    return new;
  end if;

  perform public.provision_app_user(new.id, v_display_name);

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user()
  from public, anon, authenticated, service_role;

create trigger on_auth_user_created_provision_app_user
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
