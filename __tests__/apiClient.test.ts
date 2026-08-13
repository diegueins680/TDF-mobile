import { http, setAuthToken, getAuthToken, normalizeApiError } from '../src/api/client';
import axios from 'axios';

describe('API client auth header', () => {
  afterEach(() => {
    setAuthToken(null);
  });

  it('prefixes Bearer when saving a raw token', () => {
    setAuthToken('demo-token');
    expect(getAuthToken()).toBe('Bearer demo-token');
    expect(http.defaults.headers.common.Authorization).toBe('Bearer demo-token');
  });

  it('keeps Bearer prefix if already provided', () => {
    setAuthToken('Bearer demo-token');
    expect(getAuthToken()).toBe('Bearer demo-token');
  });

  it('normalizes bearer casing and strips extra spacing', () => {
    setAuthToken(' bearer    demo-token   ');
    expect(getAuthToken()).toBe('Bearer demo-token');
    expect(http.defaults.headers.common.Authorization).toBe('Bearer demo-token');
  });

  it('rejects bearer keyword without credentials', () => {
    setAuthToken('demo-token');
    setAuthToken('Bearer');
    expect(getAuthToken()).toBeUndefined();
    expect(http.defaults.headers.common.Authorization).toBeUndefined();
  });

  it('clears header when token is removed', () => {
    setAuthToken('demo-token');
    setAuthToken(null);
    expect(getAuthToken()).toBeUndefined();
    expect(http.defaults.headers.common.Authorization).toBeUndefined();
  });
});

describe('API client buyer errors', () => {
  it('turns inventory races into a useful action', () => {
    const original = {
      isAxiosError: true,
      message: 'Request failed',
      code: 'ERR_BAD_REQUEST',
      response: { status: 409, data: 'Not enough tickets available' },
    };
    const error = normalizeApiError(original);

    expect(error.message).toMatch(/acaban de agotarse|otra cantidad/i);
    expect(error).toBe(original);
    expect(axios.isAxiosError(error)).toBe(true);
    expect(axios.isAxiosError(error) ? error.response?.status : undefined).toBe(409);
  });

  it('distinguishes connectivity failures without dropping Axios metadata', () => {
    const original = {
      isAxiosError: true,
      message: 'Network Error',
      code: 'ERR_NETWORK',
      response: undefined,
    };
    const error = normalizeApiError(original);

    expect(error.message).toMatch(/internet/i);
    expect(error).toBe(original);
    expect(axios.isAxiosError(error) ? error.code : undefined).toBe('ERR_NETWORK');
  });

  it('asks the buyer to authenticate again for an expired session', () => {
    const error = normalizeApiError({
      isAxiosError: true,
      response: { status: 401, data: 'Unauthorized' },
    });
    expect(error.message).toMatch(/iniciar sesión/i);
  });

  it('explains a denied protected-catalog operation without hiding the authorization result', () => {
    const error = normalizeApiError({
      isAxiosError: true,
      response: { status: 403, data: {} },
    });
    expect(error.message).toMatch(/no tienes permiso/i);
  });

  it('preserves idempotency conflict reasons instead of labeling every 409 as sold out', () => {
    const original = {
      isAxiosError: true,
      message: 'Request failed',
      response: {
        status: 409,
        data: 'ticketPurchaseIdempotencyKey was already used for different checkout details',
      },
    };

    const error = normalizeApiError(original);

    expect(error).toBe(original);
    expect(error.message).toBe(
      'ticketPurchaseIdempotencyKey was already used for different checkout details',
    );
    expect(error.message).not.toMatch(/agotaron|otra cantidad/i);
  });
});
