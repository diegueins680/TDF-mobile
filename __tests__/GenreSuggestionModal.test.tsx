import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { Taxonomy } from '../src/api/taxonomy';
import { GenreSuggestionModal, MyGenreSuggestions } from '../src/features/taxonomyFilters/GenreSuggestionModal';

const ROCK = '66666666-6666-4666-8666-666666666666';
const NEW_GENRE = '99999999-9999-4999-8999-999999999999';

// The first render of the modal is slow on a cold transform cache.
jest.setTimeout(20_000);

jest.mock('../src/api/taxonomy', () => ({
  Taxonomy: {
    filterOptions: jest.fn(),
    checkGenreSuggestion: jest.fn(),
    submitGenreSuggestion: jest.fn(),
    myGenreSuggestions: jest.fn(),
  },
}));

const check = Taxonomy.checkGenreSuggestion as jest.Mock;
const submit = Taxonomy.submitGenreSuggestion as jest.Mock;

const suggestion = (overrides: Record<string, unknown> = {}) => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  status: 'pending',
  submittedName: 'Rokc andino',
  nameEs: 'Rock andino',
  nameEn: 'Andean rock',
  reviewReasons: [],
  suggestedBy: { partyId: 7 },
  automatic: false,
  createdAt: '2026-11-21T10:00:00Z',
  ...overrides,
});

const checkResult = (overrides: Record<string, unknown> = {}) => ({
  verdict: 'review',
  nameEs: 'Rock andino',
  nameEn: 'Andean rock',
  normalizedKey: 'rock andino',
  corrections: [],
  reviewReasons: [],
  ...overrides,
});

const renderModal = (language: 'es' | 'en' = 'es') => {
  const onGenreReady = jest.fn();
  const onClose = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <GenreSuggestionModal visible onClose={onClose} onGenreReady={onGenreReady} language={language} />
    </QueryClientProvider>,
  );
  return { onGenreReady, onClose };
};

const fillAndCheck = (nameEs: string, nameEn?: string) => {
  fireEvent.changeText(screen.getByLabelText('Nombre en español'), nameEs);
  if (nameEn) fireEvent.changeText(screen.getByLabelText('Nombre en inglés'), nameEn);
  fireEvent.press(screen.getByRole('button', { name: 'Revisar' }));
};

describe('Genre suggestion modal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Taxonomy.filterOptions as jest.Mock).mockResolvedValue({
      countries: [], regions: [], cities: [],
      genres: [{ id: ROCK, parentId: null, code: 'rock', nameEs: 'Rock', nameEn: 'Rock' }],
    });
  });

  it('requires a new check if the draft changes before the verdict arrives', async () => {
    let finish!: (value: ReturnType<typeof checkResult>) => void;
    check.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    renderModal();
    fillAndCheck('rock');
    await waitFor(() => expect(check).toHaveBeenCalled());
    fireEvent.changeText(screen.getByLabelText('Nombre en español'), 'jazz');
    await act(async () => { finish(checkResult({ verdict: 'approve' })); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Revisar' }).props.accessibilityState.disabled).toBe(false));
    expect(submit).not.toHaveBeenCalled();
  });

  it('offers the near match or a confirmed distinct submission for a probable typo', async () => {
    check.mockResolvedValue(checkResult({
      verdict: 'similar', nameEs: 'Rokc', nameEn: 'Rokc',
      match: { id: ROCK, nameEs: 'Rock', nameEn: 'Rock', parentId: null },
      corrections: [{ word: 'Rokc', suggestion: 'Rock' }],
    }));
    submit.mockResolvedValue({ suggestion: suggestion(), alreadySuggested: false, check: checkResult() });
    renderModal();

    fillAndCheck('rokc');
    expect(await screen.findByText('¿Quisiste decir «Rock»?')).toBeTruthy();
    expect(screen.getByText('Se guardará como «Rokc» / «Rokc».')).toBeTruthy();
    expect(screen.getByText('¿«Rokc» quiso ser «Rock»?')).toBeTruthy();
    expect(check).toHaveBeenCalledWith({ nameEs: 'rokc', nameEn: 'rokc', parentGenreId: null });

    fireEvent.press(screen.getByRole('button', { name: 'Es un género distinto, enviar' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ nameEs: 'rokc', nameEn: 'rokc', parentGenreId: null, confirmDistinct: true }));
    expect(await screen.findByText('Enviada. Aparecerá en tu perfil como pendiente hasta que se revise.')).toBeTruthy();
  });

  it('uses the existing genre for a duplicate without submitting', async () => {
    check.mockResolvedValue(checkResult({ verdict: 'duplicate', nameEs: 'Rock', nameEn: 'Rock', match: { id: ROCK, nameEs: 'Rock', nameEn: 'Rock' } }));
    const { onGenreReady, onClose } = renderModal();

    fillAndCheck('rock');
    expect(await screen.findByText('«Rock» ya existe. Puedes elegirlo directamente.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Usar Rock' }));

    expect(onGenreReady).toHaveBeenCalledWith({ id: ROCK, name: 'Rock' });
    expect(onClose).toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('adds an automatically approved genre to the profile', async () => {
    check.mockResolvedValue(checkResult({ verdict: 'approve' }));
    submit.mockResolvedValue({
      suggestion: suggestion({ status: 'approved', automatic: true, resolvedGenre: { id: NEW_GENRE, nameEs: 'Rock andino', nameEn: 'Andean rock' } }),
      alreadySuggested: false,
      check: checkResult({ verdict: 'approve' }),
    });
    const { onGenreReady } = renderModal('en');

    fireEvent.changeText(screen.getByLabelText('Spanish name'), 'rock andino');
    fireEvent.changeText(screen.getByLabelText('English name'), 'andean rock');
    fireEvent.press(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('All good: it will be published as soon as you send it.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(onGenreReady).toHaveBeenCalledWith({ id: NEW_GENRE, name: 'Andean rock' }));
    expect(screen.getByText('“Andean rock” is now available and was added to your profile.')).toBeTruthy();
  });

  it('shows the refusing check when the submission conflicts with an existing genre', async () => {
    check.mockResolvedValue(checkResult({ verdict: 'review' }));
    const conflict = Object.assign(new Error('conflict'), {
      isAxiosError: true,
      response: { status: 409, data: checkResult({ verdict: 'duplicate', nameEs: 'Rock', nameEn: 'Rock', match: { id: ROCK, nameEs: 'Rock', nameEn: 'Rock' } }) },
    });
    submit.mockRejectedValue(conflict);
    renderModal();

    fillAndCheck('rock andino');
    expect(await screen.findByText('Un administrador revisará esta sugerencia antes de publicarla.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('button', { name: 'Usar Rock' })).toBeTruthy();
  });
});

describe('My genre suggestions', () => {
  it('lists pending suggestions as chips and rejected ones with the review note', async () => {
    (Taxonomy.myGenreSuggestions as jest.Mock).mockResolvedValue([
      suggestion(),
      suggestion({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: 'rejected', nameEs: 'Ruido', nameEn: 'Noise', reviewNote: 'Ya existe como Noise rock' }),
      suggestion({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', status: 'approved', nameEs: 'Cumbia rock', nameEn: 'Cumbia rock' }),
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(<QueryClientProvider client={client}><MyGenreSuggestions language="es" /></QueryClientProvider>);

    expect(await screen.findByText('Rock andino · pendiente')).toBeTruthy();
    expect(screen.getByText('«Ruido» no fue aprobada: Ya existe como Noise rock')).toBeTruthy();
    expect(screen.queryByText(/Cumbia rock/)).toBeNull();
  });
});
