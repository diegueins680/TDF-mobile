import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { useAppTheme } from '../theme/ThemeProvider';

interface ErrorBoundaryProps {
  children: ReactNode;
  colors: ReturnType<typeof useAppTheme>['colors'];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    router.replace('/');
  };

  render() {
    if (this.state.hasError) {
      const { colors } = this.props;
      return (
        <View style={[styles.container, { backgroundColor: colors.canvas }]}>
          <View style={styles.iconCircle}>
            <Text style={[styles.icon, { color: colors.dangerAction }]}>⚠</Text>
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Algo salió mal
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Ocurrió un error inesperado. Por favor, recargá la aplicación para volver a intentar.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={this.handleReload}
            style={[styles.button, { backgroundColor: colors.actionPrimary }]}
          >
            <Text style={[styles.buttonText, { color: colors.actionPrimaryContrast }]}>
              Recargar
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginBottom: 8,
  },
  icon: {
    fontSize: 36,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 360,
  },
  button: {
    marginTop: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

/** Functional wrapper that injects theme colors into the class component. */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return <ErrorBoundaryInner colors={colors}>{children}</ErrorBoundaryInner>;
}
