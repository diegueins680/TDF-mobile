jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../lib/api', () => ({ UPLOAD_BASE: 'https://api.tdf.test/assets/upload' }));
jest.mock('./client', () => ({ getAuthToken: () => 'Bearer synthetic-owner' }));
import { uploadImage, uploadMedia } from './upload';
const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); global.fetch = fetchMock;
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ publicUrl: 'https://assets.example.test/synthetic' }) });
});
it.each([
  { uri: 'file:///inventory.jpg', mimeType: 'image/jpeg', fileName: 'inventory.jpg' },
  { uri: 'file:///inventory-receipt.pdf', mimeType: 'application/pdf', fileName: 'inventory-receipt.pdf' },
])('preserves the corporate upload contract without a personal destination ($fileName)', async (input) => {
  await expect(uploadMedia(input)).resolves.toBe('https://assets.example.test/synthetic');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('https://api.tdf.test/assets/upload', expect.objectContaining({ headers: { Authorization: 'Bearer synthetic-owner' }, method: 'POST' }));
});
it('preserves the existing corporate image wrapper', async () => {
  await expect(uploadImage({ uri: 'file:///inventory.jpg' })).resolves.toBe('https://assets.example.test/synthetic');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
