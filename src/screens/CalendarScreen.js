import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getPostDates } from '../utils/database';
import Header from '../components/Header';
import { useTheme } from '../theme/useTheme';

const { width: SW } = Dimensions.get('window');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const daysInMonth  = (y, m) => new Date(y, m + 1, 0).getDate();
const firstWeekday = (y, m) => new Date(y, m, 1).getDay();

// ─── Calendar Grid ────────────────────────────────────────────────────────────

function CalendarGrid({ year, month, dotDates, onSelectDate }) {
  const { colors } = useTheme();
  const cg = getGridStyles(colors);
  const today    = toYMD(new Date());
  // Screen width minus card margins (14*2) and wrap padding (16*2)
  const CELL_W   = (SW - 28 - 32) / 7;
  const total    = daysInMonth(year, month);
  const start    = firstWeekday(year, month);

  // Build flat cell array: nulls for empty slots, numbers for days
  const cells = [
    ...Array(start).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows = [];
  for (let r = 0; r < cells.length / 7; r++) {
    rows.push(cells.slice(r * 7, r * 7 + 7));
  }

  return (
    <View style={cg.wrap}>
      {/* Weekday labels */}
      <View style={cg.weekRow}>
        {DAYS.map(d => (
          <Text key={d} style={[cg.dayLabel, { width: CELL_W }]}>{d}</Text>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={cg.weekRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={{ width: CELL_W }} />;

            const ymd      = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasPosts = dotDates.has(ymd);
            const isToday  = ymd === today;

            return (
              <Pressable
                key={ci}
                style={[cg.dayCell, { width: CELL_W }]}
                onPress={() => onSelectDate(ymd)}
              >
                <View style={[
                  cg.dayInner,
                  isToday && cg.todayRing,
                  hasPosts && !isToday && cg.hasPosts,
                ]}>
                  <Text style={[
                    cg.dayNum,
                    isToday && cg.todayNum,
                    hasPosts && !isToday && cg.hasPostsNum,
                    !hasPosts && !isToday && cg.emptyNum,
                  ]}>
                    {day}
                  </Text>
                </View>
                {/* Dot for days with posts */}
                {hasPosts && <View style={cg.dot} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const getGridStyles = (colors) => StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 12 },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dayLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary,
    paddingVertical: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dayCell: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayRing: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  hasPosts: {
    backgroundColor: colors.surface,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  todayNum:    { fontWeight: '800', color: colors.primary },
  hasPostsNum: { fontWeight: '700', color: colors.primary },
  emptyNum:    { color: colors.secondary, fontWeight: '400' },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 1,
  },
});

// ─── CalendarScreen ───────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { colors } = useTheme();
  const st = getStStyles(colors);
  const navigation = useNavigation();
  const today      = new Date();

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [dotDates,    setDotDates]    = useState(new Set());
  const [loadingDots, setLoadingDots] = useState(true);

  // Reload dots when screen is focused
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoadingDots(true);
        const rows = await getPostDates();
        if (active) {
          setDotDates(new Set(rows.map(r => r.post_date)));
          setLoadingDots(false);
        }
      })();
      return () => { active = false; };
    }, [])
  );

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  // Navigate to DayFeedScreen on any date tap (with or without posts)
  const handleDayPress = (ymd) => {
    navigation.navigate('DayFeedScreen', { date: ymd });
  };

  return (
    <View style={st.root}>
      <Header title="Activity" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Calendar card */}
        <View style={st.calCard}>
          {/* Month navigation */}
          <View style={st.monthRow}>
            <Pressable style={st.arrowBtn} onPress={prevMonth} hitSlop={12}>
              <Ionicons name="chevron-back" size={19} color={colors.primary} />
            </Pressable>
            <Text style={st.monthLabel}>{MONTHS[month]} {year}</Text>
            <Pressable style={st.arrowBtn} onPress={nextMonth} hitSlop={12}>
              <Ionicons name="chevron-forward" size={19} color={colors.primary} />
            </Pressable>
          </View>

          {loadingDots ? (
            <ActivityIndicator style={{ marginVertical: 40 }} color="#DDDDDD" />
          ) : (
            <CalendarGrid
              year={year}
              month={month}
              dotDates={dotDates}
              onSelectDate={handleDayPress}
            />
          )}
        </View>

        {/* Legend */}
        <View style={st.legend}>
          <View style={st.legendRow}>
            <View style={st.legendDot} />
            <Text style={st.legendText}>Day with entries</Text>
          </View>
          <View style={st.legendRow}>
            <View style={st.legendToday} />
            <Text style={st.legendText}>Today</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const getStStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },

  calCard: {
    backgroundColor: colors.surface,
    marginTop: 14,
    marginHorizontal: 14,
    borderRadius: 22,
    paddingTop: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  arrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.3,
  },

  legend: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 16,
    marginHorizontal: 20,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary,
  },
  legendToday: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: colors.primary,
  },
  legendText: { fontSize: 12, color: colors.secondary, fontWeight: '500' },
});
