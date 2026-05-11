import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import PostCard from '../components/PostCard';
import Header from '../components/Header';
import { getPostsForDay, deletePost, updatePostPin } from '../utils/database';
import { useTheme } from '../theme/useTheme';
import { useCallback } from 'react';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export default function DayFeedScreen() {
  const route      = useRoute();
  const { date }   = route.params; // 'YYYY-MM-DD'
  const { colors } = useTheme();
  const st = getStyles(colors);

  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const rows = await getPostsForDay(date);
        if (active) { setPosts(rows); setLoading(false); }
      })();
      return () => { active = false; };
    }, [date])
  );

  const handlePin = async (post) => {
    const newVal = !post.is_pinned;
    await updatePostPin(post.id, newVal);
    setPosts(p => p.map(q => q.id === post.id ? { ...q, is_pinned: newVal } : q));
  };

  const handleDelete = async (post) => {
    await deletePost(post.id);
    setPosts(p => p.filter(q => q.id !== post.id));
  };

  return (
    <View style={st.root}>
      <Header title={formatDate(date)} showBack />

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color="#CCCCCC" />
        </View>
      ) : posts.length === 0 ? (
        <View style={st.center}>
          <Ionicons name="document-outline" size={52} color="#E0E0E0" />
          <Text style={st.emptyTitle}>Nothing here</Text>
          <Text style={st.emptySub}>You didn't write anything on this day.</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPin={handlePin}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.secondary },
  emptySub:   { fontSize: 14, color: colors.secondary, textAlign: 'center', lineHeight: 22 },
});
