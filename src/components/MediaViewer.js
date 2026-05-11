import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Modal, View, StyleSheet, FlatList, Pressable, Text,
  Dimensions, StatusBar, Image,
} from 'react-native';
import ImageZoom from 'react-native-image-pan-zoom';
import { VideoView, useVideoPlayer } from 'expo-video';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AudioPlayer from './AudioPlayer';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const VideoSlide = ({ uri, isActive, style }) => {
  const player = useVideoPlayer(uri, p => {
    p.loop = false;
  });

  useEffect(() => {
    if (isActive) player.play();
    else player.pause();
  }, [isActive, player]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="contain"
      nativeControls
    />
  );
};

const ZoomableImage = ({ uri, style, onZoomChange, isActive, isImmersion }) => {
  const [isZoomEnabled, setIsZoomEnabled] = useState(false);
  const [viewerHeight, setViewerHeight] = useState(SCREEN_H);

  useEffect(() => {
    if (!isActive && isZoomEnabled) {
      setIsZoomEnabled(false);
      if (onZoomChange) onZoomChange(false);
    }
  }, [isActive, isZoomEnabled, onZoomChange]);

  const toggleZoom = () => {
    const nextState = !isZoomEnabled;
    setIsZoomEnabled(nextState);
    if (onZoomChange) onZoomChange(nextState);
  };

  const imageContent = (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="contain"
    />
  );

  return (
    <View
      style={{ width: SCREEN_W, height: '100%' }}
      onLayout={(e) => setViewerHeight(e.nativeEvent.layout.height)}
    >
      {isZoomEnabled ? (
        <View style={{ flex: 1 }}>
          <ImageZoom
            cropWidth={SCREEN_W}
            cropHeight={viewerHeight}
            imageWidth={SCREEN_W}
            imageHeight={viewerHeight}
            minScale={1}
            maxScale={5}
            doubleClickInterval={250}
          >
            {imageContent}
          </ImageZoom>
          <Pressable style={styles.exitZoomBtn} onPress={toggleZoom}>
            <Ionicons name="close-sharp" size={26} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {imageContent}
          </View>
          <Pressable style={styles.zoomBanner} onPress={toggleZoom}>
            <Ionicons name="expand-outline" size={18} color="#fff" />
            <Text style={styles.zoomText}>Press to zoom in image</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};
export default function MediaViewer({ visible, mediaItems = [], initialIndex = 0, onClose, hideCounter = false }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [isZoomModeActive, setIsZoomModeActive] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (visible && mediaItems.length > 0) {
      setCurrentIndex(initialIndex);
      setScrollEnabled(true);
      setIsZoomModeActive(false);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, [visible, initialIndex, mediaItems.length]);

  const onScroll = useCallback((e) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_W);
    if (idx !== currentIndex && idx >= 0 && idx < mediaItems.length) {
      setCurrentIndex(idx);
    }
  }, [currentIndex, mediaItems.length]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      transparent={false}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

          {!isZoomModeActive && (
            <View style={styles.header}>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                <Ionicons name="arrow-back" size={28} color="#fff" />
              </Pressable>
              {!hideCounter && (
                <Text style={styles.counter}>
                  {currentIndex + 1} / {mediaItems.length}
                </Text>
              )}
              {hideCounter && <View style={{ flex: 1 }} />}
              <View style={{ width: 44 }} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={mediaItems}
              horizontal
              pagingEnabled
              scrollEnabled={scrollEnabled}
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              keyExtractor={(item, index) => index.toString()}
              getItemLayout={(data, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
              renderItem={({ item, index }) => {
                if (item.media_type === 'video') {
                  return (
                    <View style={styles.slide}>
                      <VideoSlide uri={item.file_uri} isActive={currentIndex === index} style={styles.fullMedia} />
                    </View>
                  );
                }
                if (item.media_type === 'audio') {
                  return (
                    <View style={[styles.slide, styles.audioWrapper]}>
                      <View style={styles.audioContent}>
                        <AudioPlayer uri={item.file_uri} />
                      </View>
                    </View>
                  );
                }
                return (
                  <ZoomableImage
                    uri={item.file_uri}
                    style={styles.fullMedia}
                    isActive={currentIndex === index}
                    isImmersion={isZoomModeActive}
                    onZoomChange={(isZoomed) => {
                      setScrollEnabled(!isZoomed);
                      setIsZoomModeActive(isZoomed);
                    }}
                  />
                );
              }}
            />
          </View>

          {!hideCounter && mediaItems.length > 1 && !isZoomModeActive && (
            <View style={styles.dots}>
              {mediaItems.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === currentIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  counter: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  slide: {
    width: SCREEN_W,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullMedia: {
    width: SCREEN_W,
    height: '100%',
  },
  audioWrapper: {
    paddingHorizontal: 30,
  },
  audioContent: {
    width: '100%',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 18,
  },
  zoomBanner: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  zoomText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.8,
    opacity: 0.9,
  },
  exitZoomBtn: {
    position: 'absolute',
    top: 16,
    left: 12,
    zIndex: 30,
    backgroundColor: 'rgba(17, 13, 13, 0.57)',
    borderRadius: 12,
    padding: 4,
  },
});