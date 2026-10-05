# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts Expo Router entry points; each file becomes a navigable route.
- `src/api/` groups axios clients for bookings, parties, and pipelines.
- `src/lib/` holds shared utilities (`api`, `queryClient`, `time`) consumed across screens.
- `src/types/` exposes shared TypeScript models; import from here to avoid duplicate definitions.
- Store feature assets alongside their route or module to keep the tree co-located.

## Build, Test, and Development Commands
- `npm install` installs dependencies pinned in `package-lock.json`.
- `npm run start` launches the Metro-powered Expo dev server.
- `npm run android` / `npm run ios` opens Expo Go on the respective emulator or device.
- `npm run web` runs the app in the Expo web preview for quick layout checks.
- `npm run deploy` exports the web bundle and triggers `eas-cli deploy`; confirm EAS credentials first.

## Coding Style & Naming Conventions
- Write new logic in TypeScript under `src/`; keep React components as `.tsx` and utilities as `.ts`.
- Follow the existing 2-space indentation, trailing commas, and single-quote strings (`src/lib/api.ts`).
- Name components in PascalCase, hooks in camelCase, and keep shared types centralized in `src/types`.
- Co-locate supporting helpers (forms, hooks) with their route folder to maintain small import surfaces.

## Testing Guidelines
- Automated Jest tests are configured. Run `npm run lint`, `npm run typecheck` and `npm test`; retain native device checks for behavior unit tests cannot establish.
- When introducing tests, favor React Native Testing Library (`*.test.tsx`) alongside the component.
- Mock API layers via the wrappers in `src/api` so tests stay independent of live services.
- Document exact automated and manual results in the PR description; a root check that skipped Mobile is not a pass.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `chore:`) to seed a readable history.
- Keep commits focused and reference ticket IDs when available.
- Pull requests should include: purpose summary, screenshots or recordings for UI changes, replication steps, and noted env var updates.
- Request review only after `npm run start` succeeds locally and relevant tests/manual checks pass.

## Configuration & Environment
- `src/lib/api.ts` resolves `EXPO_PUBLIC_API_BASE`, Expo `extra.apiBase`, then the development host. Verify release configuration and generated clients against the parent repository's exact API contract.
- Set `EXPO_PUBLIC_TZ` to override the detected device timezone; the fallback is `UTC`.
- Never commit secrets or embed privileged tokens in `EXPO_PUBLIC_*` variables; public build configuration ships to devices.
