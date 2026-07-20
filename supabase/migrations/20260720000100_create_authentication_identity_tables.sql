create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_display_name_not_blank
    check (display_name ~ '[^[:space:]]'),
  constraint app_users_role_valid
    check (role in ('admin', 'member'))
);

create table public.user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,
  provider_subject text not null,
  created_at timestamptz not null default now(),
  constraint user_identities_user_id_fkey
    foreign key (user_id)
    references public.app_users (id)
    on delete cascade,
  constraint user_identities_provider_not_blank
    check (provider ~ '[^[:space:]]'),
  constraint user_identities_provider_subject_not_blank
    check (provider_subject ~ '[^[:space:]]'),
  constraint user_identities_provider_subject_key
    unique (provider, provider_subject)
);

create index user_identities_user_id_idx
  on public.user_identities (user_id);
