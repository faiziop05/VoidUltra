import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Audio } from 'expo-av';

export default function AudioPlayer({ uri, isPreview = false }) {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let s = null;

    const loadAudio = async () => {
      try {
        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri },
          { progressUpdateIntervalMillis: 100 },
          (status) => {
            if (!isMounted) return;
            if (status.isLoaded) {
              setPosition(status.positionMillis);
              setDuration(status.durationMillis || 0);
              setIsPlaying(status.isPlaying);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
              }
            }
          }
        );
        s = newSound;
        if (isMounted) {
          setSound(newSound);
          if (status.isLoaded) {
            setDuration(status.durationMillis || 0);
          }
        }
      } catch (err) {
        console.error("Error loading sound", err);
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      if (s) {
        s.unloadAsync();
      }
    };
  }, [uri]);

  const togglePlayback = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      // If we're at the end, replay
      if (position >= duration && duration > 0) {
        await sound.replayAsync();
      } else {
        await sound.playAsync();
      }
    }
  };

  const formatTime = (millis) => {
    if (!millis) return "0:00";
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View style={s.container}>
      <Pressable onPress={togglePlayback} style={s.playBtn}>
        <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#fff" />
      </Pressable>
      
      <View style={s.timelineContainer}>
        <Text style={s.timeText}>{formatTime(position)}</Text>
        <View style={s.progressBarWrap}>
          <View style={s.progressBarTrack} />
          <View style={[s.progressBarFill, { width: `${progress}%` }]} />
        </View>
        <Text style={s.timeText}>{formatTime(duration)}</Text>
      </View>
      
      {isPreview && <Text style={s.previewBadge}>Voice Note</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 30,
    padding: 8,
    gap: 12,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  timelineContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    width: 32,
    textAlign: 'center',
  },
  progressBarWrap: {
    flex: 1,
    height: 4,
    justifyContent: 'center',
    position: 'relative',
  },
  progressBarTrack: {
    position: 'absolute',
    left: 0, right: 0,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    backgroundColor: '#111',
    borderRadius: 2,
  },
  previewBadge: {
    position: 'absolute',
    top: -10,
    left: 20,
    backgroundColor: '#111',
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  }
});
