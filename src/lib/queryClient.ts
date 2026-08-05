import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener('change', (status) => {
      setFocused(status === 'active');
    });
    return () => subscription.remove();
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 }
  }
});
