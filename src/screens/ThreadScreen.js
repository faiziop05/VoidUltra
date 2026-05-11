import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  KeyboardAvoidingView, Platform, Pressable, ActivityIndicator,
  Keyboard, Image, Share, Modal, TouchableWithoutFeedback, Animated,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme/theme';
import { getThread, createPost, deletePost, updatePostPin } from '../utils/database';
import { useTheme } from '../theme/useTheme';
import PostCard from '../components/PostCard';
import { UserAvatar } from '../components/UserAvatar';
import Header from '../components/Header';
import { useDemo } from '../context/DemoContext';

export default function ThreadScreen({ route, navigation }) {
  const { postId } = route.params;
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { 
    isDemoActive, demoStep, setHighlightCoords, 
    nextStep, resetDemo, demoPostId, registerContinueAction 
  } = useDemo();
  const originalPostRef = useRef(null);
  const listRef = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const fetchThread = async () => {
    try {
      const data = await getThread(postId);
      if (!data) {
        navigation.goBack();
      } else {
        setThread(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [username, setUsername] = useState('You');

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('username').then(n => { if (n) setUsername(n); });
      fetchThread();

      // Demo measurement for Step 5
      if (isDemoActive && demoStep === 5) {
        setTimeout(() => {
          originalPostRef.current?.measure((x, y, width, height, px, py) => {
            setHighlightCoords({ x: px, y: py, width, height });
          });
        }, 800);
      }
    }, [postId, isDemoActive, demoStep])
  );

  useEffect(() => {
    if (!isDemoActive) return;

    if (demoStep === 5) {
      return registerContinueAction(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        nextStep();
        navigation.goBack();
      });
    }
  }, [isDemoActive, demoStep]);

  const replies = thread?.replies ?? [];

  const handlePostReply = async () => {
    if (!replyContent.trim()) return;
    setIsSubmitting(true);
    try {
      await createPost({ content: replyContent.trim(), parentId: postId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReplyContent('');
      Keyboard.dismiss();
      fetchThread();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 300);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePin = async (post) => {
    await updatePostPin(post.id, !post.is_pinned);
    fetchThread();
  };

  const handleDelete = async (post) => {
    await deletePost(post.id);
    if (post.id === postId) {
      navigation.goBack();
    } else {
      fetchThread();
    }
  };

  // Removed redundant renderHeader logic as elements are now sticky siblings

  const handleShare = (post) => {
    Share.share({ message: post.content });
  };

  // Helper for reply actions
  const ReplyItem = ({ item, isLast }) => {
    const [menuVisible, setMenuVisible] = useState(false);

    const menuOptions = [
      {
        icon: 'share-outline',
        label: 'Share',
        onPress: () => handleShare(item),
      },
      {
        icon: 'trash-outline',
        label: 'Delete reply',
        destructive: true,
        onPress: () => handleDelete(item),
      },
    ];

    const formatTimeShort = (ts) => {
      const d = Date.now() - ts;
      if (d < 60000) return 'now';
      if (d < 3600000) return `${Math.floor(d / 60000)}m`;
      if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
      return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
      <View style={styles.replyItem}>
        <View style={styles.replyHeader}>
          <UserAvatar style={styles.replyAvatarSmall} />
          <View style={styles.replyHeaderMid}>
            <Text style={styles.replyUsername}>{item.author_name || username}</Text>
            <Text style={styles.replyTime}>{formatTimeShort(item.timestamp)}</Text>
          </View>
          <Pressable onPress={() => setMenuVisible(true)} hitSlop={10} style={styles.replyMenuBtn}>
            <Ionicons name="ellipsis-horizontal" size={16} color={colors.secondary} />
          </Pressable>
        </View>

        <Text style={styles.replyText}>{item.content}</Text>

        {!isLast && <View style={styles.replyDivider} />}

        <Modal visible={menuVisible} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
            <View style={styles.menuOverlay}>
              <View style={styles.menuContent}>
                {menuOptions.map((opt, i) => (
                  <Pressable
                    key={i}
                    style={styles.menuOption}
                    onPress={() => { setMenuVisible(false); opt.onPress(); }}
                  >
                    <Ionicons name={opt.icon} size={20} color={opt.destructive ? colors.danger : colors.primary} />
                    <Text style={[styles.menuOptionText, opt.destructive && { color: colors.danger }]}>{opt.label}</Text>
                  </Pressable>
                ))}
                <Pressable style={styles.menuCancel} onPress={() => setMenuVisible(false)}>
                  <Text style={styles.menuCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    );
  };

  const renderReply = ({ item, index }) => (
    <ReplyItem item={item} isLast={index === replies.length - 1} />
  );

  if (loading || !thread) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Thread" showBack />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={listRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topContent}>
            <View ref={originalPostRef} collapsable={false}>
              <PostCard
                post={thread?.original}
                onPin={handlePin}
                onDelete={handleDelete}
                hideReply={true}
                isReply={true}
              />
            </View>

            {/* Reply input area */}
            <View style={styles.replyBarInline}>
              <UserAvatar style={styles.replyAvatar} />
              <TextInput
                style={styles.replyInput}
                placeholder="Add a reply…"
                placeholderTextColor={colors.secondary}
                value={replyContent}
                onChangeText={setReplyContent}
                multiline
                maxLength={500}
              />
              <Pressable
                onPress={handlePostReply}
                disabled={!replyContent.trim() || isSubmitting}
                style={[
                  styles.sendBtn,
                  (!replyContent.trim() || isSubmitting) && styles.sendBtnDisabled,
                ]}
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={replyContent.trim() ? colors.background : colors.secondary}
                />
              </Pressable>
            </View>

            {/* Section Indicator */}
            {replies && replies.length > 0 && (
              <View style={styles.sectionHeaderSticky}>
                <Text style={styles.sectionTitle}>
                  {replies.length} {replies.length === 1 ? 'REPLY' : 'REPLIES'}
                </Text>
              </View>
            )}
          </View>

          {/* List of Replies */}
          {replies.length > 0 ? (
            replies.map((reply, index) => (
              <ReplyItem
                key={reply.id}
                item={reply}
                isLast={index === replies.length - 1}
              />
            ))
          ) : (
            <View style={styles.emptyReplies}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.border} />
              <Text style={styles.emptyText}>No replies yet. Be the first!</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ADADAD',
    letterSpacing: 1.2,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  topContent: {
    backgroundColor: colors.background,
  },
  sectionHeaderSticky: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  replyItem: {
    backgroundColor: colors.background,
    marginHorizontal: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    marginRight: 10,
  },
  replyHeaderMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  replyUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  replyTime: {
    fontSize: 12,
    color: colors.secondary,
  },
  replyMenuBtn: {
    padding: 4,
  },
  replyText: {
    fontSize: 15,
    color: colors.primary,
    lineHeight: 22,
    paddingLeft: 34,
    marginBottom: 16,
  },
  replyDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 34,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 12,
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },
  menuCancel: {
    marginTop: 10,
    alignItems: 'center',
    padding: 15,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.secondary,
  },
  replyBarInline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 12,
    padding: 10,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
  },
  replyInput: {
    flex: 1,
    fontSize: 16,
    color: colors.primary,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.border,
  },
  emptyReplies: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    color: colors.secondary,
    fontSize: 16,
  },
});
