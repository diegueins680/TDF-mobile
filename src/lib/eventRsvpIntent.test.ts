import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearEventRsvpIntent,
  eventRsvpIntentStorageKey,
  readEventRsvpIntent,
  saveEventRsvpIntent,
} from './eventRsvpIntent';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('event RSVP auth intent', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps only an expiring anonymous intent and matches the expected event', async () => {
    const intent = await saveEventRsvpIntent({
      eventId: '42', status: 'GOING', showOnProfile: true, origin: 'public_event_detail',
    }, 1_000);
    const raw = JSON.parse((await AsyncStorage.getItem(eventRsvpIntentStorageKey)) ?? '{}');
    expect(raw).not.toHaveProperty('partyId');
    expect(raw).not.toHaveProperty('email');
    expect(intent.returnTo).toBe('/eventos/42');
    expect(await readEventRsvpIntent('42', 1_001)).toEqual(intent);
    expect(await readEventRsvpIntent('43', 1_001)).toBeNull();
    expect(await readEventRsvpIntent('42', intent.expiresAt)).toBeNull();
  });

  it('survives auth failure until explicit completion or cancellation clears it', async () => {
    await saveEventRsvpIntent({ eventId: '7', status: 'INTERESTED', showOnProfile: false, origin: 'event_card' }, 5_000);
    expect(await readEventRsvpIntent('7', 5_001)).not.toBeNull();
    await clearEventRsvpIntent();
    expect(await readEventRsvpIntent('7', 5_002)).toBeNull();
  });
});
