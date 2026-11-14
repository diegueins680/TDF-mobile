import { getDocumentAsync } from 'expo-document-picker';

import { MAX_MOMENT_AUDIO_BYTES, momentAudioFromAsset, selectMomentAudio } from '../src/lib/momentAudio';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const asset = { name: 'recuerdo.wav', uri: 'file:///cache/recuerdo.wav', mimeType: 'audio/wav', size: 200, lastModified: 0 };
beforeEach(() => jest.resetAllMocks());

it.each([
  ['clip.mp3', 'audio/mp3', 'audio/mpeg'],
  ['clip.M4A', 'audio/x-m4a', 'audio/mp4'],
  ['clip.wav', 'audio/x-wav', 'audio/wav'],
  ['clip.ogg', 'application/ogg', 'audio/ogg'],
  ['clip.flac', 'audio/x-flac', 'audio/flac'],
])('accepts server-supported audio and normalizes provider aliases: %s', (name, mimeType, expected) => {
  expect(momentAudioFromAsset({ ...asset, name, mimeType })).toEqual({
    kind: 'audio', uri: asset.uri, fileName: name, mimeType: expected,
  });
});

it.each([undefined, 'application/octet-stream'])('uses the supported extension when the provider omits MIME (%s)', (mimeType) => {
  expect(momentAudioFromAsset({ ...asset, mimeType }).mimeType).toBe('audio/wav');
});

it.each([
  { name: 'clip.aac', mimeType: 'audio/aac' },
  { name: 'clip.mp3', mimeType: 'audio/wav' },
  { name: 'clip.wav', mimeType: 'text/html' },
  { name: 'clip.wav', mimeType: 'audio/wav; filename=attack.html' },
  { name: 'clip.constructor', mimeType: undefined },
  { name: 'clip.mp3.html', mimeType: 'audio/mpeg' },
])('rejects unsupported files and conflicting metadata %#', (invalid) => {
  expect(() => momentAudioFromAsset({ ...asset, ...invalid })).toThrow('format');
});

it.each([0, -1, NaN, Infinity, 0.5, MAX_MOMENT_AUDIO_BYTES + 1])('rejects invalid or oversized reported size %s', (size) => {
  expect(() => momentAudioFromAsset({ ...asset, size })).toThrow('size');
});

it('retains the exact server byte limit and permits missing size for server validation', () => {
  expect(momentAudioFromAsset({ ...asset, size: MAX_MOMENT_AUDIO_BYTES }).kind).toBe('audio');
  expect(momentAudioFromAsset({ ...asset, size: undefined }).kind).toBe('audio');
});

it.each([
  { uri: 'https://external.test/private.wav' }, { uri: 'data:audio/wav;base64,a' },
  { uri: '' }, { uri: 'file:///cache/a\n.wav' },
  { name: '../clip.wav' }, { name: 'clip\r\n.wav' },
])('rejects remote URIs, unsafe paths and metadata %#', (invalid) => {
  expect(() => momentAudioFromAsset({ ...asset, ...invalid })).toThrow('file');
});

it('supports document-provider URIs and local file names containing spaces', () => {
  expect(momentAudioFromAsset({ ...asset, uri: 'content://provider/doc/12' }).uri).toBe('content://provider/doc/12');
  expect(momentAudioFromAsset({ ...asset, uri: 'file:///cache/field recording.wav', name: 'field recording.wav' }).fileName)
    .toBe('field recording.wav');
});

it('requests a readable cached copy only on explicit selection', async () => {
  expect(getDocumentAsync).not.toHaveBeenCalled();
  jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [asset] });
  await expect(selectMomentAudio()).resolves.toEqual([expect.objectContaining({ kind: 'audio', fileName: asset.name })]);
  expect(getDocumentAsync).toHaveBeenCalledWith({ type: ['audio/*', 'application/ogg'], multiple: false, copyToCacheDirectory: true });
});

it('treats cancellation as no selection and preserves provider errors for actionable feedback', async () => {
  jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: true, assets: null });
  await expect(selectMomentAudio()).resolves.toEqual([]);
  jest.mocked(getDocumentAsync).mockRejectedValueOnce(new Error('Provider unavailable'));
  await expect(selectMomentAudio()).rejects.toThrow('Provider unavailable');
});

it('rejects unexpected multiple or missing assets without silently choosing one', async () => {
  jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [asset, asset] });
  await expect(selectMomentAudio()).rejects.toThrow('file');
  jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [] });
  await expect(selectMomentAudio()).rejects.toThrow('file');
});
