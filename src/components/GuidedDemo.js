import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Dimensions, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDemo } from '../context/DemoContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { deletePost } from '../utils/database';

export default function GuidedDemo() {
  const navigation = useNavigation();
  const { 
    isDemoActive, demoStep, highlightCoords, nextStep, 
    resetDemo, startDemo, demoPostId, setDemoStep,
    onContinueAction 
  } = useDemo();
  const { width: SW, height: SH } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (isDemoActive || (demoStep === 0 && !isDemoActive)) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [isDemoActive, demoStep]);

  if (!isDemoActive && demoStep !== 0) return null;

  const renderSpotlight = () => {
    if (!highlightCoords) return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />;

    const { x, y, width, height } = highlightCoords;
    const padding = 6;
    const holeX = x - padding;
    const holeY = y - padding;
    const holeW = width + padding * 2;
    const holeH = height + padding * 2;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Top */}
        <View style={[s.overlay, { left: 0, top: 0, width: SW, height: holeY }]} />
        {/* Left */}
        <View style={[s.overlay, { left: 0, top: holeY, width: holeX, height: holeH }]} />
        {/* Right */}
        <View style={[s.overlay, { left: holeX + holeW, top: holeY, width: SW - (holeX + holeW), height: holeH }]} />
        {/* Bottom */}
        <View style={[s.overlay, { left: 0, top: holeY + holeH, width: SW, height: SH - (holeY + holeH) }]} />
        
        {/* The Hole (visual highlight ring) - must be touch-through */}
        <View 
          pointerEvents="none" 
          style={[s.hole, { left: holeX, top: holeY, width: holeW, height: holeH, borderRadius: Math.min(holeW, holeH) / 2 }]} 
        />
      </View>
    );
  };

  const getInstructions = () => {
    switch (demoStep) {
      case 0:
        return {
          title: "Quick Tour?",
          desc: "Want a 30-second tour of how Void Ultra works? We'll show you how to capture your first thought.",
          btn: "Take the Tour",
          skip: "Maybe later",
          nextLabel: "Take the Tour"
        };
      case 1:
        return {
          title: "Start a thought",
          desc: "Tap the compose button to open the editor. Your data is always encrypted locally.",
          nextLabel: "Next"
        };
      case 3:
        return {
          title: "Post to the void",
          desc: "Ready? Tap Post to save your thought. No cloud will ever see this.",
          nextLabel: "Continue"
        };
      case 4:
        return {
          title: "Keep it organized",
          desc: "Your posts appear here. Tap on one to expand it into a thread.",
          nextLabel: "Next"
        };
      case 5:
        return {
          title: "Threads are context",
          desc: "You can keep adding thoughts to a thread. Tap the back button whenever you're done.",
          nextLabel: "Finish"
        };
      case 6:
        return {
          title: "You're all set!",
          desc: "That's Void Ultra. Private, safe, and deeply simple. Your demo post will be removed now.",
          btn: "Begin Journaling",
          nextLabel: "Begin Journaling"
        };
      default:
        return null;
    }
  };

  const instr = getInstructions();

  // If intro modal
  if (demoStep === 0) {
    return (
      <View style={s.modalContainer}>
        <Animated.View style={[s.introModal, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={s.iconWrap}>
            <Ionicons name="sparkles" size={32} color="#111" />
          </View>
          <Text style={s.modalTitle}>{instr.title}</Text>
          <Text style={s.modalDesc}>{instr.desc}</Text>
          <Pressable 
            style={s.majorBtn} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              startDemo();
            }}
          >
            <Text style={s.majorBtnText}>{instr.btn}</Text>
          </Pressable>
          <Pressable onPress={() => { setDemoStep(-1); }}>
            <Text style={s.skipText}>{instr.skip}</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // If finish modal
  if (demoStep === 6) {
    return (
      <View style={s.modalContainer}>
        <Animated.View style={[s.introModal, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={s.iconWrap}>
            <Ionicons name="checkmark-circle" size={32} color="#22C55E" />
          </View>
          <Text style={s.modalTitle}>{instr.title}</Text>
          <Text style={s.modalDesc}>{instr.desc}</Text>
          <Pressable 
            style={s.majorBtn} 
            onPress={async () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (demoPostId) await deletePost(demoPostId);
              resetDemo();
            }}
          >
            <Text style={s.majorBtnText}>{instr.btn}</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // If no instructions for this step (like auto-typing), just show overlay
  if (!instr) return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{renderSpotlight()}</View>;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {renderSpotlight()}
      
      <Animated.View style={[s.tooltip, { opacity: fadeAnim, top: (highlightCoords?.y || SW/2) > SH / 2 ? 100 : SH - 250 }]}>
        <View style={s.tooltipContent}>
           <View style={{ flex: 1 }}>
             <Text style={s.tooltipTitle}>{instr.title}</Text>
             <Text style={s.tooltipDesc}>{instr.desc}</Text>
           </View>
           <Pressable 
             style={s.nextBtn} 
             onPress={() => {
               Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
               if (onContinueAction) {
                 onContinueAction();
               } else {
                 nextStep();
               }
             }}
           >
             <Text style={s.nextBtnText}>{instr.nextLabel || 'Next'}</Text>
           </Pressable>
        </View>
        <View style={s.pointerHand}>
           <Ionicons name="hand-left" size={40} color="#FFF" style={s.handIcon} />
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  modalContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  introModal: {
    width: '85%',
    backgroundColor: '#FFF',
    borderRadius: 32,
    padding: 30,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24, fontWeight: '800', color: '#111', 
    marginBottom: 10, textAlign: 'center', letterSpacing: -0.5
  },
  modalDesc: {
    fontSize: 16, color: '#666', textAlign: 'center', 
    lineHeight: 24, marginBottom: 30
  },
  majorBtn: {
    backgroundColor: '#111',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 15,
  },
  majorBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  skipText: { color: '#AAA', fontSize: 15, fontWeight: '600' },

  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  hole: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: 'transparent',
  },

  tooltip: {
    position: 'absolute',
    left: 20, right: 20,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 20,
    elevation: 10,
  },
  tooltipTitle: {
    fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 6
  },
  tooltipDesc: {
    fontSize: 14, color: '#666', lineHeight: 20
  },
  tooltipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextBtn: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  nextBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  pointerHand: {
    position: 'absolute',
    top: -60,
    right: 20,
  },
  handIcon: {
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  }
});
