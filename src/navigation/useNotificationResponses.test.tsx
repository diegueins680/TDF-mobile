import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useNotificationResponses } from './useNotificationResponses';
const mockPush = jest.fn();
let mockNavigationKey: string | undefined;
let mockListener: ((response: unknown) => void) | undefined;
const mockRemove = jest.fn();
const mockLast = jest.fn();
const mockClear = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useRootNavigationState: () => ({ key: mockNavigationKey }) }));
jest.mock('./nativeNotifications', () => ({ loadNativeNotifications: async () => ({ DEFAULT_ACTION_IDENTIFIER: 'default',
  addNotificationResponseReceivedListener: (callback: (response: unknown) => void) => { mockListener = callback; return { remove: mockRemove }; },
  getLastNotificationResponseAsync: () => mockLast(), clearLastNotificationResponseAsync: () => mockClear() }) }));
const response = (id = 'tap-1', notificationId: unknown = 17) => ({ actionIdentifier: 'default', notification: { request: { identifier: id, content: { data: { notificationId } } } } });
beforeEach(() => { jest.clearAllMocks(); mockNavigationKey = undefined; mockListener = undefined; mockLast.mockResolvedValue(response()); });
it('waits for navigation readiness then consumes the cold-start response exactly once', async () => {
  const hook = renderHook(() => useNotificationResponses());
  expect(mockLast).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
  mockNavigationKey = 'ready'; hook.rerender({});
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/notifications?notificationId=17'));
  await act(async () => { mockListener?.(response()); });
  expect(mockPush).toHaveBeenCalledTimes(1); expect(mockClear).toHaveBeenCalled();
  hook.unmount(); expect(mockRemove).toHaveBeenCalled();
});
it('ignores unsupported data/actions and handles a subsequent warm tap', async () => {
  mockNavigationKey = 'ready'; mockLast.mockResolvedValue(null);
  const hook = renderHook(() => useNotificationResponses());
  await waitFor(() => expect(mockListener).toBeDefined());
  await act(async () => {
    mockListener?.(response('unsafe', '//evil.example'));
    mockListener?.({ ...response('action', 20), actionIdentifier: 'approve' });
  });
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => { mockListener?.(response('warm', 23)); });
  expect(mockPush).toHaveBeenCalledWith('/notifications?notificationId=23'); hook.unmount();
});
