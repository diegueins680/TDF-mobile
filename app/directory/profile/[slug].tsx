import { useLocalSearchParams } from 'expo-router';
import { DirectoryPublicDetailScreen } from '../../../src/components/DirectoryPublicDetailScreen';

export default function DirectoryProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <DirectoryPublicDetailScreen kind="profile" identifier={String(slug ?? '')} />;
}
