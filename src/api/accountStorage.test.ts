jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../lib/api', () => ({ API_BASE: 'https://api.tdf.test' }));
const mockBinding = { authorization: 'Bearer owner-a', signal: new AbortController().signal, version: 1 };
jest.mock('./client', () => ({
  getAuthToken: () => 'Bearer owner-a',
  captureAuthSession: () => mockBinding,
  assertAuthSession: jest.fn(),
}));
import { assertAuthSession } from './client';
import { uploadAccountMedia, readPrivateStorageFile } from './accountStorage';

const fetchMock = jest.fn();
const input = { uri: 'file:///private.bin', destination: 'tdf' as const, idempotencyKey: 'a'.repeat(64) };
beforeEach(() => { jest.clearAllMocks(); global.fetch = fetchMock; process.env.EXPO_PUBLIC_CONTENT_STORAGE_ENABLED = 'true'; });
afterAll(() => { delete process.env.EXPO_PUBLIC_CONTENT_STORAGE_ENABLED; });

it('requires explicit destination, stable identity and owner-bound personal consent', async () => {
  await expect(uploadAccountMedia({ uri: 'file:///private.bin' })).rejects.toThrow('Selecciona');
  await expect(uploadAccountMedia({ ...input, idempotencyKey: undefined })).rejects.toThrow('identidad estable');
  await expect(uploadAccountMedia({ ...input, destination: 'google_drive', connectionHandle: 'raw-google-token' })).rejects.toThrow('Conecta');
  await expect(uploadAccountMedia({ ...input, connectionHandle: 'another-destination' })).rejects.toThrow('personal');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('preserves private links and request identity instead of advertising public access', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ duFileId: 'file', duWebContentLink: '/storage/files/00000000-0000-4000-8000-000000000001', duPublicUrl: null }) });
  await expect(uploadAccountMedia(input)).resolves.toContain('/storage/files/');
  expect(fetchMock).toHaveBeenCalledWith('https://api.tdf.test/drive/upload', expect.objectContaining({ signal: mockBinding.signal, headers: { Authorization: mockBinding.authorization } }));
  expect(assertAuthSession).toHaveBeenCalledTimes(2);
});

it('does not read private bytes after a session changes', async () => {
  (assertAuthSession as jest.Mock).mockImplementationOnce(() => { throw new Error('session changed'); });
  const arrayBuffer = jest.fn();
  fetchMock.mockResolvedValue({ ok: true, arrayBuffer });
  await expect(readPrivateStorageFile('00000000-0000-4000-8000-000000000001')).rejects.toThrow('session changed');
  expect(arrayBuffer).not.toHaveBeenCalled();
});

it.each([undefined, 'false', 'TRUE', '1'])('keeps new account uploads unavailable before literal activation (%s)', async (value) => {
  if (value === undefined) delete process.env.EXPO_PUBLIC_CONTENT_STORAGE_ENABLED; else process.env.EXPO_PUBLIC_CONTENT_STORAGE_ENABLED = value;
  await expect(uploadAccountMedia(input)).rejects.toThrow('todavía no está habilitado');
  expect(fetchMock).not.toHaveBeenCalled();
});
