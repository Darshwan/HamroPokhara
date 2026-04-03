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
  wardCode: string;
  population: string;
  sourceLabel: string;
  officePhone: string;
  wardChairman: {
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

const buildWardContacts = (): WardContact[] => ([
  { wardNo: 1, wardCode: 'PKR-01', population: '13,947', sourceLabel: 'Pokhara Ward 1 Page', officePhone: '061-520520', wardChairman: { name: 'Shahara Pradhan', phone: '9856003001', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-520520', email: 'Not specified on site' } },
  { wardNo: 2, wardCode: 'PKR-02', population: '10,100', sourceLabel: 'Pokhara Ward 2 Page', officePhone: '061-412321', wardChairman: { name: 'Divas Man Pradhan', phone: '9856003002', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-412321', email: 'Not specified on site' } },
  { wardNo: 3, wardCode: 'PKR-03', population: '8,284', sourceLabel: 'Pokhara Ward 3 Page', officePhone: '061-520530', wardChairman: { name: 'Prakash Man Udas', phone: '9856003003', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-520530', email: 'Not specified on site' } },
  { wardNo: 4, wardCode: 'PKR-04', population: '9,152', sourceLabel: 'Pokhara Ward 4 Page', officePhone: '061-520382', wardChairman: { name: 'Dev Krishna Parajuli', phone: '9856003004', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-520382', email: 'Not specified on site' } },
  { wardNo: 5, wardCode: 'PKR-05', population: '22,325', sourceLabel: 'Pokhara Ward 5 Page', officePhone: '061-419432', wardChairman: { name: 'Vishnu Prasad Baral', phone: '9856003005', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-419432', email: 'Not specified on site' } },
  { wardNo: 6, wardCode: 'PKR-06', population: '14,455', sourceLabel: 'Pokhara Ward 6 Page', officePhone: '061-461533', wardChairman: { name: 'Vishnu Bahadur Bhattarai', phone: '9856003006', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-461533', email: 'Not specified on site' } },
  { wardNo: 7, wardCode: 'PKR-07', population: '16,139', sourceLabel: 'Pokhara Ward 7 Page', officePhone: '061-462534', wardChairman: { name: 'Ram Mohan Acharya', phone: '9856003007', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-462534', email: 'Not specified on site' } },
  { wardNo: 8, wardCode: 'PKR-08', population: '25,439', sourceLabel: 'Pokhara Ward 8 Page', officePhone: '061-520522', wardChairman: { name: 'Rudranath Baral', phone: '9856003008', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-520522', email: 'Not specified on site' } },
  { wardNo: 9, wardCode: 'PKR-09', population: '15,981', sourceLabel: 'Pokhara Ward 9 Page', officePhone: '061-520523', wardChairman: { name: 'Dipendra Marsani', phone: '9856003009', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-520523', email: 'Not specified on site' } },
  { wardNo: 10, wardCode: 'PKR-10', population: '18,435', sourceLabel: 'Pokhara Ward 10 Page', officePhone: '061-431524', wardChairman: { name: 'Rajesh Gurung', phone: '9856003010', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-431524', email: 'Not specified on site' } },
  { wardNo: 11, wardCode: 'PKR-11', population: '17,594', sourceLabel: 'Pokhara Ward 11 Page', officePhone: '061-520526', wardChairman: { name: 'Prem Prasad Karmacharya', phone: '9856003011', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-520526', email: 'Not specified on site' } },
  { wardNo: 12, wardCode: 'PKR-12', population: '12,710', sourceLabel: 'Pokhara Ward 12 Page', officePhone: '061-520527', wardChairman: { name: 'Santosh Bastola', phone: '9856003012', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-520527', email: 'Not specified on site' } },
  { wardNo: 13, wardCode: 'PKR-13', population: '22,399', sourceLabel: 'Pokhara Ward 13 Page', officePhone: '061-520528', wardChairman: { name: 'Kiran Baral', phone: '9856003013', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-520528', email: 'Not specified on site' } },
  { wardNo: 14, wardCode: 'PKR-14', population: '31,561', sourceLabel: 'Pokhara Ward 14 Page', officePhone: '061-505019', wardChairman: { name: 'Bodh Bahadur Karki', phone: '9856003014', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-505019', email: 'Not specified on site' } },
  { wardNo: 15, wardCode: 'PKR-15', population: '24,406', sourceLabel: 'Pokhara Ward 15 Page', officePhone: '061-430583', wardChairman: { name: 'Toran Baniya', phone: '9856003015', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-430583', email: 'Not specified on site' } },
  { wardNo: 16, wardCode: 'PKR-16', population: '24,465', sourceLabel: 'Pokhara Ward 16 Page', officePhone: '061-440529', wardChairman: { name: 'Amrit Sharma Timilsina', phone: '9856003016', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-440529', email: 'Not specified on site' } },
  { wardNo: 17, wardCode: 'PKR-17', population: '46,005', sourceLabel: 'Pokhara Ward 17 Page', officePhone: '061-460536', wardChairman: { name: 'Radhika Kumari Shahi', phone: '9856003017', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-460536', email: 'Not specified on site' } },
  { wardNo: 18, wardCode: 'PKR-18', population: '12,945', sourceLabel: 'Pokhara Ward 18 Page', officePhone: '061-621538', wardChairman: { name: 'Shiv Prasad Timilsina', phone: '9856003018', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-621538', email: 'Not specified on site' } },
  { wardNo: 19, wardCode: 'PKR-19', population: '13,855', sourceLabel: 'Pokhara Ward 19 Page', officePhone: '061-440397', wardChairman: { name: 'Pushpendra Pandey', phone: '9856003019', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-440397', email: 'Not specified on site' } },
  { wardNo: 20, wardCode: 'PKR-20', population: '3,936', sourceLabel: 'Pokhara Ward 20 Page', officePhone: '061-621614', wardChairman: { name: 'Ganga Bahadur Khatri', phone: '9856003020', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-621614', email: 'Not specified on site' } },
  { wardNo: 21, wardCode: 'PKR-21', population: '9,070', sourceLabel: 'Pokhara Ward 21 Page', officePhone: '9856003021', wardChairman: { name: 'Deepak Prasad Suvedi', phone: '9856003021', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '9856003021', email: 'Not specified on site' } },
  { wardNo: 22, wardCode: 'PKR-22', population: '7,596', sourceLabel: 'Pokhara Ward 22 Page', officePhone: '061-621505', wardChairman: { name: 'Himalal Baral', phone: '9856003022', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-621505', email: 'Not specified on site' } },
  { wardNo: 23, wardCode: 'PKR-23', population: '4,276', sourceLabel: 'Pokhara Ward 23 Page', officePhone: '9856003023', wardChairman: { name: 'Ram Kaji Gurung', phone: '9856003023', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '9856003023', email: 'Not specified on site' } },
  { wardNo: 24, wardCode: 'PKR-24', population: '5,950', sourceLabel: 'Pokhara Ward 24 Page', officePhone: '9856003024', wardChairman: { name: 'Bharat Bahadur Adhikari', phone: '9856003024', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '9856003024', email: 'Not specified on site' } },
  { wardNo: 25, wardCode: 'PKR-25', population: '17,597', sourceLabel: 'Pokhara Ward 25 Page', officePhone: '9856003025', wardChairman: { name: 'Motilal Timilsina', phone: '9856003025', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '9856003025', email: 'Not specified on site' } },
  { wardNo: 26, wardCode: 'PKR-26', population: '16,777', sourceLabel: 'Pokhara Ward 26 Page', officePhone: '9856003026', wardChairman: { name: 'Narendra Thapa', phone: '9856003026', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '9856003026', email: 'Not specified on site' } },
  { wardNo: 27, wardCode: 'PKR-27', population: '16,377', sourceLabel: 'Pokhara Ward 27 Page', officePhone: '061-560380', wardChairman: { name: 'Purna Kumar Gurung', phone: '9856003028', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '061-560380', email: 'Not specified on site' } },
  { wardNo: 28, wardCode: 'PKR-28', population: '4,224', sourceLabel: 'Pokhara Ward 28 Page', officePhone: '9856003028', wardChairman: { name: 'Shreekrishna Lamichhane', phone: '9856003028', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '9856003028', email: 'Not specified on site' } },
  { wardNo: 29, wardCode: 'PKR-29', population: '16,257', sourceLabel: 'Pokhara Ward 29 Page', officePhone: '9856003029', wardChairman: { name: 'Shriprasad Gurung', phone: '9856003029', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '9856003029', email: 'Not specified on site' } },
  { wardNo: 30, wardCode: 'PKR-30', population: '16,192', sourceLabel: 'Pokhara Ward 30 Page', officePhone: '9856003030', wardChairman: { name: 'Durga Prasad Subedi', phone: '9856003030', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '9856003030', email: 'Not specified on site' } },
  { wardNo: 31, wardCode: 'PKR-31', population: '8,702', sourceLabel: 'Pokhara Ward 31 Page', officePhone: '9856003031', wardChairman: { name: 'Dhakanath Kandel', phone: '9856003031', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '9856003031', email: 'Not specified on site' } },
  { wardNo: 32, wardCode: 'PKR-32', population: '14,683', sourceLabel: 'Pokhara Ward 32 Page', officePhone: '9856003032', wardChairman: { name: 'Akkal Bahadur Karki', phone: '9856003032', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: '9856003032', email: 'Not specified on site' } },
  { wardNo: 33, wardCode: 'PKR-33', population: 'Not specified on site', sourceLabel: 'Pokhara Ward 33 Page', officePhone: 'Not specified on site', wardChairman: { name: 'Not specified on site', phone: 'Not specified on site', email: 'Not specified on site' }, wardOfficer: { name: 'Not specified on site', phone: 'Not specified on site', email: 'Not specified on site' } },
]);

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
      const label = `ward वडा ${w.wardNo} ${w.wardChairman.name} ${w.population} ${w.officePhone}`.toLowerCase();
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
          <Text style={styles.heroSubtitle}>{t('Browse all 33 wards with official ward chairperson and office contact details.', 'सबै ३३ वटा वडाहरूको आधिकारिक वडा अध्यक्ष र कार्यालय सम्पर्क विवरण हेर्नुहोस्।')}</Text>
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
                onPress={() => navigation.navigate({ name: 'WardDetail', params: { ward } })}
            >
              <View style={styles.wardTop}>
                <View style={styles.wardBadge}>
                  <Text style={styles.wardBadgeText}>{t('Ward Number', 'वडा नम्बर')} {ward.wardNo}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
              </View>
              <Text style={styles.wardMeta} numberOfLines={1}>{t('Head', 'अध्यक्ष')}: {ward.wardChairman.name}</Text>
              <Text style={styles.wardMeta} numberOfLines={1}>{t('Office', 'कार्यालय')}: {ward.officePhone}</Text>
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
