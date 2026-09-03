import { http, normalizeApiError } from './client';

export type PartySelectorOption = {
  partyId: number;
  partyType: 'person' | 'organization';
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  secondaryLabel: string | null;
  accountStatus: 'active' | 'inactive' | 'no-account';
};

type PartySelectorPage = { items: PartySelectorOption[]; nextCursor: number | null };

export async function searchPartiesForSelector(
  query: string,
  options: { kind?: 'any' | 'person' | 'organization'; accountOnly?: boolean; excludedPartyIds?: number[]; signal?: AbortSignal } = {},
): Promise<PartySelectorPage> {
  try {
    const response = await http.get<PartySelectorPage>('/parties/search', {
      signal: options.signal,
      params: {
        q: query,
        kind: options.kind ?? 'person',
        accountOnly: options.accountOnly ?? true,
        excludePartyId: options.excludedPartyIds ?? [],
        limit: 15,
      },
    });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}
