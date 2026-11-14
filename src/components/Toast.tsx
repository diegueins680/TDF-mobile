import { Animated, Text, StyleSheet } from 'react-native';

interface ToastProps {
  opacity: Animated.Value;
  message: string;
}

export function Toast({ opacity, message }: ToastProps) {
  if (!message) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.container, { opacity }]}>
      <Text style={styles.text} accessibilityLiveRegion="polite" testID="toast-message">
        {message}
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
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 6,
  },
  text: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
});
