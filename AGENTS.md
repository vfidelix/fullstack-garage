# Repository Guidelines

## Project Structure & Module Organization

Fullstack Garage is a React, Vite, and TypeScript SPA. Startup lives in `src/main.tsx`. Keep routes, providers, and the shell under `src/app/`; feature UI in `src/features/<feature>/`; and reusable code in `src/shared/`. Global tokens are in `src/styles/global.css`; component styles use colocated `*.module.css` files. Brand assets currently live at the repository root.

Before writing or changing UI, read the root `DESIGN.md`. It is the source of truth for the Ferrari visual language installed by `getdesign`; match its tokens, type scale, spacing, sharp component geometry, and responsive patterns. Keep shared design tokens in `src/styles/global.css` and reference them from component CSS rather than introducing one-off visual values.

Follow `docs/architecture/fullstack-garage-architecture.md`: add business rules to `src/domain/`, use cases and ports to `src/application/`, and vendor integrations to `src/infrastructure/`. Supabase details must remain inside `src/infrastructure/supabase/`. Keep feature-specific documentation in `docs/features/<feature>.md` as features are introduced.

## Build, Test, and Development Commands

Use Node.js 24.18.0 and npm; dependency versions are locked in `package-lock.json`.

- `npm install`: install exact project dependencies.
- `npm run dev`: start the Vite development server.
- `npm run typecheck`: run strict TypeScript checks without emitting files.
- `npm run lint`: run ESLint with zero warnings allowed.
- `npm run build`: type-check and create the production bundle in `dist/`.
- `npm run preview`: serve the production bundle locally.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, single quotes, and ESM imports. Keep strict typing enabled; prefer `unknown` at external boundaries and type-only imports for types. Name React components and files in `PascalCase`, hooks as `useSomething`, and other modules in descriptive `camelCase`. Use Lucide icons and existing CSS tokens.

## Testing Guidelines

No test framework or `npm test` script is configured yet. New testing infrastructure should follow the architecture strategy: unit tests for domain calculations and validation, shared repository contract tests for adapters, and integration tests for migrations and RLS. Prefer colocated `*.test.ts` or `*.test.tsx` files and deterministic tests. Until tests are configured, every change must pass typecheck, lint, and build.

## Commit & Pull Request Guidelines

The repository has no commit history, so no convention exists. Use short, imperative subjects such as `Add vehicle domain model`. Pull requests should explain behavior and architecture impact, link issues, list verification commands, and include desktop and mobile screenshots for UI changes. Call out schema migrations, security-policy changes, or deferred work.

## Security & Product Language

Never commit secrets or expose a Supabase service-role key to the SPA. Redact registration, VIN, location, notes, and receipt data from logs. Use “Service Record” and “Purchase Cost”; do not introduce invoice, payment, tax, or amount-due language.
