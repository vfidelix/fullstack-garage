create function public.is_garage_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_user_role() = 'admin', false)
$$;

revoke all on function public.is_garage_admin()
  from public, service_role;
grant execute on function public.is_garage_admin()
  to anon, authenticated;
