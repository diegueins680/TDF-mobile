# Expo Router Example

Use [`expo-router`](https://docs.expo.dev/router/introduction/) to build native navigation using files in the `app/` directory.

## Environment for TDF HQ

Set these before `npm start`:

```
export EXPO_PUBLIC_API_BASE=http://<your-api-host>:8080
export EXPO_PUBLIC_API_TOKEN="Bearer <token>"   # e.g., admin-token for dev
export EXPO_PUBLIC_UPLOAD_URL=http://<your-api-host>:8080/drive/upload
```

The inventory tab will use `EXPO_PUBLIC_UPLOAD_URL` to upload camera/gallery photos and save the returned URL on assets.

## Launch your own

[![Launch with Expo](https://github.com/expo/examples/blob/master/.gh-assets/launch.svg?raw=true)](https://launch.expo.dev/?github=https://github.com/expo/examples/tree/master/with-router)

## 🚀 How to use

```sh
npx create-expo-app -e with-router
```

## Deploy

Deploy on all platforms with Expo Application Services (EAS).

- Deploy the website: `npx eas-cli deploy` — [Learn more](https://docs.expo.dev/eas/hosting/get-started/)
- Deploy on iOS and Android using: `npx eas-cli build` — [Learn more](https://expo.dev/eas)

## 📝 Notes

- [Expo Router: Docs](https://docs.expo.dev/router/introduction/)

## About screen

Set `EXPO_PUBLIC_API_BASE=http://localhost:8080` in your shell (or EAS env).
Navigate to `/about` in the app to see API base, health, and version.
