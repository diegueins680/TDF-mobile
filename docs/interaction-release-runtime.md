# Interaction release compatibility

The interaction release adds Expo Crypto and changes the canonical API host.
Its OTA runtime is `1.0.1-interactions.1`, distinct from the older `1.0.0` and
`1.0.1` binaries. App-store marketing version remains `1.0.1`; build numbers
continue through the existing signed release workflows.

`app.json` is the runtime authority consumed by `app.config.ts`. Checked-in iOS
and Android projects carry the same value, checked by release validation. IPA
qualification compares the actual Expo.plist and all embedded Expo configs.
Android qualification compares the actual compiled resource values, manifest
reference and embedded Expo config using pinned bundletool 1.18.3.

Do not publish interaction JavaScript to an older runtime: those binaries lack
the new native capability. Keep existing channels; any future OTA update must
use this runtime and the canonical `https://api.tdfrecords.net` API configuration.
No OTA update or channel mapping is changed by this patch. Test artifacts keep
OTA disabled; their successful discussion journeys are separate from signed
artifact/runtime qualification.

See [Expo runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/).

The moderation follow-up displays the latest bounded report reasons returned by
canonical moderator endpoints before removal or dismissal. Reporter identities
are not included. The API field is optional for compatibility with an older server;
permission enforcement remains on the server. A rendered native regression opens
the moderation queue, reads a report reason, and submits the scoped decision.
