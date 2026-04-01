import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, RefreshControl,
  ActivityIndicator, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { citizenAPI, statsAPI } from '../api/client';

export default function CitizenPortalScreen({ navigation }: any) {
  const { citizen } = useStore();
  const nid      = citizen?.nid || '';
  const wardCode = citizen?.ward_code || 'NPL-04-33-09';

  const [notices, setNotices]     = useState<any[]>([]);
  const [stats, setStats]         = useState<any>(null);
  const [grievances, setGrievances] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [voteChoice, setVoteChoice] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [noticesRes, statsRes, grievRes] = await Promise.allSettled([
        citizenAPI.getNotices(wardCode),
        statsAPI.getStats(),
        citizenAPI.getGrievances(nid),
      ]);

      if (noticesRes.status === 'fulfilled' && noticesRes.value.success) {
        setNotices(noticesRes.value.notices || []);
      } else {
        setNotices([
          { notice_id: 'NTC-001', title: 'Water Supply Interruption', title_ne: 'पानी आपूर्ति बन्द', category: 'URGENT', content: 'Water supply interrupted 8AM-4PM on 2082/06/15.', is_urgent: true },
          { notice_id: 'NTC-002', title: 'Road Widening Project', title_ne: 'सडक चौडाइ', category: 'INFRASTRUCTURE', content: 'Prithvi Chowk road widening begins next week.', is_urgent: false },
          { notice_id: 'NTC-003', title: 'Free Health Camp', title_ne: 'स्वास्थ्य शिविर', category: 'HEALTH', content: 'Free checkup at Ward 9 hall on 2082/06/20.', is_urgent: false },
        ]);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.success) {
        setStats(statsRes.value.stats);
      }

      if (grievRes.status === 'fulfilled' && grievRes.value.success) {
        setGrievances(grievRes.value.grievances || []);
      }
    } catch (e) {
      console.error('Portal load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const urgentNotice = notices.find(n => n.is_urgent);
  const regularNotices = notices.filter(n => !n.is_urgent);

  const grievanceSolvedPct = grievances.length > 0
    ? Math.round((grievances.filter(g => g.status === 'RESOLVED').length / grievances.length) * 100)
    : 85;

  const CATEGORY_ICONS: Record<string, string> = {
    URGENT: 'campaign', INFRASTRUCTURE: 'construction',
    HEALTH: 'local-hospital', CULTURE: 'celebration',
    TOURISM: 'landscape', GENERAL: 'info',
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
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Citizen Power</Text>
          <Text style={styles.headerDesc}>
            Digital transparency &amp; direct civic action
          </Text>
        </View>
        <View style={styles.wardBadge}>
          <MaterialIcons name="location-on" size={12} color={Colors.onPrimaryFixedVariant} />
          <Text style={styles.wardBadgeText}>
            Ward {wardCode.split('-')[3] || '9'}, Baidam
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >

        {/* ── SUCHANA / NOTICES ──────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Suchana <Text style={styles.sectionSub}>/ Notices</Text>
          </Text>
          <TouchableOpacity><Text style={styles.viewAll}>View All</Text></TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.noticesRow}
        >
          {[
            urgentNotice && { ...urgentNotice, isFirst: true },
            ...regularNotices.map(n => ({ ...n, isFirst: false })),
          ].filter(Boolean).map((n: any, i) => (
            <TouchableOpacity key={n.notice_id} style={styles.noticeItem}>
              <View style={[
                styles.noticeCircle,
                n.is_urgent && styles.noticeCircleUrgent,
              ]}>
                <View style={styles.noticeInner}>
                  <MaterialIcons
                    name={(CATEGORY_ICONS[n.category] || 'info') as any}
                    size={22}
                    color={n.is_urgent ? Colors.secondary : Colors.primary}
                  />
                </View>
              </View>
              <Text style={[styles.noticeLabel, n.is_urgent && styles.noticeLabelUrgent]}>
                {n.category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── GRIEVANCE 311 HERO ─────────────────────────────────── */}
        <View style={styles.grievanceHero}>
          <LinearGradient
            colors={[Colors.primaryContainer, '#0c3550']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={{ position: 'relative', zIndex: 1 }}>
            <View style={styles.grievanceTopRow}>
              <View style={styles.immediateLabel}>
                <Text style={styles.immediateLabelText}>Immediate Action</Text>
              </View>
              <Text style={styles.grievance311}>311</Text>
            </View>
            <Text style={styles.grievanceTitle}>Report a Problem</Text>
            <Text style={styles.grievanceDesc}>
              Help fix Pokhara. Report potholes, broken streetlights, or water leakage with GPS.
            </Text>
            <View style={styles.grievanceBtns}>
              <TouchableOpacity
                style={styles.grievanceBtnPrimary}
                onPress={() => navigation.navigate('Sewa')}
              >
                <MaterialIcons name="add-a-photo" size={16} color="#fff" />
                <Text style={styles.grievanceBtnText}>Upload Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.grievanceBtnSecondary}>
                <MaterialIcons name="my-location" size={16} color="#fff" />
                <Text style={styles.grievanceBtnText}>Auto-tag Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── TAX TRACKER ───────────────────────────────────────── */}
        <View style={styles.taxTracker}>
          <View style={styles.taxTrackerHeader}>
            <View style={styles.taxTrackerIcon}>
              <MaterialIcons name="map" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.taxTrackerTitle}>Tax Tracker</Text>
          </View>
          <View style={styles.taxTrackerBody}>
            <View style={styles.taxStat}>
              <Text style={styles.taxStatLabel}>Active Projects</Text>
              <Text style={styles.taxStatValue}>14</Text>
            </View>
            <View style={styles.taxStat}>
              <Text style={styles.taxStatLabel}>Ward Budget Used</Text>
              <Text style={styles.taxStatValue}>67%</Text>
            </View>
            <View style={styles.taxStat}>
              <Text style={styles.taxStatLabel}>Transparency Score</Text>
              <Text style={[styles.taxStatValue, { color: Colors.success }]}>A+</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.taxTrackerBtn}>
            <Text style={styles.taxTrackerBtnText}>View Local Projects</Text>
          </TouchableOpacity>
        </View>

        {/* ── WASTE SCHEDULE ──────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <MaterialIcons name="delete-sweep" size={36} color={Colors.primaryContainer} />
            <View style={styles.onTrackBadge}>
              <Text style={styles.onTrackText}>ON TRACK</Text>
            </View>
          </View>
          <Text style={styles.cardTitle}>Waste Schedule</Text>
          <Text style={styles.cardDesc}>
            Truck ID: PKR-402 is 15 mins away from Ward {wardCode.split('-')[3] || '9'}.
          </Text>
          <TouchableOpacity style={styles.alertBtn}>
            <Text style={styles.alertBtnText}>Set Alert</Text>
            <MaterialIcons name="notifications-active" size={14} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── BLOOD CONNECT ─────────────────────────────────────── */}
        <View style={styles.bloodCard}>
          <View style={styles.bloodIcon}>
            <MaterialIcons name="bloodtype" size={28} color={Colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bloodTitle}>Blood Connect</Text>
            <Text style={styles.bloodDesc}>Availability across Gandaki Hospital &amp; Manipal</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {['A+', 'B+', 'O-', 'AB+', 'B-'].map((bt) => (
                <View key={bt} style={[styles.bloodType, bt === 'O-' && styles.bloodTypeUrgent]}>
                  <Text style={[styles.bloodTypeText, bt === 'O-' && { color: '#fff' }]}>{bt}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* ── PUBLIC HEARING / VOTE ─────────────────────────────── */}
        <View style={styles.hearingCard}>
          <View style={styles.hearingTopRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE HEARING</Text>
            </View>
            <Text style={styles.onlineCount}>1.2k Citizens Online</Text>
          </View>
          <Text style={styles.hearingTitle}>New Public Park at Phewa North?</Text>
          <Text style={styles.hearingDesc}>
            Cast your vote on the proposed landscape design and environmental impact assessment.
          </Text>
          <View style={styles.voteRow}>
            {['Yes, Build It', 'Need Review', 'Against'].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.voteBtn, voteChoice === opt && styles.voteBtnSelected]}
                onPress={() => setVoteChoice(opt)}
              >
                <Text style={[styles.voteBtnText, voteChoice === opt && { color: '#fff' }]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {voteChoice && (
            <View style={styles.votedConfirm}>
              <MaterialIcons name="how-to-vote" size={14} color={Colors.success} />
              <Text style={styles.votedConfirmText}>Vote recorded: {voteChoice}</Text>
            </View>
          )}
        </View>

        {/* ── IMPACT STATS (Live from PRATIBIMBA + local) ──────────── */}
        <View style={styles.impactGrid}>
          {[
            { value: `${grievanceSolvedPct}%`, label: 'Grievances Solved', color: Colors.primary },
            { value: stats?.issued_today?.toString() || '23', label: 'Docs Today',    color: Colors.primary },
            { value: 'NPR 12M',                              label: 'Tax Transparency', color: Colors.secondary },
            { value: stats?.total_documents?.toLocaleString() || '1,247', label: 'Total Docs', color: Colors.primary },
          ].map((stat) => (
            <View key={stat.label} style={styles.impactCard}>
              <Text style={[styles.impactValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.impactLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: Colors.surface },
  header:              { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  headerTitle:         { fontSize: 34, fontWeight: '900', color: Colors.primary, letterSpacing: -0.8 },
  headerDesc:          { fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 4 },
  wardBadge:           { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryFixed, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  wardBadgeText:       { fontSize: 11, fontWeight: '700', color: Colors.onPrimaryFixedVariant },
  scroll:              { padding: 16, gap: 14, paddingBottom: 40 },
  sectionHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle:        { fontSize: 16, fontWeight: '800', color: Colors.primary },
  sectionSub:          { fontWeight: '400', color: Colors.outline },
  viewAll:             { fontSize: 13, fontWeight: '600', color: Colors.primary },
  noticesRow:          { gap: 14, paddingVertical: 8 },
  noticeItem:          { alignItems: 'center', gap: 6, width: 70 },
  noticeCircle:        { width: 70, height: 70, borderRadius: 35, padding: 3, backgroundColor: Colors.surfaceContainerHigh },
  noticeCircleUrgent:  { backgroundColor: Colors.secondary },
  noticeInner:         { flex: 1, borderRadius: 30, backgroundColor: Colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.surface },
  noticeLabel:         { fontSize: 9, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
  noticeLabelUrgent:   { color: Colors.secondary },
  grievanceHero:       { borderRadius: Radius.xxl, padding: 24, overflow: 'hidden', minHeight: 220, ...Shadow.md },
  grievanceTopRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  immediateLabel:      { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.lg },
  immediateLabelText:  { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700' },
  grievance311:        { fontSize: 40, fontWeight: '900', color: 'rgba(255,255,255,0.15)' },
  grievanceTitle:      { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 8 },
  grievanceDesc:       { fontSize: 13, color: 'rgba(148,197,238,0.8)', lineHeight: 20, marginBottom: 20 },
  grievanceBtns:       { flexDirection: 'row', gap: 10 },
  grievanceBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.secondary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.full },
  grievanceBtnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  grievanceBtnText:    { color: '#fff', fontSize: 12, fontWeight: '700' },
  taxTracker:          { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 20, ...Shadow.sm },
  taxTrackerHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  taxTrackerIcon:      { width: 40, height: 40, borderRadius: Radius.lg, backgroundColor: 'rgba(0,59,90,0.08)', alignItems: 'center', justifyContent: 'center' },
  taxTrackerTitle:     { fontSize: 18, fontWeight: '700', color: Colors.primary },
  taxTrackerBody:      { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  taxStat:             { alignItems: 'center' },
  taxStatLabel:        { fontSize: 10, color: Colors.onSurfaceVariant, fontWeight: '600', textAlign: 'center' },
  taxStatValue:        { fontSize: 18, fontWeight: '800', color: Colors.primary, marginTop: 4 },
  taxTrackerBtn:       { backgroundColor: Colors.surfaceContainerHigh, borderRadius: Radius.lg, paddingVertical: 12, alignItems: 'center' },
  taxTrackerBtnText:   { fontSize: 13, fontWeight: '700', color: Colors.primary },
  card:                { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, padding: 20, ...Shadow.sm },
  cardTop:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardTitle:           { fontSize: 18, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  cardDesc:            { fontSize: 12, color: Colors.onSurfaceVariant },
  onTrackBadge:        { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  onTrackText:         { color: '#15803d', fontSize: 10, fontWeight: '700' },
  alertBtn:            { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  alertBtnText:        { fontSize: 13, fontWeight: '700', color: Colors.primary },
  bloodCard:           { backgroundColor: '#fff', borderRadius: Radius.xl, padding: 20, flexDirection: 'row', gap: 14, ...Shadow.sm },
  bloodIcon:           { width: 56, height: 56, borderRadius: Radius.xl, backgroundColor: 'rgba(175,47,35,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bloodTitle:          { fontSize: 18, fontWeight: '700', color: Colors.primary },
  bloodDesc:           { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 4 },
  bloodType:           { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.surfaceContainerHigh, borderRadius: Radius.lg, marginRight: 8 },
  bloodTypeUrgent:     { backgroundColor: Colors.secondary },
  bloodTypeText:       { fontSize: 12, fontWeight: '800', color: Colors.secondary },
  hearingCard:         { backgroundColor: Colors.surfaceContainerHigh, borderRadius: Radius.xxl, padding: 24 },
  hearingTopRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  liveBadge:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  liveDot:             { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  liveText:            { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  onlineCount:         { fontSize: 11, color: Colors.onSurfaceVariant },
  hearingTitle:        { fontSize: 22, fontWeight: '900', color: Colors.primary, lineHeight: 28, marginBottom: 8 },
  hearingDesc:         { fontSize: 13, color: Colors.onSurfaceVariant, lineHeight: 20, marginBottom: 16 },
  voteRow:             { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  voteBtn:             { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,59,90,0.15)' },
  voteBtnSelected:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  voteBtnText:         { fontSize: 12, fontWeight: '700', color: Colors.primary },
  votedConfirm:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  votedConfirmText:    { fontSize: 12, color: Colors.success, fontWeight: '600' },
  impactGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  impactCard:          { width: '47%', backgroundColor: '#fff', borderRadius: Radius.xl, padding: 16, alignItems: 'center', ...Shadow.sm },
  impactValue:         { fontSize: 22, fontWeight: '900' },
  impactLabel:         { fontSize: 10, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4, textAlign: 'center' },
});