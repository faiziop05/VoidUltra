import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import { theme } from '../theme/theme';

export default function PrivacyPolicyScreen() {
  return (
    <View style={s.root}>
      <Header title="Privacy Policy" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.container}>
        <View style={s.card}>
          <Text style={s.title}>Your Privacy First</Text>
          <Text style={s.body}>
            Void Ultra was designed from the ground up to guarantee absolute privacy. We believe that your private thoughts should remain exactly that: private.
          </Text>

          <Text style={s.subtitle}>1. 100% Offline & Local</Text>
          <Text style={s.body}>
            Every entry, thought, photo, video, and voice memo you record in Void Ultra stays strictly on your physical device. The app does not utilize any external cloud servers, databases, or API tracking.
          </Text>

          <Text style={s.subtitle}>2. No Data Collection</Text>
          <Text style={s.body}>
            We do not, and cannot, see what you write. No analytics, tracking tokens, or user profiles are collected by the developers. You remain completely anonymous.
          </Text>

          <Text style={s.subtitle}>3. Device Security</Text>
          <Text style={s.body}>
            You can lock your timeline using the on-device biometric security (Face ID or Fingerprint). Because your data is local, if you lose your phone or delete the app without a backup, your entries cannot be recovered.
          </Text>
        </View>

        <Text style={s.version}>Effective Date: April 2026</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  container: { padding: 16, paddingBottom: 60 },
  card: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    letterSpacing: -0.1,
    marginTop: 18,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
  },
  version: {
    fontSize: 12,
    color: '#ADADAD',
    textAlign: 'center',
  },
});
