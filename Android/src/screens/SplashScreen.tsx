import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ImageBackground, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius } from '../constants/theme';

const { width, height } = Dimensions.get('window');
const POKHARA_LAT = 28.2096;
const POKHARA_LON = 83.9856;

function getAqiLabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy';
  if (aqi <= 200) return 'Very Unhealthy';
  return 'Hazardous';
}

export default function SplashScreen({ navigation }: any) {
  const [tempText, setTempText] = React.useState('18°C');
  const [aqiText, setAqiText] = React.useState('Good');

  useEffect(() => {
    const loadAtmosphere = async () => {
      try {
        const [weatherRes, airRes] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${POKHARA_LAT}&longitude=${POKHARA_LON}&current=temperature_2m`
          ),
          fetch(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${POKHARA_LAT}&longitude=${POKHARA_LON}&current=us_aqi`
          ),
        ]);

        const weatherData = await weatherRes.json();
        const airData = await airRes.json();

        const temp = weatherData?.current?.temperature_2m;
        const aqi = airData?.current?.us_aqi;

        if (typeof temp === 'number') {
          setTempText(`${Math.round(temp)}°C`);
        }
        if (typeof aqi === 'number') {
          setAqiText(getAqiLabel(aqi));
        }
      } catch {
        // Keep existing fallback values for offline-first startup.
      }
    };

    loadAtmosphere();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Hero Background */}
      <View style={styles.bgContainer}>
        {/* Mountain gradient — replace with actual image */}
        <LinearGradient
          colors={['#1a3a52', '#003b5a', '#0a2535']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        {/* Overlay gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(0,59,90,0.4)', 'rgba(24,28,28,0.92)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </View>

      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.municipalBadge}>
          <Text style={styles.municipalText}>Municipal Excellence</Text>
        </View>
        <View style={styles.langIcon}>
          <MaterialIcons name="language" size={22} color="#fff" />
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Weather + AQI bento cards */}
        <View style={styles.bentoRow}>
          <View style={styles.bentoCard}>
            <Text style={styles.bentoLabel}>Weather</Text>
            <View style={styles.bentoValue}>
              <MaterialIcons name="wb-sunny" size={14} color="#fff" />
              <Text style={styles.bentoValueText}>{tempText}</Text>
            </View>
          </View>
          <View style={styles.bentoCard}>
            <Text style={styles.bentoLabel}>Air Quality</Text>
            <View style={styles.bentoValue}>
              <MaterialIcons name="air" size={14} color="#fff" />
              <Text style={styles.bentoValueText}>{aqiText}</Text>
            </View>
          </View>
        </View>

        {/* Welcome Text */}
        <Text style={styles.greeting}>Hello,{'\n'}Namaste</Text>
        <Text style={styles.subtitle}>
          Welcome to Hamro Pokhara. Your digital gateway to the City under the Himalayas.
        </Text>
      </View>

      {/* CTA */}
      <View style={styles.cta}>
        <TouchableOpacity
          style={styles.getStartedBtn}
          onPress={() => navigation.navigate('Language')}
          activeOpacity={0.85}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.officialText}>
          Official Application of Pokhara Metropolitan City
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#003b5a' },
  bgContainer: { ...StyleSheet.absoluteFillObject },
  topHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingHorizontal: 24,
    paddingTop: 56, paddingBottom: 16,
  },
  municipalBadge: {
    backgroundColor: 'rgba(0,59,90,0.3)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  municipalText: {
    color: '#fff', fontSize: 10, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  langIcon: {
    width: 44, height: 44, borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    flex: 1, paddingHorizontal: 24,
    justifyContent: 'flex-end', paddingBottom: 32,
  },
  bentoRow: {
    flexDirection: 'row', gap: 12, marginBottom: 32,
  },
  bentoCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.lg, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    flex: 1,
  },
  bentoLabel: {
    color: 'rgba(255,255,255,0.55)', fontSize: 10,
    fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 6,
  },
  bentoValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bentoValueText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  greeting: {
    color: '#fff', fontSize: 52, fontWeight: '900',
    letterSpacing: -1.5, lineHeight: 56, marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)', fontSize: 16,
    fontWeight: '300', lineHeight: 24, maxWidth: 300,
  },
  cta: { paddingHorizontal: 24, paddingBottom: 48 },
  getStartedBtn: {
    backgroundColor: Colors.secondary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingVertical: 18, borderRadius: Radius.full,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  getStartedText: {
    color: '#fff', fontSize: 17, fontWeight: '700',
  },
  officialText: {
    color: 'rgba(255,255,255,0.4)', fontSize: 10,
    fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', textAlign: 'center', marginTop: 20,
  },
});