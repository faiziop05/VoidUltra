import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  Pressable, Dimensions
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getFavoritePosts } from '../utils/database';
import PostCard from '../components/PostCard';
import Header from '../components/Header';
import PostEvents from '../utils/PostEvents';

const FILTERS = [
  { key: 'all', label: 'All', icon: 'heart-outline' },
  { key: 'image', label: 'Photos', icon: 'image-outline' },
  { key: 'video', label: 'Videos', icon: 'videocam-outline' },
  { key: 'audio', label: 'Audio', icon: 'musical-notes-outline' },
];

export default function FavoritesScreen() {
  const navigation = useNavigation();
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFavoritePosts(filter);
      setPosts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const unsub = PostEvents.on('postUpdated', (data) => {
      if (data.is_favorite === false) {
        setPosts(current => current.filter(p => p.id !== data.id));
      }
    });
    return unsub;
  }, []);

  const renderFilterBar = () => (
    <View style={s.filterBar}>
      {FILTERS.map((f) => {
        const isActive = filter === f.key;
        return (
          <Pressable
            key={f.key}
            style={[s.filterPill, isActive && s.filterPillActive]}
            onPress={() => setFilter(f.key)}
          >
            <Ionicons
              name={f.icon}
              size={14}
              color={isActive ? '#111' : '#AAA'}
            />
            <Text style={[s.filterLabel, isActive && s.filterLabelActive]}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={s.root}>
      <Header title="Favorites" showBack />
      
      {renderFilterBar()}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#CCC" />
        </View>
      ) : posts.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="heart-dislike-outline" size={36} color="#D8D8D8" />
          </View>
          <Text style={s.emptyTitle}>No favorites yet</Text>
          <Text style={s.emptySub}>
            Items you heart will appear here{'\n'}even after the void is emptied.
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard 
              post={item} 
              onPress={() => navigation.navigate('ThreadScreen', { postId: item.id })} 
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={load}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  list: { paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
    gap: 8,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 0.75,
    borderBottomColor: '#F0F0F0',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F3F3',
  },
  filterPillActive: {
    backgroundColor: '#EBEBEB',
    borderWidth: 1,
    borderColor: '#111',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#AAA',
  },
  filterLabelActive: {
    color: '#111',
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    elevation: 1,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#888', marginTop: 4 },
  emptySub: { fontSize: 14, color: '#AAA', textAlign: 'center', lineHeight: 21 },
});
