# Garage Admin Identity Recovery Runbook

Status: Product-owner-approved privileged incident procedure  
Feature: [Authentication and Access](../features/authentication-access.md)  
Bootstrap prerequisite: [Authentication and Access Operations Runbook](authentication-access-runbook.md)

## Scope and invariant

Use this runbook only when the sole Garage Admin has lost access to the Google
identity mapped through Supabase. It atomically replaces that identity mapping
while preserving the existing admin `AppUserId` and exactly one admin role.

The approved result is:

```text
Old Supabase auth user: retained for audit, no application mapping
Old admin AppUser: retained with the same AppUserId and admin role
Replacement Supabase auth user: mapped to the old admin AppUser
Replacement provisional member AppUser: deleted only after it is orphaned
```

There is no identity-overlap interval visible outside the transaction: readers
see the old mapping before commit and the replacement mapping after commit. This
procedure does not prove that the lost Google login is unusable. It proves that
the old Supabase subject is unmapped and denied application access, then proves
that the replacement can sign in after cutover.

Do not delete or modify `auth.users`, add a second admin, change the admin
`AppUserId`, alter grants or RLS, expose a secret/service-role key, or perform
this operation through the SPA. Recovery UI, automation, and broader account
recovery policy are outside this task.

## 1. Authorize and prepare the incident

Recovery requires all of the following before any configuration change:

1. An incident/change record authorized by the deployment owner, identifying
   the target environment without copying its project reference into evidence.
2. One trusted database operator and a second reviewer present for the whole
   operation. The reviewer independently verifies every precondition and must
   approve commit.
3. A separate trusted operator database session, obtained through an approved
   secret manager or protected `PGSERVICE`/password-file setup. Never put
   credentials in command arguments, Git, environment files committed to Git,
   terminal history, logs, screenshots, or tickets.
4. A current backup/recovery point and a reviewed incident rollback decision.
   This runbook supports transaction rollback before commit; it does not invent
   a post-commit reverse-recovery procedure.
5. The complete repository migration set deployed and `npm run test:db` passed
   on the intended validation database.

Keep global signup disabled initially. Explicitly disable all email signup
(password, magic link, and OTP), all phone signup/OTP, anonymous sign-in, and
every social or external provider other than Google. Existing users can sign in
while signup is disabled. Dashboard UI labels can change; configure these
purposes using the official [Supabase Auth configuration guide](https://supabase.com/docs/guides/auth/general-configuration)
and inspect users through the provider's user-management view described in
[Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data).

## 2. Establish the closed-signup baseline

With signup confirmed disabled, both reviewers inspect the live database in the
trusted session. Do not export rows. Require all of these facts or keep signup
disabled and abort for investigation:

- Exactly one `public.app_users` row has role `admin`; record its ID only in the
  live operator worksheet as `<OLD_ADMIN_APP_USER_ID>`.
- Exactly one `public.user_identities` row belongs to that admin. It has provider
  `supabase` and its subject is `<OLD_AUTH_USER_ID>`.
- Exactly one `auth.users` row exists, its ID is `<OLD_AUTH_USER_ID>`, and trusted
  app metadata identifies Google as its provider.
- No other app user, identity mapping, or auth user exists in this MVP
  environment.

This is a database identity and mapping check, not verification of the lost
Google login. If the environment is not this exact single-user baseline, disable
signup and stop for a separately reviewed recovery plan.

## 3. Create only the replacement Google identity

1. Reconfirm that Google is the only enabled provider and the approved exact
   callback configuration from the bootstrap runbook is unchanged.
2. Temporarily allow global signup.
3. Have the authorized replacement account sign in through the deployed app
   using Google.
4. As soon as the sign-in returns, whether it succeeds or fails, immediately
   disable global signup before inspecting or changing any database row.
5. With signup confirmed disabled, require exactly two auth users: the retained
   old auth user and one replacement. The operator and reviewer personally
   compare the live replacement account with the authorized account and verify
   its primary provider is Google. Use its ID as `<NEW_AUTH_USER_ID>` and its
   email only as the runtime verification value `<NEW_EXPECTED_EMAIL>`.
6. Require the normal provisioning trigger to have created exactly one
   replacement `user_identities` row with provider `supabase`, subject
   `<NEW_AUTH_USER_ID>`, and user ID `<PROVISIONAL_MEMBER_APP_USER_ID>`. Require
   that app user to exist with role `member` and have no other identity.

If sign-in fails, any extra auth/app user or mapping appears, the replacement
does not match, or provisioning did not produce that exact provisional member,
confirm signup is disabled and abort. Do not call provisioning, delete a row, or
promote the provisional member to repair the baseline.

## 4. Perform the atomic mapping replacement

Immediately before the transaction, re-audit the exact old admin, old auth row,
replacement Google auth row, and provisional member mapping above. Confirm
signup remains disabled. Both reviewers must agree on the four runtime values;
never copy them into retained evidence.

Start `psql` without a connection string in the command line and paste this
script into the separate trusted operator session. Runtime prompts keep values
out of shell history. The transaction locks all three relevant tables, checks
the complete two-auth-user/two-app-user baseline, deletes only the old mapping,
reassigns the existing replacement mapping, and deletes only the resulting
orphaned provisional member.

```sql
\set ON_ERROR_STOP on
\prompt 'Existing admin AppUser UUID: ' recovery_admin_app_user_id
\prompt 'Retained old Auth user UUID: ' recovery_old_auth_user_id
\prompt 'Verified replacement Auth user UUID: ' recovery_new_auth_user_id
\prompt 'Verified replacement email: ' recovery_new_expected_email
\prompt 'Replacement provisional member AppUser UUID: ' recovery_provisional_app_user_id

begin;

create temporary table recovery_input (
  admin_app_user_id uuid primary key,
  old_auth_user_id uuid not null unique,
  new_auth_user_id uuid not null unique,
  new_expected_email text not null,
  provisional_app_user_id uuid not null unique,
  constraint recovery_auth_users_differ
    check (old_auth_user_id <> new_auth_user_id),
  constraint recovery_app_users_differ
    check (admin_app_user_id <> provisional_app_user_id)
) on commit drop;

insert into recovery_input (
  admin_app_user_id,
  old_auth_user_id,
  new_auth_user_id,
  new_expected_email,
  provisional_app_user_id
) values (
  :'recovery_admin_app_user_id'::uuid,
  :'recovery_old_auth_user_id'::uuid,
  :'recovery_new_auth_user_id'::uuid,
  :'recovery_new_expected_email',
  :'recovery_provisional_app_user_id'::uuid
);

lock table auth.users in share mode;
lock table public.app_users, public.user_identities
  in share row exclusive mode;

do $recovery$
declare
  input recovery_input%rowtype;
  old_identity_id uuid;
  new_identity_id uuid;
begin
  select * into strict input from recovery_input;

  if (select count(*) from auth.users) <> 2
     or exists (
       select 1
         from auth.users as auth_user
        where auth_user.id not in (
          input.old_auth_user_id,
          input.new_auth_user_id
        )
     ) then
    raise exception 'Recovery aborted: auth-user baseline changed';
  end if;

  if not exists (
    select 1
      from auth.users as auth_user
     where auth_user.id = input.old_auth_user_id
       and auth_user.raw_app_meta_data ->> 'provider' = 'google'
  ) then
    raise exception 'Recovery aborted: retained old Google auth row is missing';
  end if;

  if not exists (
    select 1
      from auth.users as auth_user
     where auth_user.id = input.new_auth_user_id
       and lower(auth_user.email) = lower(input.new_expected_email)
       and auth_user.raw_app_meta_data ->> 'provider' = 'google'
  ) then
    raise exception 'Recovery aborted: replacement Google auth user did not match';
  end if;

  if (select count(*) from public.app_users) <> 2
     or (select count(*) from public.app_users where role = 'admin') <> 1
     or not exists (
       select 1
         from public.app_users
        where id = input.admin_app_user_id
          and role = 'admin'
     )
     or not exists (
       select 1
         from public.app_users
        where id = input.provisional_app_user_id
          and role = 'member'
     ) then
    raise exception 'Recovery aborted: exact admin/member baseline did not match';
  end if;

  if (select count(*) from public.user_identities) <> 2 then
    raise exception 'Recovery aborted: identity baseline contains unexpected rows';
  end if;

  select identity.id
    into old_identity_id
    from public.user_identities as identity
   where identity.user_id = input.admin_app_user_id
     and identity.provider = 'supabase'
     and identity.provider_subject = input.old_auth_user_id::text;

  if old_identity_id is null
     or (select count(*) from public.user_identities
          where user_id = input.admin_app_user_id) <> 1 then
    raise exception 'Recovery aborted: old admin mapping did not match';
  end if;

  select identity.id
    into new_identity_id
    from public.user_identities as identity
   where identity.user_id = input.provisional_app_user_id
     and identity.provider = 'supabase'
     and identity.provider_subject = input.new_auth_user_id::text;

  if new_identity_id is null
     or (select count(*) from public.user_identities
          where user_id = input.provisional_app_user_id) <> 1 then
    raise exception 'Recovery aborted: provisional replacement mapping did not match';
  end if;

  delete from public.user_identities
   where id = old_identity_id
     and user_id = input.admin_app_user_id;

  if not found then
    raise exception 'Recovery aborted: old mapping was not removed';
  end if;

  update public.user_identities
     set user_id = input.admin_app_user_id
   where id = new_identity_id
     and user_id = input.provisional_app_user_id;

  if not found then
    raise exception 'Recovery aborted: replacement mapping was not reassigned';
  end if;

  delete from public.app_users
   where id = input.provisional_app_user_id
     and role = 'member'
     and not exists (
       select 1
         from public.user_identities as identity
        where identity.user_id = input.provisional_app_user_id
     );

  if not found then
    raise exception 'Recovery aborted: provisional member was not an orphan';
  end if;

  if (select count(*) from public.app_users where role = 'admin') <> 1
     or not exists (
       select 1
         from public.app_users
        where id = input.admin_app_user_id
          and role = 'admin'
     )
     or exists (
       select 1
         from public.user_identities
        where provider = 'supabase'
          and provider_subject = input.old_auth_user_id::text
     )
     or not exists (
       select 1
         from public.user_identities
        where user_id = input.admin_app_user_id
          and provider = 'supabase'
          and provider_subject = input.new_auth_user_id::text
     )
     or exists (
       select 1
         from public.app_users
        where id = input.provisional_app_user_id
     )
     or not exists (
       select 1
         from auth.users
        where id = input.old_auth_user_id
     ) then
    raise exception 'Recovery aborted: final cutover invariants failed';
  end if;
end
$recovery$;

select
  exists (
    select 1
      from recovery_input as input
      join public.app_users as app_user
        on app_user.id = input.admin_app_user_id
       and app_user.role = 'admin'
  ) and (select count(*) = 1 from public.app_users where role = 'admin')
    as stable_app_user_and_exactly_one_admin,
  not exists (
    select 1
      from recovery_input as input
      join public.user_identities as identity
        on identity.provider = 'supabase'
       and identity.provider_subject = input.old_auth_user_id::text
  ) as old_subject_unmapped,
  exists (
    select 1
      from recovery_input as input
      join public.user_identities as identity
        on identity.user_id = input.admin_app_user_id
       and identity.provider = 'supabase'
       and identity.provider_subject = input.new_auth_user_id::text
  ) as replacement_mapped_to_stable_app_user,
  not exists (
    select 1
      from recovery_input as input
      join public.app_users as app_user
        on app_user.id = input.provisional_app_user_id
  ) as provisional_member_removed,
  exists (
    select 1
      from recovery_input as input
      join auth.users as old_auth_user
        on old_auth_user.id = input.old_auth_user_id
  ) as old_auth_row_retained;
```

Do not commit yet. Both reviewers must see all five booleans as `true` and no
unexpected output. If any value is false, any assertion errors, or either
reviewer declines approval, confirm signup is disabled and run:

```sql
rollback;
```

Only after both reviewers approve the verified transaction, run:

```sql
commit;
```

An error before commit leaves the cutover uncommitted. End the session or issue
`rollback`, confirm signup is disabled, and investigate. Never bypass an
assertion or edit a row outside the transaction to force recovery.

## 5. Validate the replacement and denial boundary

After commit, reconfirm global signup is disabled and all non-Google creation
paths remain disabled. Then verify only current auth-owned behavior:

1. The replacement account signs out and signs in with Google, receives the
   same app-owned display name/`AppUserId`, renders the authenticated shell,
   loads the dashboard, and refreshes a protected deep link.
2. In a trusted database session, boolean-only verification confirms the old
   auth row still exists but has no `user_identities` mapping. Do not attempt or
   claim a login test using the lost Google account.
3. `npm run test:db` passes, including unmapped-identity denial, member denial,
   denial of direct access and role changes through the authentication-owned
   public tables to browser roles, and provisioning RPC denial to `anon` and
   `authenticated`.

Vehicle and Service Record authorization remains deferred to those features'
future migrations and runbooks.

If replacement sign-in or any database check fails, keep signup disabled,
restrict operational access, preserve only redacted outcomes, and escalate for a
new reviewed corrective transaction. Do not improvise a reverse cutover, delete
an auth user, or create another administrator.

## 6. Redacted evidence checklist

Retain only:

- Incident/change record, environment name, date, operator, and reviewer.
- Backup/recovery point confirmed: yes/no.
- Signup disabled and only Google enabled before/after: yes/no.
- Single-user baseline and exact two-user replacement baseline: pass/fail.
- Five pre-commit verification booleans: all true/false, without row output.
- Two-person commit approval: yes/no.
- Stable AppUser/exactly-one-admin, old-subject-unmapped, replacement-mapped,
  provisional-member-removed, and old-auth-row-retained: pass/fail.
- Replacement sign-in/shell/protected-route refresh and database denial suite:
  pass/fail.

Never retain email, display name, provider subject, auth/app user ID, token,
secret, project reference, callback URL/query, provider payload, database row
export, or screenshot of the user-management view.

Abort and disable global signup immediately if authorization or two-person
review is absent, the environment or backup is uncertain, any provider path is
misconfigured, either baseline differs, any identity/account/mapping does not
match, an assertion or boolean fails, or either reviewer declines commit.
