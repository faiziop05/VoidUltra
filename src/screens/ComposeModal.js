import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, Keyboard, ScrollView, Image, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { createPost, updatePost } from '../utils/database';
import { UserAvatar } from '../components/UserAvatar';
import AudioPlayer from '../components/AudioPlayer';
import { CustomAlertManager } from '../components/CustomAlert';
import { useDemo } from '../context/DemoContext';
import { useTheme } from '../theme/useTheme';
import { triggerStoreReview } from '../utils/StoreReviewHelper';


// ─── Block model ─────────────────────────────────────────────────────────────
// type: 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered'
// bold & italic are independent flags that stack with the type

const uid = () => Math.random().toString(36).slice(2);
const block = (type = 'paragraph', text = '', extra = {}) => ({
  id: uid(), type, text, bold: false, italic: false, ...extra,
});

// ─── Serialise blocks → markdown ─────────────────────────────────────────────
const serialise = (blocks) =>
  blocks
    .filter(b => b.text.trim() !== '')
    .map(b => {
      const boldWrap = (t) => b.bold ? `**${t}**` : t;
      switch (b.type) {
        case 'bullet': return `- ${boldWrap(b.text)}`;
        case 'numbered': return `1. ${boldWrap(b.text)}`;
        default: return boldWrap(b.text);  // paragraph
      }
    })
    .join('\n');

// ─── Deserialise markdown → blocks (edit mode) ───────────────────────────────
const deserialise = (content) => {
  if (!content) return [block()];
  return content.split('\n').map(line => {
    let type = 'paragraph', raw = line, bold = false, italic = false;
    if (/^### /.test(line)) { type = 'h3'; raw = line.slice(4); }
    else if (/^## /.test(line)) { type = 'h2'; raw = line.slice(3); }
    else if (/^# /.test(line)) { type = 'h1'; raw = line.slice(2); }
    else if (/^- /.test(line)) { type = 'bullet'; raw = line.slice(2); }
    else if (/^\d+\. /.test(line)) { type = 'numbered'; raw = line.replace(/^\d+\. /, ''); }

    if (/^\*\*\*.*\*\*\*$/.test(raw)) { bold = true; italic = true; raw = raw.slice(3, -3); }
    else if (/^\*\*.*\*\*$/.test(raw)) { bold = true; raw = raw.slice(2, -2); }
    else if (/^\*.*\*$/.test(raw)) { italic = true; raw = raw.slice(1, -1); }
    else if (/^_.*_$/.test(raw)) { italic = true; raw = raw.slice(1, -1); }

    return { ...block(type, raw), bold, italic };
  });
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ComposeScreen({ navigation, route }) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const editPost = route?.params?.editPost ?? null;
  const parentId = route?.params?.parentId ?? null;
  const isEditing = !!editPost;

  const [blocks, setBlocks] = useState(() =>
    isEditing ? deserialise(editPost.content) : [block()]
  );
  const [tags, setTags] = useState(editPost?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [mediaItems, setMedia] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [focusedId, setFocused] = useState(() => blocks[0]?.id);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const { 
    isDemoActive, demoStep, nextStep, 
    setHighlightCoords, setDemoPostId, registerContinueAction 
  } = useDemo();
  const postBtnRef = useRef(null);
  // Track which block should auto-focus when it mounts (avoids setTimeout keyboard flicker)
  const [autoFocusId, setAutoFocusId] = useState(null);

  const refs = useRef({});
  const canvas = useRef(null);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      setRecordTime(0);
      timerRef.current = setInterval(() => {
        setRecordTime(p => p + 1);
      }, 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      pulseAnim.setValue(1);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const focused = blocks.find(b => b.id === focusedId);
  const canPost = blocks.some(b => b.text.trim()) || mediaItems.length > 0;

  // ── Demo Logic ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (isDemoActive && demoStep === 2) {
      const fullText = "Building my private void... This is local only! 🚀";
      let current = "";
      let charIdx = 0;

      const typeInterval = setInterval(() => {
        if (charIdx < fullText.length) {
          current += fullText[charIdx];
          // Atomic update for current focusing block
          setBlocks(prev => prev.map((b, i) => i === 0 ? { ...b, text: current } : b));
          charIdx++;
        } else {
          clearInterval(typeInterval);
          setTimeout(() => nextStep(), 500); // Move to Step 3 (Focus Post Button)
        }
      }, 70);

      return () => clearInterval(typeInterval);
    }
  }, [isDemoActive, demoStep]);

  useEffect(() => {
    if (!isDemoActive) return;

    if (demoStep === 3) {
      setTimeout(() => {
        postBtnRef.current?.measure((x, y, width, height, px, py) => {
          setHighlightCoords({ x: px, y: py, width, height });
        });
      }, 600);
      return registerContinueAction(() => {
        handlePost();
      });
    }
  }, [isDemoActive, demoStep]);

  // ── Block helpers ────────────────────────────────────────────────────────────

  const patch = (id, diff) =>
    setBlocks(p => p.map(b => b.id === id ? { ...b, ...diff } : b));

  // Insert a new block and focus it via autoFocus (no setTimeout = no keyboard flicker)
  const insertAfter = (afterId, type = 'paragraph', text = '') => {
    const nb = block(type, text);
    setBlocks(prev => {
      const i = prev.findIndex(b => b.id === afterId);
      const arr = [...prev];
      arr.splice(i + 1, 0, nb);
      return arr;
    });
    setFocused(nb.id);
    setAutoFocusId(nb.id); // native autoFocus fires on mount, no keyboard gap
    return nb.id;
  };

  // Delete a block — focus previous via ref (it already exists, no flicker)
  const deleteBlock = (id) => {
    setBlocks(prev => {
      if (prev.length <= 1) {
        // Can't delete last block — just reset it
        return prev.map(b => b.id === id ? { ...b, text: '', type: 'paragraph', bold: false, italic: false } : b);
      }
      const i = prev.findIndex(b => b.id === id);
      const next = prev.filter(b => b.id !== id);
      const targetId = next[Math.max(0, i - 1)]?.id;
      if (targetId) {
        setFocused(targetId);
        // The target already exists — use ref.focus() directly (no flicker since block is already mounted)
        setAutoFocusId(targetId);
      }
      return next;
    });
  };

  // ── Text change — intercepts Enter with a single atomic setBlocks call ──────
  // Uses one setBlocks call (not two) to prevent double render + focus timing gap

  const handleChange = (id, newText) => {
    const b = blocks.find(x => x.id === id);
    if (!b) return;

    const nlIdx = newText.indexOf('\n');

    // No newline — simple update, single setBlocks
    if (nlIdx === -1) {
      setBlocks(prev => prev.map(x => x.id === id ? { ...x, text: newText } : x));
      return;
    }

    const before = newText.slice(0, nlIdx);
    const after = newText.slice(nlIdx + 1);
    const isList = b.type === 'bullet' || b.type === 'numbered';

    if (isList && before.trim() === '') {
      // Empty list item + Enter → exit list mode back to paragraph
      setBlocks(prev => prev.map(x => x.id === id ? { ...x, text: '', type: 'paragraph' } : x));
      return;
    }

    // Create new block for the text after the cursor
    const nb = block(isList ? b.type : 'paragraph', after);

    // *** ATOMIC: update current block + insert new block in ONE setBlocks call ***
    // This prevents any intermediate render where no TextInput has focus
    setBlocks(prev => {
      const idx = prev.findIndex(x => x.id === id);
      const arr = [...prev];
      arr[idx] = { ...arr[idx], text: before };   // trim current block
      arr.splice(idx + 1, 0, nb);                  // insert new block
      return arr;
    });

    setFocused(nb.id);
    setAutoFocusId(nb.id); // native autoFocus on mount — no setTimeout gap
  };

  // Backspace on empty block → remove it
  const handleKeyPress = (id, key) => {
    const b = blocks.find(x => x.id === id);
    if (key === 'Backspace' && b?.text === '') deleteBlock(id);
  };

  // ── Format toolbar ────────────────────────────────────────────────────────────

  const toggle = (flag) => { if (focused) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); patch(focusedId, { [flag]: !focused[flag] }); } };
  const setType = (type) => {
    if (!focused) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = focused.type === type ? 'paragraph' : type;
    patch(focusedId, { type: next });
    setTimeout(() => refs.current[focusedId]?.focus(), 55);
  };

  // ── Media ─────────────────────────────────────────────────────────────────────

  const pickMedia = async (types = 'images') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        CustomAlertManager.alert('Permission Denied', 'Please allow access to your media library to select photos/videos.');
        return;
      }

      let mediaType = ImagePicker.MediaTypeOptions.All;
      if (types === 'images') mediaType = ImagePicker.MediaTypeOptions.Images;
      if (types === 'videos') mediaType = ImagePicker.MediaTypeOptions.Videos;

      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType,
        allowsMultipleSelection: true,
        quality: 0.9
      });
      if (!r.canceled) {
        setMedia(p => [...p, ...r.assets.map(a => ({ uri: a.uri, type: a.type === 'video' ? 'video' : 'image' }))]);
      }
    } catch (err) {
      console.error("Error picking media:", err);
      CustomAlertManager.alert('Gallery Error', 'Could not open the media library.');
    }
  };
  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { CustomAlertManager.alert('Permission Required', 'Camera permission is required to take photos.'); return; }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9
    });
    if (!r.canceled) setMedia(p => [...p, { uri: r.assets[0].uri, type: r.assets[0].type === 'video' ? 'video' : 'image' }]);
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') return CustomAlertManager.alert('Permission Required', 'Microphone permission is required to record voice notes.');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error(err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = recording.getURI();
    if (uri) {
      setMedia(p => [...p, { uri, type: 'audio' }]);
    }
    setRecording(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const pickFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'video/*', 'audio/*'],
        multiple: true
      });
      if (!res.canceled && res.assets?.length > 0) {
        const newMedia = res.assets.map(a => {
          const mime = a.mimeType || '';
          let type = 'image';
          if (mime.startsWith('video/')) type = 'video';
          else if (mime.startsWith('audio/')) type = 'audio';
          return { uri: a.uri, type };
        });
        setMedia(p => [...p, ...newMedia]);
      }
    } catch (err) {
      console.error("Error picking files", err);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handlePost = async () => {
    if (!canPost) return;
    setSubmitting(true);
    Keyboard.dismiss();
    try {
      const content = serialise(blocks);
      const allTags = [...tags, ...(content.match(/#[\w]+/g) || []).map(t => t.slice(1))]
        .filter((v, i, a) => v && a.indexOf(v) === i);
      if (isEditing) {
        await updatePost(editPost.id, { content, tagNames: allTags });
      } else {
        const id = await createPost({ content, mediaItems, tagNames: allTags, parentId });
        if (isDemoActive) setDemoPostId(id);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (isDemoActive) nextStep(); // Move to Step 4 (Highlight post in timeline)
      navigation.goBack();
      triggerStoreReview();
    } catch (e) {
      console.error(e);
      CustomAlertManager.alert('Submission Error', 'There was an error saving your post.');
      setSubmitting(false);
    }
  };

  // ── Block renderer ──────────────────────────────────────────────────────────

  const renderBlocks = () => {
    let numCount = 0;
    return blocks.map((b, idx) => {
      if (b.type === 'numbered') numCount++;
      else numCount = 0;
      return renderBlock(b, idx, numCount);
    });
  };

  const renderBlock = (b, idx, numCount) => {
    const isAutoFocus = b.id === autoFocusId;
    const shared = {
      ref: r => { refs.current[b.id] = r; },
      value: b.text,
      onChangeText: t => handleChange(b.id, t),
      onFocus: () => {
        setFocused(b.id);
        // Clear autoFocusId after it has done its job (prevent re-triggering on re-renders)
        if (isAutoFocus) setAutoFocusId(null);
      },
      onKeyPress: ({ nativeEvent: { key } }) => handleKeyPress(b.id, key),
      multiline: true,
      blurOnSubmit: false,
      scrollEnabled: false,
      autoFocus: isAutoFocus,
    };

    const inlineStyle = [b.bold && s.bold, b.italic && s.italic];

    // ── Bullet ────────────────────────────────────────────────────
    if (b.type === 'bullet') {
      return (
        <View key={b.id} style={s.listRow}>
          <Text style={s.listMarkerBullet}>•</Text>
          <TextInput
            {...shared}
            style={[s.body, ...inlineStyle, s.listInput]}
            placeholder="List item"
            placeholderTextColor={colors.secondary}
          />
        </View>
      );
    }

    // ── Numbered ──────────────────────────────────────────────────
    if (b.type === 'numbered') {
      return (
        <View key={b.id} style={s.listRow}>
          <Text style={s.listMarkerNum}>{numCount}.</Text>
          <TextInput
            {...shared}
            style={[s.body, ...inlineStyle, s.listInput]}
            placeholder="List item"
            placeholderTextColor={colors.secondary}
          />
        </View>
      );
    }

    // All non-list blocks render as paragraph (headings removed)
    const openFocus = idx === 0 && !isEditing && !autoFocusId;
    return (
      <TextInput
        key={b.id}
        {...shared}
        autoFocus={isAutoFocus || openFocus}
        style={[s.body, b.bold && s.bold, idx === 0 && s.firstBlock]}
        placeholder={idx === 0 ? (parentId ? 'Write a reply…' : "What's on your mind?") : ''}
        placeholderTextColor={colors.secondary}
      />
    );
  };

  // ── Toolbar button ──────────────────────────────────────────────────────────

  const Btn = ({ lbl, icon, active, onPress }) => (
    <Pressable style={[s.tbBtn, active && s.tbActive]} onPress={onPress} hitSlop={8}>
      {icon
        ? <Ionicons name={icon} size={17} color={active ? colors.background : colors.secondary} />
        : <Text style={[s.tbLbl, active && s.tbLblActive]}>{lbl}</Text>
      }
    </Pressable>
  );
  const Sep = () => <View style={s.tbSep} />;

  const ft = focused?.type ?? 'paragraph';

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={s.headerSide}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
          <Text style={s.title}>{isEditing ? 'Edit' : parentId ? 'Reply' : 'New Post'}</Text>
          <Pressable
            ref={postBtnRef}
            collapsable={false}
            onPress={handlePost}
            disabled={!canPost || submitting}
            style={[s.postBtn, (!canPost || submitting) && s.postBtnOff]}
          >
            <Text style={[s.postBtnText, (!canPost || submitting) && s.postBtnTextOff]}>
              {isEditing ? 'Save' : 'Post'}
            </Text>
          </Pressable>
        </View>

        {/* Formatting toolbar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.toolbar}
          contentContainerStyle={s.toolbarInner}
          keyboardShouldPersistTaps="always"
        >
          {/* Bold only */}
          <Btn lbl="B" active={focused?.bold} onPress={() => toggle('bold')} />
          <Sep />
          {/* Lists */}
          <Btn icon="list-outline" active={ft === 'bullet'} onPress={() => setType('bullet')} />
          <Btn icon="apps-outline" active={ft === 'numbered'} onPress={() => setType('numbered')} />
          <Sep />
          {/* Media */}
          <Btn icon="image-outline" active={false} onPress={() => pickMedia('images')} />
          <Btn icon="videocam-outline" active={false} onPress={() => pickMedia('videos')} />
          <Btn icon="camera-outline" active={false} onPress={launchCamera} />
          <Btn icon={isRecording ? "stop-circle" : "mic-outline"} active={isRecording} onPress={toggleRecording} />
          <Btn icon="folder-outline" active={false} onPress={pickFiles} />
          <Sep />
          <Btn icon="pricetag-outline" active={showTags} onPress={() => setShowTags(v => !v)} />
        </ScrollView>

        {/* Recording Flag */}
        {isRecording && (
          <View style={s.recFlag}>
            <Animated.View style={[s.recDot, { opacity: pulseAnim }]} />
            <Text style={s.recText}>Recording Voice Note</Text>
            <Text style={s.recTimer}>{formatTime(recordTime)}</Text>
          </View>
        )}

        {/* Canvas */}
        <ScrollView
          ref={canvas}
          style={s.canvas}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          {/* Author */}
          <View style={s.author}>
            <UserAvatar style={s.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={s.authorName}>You</Text>
              <Text style={s.authorSub}>Private · Only you can see this</Text>
            </View>
            {blocks.some(b => b.text) && (
              <Text style={s.wc}>
                {blocks.reduce((a, b) => a + b.text.trim().split(/\s+/).filter(Boolean).length, 0)} words
              </Text>
            )}
          </View>

          {/* Blocks */}
          <View style={s.blocksWrap}>
            {renderBlocks()}
            {/* Invisible tap area to focus last block */}
            <Pressable
              style={{ height: 80 }}
              onPress={() => {
                const last = blocks[blocks.length - 1];
                if (last) {
                  if (last.text.trim()) insertAfter(last.id);
                  else {
                    setFocused(last.id);
                    refs.current[last.id]?.focus();
                  }
                }
              }}
            />
          </View>

          {/* Tags */}
          {showTags && (
            <View style={s.tagsBar}>
              <Ionicons name="pricetag-outline" size={14} color={colors.secondary} />
              <View style={s.tagRow}>
                {tags.map(t => (
                  <Pressable key={t} style={s.tagChip} onPress={() => setTags(p => p.filter(x => x !== t))}>
                    <Text style={s.tagChipTxt}>#{t}</Text>
                    <Ionicons name="close" size={10} color={colors.secondary} />
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={s.tagInput}
                placeholder="add tag"
                placeholderTextColor={colors.secondary}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={() => {
                  const c = tagInput.replace(/^#+/, '').trim().toLowerCase();
                  if (c && !tags.includes(c)) setTags(p => [...p, c]);
                  setTagInput('');
                }}
                returnKeyType="done"
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Media previews */}
          {mediaItems.length > 0 && (
            <View style={s.media}>
              {mediaItems.map((m, i) => (
                <View key={i} style={m.type === 'audio' ? [s.mediaItem, { width: '100%', marginBottom: 18 }] : s.mediaItem}>
                  {m.type === 'video'
                    ? <View style={s.videoThumb}><Ionicons name="videocam" size={22} color={colors.primary} /></View>
                    : m.type === 'audio'
                      ? <AudioPlayer uri={m.uri} isPreview />
                      : <Image source={{ uri: m.uri }} style={s.mediaThumb} />
                  }
                  <Pressable
                    style={s.removeBtn}
                    onPress={() => setMedia(p => p.filter((_, j) => j !== i))}
                  >
                    <View style={s.removeDot}><Ionicons name="close" size={11} color={colors.background} /></View>
                  </Pressable>
                </View>
              ))}
              <Pressable style={[s.addMediaBtn, mediaItems.some(item => item.type === 'audio') && { width: '100%', height: 48, marginTop: 4 }]} onPress={() => pickMedia()}>
                <Ionicons name="add" size={24} color={colors.secondary} />
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.75, borderBottomColor: colors.border,
  },
  headerSide: { minWidth: 60 },
  cancel: { fontSize: 16, color: colors.secondary },
  title: { fontSize: 16, fontWeight: '700', color: colors.primary, letterSpacing: -0.2 },
  postBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 7,
    borderRadius: 999, minWidth: 60, alignItems: 'center',
  },
  postBtnOff: { backgroundColor: colors.border },
  postBtnText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  postBtnTextOff: { color: colors.secondary },

  // Toolbar
  toolbar: { backgroundColor: colors.surface, borderBottomWidth: 0.75, borderBottomColor: colors.border, maxHeight: 48 },
  toolbarInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, gap: 5 },
  tbBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, backgroundColor: colors.surface, minWidth: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  tbActive: { backgroundColor: colors.primary },
  tbLbl: { fontSize: 14, fontWeight: '700', color: colors.secondary },
  tbLblActive: { color: colors.background },
  tbSep: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 2 },

  // Canvas
  canvas: { flex: 1 },
  author: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.75, borderBottomColor: colors.border,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border },
  authorName: { fontSize: 15, fontWeight: '700', color: colors.primary },
  authorSub: { fontSize: 12, color: colors.secondary, marginTop: 1 },
  wc: { fontSize: 12, color: colors.secondary },

  // Blocks
  blocksWrap: { backgroundColor: colors.surface, paddingHorizontal: 18, paddingTop: 16 },

  // WYSIWYG
  h1: { fontSize: 26, fontWeight: '800', color: colors.primary, letterSpacing: -0.7, lineHeight: 34, marginBottom: 2, padding: 0 },
  h2: { fontSize: 21, fontWeight: '700', color: colors.primary, letterSpacing: -0.4, lineHeight: 28, marginBottom: 2, padding: 0 },
  h3: { fontSize: 17, fontWeight: '700', color: colors.primary, letterSpacing: -0.2, lineHeight: 24, marginBottom: 2, padding: 0 },
  body: { fontSize: 16, color: colors.primary, lineHeight: 26, letterSpacing: -0.1, marginBottom: 2, padding: 0 },
  firstBlock: { minHeight: 30 },
  bold: { fontWeight: '700', color: colors.primary },
  italic: { fontStyle: 'italic' },

  // Lists
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
  listMarkerBullet: { fontSize: 18, color: colors.primary, lineHeight: 26, width: 16, textAlign: 'center', marginTop: 2 },
  listMarkerNum: { fontSize: 15, color: colors.primary, lineHeight: 26, minWidth: 22, fontWeight: '600', marginTop: 1 },
  listInput: { flex: 1, padding: 0 },

  // Tags
  tagsBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, backgroundColor: colors.surface, borderTopWidth: 0.75, borderTopColor: colors.border, gap: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  tagChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, gap: 4, borderWidth: 1, borderColor: colors.border },
  tagChipTxt: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  tagInput: { fontSize: 14, color: colors.primary, paddingVertical: 2, minWidth: 70 },

  // Media
  media: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: colors.surface, borderTopWidth: 0.75, borderTopColor: colors.border },
  mediaItem: { position: 'relative' },
  mediaThumb: { width: 88, height: 88, borderRadius: 10, backgroundColor: colors.border },
  videoThumb: { width: 88, height: 88, borderRadius: 10, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  removeBtn: { position: 'absolute', top: -7, right: -7 },
  removeDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  addMediaBtn: { width: 88, height: 88, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },

  // Recording
  recFlag: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.75, borderBottomColor: colors.border, gap: 10 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  recText: { fontSize: 14, fontWeight: '600', color: colors.primary, flex: 1 },
  recTimer: { fontSize: 14, fontWeight: '700', color: '#EF4444', fontVariant: ['tabular-nums'] },
});
