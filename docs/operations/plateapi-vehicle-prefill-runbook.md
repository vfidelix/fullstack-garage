# PlateAPI Vehicle Prefill Runbook

## Production enablement checklist

- Confirm `/privacy/registration-lookup` is live and links to PlateAPI's privacy policy.
- Record product/privacy approval for the disclosure: the optional lookup sends Registration and selected state to PlateAPI.
- Set `PLATEAPI_API_KEY` as a Cloudflare Pages secret. Never add it to a Vite variable, source, logs, or build output.
- Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as Cloudflare runtime configuration.
- Confirm the deployed database has `public.is_garage_admin()` and only authenticated Garage Admins can receive `true`.
- Configure Cloudflare and any request-log sink not to retain lookup request bodies, query strings, authorization headers, or provider responses.
- Exercise the endpoint locally with mocked outbound traffic and a valid admin session; do not use live registrations in automated tests.
- Verify timeout, response-size cap, rate-limit mapping, and manual Vehicle fallback.

## Local development

`npm run dev` uses the Cloudflare Vite plugin, so the lookup proxy reads Worker
runtime bindings from `.env.local`, `.env`, or `.dev.vars` in the project root.
The browser still reads the `VITE_` keys, but the Worker authorization check
also needs the non-`VITE_` Supabase keys:

```ini
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=<local publishable key>
PLATEAPI_API_KEY=<server-only PlateAPI key>
```

If `.dev.vars` exists, Cloudflare local development uses it for Worker runtime
bindings instead of the `.env` files. Keep the same non-`VITE_` keys there when
using `.dev.vars`.

The proxy never logs registrations, states, authorization values, or provider payloads. It returns only Garage-owned suggestions and safe error categories.
