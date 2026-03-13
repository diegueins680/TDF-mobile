# TDF Records Mobile

Expo Router app for TDF Records operations. The current product surface covers parties/clients, bookings, production pipelines, events, social connections with QR vCard exchange, venue lookup, and inventory workflows.

## Environment

Set these before `npm run start`:

```sh
export EXPO_PUBLIC_API_BASE=http://<your-api-host>:8080
export EXPO_PUBLIC_API_TOKEN="Bearer <token>"
export EXPO_PUBLIC_UPLOAD_URL=http://<your-api-host>:8080/drive/upload
export EXPO_PUBLIC_TZ=America/Guayaquil
```

The inventory flow uses `EXPO_PUBLIC_UPLOAD_URL` for camera/gallery uploads. The auth screen can also preload `EXPO_PUBLIC_API_TOKEN` for internal QA.

## Development

```sh
npm install
npm run start
```

Additional commands:

- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run lint`
- `npm run typecheck`
- `npm test`

## Store Release

Release hardening for App Store / Play Store lives in `docs/release/README.md`.

Key commands:

- `npm run assets:release`
- `npm run release:validate`
- `npm run build:android:store`
- `npm run build:ios:store`
- `npm run submit:android`
- `npm run submit:ios`

## Notes

The about screen shows the active API base, timezone, and backend health/version when available.
