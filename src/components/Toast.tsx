import { Animated, Text, StyleSheet } from 'react-native';
import type { RefObject } from 'react';

interface ToastProps {
  opacity: Animated.Value;
  messageRef: RefObject<string>;
}

export function Toast({ opacity, messageRef }: ToastProps) {
  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.text} accessibilityLiveRegion="polite">
        {messageRef.current}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
});
