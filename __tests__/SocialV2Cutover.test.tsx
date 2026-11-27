import React from 'react';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  http: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'uuid-test') }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-qrcode-svg', () => () => null);

let mockScan: ((event: { data: string }) => void) | null = null;
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [{ granted: true }, jest.fn(async () => ({ granted: true }))],
  CameraView: (props: { onBarcodeScanned: (event: { data: string }) => void }) => {
    mockScan = props.onBarcodeScanned;
    return null;
  },
}));
jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({ token: 'Bearer demo', partyId: '42', session: { displayName: 'Demo Fan' }, loading: false })),
}));
jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: jest.fn(() => ({ locale: 'es' })),
}));
jest.mock('../src/analytics/AnalyticsProvider', () => ({ useAnalytics: () => ({ capture: jest.fn() }) }));
jest.mock('../src/lib/firstValueCompletion', () => ({ recordFirstValueCompletion: jest.fn(async () => false) }));
jest.mock('../src/api/fanArtists', () => ({
  FanArtists: { list: jest.fn(async () => []), listFollows: jest.fn(async () => []), follow: jest.fn() },
}));

import { setAuthToken } from '../src/api/client';
import { resetSocialV2ActivationMemo } from '../src/api/socialV2';

const SocialScreen = require('../app/(tabs)/social').default;
const VCardScreen = require('../app/(tabs)/vcard').default;
const { http } = jest.requireMock('../src/api/client') as {
  http: { get: jest.Mock; post: jest.Mock; put: jest.Mock; delete: jest.Mock };
};

const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data: '' } });
const state = (overrides: Record<string, unknown> = {}) => ({
  partyId: 9, revision: 2, following: false, requested: false, incoming: false,
  connected: false, blocked: false, muted: false, dismissed: false, ...overrides,
});
const legacyFollow = {
  pfFollowerId: 9, pfFollowingId: 42, pfFollowerName: 'Fan Dos', pfFollowingName: 'Demo Fan',
  pfStartedAt: '2026-06-18', pfViaNfc: false,
};

type Routes = Record<string, () => unknown>;
const routeGets = (routes: Routes) => {
  http.get.mockImplementation(async (url: string) => {
    const handler = routes[url];
    if (!handler) throw httpError(404);
    return { data: handler() };
  });
};

const openFollowers = async () => {
  fireEvent.press(await screen.findByLabelText('Seguidores, 1 conexiones'));
};

const clients: QueryClient[] = [];
const renderWithClient = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

let alertSpy: jest.SpyInstance;
beforeEach(async () => {
  jest.clearAllMocks();
  mockScan = null;
  setAuthToken('demo');
  resetSocialV2ActivationMemo();
  await AsyncStorage.clear();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  alertSpy.mockRestore();
  // Release React Query cache timers so Jest can exit.
  clients.splice(0).forEach((client) => client.clear());
});

describe('Social screen runtime cutover', () => {
  it('shows a mode error without reading legacy relationships on an invalid response', async () => {
    routeGets({ '/social/v2/me': () => ({}) });
    renderWithClient(<SocialScreen />);
    await screen.findByText(/No se pudo comprobar el estado/, {}, { timeout: 4000 });
    expect(http.get.mock.calls.map(([url]) => url)).not.toContain('/social/friends');
    expect(http.get.mock.calls.map(([url]) => url)).not.toContain('/social/followers');
  });

  it('keeps the legacy network while v2 answers 404 (before server activation)', async () => {
    routeGets({
      '/social/followers': () => [legacyFollow],
      '/social/following': () => [],
    });
    renderWithClient(<SocialScreen />);
    await openFollowers();
    expect(await screen.findByText('Fan Dos')).toBeTruthy();
    expect(screen.getByLabelText('Seguir a Fan Dos')).toBeTruthy();
    expect(http.get).toHaveBeenCalledWith('/social/v2/me');
    expect(screen.queryByText('Tu comunidad musical')).toBeNull();
  });

  it('switches to v2 with a clear message when a legacy follow returns 410', async () => {
    let v2Live = false;
    routeGets({
      '/social/followers': () => [legacyFollow],
      '/social/following': () => [],
    });
    http.get.mockImplementation(async (url: string) => {
      if (url === '/social/v2/me') {
        if (!v2Live) throw httpError(404);
        return { data: { discoverable: false, personalized: true, revision: 0, relationships: [] } };
      }
      if (url === '/social/followers') return { data: [legacyFollow] };
      if (url === '/social/following') return { data: [] };
      throw httpError(404);
    });
    http.post.mockImplementation(async () => {
      v2Live = true;
      throw httpError(410);
    });
    renderWithClient(<SocialScreen />);
    await openFollowers();
    fireEvent.press(await screen.findByLabelText('Seguir a Fan Dos'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Vista social actualizada', expect.stringContaining('Seguir o Conectar')));
    expect(await screen.findByText('Tu comunidad musical')).toBeTruthy();
    expect(screen.queryByLabelText('Seguir a Fan Dos')).toBeNull();
  });

  it('uses only v2 once it is live: relationships, consent request and no legacy calls', async () => {
    routeGets({
      '/social/v2/me': () => ({
        discoverable: false, personalized: true, revision: 0,
        relationships: [{ ...state(), displayName: 'Ana' }],
      }),
    });
    http.post.mockResolvedValueOnce({ data: state({ revision: 3, requested: true }) });
    renderWithClient(<SocialScreen />);
    expect(await screen.findByText('Tu comunidad musical')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Conectar: Ana'));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/social/v2/relationships/9', {
      operation: 'request', expectedRevision: 2, requestKey: 'uuid-test',
    }, expect.any(Object)));
    const legacyCalls = http.get.mock.calls.map(([url]) => url).filter((url: string) => !url.startsWith('/social/v2/'));
    expect(legacyCalls).toEqual([]);
  });

  it('updates v2 preferences with the current revision', async () => {
    routeGets({ '/social/v2/me': () => ({ discoverable: false, personalized: true, revision: 4, relationships: [] }) });
    http.put.mockResolvedValueOnce({ data: { discoverable: true, personalized: true, revision: 5 } });
    renderWithClient(<SocialScreen />);
    const toggle = await screen.findByLabelText('Mostrar mi perfil en Descubrir');
    await act(async () => { fireEvent(toggle, 'valueChange', true); });
    expect(http.put).toHaveBeenCalledWith('/social/v2/preferences', { discoverable: true, personalized: true, expectedRevision: 4 });
  });

  it('shows a maintenance notice and no legacy write controls when v2 is paused after activation', async () => {
    await AsyncStorage.setItem(`tdf.social.v2-activated:${jest.requireActual('../src/lib/api').API_BASE}`, 'true');
    routeGets({ '/social/followers': () => [legacyFollow], '/social/following': () => [] });
    renderWithClient(<SocialScreen />);
    expect(await screen.findByText(/Estamos actualizando la red social/)).toBeTruthy();
    await openFollowers();
    expect(await screen.findByText('Fan Dos')).toBeTruthy();
    expect(screen.queryByLabelText('Seguir a Fan Dos')).toBeNull();
  });
});

describe('vCard screen runtime cutover', () => {
  const scanAna = async () => {
    fireEvent.press(await screen.findByText('Abrir cámara'));
    await waitFor(() => expect(mockScan).not.toBeNull());
    act(() => mockScan?.({ data: JSON.stringify({ kind: 'vcard-exchange', name: 'Ana', partyId: 9, ts: 1 }) }));
  };

  it('keeps the CRM exchange closed when the mode lookup fails', async () => {
    routeGets({ '/social/v2/me': () => { throw httpError(401); } });
    renderWithClient(<VCardScreen />);
    await scanAna();
    await screen.findByText(/No se pudo comprobar el estado/, {}, { timeout: 4000 });
    expect(screen.queryByText('Enviar intercambio al CRM')).toBeNull();
    expect(http.post).not.toHaveBeenCalled();
  });

  it('replaces the server vCard exchange with a v2 connection request', async () => {
    routeGets({
      '/social/v2/me': () => ({ discoverable: false, personalized: true, revision: 0, relationships: [] }),
      '/social/v2/relationships/9': () => state(),
    });
    http.post.mockResolvedValueOnce({ data: state({ revision: 3, requested: true }) });
    renderWithClient(<VCardScreen />);
    await scanAna();
    expect(screen.queryByText('Enviar intercambio al CRM')).toBeNull();
    fireEvent.press(await screen.findByText('Conectar'));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/social/v2/relationships/9', {
      operation: 'request', expectedRevision: 2, requestKey: 'uuid-test',
    }, expect.any(Object)));
    expect(http.post).not.toHaveBeenCalledWith('/social/vcard-exchange', expect.anything());
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Listo', expect.stringContaining('debe aceptarla')));
  });

  it('keeps the legacy exchange before activation and explains a 410', async () => {
    routeGets({});
    http.post.mockRejectedValueOnce(httpError(410));
    renderWithClient(<VCardScreen />);
    await scanAna();
    fireEvent.press(await screen.findByText('Enviar intercambio al CRM'));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/social/vcard-exchange', { vcerPartyId: 9 }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Vista social actualizada', expect.stringContaining('Conectar o Seguir')));
  });

  it('refuses to connect with your own code', async () => {
    routeGets({ '/social/v2/me': () => ({ discoverable: false, personalized: true, revision: 0, relationships: [] }) });
    renderWithClient(<VCardScreen />);
    fireEvent.press(await screen.findByText('Abrir cámara'));
    await waitFor(() => expect(mockScan).not.toBeNull());
    act(() => mockScan?.({ data: JSON.stringify({ kind: 'vcard-exchange', name: 'Yo', partyId: 42, ts: 1 }) }));
    fireEvent.press(await screen.findByText('Conectar'));
    expect(alertSpy).toHaveBeenCalledWith('Es tu código', expect.any(String));
    expect(http.post).not.toHaveBeenCalled();
  });
});
