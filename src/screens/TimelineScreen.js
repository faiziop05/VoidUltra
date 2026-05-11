import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/useTheme';
import { getPosts, updatePostPin, deletePost } from '../utils/database';
import PostCard from '../components/PostCard';
import Header from '../components/Header';
import { useDemo } from '../context/DemoContext';
import { triggerStoreReview } from '../utils/StoreReviewHelper';

export default function TimelineScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { 
    isDemoActive, demoStep, setHighlightCoords, 
    nextStep, setDemoStep, registerContinueAction,
    demoPostId
  } = useDemo();
  const fabRef = useRef(null);
  const listRef = useRef(null);
  const firstPostRef = useRef(null);

  useEffect(() => {
    const checkDemo = async () => {
      const seen = await AsyncStorage.getItem('hasSeenDemo');
      if (seen !== 'true') {
        setDemoStep(0); // Show intro modal
        await AsyncStorage.setItem('hasSeenDemo', 'true');
      } else {
        setDemoStep(-1); // Hide demo
      }
    };
    checkDemo();
  }, []);

  useEffect(() => {
    if (!isDemoActive) return;

    if (demoStep === 1) {
      return registerContinueAction(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        nextStep(); 
        navigation.navigate('ComposeScreen');
      });
    }

    if (demoStep === 4) {
      return registerContinueAction(() => {
        if (demoPostId) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          nextStep();
          navigation.navigate('ThreadScreen', { postId: demoPostId });
        } else {
          nextStep(); 
        }
      });
    }
  }, [isDemoActive, demoStep, demoPostId]);

  const fetchPosts = async () => {
    const data = await getPosts();
    setPosts(data);
    triggerStoreReview();
  };

  useFocusEffect(
    useCallback(() => {
      fetchPosts();

      // Demo measurement for Step 1
      if (isDemoActive && demoStep === 1) {
        setTimeout(() => {
          fabRef.current?.measure((x, y, width, height, px, py) => {
            setHighlightCoords({ x: px, y: py, width, height });
          });
        }, 500);
      }
      
      // Demo measurement for Step 4 (Highlight post)
      if (isDemoActive && demoStep === 4) {
        setTimeout(() => {
          firstPostRef.current?.measure((x, y, width, height, px, py) => {
            setHighlightCoords({ x: px, y: py, width, height });
          });
        }, 800);
      }
    }, [isDemoActive, demoStep])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchPosts();
    setRefreshing(false);
  };

  const handlePin = async (post) => {
    await updatePostPin(post.id, !post.is_pinned);
    fetchPosts();
  };

  const handleDelete = async (post) => {
    await deletePost(post.id);
    fetchPosts();
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  const EmptyState = (
    <View style={styles.emptyContainer}>
      {/* Hand-drawn style illustration using nested views */}
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyPageOuter}>
          <View style={styles.emptyPageLine} />
          <View style={[styles.emptyPageLine, { width: '65%' }]} />
          <View style={[styles.emptyPageLine, { width: '80%' }]} />
          <View style={[styles.emptyPageLine, { width: '45%', marginTop: 8 }]} />
        </View>
        <View style={styles.emptyPenDot} />
      </View>

      <Text style={styles.emptyTitle}>Your void is empty</Text>
      <Text style={styles.emptySubtext}>
        Start writing to capture your thoughts,{'\n'}ideas, and moments.
      </Text>

      <Pressable
        style={styles.emptyBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          navigation.navigate('ComposeScreen');
        }}
      >
        <Ionicons name="create-outline" size={18} color="#FFF" />
        <Text style={styles.emptyBtnText}>Write your first post</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.safeArea}>
      <Header 
        title="VOID ULTRA" 
        rightContent={
          <Pressable onPress={() => navigation.navigate('SearchScreen')}>
            <Ionicons name="search" size={22} color={colors.primary} />
          </Pressable>
        }
      />

      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <View 
            ref={index === 0 ? firstPostRef : null} 
            collapsable={false}
          >
            <PostCard 
               post={item} 
               onPin={handlePin} 
               onDelete={handleDelete} 
            />
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.secondary} />}
        ListEmptyComponent={EmptyState}
        contentContainerStyle={posts.length === 0 ? { flexGrow: 1 } : { paddingBottom: 80 }}
      />

      <Pressable
        ref={fabRef}
        collapsable={false}
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          navigation.navigate('ComposeScreen');
        }}
      >
        <Ionicons name="add" size={32} color={colors.background} />
      </Pressable>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
    paddingBottom: 80,
  },
  emptyIllustration: {
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPageOuter: {
    width: 80,
    height: 100,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    gap: 7,
    shadowColor: colors.primary,
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyPageLine: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    width: '100%',
  },
  emptyPenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderWidth: 2,
    borderColor: colors.background,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});

