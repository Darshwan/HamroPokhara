import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';

export default function WardDetailScreen({ navigation, route }: any) {
  const ward = route?.params?.ward;
  const { language, setLanguage } = useStore();
  const wardCode = ward?.wardCode ?? `PKR-${String(ward?.wardNo ?? '').padStart(2, '0')}`;
  const wardHead = ward?.wardChairman ?? ward?.wardHead;
  const wardOfficer = ward?.wardOfficer;

  if (!ward) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader
          title="HamroPokhara"
          showBack
          showLang
          showNotif
          onBack={() => navigation.goBack()}
          onLang={() => setLanguage(language === 'ne' ? 'en' : 'ne')}
          onNotif={() => {}}
        />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Ward details not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title={`Ward ${String(ward.wardNo).padStart(2, '0')}`}
        showBack
        showLang
        showNotif
        leftContent={(
          <View style={styles.headerLogo}>
            <MaterialIcons name="location-city" size={18} color={Colors.primary} />
          </View>
        )}
        onBack={() => navigation.goBack()}
        onLang={() => setLanguage(language === 'ne' ? 'en' : 'ne')}
        onNotif={() => {}}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroCode}>{wardCode}</Text>
          <Text style={styles.heroTitle}>Ward Contact Directory</Text>
          <Text style={styles.heroSubtitle}>Direct points of contact for administrative support in this ward.</Text>
          {!!ward?.population && (
            <Text style={styles.heroMeta}>Population: {ward.population}</Text>
          )}
          {!!ward?.sourceLabel && (
            <Text style={styles.heroMeta}>Source: {ward.sourceLabel}</Text>
          )}
        </View>

        <View style={styles.contactCard}>
          <View style={styles.contactTitleRow}>
            <MaterialIcons name="workspace-premium" size={18} color={Colors.primary} />
            <Text style={styles.contactTitle}>Ward Chairperson</Text>
          </View>
          <Text style={styles.personName}>{wardHead?.name ?? 'Not specified on site'}</Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="call" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>{wardHead?.phone ?? 'Not specified on site'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="mail" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>{wardHead?.email ?? 'Not specified on site'}</Text>
          </View>
        </View>

        <View style={styles.contactCard}>
          <View style={styles.contactTitleRow}>
            <MaterialIcons name="badge" size={18} color={Colors.primary} />
            <Text style={styles.contactTitle}>Ward Office</Text>
          </View>
          <Text style={styles.personName}>{wardOfficer?.name ?? 'Not specified on site'}</Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="call" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>{wardOfficer?.phone ?? ward?.officePhone ?? 'Not specified on site'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="mail" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>{wardOfficer?.email ?? 'Not specified on site'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={16} color={Colors.primary} />
          <Text style={styles.backBtnText}>Back to Ward List</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: Colors.onSurfaceVariant },
  headerLogo: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  heroCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Radius.xl,
    padding: 16,
    ...Shadow.sm,
  },
  heroCode: { fontSize: 12, color: Colors.onPrimaryFixedVariant, fontWeight: '700' },
  heroTitle: { marginTop: 6, fontSize: 20, fontWeight: '900', color: Colors.primary },
  heroSubtitle: { marginTop: 4, fontSize: 12, lineHeight: 18, color: Colors.onSurfaceVariant },
  heroMeta: { marginTop: 6, fontSize: 11, color: Colors.onSurfaceVariant },
  contactCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Radius.xl,
    padding: 14,
    ...Shadow.sm,
  },
  contactTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  personName: { marginTop: 8, fontSize: 16, fontWeight: '700', color: Colors.onSurface },
  infoRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: Colors.onSurfaceVariant },
  backBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryFixed,
  },
  backBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
});
