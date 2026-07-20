alter table public.app_users
  enable row level security;

alter table public.user_identities
  enable row level security;

revoke all privileges
  on table public.app_users, public.user_identities
  from public, anon, authenticated;
