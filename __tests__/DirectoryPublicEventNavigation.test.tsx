import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DirectoryPublicDetailScreen } from '../src/components/DirectoryPublicDetailScreen';
import { evaluateFeatureAccess, getFeaturesByMobilePath } from '../src/features/featureRegistry';

const mockPush = jest.fn();
jest.mock('expo-linking', () => ({ createURL: (path: string) => `tdf://${path.replace(/^\//, '')}` }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(({ queryKey }: { queryKey: unknown[] }) => ({
    data: queryKey[0] === 'directory-detail'
      ? { id: 42, title: 'Concierto público', startTime: '2030-04-10T20:00:00Z' } : [],
    isLoading: false,
  })),
  useInfiniteQuery: jest.fn(() => ({ data: { pages: [] } })),
  useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));
jest.mock('../src/providers/AuthProvider', () => ({ useAuth: () => ({ token: null }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../src/features/interactions/InteractionBar', () => ({ InteractionBar: () => null }));

it('opens full event information on a registered route that permits a guest', () => {
  render(<DirectoryPublicDetailScreen kind="event" identifier="42" />);
  fireEvent.press(screen.getByRole('button', { name: 'Ver evento y entradas' }));
  const destination = mockPush.mock.calls[0][0] as { pathname: string; params: { eventId: string } };
  const path = destination.pathname.replace('[eventId]', destination.params.eventId);
  const features = getFeaturesByMobilePath(path);
  expect(features.length).toBeGreaterThan(0);
  expect(features.some(feature => evaluateFeatureAccess(feature, { authenticated: false }, feature.routeAction).state === 'allowed')).toBe(true);
});

it('renders six ordered feed images on the public studio profile as a guest', () => {
  const files = Array.from({ length: 6 }, (_, i) => 'synthetic-' + i);
  const { useQuery } = jest.requireMock('@tanstack/react-query');
  useQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'directory-detail') return { data: {
      id: 'fixture', kind: 'studio', name: 'TDF Estudio', feed: [{ id: 'post', caption: 'Seis fotos', images: files }],
    } };
    if (queryKey[0] === 'directory-feed-image') return { data: 'data:image/png;base64,' + queryKey[2] };
    return { data: [] };
  });
  render(<DirectoryPublicDetailScreen kind="profile" identifier="tdf-records-estudio" />);
  expect(screen.getByText('Seis fotos')).toBeTruthy();
  files.forEach((file, i) => expect(screen.getByLabelText(`Foto ${i + 1} de TDF Estudio`).props.source.uri).toContain(file));
  expect(screen.queryByText('Administrar el Feed en la web')).toBeNull();
});
