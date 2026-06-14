# Fanclub Live Broadcasts

## Product Shape

Fans can open an event, switch to `En Vivo`, and start a live session for an artist they follow from that event lineup. The stream is scoped to that artist's fanclub so other followers can discover it from the same event screen.

## Mobile UX

- Event Detail now has a third tab: `En Vivo`.
- The tab validates that the current Party ID follows at least one artist in the event lineup.
- Eligible fans can open the broadcast studio, choose the artist fanclub, preview camera, set title/description/quality, and start/end a live session.
- Viewers see active and ended broadcasts with artist, broadcaster, viewer count, and playback action when a playback URL exists.

## Data Flow

The mobile feature uses the same resilient pattern as event moments:

- `src/api/liveBroadcasts.ts` targets event-scoped backend routes:
  - `GET /social-events/events/:eventId/live-broadcasts`
  - `POST /social-events/events/:eventId/live-broadcasts`
  - `POST /social-events/events/:eventId/live-broadcasts/:broadcastId/heartbeat`
  - `POST /social-events/events/:eventId/live-broadcasts/:broadcastId/end`
- `src/lib/liveBroadcastsRepository.ts` tries those routes first when auth is present.
- If the event-specific endpoint is unavailable, it provisions stream URLs through the existing `/radio/transmissions` endpoint and stores the event-scoped session locally.
- `src/lib/liveBroadcasts.ts` keeps validated local sessions in AsyncStorage for development, offline fallback, and tests.

## Media Transport Boundary

The app now has camera/microphone permission flow and camera preview in the broadcast studio. Actual native camera publishing to the provisioned WHIP/RTMP endpoint requires a mobile media publisher module. The current implementation preserves `playbackUrl`, `ingestUrl`, `whipUrl`, and `streamKey` on each session so that module can attach without changing the event UX or repository contract.
