import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import AppHeader from '../components/AppHeader';

const LANGUAGES = [
  { code: 'ne', native: 'नेपाली',   label: 'Nepali'   },
  { code: 'en', native: 'English',   label: 'English'  },
  { code: 'zh', native: '中文',      label: 'Chinese'  },
  { code: 'hi', native: 'हिन्दी',   label: 'Hindi'    },
  { code: 'es', native: 'Español',   label: 'Spanish'  },
  { code: 'fr', native: 'Français',  label: 'French'   },
  { code: 'de', native: 'Deutsch',   label: 'German'   },
  { code: 'ur', native: 'اردو',      label: 'Urdu'     },
  { code: 'bn', native: 'বাংলা',    label: 'Bengali'  },
  { code: 'ja', native: '日本語',    label: 'Japanese' },
  { code: 'ko', native: '한국어',    label: 'Korean'   },
  { code: 'ar', native: 'العربية',   label: 'Arabic'   },
];

export default function LanguageScreen({ navigation }: any) {
  const [selected, setSelected] = useState('ne');
  const { setLanguage } = useStore();

  const confirm = () => {
    setLanguage(selected);
    navigation.navigate('ContinueAs');
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Hamro Pokhara" showMenu={false} showLang showBack onBack={() => navigation.goBack()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Select Language</Text>
          <Text style={styles.subtitle}>
            Choose your preferred language for a personalized experience.
          </Text>
        </View>

        {/* Language Grid */}
        <View style={styles.grid}>
          {LANGUAGES.map((lang) => {
            const isSelected = selected === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langCard, isSelected && styles.langCardSelected]}
                onPress={() => setSelected(lang.code)}
                activeOpacity={0.8}
              >
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <MaterialIcons name="check" size={12} color="#fff" />
                  </View>
                )}
                <Text style={[styles.nativeText, isSelected && styles.nativeTextSelected]}>
                  {lang.native}
                </Text>
                <Text style={[styles.labelText, isSelected && styles.labelTextSelected]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.confirmBtn} onPress={confirm} activeOpacity={0.85}>
          <Text style={styles.confirmText}>Confirm Language Selection</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 120 },
  titleSection: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '900', color: Colors.primary, letterSpacing: -0.8 },
  subtitle: { fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 6, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  langCard: {
    width: '47%', padding: 20, borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    position: 'relative', overflow: 'hidden',
    ...Shadow.sm,
  },
  langCardSelected: { backgroundColor: Colors.primary },
  checkBadge: {
    position: 'absolute', top: 12, right: 12,
    width: 22, height: 22, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  nativeText: {
    fontSize: 22, fontWeight: '800', color: Colors.primary, marginBottom: 4,
  },
  nativeTextSelected: { color: '#fff' },
  labelText: {
    fontSize: 11, fontWeight: '700', color: Colors.onSurfaceVariant,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  labelTextSelected: { color: 'rgba(255,255,255,0.65)' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: Colors.outlineVariant,
  },
  confirmBtn: {
    backgroundColor: Colors.primary, paddingVertical: 18,
    borderRadius: Radius.full, alignItems: 'center',
    ...Shadow.md,
  },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});