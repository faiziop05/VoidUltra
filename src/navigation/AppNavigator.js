import React, { useState, useEffect } from 'react';
import {
  NavigationContainer, DefaultTheme, DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, Dimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SplashScreen from 'expo-splash-screen';

// Screens
import OnboardingScreen from '../screens/OnboardingScreen';
import TimelineScreen from '../screens/TimelineScreen';
import SearchScreen from '../screens/SearchScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ReflectionsScreen from '../screens/ReflectionsScreen';
import ComposeModal from '../screens/ComposeModal';
import ThreadScreen from '../screens/ThreadScreen';
import DayFeedScreen from '../screens/DayFeedScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import { initDB } from '../utils/database';
import { useTheme } from '../theme/useTheme';
import { useDispatch } from 'react-redux';
import { loadThemeMode } from '../redux/themeSlice';
import CustomAlert from '../components/CustomAlert';
import { DemoProvider } from '../context/DemoContext';
import GuidedDemo from '../components/GuidedDemo';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const { width: SW } = Dimensions.get('window');

// ─── Bottom tab navigator ──────────────────────────────────────────────────────

function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: colors.background }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.75,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            TimelineTab: 'home',
            ReflectionsTab: 'image',
            ActivityTab: 'calendar',
            ProfileTab: 'user',
          };
          // Feather icons generally look better slightly smaller, or default size
          return <Feather name={icons[route.name]} size={22} color={color} style={{ opacity: focused ? 1 : 0.8 }} />;
        },
      })}
    >
      <Tab.Screen name="TimelineTab" component={TimelineScreen} options={{ tabBarLabel: 'Threads' }} />
      <Tab.Screen name="ReflectionsTab" component={ReflectionsScreen} options={{ tabBarLabel: 'Reflect' }} />
      <Tab.Screen name="ActivityTab" component={CalendarScreen} options={{ tabBarLabel: 'Activity' }} />
      <Tab.Screen name="ProfileTab" component={SettingsScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ─── Custom Splash / Lock screen ──────────────────────────────────────────────

function SplashView({ isLoading, isLocked, lockEnabled, bioType, onUnlock }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  const bioIcon = bioType === 'face' ? 'scan-outline'
    : bioType === 'fingerprint' ? 'finger-print-outline'
      : 'key-outline';

  const bioLabel = bioType === 'face' ? 'Face ID'
    : bioType === 'fingerprint' ? 'Fingerprint'
      : 'Passcode';

  return (
    <View style={sp.root}>
      {/* Background gradient illusion */}
      <View style={sp.bgTop} />
      <View style={sp.bgBottom} />

      <Animated.View style={[sp.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Logo mark */}
        <View style={sp.logoWrap}>
          <View style={sp.logoDot} />
          <Text style={sp.logoText}>VOID</Text>
          <Text style={sp.logoUltra}>ULTRA</Text>
        </View>

        <Text style={sp.tagline}>Your private timeline.{'\n'}No one else's.</Text>

        {/* Divider */}
        <View style={sp.divider} />

        {isLoading ? (
          <View style={sp.row}>
            <Feather name="more-horizontal" size={20} color="#AAAAAA" />
          </View>
        ) : isLocked ? (
          <>
            <Text style={sp.lockMsg}>App is locked</Text>
            <Pressable style={sp.unlockBtn} onPress={onUnlock}>
              <Feather name={bioType === 'face' ? 'smile' : 'shield'} size={22} color="#FFF" />
              <Text style={sp.unlockText}>Unlock with {bioLabel}</Text>
            </Pressable>
          </>
        ) : null}
      </Animated.View>

      <Text style={sp.footer}>Private · Local only · No cloud</Text>
    </View>
  );
}

const sp = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0E0E0E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '55%',
    backgroundColor: '#141414',
  },
  bgBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '45%',
    backgroundColor: '#0A0A0A',
  },
  card: {
    width: SW * 0.8,
    backgroundColor: '#1A1A1A',
    borderRadius: 28,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
  },
  logoUltra: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
    letterSpacing: 5,
    marginTop: -2,
  },
  tagline: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 21,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: '#2E2E2E',
    marginVertical: 24,
  },
  row: { alignItems: 'center' },
  lockMsg: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2A2A2A',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  unlockText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    fontSize: 11,
    color: '#333',
    letterSpacing: 0.3,
  },
});

// ─── AppNavigator ─────────────────────────────────────────────────────────────

export default function AppNavigator() {
  const [phase, setPhase] = useState('splash'); // 'splash' | 'locked' | 'ready'
  const [initialRoute, setRoute] = useState('Onboarding');
  const [bioType, setBioType] = useState(null);     // 'face' | 'fingerprint' | null
  const dispatch = useDispatch();
  const { colors, activeMode } = useTheme();

  // Detect biometric hardware type
  const detectBioType = async () => {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    return hasFace ? 'face' : hasFingerprint ? 'fingerprint' : null;
  };

  // Authenticate using the device
  const authenticate = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Void Ultra',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      fallbackLabel: 'Use passcode',
    });
    return result.success;
  };

  // Boot sequence
  useEffect(() => {
    const boot = async () => {
      try {
        // Keep native splash up until we're ready
        await SplashScreen.preventAutoHideAsync().catch(() => { });
        await initDB();

        const hasOnboarded = await AsyncStorage.getItem('hasOnboarded');
        const savedTheme = await AsyncStorage.getItem('themeMode');
        if (savedTheme) {
          dispatch(loadThemeMode(savedTheme));
        }
        
        if (hasOnboarded !== 'true') {
          setRoute('Onboarding');
          setPhase('ready');
          return;
        }

        setRoute('MainApp');

        // *** BUG FIX: only lock if explicitly set to 'true' ***
        // If the key is null (never configured), default to UNLOCKED
        const lockSetting = await AsyncStorage.getItem('lockEnabled');
        const isLockEnabled = lockSetting === 'true';  // null → false, 'false' → false

        if (!isLockEnabled) {
          setPhase('ready');
          return;
        }

        // Lock is on — check hardware availability before prompting
        const hasHW = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHW || !isEnrolled) {
          // Hardware missing — bypass lock gracefully
          setPhase('ready');
          return;
        }

        const bt = await detectBioType();
        setBioType(bt);
        setPhase('locked');

        // Auto-prompt on launch
        const ok = await authenticate();
        if (ok) setPhase('ready');
        // else stay on locked screen (user can retry)
      } catch (e) {
        console.error('Boot error', e);
        setPhase('ready');
      } finally {
        SplashScreen.hideAsync().catch(() => { });
      }
    };

    boot();
  }, []);

  // Retry unlock (button press on lock screen)
  const handleUnlock = async () => {
    const ok = await authenticate();
    if (ok) setPhase('ready');
  };

  // Show custom splash while loading, or lock screen if locked
  if (phase === 'splash' || phase === 'locked') {
    return (
      <SplashView
        isLoading={phase === 'splash'}
        isLocked={phase === 'locked'}
        lockEnabled={true}
        bioType={bioType}
        onUnlock={handleUnlock}
      />
    );
  }

  return (
    <DemoProvider>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <NavigationContainer
            theme={activeMode === 'dark' ? {
              ...DarkTheme,
              colors: { 
                ...DarkTheme.colors, 
                background: colors.background,
                card: colors.surface,
                text: colors.primary,
                border: colors.border 
              },
            } : {
              ...DefaultTheme,
              colors: { 
                ...DefaultTheme.colors, 
                background: colors.background,
                card: colors.surface,
                text: colors.primary,
                border: colors.border 
              },
            }}
          >
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{ 
              headerShown: false,
              contentStyle: { backgroundColor: colors.background }
            }}
          >
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="MainApp" component={MainTabNavigator} />
            <Stack.Screen name="ComposeScreen" component={ComposeModal} options={{ presentation: 'card' }} />
            <Stack.Screen name="ThreadScreen" component={ThreadScreen} />
            <Stack.Screen name="SearchScreen" component={SearchScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="DayFeedScreen" component={DayFeedScreen} />
            <Stack.Screen name="FavoritesScreen" component={FavoritesScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
          </Stack.Navigator>
          <GuidedDemo />
          </NavigationContainer>
          <CustomAlert />
        </View>
      </SafeAreaProvider>
    </DemoProvider>
  );
}
