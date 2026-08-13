const mockGet = jest.fn();
const mockPut = jest.fn();

jest.mock('../src/api/client', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  put: (...args: unknown[]) => mockPut(...args),
}));

import { getLocalePreferences, updateLocalePreferences } from '../src/api/preferences';

describe('mobile locale preference canonical reference contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the canonical preference resource', async () => {
    mockGet.mockResolvedValueOnce({});

    await getLocalePreferences();

    expect(mockGet).toHaveBeenCalledWith('/session/preferences');
  });

  it('writes UUID identities without copied locale, currency, or country codes', async () => {
    mockPut.mockResolvedValueOnce({});
    const payload = {
      localeId: '11111111-1111-4111-8111-111111111111',
      currencyId: '22222222-2222-4222-8222-222222222222',
      timezone: 'America/Guayaquil',
      countryId: '33333333-3333-4333-8333-333333333333',
    };

    await updateLocalePreferences(payload);

    expect(mockPut).toHaveBeenCalledWith('/session/preferences', payload);
    expect(mockPut.mock.calls[0]?.[1]).not.toHaveProperty('locale');
    expect(mockPut.mock.calls[0]?.[1]).not.toHaveProperty('currency');
    expect(mockPut.mock.calls[0]?.[1]).not.toHaveProperty('countryCode');
  });
});
