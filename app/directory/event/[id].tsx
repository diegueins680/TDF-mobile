import { useLocalSearchParams } from 'expo-router';
import { DirectoryPublicDetailScreen } from '../../../src/components/DirectoryPublicDetailScreen';

export default function DirectoryEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DirectoryPublicDetailScreen kind="event" identifier={String(id ?? '')} />;
}
