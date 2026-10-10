import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  DIRECTORY_PREVIEW_PLACEHOLDERS,
  resolveDirectoryPreviewImage,
  type DirectoryPreviewKind,
} from '../features/directory/previewImage';
import { useAppTheme } from '../theme/ThemeProvider';

interface Props {
  kind: DirectoryPreviewKind;
  imageUrl?: string | null;
  label: string;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
}

export function DirectoryPreviewImage({ kind, imageUrl, label, aspectRatio = 16 / 9, style }: Props) {
  const { colors } = useAppTheme();
  const resolved = resolveDirectoryPreviewImage(imageUrl);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [resolved]);
  const showPlaceholder = !resolved || failed;
  return (
    <View style={[styles.frame, { aspectRatio, backgroundColor: colors.selected }, style]}>
      {showPlaceholder ? (
        <View
          testID="directory-preview-placeholder"
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Imagen de referencia de ${label}`}
          style={styles.placeholder}
        >
          <Text style={styles.placeholderIcon}>{DIRECTORY_PREVIEW_PLACEHOLDERS[kind]}</Text>
        </View>
      ) : (
        <Image
          testID="directory-preview-image"
          source={{ uri: resolved }}
          accessibilityLabel={`Foto de ${label}`}
          resizeMode="cover"
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: 12, overflow: 'hidden' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 40 },
});
