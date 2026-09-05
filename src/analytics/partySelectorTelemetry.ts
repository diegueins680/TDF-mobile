import type { AnalyticsClient } from './posthog';

type SelectorPage = {
  items: unknown[];
  nextCursor?: unknown;
};

type TelemetryError = {
  code?: unknown;
  name?: unknown;
  response?: { status?: unknown };
  status?: unknown;
};

export type PartySelectorSelectionAction = 'selected' | 'removed' | 'replaced' | 'duplicate_rejected';

export function classifyPartySelectorError(error: unknown): string {
  const candidate = error && typeof error === 'object' ? error as TelemetryError : {};
  const status = candidate.status ?? candidate.response?.status;
  if (candidate.name === 'AbortError' || candidate.code === 'ERR_CANCELED') return 'cancelled';
  if (status === 408 || candidate.code === 'ECONNABORTED') return 'timeout';
  if (status === 401 || status === 403) return 'authorization';
  if (typeof status === 'number' && status >= 500) return 'server';
  if (typeof status === 'number' && status >= 400) return 'request';
  return 'network';
}

/** Emits only aggregate dimensions; never query text or Party identity data. */
export async function observePartySelectorSearch<T extends SelectorPage>({
  analytics,
  context,
  pageKind,
  request,
  now = Date.now,
}: {
  analytics: AnalyticsClient;
  context: string;
  pageKind: 'initial' | 'load_more';
  request: () => Promise<T>;
  now?: () => number;
}): Promise<T> {
  const startedAt = now();
  try {
    const page = await request();
    analytics.capture('party_selector_search_completed', {
      platform: 'mobile',
      context,
      page_kind: pageKind,
      latency_ms: Math.max(0, now() - startedAt),
      result_count: page.items.length,
      has_more: page.nextCursor != null,
    });
    if (pageKind === 'initial' && page.items.length === 0) {
      analytics.capture('party_selector_search_no_results', { platform: 'mobile', context });
    }
    return page;
  } catch (error) {
    const errorKind = classifyPartySelectorError(error);
    analytics.capture(
      errorKind === 'cancelled' ? 'party_selector_search_cancelled' : 'party_selector_search_failed',
      {
        platform: 'mobile',
        context,
        page_kind: pageKind,
        latency_ms: Math.max(0, now() - startedAt),
        ...(errorKind === 'cancelled' ? {} : { error_kind: errorKind }),
      },
    );
    throw error;
  }
}

export function recordPartySelectorAvatarFailure(
  analytics: AnalyticsClient,
  properties: { context: string; partyType: string },
): void {
  analytics.capture('party_selector_avatar_failed', {
    platform: 'mobile', context: properties.context, party_type: properties.partyType,
  });
}

export function recordPartySelectorSelection(
  analytics: AnalyticsClient,
  properties: {
    context: string;
    mode: 'single' | 'multiple';
    action: PartySelectorSelectionAction;
  },
): void {
  analytics.capture('party_selector_selection_changed', { platform: 'mobile', ...properties });
}

export function recordPartySelectorSelectionFailure(
  analytics: AnalyticsClient,
  properties: { context: string; mode: 'single' | 'multiple' },
): void {
  analytics.capture('party_selector_selection_failed', { platform: 'mobile', ...properties });
}
