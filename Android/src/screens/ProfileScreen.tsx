import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, Alert, ActivityIndicator,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { citizenAPI } from '../api/client';

export default function ProfileScreen({ navigation }: any) {
  const { citizen, logout, myRequests, language, setLanguage } = useStore();
  const nid = citizen?.nid || '';

  const [profile, setProfile]         = useState<any>(null);
  const [documents, setDocuments]     = useState<any[]>([]);
  const [jobs, setJobs]               = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(true);

  // Load profile + documents from PRATIBIMBA
  useEffect(() => {
    const load = async () => {
      try {
        const [profRes, docRes] = await Promise.allSettled([
          citizenAPI.getProfile(nid),
          citizenAPI.getDocuments(nid),
        ]);

        if (profRes.status === 'fulfilled' && profRes.value.success) {
          setProfile(profRes.value.profile);
        }
        if (docRes.status === 'fulfilled' && docRes.value.success) {
          setDocuments(docRes.value.documents || []);
        }
      } catch (e) {
        // Use store data as fallback
      } finally {
        setLoading(false);
      }
    };
    if (nid) load();
    else setLoading(false);

    // Demo jobs
    setJobs([
      { id: 1, title: 'Public Health Officer', org: 'Pokhara Metropolitan City', deadline: '3 Days Left', icon: 'account-balance' },
      { id: 2, title: 'Civil Engineer (Contract)', org: 'Gandaki Province Planning', deadline: '1 Week Left', icon: 'engineering' },
    ]);
  }, [nid]);

  const displayName = profile?.full_name || citizen?.name || 'Citizen';
  const displayNE   = profile?.full_name_ne || '';
  const wardDisplay = profile?.ward_code || citizen?.ward_code || 'NPL-04-33-09';
  const wardNum     = wardDisplay.split('-')[3] || '9';

  const approved = myRequests.filter(r => r.status === 'APPROVED').length;
  const pending  = myRequests.filter(r => r.status === 'PENDING' || r.status === 'UNDER_REVIEW').length;

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── PROFILE HEADER ─────────────────────────────────────── */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={36} color={Colors.primary} />
            </View>
            <View style={styles.verifiedBadge}>
              <MaterialIcons name="verified" size={12} color="#fff" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>Namaste, {displayName}</Text>
            {displayNE !== '' && <Text style={styles.profileNameNE}>{displayNE}</Text>}
            <View style={styles.locationRow}>
              <MaterialIcons name="location-on" size={13} color={Colors.onSurfaceVariant} />
              <Text style={styles.locationText}>Ward No. {wardNum}, {profile?.district || 'Kaski'}, Pokhara</Text>
            </View>
          </View>
          <View style={styles.premiumBadge}>
            <MaterialIcons name="workspace-premium" size={14} color={Colors.onPrimaryFixedVariant} />
            <Text style={styles.premiumText}>Verified</Text>
          </View>
        </View>

        {/* ── DIGITAL NATIONAL ID CARD (PRATIBIMBA) ──────────────── */}
        <View style={styles.idCard}>
          <LinearGradient
            colors={[Colors.primaryContainer, Colors.primary]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          {/* Glow effect */}
          <View style={styles.idGlow} />

          <View style={{ position: 'relative', zIndex: 1 }}>
            <View style={styles.idTopRow}>
              <View>
                <Text style={styles.idGovLabel}>Government of Nepal</Text>
                <Text style={styles.idCardTitle}>Digital National ID</Text>
              </View>
              <View style={styles.idHologram}>
                <MaterialIcons name="security" size={28} color="rgba(255,255,255,0.5)" />
              </View>
            </View>

            <View style={styles.idFields}>
              <View style={styles.idField}>
                <Text style={styles.idFieldLabel}>Citizen NID</Text>
                <Text style={styles.idFieldValue}>{profile?.nid || nid || 'PKR-9928-102'}</Text>
              </View>
              <View style={styles.idField}>
                <Text style={styles.idFieldLabel}>Ward Profile</Text>
                <Text style={styles.idFieldValue}>Ward {wardNum}, {profile?.district || 'Kaski'}</Text>
              </View>
              <View style={styles.idField}>
                <Text style={styles.idFieldLabel}>Status</Text>
                <View style={styles.activeStatus}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>ACTIVE</Text>
                </View>
              </View>
            </View>

            <View style={styles.idActions}>
              <TouchableOpacity
                style={styles.idBtnOutline}
                onPress={() => navigation.navigate('Verify')}
              >
                <MaterialIcons name="qr-code-2" size={18} color="#fff" />
                <Text style={styles.idBtnText}>Show QR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.idBtnFilled}>
                <MaterialIcons name="download" size={18} color={Colors.secondary} />
                <Text style={[styles.idBtnText, { color: Colors.secondary }]}>Download PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── REQUEST STATS (from PRATIBIMBA) ────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{myRequests.length}</Text>
            <Text style={styles.statLbl}>Requests</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: Colors.success }]}>{approved}</Text>
            <Text style={styles.statLbl}>Approved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: '#b7791f' }]}>{pending}</Text>
            <Text style={styles.statLbl}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: Colors.primary }]}>{documents.length}</Text>
            <Text style={styles.statLbl}>Documents</Text>
          </View>
        </View>

        {/* ── LANGUAGE SWITCHER ───────────────────────────────────── */}
        <View style={styles.langCard}>
          <Text style={styles.langCardTitle}>Preferred Language</Text>
          {[
            { code: 'ne', flag: '🇳🇵', label: 'नेपाली' },
            { code: 'en', flag: '🇺🇸', label: 'English' },
            { code: 'gu', flag: '🏔️',  label: 'गुरुङ' },
          ].map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.langOption, language === lang.code && styles.langOptionActive]}
              onPress={() => setLanguage(lang.code)}
            >
              <Text style={styles.langFlag}>{lang.flag}</Text>
              <Text style={[styles.langLabel, language === lang.code && styles.langLabelActive]}>
                {lang.label}
              </Text>
              {language === lang.code && (
                <MaterialIcons name="check-circle" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
          <Text style={styles.langNote}>Changes apply across all civic services.</Text>
        </View>

        {/* ── MY DOCUMENTS (from PRATIBIMBA Ledger) ──────────────── */}
        {documents.length > 0 && (
          <View style={styles.docsCard}>
            <Text style={styles.docsTitle}>My PRATIBIMBA Documents</Text>
            {documents.slice(0, 3).map((doc) => (
              <View key={doc.dtid} style={styles.docItem}>
                <View style={styles.docIcon}>
                  <MaterialIcons name="description" size={16} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docType}>{doc.document_type.replace(/_/g, ' ')}</Text>
                  <Text style={styles.docDtid} numberOfLines={1}>{doc.dtid}</Text>
                </View>
                <View style={[styles.docStatus, { backgroundColor: doc.status === 'ACTIVE' ? Colors.successLight : '#fdf0ef' }]}>
                  <Text style={[styles.docStatusText, { color: doc.status === 'ACTIVE' ? Colors.success : Colors.secondary }]}>
                    {doc.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── JOB PORTAL ──────────────────────────────────────────── */}
        <View style={styles.jobCard}>
          <View style={styles.jobHeader}>
            <View>
              <Text style={styles.jobTitle}>Job Portal</Text>
              <Text style={styles.jobSub}>Active vacancies in Gandaki</Text>
            </View>
            <TouchableOpacity style={styles.jobHeaderBtn}>
              <MaterialIcons name="work" size={20} color={Colors.onPrimaryFixedVariant} />
            </TouchableOpacity>
          </View>
          {jobs.map((job) => (
            <TouchableOpacity key={job.id} style={styles.jobItem}>
              <View style={styles.jobItemIcon}>
                <MaterialIcons name={job.icon as any} size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.jobItemTitle}>{job.title}</Text>
                <Text style={styles.jobItemOrg}>{job.org} · {job.deadline}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.jobViewAll}>
            <Text style={styles.jobViewAllText}>View All 12 Vacancies</Text>
          </TouchableOpacity>
        </View>

        {/* ── SETTINGS GRID ────────────────────────────────────────── */}
        <View style={styles.settingsGrid}>
          {[
            { icon: 'payments',       label: 'Tax History',   action: () => {} },
            { icon: 'verified-user',  label: 'Privacy',       action: () => {} },
            { icon: 'help-center',    label: 'Civic Help',    action: () => {} },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.settingCard} onPress={item.action}>
              <MaterialIcons name={item.icon as any} size={26} color={Colors.primary} />
              <Text style={styles.settingLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.settingCard, styles.settingCardLogout]} onPress={handleLogout}>
            <MaterialIcons name="logout" size={26} color={Colors.secondary} />
            <Text style={[styles.settingLabel, { color: Colors.secondary }]}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* ── NOTIFICATIONS TOGGLE ─────────────────────────────────── */}
        <View style={styles.notifRow}>
          <MaterialIcons name="notifications" size={20} color={Colors.primary} />
          <Text style={styles.notifText}>Push Notifications</Text>
          <Switch
            value={notificationsOn}
            onValueChange={setNotificationsOn}
            trackColor={{ false: Colors.outlineVariant, true: Colors.primaryFixed }}
            thumbColor={notificationsOn ? Colors.primary : Colors.outline}
          />
        </View>

        <Text style={styles.version}>Mero Sahar v1.0.0 · Powered by PRATIBIMBA NDO</Text>
        <Text style={styles.versionSub}>Nepal Electronic Transactions Act 2063</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.background },
  scroll:             { padding: 16, paddingBottom: 48, gap: 14 },
  profileHeader:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 16, ...Shadow.sm },
  avatarWrap:         { position: 'relative' },
  avatar:             { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.surfaceContainerLowest },
  verifiedBadge:      { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.secondary, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  profileName:        { fontSize: 20, fontWeight: '800', color: Colors.primary },
  profileNameNE:      { fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 2 },
  locationRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  locationText:       { fontSize: 12, color: Colors.onSurfaceVariant },
  premiumBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryFixed, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  premiumText:        { fontSize: 10, fontWeight: '700', color: Colors.onPrimaryFixedVariant },
  idCard:             { borderRadius: Radius.xxl, padding: 24, overflow: 'hidden', ...Shadow.lg },
  idGlow:             { position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' },
  idTopRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  idGovLabel:         { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5, textTransform: 'uppercase' },
  idCardTitle:        { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 2 },
  idHologram:         { width: 56, height: 56, borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  idFields:           { flexDirection: 'row', gap: 20, marginBottom: 20 },
  idField:            { flex: 1 },
  idFieldLabel:       { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  idFieldValue:       { fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: 'monospace' },
  activeStatus:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  activeText:         { color: '#4ade80', fontSize: 13, fontWeight: '700' },
  idActions:          { flexDirection: 'row', gap: 10 },
  idBtnOutline:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingVertical: 12, borderRadius: Radius.full },
  idBtnFilled:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', paddingVertical: 12, borderRadius: Radius.full },
  idBtnText:          { fontSize: 13, fontWeight: '700', color: '#fff' },
  statsRow:           { flexDirection: 'row', gap: 10 },
  statCard:           { flex: 1, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 14, alignItems: 'center', ...Shadow.sm },
  statNum:            { fontSize: 22, fontWeight: '900', color: Colors.primary },
  statLbl:            { fontSize: 10, color: Colors.onSurfaceVariant, marginTop: 2 },
  langCard:           { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xxl, padding: 20 },
  langCardTitle:      { fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  langOption:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, marginBottom: 8 },
  langOptionActive:   { borderWidth: 1, borderColor: Colors.primaryFixed },
  langFlag:           { fontSize: 20 },
  langLabel:          { fontSize: 15, fontWeight: '600', color: Colors.primary, flex: 1 },
  langLabelActive:    { fontWeight: '700' },
  langNote:           { fontSize: 10, color: Colors.outline, marginTop: 8, paddingHorizontal: 4 },
  docsCard:           { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 18, ...Shadow.sm },
  docsTitle:          { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 14 },
  docItem:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.outlineVariant },
  docIcon:            { width: 36, height: 36, borderRadius: Radius.lg, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  docType:            { fontSize: 13, fontWeight: '600', color: Colors.primary },
  docDtid:            { fontSize: 10, color: Colors.onSurfaceVariant, fontFamily: 'monospace', marginTop: 2 },
  docStatus:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  docStatusText:      { fontSize: 10, fontWeight: '700' },
  jobCard:            { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xxl, padding: 20, ...Shadow.sm },
  jobHeader:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  jobTitle:           { fontSize: 20, fontWeight: '800', color: Colors.primary },
  jobSub:             { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
  jobHeaderBtn:       { width: 44, height: 44, backgroundColor: Colors.primaryFixed, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center' },
  jobItem:            { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, marginBottom: 8 },
  jobItemIcon:        { width: 44, height: 44, backgroundColor: '#fff', borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  jobItemTitle:       { fontSize: 13, fontWeight: '700', color: Colors.primary },
  jobItemOrg:         { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
  jobViewAll:         { paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(0,59,90,0.1)', borderRadius: Radius.xl, alignItems: 'center', marginTop: 4 },
  jobViewAllText:     { fontSize: 13, fontWeight: '700', color: Colors.primary },
  settingsGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  settingCard:        { width: '47%', backgroundColor: 'rgba(230,233,232,0.5)', padding: 20, borderRadius: Radius.xxl, alignItems: 'center', gap: 10 },
  settingCardLogout:  { backgroundColor: 'rgba(175,47,35,0.05)' },
  settingLabel:       { fontSize: 13, fontWeight: '700', color: Colors.primary },
  notifRow:           { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surfaceContainerLowest, padding: 16, borderRadius: Radius.xl },
  notifText:          { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  version:            { textAlign: 'center', fontSize: 11, color: Colors.outline },
  versionSub:         { textAlign: 'center', fontSize: 10, color: Colors.outline, opacity: 0.6 },
});