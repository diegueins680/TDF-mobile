# Fanclub Live Broadcasts

Fans can open an event, switch to `En Vivo`, and start a live session for an artist they follow from that event lineup. The stream is scoped to that artist's fanclub so other followers can discover it from the same event screen.

## Mobile Flow

- Event Detail has a third tab: `En Vivo`.
- The app checks which event artists the current Party ID follows before enabling the fanclub selector.
- Starting a session creates a backend live broadcast row, receives `whipUrl`/`streamKey`, then publishes camera and microphone through `react-native-webrtc`.
- If WHIP publishing fails after backend session creation, the app tries to close the session immediately to avoid stale live rows.
- Ending a broadcast closes the WHIP resource, stops local media tracks, and marks the session ended through the backend.
- If the broadcaster leaves the event screen or the app backgrounds, the app stops publishing and best-effort closes the tracked backend broadcast.

## Backend Routes

`src/api/liveBroadcasts.ts` targets:

- `GET /social-events/events/:eventId/live-broadcasts`
- `POST /social-events/events/:eventId/live-broadcasts`
- `POST /social-events/events/:eventId/live-broadcasts/:broadcastId/heartbeat`
- `POST /social-events/events/:eventId/live-broadcasts/:broadcastId/end`

The repository in `src/lib/liveBroadcastsRepository.ts` keeps a local AsyncStorage fallback for local tests and development, but authenticated app usage should prefer the backend so the fanclub feed is shared across devices.
