import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { EventMomentCard } from '../src/components/EventMomentCard';

const reaction = {
  id: '50800000-0000-4000-8000-000000000001',
  code: 'fire',
  label: 'Fuego',
  nameEs: 'Fuego',
  nameEn: 'Fire',
  emoji: '🔥',
};

const moment = {
  id: 'moment-local-77',
  eventId: '42',
  authorName: 'Andrea',
  media: {
    kind: 'image' as const,
    uri: 'https://example.com/moment.jpg',
    mimeType: 'image/jpeg',
  },
  createdAt: '2026-04-10T21:00:00.000Z',
  reactions: {},
  comments: [],
};

const renderCard = (
  onToggleReaction: jest.Mock,
  onReactionPosted: jest.Mock,
  locale = 'es',
) => render(
  <EventMomentCard
    moment={moment}
    locale={locale}
    currentActorKey="party:7"
    currentPartyId="7"
    reactionOptions={[reaction]}
    reactionUnavailableLabel="Sin reacciones"
    commentDraft=""
    onChangeComment={jest.fn()}
    onSubmitComment={jest.fn()}
    onToggleReaction={onToggleReaction}
    onReactionPosted={onReactionPosted}
  />,
);

describe('EventMomentCard reaction activation', () => {
  it('reports a reaction only when the mutation confirms activation', async () => {
    const onToggleReaction = jest.fn().mockResolvedValue(true);
    const onReactionPosted = jest.fn();
    renderCard(onToggleReaction, onReactionPosted);

    fireEvent.press(screen.getByRole('button', { name: 'Fuego' }));

    await waitFor(() => expect(onToggleReaction).toHaveBeenCalledWith('moment-local-77', reaction, true));
    await waitFor(() => expect(onReactionPosted).toHaveBeenCalledTimes(1));
  });

  it('does not report removal or local-only fallback as activation', async () => {
    const onToggleReaction = jest.fn().mockResolvedValue(false);
    const onReactionPosted = jest.fn();
    renderCard(onToggleReaction, onReactionPosted);

    fireEvent.press(screen.getByRole('button', { name: 'Fuego' }));

    await waitFor(() => expect(onToggleReaction).toHaveBeenCalledTimes(1));
    expect(onReactionPosted).not.toHaveBeenCalled();
  });

  it('does not report a failed mutation as activation', async () => {
    const onToggleReaction = jest.fn().mockRejectedValue(new Error('offline'));
    const onReactionPosted = jest.fn();
    renderCard(onToggleReaction, onReactionPosted);

    fireEvent.press(screen.getByRole('button', { name: 'Fuego' }));

    await waitFor(() => expect(onToggleReaction).toHaveBeenCalledTimes(1));
    expect(onReactionPosted).not.toHaveBeenCalled();
  });

  it('uses the selected locale for copy, catalog labels, and accessible names', () => {
    render(
      <EventMomentCard
        moment={{ ...moment, authorPartyId: '8' }}
        locale="en"
        currentActorKey="party:7"
        currentPartyId="7"
        featured
        reactionOptions={[reaction]}
        reactionUnavailableLabel="Reactions unavailable"
        commentDraft=""
        onChangeComment={jest.fn()}
        onSubmitComment={jest.fn()}
        onToggleReaction={jest.fn()}
        onConnectAuthor={jest.fn()}
        onOpenMedia={jest.fn()}
      />,
    );

    expect(screen.getByText('Featured moment')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fire' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View photo by Andrea' })).toBeTruthy();
    expect(screen.getByText('0 reactions · 0 comments')).toBeTruthy();
    expect(screen.getByLabelText('Write a comment')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
    expect(screen.queryByText('Fuego')).toBeNull();
  });
});


describe('extended moment rendering', () => {
  it.each(['es', 'en'])('shows written memories without a broken image or file action (%s)', (locale) => {
    const open = jest.fn();
    render(<EventMomentCard moment={{ ...moment, caption: 'El último coro', media: { kind: 'text', uri: '', mimeType: 'text/plain' } }}
      locale={locale} currentActorKey="party:7" reactionOptions={[]} reactionUnavailableLabel="No reactions"
      commentDraft="" onChangeComment={jest.fn()} onSubmitComment={jest.fn()} onToggleReaction={jest.fn()} onOpenMedia={open} />);
    expect(screen.getByText('El último coro')).toBeTruthy();
    expect(screen.queryByRole('image')).toBeNull();
    expect(screen.queryByLabelText(/Abrir video|Open video/)).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it.each([['es', 'Abrir audio de Andrea', 'Audio del evento'], ['en', 'Open audio by Andrea', 'Event audio']])(
    'offers a named audio action with the correct media (%s)', (locale, label, title) => {
      const open = jest.fn();
      const media = { kind: 'audio' as const, uri: 'https://example.test/audio.mp3', mimeType: 'audio/mpeg' };
      render(<EventMomentCard moment={{ ...moment, media }} locale={locale} currentActorKey="party:7" reactionOptions={[]}
        reactionUnavailableLabel="No reactions" commentDraft="" onChangeComment={jest.fn()} onSubmitComment={jest.fn()}
        onToggleReaction={jest.fn()} onOpenMedia={open} />);
      expect(screen.getByText(title)).toBeTruthy();
      fireEvent.press(screen.getByRole('button', { name: label }));
      expect(open).toHaveBeenCalledWith(media);
    });
});
