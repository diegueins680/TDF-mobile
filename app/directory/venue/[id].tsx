import { useLocalSearchParams } from 'expo-router';
import { DirectoryPublicDetailScreen } from '../../../src/components/DirectoryPublicDetailScreen';

export default function DirectoryVenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DirectoryPublicDetailScreen kind="venue" identifier={String(id ?? '')} />;
}
