import { render, waitFor, cleanup } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationScreen from '../../app/notifications';
const mockGet = jest.fn();
const mockNotification = jest.fn();
const mockRead = jest.fn();
const mockRequest = jest.fn();
const mockDecide = jest.fn();
const mockCancel = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ notificationId: '3' }), Link: require('react-native').Text }));
jest.mock('../api/client', () => ({ get: (...args: unknown[]) => mockGet(...args) }));
jest.mock('../api/notifications', () => ({ getNotification: (...args: unknown[]) => mockNotification(...args), markNotificationRead: (...args: unknown[]) => mockRead(...args) }));
jest.mock('../api/accessRequests', () => ({ getAccessRequest: (...args: unknown[]) => mockRequest(...args), decideAccessRequest: mockDecide, cancelAccessRequest: mockCancel }));
jest.mock('../providers/AuthProvider', () => ({ useAuth: () => ({ partyId: 5, token: 'synthetic' }) }));
jest.mock('../providers/UserSettingsProvider', () => ({ useUserSettings: () => ({ locale: 'en' }) }));
jest.mock('../theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../analytics/AnalyticsProvider', () => ({ useAnalytics: () => ({ capture: jest.fn() }) }));
const row = { nId: 3, nType: 'artist_liked', nTitle: 'New fan', nBody: 'Old display name', nTargetType: 'party_profile', nTargetId: 7, nIsRead: false };
let client: QueryClient;
function screen() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  client.setQueryData(['notification-count', 5], { ncUnread: 2 });
  return render(<QueryClientProvider client={client}><NotificationScreen /></QueryClientProvider>);
}
beforeEach(() => { jest.clearAllMocks(); mockNotification.mockResolvedValue(row); mockRead.mockResolvedValue(undefined); mockGet.mockResolvedValue({ sppPartyId: 7, sppDisplayName: 'Actual follower', sppBio: 'Public biography' });
  mockRequest.mockResolvedValue({ canReview: true, canCancel: false, request: { id: 17, requesterName: 'Requester', featureId: 'label.ddex.inbox', action: 'view', status: 'pending', roleContext: [], moduleContext: [], requestedAt: '2026-09-16', justification: 'Review this exact request', history: [] } }); });
afterEach(() => { cleanup(); client.clear(); });
it('loads the actual follower while read persistence is pending', async () => {
  mockRead.mockImplementation(() => new Promise(() => {})); const view = screen();
  await waitFor(() => expect(view.getByText('Actual follower')).toBeTruthy());
  expect(mockGet).toHaveBeenCalledWith('/social/profiles/7'); expect(mockRead.mock.calls[0][0]).toBe(3); expect(mockDecide).not.toHaveBeenCalled();
});
it('keeps the destination and unread count after a failed read update', async () => {
  mockRead.mockRejectedValue(new Error('offline')); const view = screen();
  await waitFor(() => expect(view.getByText('Could not mark as read. Reopen to retry.')).toBeTruthy());
  expect(view.getByText('Actual follower')).toBeTruthy(); expect(client.getQueryData(['notification-count', 5])).toEqual({ ncUnread: 2 });
});
it('shows the specific pending request and review controls without deciding or cancelling', async () => {
  mockNotification.mockResolvedValue({ ...row, nTargetType: 'feature_access_request', nTargetId: 17 }); const view = screen();
  await waitFor(() => expect(view.getByText('Approve for provisioning')).toBeTruthy());
  expect(mockRequest).toHaveBeenCalledWith(17); expect(view.getByText('Requester')).toBeTruthy(); expect(mockDecide).not.toHaveBeenCalled(); expect(mockCancel).not.toHaveBeenCalled();
});
it('keeps handled status visible and hides details for inaccessible targets', async () => {
  mockNotification.mockResolvedValue({ ...row, nTargetType: 'feature_access_request', nTargetId: 17 });
  const data = await mockRequest(); mockRequest.mockResolvedValue({ ...data, request: { ...data.request, status: 'approved', reviewerNotes: 'Already reviewed' } }); const view = screen();
  await waitFor(() => expect(view.getByText('Already reviewed')).toBeTruthy()); expect(view.queryByText('Approve for provisioning')).toBeNull();
  mockRequest.mockRejectedValue(new Error('404')); await client.invalidateQueries({ queryKey: ['access-requests'] });
  await waitFor(() => expect(view.getByText('This request is unavailable to your account or your access has changed.')).toBeTruthy());
  expect(view.queryByText('Already reviewed')).toBeNull(); expect(mockDecide).not.toHaveBeenCalled();
});
it('does not resolve legacy recipient identity or mark missing notifications as read', async () => {
  mockNotification.mockResolvedValue({ ...row, nTargetType: 'artist', nTargetId: 5 }); const view = screen();
  await waitFor(() => expect(view.getByText('The specific destination is unavailable or its original reference was not retained.')).toBeTruthy()); expect(mockGet).not.toHaveBeenCalled();
  view.unmount(); client.clear(); mockNotification.mockRejectedValue(new Error('401')); mockRead.mockClear(); const denied = screen();
  await waitFor(() => expect(denied.getByText('The specific destination is unavailable or its original reference was not retained.')).toBeTruthy()); expect(mockRead).not.toHaveBeenCalled();
});
