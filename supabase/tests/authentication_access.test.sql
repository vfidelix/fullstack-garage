begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(38);

create function pg_temp.is_insufficient_privilege(p_statement text)
returns boolean
language plpgsql
as $$
begin
  execute p_statement;
  return false;
exception
  when insufficient_privilege then
    return true;
  when others then
    return false;
end;
$$;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'operator-1@example.invalid',
    '',
    now(),
    '{"provider":"google","providers":["google"]}',
    '{"full_name":"  Garage Operator  "}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'operator-2@example.invalid',
    '',
    now(),
    '{"provider":"google","providers":["google"]}',
    '{"name":"Member Operator"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'operator-3@example.invalid',
    '',
    now(),
    '{"provider":"google","providers":["google"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'operator-4@example.invalid',
    '',
    now(),
    '{"provider":"google","providers":["google"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

select extensions.is(
  (
    select count(*)::integer
    from public.user_identities
    where provider = 'supabase'
      and provider_subject = '10000000-0000-4000-8000-000000000001'
  ),
  1,
  'Google auth-user insert creates one application identity mapping'
);

select extensions.is(
  (
    select app_user.role
    from public.app_users as app_user
    join public.user_identities as identity on identity.user_id = app_user.id
    where identity.provider = 'supabase'
      and identity.provider_subject = '10000000-0000-4000-8000-000000000001'
  ),
  'member'::text,
  'automatic provisioning assigns only the member default'
);

select extensions.is(
  (
    select app_user.display_name
    from public.app_users as app_user
    join public.user_identities as identity on identity.user_id = app_user.id
    where identity.provider = 'supabase'
      and identity.provider_subject = '10000000-0000-4000-8000-000000000001'
  ),
  'Garage Operator'::text,
  'automatic provisioning copies and trims the initial Google display name'
);

update auth.users
set raw_user_meta_data = '{"full_name":"Changed Provider Name"}'
where id = '10000000-0000-4000-8000-000000000001';

select extensions.is(
  (
    select app_user.display_name
    from public.app_users as app_user
    join public.user_identities as identity on identity.user_id = app_user.id
    where identity.provider = 'supabase'
      and identity.provider_subject = '10000000-0000-4000-8000-000000000001'
  ),
  'Garage Operator'::text,
  'later auth-user metadata updates do not resynchronize app-owned profile data'
);

select extensions.is(
  (
    select count(*)::integer
    from public.user_identities
    where provider = 'supabase'
      and provider_subject = '10000000-0000-4000-8000-000000000003'
  ),
  0,
  'Google identities without a usable name remain unprovisioned'
);

select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.provision_app_user(uuid,text)',
    'execute'
  ),
  'service role can invoke explicit-name provisioning'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.provision_app_user(uuid,text)',
    'execute'
  ),
  'authenticated browser callers cannot invoke provisioning'
);

set local role service_role;

select extensions.ok(
  public.provision_app_user(
    '10000000-0000-4000-8000-000000000003',
    '  Explicit Operator  '
  ) is not null,
  'service role provisions a missing-name Google identity explicitly'
);

reset role;

select extensions.is(
  (
    select count(*)::integer
    from public.user_identities
    where provider = 'supabase'
      and provider_subject = '10000000-0000-4000-8000-000000000003'
  ),
  1,
  'explicit-name provisioning creates one immutable identity mapping'
);

select extensions.is(
  (
    select app_user.display_name
    from public.app_users as app_user
    join public.user_identities as identity on identity.user_id = app_user.id
    where identity.provider = 'supabase'
      and identity.provider_subject = '10000000-0000-4000-8000-000000000003'
  ),
  'Explicit Operator'::text,
  'explicit-name provisioning stores a trimmed app-owned display name'
);

update public.app_users
set role = 'admin'
where id = (
  select identity.user_id
  from public.user_identities as identity
  where identity.provider = 'supabase'
    and identity.provider_subject = '10000000-0000-4000-8000-000000000001'
);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select extensions.ok(
  public.current_app_user_id() is not null,
  'mapped admin resolves an application-user ID'
);
select extensions.is(
  public.current_app_user_role(),
  'admin'::text,
  'mapped admin resolves the app-owned admin role'
);
select extensions.is(
  (select count(*)::integer from public.get_current_app_user()),
  1,
  'mapped admin resolves exactly one complete profile'
);
select extensions.is(
  (select display_name from public.get_current_app_user()),
  'Garage Operator'::text,
  'complete profile returns the app-owned display name'
);
select extensions.ok(
  public.is_garage_admin(),
  'Garage Admin helper returns true only for admin'
);

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select extensions.ok(
  public.current_app_user_id() is not null,
  'mapped member resolves an application-user ID'
);
select extensions.is(
  public.current_app_user_role(),
  'member'::text,
  'mapped member resolves the app-owned member role'
);
select extensions.is(
  (select display_name from public.get_current_app_user()),
  'Member Operator'::text,
  'mapped member resolves only its complete profile'
);
select extensions.ok(
  not public.is_garage_admin(),
  'Garage Admin helper rejects member'
);

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);
set local role authenticated;

select extensions.is(
  public.current_app_user_id(),
  null::uuid,
  'authenticated unmapped identity has no application-user ID'
);
select extensions.is(
  public.current_app_user_role(),
  null::text,
  'authenticated unmapped identity has no app-owned role'
);
select extensions.is(
  (select count(*)::integer from public.get_current_app_user()),
  0,
  'authenticated unmapped identity has no application profile'
);
select extensions.ok(
  not public.is_garage_admin(),
  'Garage Admin helper rejects authenticated unmapped identity'
);

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);

select extensions.is(
  public.current_app_user_id(),
  null::uuid,
  'unauthenticated identity resolves no application-user ID'
);
select extensions.is(
  public.current_app_user_role(),
  null::text,
  'unauthenticated identity resolves no app-owned role'
);
select extensions.is(
  (select count(*)::integer from public.get_current_app_user()),
  0,
  'unauthenticated identity resolves no application profile'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.get_current_app_user()',
    'execute'
  ),
  'anonymous browser cannot invoke the profile RPC directly'
);

set local role anon;
select extensions.ok(
  not public.is_garage_admin(),
  'Garage Admin helper safely returns false during anonymous policy evaluation'
);

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select extensions.ok(
  pg_temp.is_insufficient_privilege('select * from public.app_users'),
  'authenticated browser cannot enumerate application users'
);
select extensions.ok(
  pg_temp.is_insufficient_privilege('select * from public.user_identities'),
  'authenticated browser cannot enumerate identity mappings'
);
select extensions.ok(
  pg_temp.is_insufficient_privilege(
    'insert into public.app_users (display_name) values (''Injected User'')'
  ),
  'authenticated browser cannot insert application users'
);
select extensions.ok(
  pg_temp.is_insufficient_privilege(
    'update public.app_users set role = ''admin'''
  ),
  'authenticated browser cannot escalate an app-owned role'
);
select extensions.ok(
  pg_temp.is_insufficient_privilege(
    'update public.app_users set display_name = ''Injected Name'''
  ),
  'authenticated browser cannot mutate app-owned profile data'
);
select extensions.ok(
  pg_temp.is_insufficient_privilege('delete from public.app_users'),
  'authenticated browser cannot delete application users'
);
select extensions.ok(
  pg_temp.is_insufficient_privilege(
    'insert into public.user_identities '
    || '(user_id, provider, provider_subject) values '
    || '(''90000000-0000-4000-8000-000000000001'', ''supabase'', ''injected'')'
  ),
  'authenticated browser cannot insert identity mappings'
);
select extensions.ok(
  pg_temp.is_insufficient_privilege(
    'update public.user_identities '
    || 'set user_id = ''90000000-0000-4000-8000-000000000001'''
  ),
  'authenticated browser cannot reassign identity mappings'
);
select extensions.ok(
  pg_temp.is_insufficient_privilege('delete from public.user_identities'),
  'authenticated browser cannot delete identity mappings'
);

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
set local role anon;
select extensions.ok(
  pg_temp.is_insufficient_privilege('select * from public.app_users'),
  'anonymous browser cannot enumerate application users'
);

reset role;

select * from extensions.finish();

rollback;
