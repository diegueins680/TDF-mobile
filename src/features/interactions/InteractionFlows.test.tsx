import type { ReactElement } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessibilityInfo, FlatList, Text, View } from 'react-native';
import type { InteractionComment, InteractionSummary } from '../../api/interactions';
import { InteractionBar } from './InteractionBar';
import { CommentComposer } from './CommentComposer';
import DiscussionScreen from './DiscussionScreen';
import { DiscussionControls } from './DiscussionControls';
jest.setTimeout(20000);
const mockApi = { summary: jest.fn(), command: jest.fn(), comments: jest.fn(), context: jest.fn(), destination: jest.fn(), reactors: jest.fn(), preferences: jest.fn(), blockedAccounts: jest.fn(), moderation: jest.fn() };
let mockAuth: { partyId: string | null; token: string | null } = { partyId: '7', token: 'synthetic' };
const mockPush = jest.fn(); let mockParams = { destinationKind: 'target', destinationId: '10000000-0000-4000-8000-000000000001' }; let mockOrdinal = 0;
jest.mock('../../api/interactions', () => ({ Interactions: new Proxy({}, { get: (_object, key) => (...args: unknown[]) => mockApi[key as keyof typeof mockApi](...args) }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useLocalSearchParams: () => mockParams }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `20000000-0000-4000-8000-${String(++mockOrdinal).padStart(12, '0')}` }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../providers/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('../../theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../../analytics/posthog', () => ({ getAnalyticsClient: () => ({ capture: jest.fn() }) }));
jest.mock('../../components/PartySelector', () => ({ PartySelector: () => null, PartyMultiSelector: () => null }));
const target = '10000000-0000-4000-8000-000000000001', rootId = '10000000-0000-4000-8000-000000000002', replyId = '10000000-0000-4000-8000-000000000003';
const summary: InteractionSummary = { id: target, kind: 'recording', key: 'record', ownerId: 8, title: 'Session', route: '/records', public: true,
  canManage: false, reactable: true, commentable: true, shareable: true, version: 1, commentPolicy: 'everyone', canReact: true, canComment: true, canModerate: false,
  commentCount: 2, rootCount: 1, reactions: [{ id: 'like', code: 'like', emoji: '👍', label: 'Me gusta', count: 0, selectable: true }], myReactionTypeId: null, subscription: 'participating', defaultSort: 'newest' };
let root: InteractionComment, reply: InteractionComment, client: QueryClient;
function view(component: ReactElement) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
}
beforeEach(() => {
  jest.clearAllMocks(); mockAuth = { partyId: '7', token: 'synthetic' }; mockParams = { destinationKind: 'target', destinationId: target };
  root = { id: rootId, targetId: target, parentId: null, rootId, depth: 0, version: 1, createdAt: '2026-09-28T10:00:00Z', editedAt: null, state: 'visible', body: 'Root comment', author: { id: 7, displayName: 'Ana', avatarUrl: null }, canEdit: true, canDelete: true, mentions: [], replyCount: 1 };
  reply = { ...root, id: replyId, parentId: rootId, depth: 1, body: 'A reply', author: { id: 8, displayName: 'Luis', avatarUrl: null }, canEdit: false, canDelete: false, replyCount: 0 };
  mockApi.summary.mockResolvedValue(summary); mockApi.command.mockResolvedValue({});
  mockApi.comments.mockImplementation(async (_identity, _auth, _sort, thread) => ({ items: [thread ? reply : root], nextCursor: null, sort: 'newest' }));
  mockApi.context.mockImplementation(async () => ({ target: summary, root, comment: reply, parent: root, surrounding: [reply] }));
  mockApi.destination.mockImplementation(async () => ({ ...summary, targetId: target, commentId: mockParams.destinationKind === 'comment' ? replyId : null, context: mockParams.destinationKind === 'comment' ? { target: summary, root, comment: reply, parent: root, surrounding: [reply] } : null }));
});
afterEach(() => { cleanup(); client?.clear(); });
it('optimistically selects a reaction and rolls back an offline failure', async () => {
  let reject!: (reason: Error) => void; mockApi.command.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
  const ui = view(<InteractionBar kind="recording" entityKey="record" />);
  fireEvent.press(await ui.findByLabelText('Me gusta: 0')); await ui.findByLabelText('Me gusta: 1');
  expect(ui.getByLabelText('Me gusta: 1').props.accessibilityState.selected).toBe(true);
  await act(async () => reject(new Error('offline'))); await ui.findByLabelText('Me gusta: 0');
  expect(ui.getByRole('alert')).toBeTruthy();
});
it('retains a failed draft and idempotency key, changing the key only after editing', async () => {
  const save = jest.fn().mockRejectedValue(new Error('offline')); const ui = view(<CommentComposer targetId={target} onSave={save} />);
  fireEvent.changeText(ui.getByLabelText('Escribe un comentario'), 'Keep this draft'); fireEvent.press(ui.getByText('Publicar'));
  await ui.findByRole('alert'); expect(ui.getByLabelText('Escribe un comentario').props.value).toBe('Keep this draft');
  fireEvent.press(ui.getByText('Publicar')); await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[0][2]).toBe(save.mock.calls[1][2]); await ui.findByRole('alert');
  fireEvent.changeText(ui.getByLabelText('Escribe un comentario'), 'Edited draft'); fireEvent.press(ui.getByText('Publicar'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(3)); expect(save.mock.calls[2][2]).not.toBe(save.mock.calls[0][2]); await ui.findByRole('alert');
});
it('discloses replies without fetching them until expansion and collapses back to roots', async () => {
  const ui = view(<DiscussionScreen />); await ui.findByText('Root comment', {}, { timeout: 10000 }); expect(ui.queryByText('A reply')).toBeNull();
  expect(mockApi.comments.mock.calls.every(call => call[3] === undefined)).toBe(true);
  fireEvent.press(ui.getByText('Ver 1 respuestas')); await ui.findByText('A reply');
  fireEvent.press(ui.getByText('Ocultar respuestas · Ver todos los comentarios')); await waitFor(() => expect(ui.queryByText('A reply')).toBeNull());
});
it('opens exact reply context, announces it, and preserves replies after author deletion', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
  const offset = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => {});
  mockParams = { destinationKind: 'comment', destinationId: replyId };
  mockApi.command.mockImplementation(async (_target, command) => { if (command.operation === 'comment.delete') root = { ...root, body: '', state: 'deleted', version: 2, author: null, canEdit: false, canDelete: false }; return root; });
  const ui = view(<DiscussionScreen />); await ui.findByText('A reply');
  expect(announce).not.toHaveBeenCalled();
  const list = ui.UNSAFE_getByType(FlatList);
  expect(scroll).not.toHaveBeenCalled();
  fireEvent(list, 'layout', { nativeEvent: { layout: { height: 800, width: 400 } } });
  await waitFor(() => expect(scroll).toHaveBeenCalledWith({ index: 1, animated: false, viewPosition: 0.3 }));
  act(() => list.props.ListHeaderComponent.props.onLayout({ nativeEvent: { layout: { height: 600 } } }));
  fireEvent(list, 'scrollToIndexFailed', { index: 1, averageItemLength: 100 });
  expect(offset).toHaveBeenCalledWith({ offset: 700, animated: false });
  fireEvent(list, 'viewableItemsChanged', { viewableItems: [{ item: root, isViewable: true }] });
  expect(announce).not.toHaveBeenCalled();
  const viewport = ui.UNSAFE_getAllByType(View).find(node => node.props.testID === 'discussion-viewport')!.instance;
  const linkedHeading = ui.UNSAFE_getAllByType(Text).find(node => node.props.children === 'Luis')!.instance;
  viewport.measureInWindow = jest.fn((callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 40, 400, 800));
  linkedHeading.measureInWindow = jest.fn((callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 1000, 200, 24));
  fireEvent(list, 'viewableItemsChanged', { viewableItems: [{ item: reply, isViewable: true }] });
  expect(announce).not.toHaveBeenCalled(); // A stale virtualized view token cannot stop scrolling.
  await waitFor(() => expect(offset).toHaveBeenCalledWith({ offset: 720, animated: false }));
  // Android reported the author heading visible at the bottom while the reply
  // body remained below the viewport. This must not complete initial focus.
  linkedHeading.measureInWindow = jest.fn((callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 790, 200, 24));
  fireEvent(list, 'viewableItemsChanged', { viewableItems: [{ item: reply, isViewable: true }] });
  expect(announce).not.toHaveBeenCalled();
  fireEvent(list, 'contentSizeChange', 400, 1400);
  expect(offset).toHaveBeenCalledWith({ offset: 510, animated: false });
  linkedHeading.measureInWindow = jest.fn((callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 300, 200, 24));
  fireEvent(list, 'viewableItemsChanged', { viewableItems: [{ item: reply, isViewable: true }] });
  await waitFor(() => expect(announce).toHaveBeenCalledWith('Comentario enlazado'));
  linkedHeading.measureInWindow = jest.fn((callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 790, 200, 24));
  fireEvent(list, 'contentSizeChange', 400, 1600);
  expect(offset).toHaveBeenLastCalledWith({ offset: 510, animated: false });
  expect(announce).toHaveBeenCalledTimes(1);
  fireEvent(list, 'scrollBeginDrag');
  offset.mockClear();
  fireEvent(list, 'contentSizeChange', 400, 1800);
  expect(offset).not.toHaveBeenCalled();

  fireEvent.press(ui.getAllByLabelText('Opciones del comentario')[0]); fireEvent.press(ui.getByText('Eliminar mi comentario')); fireEvent.press(ui.getByText('Confirmar'));
  await ui.findByText('Comentario eliminado'); expect(ui.getByText('A reply')).toBeTruthy(); announce.mockRestore(); scroll.mockRestore(); offset.mockRestore();
});
it('does not keep cached discussion bodies visible after access is revoked', async () => {
  const ui = view(<DiscussionScreen />); await ui.findByText('Root comment', {}, { timeout: 10000 }); mockApi.summary.mockRejectedValue(new Error('404'));
  await act(async () => { await client.invalidateQueries({ queryKey: ['interactions'] }); });
  await ui.findByText('Tus permisos cambiaron o la conversación no está disponible.'); expect(ui.queryByText('Root comment')).toBeNull();
});

it.each(['target', 'comment'])('preserves the exact %s discussion through guest sign-in', async (kind) => {
  mockAuth = { partyId: null, token: null };
  mockParams = { destinationKind: kind, destinationId: kind === 'comment' ? replyId : target };
  mockApi.summary.mockResolvedValue({ ...summary, canComment: false, canReact: false });
  const ui = view(<DiscussionScreen />);
  fireEvent.press(await ui.findByText('Iniciar sesión para participar'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/auth', params: { returnTo: `/conversacion/${kind}/${kind === 'comment' ? replyId : target}` } });
  expect(ui.queryByLabelText('Escribe un comentario')).toBeNull();
});


it('shows moderator report reasons before resolving a report', async () => {
  mockApi.moderation.mockResolvedValue({ items: [{ ...root, moderationBody: 'Reported comment', openReports: 1, reportReasons: ['Unwanted personal information'] }], nextCursor: null });
  const execute = jest.fn().mockResolvedValue(undefined);
  const ui = view(<DiscussionControls summary={{ ...summary, canModerate: true }} scope="7" onClose={jest.fn()} execute={execute} />);
  fireEvent.press(ui.getByText('Moderación'));
  expect(await ui.findByText('Unwanted personal information')).toBeTruthy();
  fireEvent.changeText(ui.getByLabelText('Motivo de la decisión'), 'Reviewed the report');
  fireEvent.press(ui.getByText('Desestimar reportes'));
  await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ operation: 'comment.report.resolve', commentId: rootId })));
});

it('lets owners hide blocked-author content without administrative removal powers', async () => {
  mockApi.moderation.mockResolvedValue({ items: [{ ...root, author: null, body: '', moderationBody: 'Blocked author content', canEdit: false, canDelete: false }], nextCursor: null });
  const execute = jest.fn().mockResolvedValue(undefined);
  const ui = view(<DiscussionControls summary={{ ...summary, canManage: true }} scope="7" onClose={jest.fn()} execute={execute} />);
  fireEvent.press(ui.getByText('Moderación'));
  expect(await ui.findByText('Blocked author content')).toBeTruthy();
  expect(ui.queryByText('Retirar como administrador')).toBeNull();
  fireEvent.changeText(ui.getByLabelText('Motivo de la decisión'), 'Publication policy');
  fireEvent.press(ui.getByText('Ocultar en mi contenido'));
  await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ operation: 'comment.hide', commentId: rootId })));
});

it('keeps malformed discussion pages recoverable and loads a valid retry', async () => {
  mockApi.comments.mockRejectedValueOnce(new Error('Invalid interaction comments response'));
  const screen = view(<DiscussionScreen />);
  await screen.findByText('No se pudo cargar la conversación.');
  expect(screen.queryByText('Root comment')).toBeNull();
  fireEvent.press(screen.getByText('Reintentar'));
  await screen.findByText('Root comment');
  expect(screen.queryByText('No se pudo cargar la conversación.')).toBeNull();
});

it.each([null, 8])('offers follower policy only with a real publication owner: %s', async (ownerId) => {
  const execute = jest.fn().mockResolvedValue(undefined);
  const ui = view(<DiscussionControls summary={{ ...summary, ownerId, canManage: true }} scope="7" onClose={jest.fn()} execute={execute} />);
  if (ownerId === null) expect(ui.queryByText('Seguidores')).toBeNull();
  else expect(ui.getByText('Seguidores')).toBeTruthy();
  fireEvent.press(ui.getByText('Comentarios desactivados')); fireEvent.press(ui.getByText('Guardar permisos'));
  await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ operation: 'settings.update', commentPolicy: 'off' })));
});

it('reconciles a stale ownerless follower selection to the equivalent disabled state', async () => {
  const execute = jest.fn().mockResolvedValue(undefined);
  const ui = view(<DiscussionControls summary={{ ...summary, ownerId: null, canManage: true, commentPolicy: 'followers' }} scope="7" onClose={jest.fn()} execute={execute} />);
  expect(ui.queryByText('Seguidores')).toBeNull(); fireEvent.press(ui.getByText('Guardar permisos'));
  await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ commentPolicy: 'off' })));
});
