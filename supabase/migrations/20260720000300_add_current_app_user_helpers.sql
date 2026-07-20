create function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select identity.user_id
    from public.user_identities as identity
    where identity.provider = 'supabase'
      and identity.provider_subject = auth.uid()::text
$$;

revoke all on function public.current_app_user_id()
  from public, anon, service_role;
grant execute on function public.current_app_user_id()
  to authenticated;

create function public.current_app_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select app_user.role
    from public.app_users as app_user
    where app_user.id = public.current_app_user_id()
$$;

revoke all on function public.current_app_user_role()
  from public, anon, service_role;
grant execute on function public.current_app_user_role()
  to authenticated;

create function public.get_current_app_user()
returns table (
  id uuid,
  display_name text,
  role text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_user.id,
    app_user.display_name,
    app_user.role,
    app_user.created_at,
    app_user.updated_at
  from public.app_users as app_user
  where app_user.id = public.current_app_user_id()
$$;

revoke all on function public.get_current_app_user()
  from public, anon, service_role;
grant execute on function public.get_current_app_user()
  to authenticated;
