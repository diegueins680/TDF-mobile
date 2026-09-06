import type { AnalyticsClient } from '../src/analytics/posthog';
import {
  classifyPartySelectorError,
  observePartySelectorSearch,
  recordPartySelectorAvatarFailure,
  recordPartySelectorSelection,
} from '../src/analytics/partySelectorTelemetry';

const buildAnalytics = () => {
  const capture = jest.fn();
  const analytics: AnalyticsClient = {
    ready: true,
    capture,
    identify: jest.fn(),
    reset: jest.fn(),
    screen: jest.fn(),
    __raw: null,
  };
  return { analytics, capture };
};

describe('mobile Party selector privacy-safe telemetry', () => {
  it('records aggregate latency and cardinality without query or Party identity', async () => {
    const { analytics, capture } = buildAnalytics();
    const times = [2_000, 2_075];
    await observePartySelectorSearch({
      analytics,
      context: 'event_invitation',
      pageKind: 'initial',
      now: () => times.shift() ?? 2_075,
      request: async () => ({ items: [{ partyId: 17 }], nextCursor: 15 }),
    });

    expect(capture).toHaveBeenCalledWith('party_selector_search_completed', {
      platform: 'mobile',
      context: 'event_invitation',
      page_kind: 'initial',
      latency_ms: 75,
      result_count: 1,
      has_more: true,
    });
    const serialized = JSON.stringify(capture.mock.calls);
    expect(serialized).not.toContain('partyId');
    expect(serialized).not.toContain('query');
  });

  it('classifies Axios cancellation, timeout, authorization, and server errors', () => {
    expect(classifyPartySelectorError({ code: 'ERR_CANCELED' })).toBe('cancelled');
    expect(classifyPartySelectorError({ code: 'ECONNABORTED' })).toBe('timeout');
    expect(classifyPartySelectorError({ response: { status: 403 } })).toBe('authorization');
    expect(classifyPartySelectorError({ response: { status: 503 } })).toBe('server');
  });

  it('does not include server error details in failure telemetry', async () => {
    const { analytics, capture } = buildAnalytics();
    const error = Object.assign(new Error('private backend detail'), { response: { status: 503 } });
    await expect(observePartySelectorSearch({
      analytics,
      context: 'social_connection',
      pageKind: 'load_more',
      request: async () => { throw error; },
    })).rejects.toBe(error);

    expect(capture).toHaveBeenCalledWith('party_selector_search_failed', expect.objectContaining({
      platform: 'mobile', context: 'social_connection', error_kind: 'server',
    }));
    expect(JSON.stringify(capture.mock.calls)).not.toContain('private backend detail');
  });

  it('records empty searches, avatar failures, and selection outcomes with safe dimensions', async () => {
    const { analytics, capture } = buildAnalytics();
    await observePartySelectorSearch({
      analytics,
      context: 'event_invitation',
      pageKind: 'initial',
      request: async () => ({ items: [], nextCursor: null }),
    });
    recordPartySelectorAvatarFailure(analytics, { context: 'event_invitation', partyType: 'person' });
    recordPartySelectorSelection(analytics, {
      context: 'event_invitation', mode: 'multiple', action: 'selected',
    });

    expect(capture).toHaveBeenCalledWith('party_selector_search_no_results', {
      platform: 'mobile', context: 'event_invitation',
    });
    expect(capture).toHaveBeenCalledWith('party_selector_avatar_failed', {
      platform: 'mobile', context: 'event_invitation', party_type: 'person',
    });
    expect(capture).toHaveBeenCalledWith('party_selector_selection_changed', {
      platform: 'mobile', context: 'event_invitation', mode: 'multiple', action: 'selected',
    });
  });
});
