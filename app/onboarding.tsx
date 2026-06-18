import { useEffect, type ComponentType, useRef } from 'react';
import { Animated, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewProps } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { setOnboardingSeen } from '../src/lib/onboarding';
import { MOBILE_LANDING_ROUTE } from '../src/navigation/mobileSurface';

type Step = {
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
};

const STEPS: Step[] = [
  {
    title: 'Eventos y tickets',
    description: 'Encuentra eventos de TDF y compra tus entradas desde el móvil.',
    icon: 'ticket-confirmation',
    color: '#f8c96b'
  },
  {
    title: 'Perfil, seguir y vCards',
    description: 'Crea tu perfil, sigue artistas y comparte tu vCard con la comunidad.',
    icon: 'account-heart',
    color: '#7dd3fc'
  },
  {
    title: 'Streaming y club de fans',
    description: 'Accede a transmisiones, contenido exclusivo y espacios de fan club.',
    icon: 'broadcast',
    color: '#c4b5fd'
  }
] as const;

const AnimatedView = Animated.createAnimatedComponent(View) as ComponentType<Animated.AnimatedProps<ViewProps>>;

export default function OnboardingScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true
    }).start();
  }, [fadeAnim]);

  const complete = (path: Href) => {
    void setOnboardingSeen(true);
    router.replace(path);
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <TouchableOpacity style={styles.skip} onPress={() => complete(MOBILE_LANDING_ROUTE)}>
            <Text style={styles.skipText}>Saltar</Text>
          </TouchableOpacity>
          <AnimatedView
            style={[
              styles.heroContent,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0]
                    })
                  }
                ]
              }
            ]}
          >
            <Text style={styles.kicker}>TDF Mobile</Text>
            <Text style={styles.title}>Tu acceso a la comunidad musical</Text>
            <Text style={styles.subtitle}>
              Una interfaz mínima para descubrir eventos, seguir artistas y entrar a sus clubes de fans.
            </Text>
            <View style={styles.heroMeta}>
              <View style={styles.metaPill}>
                <Text style={styles.metaText}>Eventos</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaText}>Tickets</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaText}>Club de fans</Text>
              </View>
            </View>
          </AnimatedView>
        </View>

        <View style={styles.steps}>
          {STEPS.map((step) => (
            <View key={step.title} style={styles.stepCard}>
              <View style={[styles.stepIcon, { borderColor: `${step.color}33` }]}>
                <MaterialCommunityIcons name={step.icon} size={20} color={step.color} />
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actionStack}>
          <TouchableOpacity testID="goToLoginButton" style={styles.primaryButton} onPress={() => complete('/auth')}>
            <Text style={styles.primaryText}>Crear cuenta</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => complete('/(tabs)/profile')}>
            <Text style={styles.secondaryText}>Configurar perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => complete(MOBILE_LANDING_ROUTE)}>
            <Text style={styles.ghostText}>Ver eventos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0b1220'
  },
  content: {
    padding: 16,
    gap: 16
  },
  hero: {
    position: 'relative',
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    overflow: 'hidden',
    minHeight: 220,
    justifyContent: 'center'
  },
  heroContent: {
    gap: 10
  },
  kicker: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800'
  },
  subtitle: {
    color: '#cbd5e1',
    lineHeight: 20
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: 'rgba(15,23,42,0.6)'
  },
  metaText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600'
  },
  steps: {
    gap: 12
  },
  stepCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)'
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(15,23,42,0.7)'
  },
  stepBody: {
    flex: 1,
    gap: 4
  },
  stepTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700'
  },
  stepText: {
    color: '#cbd5e1',
    lineHeight: 18
  },
  actionStack: {
    gap: 10,
    paddingBottom: 24
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  secondaryText: {
    color: '#e2e8f0',
    fontWeight: '600'
  },
  ghostButton: {
    paddingVertical: 10,
    alignItems: 'center'
  },
  ghostText: {
    color: '#cbd5e1',
    fontWeight: '600'
  },
  skip: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2
  },
  skipText: {
    color: '#cbd5e1',
    fontWeight: '600'
  }
});
