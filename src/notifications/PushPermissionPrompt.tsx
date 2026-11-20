import { useEffect, useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAuth } from '../providers/AuthProvider';
import { useAppTheme } from '../theme/ThemeProvider';
import {
  dismissPushPermissionPrompt,
  getPushPermissionState,
  hasAnsweredPushPermissionPrompt,
  requestPushPermission,
} from './pushSubscriptions';

/**
 * Inline, dismissible explanation shown only to signed-in users whose OS
 * permission is still undetermined. The OS dialog opens only after "Activar".
 */
export function PushPermissionPrompt({ locale = 'es', style }: { locale?: string; style?: StyleProp<ViewStyle> }) {
  const { token, partyId } = useAuth();
  const english = locale.startsWith('en');
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !partyId) {
      setVisible(false);
      return;
    }
    let active = true;
    void Promise.all([getPushPermissionState(), hasAnsweredPushPermissionPrompt()])
      .then(([state, answered]) => {
        if (active) setVisible(state === 'undetermined' && !answered);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token, partyId]);

  if (!visible || !token || !partyId) return null;

  const enable = () => {
    setBusy(true);
    void requestPushPermission({ partyId, authorization: token }).finally(() => {
      setBusy(false);
      setVisible(false);
    });
  };
  const dismiss = () => {
    setVisible(false);
    void dismissPushPermissionPrompt();
  };

  return (
    <View
      testID="push-permission-prompt"
      style={[{ gap: 8, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }, style]}
    >
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
        {english ? 'Get notified about new messages' : 'Entérate de tus mensajes nuevos'}
      </Text>
      <Text style={{ color: colors.textSecondary }}>
        {english
          ? 'Turn on notifications so TDF can tell you when someone writes to you. You can change this anytime in your device settings.'
          : 'Activa las notificaciones para que TDF te avise cuando alguien te escriba. Puedes cambiarlo cuando quieras en los ajustes del dispositivo.'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={enable} style={{ minHeight: 44, padding: 12, justifyContent: 'center' }}>
          <Text style={{ color: colors.actionPrimary, fontWeight: '600' }}>{english ? 'Turn on' : 'Activar'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={dismiss} style={{ minHeight: 44, padding: 12, justifyContent: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>{english ? 'Not now' : 'Ahora no'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
