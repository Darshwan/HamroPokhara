import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';

export default function ContinueAsScreen({ navigation }: any) {
  const { continueAsGuest } = useStore();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Branding */}
      <View style={styles.branding}>
        <View style={styles.logoBox}>
          <MaterialIcons name="location-city" size={26} color="#fff" />
        </View>
        <Text style={styles.logoText}>Hamro Pokhara</Text>
      </View>

      {/* Heading */}
      <View style={styles.heading}>
        <Text style={styles.title}>How would you{'\n'}like to proceed?</Text>
        <Text style={styles.subtitle}>
          Select an option to begin your digital journey with Pokhara Metropolitan City.
        </Text>
      </View>

      {/* Cards */}
      <View style={styles.cards}>

        {/* Citizen Card — Primary */}
        <TouchableOpacity
          style={styles.citizenCard}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryContainer]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>Verified Access</Text>
          </View>
          <View style={styles.citizenIcon}>
            <MaterialIcons name="person" size={36} color="#fff" />
          </View>
          <Text style={styles.citizenTitle}>Continue as{'\n'}a Citizen</Text>
          <Text style={styles.citizenDesc}>
            Access full municipal services, pay taxes, and track applications with your digital ID.
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>Sign in to your account</Text>
            <MaterialIcons name="arrow-forward" size={16} color="rgba(255,255,255,0.8)" />
          </View>
        </TouchableOpacity>

        {/* Guest Card */}
        <TouchableOpacity
          style={styles.guestCard}
          onPress={continueAsGuest}
          activeOpacity={0.88}
        >
          <View style={styles.guestIcon}>
            <MaterialIcons name="person-search" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.guestTitle}>Continue as Guest</Text>
          <Text style={styles.guestDesc}>
            Browse public notices, tourism guides, and explore city resources without an account.
          </Text>
          <View style={[styles.cardFooter, { marginTop: 'auto' }]}>
            <Text style={[styles.cardFooterText, { color: Colors.onSurfaceVariant }]}>
              Explore public data
            </Text>
            <MaterialIcons name="arrow-forward" size={16} color={Colors.onSurfaceVariant} />
          </View>
        </TouchableOpacity>

      </View>

      {/* Footer */}
      <Text style={styles.terms}>
        By continuing, you agree to Pokhara's{' '}
        <Text style={{ color: Colors.primary }}>Terms of Service</Text>
        {' '}and{' '}
        <Text style={{ color: Colors.primary }}>Privacy Policy</Text>.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.background, paddingHorizontal: 20, paddingTop: 16,
  },
  branding: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 },
  logoBox: {
    width: 44, height: 44, borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 20, fontWeight: '800', color: Colors.primary, letterSpacing: -0.3 },
  heading: { marginBottom: 28 },
  title: { fontSize: 34, fontWeight: '900', color: Colors.primary, letterSpacing: -0.8, lineHeight: 40 },
  subtitle: { fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 8, lineHeight: 22 },
  cards: { flex: 1, gap: 14 },
  citizenCard: {
    flex: 2, borderRadius: Radius.xxl, padding: 28, overflow: 'hidden',
    ...Shadow.lg,
  },
  verifiedBadge: {
    alignSelf: 'flex-start', position: 'absolute', top: 20, right: 20,
    backgroundColor: Colors.secondary, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: Radius.full,
  },
  verifiedText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  citizenIcon: {
    width: 60, height: 60, borderRadius: Radius.xl,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
  },
  citizenTitle: {
    fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 8,
  },
  citizenDesc: {
    fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 20,
  },
  cardFooterText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  guestCard: {
    flex: 1, borderRadius: Radius.xxl, padding: 24,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadow.sm,
  },
  guestIcon: {
    width: 48, height: 48, borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  guestTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary, marginBottom: 6 },
  guestDesc: { fontSize: 13, color: Colors.onSurfaceVariant, lineHeight: 18 },
  terms: {
    fontSize: 12, color: Colors.onSurfaceVariant,
    textAlign: 'center', paddingVertical: 20, lineHeight: 18,
  },
});