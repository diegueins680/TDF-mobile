import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBookings, createBooking } from '../../src/api/bookings';
import { Agenda, AgendaSchedule } from 'react-native-calendars';
import { useMemo } from 'react';
import { View, Text } from 'react-native';

export default function Bookings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bookings'], queryFn: listBookings });

  const m = useMutation({
    mutationFn: createBooking,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] })
  });

  const items: AgendaSchedule = useMemo(() => {
    const acc: AgendaSchedule = {};
    for (const b of q.data || []) {
      const day = (b.start ?? '').slice(0, 10);
      acc[day] ||= [];
      acc[day].push({ name: b.title, height: 64, day });
    }
    return acc;
  }, [q.data]);

  return (
    <Agenda
      items={items}
      renderItem={(item) => (
        <View style={{ padding: 10, backgroundColor: 'white', borderRadius: 8, marginRight: 10 }}>
          <Text>{item.name}</Text>
        </View>
      )}
      renderEmptyData={() => (
        <View style={{ padding: 20 }}><Text>No bookings</Text></View>
      )}
      onDayPress={(d) => {
        const start = `${d.dateString}T10:00:00`;
        const end = `${d.dateString}T12:00:00`;
        m.mutate({ title: 'Session', start, end });
      }}
    />
  );
}
