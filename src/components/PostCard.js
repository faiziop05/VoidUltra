import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, Share,
  Modal, Animated, TouchableWithoutFeedback,
  FlatList, Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MediaViewer from './MediaViewer';
import ChecklistBlock from './ChecklistBlock';
import MarkdownView from './MarkdownView';
import { UserAvatar } from './UserAvatar';
import AudioPlayer from './AudioPlayer';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { deletePost, updatePostPin, updatePostFavorite } from '../utils/database';
import PostEvents from '../utils/PostEvents';
import { useDemo } from '../context/DemoContext';
import { useTheme } from '../theme/useTheme';


const AVATAR = 36;
const CONTENT_COLLAPSE_CHARS = 220;
const { width: SW } = Dimensions.get('window');
// Card body available width: screen - card margins(28) - left indent(60) - right pad(14)
const SLIDE_W = SW - 28 - 60 - 14;

// ─── Single media slide (4:3 blurred background) ────────────────────────────────
function MediaSlide({ item, width, onPress }) {
  const isVideo = item.media_type === 'video';
  const h = Math.round((width * 3) / 4); // enforce 4:3

  // For videos: generate a real thumbnail frame (at t=0) asynchronously.
  // For images: use the file URI directly.
  const [thumbUri, setThumbUri] = useState(isVideo ? null : item.file_uri);

  useEffect(() => {
    if (!isVideo) return;
    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(item.file_uri, { time: 0 })
      .then(({ uri }) => { if (!cancelled) setThumbUri(uri); })
      .catch(() => { }); // keep dark bg on failure
    return () => { cancelled = true; };
  }, [item.file_uri]);

  return (
    <Pressable onPress={onPress} style={[ms.slide, { width, height: h }]}>

      {/* Blurred background — fills the letterbox area behind the main image */}
      {thumbUri ? (
        <Image
          source={{ uri: thumbUri }}
          style={StyleSheet.absoluteFillObject}
          blurRadius={20}
          opacity={0.75}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#111' }]} />
      )}

      {/* Main Image/Thumbnail */}
      {thumbUri && (
        <Image
          source={{ uri: thumbUri }}
          style={ms.img}
          resizeMode="contain"
        />
      )}

      {/* Video Indicator */}
      {isVideo && (
        <View style={ms.playBadge}>
          <Ionicons name="play" size={18} color="#FFF" />
        </View>
      )}
    </Pressable>
  );
}

const ms = StyleSheet.create({
  slide: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  img: {
    flex: 1,
  },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─── Carousel ────────────────────────────────────────────────────────────────
function MediaCarousel({ items, slideWidth, onItemPress }) {
  const [active, setActive] = useState(0);

  if (items.length === 1) {
    return <MediaSlide item={items[0]} width={slideWidth} onPress={() => onItemPress(0)} />;
  }

  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={items}
        renderItem={({ item, index }) => (
          <View style={{ width: slideWidth }}>
            <MediaSlide item={item} width={slideWidth} onPress={() => onItemPress(index)} />
          </View>
        )}
        keyExtractor={(item) => item.id.toString()}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (slideWidth + 10));
          setActive(idx);
        }}
      />
      <View style={car.dots}>
        {items.map((_, i) => (
          <View key={i} style={[car.dot, active === i && car.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const car = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#D8D8D8' },
  dotActive: { backgroundColor: '#555', width: 14 },
});

// ─── Action Sheet ────────────────────────────────────────────────────────────
function ActionSheet({ visible, onClose, title, options }) {
  const { colors } = useTheme();
  const as = getAsStyles(colors);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={as.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={as.sheet}>
              <View style={as.handle} />
              {title && <Text style={as.sheetTitle}>{title}</Text>}
              {options.map((opt, i) => (
                <Pressable
                  key={i}
                  onPress={() => { onClose(); opt.onPress(); }}
                  style={({ pressed }) => [
                    as.option,
                    opt.destructive && as.optionDestructive,
                    opt.cancel && as.optionCancel,
                    { backgroundColor: pressed ? '#F5F5F5' : 'transparent' }
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={22}
                    color={opt.destructive ? '#E53935' : opt.cancel ? '#888' : '#444'}
                    style={as.optionIcon}
                  />
                  <Text style={[
                    as.optionText,
                    opt.destructive && as.optionTextDestructive,
                    opt.cancel && as.optionTextCancel
                  ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Main PostCard ───────────────────────────────────────────────────────────

export default function PostCard({ post, onPin, onDelete, isReply = false, hideReply = false, }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const st = getStyles(colors);
  const [username, setUsername] = useState('You');
  const [menuVisible, setMenuVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(post.is_favorite || false);
  const [isPinned, setIsPinned] = useState(post.is_pinned || false);
  const { isDemoActive, demoStep, nextStep, demoPostId } = useDemo();

  useEffect(() => {
    AsyncStorage.getItem('username').then(n => { if (n) setUsername(n); });
  }, []);

  useEffect(() => {
    setIsFavorite(post.is_favorite || false);
    setIsPinned(post.is_pinned || false);
  }, [post.is_favorite, post.is_pinned]);

  useEffect(() => {
    // Listen for updates from other PostCards or screens
    const unsub = PostEvents.on('postUpdated', (data) => {
      if (data.id === post.id) {
        if (data.is_favorite !== undefined) setIsFavorite(data.is_favorite);
        if (data.is_pinned !== undefined) setIsPinned(data.is_pinned);
      }
    });
    return unsub;
  }, [post.id]);

  const formatTime = (ts) => {
    const d = Date.now() - ts;
    if (d < 60000) return 'just now';
    if (d < 3600000) return `${Math.floor(d / 60000)}m`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const toggleFavorite = async () => {
    try {
      const newVal = !isFavorite;
      setIsFavorite(newVal);
      await updatePostFavorite(post.id, newVal);
      PostEvents.emit('postUpdated', { id: post.id, is_favorite: newVal });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('Favorite toggle error:', e);
      setIsFavorite(!isFavorite);
    }
  };

  const togglePin = async () => {
    try {
      const newVal = !isPinned;
      setIsPinned(newVal);
      await onPin?.(post);
      PostEvents.emit('postUpdated', { id: post.id, is_pinned: newVal });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('Pin toggle error:', e);
      setIsPinned(!isPinned);
    }
  };

  const openMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuVisible(true);
  };

  const openMediaAt = (i) => { setMediaViewerIndex(i); setMediaViewerVisible(true); };

  const media = post.media || [];
  const visualMedia = media.filter(m => m.media_type !== 'audio');
  const audioMedia = media.filter(m => m.media_type === 'audio');
  const checklist = post.checklist || [];
  const tags = post.tags || [];
  const firstReply = post.firstReply;
  const replyCount = post.replyCount ?? 0;
  const content = post.content || '';

  const isLong = content.length > CONTENT_COLLAPSE_CHARS;
  const displayContent = isLong && !expanded
    ? content.slice(0, CONTENT_COLLAPSE_CHARS).trimEnd() + '...'
    : content;

  const menuOptions = [
    {
      icon: 'create-outline',
      label: 'Edit',
      onPress: () => navigation.navigate('ComposeScreen', { editPost: post }),
    },
    {
      icon: 'share-outline',
      label: 'Share',
      onPress: () => Share.share({ message: content }),
    },
    {
      icon: isPinned ? 'bookmark' : 'bookmark-outline',
      label: isPinned ? 'Unpin' : 'Pin to top',
      onPress: togglePin,
    },
    {
      icon: 'trash-outline',
      label: 'Delete post',
      destructive: true,
      onPress: () => onDelete?.(post),
    },
    {
      icon: 'close-outline',
      label: 'Cancel',
      cancel: true,
      onPress: () => { },
    },
  ];

  return (
    <>
      <Pressable
        style={[st.card, isReply && st.cardReply]}
        onPress={() => {
          if (isDemoActive && demoStep === 4 && post.id === demoPostId) {
            nextStep();
          }
          if (!isReply) navigation.navigate('ThreadScreen', { postId: post.id });
        }}
        onLongPress={openMenu}
        delayLongPress={380}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={st.header}>
          <UserAvatar style={st.avatar} />
          <View style={st.headerMid}>
            <View style={st.nameRow}>
              <Text style={st.username}>{username}</Text>
            </View>
            <Text style={st.timestamp}>{formatTime(post.timestamp)}</Text>
          </View>
          <Pressable style={st.dotBtn} onPress={openMenu} hitSlop={12}>
            <Ionicons name="ellipsis-horizontal" size={18} color="#BBBBBB" />
          </Pressable>
        </View>

        {/* ── Content ──────────────────────────────────────────────── */}
        <View style={st.body}>
          {!!content && (
            <>
              <MarkdownView content={displayContent} />
              {isLong && (
                <Pressable
                  onPress={() => setExpanded(e => !e)}
                  style={st.expandBtn}
                >
                  <Text style={st.expandText}>
                    {expanded ? 'Show less' : 'Show more'}
                  </Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color="#999"
                  />
                </Pressable>
              )}
            </>
          )}

          {/* Checklist */}
          {checklist.length > 0 && (
            <View style={{ marginTop: content ? 6 : 0 }}>
              <ChecklistBlock items={checklist} />
            </View>
          )}

          {/* Voice Notes */}
          {audioMedia.length > 0 && (
            <View style={{ marginTop: content || checklist.length ? 12 : 0, gap: 10 }}>
              {audioMedia.map((m, i) => (
                <AudioPlayer key={m.id || i} uri={m.file_uri} />
              ))}
            </View>
          )}

          {/* Media — 4:3 blurred-backdrop carousel */}
          {visualMedia.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <MediaCarousel
                items={visualMedia}
                slideWidth={SLIDE_W}
                onItemPress={(i) => openMediaAt(i)}
              />
            </View>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <View style={st.tagsRow}>
              {tags.map((tag, i) => (
                <View key={i} style={st.tagPill}>
                  <Text style={st.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

        </View>

        {/* Engagement Group (Bottom Right) */}
        {!isReply && (
          <View style={st.engagementRow}>
            {!hideReply && (
              <Pressable
                style={st.engageBtn}
                onPress={() => navigation.navigate('ThreadScreen', { postId: post.id })}
                hitSlop={8}
              >
                <View style={st.engageIconWrap}>
                  <Ionicons name="chatbubble-outline" size={18} color="#999" />
                  {replyCount > 0 && (
                    <View style={st.badge}>
                      <Text style={st.badgeText}>{replyCount}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            )}

            <Pressable style={st.engageBtn} onPress={togglePin} hitSlop={8}>
              <Ionicons
                name={isPinned ? "bookmark" : "bookmark-outline"}
                size={17}
                color={isPinned ? "#F59E0B" : "#999"}
              />
            </Pressable>

            <Pressable style={st.engageBtn} onPress={toggleFavorite} hitSlop={8}>
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={19}
                color={isFavorite ? "#EF4444" : "#999"}
              />
            </Pressable>
          </View>
        )}

        {/* ── First reply preview ──────────────────────────────── */}
        {/* {!isReply && firstReply && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
            <Pressable
              style={st.replyPreview}
              onPress={() => navigation.navigate('ThreadScreen', { postId: post.id })}
            >
              <View style={st.replyInner}>
                <UserAvatar style={st.replyAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={st.replyName}>{username}</Text>
                  <Text style={st.replySnippet} numberOfLines={2}>
                    {firstReply.content}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
        )} */}
      </Pressable>

      <ActionSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title="Post options"
        options={menuOptions}
      />

      <MediaViewer
        visible={mediaViewerVisible}
        mediaItems={visualMedia}
        initialIndex={mediaViewerIndex}
        onClose={() => setMediaViewerVisible(false)}
      />
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const getStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 14,
    marginVertical: 7,
    borderRadius: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  cardReply: {
    marginHorizontal: 10,
    marginLeft: 22,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.surface,
    marginRight: 10,
  },
  headerMid: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  timestamp: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 1,
  },
  engageBtn: {
    padding: 2,
  },
  engageIconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: colors.primary,
    borderRadius: 9,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.background,
    fontSize: 9,
    fontWeight: '800',
  },
  dotBtn: {
    padding: 2,
    marginLeft: 2,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingLeft: 14 + AVATAR + 10,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 5,
  },
  expandText: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '500',
  },
  media1Wrap: {
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
    backgroundColor: '#111',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  media1Img: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaCell: {
    height: 108,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#111',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flex: 1,
  },
  mediaCellImg: {
    ...StyleSheet.absoluteFillObject,
  },
  playBadge: {
    position: 'absolute',
    bottom: 7,
    right: 7,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 20,
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.50)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 9,
  },
  tagPill: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  replyPreview: {
    marginTop: 11,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    paddingLeft: 16,
    overflow: 'hidden',
  },
  replyAccent: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  replyInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  replyAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.border,
    marginTop: 2,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 1,
  },
  replySnippet: {
    fontSize: 13,
    color: colors.secondary,
    lineHeight: 18,
  },
  replyMore: {
    marginTop: 5,
    paddingLeft: 26,
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '500',
  },
});

const getAsStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 34,
    paddingTop: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
    textAlign: 'center',
    letterSpacing: 0.2,
    paddingBottom: 8,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.border,
  },
  optionIcon: {
    marginRight: 14,
  },
  optionText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  optionTextDestructive: {
    color: '#E53935',
  },
  optionTextCancel: {
    color: '#888',
    fontWeight: '400',
  },
});
