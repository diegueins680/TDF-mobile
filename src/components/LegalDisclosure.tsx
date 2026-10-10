import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeProvider';

export type LegalDisclosureLanguage = 'es' | 'en';

const actionCopy: Record<LegalDisclosureLanguage, { expand: string; collapse: string }> = {
  es: { expand: 'Leer completo', collapse: 'Ocultar' },
  en: { expand: 'Read in full', collapse: 'Hide' },
};

type LegalDisclosureProps = {
  /** Document name shown in the header row, e.g. "Política de reembolso". */
  title: string;
  /** The full legal text, rendered only while expanded. */
  children: ReactNode;
  /** Short context visible while collapsed, e.g. the terms version. */
  summary?: string;
  language?: LegalDisclosureLanguage;
  defaultExpanded?: boolean;
  /** Overrides the spoken name when several disclosures share a visible title. */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Mobile counterpart of the web LegalDisclosure: terms, policies and consent texts start
 * collapsed behind a full-width header button. State lives in the component (same screen only)
 * and is never persisted. Consent switches/checkboxes must stay outside so they remain visible.
 */
export function LegalDisclosure({
  title,
  children,
  summary,
  language = 'es',
  defaultExpanded = false,
  accessibilityLabel,
  testID,
}: LegalDisclosureProps) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [reduceMotion, setReduceMotion] = useState(false);
  const action = actionCopy[language];

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (active) setReduceMotion(enabled); })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const toggle = () => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((current) => !current);
  };

  return (
    <View testID={testID} style={[styles.container, { borderColor: colors.borderSubtle, backgroundColor: colors.surfaceRaised }]}>
      <Pressable
        testID={testID ? `${testID}-toggle` : undefined}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={expanded ? action.collapse : action.expand}
        style={({ pressed }) => [styles.header, pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        <View style={styles.titles}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {summary ? <Text style={[styles.summary, { color: colors.textSecondary }]}>{summary}</Text> : null}
          <Text style={[styles.actionText, { color: colors.actionPrimary }]}>{expanded ? action.collapse : action.expand}</Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.actionPrimary}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Pressable>
      {expanded ? <View style={styles.panel}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  header: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700' },
  summary: { fontSize: 12 },
  actionText: { fontSize: 14, fontWeight: '600' },
  panel: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
});

export default LegalDisclosure;
