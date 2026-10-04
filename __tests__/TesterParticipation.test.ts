import { feedbackMetadata, feedbackPromptDue, nextParticipation } from '../src/feedback/metadata';
describe('tester participation and privacy', () => {
  const now = 1800000000000;
  it('counts real opportunities, caps prompts and honors opt out', () => {
    const first = nextParticipation(null, now);
    expect(first.sessions).toBe(1);
    expect(nextParticipation(JSON.stringify(first), now + 1000).sessions).toBe(1);
    const second = nextParticipation(JSON.stringify(first), now + 31 * 60000);
    const third = nextParticipation(JSON.stringify(second), now + 62 * 60000);
    expect(feedbackPromptDue(second, now + 62 * 60000)).toBe(false);
    expect(feedbackPromptDue(third, now + 62 * 60000)).toBe(true);
    expect(feedbackPromptDue({ ...third, optedOut: true }, now + 62 * 60000)).toBe(false);
    expect(feedbackPromptDue({ ...third, dismissedUntil: now + 90 * 86400000 }, now + 62 * 60000)).toBe(false);
  });
  it('recovers corrupt storage without overcounting', () => {
    expect(nextParticipation('bad JSON', now).sessions).toBe(1);
    expect(nextParticipation('null', now).sessions).toBe(1);
    expect(nextParticipation('{"sessions": "999", "lastSession": "bad"}', now).sessions).toBe(1);
  });
  it('uses an allowlist, never spreading private input into metadata', () => {
    const input = { version: '1.0.1', build: '30', os: 'ios', osVersion: '18.3', locale: 'es', route: 'profile', environment: 'release', token: 'secret', email: 'private@example.com', username: 'tester' };
    const metadata = feedbackMetadata(input);
    expect(metadata.app_build).toBe('30'); expect(metadata.surface).toBe('profile');
    expect(JSON.stringify(metadata)).not.toMatch(/secret|private|tester|token|email|username/);
  });
});
