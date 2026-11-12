import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EventMomentCard } from '../src/components/EventMomentCard';
import type { EventMoment } from '../src/types';

jest.mock('../src/features/interactions/InteractionBar', () => ({ InteractionBar: () => null }));
const moment: EventMoment = { id: '77', eventId: '42', authorName: 'Ana', authorPartyId: '7', caption: 'Original',
  media: { kind: 'text', uri: '', mimeType: 'text/plain' }, createdAt: '2026-10-26T08:00:00Z',
  updatedAt: '2026-10-26T08:00:00.123456Z', reactions: {}, comments: [] };
const edit = jest.fn(); const remove = jest.fn();
const show = (item = moment, currentPartyId: string | null = '7', locale = 'es', enabled = true) => render(
  <EventMomentCard moment={item} locale={locale} currentActorKey={`party:${currentPartyId}`} currentPartyId={currentPartyId}
    reactionOptions={[]} reactionUnavailableLabel="Unavailable" commentDraft="" onChangeComment={jest.fn()}
    onSubmitComment={jest.fn()} onToggleReaction={jest.fn()} onEditMoment={enabled ? edit : undefined}
    onDeleteMoment={enabled ? remove : undefined} />,
);
beforeEach(() => jest.clearAllMocks());

it.each([['es', 'Editar recuerdo', 'Eliminar recuerdo'], ['en', 'Edit memory', 'Delete memory']])(
  'shows accessible author actions in %s and passes the actual publication', (locale, editLabel, deleteLabel) => {
    show(moment, '7', locale);
    fireEvent.press(screen.getByRole('button', { name: editLabel }));
    fireEvent.press(screen.getByRole('button', { name: deleteLabel }));
    expect(edit).toHaveBeenCalledWith(moment); expect(remove).toHaveBeenCalledWith(moment);
  });

it.each([
  [{ ...moment, authorPartyId: '8', authorName: 'Ana' }, '7', true],
  [{ ...moment, authorPartyId: null }, '7', true],
  [moment, null, true], [moment, '7', false],
  [{ ...moment, id: 'moment-local-draft' }, '7', true],
] as const)('does not infer ownership from display names or local IDs %#', (item, owner, enabled) => {
  show(item, owner, 'es', enabled);
  expect(screen.queryByRole('button', { name: 'Editar recuerdo' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Eliminar recuerdo' })).toBeNull();
});

it('does not invent an edit version for legacy records', () => {
  show({ ...moment, updatedAt: undefined });
  expect(screen.queryByRole('button', { name: 'Editar recuerdo' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Eliminar recuerdo' })).toBeTruthy();
});
