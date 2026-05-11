import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Image,
  Dimensions, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import MediaViewer from '../components/MediaViewer';
import { getAllMedia } from '../utils/database';
import Header from '../components/Header';
import { useTheme } from '../theme/useTheme';

const { width: SW } = Dimensions.get('window');
const COLS = 3;
const GAP = 2;
const CELL_W = (SW - GAP * (COLS + 1)) / COLS;
const CELL_H = CELL_W;

// ─── Filter bar ───────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all', label: 'All', icon: 'grid-outline' },
  { key: 'image', label: 'Photos', icon: 'image-outline' },
  { key: 'video', label: 'Videos', icon: 'videocam-outline' },
  { key: 'audio', label: 'Audio', icon: 'mic-outline' },
];

function FilterBar({ active, onSelect }) {
  const { colors } = useTheme();
  const fb = getFilterStyles(colors);
  return (
    <View style={fb.bar}>
      {FILTERS.map((f) => {
        const isActive = active === f.key;
        return (
          <Pressable
            key={f.key}
            style={[fb.pill, isActive && fb.pillActive]}
            onPress={() => onSelect(f.key)}
          >
            <Ionicons
              name={f.icon}
              size={14}
              color={isActive ? colors.background : colors.secondary}
            />
            <Text style={[fb.label, isActive && fb.labelActive]}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const getFilterStyles = (colors) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
  },
  labelActive: {
    color: colors.background,
  },
});

// ─── Grid cell ────────────────────────────────────────────────────────────────

function MediaCell({ item, onPress }) {
  const { colors } = useTheme();
  const cell = getCellStyles(colors);
  const [thumbUri, setThumbUri] = useState(
    item.media_type !== 'video' ? item.file_uri : null
  );

  React.useEffect(() => {
    if (item.media_type === 'video' && item.file_uri) {
      VideoThumbnails.getThumbnailAsync(item.file_uri, { time: 0 })
        .then(({ uri }) => setThumbUri(uri))
        .catch(() => { });
    }
  }, [item.file_uri]);

  return (
    <Pressable style={cell.wrap} onPress={onPress}>
      {thumbUri ? (
        <Image
          source={{ uri: thumbUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <View style={cell.loading}>
          <ActivityIndicator size="small" color="#CCC" />
        </View>
      )}

      {/* Media Type badge */}
      {item.media_type === 'video' && (
        <View style={cell.badge}>
          <Ionicons name="play" size={10} color="#fff" />
        </View>
      )}
      {item.media_type === 'audio' && (
        <View style={cell.audioContent}>
          <Ionicons name="mic" size={32} color="#AAA" />
          <Text style={cell.audioLabel}>Voice Note</Text>
        </View>
      )}
    </Pressable>
  );
}

const getCellStyles = (colors) => StyleSheet.create({
  wrap: {
    width: CELL_W,
    height: CELL_H,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  badge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    gap: 4,
  },
  audioLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondary,
    textTransform: 'uppercase',
  }
});

// ─── ReflectionsScreen ───────────────────────────────────────────────────────

export default function ReflectionsScreen() {
  const { colors } = useTheme();
  const st = getStStyles(colors);
  const navigation = useNavigation();
  const [allMedia, setAllMedia] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);

  // Reload on tab focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const rows = await getAllMedia();
          if (active) setAllMedia(rows);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [])
  );

  // Filtered list (drives both grid and viewer)
  const filtered = filter === 'all'
    ? allMedia
    : allMedia.filter(m => m.media_type === filter);

  const openAt = (gridIndex) => {
    setViewerIdx(gridIndex);
    setViewerOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const HeaderComponent = (
    <>
      <Header title="Reflections" subTitle={`${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`} />
      <FilterBar active={filter} onSelect={setFilter} />
      {/* Thin separator */}
      <View style={st.sep} />
    </>
  );

  if (loading) {
    return (
      <View style={st.root}>
        {HeaderComponent}
        <View style={st.center}>
          <ActivityIndicator size="large" color="#CCCCCC" />
        </View>
      </View>
    );
  }

  if (!filtered.length) {
    const emptyIcon = filter === 'image' ? 'image-outline' : filter === 'video' ? 'videocam-outline' : filter === 'audio' ? 'mic-outline' : 'images-outline';
    const emptyTitle = filter === 'all' ? 'No memories yet' : filter === 'image' ? 'No photos yet' : filter === 'video' ? 'No videos yet' : 'No audio yet';
    const emptySub = filter === 'all'
      ? "Photos, videos, and voice notes\nyou add to posts will appear here."
      : `Add ${filter === 'image' ? 'photos' : filter === 'video' ? 'videos' : 'audio messages'} to a post to see them here.`;

    return (
      <View style={st.root}>
        {HeaderComponent}
        <View style={st.center}>
          <View style={st.emptyIconWrap}>
            <Ionicons name={emptyIcon} size={36} color={colors.secondary} />
          </View>
          <Text style={st.emptyTitle}>{emptyTitle}</Text>
          <Text style={st.emptySub}>{emptySub}</Text>
          {filter === 'all' && (
            <Pressable
              style={st.emptyBtn}
              onPress={() => navigation.navigate('ComposeScreen')}
            >
              <Ionicons name="add" size={16} color={colors.background} />
              <Text style={st.emptyBtnText}>Add to a post</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        ListHeaderComponent={HeaderComponent}
        contentContainerStyle={st.grid}
        columnWrapperStyle={st.row}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <MediaCell
            item={item}
            onPress={() => openAt(index)}
          />
        )}
      />

      {/* Full-screen viewer — hideCounter so no X/N badge or dots */}
      <MediaViewer
        visible={viewerOpen}
        mediaItems={filtered}
        initialIndex={viewerIdx}
        onClose={() => setViewerOpen(false)}
        hideCounter
      />
    </View>
  );
}

const getStStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.6,
  },
  sub: {
    fontSize: 13,
    color: colors.secondary,
    marginTop: 2,
  },
  sep: {
    height: 0.75,
    backgroundColor: colors.border,
    marginBottom: 2,
  },

  grid: { paddingBottom: 24 },
  row: { gap: GAP, marginBottom: GAP, paddingHorizontal: GAP },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 60,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.secondary, marginTop: 4 },
  emptySub: { fontSize: 14, color: colors.secondary, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: { color: colors.background, fontSize: 14, fontWeight: '700' },
});
