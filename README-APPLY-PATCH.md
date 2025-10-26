# TDF-mobile – Native Expo additions

This overlay adds native tabs (Parties, Bookings, Pipelines, About) and an API layer pointing at your Haskell API.

## Apply (new files only)

```
# from repo root
git apply tdf-mobile-additions.patch
# install runtime deps
bash ./scripts/install-deps.sh
```

## Optional: make Tabs the default route

If your `app/index.tsx` is from the Expo template, you can replace it with a redirect to the Parties tab:

```
git apply tdf-mobile-index-redirect.patch || true
```

If that fails (due to local edits), copy this into `app/index.tsx`:

```ts
import { Redirect } from 'expo-router';
export default function Index() { return <Redirect href="/(tabs)/parties" />; }
```

## Configure env

Set your API base and timezone when running Expo:

```
export EXPO_PUBLIC_API_BASE=http://<your-LAN-IP>:8080
export EXPO_PUBLIC_TZ=America/Guayaquil
npm run start
```

## Notes

- The additions keep all your existing files intact.
- To reuse code directly from `TDF-ui`, replace the temporary modules in `src/api/*` and `src/types/*` with copies from your web UI repo.
- Pipelines screen expects `GET /pipelines/{mixing|mastering}` and `PATCH /pipelines/{kind}/{id} { stage }`.
- Bookings screen expects `GET/POST /bookings`.
- Parties screen expects `GET/POST/PATCH /parties`.
