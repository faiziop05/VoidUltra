import React, { useState, useEffect } from 'react';

import { View, Text, StyleSheet, Pressable, TextInput, Switch, Image, ScrollView, Modal, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { File, Paths, Directory } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nukeDatabase, getPosts } from '../utils/database';
import { updateCachedAvatar } from '../components/UserAvatar';
import Header from '../components/Header';
import { useDispatch } from 'react-redux';
import { setThemeMode } from '../redux/themeSlice';
import { useTheme } from '../theme/useTheme';
import { CustomAlertManager } from '../components/CustomAlert';
import { triggerStoreReview } from '../utils/StoreReviewHelper';
import { exportBackup, importBackup } from '../utils/BackupService';
import { useDemo } from '../context/DemoContext';

// ─── Auth method detect ────────────────────────────────────────────────────────
const getAvailableAuth = async () => {
  const hasHW = await LocalAuthentication.hasHardwareAsync();
  const isEnrl = await LocalAuthentication.isEnrolledAsync();
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  return { hasHW, isEnrolled: isEnrl, hasFace, hasFingerprint };
};

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState(null); // 'face' | 'fingerprint' | null
  const [authWorking, setAuthWorking] = useState(false);
  const [backupWorking, setBackupWorking] = useState(false);
  const { setDemoStep, setIsDemoActive } = useDemo();
  const dispatch = useDispatch();
  const { mode, colors } = useTheme();
  const s = getStyles(colors);

  useEffect(() => {
    const load = async () => {
      const name = await AsyncStorage.getItem('username');
      if (name) setUsername(name);

      const pImg = await AsyncStorage.getItem('profileImage');
      if (pImg) setProfileImage(pImg);

      const lock = await AsyncStorage.getItem('lockEnabled');
      setLockEnabled(lock === 'true');

      const { hasFace, hasFingerprint, isEnrolled, hasHW } = await getAvailableAuth();
      if (hasHW && isEnrolled) {
        setBiometricType(hasFace ? 'face' : hasFingerprint ? 'fingerprint' : 'biometric');
      }
    };
    load();
  }, []);

  // ── Save username ─────────────────────────────────────────────────────────

  const handleNameChange = async (text) => {
    setUsername(text);
    await AsyncStorage.setItem('username', text);
  };

  const handleRemoveImage = async () => {
    if (!profileImage) return;
    try {
      await new File(profileImage).delete();
      setProfileImage(null);
      await AsyncStorage.removeItem('profileImage');
      updateCachedAvatar(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      CustomAlertManager.alert('Error', 'Could not remove profile photo.');
    }
  };

  const handleAvatarPress = () => {
    const options = [
      { text: 'Pick from Gallery', onPress: handlePickImage },
    ];

    if (profileImage) {
      options.push({ text: 'Remove Photo', onPress: handleRemoveImage, style: 'destructive' });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    CustomAlertManager.alert('Profile Photo', 'What would you like to do?', options);
  };

  const handlePickImage = async () => {
    try {
      // 1. Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        CustomAlertManager.alert('Permission Denied', 'Please allow access to your media library.');
        return;
      }

      // 2. Launch picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        const sourceUri = result.assets[0].uri;
        const fileName = `profile_${Date.now()}.jpg`;
        const profileFile = new File(Paths.document, fileName);

        // Clean up old
        if (profileImage) {
          try { await new File(profileImage).delete(); } catch (_) { }
        }

        await new File(sourceUri).copy(profileFile);
        setProfileImage(profileFile.uri);
        await AsyncStorage.setItem('profileImage', profileFile.uri);
        updateCachedAvatar(profileFile.uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Picker Error:', error);
      CustomAlertManager.alert('Picker Error', error.message || 'Could not open image library');
    }
  };

  // ── Toggle lock ───────────────────────────────────────────────────────────
  // When enabling: verify the user is legitimate FIRST (device auth),
  // then store the preference. Exactly like most apps do.

  const handleLockToggle = async (wantEnabled) => {
    if (wantEnabled) {
      // ── ENABLING: verify device credentials first ──
      if (!biometricType) {
        CustomAlertManager.alert(
          'No biometric enrolled',
          'Please set up Face ID, fingerprint, or a device PIN in your system settings first, then come back to enable App Lock.',
        );
        return;
      }

      setAuthWorking(true);
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify it\'s you to enable App Lock',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
          fallbackLabel: 'Use passcode',
        });

        if (result.success) {
          await AsyncStorage.setItem('lockEnabled', 'true');
          setLockEnabled(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          CustomAlertManager.alert(
            'App Lock enabled',
            `Void Ultra will now require ${biometricType === 'face' ? 'Face ID' : biometricType === 'fingerprint' ? 'fingerprint' : 'biometrics'} or your passcode to open.`,
          );
        } else {
          // User cancelled or failed
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch (e) {
        CustomAlertManager.alert('Error', 'Could not verify identity. Please try again.');
      } finally {
        setAuthWorking(false);
      }
    } else {
      // ── DISABLING: also verify before turning off ──
      setAuthWorking(true);
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify to disable App Lock',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });
        if (result.success) {
          await AsyncStorage.setItem('lockEnabled', 'false');
          setLockEnabled(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (e) {
        CustomAlertManager.alert('Error', 'Could not verify identity.');
      } finally {
        setAuthWorking(false);
      }
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setBackupWorking(true);
    try {
      await exportBackup();
    } finally {
      setBackupWorking(false);
    }
  };

  const handleImport = () => {
    CustomAlertManager.alert(
      'Import Backup',
      'This will replace your current data with the contents of the backup file. For best results, restart the app after importing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: async () => {
            setBackupWorking(true);
            try {
              const success = await importBackup();
              if (success) {
                CustomAlertManager.alert('Restart Required', 'Data has been restored. Please close and reopen the app to see all changes.');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } finally {
              setBackupWorking(false);
            }
          }
        }
      ]
    );
  };

  const handleStartTour = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDemoStep(0);
    setIsDemoActive(false);
    navigation.navigate('TimelineTab');
  };

  // ── Nuke ──────────────────────────────────────────────────────────────────

  const handleNuke = () => {
    CustomAlertManager.alert(
      'Nuke Timeline',
      'This permanently deletes every post, media file, and tag from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const ok = await nukeDatabase();
            CustomAlertManager.alert('Nuke Result', ok ? 'The void has been emptied.' : 'Failed to empty the void.');
          },
        },
      ],
    );
  };

  // ── Biometric icon ────────────────────────────────────────────────────────

  const bioIcon = biometricType === 'face' ? 'scan-outline'
    : biometricType === 'fingerprint' ? 'finger-print-outline'
      : 'lock-closed-outline';

  const bioLabel = biometricType === 'face' ? 'Face ID'
    : biometricType === 'fingerprint' ? 'Fingerprint'
      : 'Biometrics';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <Header title="Profile & Security" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Profile */}
        <View style={s.profileCard}>
          <Pressable
            style={({ pressed }) => [
              s.avatarContainer,
              { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }
            ]}
            onPress={handleAvatarPress}
            hitSlop={10}
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={s.avatarLg} />
            ) : (
              <Image source={require('../../assets/icon4.png')} style={s.avatarLg} />
            )}
            <View style={s.editBadge}>
              <Ionicons name="camera" size={12} color={colors.background} />
            </View>
          </Pressable>
          <TextInput
            style={s.nameInput}
            value={username}
            onChangeText={handleNameChange}
            placeholder="Your name"
            placeholderTextColor="#BBBBBB"
          />
          <Text style={s.nameSub}>Tap to edit display name</Text>
        </View>

        {/* Security section */}
        <Text style={s.sectionLabel}>SECURITY</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowIconWrap}>
              <Ionicons name={bioIcon} size={20} color={colors.background} />
            </View>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>App Lock</Text>
              <Text style={s.rowSub}>
                {lockEnabled
                  ? `Locked with ${bioLabel} · ${biometricType ? 'or device passcode' : ''}`
                  : biometricType
                    ? `Use ${bioLabel} or passcode to protect the app`
                    : 'No biometrics enrolled — set up in device settings'}
              </Text>
            </View>
            {authWorking
              ? <ActivityIndicator size="small" color="#AAA" />
              : (
                <Switch
                  value={lockEnabled}
                  onValueChange={handleLockToggle}
                  trackColor={{ false: '#E8E8E8', true: '#111' }}
                  thumbColor="#FFF"
                  ios_backgroundColor="#E8E8E8"
                />
              )
            }
          </View>

          {lockEnabled && biometricType && (
            <View style={s.lockBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#22C55E" />
              <Text style={s.lockBadgeText}>Protected</Text>
            </View>
          )}
        </View>

        {/* {!biometricType && (
          <Text style={s.hint}>
            Set up Face ID, fingerprint, or a PIN in your device settings to enable App Lock.
          </Text>
        )} */}

        <Text style={s.sectionLabel}>APPEARANCE</Text>
        <View style={s.card}>
          <Pressable 
            style={[s.rowPressable, mode === 'system' && { backgroundColor: colors.surface }]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              dispatch(setThemeMode('system'));
            }}
          >
            <View style={s.rowIconWrap}>
              <Ionicons name="phone-portrait-outline" size={20} color={colors.background} />
            </View>
            <Text style={[s.rowTitle, { color: colors.primary }]}>System Default</Text>
            {mode === 'system' && <Ionicons name="checkmark" size={18} color={colors.tint} />}
          </Pressable>
          
          <View style={s.rowDivider} />
          
          <Pressable 
            style={[s.rowPressable, mode === 'light' && { backgroundColor: colors.surface }]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              dispatch(setThemeMode('light'));
            }}
          >
            <View style={s.rowIconWrap}>
              <Ionicons name="sunny-outline" size={20} color={colors.background} />
            </View>
            <Text style={[s.rowTitle, { color: colors.primary }]}>Light Mode</Text>
            {mode === 'light' && <Ionicons name="checkmark" size={18} color={colors.tint} />}
          </Pressable>
          
          <View style={s.rowDivider} />
          
          <Pressable 
            style={[s.rowPressable, mode === 'dark' && { backgroundColor: colors.surface }]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              dispatch(setThemeMode('dark'));
            }}
          >
            <View style={s.rowIconWrap}>
              <Ionicons name="moon-outline" size={20} color={colors.background} />
            </View>
            <Text style={[s.rowTitle, { color: colors.primary }]}>Complete Dark</Text>
            {mode === 'dark' && <Ionicons name="checkmark" size={18} color={colors.tint} />}
          </Pressable>
        </View>

        <Text style={s.sectionLabel}>CONTENT</Text>
        <View style={s.card}>
          <Pressable
            style={s.rowPressable}
            onPress={() => navigation.navigate('FavoritesScreen')}
          >
            <View style={s.rowIconWrap}>
              <Ionicons name="heart-outline" size={20} color={colors.background} />
            </View>
            <Text style={s.rowTitle}>My Favorites</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
          </Pressable>
          <View style={s.rowDivider} />
          <Pressable
            style={s.rowPressable}
            onPress={handleStartTour}
          >
            <View style={s.rowIconWrap}>
              <Ionicons name="map-outline" size={20} color={colors.background} />
            </View>
            <Text style={s.rowTitle}>Guided Tour</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
          </Pressable>
        </View>

        {/* Data management */}
        <Text style={s.sectionLabel}>DATA MANAGEMENT</Text>
        <View style={s.card}>
          <Pressable style={s.rowPressable} onPress={handleExport}>
            <View style={s.rowIconWrap}>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.background} />
            </View>
            <Text style={s.rowTitle}>Export Full Backup (.zip)</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
          </Pressable>
          <View style={s.rowDivider} />
          <Pressable style={s.rowPressable} onPress={handleImport}>
            <View style={s.rowIconWrap}>
              <Ionicons name="cloud-download-outline" size={20} color={colors.background} />
            </View>
            <Text style={s.rowTitle}>Restore from Backup</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
          </Pressable>
        </View>

        <View style={[s.card, { marginTop: 10 }]}>
          <Pressable style={s.rowPressable} onPress={handleNuke}>
            <View style={[s.rowIconWrap, { backgroundColor: colors.border }]}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </View>
            <Text style={[s.rowTitle, { color: '#EF4444' }]}>Nuke timeline</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
          </Pressable>
        </View>

        <Text style={s.sectionLabel}>ABOUT & LEGAL</Text>
        <View style={s.card}>
          <Pressable
            style={s.rowPressable}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              triggerStoreReview(true);
            }}
          >
            <View style={s.rowIconWrap}>
              <Ionicons name="star-outline" size={20} color={colors.background} />
            </View>
            <Text style={s.rowTitle}>Rate Your App</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
          </Pressable>

          <View style={s.rowDivider} />

          <Pressable
            style={s.rowPressable}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <View style={s.rowIconWrap}>
              <Ionicons name="shield-outline" size={20} color={colors.background} />
            </View>
            <Text style={s.rowTitle}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
          </Pressable>

          <View style={s.rowDivider} />

          <Pressable
            style={s.rowPressable}
            onPress={() => navigation.navigate('TermsOfService')}
          >
            <View style={s.rowIconWrap}>
              <Ionicons name="document-text-outline" size={20} color={colors.background} />
            </View>
            <Text style={s.rowTitle}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
          </Pressable>
        </View>

        <Text style={s.version}>Void ULTRA v1.0 · Local only · No cloud</Text>
      </ScrollView>

      {/* ─── Processing Overlay ─── */}
      <Modal visible={backupWorking} transparent animationType="fade">
        <View style={s.loadingOverlay}>
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={s.loadingText}>Processing Data...</Text>
            <Text style={s.loadingSub}>This may take a moment</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.4,
  },

  // Profile
  profileCard: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 22,
    borderBottomWidth: 0.75,
    borderBottomColor: colors.border,
  },
  avatarLg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    marginBottom: 12,
    position: 'relative',
    zIndex: 10,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  nameInput: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
    paddingHorizontal: 24,
  },
  nameSub: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 4,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.secondary,
    paddingHorizontal: 20,
    marginBottom: 6,
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    overflow: 'hidden',
  },

  // Row (non-pressable)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  // Row (pressable)
  rowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: -0.1,
    flex: 1,
  },
  rowSub: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 2,
    lineHeight: 16,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 60,
  },

  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  lockBadgeText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
  },

  hint: {
    fontSize: 12,
    color: colors.secondary,
    paddingHorizontal: 20,
    marginBottom: 16,
    lineHeight: 17,
  },

  version: {
    fontSize: 11,
    color: colors.secondary,
    textAlign: 'center',
    marginTop: 28,
  },

  // Loading Overlay
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: colors.surface,
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    gap: 12,
  },
  loadingText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
  },
  loadingSub: {
    fontSize: 13,
    color: colors.secondary,
    textAlign: 'center',
  },
});
