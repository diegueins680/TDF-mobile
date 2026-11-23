import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

// Non-blocking confirmation for actions that already succeeded.
// Usage: const toast = useToast(); toast.show('Guardado'); <Toast {...toast} />
// Errors and decisions still belong in Alert: a toast disappears on its own.

export function useToast() {
  const opacity = useRef(new Animated.Value(0)).current;
  const [message, setMessage] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    animationRef.current?.stop();
  }, []);

  const show = useCallback((nextMessage: string, duration = 3500) => {
    const text = nextMessage.trim();
    if (!text) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    animationRef.current?.stop();
    setMessage(text);
    // accessibilityLiveRegion only speaks on Android; iOS needs the announcement.
    AccessibilityInfo.announceForAccessibility(text);

    animationRef.current = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(duration),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]);
    animationRef.current.start();

    timeoutRef.current = setTimeout(() => setMessage(''), duration + 400);
  }, [opacity]);

  return { show, opacity, message };
}
