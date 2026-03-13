import { useEffect, useRef } from 'react';
import type { ComponentProps, ComponentType } from 'react';
import { Animated, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { setOnboardingSeen } from '../src/lib/onboarding';

type Step = {
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
};

const STEPS: Step[] = [
  {
    title: 'Conecta tu token',
    description: 'Pega tu Bearer token para desbloquear inventario, bookings y pipelines.',
    icon: 'key-variant',
    color: '#38bdf8'
  },
  {
    title: 'Personaliza tu identidad',
    description: 'Guarda tu Party ID y nombre para RSVP, invitaciones y vCards.',
    icon: 'account-edit',
    color: '#34d399'
  },
  {
    title: 'Explora los modulos',
    description: 'Revisa parties, eventos y social desde el tablero principal.',
    icon: 'view-dashboard',
    color: '#f97316'
  }
] as const;

const AnimatedView = Animated.View as ComponentType<Animated.AnimatedProps<ComponentProps<typeof View>>>;

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
          <View style={[styles.orb, styles.orbOne]} />
          <View style={[styles.orb, styles.orbTwo]} />
          <View style={[styles.orb, styles.orbThree]} />
          <TouchableOpacity style={styles.skip} onPress={() => complete('/(tabs)/parties')}>
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
            <Text style={styles.kicker}>TDF HQ Mobile</Text>
            <Text style={styles.title}>Bienvenido a tu panel en movimiento</Text>
            <Text style={styles.subtitle}>
              Configura tu token, personaliza tu identidad y empieza a navegar las herramientas clave.
            </Text>
            <View style={styles.heroMeta}>
              <View style={styles.metaPill}>
                <Text style={styles.metaText}>3 pasos</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaText}>Acceso inmediato</Text>
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
          <TouchableOpacity style={styles.primaryButton} onPress={() => complete('/auth')}>
            <Text style={styles.primaryText}>Conectar token</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => complete('/userProfile')}>
            <Text style={styles.secondaryText}>Configurar perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => complete('/(tabs)/parties')}>
            <Text style={styles.ghostText}>Explorar app</Text>
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
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    overflow: 'hidden'
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
    borderRadius: 999,
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
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)'
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    borderRadius: 14,
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
    borderRadius: 14,
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
  },
  orb: {
    position: 'absolute',
    borderRadius: 999
  },
  orbOne: {
    width: 160,
    height: 160,
    backgroundColor: 'rgba(56,189,248,0.18)',
    top: -40,
    right: -20
  },
  orbTwo: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(52,211,153,0.18)',
    bottom: -50,
    left: -20
  },
  orbThree: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(249,115,22,0.16)',
    bottom: 10,
    right: 30
  }
});
