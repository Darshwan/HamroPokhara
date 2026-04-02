import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';

type WardContact = {
  wardNo: number;
  wardHead: {
    name: string;
    phone: string;
    email: string;
  };
  wardOfficer: {
    name: string;
    phone: string;
    email: string;
  };
};

const buildWardContacts = (): WardContact[] => (
  Array.from({ length: 33 }, (_, i) => {
    const wardNo = i + 1;
    const padded = String(wardNo).padStart(2, '0');
    return {
      wardNo,
      wardHead: {
        name: `Ward Head ${padded}`,
        phone: `+977-61-40${padded}01`,
        email: `ward${padded}.head@pokharamun.gov.np`,
      },
      wardOfficer: {
        name: `Ward Officer ${padded}`,
        phone: `+977-61-40${padded}11`,
        email: `ward${padded}.officer@pokharamun.gov.np`,
      },
    };
  })
);

export default function WardMapScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const { language, setLanguage } = useStore();
  const isNepali = language === 'ne';
  const t = (en: string, ne: string) => (isNepali ? ne : en);

  const wards = useMemo(() => buildWardContacts(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wards;
    return wards.filter((w) => {
      const label = `ward वडा ${w.wardNo} ${w.wardHead.name} ${w.wardOfficer.name}`.toLowerCase();
      return label.includes(q);
    });
  }, [query, wards]);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title={t('Hamro Pokhara', 'हाम्रो पोखरा')}
        showBack
        showNotif
        showLang
        leftContent={(
          <View style={styles.headerLogo}>
            <MaterialIcons name="map" size={18} color={Colors.primary} />
          </View>
        )}
        onBack={() => navigation.goBack()}
        onLang={() => setLanguage(language === 'ne' ? 'en' : 'ne')}
        onNotif={() => {}}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{t('Pokhara Ward Map', 'पोखरा वडा नक्सा')}</Text>
          <Text style={styles.heroSubtitle}>{t('Browse all 33 wards and open contact details for ward heads and officers.', 'सबै ३३ वटा वडाहरू हेर्नुहोस् र वडा अध्यक्ष तथा अधिकृतको सम्पर्क विवरण खोल्नुहोस्।')}</Text>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={18} color={Colors.outline} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('Search ward number or name', 'वडा नम्बर वा नाम खोज्नुहोस्')}
              placeholderTextColor={Colors.outline}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {!!query && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <MaterialIcons name="close" size={18} color={Colors.outline} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.wardGrid}>
          {filtered.map((ward) => (
            <TouchableOpacity
              key={ward.wardNo}
              style={styles.wardCard}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('WardDetail', { ward })}
            >
              <View style={styles.wardTop}>
                <View style={styles.wardBadge}>
                  <Text style={styles.wardBadgeText}>{t('Ward Number', 'वडा नम्बर')} {ward.wardNo}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
              </View>
              <Text style={styles.wardMeta} numberOfLines={1}>{t('Head', 'अध्यक्ष')}: {ward.wardHead.name}</Text>
              <Text style={styles.wardMeta} numberOfLines={1}>{t('Officer', 'सचिव')}: {ward.wardOfficer.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerLogo: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  heroCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 16,
    ...Shadow.sm,
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: Colors.primary, letterSpacing: -0.3 },
  heroSubtitle: { marginTop: 4, fontSize: 12, lineHeight: 18, color: Colors.onSurfaceVariant },
  searchBar: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLow,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.onSurface },
  wardGrid: { gap: 10 },
  wardCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 14,
    ...Shadow.sm,
  },
  wardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wardBadge: {
    backgroundColor: Colors.primaryFixed,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  wardBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  wardMeta: { marginTop: 4, fontSize: 12, color: Colors.onSurfaceVariant },
});
