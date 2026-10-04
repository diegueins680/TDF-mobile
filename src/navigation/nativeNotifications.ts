// Lazy loading keeps web and native runtimes without the Expo module usable.
export const loadNativeNotifications = () => import('expo-notifications');
