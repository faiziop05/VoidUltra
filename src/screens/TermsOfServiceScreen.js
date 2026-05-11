import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Header from '../components/Header';

export default function TermsOfServiceScreen() {
  return (
    <View style={s.root}>
      <Header title="Terms of Service" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.container}>
        <View style={s.card}>
          <Text style={s.title}>Terms of Use</Text>
          <Text style={s.body}>
            By utilizing the Void Ultra application, you agree to the following operational policies.
          </Text>

          <Text style={s.subtitle}>1. Usage Responsibility</Text>
          <Text style={s.body}>
            Void Ultra is designed strictly for personal use. You are solely responsible for the safety of your device and the content stored within it.
          </Text>

          <Text style={s.subtitle}>2. Data Liability</Text>
          <Text style={s.body}>
            Because Void Ultra stores data exclusively offline on your local device storage, we assume zero responsibility for any lost data resulting from hardware failure, accidental app deletion, or improper export procedures.
          </Text>

          <Text style={s.subtitle}>3. Prohibited Uses</Text>
          <Text style={s.body}>
            While the app has no tracking mechanisms, you agree to comply with all local laws and safety guidelines pertaining to digital expression.
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
