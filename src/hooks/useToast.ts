import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

// Simple toast that shows a message at the bottom of the screen
// Usage: const toast = useToast(); toast.show('Saved!');

export function useToast() {
  const opacity = useRef(new Animated.Value(0)).current;
  const messageRef = useRef('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((message: string, duration = 2500) => {
    messageRef.current = message;
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(duration),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    timeoutRef.current = setTimeout(() => {
      messageRef.current = '';
    }, duration + 400);
  }, [opacity]);

  return { show, opacity, messageRef };
}
