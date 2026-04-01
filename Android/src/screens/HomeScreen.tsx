import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, TextInput, RefreshControl, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { statsAPI } from '../api/client';

const SERVICES = [
  { icon: 'receipt-long', label: 'Pay Tax',    screen: 'Request' },
  { icon: 'water-drop',   label: 'Water Bill', screen: 'Request' },
  { icon: 'bolt',         label: 'NEA Pay',    screen: 'Request' },
  { icon: 'description',  label: 'Sifarish',   screen: 'Request' },
];

const NOTICES = ['Urgent', 'Infrastructure', 'Health', 'Culture', 'Tourism'];

const NEWS_ITEMS = [
  {
    title: 'Pokhara Regional Airport initiates full night-landing capability operations.',
    tag: 'Tourism & Dev',
    time: 'LATEST',
    image:
      'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=900&q=80',
    summary: 'CAAN confirmed technical evaluations for IFR operations are complete and active.',
  },
  {
    title: 'Lakeside Organic Market to host Weekend Harvest Festival.',
    time: '2 HOURS AGO',
    image:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Gandaki Province allocates funds for New Cricket Stadium.',
    time: '5 HOURS AGO',
    image:
      'https://images.unsplash.com/photo-1593766788306-28561086694e?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Digital permit queue reduced in Ward 17 after system rollout.',
    time: '8 HOURS AGO',
    image:
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Tourism board opens sunrise shuttle route around Phewa circuit.',
    time: '1 DAY AGO',
    image:
      'https://images.unsplash.com/photo-1518391846015-55a9cc003b25?auto=format&fit=crop&w=600&q=80',
  },
];

export default function HomeScreen({ navigation }: any) {
  const { citizen } = useStore();
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const loadStats = async () => {
    try {
      const res = await statsAPI.getStats();
      if (res.success) setStats(res.stats);
    } catch (e) {
      // Demo mode — no server needed for home screen
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  useEffect(() => { loadStats(); }, []);

  return (
    <SafeAreaView style={styles.container}>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <TouchableOpacity style={styles.menuBtn}>
            <MaterialIcons name="menu" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.appName}>Hamro Pokhara</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <MaterialIcons name="notifications-none" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Welcome */}
        <View style={styles.welcome}>
          <Text style={styles.dateText}>{today}</Text>
          <Text style={styles.greetText}>Namaste, Pokhara</Text>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={22} color={Colors.primary} style={{ opacity: 0.6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="What do you need today?"
            placeholderTextColor={Colors.outline}
          />
          <TouchableOpacity style={styles.micBtn}>
            <MaterialIcons name="mic" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Notices horizontal scroll */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Suchana <Text style={styles.sectionSub}>/ Notices</Text></Text>
          <TouchableOpacity><Text style={styles.viewAll}>View All</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.noticesRow}>
          {NOTICES.map((n, i) => (
            <TouchableOpacity key={n} style={styles.noticeItem}>
              <View style={[styles.noticeCircle, i === 0 && styles.noticeCircleUrgent]}>
                <View style={styles.noticeInner}>
                  <MaterialIcons
                    name={i === 0 ? 'campaign' : i === 1 ? 'construction' : i === 2 ? 'local-hospital' : i === 3 ? 'celebration' : 'landscape'}
                    size={24}
                    color={i === 0 ? Colors.secondary : Colors.primary}
                  />
                </View>
              </View>
              <Text style={[styles.noticeLabel, i === 0 && styles.noticeLabelUrgent]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Weather + Ward bento */}
        <View style={styles.bentoRow}>
          {/* Weather */}
          <View style={styles.weatherCard}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryContainer]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />
            <View style={styles.weatherBadge}>
              <Text style={styles.weatherBadgeText}>Atmosphere Today</Text>
            </View>
            <View style={styles.weatherMain}>
              <MaterialIcons name="wb-sunny" size={44} color="#fff" />
              <View>
                <Text style={styles.tempText}>24°C</Text>
                <Text style={styles.condText}>Mostly Sunny · Pokhara-6</Text>
              </View>
              <View style={styles.aqiBox}>
                <Text style={styles.aqiLabel}>AQI Index</Text>
                <Text style={styles.aqiNum}>42</Text>
                <Text style={styles.aqiState}>Excellent</Text>
              </View>
            </View>
            <View style={styles.weatherStats}>
              <View style={styles.weatherStat}>
                <Text style={styles.weatherStatLabel}>Humidity</Text>
                <Text style={styles.weatherStatVal}>62%</Text>
              </View>
              <View style={styles.weatherStat}>
                <Text style={styles.weatherStatLabel}>UV Index</Text>
                <Text style={styles.weatherStatVal}>Low</Text>
              </View>
              <View style={styles.weatherStat}>
                <Text style={styles.weatherStatLabel}>Visibility</Text>
                <Text style={styles.weatherStatVal}>10km</Text>
              </View>
            </View>
          </View>

          {/* Ward Card */}
          <View style={styles.wardCard}>
            <View style={styles.wardTop}>
              <View style={styles.wardIcon}>
                <MaterialIcons name="location-on" size={22} color={Colors.primary} />
              </View>
              <View style={styles.wardBadge}>
                <Text style={styles.wardBadgeText}>Ward 09</Text>
              </View>
            </View>
            <Text style={styles.wardTitle}>Ward Presence</Text>
            <Text style={styles.wardDesc}>Your local representatives are active. Check ward progress.</Text>
            <TouchableOpacity style={styles.wardBtn}>
              <Text style={styles.wardBtnText}>Open Ward Map</Text>
              <MaterialIcons name="arrow-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Pokhara Samachar */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pokhara Samachar <Text style={styles.sectionSub}>/ Top 5</Text></Text>
          <TouchableOpacity><Text style={styles.viewAll}>Digital Edition</Text></TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.92} style={styles.heroNewsCard}>
          <Image source={{ uri: NEWS_ITEMS[0].image }} style={styles.heroNewsImage} />
          <View style={styles.heroNewsOverlay}>
            <View style={styles.heroTagWrap}>
              <Text style={styles.heroTag}>{NEWS_ITEMS[0].tag}</Text>
              <Text style={styles.heroLatest}>{NEWS_ITEMS[0].time}</Text>
            </View>
            <Text style={styles.heroNewsTitle}>{NEWS_ITEMS[0].title}</Text>
            <Text style={styles.heroNewsSummary}>{NEWS_ITEMS[0].summary}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.newsGrid}>
          {NEWS_ITEMS.slice(1).map((item) => (
            <TouchableOpacity key={item.title} activeOpacity={0.9} style={styles.newsItemCard}>
              <Image source={{ uri: item.image }} style={styles.newsThumb} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={styles.newsItemTitle}>{item.title}</Text>
                <Text style={styles.newsItemTime}>{item.time}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* E-Sewa Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>E-Sewa <Text style={styles.sectionSub}>/ Direct</Text></Text>
        </View>
        <View style={styles.servicesGrid}>
          {SERVICES.map((s) => (
            <TouchableOpacity
              key={s.label}
              style={styles.serviceCard}
              onPress={() => navigation.navigate(s.screen)}
              activeOpacity={0.8}
            >
              <MaterialIcons name={s.icon as any} size={28} color={Colors.primary} />
              <Text style={styles.serviceLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Digital Citizen Card */}
        <View style={styles.digitalCard}>
          <View style={styles.digitalTop}>
            <MaterialIcons name="verified" size={20} color={Colors.goldLight} />
            <Text style={styles.digitalLabel}>Digital Citizen Card</Text>
          </View>
          <Text style={styles.digitalDesc}>
            Your virtual identity card for quick verification at ward offices.
          </Text>
          <TouchableOpacity
            style={styles.qrBtn}
            onPress={() => navigation.navigate('Verify')}
          >
            <MaterialIcons name="qr-code" size={16} color="#fff" />
            <Text style={styles.qrBtnText}>Show QR Code</Text>
          </TouchableOpacity>
        </View>

        {/* PRATIBIMBA Stats */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>🔒 PRATIBIMBA Live</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.total_documents?.toLocaleString() || '—'}</Text>
                <Text style={styles.statLbl}>Documents</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.issued_today || '—'}</Text>
                <Text style={styles.statLbl}>Today</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: Colors.success }]}>
                  {stats.tampered_alerts === 0 ? '✓' : '⚠'}
                </Text>
                <Text style={styles.statLbl}>Integrity</Text>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Emergency FAB */}
      <TouchableOpacity style={styles.fab}>
        <MaterialIcons name="sos" size={22} color="#fff" />
        <Text style={styles.fabText}>Emergency</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: 'rgba(247,250,249,0.96)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,59,90,0.06)',
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuBtn: { padding: 6, borderRadius: Radius.full, marginLeft: -2 },
  appName: { fontSize: 18, fontWeight: '900', color: Colors.primary, letterSpacing: -0.3 },
  notifBtn: { padding: 6, borderRadius: Radius.full, marginRight: -2 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 130 },
  welcome: { marginBottom: 14 },
  dateText: { fontSize: 11, color: Colors.onSurfaceVariant, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  greetText: { fontSize: 30, fontWeight: '900', color: Colors.primary, letterSpacing: -0.8, marginTop: 2 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full, paddingHorizontal: 18,
    paddingVertical: 4, marginBottom: 18, ...Shadow.sm,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.onSurface, paddingVertical: 12 },
  micBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  sectionSub: { fontWeight: '400', color: Colors.outline },
  viewAll: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  noticesRow: { gap: 14, paddingRight: 12, paddingBottom: 8, marginBottom: 14 },
  noticeItem: { alignItems: 'center', gap: 6, width: 72 },
  noticeCircle: {
    width: 72, height: 72, borderRadius: 36, padding: 3,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  noticeCircleUrgent: {
    backgroundColor: Colors.secondary,
  },
  noticeInner: {
    flex: 1, borderRadius: 32, backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: Colors.surface,
  },
  noticeLabel: { fontSize: 10, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  noticeLabelUrgent: { color: Colors.secondary },
  bentoRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  weatherCard: { flex: 1.35, borderRadius: Radius.xl, padding: 18, overflow: 'hidden', ...Shadow.md },
  weatherBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,59,90,0.35)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  weatherBadgeText: { color: 'rgba(255,255,255,0.85)', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  weatherMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  tempText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  condText: { fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  aqiBox: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: Radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'flex-end',
  },
  aqiLabel: { fontSize: 9, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', fontWeight: '700' },
  aqiNum: { fontSize: 20, color: Colors.primaryFixedDim, fontWeight: '900' },
  aqiState: { fontSize: 10, color: '#7CE2A7', fontWeight: '700' },
  weatherStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  weatherStat: { flex: 1, alignItems: 'center' },
  weatherStatLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  weatherStatVal: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 },
  wardCard: {
    flex: 1, borderRadius: Radius.xl, padding: 16,
    backgroundColor: Colors.surfaceContainerLowest, ...Shadow.sm,
  },
  wardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  wardIcon: {
    width: 44, height: 44, borderRadius: Radius.lg,
    backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center',
  },
  wardBadge: {
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
  },
  wardBadgeText: { color: Colors.onPrimaryFixedVariant, fontSize: 10, fontWeight: '700' },
  wardTitle: { fontSize: 16, fontWeight: '800', color: Colors.primary, marginBottom: 6 },
  wardDesc: { fontSize: 11, color: Colors.onSurfaceVariant, lineHeight: 16, marginBottom: 12 },
  wardBtn: {
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: Radius.lg,
    paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  wardBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  heroNewsCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    minHeight: 200,
    marginBottom: 10,
    ...Shadow.sm,
  },
  heroNewsImage: { width: '100%', height: 200 },
  heroNewsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.40)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  heroTagWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  heroTag: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroLatest: {
    backgroundColor: Colors.secondary,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.md,
  },
  heroNewsTitle: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 22 },
  heroNewsSummary: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 6, lineHeight: 17 },
  newsGrid: { gap: 10, marginBottom: 14 },
  newsItemCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  newsThumb: { width: 58, height: 58, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerHigh },
  newsItemTitle: { fontSize: 12, fontWeight: '700', color: Colors.primary, lineHeight: 17 },
  newsItemTime: { fontSize: 10, color: Colors.onSurfaceVariant, marginTop: 4, letterSpacing: 0.5 },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  serviceCard: {
    width: '48.5%', height: 140,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.surfaceContainer, ...Shadow.sm,
  },
  serviceLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: Colors.onSurface },
  digitalCard: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: 18, marginBottom: 12,
  },
  digitalTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  digitalLabel: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 1, textTransform: 'uppercase' },
  digitalDesc: { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 18, marginBottom: 14 },
  qrBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.lg,
    paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  qrBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  statsCard: {
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl,
    padding: 18, borderWidth: 1, borderColor: Colors.successLight, marginBottom: 8,
  },
  statsTitle: { fontSize: 13, fontWeight: '700', color: Colors.success, marginBottom: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  statLbl: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
  fab: {
    position: 'absolute', bottom: 104, right: 18,
    backgroundColor: Colors.secondary,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: Radius.full, ...Shadow.lg,
  },
  fabText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});