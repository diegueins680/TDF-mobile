import { View } from 'react-native';
import { EventCardSkeleton } from './EventCardSkeleton';

export function EventListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </View>
  );
}
