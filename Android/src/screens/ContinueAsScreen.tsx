import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar,
  Platform, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius } from '../constants/theme';
import { authAPI } from '../api/client';
import { useStore } from '../store/useStore';
import AppHeader from '../components/AppHeader';

const { height } = Dimensions.get('window');

// ID type pills shown on the citizen card
const ID_TYPES = ['NID', 'Nagarikta', 'License'];

// Permit pills shown on the tourist card  
const PERMITS = ['TIMS', 'Annapurna', 'Manaslu', 'Mustang'];

export default function ContinueAsScreen({ navigation }: any) {
  const { continueAsGuest } = useStore();

  const navigateToLogin = (params: Record<string, any>) => {
    const state = navigation.getState?.();
    const routeNames: string[] = state?.routeNames || [];
    if (!routeNames.includes('Login')) {
      return;
    }
    navigation.navigate('Login', params);
  };

  // ── Navigate to login immediately for snappier UX ───────────
  const goCitizenLogin = () => {
    navigateToLogin({ mode: 'citizen' });
  };

  const goTouristLogin = () => navigateToLogin({ mode: 'tourist' });

  const goGuest = async () => {
    try {
      await authAPI.startGuest();
      await continueAsGuest();
    } catch {
      await continueAsGuest();
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8faf9" />
      <AppHeader title="Hamro Pokhara" showMenu={false} showLang />

      {/* ── LOGO ROW ─────────────────────────────────────────── */}
      <View style={s.logoRow}>
        <View style={s.logoIcon}>
          <MaterialIcons name="location-city" size={20} color="#fff" />
        </View>
        <View>
          <Text style={s.logoName}>Hamro Pokhara</Text>
          <Text style={s.logoSub}>Pokhara Metropolitan City</Text>
        </View>
      </View>

      {/* ── HEADING ──────────────────────────────────────────── */}
      <View style={s.heading}>
        <Text style={s.headingTitle}>How would you{'\n'}like to continue?</Text>
        <Text style={s.headingDesc}>Choose your access type below</Text>
      </View>

      {/* ── CARDS AREA ───────────────────────────────────────── */}
      <View style={s.cards}>

        {/* CITIZEN CARD */}
        <TouchableOpacity
          style={s.citizenCard}
          onPress={goCitizenLogin}
          activeOpacity={0.92}
        >
          <LinearGradient
            colors={['#003b5a', '#1a5276']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          {/* Top row: icon + verified badge */}
          <View style={s.cardTopRow}>
            <View style={s.citizenIconBox}>
              <MaterialIcons name="person" size={22} color="#fff" />
            </View>
            <View style={s.verifiedPill}>
              <MaterialIcons name="verified" size={10} color="#fff" />
              <Text style={s.verifiedText}>Verified Access</Text>
            </View>
          </View>

          {/* Title + desc */}
          <Text style={s.citizenTitle}>Continue as Citizen</Text>
          <Text style={s.citizenDesc}>
            Full municipal services — Sifaris, tax, grievances, and more.
          </Text>

          {/* ID type pills */}
          <View style={s.pills}>
            {ID_TYPES.map(t => (
              <View key={t} style={s.pill}>
                <Text style={s.pillText}>{t}</Text>
              </View>
            ))}
          </View>

          {/* Footer CTA */}
          <View style={s.cardCTA}>
            <Text style={s.cardCTAText}>Sign in to your account</Text>
            <MaterialIcons name="arrow-forward" size={14} color="rgba(255,255,255,0.7)" />
          </View>
        </TouchableOpacity>

        {/* TOURIST CARD */}
        <TouchableOpacity
          style={s.touristCard}
          onPress={goTouristLogin}
          activeOpacity={0.92}
        >
          {/* Top row */}
          <View style={s.cardTopRow}>
            <View style={s.touristIconBox}>
              <MaterialIcons name="flight" size={20} color="#003b5a" />
            </View>
            <View style={s.passportPill}>
              <Text style={s.passportPillText}>Passport OCR</Text>
            </View>
          </View>

          {/* Title + desc */}
          <Text style={s.touristTitle}>Tourist / Visitor</Text>
          <Text style={s.touristDesc}>
            Trekking permits, TIMS, national park fees & tourism services.
          </Text>

          {/* Permit pills */}
          <View style={s.pills}>
            {PERMITS.map(p => (
              <View key={p} style={s.permitPill}>
                <Text style={s.permitPillText}>{p}</Text>
              </View>
            ))}
          </View>

          {/* Footer CTA */}
          <View style={s.cardCTA}>
            <Text style={[s.cardCTAText, { color: '#41474e' }]}>Scan your passport</Text>
            <MaterialIcons name="arrow-forward" size={14} color="#72787f" />
          </View>
        </TouchableOpacity>

      </View>

      {/* ── GUEST ROW ────────────────────────────────────────── */}
      <TouchableOpacity style={s.guestRow} onPress={goGuest} activeOpacity={0.8}>
        <MaterialIcons name="person-search" size={18} color="#72787f" />
        <Text style={s.guestText}>Browse as Guest (public info only)</Text>
        <MaterialIcons name="chevron-right" size={18} color="#c1c7cf" />
      </TouchableOpacity>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <Text style={s.terms}>
        By continuing you agree to our{' '}
        <Text style={{ color: '#003b5a' }}>Terms</Text>
        {' & '}
        <Text style={{ color: '#003b5a' }}>Privacy Policy</Text>
      </Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8faf9',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
  },

  // Logo
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#003b5a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#003b5a',
    letterSpacing: -0.2,
  },
  logoSub: {
    fontSize: 11,
    color: '#72787f',
    marginTop: 1,
  },

  // Heading
  heading: { marginBottom: 20 },
  headingTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#181c1c',
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  headingDesc: {
    fontSize: 14,
    color: '#72787f',
    marginTop: 6,
  },

  // Cards container
  cards: { flex: 1, gap: 12 },

  // Citizen card
  citizenCard: {
    flex: 1.15,
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
    // Soft shadow
    shadowColor: '#003b5a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  citizenIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#af2f23',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  citizenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  citizenDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 19,
    marginBottom: 14,
  },

  // Tourist card
  touristCard: {
    flex: 1,
    borderRadius: 22,
    padding: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6e9e8',
    shadowColor: '#003b5a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  touristIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ebeeed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passportPill: {
    backgroundColor: '#cbe6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  passportPillText: {
    color: '#0e4b6e',
    fontSize: 10,
    fontWeight: '700',
  },
  touristTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#181c1c',
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  touristDesc: {
    fontSize: 12,
    color: '#72787f',
    lineHeight: 18,
    marginBottom: 12,
  },

  // Shared pills
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  permitPill: {
    backgroundColor: '#f1f4f3',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
  },
  permitPillText: { color: '#003b5a', fontSize: 11, fontWeight: '600' },

  // Card CTA footer
  cardCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 'auto' as any,
  },
  cardCTAText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },

  // Guest row
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e6e9e8',
  },
  guestText: {
    flex: 1,
    fontSize: 13,
    color: '#41474e',
    fontWeight: '500',
  },

  // Terms
  terms: {
    fontSize: 11,
    color: '#72787f',
    textAlign: 'center',
    paddingBottom: 16,
    lineHeight: 16,
  },
});