import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const BOOKING_URL = 'https://cal.com/YOUR_HANDLE/domo-rental';

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getStartWeekday(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1).getDay();
}

type CalendarCell = {
  day: number | null;
};

export default function CalendarScreen() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const cells = useMemo<CalendarCell[]>(() => {
    const firstDayOffset = getStartWeekday(year, month);
    const totalDays = getDaysInMonth(year, month);
    const nextCells: CalendarCell[] = [];

    for (let index = 0; index < firstDayOffset; index += 1) {
      nextCells.push({ day: null });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      nextCells.push({ day });
    }

    while (nextCells.length % 7 !== 0) {
      nextCells.push({ day: null });
    }

    return nextCells;
  }, [month, year]);

  const handleNavigateMonth = (delta: number) => {
    const target = new Date(year, month + delta, 1);
    setYear(target.getFullYear());
    setMonth(target.getMonth());
  };

  const handleBookingPress = () => {
    Linking.openURL(BOOKING_URL);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Pressable onPress={() => handleNavigateMonth(-1)}>
          <Text>◀</Text>
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '600' }}>
          {monthNames[month]} {year}
        </Text>
        <Pressable onPress={() => handleNavigateMonth(1)}>
          <Text>▶</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {weekdayLabels.map((label) => (
          <View key={label} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontWeight: '600', opacity: 0.7 }}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((cell, index) => {
          const isToday =
            cell.day &&
            year === now.getFullYear() &&
            month === now.getMonth() &&
            cell.day === now.getDate();

          return (
            <View
              key={index}
              style={{
                width: '14.2857%',
                borderWidth: 1,
                borderColor: '#e5e7eb',
                minHeight: 64,
                padding: 6,
                backgroundColor: isToday ? '#f0f9ff' : '#fff',
              }}
            >
              <Text
                style={{
                  textAlign: 'right',
                  fontSize: 12,
                  fontWeight: '600',
                  opacity: cell.day ? 1 : 0,
                }}
              >
                {cell.day ?? ''}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: 16, alignItems: 'flex-end' }}>
        <Pressable
          onPress={handleBookingPress}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: '#111',
            borderRadius: 8,
          }}
        >
          <Text>Solicitar fecha</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
