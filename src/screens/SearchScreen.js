import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, ScrollView,
  Pressable, Keyboard, Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { advancedSearch, getAllTags } from '../utils/database';
import PostCard from '../components/PostCard';
import Header from '../components/Header';
import { CustomAlertManager } from '../components/CustomAlert';
import { useTheme } from '../theme/useTheme';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 15;

// ─── Date picker helpers ────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function SearchScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const s = getStyles(colors);
  const inputRef   = useRef(null);

  const [tags,          setTags]         = useState([]);
  const [history,       setHistory]      = useState([]);
  const [results,       setResults]      = useState([]);

  // Filter state
  const [text,          setText]         = useState('');
  const [activeTag,     setActiveTag]    = useState('');
  const [dateFilter,    setDateFilter]   = useState('');   // 'YYYY-MM-DD' or ''
  const [searching,     setSearching]    = useState(false);
  const [hasSearched,   setHasSearched]  = useState(false);

  // Load tags + history on focus
  useFocusEffect(
    useCallback(() => {
      getAllTags().then(setTags);
      AsyncStorage.getItem(HISTORY_KEY)
        .then(v => setHistory(v ? JSON.parse(v) : []))
        .catch(() => {});
      
      // If we already have results, refresh them to catch status changes
      if (hasSearched) {
        runSearch();
      }

      inputRef.current?.focus();
    }, [hasSearched])
  );

  // ── History helpers ────────────────────────────────────────────────────────

  const saveHistory = async (query) => {
    if (!query.trim()) return;
    const updated = [query.trim(), ...history.filter(h => h !== query.trim())].slice(0, MAX_HISTORY);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const removeHistory = async (item) => {
    const updated = history.filter(h => h !== item);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const clearHistory = () => {
    CustomAlertManager.alert('Clear search history?', 'Are you sure you want to clear your recent searches?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all', style: 'destructive',
        onPress: async () => {
          setHistory([]);
          await AsyncStorage.removeItem(HISTORY_KEY);
        },
      },
    ]);
  };

  // ── Search execution ──────────────────────────────────────────────────────

  const runSearch = async ({ t = text, tag = activeTag, date = dateFilter } = {}) => {
    if (!t.trim() && !tag && !date) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setSearching(true);
    setHasSearched(true);
    Keyboard.dismiss();
    if (t.trim()) saveHistory(t.trim());
    const rows = await advancedSearch({ text: t, tag, dateStr: date });
    setResults(rows);
    setSearching(false);
  };

  const handleTagToggle = (tagName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = activeTag === tagName ? '' : tagName;
    setActiveTag(next);
    runSearch({ tag: next });
  };

  const handleDateToggle = () => {
    if (dateFilter) {
      setDateFilter('');
      runSearch({ date: '' });
    } else {
      const d = todayYMD();
      setDateFilter(d);
      runSearch({ date: d });
    }
  };

  const handleHistoryTap = (h) => {
    setText(h);
    runSearch({ t: h });
  };

  const handleClear = () => {
    setText('');
    setActiveTag('');
    setDateFilter('');
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  const hasFilters = !!text.trim() || !!activeTag || !!dateFilter;

  // ── Active filter chips ───────────────────────────────────────────────────

  const ActiveChips = () => (
    <View style={s.chips}>
      {text.trim() ? (
        <View style={s.chip}>
          <Ionicons name="text-outline" size={12} color={colors.secondary} />
          <Text style={s.chipLabel} numberOfLines={1}>{text.trim()}</Text>
          <Pressable onPress={() => { setText(''); runSearch({ t: '' }); }}>
            <Ionicons name="close" size={12} color={colors.secondary} />
          </Pressable>
        </View>
      ) : null}
      {activeTag ? (
        <View style={s.chip}>
          <Ionicons name="pricetag-outline" size={12} color={colors.secondary} />
          <Text style={s.chipLabel}>#{activeTag}</Text>
          <Pressable onPress={() => handleTagToggle(activeTag)}>
            <Ionicons name="close" size={12} color={colors.secondary} />
          </Pressable>
        </View>
      ) : null}
      {dateFilter ? (
        <View style={s.chip}>
          <Ionicons name="calendar-outline" size={12} color={colors.secondary} />
          <Text style={s.chipLabel}>{dateFilter}</Text>
          <Pressable onPress={handleDateToggle}>
            <Ionicons name="close" size={12} color={colors.secondary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  // ── Pre-search state (history + tags) ─────────────────────────────────────

  const PreSearch = () => (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Search history */}
      {history.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>RECENT</Text>
            <Pressable onPress={clearHistory}>
              <Text style={s.clearText}>Clear all</Text>
            </Pressable>
          </View>
          {history.map((h, i) => (
            <Pressable key={i} style={s.histRow} onPress={() => handleHistoryTap(h)}>
              <Ionicons name="time-outline" size={16} color={colors.secondary} />
              <Text style={s.histText} numberOfLines={1}>{h}</Text>
              <Pressable onPress={() => removeHistory(h)} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                <Ionicons name="close" size={18} color={colors.secondary} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}

      {/* Filter options */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>FILTER BY</Text>

        {/* Date toggle */}
        <Pressable
          style={[s.filterOption, dateFilter && s.filterOptionActive]}
          onPress={handleDateToggle}
        >
          <Ionicons
            name="calendar-outline"
            size={17}
            color={dateFilter ? colors.primary : colors.secondary}
          />
          <Text style={[s.filterOptionText, dateFilter && s.filterOptionTextActive]}>
            {dateFilter ? `Today — ${dateFilter}` : 'Today\'s entries'}
          </Text>
          {dateFilter && <Ionicons name="checkmark" size={15} color={colors.primary} />}
        </Pressable>
      </View>

      {/* Tags */}
      {tags.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>TAGS</Text>
          <View style={s.tagCloud}>
            {tags.map((t, i) => (
              <Pressable
                key={i}
                style={[s.tag, activeTag === t.name && s.tagActive]}
                onPress={() => handleTagToggle(t.name)}
              >
                <Text style={[s.tagText, activeTag === t.name && s.tagTextActive]}>
                  #{t.name}
                </Text>
                <View style={[s.tagBadge, activeTag === t.name && s.tagBadgeActive]}>
                  <Text style={[s.tagBadgeText, activeTag === t.name && s.tagBadgeTextActive]}>
                    {t.count}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );

  // ── Results state ─────────────────────────────────────────────────────────

  const NoResults = () => (
    <View style={s.emptyWrap}>
      <Ionicons name="search-outline" size={48} color={colors.border} />
      <Text style={s.emptyTitle}>No results</Text>
      <Text style={s.emptySub}>
        Try different keywords, {'\n'}tags, or remove filters.
      </Text>
    </View>
  );

  return (
    <View style={s.root}>
      <Header title="Search" showBack />
      
      {/* Search Input */}
      <View style={s.header}>
        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color={colors.secondary} />
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="Search posts, tags, dates…"
            placeholderTextColor={colors.secondary}
            value={text}
            onChangeText={setText}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => runSearch()}
          />
          {hasFilters && (
            <Pressable onPress={handleClear} hitSlop={10}>
              <Ionicons name="close-circle" size={17} color={colors.secondary} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => navigation.goBack()} style={s.cancelBtn}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      {/* Active filter chips */}
      {hasFilters && <ActiveChips />}

      {/* Body */}
      {!hasSearched ? (
        <PreSearch />
      ) : searching ? (
        <View style={s.emptyWrap}>
          <Text style={s.searching}>Searching…</Text>
        </View>
      ) : results.length === 0 ? (
        <NoResults />
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PostCard post={item} onPin={() => {}} onDelete={() => {}} />
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={s.resultCount}>
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </Text>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const getStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.primary,
    padding: 0,
  },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 15, color: colors.primary, fontWeight: '500' },

  // Active chips
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.border,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipLabel: { fontSize: 12, color: colors.primary, fontWeight: '500', flex: 1 },

  // Pre-search sections
  section: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.secondary,
    marginBottom: 8,
  },
  clearText: { fontSize: 13, color: colors.secondary, fontWeight: '500' },

  // History
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.border,
  },
  histText: { flex: 1, fontSize: 15, color: colors.primary },

  // Filter option
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 6,
  },
  filterOptionActive: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  filterOptionText: { flex: 1, fontSize: 15, color: colors.secondary, fontWeight: '500' },
  filterOptionTextActive: { color: colors.primary },

  // Tags
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagText: { fontSize: 14, color: colors.secondary, fontWeight: '500' },
  tagTextActive: { color: colors.background },
  tagBadge: {
    backgroundColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tagBadgeText: { fontSize: 11, color: colors.secondary, fontWeight: '600' },
  tagBadgeTextActive: { color: colors.background },

  // Results
  resultCount: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '500',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  // Empty / states
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 80,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.secondary },
  emptySub: { fontSize: 14, color: colors.secondary, textAlign: 'center', lineHeight: 22 },
  searching: { fontSize: 15, color: colors.secondary },
});
