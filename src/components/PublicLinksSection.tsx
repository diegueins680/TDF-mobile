import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PUBLIC_LINKS = [
  {
    label: 'Support',
    url: 'https://tdf-app.pages.dev/mobile-app/support.html'
  },
  {
    label: 'Privacy Policy',
    url: 'https://tdf-app.pages.dev/mobile-app/privacy.html'
  },
  {
    label: 'Terms of Service',
    url: 'https://tdf-app.pages.dev/mobile-app/terms.html'
  },
  {
    label: 'Data Deletion',
    url: 'https://tdf-app.pages.dev/mobile-app/data-deletion.html'
  }
] as const;

const handleOpenLink = async (url: string) => {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Error', 'Could not open the public page.');
  }
};

export function PublicLinksSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Support and legal</Text>
      <Text style={styles.copy}>
        Open the public support, privacy, terms, or data deletion pages in your browser.
      </Text>
      <View style={styles.list}>
        {PUBLIC_LINKS.map((link) => (
          <TouchableOpacity
            key={link.url}
            accessibilityRole="link"
            onPress={() => void handleOpenLink(link.url)}
            style={styles.linkCard}
          >
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Text style={styles.linkUrl}>{link.url}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
  },
  copy: {
    color: '#475569',
    lineHeight: 20
  },
  list: {
    gap: 10
  },
  linkCard: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    gap: 4
  },
  linkLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a'
  },
  linkUrl: {
    color: '#2563eb'
  }
});
