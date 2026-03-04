import { http, setAuthToken, getAuthToken } from '../src/api/client';

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
