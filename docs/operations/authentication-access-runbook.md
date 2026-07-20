# Authentication and Access Operations Runbook

Status: Approved procedure for environment setup and initial Garage Admin bootstrap  
Feature: [Authentication and Access](../features/authentication-access.md)

## Scope and safety boundary

Use this runbook once per isolated local, staging, or production environment. It
configures Google sign-in through Supabase, applies the repository migrations,
and promotes exactly one verified app-owned user to Garage Admin. Dashboard UI
labels can change; the configuration purpose and official documentation linked
below are authoritative.

This procedure does not define account recovery, create another administrator,
or change the repository architecture. Never weaken grants or RLS, expose a
Supabase secret or legacy `service_role` key to the browser, or perform a role
change from the SPA.

Use an approved secret manager for credentials. Do not put secrets in this
repository, `.env` files committed to Git, shell command arguments, terminal
history, logs, screenshots, tickets, or evidence. Evidence must also omit user
email, display name, provider subject, auth/app user IDs, access or refresh
tokens, project references, and callback query strings.

## 1. Prepare an isolated environment

Use separate Supabase projects and credentials for staging and production. Use
the local Supabase stack for local development. Use a separate Google OAuth web
client for staging and production so changing one environment cannot break the
other. Any exception requires an explicit security review recorded before this
procedure begins.

| Environment | App origin | Google authorized redirect URI | Supabase app redirect allowlist |
| --- | --- | --- | --- |
| Local | `http://localhost:<APP_PORT>` | `http://127.0.0.1:54321/auth/v1/callback` | `http://localhost:<APP_PORT>/auth/callback` |
| Staging | `https://<STAGING_APP_HOST>` | `https://<STAGING_SUPABASE_HOST>/auth/v1/callback` | `https://<STAGING_APP_HOST>/auth/callback` |
| Production | `https://<PRODUCTION_APP_HOST>` | `https://<PRODUCTION_SUPABASE_HOST>/auth/v1/callback` | `https://<PRODUCTION_APP_HOST>/auth/callback` |

Replace every angle-bracket placeholder at operation time. Do not copy a value
between environments. Google requires the redirect URI to match exactly,
including scheme, case, path, and trailing slash. The Google redirect points to
Supabase; the app callback is separately allowlisted by Supabase. Use exact
production and staging callback paths, not wildcards. See the official
[Supabase Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google),
[redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls), and
[Google redirect URI rules](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation).

For each deployed SPA, inject only these public build variables:

```dotenv
VITE_SUPABASE_URL=https://<SUPABASE_HOST>
VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLIC_PUBLISHABLE_KEY>
```

The repository also accepts a legacy public `anon` JWT in
`VITE_SUPABASE_PUBLISHABLE_KEY` during key migration. Prefer the newer
publishable key. Publishable and legacy `anon` keys are public client keys;
Supabase secret and legacy `service_role` keys are privileged and must never be
used in `VITE_*` variables. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## 2. Configure Google and Supabase Auth

1. In the Google OAuth web client for this environment, configure the app origin
   as an authorized JavaScript origin and the environment's Supabase
   `/auth/v1/callback` URL as its one exact authorized redirect URI.
2. Store the Google client secret in the Supabase Auth provider configuration,
   not in the SPA or repository. Enable Google as the interactive provider.
3. Set the Supabase Auth site URL to the environment's app origin. Add exactly
   the app's `/auth/callback` URL to the redirect allowlist. The app may attach a
   validated local `returnPath` query at runtime; do not add that query to the
   allowlist or evidence.
4. Keep global signup disabled until the supervised window in section 5.
5. Explicitly disable all email signup (password, magic link, and OTP), all phone
   signup/OTP, anonymous sign-in, and every social or external provider other
   than Google before the window. Google must be the only enabled interactive
   provider throughout this procedure.

For a local stack, initialize Supabase configuration if it is not already
present, then express the same site URL, additional redirect URL, Google
provider, and JWT expiry in `supabase/config.toml`. Reference the Google secret
through an environment variable supported by the CLI; never hardcode it. Restart
the local stack after configuration changes. Follow the official
[local configuration reference](https://supabase.com/docs/guides/local-development/cli/config).

## 3. Confirm session settings

For each environment, confirm and record only the resulting setting names and
non-sensitive durations:

- Maximum session lifetime: Supabase default.
- Inactivity timeout: Supabase default.
- Access-token/JWT lifetime: Supabase default (the local CLI default is 3,600
  seconds).
- Concurrent sessions: Supabase default.

Supabase sessions otherwise have no fixed lifetime by default and permit
multiple active sessions. If the deployment owner cannot establish or document
the provider defaults, explicitly set both maximum session lifetime and
inactivity timeout to one day. Do not change concurrent-session behavior without
a product decision. Session changes are normally enforced when tokens refresh,
so allow for the configured JWT lifetime when validating them. See
[Supabase session controls](https://supabase.com/docs/guides/auth/sessions).

## 4. Apply and validate migrations

First prove the complete migration set locally:

```sh
supabase start
supabase db reset
npm run test:db
```

Then, from a trusted operator workstation, target exactly one hosted environment
at a time. Authenticate and supply database credentials through approved tooling
without placing them in command arguments or evidence:

```sh
supabase login
supabase link --project-ref <TARGET_PROJECT_REF>
supabase migration list
supabase db push --dry-run
supabase db push
supabase migration list
```

Review the dry run before applying it. Confirm that all files under
`supabase/migrations/` are present afterward. Never run `supabase db reset
--linked` against staging or production, and never mutate the hosted schema in
the dashboard as a substitute for migrations. See the official
[database migration workflow](https://supabase.com/docs/guides/deployment/database-migrations).

Run the repository validation gates before opening signup:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

## 5. Open a controlled signup window

This is a supervised operation. The intended Garage Admin must be available to
complete it immediately.

1. Verify migrations, Google configuration, callback allowlists, RLS, and
   repository gates before changing signup configuration. Reconfirm that global
   signup is disabled and that all email, phone, anonymous, and non-Google
   provider paths are disabled.
2. Inspect the provider's user-management view and require an empty auth-user
   baseline for this new environment. If any auth user already exists, keep or
   set global signup disabled and abort for reviewed investigation. Do not
   continue based on an assumed identity.
3. Temporarily allow global signup. Existing users can sign in while signup is
   disabled; see [Supabase Auth general configuration](https://supabase.com/docs/guides/auth/general-configuration).
4. Have the intended Garage Admin sign in through the deployed app using Google.
5. As soon as that sign-in returns, whether it succeeds or fails, immediately
   disable global signup before inspecting, provisioning, or promoting any user.
6. With signup confirmed disabled, inspect the provider's user-management view.
   Require exactly one auth user. The operator must personally compare the live
   account with the intended account and verify its primary provider is Google.
   Do not copy identifiers or profile fields into evidence.
7. If the baseline changes unexpectedly, more than one user exists, the intended
   sign-in failed, or the provider/account does not match, confirm signup is
   disabled and abort. Do not promote or casually delete any user.

The insert trigger normally creates a `public.app_users` member and a
`public.user_identities` row with provider `supabase`. A Google account without
a usable display name intentionally remains unmapped until the privileged
function in the next section is called.

## 6. Verify, provision if needed, and promote transactionally

Immediately before starting the database session, re-audit the auth-user list:
global signup must be disabled, exactly one user must exist, and that live user
must still be the intended Google account. If any check fails, confirm signup is
disabled and abort.

Use a trusted privileged database session on the verified target. Obtain its
connection configuration through an approved secret manager or protected
`PGSERVICE`/password-file setup, then start `psql` without embedding credentials
in the shell command. The function used for missing-name provisioning has API
execution granted only to `service_role`; this database-owner operation does not
broaden that grant and the service role must never enter the browser.

Paste the following script into the trusted `psql` session. It prompts at
runtime so values do not appear in shell history. The expected email is used
only to make the live identity check explicit and is never selected into
evidence. Supply a fallback display name even when a mapping probably exists.

```sql
\set ON_ERROR_STOP on
\prompt 'Verified Auth user UUID: ' bootstrap_auth_user_id
\prompt 'Verified Auth user email: ' bootstrap_expected_email
\prompt 'Fallback display name: ' bootstrap_display_name

begin;

create temporary table bootstrap_input (
  auth_user_id uuid primary key,
  expected_email text not null,
  fallback_display_name text not null
) on commit drop;

insert into bootstrap_input (
  auth_user_id,
  expected_email,
  fallback_display_name
) values (
  :'bootstrap_auth_user_id'::uuid,
  :'bootstrap_expected_email',
  :'bootstrap_display_name'
);

-- Serialize bootstrap attempts so two operators cannot promote in parallel.
-- The auth lock keeps the verified initial-user baseline stable until commit.
lock table auth.users in share mode;
lock table public.app_users in share row exclusive mode;

do $bootstrap$
declare
  target_auth_user_id uuid;
  target_app_user_id uuid;
  existing_admin_id uuid;
begin
  if (select count(*) from auth.users) <> 1 then
    raise exception 'Bootstrap aborted: initial environment must have exactly one auth user';
  end if;

  select auth_user.id
    into target_auth_user_id
    from auth.users as auth_user
    cross join bootstrap_input as input
   where auth_user.id = input.auth_user_id
     and lower(auth_user.email) = lower(input.expected_email)
     and auth_user.raw_app_meta_data ->> 'provider' = 'google';

  if target_auth_user_id is null then
    raise exception 'Bootstrap aborted: verified Google auth user did not match';
  end if;

  select identity.user_id
    into target_app_user_id
    from public.user_identities as identity
   where identity.provider = 'supabase'
     and identity.provider_subject = target_auth_user_id::text;

  if target_app_user_id is null then
    select public.provision_app_user(
      input.auth_user_id,
      input.fallback_display_name
    )
      into target_app_user_id
      from bootstrap_input as input;
  end if;

  if not exists (
    select 1
      from public.user_identities as identity
     where identity.user_id = target_app_user_id
       and identity.provider = 'supabase'
       and identity.provider_subject = target_auth_user_id::text
  ) then
    raise exception 'Bootstrap aborted: app-user mapping does not match auth user';
  end if;

  select app_user.id
    into existing_admin_id
    from public.app_users as app_user
   where app_user.role = 'admin'
     and app_user.id <> target_app_user_id
   limit 1;

  if existing_admin_id is not null then
    raise exception 'Bootstrap aborted: a different Garage Admin already exists';
  end if;

  update public.app_users
     set role = 'admin',
         updated_at = now()
   where id = target_app_user_id
     and role in ('member', 'admin');

  if not found then
    raise exception 'Bootstrap aborted: target app user is missing or has an invalid role';
  end if;

  if (select count(*) from public.app_users where role = 'admin') <> 1
     or not exists (
       select 1
         from public.app_users
        where id = target_app_user_id
          and role = 'admin'
     ) then
    raise exception 'Bootstrap aborted: exactly-one-admin assertion failed';
  end if;
end
$bootstrap$;

select
  exists (
    select 1
      from auth.users as auth_user
      cross join bootstrap_input as input
     where auth_user.id = input.auth_user_id
       and lower(auth_user.email) = lower(input.expected_email)
       and auth_user.raw_app_meta_data ->> 'provider' = 'google'
  ) as verified_google_auth_user,
  exists (
    select 1
      from bootstrap_input as input
      join public.user_identities as identity
        on identity.provider = 'supabase'
       and identity.provider_subject = input.auth_user_id::text
      join public.app_users as app_user
        on app_user.id = identity.user_id
       and app_user.role = 'admin'
  ) as verified_admin_mapping,
  (select count(*) = 1 from public.app_users where role = 'admin')
    as verified_exactly_one_admin;

commit;
```

All three verification columns must be `true`. This script is repeatable for the
same verified mapping while the initial environment still has exactly that one
auth user: it accepts either `member` or already-`admin`, but aborts before
promotion if the auth-user baseline changed or a different admin exists. Any
error before `commit` leaves the transaction uncommitted; end the session or
issue `rollback`, confirm signup is disabled, and investigate. Do not bypass an
assertion, alter grants, disable RLS, or demote an existing administrator to
force the operation through.

## 7. Close signup and validate access

Reconfirm that global signup remains disabled after the successful commit and
before recording evidence. Then verify only the auth-owned behavior implemented
by this feature:

1. The intended Garage Admin can sign out, sign in again with Google, render the
   authenticated application shell, load the dashboard, and refresh a protected
   deep link without leaving the guarded route.
2. An account that has never signed in cannot create a new user after signup is
   disabled. Perform this active outsider check in local or staging; in
   production verify the disabled setting and provider audit rather than create
   a test identity.
3. A mapped `member` test fixture receives the app's access-unavailable state;
   the authenticated shell and protected route outlet do not render. Use only an
   approved local/staging fixture.
4. `npm run test:db` passes against the intended local validation database,
   including denial of direct `app_users`/`user_identities` table access and
   role changes to browser roles, denial of `provision_app_user` to `anon` and
   `authenticated`, and denial of the profile RPC to `anon`.

Vehicle and Service Record tables do not exist in this feature. Their row-level
authorization checks are explicitly deferred to their future migrations and
operations runbooks; do not record them as verified here.

If the wrong identity was promoted or validation fails after commit, confirm
signup is disabled, restrict operational access to the deployment, and escalate
for a reviewed corrective transaction. Do not improvise deletion, demotion,
recovery, or a second administrator under this runbook.

## 8. Evidence and abort checklist

Record only non-sensitive outcomes:

- Environment name and deployment/review ticket (never the project reference).
- Date, operator, and reviewer.
- Migration versions applied and migration-list agreement.
- Google provider configured: yes/no.
- Exact callback categories checked: Google-to-Supabase and Supabase-to-app,
  yes/no (do not record URLs or query strings).
- Session defaults confirmed, or one-day lifetime/inactivity fallback applied.
- Signup disabled after bootstrap: yes/no.
- The three SQL verification booleans: all true/false, without row output.
- Admin shell/sign-in/protected-route refresh, member access-unavailable,
  outsider/signup, and auth table/RPC denial checks: pass/fail.
- Repository and database validation commands: pass/fail.

Abort and disable global signup immediately if the target environment is
uncertain, a callback is not exact, migration state differs, an unexpected auth
user appears, the provider or identity mapping does not match, a different admin
exists, any assertion is false, or any validation fails. Preserve only redacted
diagnostic outcomes and obtain review before retrying.
