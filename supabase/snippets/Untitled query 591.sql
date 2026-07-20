begin;

  do $$
  declare
    target_auth_user_id uuid;
    target_app_user_id uuid;
  begin
    if (select count(*) from auth.users) <> 1 then
      raise exception 'Expected exactly one local auth user. Found %.', (
        select count(*) from auth.users
      );
    end if;

    select id
      into target_auth_user_id
      from auth.users
     where lower(email) = lower('vinicius.fidelix@gmail.com')
       and raw_app_meta_data ->> 'provider' = 'google';

    if target_auth_user_id is null then
      raise exception 'Google auth user not found or email does not match.';
    end if;

    select public.provision_app_user(
      target_auth_user_id,
      'Vinicius Fidelix'
    )
      into target_app_user_id;

    update public.app_users
       set role = 'admin',
           updated_at = now()
     where id = target_app_user_id;

    if (select count(*) from public.app_users where role = 'admin') <> 1 then
      raise exception 'Expected exactly one admin after bootstrap.';
    end if;
  end $$;

  select
    app_user.display_name,
    app_user.role
  from public.app_users as app_user
  join public.user_identities as identity
    on identity.user_id = app_user.id
  join auth.users as auth_user
    on auth_user.id::text = identity.provider_subject
  where identity.provider = 'supabase';

  commit;