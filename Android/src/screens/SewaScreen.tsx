import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, RefreshControl,
  ActivityIndicator, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { citizenAPI } from '../api/client';
import AppHeader from '../components/AppHeader';

// ── Types ─────────────────────────────────────────────────────

interface TaxRecord {
  id: number;
  tax_year: number;
  total_amount: number;
  paid_amount: number;
  due_date: string;
  status: 'PAID' | 'UNPAID' | 'OVERDUE' | 'PARTIAL';
}

interface QueueToken {
  token_id: string;
  token_number: number;
  estimated_time: string;
  message: string;
}

// ── Grievance Categories ──────────────────────────────────────

const GRIEVANCE_CATS = [
  { id: 'POTHOLE',      label: 'Pothole',      labelNE: 'खाल्डो',      icon: 'warning'           },
  { id: 'STREETLIGHT',  label: 'Streetlight',  labelNE: 'बत्ती',       icon: 'lightbulb'         },
  { id: 'WATER_LEAK',   label: 'Water Leak',   labelNE: 'पानी चुहावट', icon: 'water-drop'        },
  { id: 'GARBAGE',      label: 'Garbage',      labelNE: 'फोहोर',       icon: 'delete'            },
  { id: 'SEWAGE',       label: 'Sewage',       labelNE: 'ढल',          icon: 'plumbing'          },
  { id: 'OTHER',        label: 'Other',        labelNE: 'अन्य',        icon: 'more-horiz'        },
];

const NAGARIK_SEWAS = [
  { id: 'ai', icon: 'smart-toy', label: 'AI Assistant', labelNE: 'AI सहायक' },
  { id: 'grievance', icon: 'report-problem', label: 'Report 311', labelNE: '311 रिपोर्ट' },
  { id: 'hearing', icon: 'how-to-vote', label: 'Public Hearing', labelNE: 'सार्वजनिक सुनुवाई' },
  { id: 'tax', icon: 'payments', label: 'Tax & Fines', labelNE: 'कर र जरिमाना' },
  { id: 'krishi', icon: 'eco', label: 'Krishi Anudan', labelNE: 'कृषि अनुदान' },
  { id: 'bhatta', icon: 'elderly', label: 'Briddha Bhatta', labelNE: 'बृद्धभत्ता' },
  { id: 'blood', icon: 'bloodtype', label: 'Blood Connect', labelNE: 'रक्त दान' },
  { id: 'tourism', icon: 'landscape', label: 'Tourism Guide', labelNE: 'पर्यटन गाइड' },
  { id: 'lost', icon: 'search', label: 'Lost & Found', labelNE: 'हराएको/भेटिएको' },
  { id: 'volunteer', icon: 'volunteer-activism', label: 'Volunteer', labelNE: 'स्वयंसेवक' },
  { id: 'digsig', icon: 'draw', label: 'Digital Sign', labelNE: 'डिजिटल हस्ताक्षर' },
  { id: 'feedback', icon: 'star', label: 'Rate Officer', labelNE: 'अधिकारी मूल्यांकन' },
];

const SERVICE_ACCENTS: Record<string, { bg: string; chip: string; icon: string; text: string }> = {
  ai:        { bg: '#EEF2FF', chip: '#E0E7FF', icon: '#4F46E5', text: '#312E81' },
  grievance: { bg: '#FFF1F2', chip: '#FFE4E6', icon: '#BE123C', text: '#9F1239' },
  hearing:   { bg: '#EFF6FF', chip: '#DBEAFE', icon: '#2563EB', text: '#1D4ED8' },
  tax:       { bg: '#F0FDF4', chip: '#DCFCE7', icon: '#15803D', text: '#166534' },
  krishi:    { bg: '#F7FEE7', chip: '#ECFCCB', icon: '#65A30D', text: '#3F6212' },
  bhatta:    { bg: '#F0FDFA', chip: '#CCFBF1', icon: '#0F766E', text: '#115E59' },
  blood:     { bg: '#FEF2F2', chip: '#FEE2E2', icon: '#DC2626', text: '#991B1B' },
  tourism:   { bg: '#ECFEFF', chip: '#CFFAFE', icon: '#0891B2', text: '#155E75' },
  lost:      { bg: '#FFF7ED', chip: '#FFEDD5', icon: '#EA580C', text: '#C2410C' },
  volunteer: { bg: '#FAF5FF', chip: '#E9D5FF', icon: '#7C3AED', text: '#6D28D9' },
  digsig:    { bg: '#F8FAFC', chip: '#E2E8F0', icon: '#475569', text: '#334155' },
  feedback:  { bg: '#FFFBEB', chip: '#FEF3C7', icon: '#D97706', text: '#B45309' },
};

const getAccent = (id: string) => SERVICE_ACCENTS[id] || { bg: '#F8FAFC', chip: '#E2E8F0', icon: Colors.primary, text: Colors.primary };

const SERVICE_CATEGORIES = [
  { id: 'citizenship', label: 'Citizenship', icon: 'badge', hint: 'Identity & records', screen: 'Verify' },
  { id: 'permit', label: 'Building Permit', icon: 'domain', hint: 'Plan approval', screen: 'Request' },
  { id: 'land', label: 'Land Deed', icon: 'terrain', hint: 'Ownership docs', screen: 'Request' },
];

const POPULAR_FORMS = [
  { id: 'vital', title: 'Vital Statistics Registration', subtitle: 'Birth, marriage, and death registration', icon: 'groups', screen: 'Request' },
  { id: 'tax', title: 'Tax Clearance Certificate', subtitle: 'Quick payment and clearance flow', icon: 'receipt-long', screen: 'Request' },
  { id: 'sifaris', title: 'Sifarish / Recommendation Letter', subtitle: 'Simple ward-level recommendation', icon: 'description', screen: 'Request' },
];

// ── Main Component ────────────────────────────────────────────

export default function SewaScreen({ navigation }: any) {
  const { citizen, myRequests, language } = useStore();
  const nid      = citizen?.nid || '';
  const wardCode = citizen?.ward_code || 'NPL-04-33-09';

  const [taxRecords, setTaxRecords]       = useState<TaxRecord[]>([]);
  const [grievances, setGrievances]       = useState<any[]>([]);
  const [activeToken, setActiveToken]     = useState<QueueToken | null>(null);
  const [ledgerDocs, setLedgerDocs]       = useState<any[]>([]);
  const [refreshing, setRefreshing]       = useState(false);
  const [loading, setLoading]             = useState(true);

  // Grievance modal state
  const [showGrievanceModal, setShowGrievanceModal] = useState(false);
  const [grievanceCategory, setGrievanceCategory]   = useState('POTHOLE');
  const [grievanceDesc, setGrievanceDesc]           = useState('');
  const [grievanceLocDesc, setGrievanceLocDesc]     = useState('');
  const [submittingGrievance, setSubmittingGrievance] = useState(false);

  // Queue modal state
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [queueService, setQueueService]     = useState('SIFARIS');
  const [bookingQueue, setBookingQueue]     = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSewas = NAGARIK_SEWAS.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return `${item.label} ${item.labelNE}`.toLowerCase().includes(q);
  });

  const getService = (id: string) => NAGARIK_SEWAS.find((item) => item.id === id);

  const featuredIds = ['ai', 'grievance', 'hearing', 'tax'];
  const rowOneIds = ['krishi', 'bhatta', 'blood', 'tourism'];
  const rowTwoIds = ['lost', 'volunteer', 'digsig', 'feedback'];

  const featuredServices = featuredIds.map(getService).filter(Boolean) as typeof NAGARIK_SEWAS;
  const rowOneServices = rowOneIds.map(getService).filter(Boolean) as typeof NAGARIK_SEWAS;
  const rowTwoServices = rowTwoIds.map(getService).filter(Boolean) as typeof NAGARIK_SEWAS;

  const isVisible = (id: string) => !searchQuery.trim() || `${getService(id)?.label || ''} ${getService(id)?.labelNE || ''}`.toLowerCase().includes(searchQuery.trim().toLowerCase());

  const handleOpenNagarikSewa = (id: string) => {
    if (id === 'ai') {
      navigation.navigate('Assistant');
      return;
    }
    if (id === 'grievance') {
      setShowGrievanceModal(true);
      return;
    }
    if (id === 'tax') {
      navigation.navigate('Request');
      return;
    }
    if (id === 'tourism') {
      navigation.navigate('Request');
      return;
    }

    Toast.show({
      type: 'info',
      text1: language === 'ne' ? 'छिट्टै आउँदैछ' : 'Coming soon',
      text2: language === 'ne' ? 'यो सेवा अहिले विकासमा छ।' : 'This service is under active development.',
    });
  };

  // ── Load all data ───────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!nid) return;
    try {
      const [taxRes, grievRes, docRes] = await Promise.allSettled([
        citizenAPI.getTaxRecords(nid),
        citizenAPI.getGrievances(nid),
        citizenAPI.getDocuments(nid),
      ]);

      if (taxRes.status === 'fulfilled' && taxRes.value.success) {
        setTaxRecords(taxRes.value.records || []);
      } else {
        // Demo fallback
        setTaxRecords([
          { id: 1, tax_year: 2082, total_amount: 8500, paid_amount: 0, due_date: '2082-09-30', status: 'UNPAID' },
          { id: 2, tax_year: 2081, total_amount: 8200, paid_amount: 8200, due_date: '2081-09-30', status: 'PAID' },
        ]);
      }

      if (grievRes.status === 'fulfilled' && grievRes.value.success) {
        setGrievances(grievRes.value.grievances || []);
      }

      if (docRes.status === 'fulfilled' && docRes.value.success) {
        setLedgerDocs(docRes.value.documents || []);
      }
    } catch (e) {
      console.error('Sewa load error:', e);
    } finally {
      setLoading(false);
    }
  }, [nid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // ── Submit Grievance ─────────────────────────────────────────
  const submitGrievance = async () => {
    if (!grievanceDesc.trim()) {
      Toast.show({ type: 'error', text1: 'Description required' });
      return;
    }
    setSubmittingGrievance(true);
    try {
      let lat = 0, lng = 0;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const res = await citizenAPI.submitGrievance({
        citizen_nid:   nid,
        citizen_name:  citizen?.name || 'Citizen',
        ward_code:     wardCode,
        category:      grievanceCategory,
        description:   grievanceDesc.trim(),
        location_lat:  lat,
        location_lng:  lng,
        location_desc: grievanceLocDesc.trim(),
      });

      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Grievance Reported!',
          text2: `ID: ${res.grievance_id}. Ward office notified.`,
        });
        setShowGrievanceModal(false);
        setGrievanceDesc('');
        setGrievanceLocDesc('');
        await loadAll();
      } else {
        Toast.show({ type: 'error', text1: res.message || 'Failed to submit' });
      }
    } catch (e) {
      Toast.show({ type: 'success', text1: 'Grievance Reported (Demo)', text2: 'Ward office will be notified' });
      setShowGrievanceModal(false);
    } finally {
      setSubmittingGrievance(false);
    }
  };

  // ── Book Queue ────────────────────────────────────────────────
  const bookQueue = async () => {
    setBookingQueue(true);
    try {
      const res = await citizenAPI.bookQueue({
        citizen_nid:  nid,
        ward_code:    wardCode,
        service_type: queueService,
      });

      if (res.success) {
        setActiveToken(res);
        Toast.show({
          type: 'success',
          text1: `Token #${res.token_number} Booked!`,
          text2: res.message,
        });
        setShowQueueModal(false);
      }
    } catch (e) {
      const demoToken = {
        token_id:       `TKN-DEMO-${Date.now()}`,
        token_number:   Math.floor(Math.random() * 20) + 1,
        estimated_time: new Date(Date.now() + 45 * 60000).toISOString(),
        message:        'Estimated wait: 45 minutes',
      };
      setActiveToken(demoToken);
      setShowQueueModal(false);
      Toast.show({ type: 'success', text1: `Token #${demoToken.token_number} Booked (Demo)` });
    } finally {
      setBookingQueue(false);
    }
  };

  // ── Tax Status helpers ────────────────────────────────────────
  const currentTax = taxRecords.find(r => r.tax_year === 2082);
  const outstanding = taxRecords
    .filter(r => r.status !== 'PAID')
    .reduce((sum, r) => sum + (r.total_amount - r.paid_amount), 0);

  // ── Live Request count from PRATIBIMBA ────────────────────────
  const pendingRequests = myRequests.filter(r =>
    r.status === 'PENDING' || r.status === 'UNDER_REVIEW'
  ).length;
  const approvedRequests = myRequests.filter(r => r.status === 'APPROVED').length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.onSurfaceVariant, marginTop: 12, fontSize: 13 }}>
            Loading Sewa data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Pokhara Metro"
        showMenu={false}
        showNotif
        showLang={false}
        leftContent={(
          <View style={styles.headerLogo}>
            <MaterialIcons name="location-city" size={18} color={Colors.primary} />
          </View>
        )}
        onNotif={() => Toast.show({ type: 'info', text1: 'No new notifications' })}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <MaterialIcons name="apps" size={14} color={Colors.primary} />
              <Text style={styles.heroBadgeText}>{language === 'ne' ? 'सरल पहुँच' : 'Simple access'}</Text>
            </View>
            <View style={styles.heroWardPill}>
              <MaterialIcons name="location-on" size={12} color={Colors.onPrimaryFixedVariant} />
              <Text style={styles.heroWardText}>Ward {wardCode.split('-')[3] || '9'}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Core Services</Text>
          <Text style={styles.heroSubtitle}>Official Sifaris Portal for Citizens</Text>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={18} color={Colors.outline} />
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'ne' ? 'सेवा खोज्नुहोस्...' : "Search for 'Sifaris' forms..."}
              placeholderTextColor={Colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {!!searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={18} color={Colors.outline} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.aiStrip} onPress={() => navigation.navigate('Request')} activeOpacity={0.9}>
            <View style={styles.aiStripIcon}>
              <MaterialIcons name="document-scanner" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiStripTitle}>AI-OCR Sifaris</Text>
              <Text style={styles.aiStripDesc}>Scan physical documents to pre-fill forms</Text>
            </View>
            <View style={styles.aiStripBtn}>
              <Text style={styles.aiStripBtnText}>Launch Camera</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Request')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.categoryRow}>
          {SERVICE_CATEGORIES.map((item) => (
            <TouchableOpacity key={item.id} style={styles.categoryCard} activeOpacity={0.86} onPress={() => navigation.navigate(item.screen)}>
              <View style={styles.categoryIconWrap}>
                <MaterialIcons name={item.icon as any} size={20} color={Colors.primary} />
              </View>
              <Text style={styles.categoryLabel}>{item.label}</Text>
              <Text style={styles.categoryHint}>{item.hint}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Sifaris Forms</Text>
        </View>
        <View style={styles.formsList}>
          {POPULAR_FORMS.filter((item) => !searchQuery || `${item.title} ${item.subtitle}`.toLowerCase().includes(searchQuery.toLowerCase())).map((item, index) => (
            <TouchableOpacity key={item.id} style={[styles.formCard, index === 0 && styles.formCardFeatured]} activeOpacity={0.9} onPress={() => navigation.navigate(item.screen)}>
              <View style={styles.formIconWrap}>
                <MaterialIcons name={item.icon as any} size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formTitle}>{item.title}</Text>
                <Text style={styles.formSubtitle}>{item.subtitle}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.minimalStatusRow}>
          <TouchableOpacity style={styles.statusMiniCard} onPress={() => navigation.navigate('Track')} activeOpacity={0.9}>
            <Text style={styles.statusMiniValue}>{myRequests.length}</Text>
            <Text style={styles.statusMiniLabel}>My Requests</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statusMiniCard} onPress={() => navigation.navigate('Verify')} activeOpacity={0.9}>
            <Text style={styles.statusMiniValue}>{ledgerDocs.length}</Text>
            <Text style={styles.statusMiniLabel}>Documents</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statusMiniCard} onPress={() => navigation.navigate('Request')} activeOpacity={0.9}>
            <Text style={styles.statusMiniValue}>{outstanding > 0 ? 'Pay' : 'OK'}</Text>
            <Text style={styles.statusMiniLabel}>{outstanding > 0 ? 'Due Tax' : 'Tax Clear'}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── GRIEVANCE MODAL ──────────────────────────────────────── */}
      <Modal
        visible={showGrievanceModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowGrievanceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalSheet}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Report a Problem</Text>

            {/* Category */}
            <Text style={styles.modalLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {GRIEVANCE_CATS.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, grievanceCategory === cat.id && styles.catChipActive]}
                  onPress={() => setGrievanceCategory(cat.id)}
                >
                  <MaterialIcons
                    name={cat.icon as any}
                    size={14}
                    color={grievanceCategory === cat.id ? '#fff' : Colors.primary}
                  />
                  <Text style={[styles.catChipText, grievanceCategory === cat.id && { color: '#fff' }]}>
                    {cat.labelNE}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Description */}
            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={styles.modalTextArea}
              placeholder="Describe the problem in detail..."
              placeholderTextColor={Colors.outline}
              value={grievanceDesc}
              onChangeText={setGrievanceDesc}
              multiline
              numberOfLines={3}
            />

            {/* Location */}
            <Text style={styles.modalLabel}>Location Description</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Near Ward 9 office, main road"
              placeholderTextColor={Colors.outline}
              value={grievanceLocDesc}
              onChangeText={setGrievanceLocDesc}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowGrievanceModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, submittingGrievance && { opacity: 0.7 }]}
                onPress={submitGrievance}
                disabled={submittingGrievance}
              >
                {submittingGrievance
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalSubmitText}>Submit Report</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── QUEUE MODAL ──────────────────────────────────────────── */}
      <Modal
        visible={showQueueModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowQueueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Book Queue Token</Text>
            <Text style={styles.modalSubtitle}>Ward {citizen?.ward_code?.split('-')[3] || '9'} Office</Text>

            <Text style={styles.modalLabel}>Service Type</Text>
            {['SIFARIS', 'TAX_CLEARANCE', 'BIRTH_CERTIFICATE', 'GENERAL_INQUIRY'].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.serviceOption, queueService === s && styles.serviceOptionActive]}
                onPress={() => setQueueService(s)}
              >
                <Text style={[styles.serviceOptionText, queueService === s && { color: '#fff' }]}>
                  {s.replace(/_/g, ' ')}
                </Text>
                {queueService === s && <MaterialIcons name="check" size={16} color="#fff" />}
              </TouchableOpacity>
            ))}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowQueueModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, bookingQueue && { opacity: 0.7 }]}
                onPress={bookQueue}
                disabled={bookingQueue}
              >
                {bookingQueue
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalSubmitText}>Book Token</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: Colors.background },
  scroll:              { padding: 16, gap: 14, paddingBottom: 40 },

  headerLogo:          { width: 34, height: 34, borderRadius: Radius.full, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },

  heroCard:            { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 16, borderWidth: 1, borderColor: Colors.outlineVariant, ...Shadow.sm },
  heroTopRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 },
  heroBadge:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryFixed, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 1 },
  heroBadgeText:       { fontSize: 11, fontWeight: '700', color: Colors.primary },
  heroWardPill:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryFixed, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  heroWardText:        { fontSize: 11, fontWeight: '700', color: Colors.onPrimaryFixedVariant },
  heroTitle:           { fontSize: 22, fontWeight: '900', color: Colors.primary, letterSpacing: -0.3 },
  heroSubtitle:        { fontSize: 12, color: Colors.onSurfaceVariant, lineHeight: 18, marginTop: 4 },
  searchBar:           { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.outlineVariant },
  searchInput:         { flex: 1, fontSize: 14, color: Colors.onSurface },
  aiStrip:             { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.lg, padding: 12, borderWidth: 1, borderColor: Colors.outlineVariant },
  aiStripIcon:         { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  aiStripTitle:        { fontSize: 14, fontWeight: '900', color: Colors.primary },
  aiStripDesc:         { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2, lineHeight: 15 },
  aiStripBtn:          { backgroundColor: '#fff', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.outlineVariant },
  aiStripBtnText:      { fontSize: 11, fontWeight: '800', color: Colors.primary },

  sectionHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle:        { fontSize: 16, fontWeight: '800', color: Colors.primary },
  viewAll:             { fontSize: 12, fontWeight: '700', color: Colors.primary },

  categoryRow:         { flexDirection: 'row', gap: 10 },
  categoryCard:        { flex: 1, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 12, borderWidth: 1, borderColor: Colors.outlineVariant, alignItems: 'center', minHeight: 110, justifyContent: 'center', ...Shadow.sm },
  categoryIconWrap:    { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  categoryLabel:       { fontSize: 11, fontWeight: '800', color: Colors.primary, textAlign: 'center' },
  categoryHint:        { fontSize: 10, color: Colors.onSurfaceVariant, textAlign: 'center', marginTop: 4, lineHeight: 14 },

  formsList:           { gap: 10 },
  formCard:            { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 14, borderWidth: 1, borderColor: Colors.outlineVariant, ...Shadow.sm },
  formCardFeatured:    { borderColor: Colors.primaryFixed, backgroundColor: Colors.primaryContainer },
  formIconWrap:        { width: 36, height: 36, borderRadius: Radius.full, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  formTitle:           { fontSize: 13, fontWeight: '800', color: Colors.primary, lineHeight: 18 },
  formSubtitle:        { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2, lineHeight: 15 },

  minimalStatusRow:    { flexDirection: 'row', gap: 10 },
  statusMiniCard:      { flex: 1, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.outlineVariant, ...Shadow.sm },
  statusMiniValue:     { fontSize: 20, fontWeight: '900', color: Colors.primary },
  statusMiniLabel:     { fontSize: 11, fontWeight: '700', color: Colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' },

  // PRATIBIMBA Card
  pratibimbaCard:      { borderRadius: Radius.xxl, padding: 22, overflow: 'hidden', minHeight: 188, justifyContent: 'space-between', ...Shadow.lg },
  aiOCRBadge:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, alignSelf: 'flex-start', marginBottom: 12 },
  aiOCRBadgeText:      { color: '#fff', fontSize: 11, fontWeight: '700' },
  pratibimbaTitle:     { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 8 },
  pratibimbaDesc:      { fontSize: 13, color: 'rgba(148,197,238,0.85)', lineHeight: 20, marginBottom: 20 },
  pratibimbaBtn:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14, borderRadius: Radius.full, alignSelf: 'flex-start' },
  pratibimbaBtnText:   { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  // Generic Card
  card:                { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 18, borderWidth: 1, borderColor: Colors.outlineVariant, ...Shadow.sm },
  cardHeader:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle:           { fontSize: 16, fontWeight: '700', color: Colors.primary },
  featuredGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  featuredTile:        { width: '48.5%', backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, padding: 14, borderWidth: 1, borderColor: Colors.outlineVariant, minHeight: 118, justifyContent: 'space-between' },
  featuredIconRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredIconWrap:    { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  featuredTileText:    { fontSize: 13, fontWeight: '800', color: Colors.primary, lineHeight: 18, marginTop: 10 },
  featuredTileSub:     { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 6 },
  sectionSubhead:      { fontSize: 12, color: Colors.onSurfaceVariant, fontWeight: '700', marginTop: 6, marginBottom: 10 },
  compactRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  compactTile:         { width: '23.5%', backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.outlineVariant, minHeight: 92 },
  compactTileIcon:     { width: 32, height: 32, borderRadius: Radius.full, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  compactTileText:     { fontSize: 11, fontWeight: '700', color: Colors.primary, textAlign: 'center', lineHeight: 15 },
  emptyState:          { alignItems: 'center', padding: 18, gap: 8 },
  emptyText:           { fontSize: 13, color: Colors.onSurfaceVariant },

  // Status Steps
  statusSteps:         { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  statusStep:          { alignItems: 'center', gap: 4 },
  statusDot:           { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  statusDotDone:       { backgroundColor: Colors.primary },
  statusPulse:         { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  statusLabel:         { fontSize: 10, color: Colors.outline, fontWeight: '600' },
  statusLabelDone:     { color: Colors.primary },
  statusLine:          { flex: 1, height: 2, backgroundColor: Colors.outlineVariant, marginBottom: 20 },
  statusLineDone:      { backgroundColor: Colors.primary },
  latestReq:           { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.surfaceContainerLow, padding: 12, borderRadius: Radius.lg, marginBottom: 12 },
  latestReqType:       { fontSize: 12, fontWeight: '600', color: Colors.primary },
  latestReqStatus:     { fontSize: 11, color: Colors.onSurfaceVariant },
  trackAllBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.outlineVariant },
  trackAllText:        { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Tax Card
  taxCard:             { borderRadius: Radius.xl, padding: 24, overflow: 'hidden', ...Shadow.md },
  taxTitle:            { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  taxDesc:             { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 16 },
  taxBtns:             { flexDirection: 'row', gap: 10 },
  taxBtnOutline:       { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  taxBtnOutlineText:   { color: '#fff', fontSize: 12, fontWeight: '700' },
  taxBtnFilled:        { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.full },
  taxBtnFilledText:    { color: Colors.secondary, fontSize: 12, fontWeight: '700' },

  // Mirror Vault
  mirrorCard:          { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadow.sm },
  mirrorLeft:          { flex: 1 },
  mirrorTitle:         { fontSize: 20, fontWeight: '800', color: Colors.primary },
  mirrorDesc:          { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 4 },
  mirrorDocIcons:      { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  mirrorDocIcon:       { width: 28, height: 28, borderRadius: 6, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.surfaceContainerLow },
  mirrorDocCount:      { fontSize: 11, color: Colors.primary, fontWeight: '600', marginLeft: 10 },
  mirrorQR:            { backgroundColor: '#fff', padding: 14, borderRadius: Radius.xl, ...Shadow.sm },

  // Util Cards
  utilRow:             { flexDirection: 'row', gap: 10 },
  utilCard:            { backgroundColor: Colors.surfaceContainerHighest, borderRadius: Radius.xl, padding: 14 },
  utilIcon:            { width: 38, height: 38, borderRadius: Radius.lg, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  utilTitle:           { fontSize: 12, fontWeight: '700', color: Colors.primary },
  utilDesc:            { fontSize: 10, color: Colors.onSurfaceVariant, marginTop: 3, marginBottom: 12 },
  utilBtn:             { backgroundColor: '#fff', borderRadius: Radius.lg, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.outlineVariant },
  utilBtnText:         { fontSize: 10, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  activeToken:         { alignItems: 'center', marginBottom: 10 },
  activeTokenNum:      { fontSize: 22, fontWeight: '900', color: Colors.primary },
  activeTokenTime:     { fontSize: 11, color: Colors.onSurfaceVariant },

  // Grievance Hero
  grievanceHero:       { borderRadius: Radius.xxl, padding: 28, overflow: 'hidden', minHeight: 220, ...Shadow.md },
  urgentBadge:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  urgentText:          { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.lg },
  urgentNum:           { fontSize: 40, fontWeight: '900', color: 'rgba(255,255,255,0.2)' },
  grievanceTitle:      { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 8 },
  grievanceDesc:       { fontSize: 13, color: 'rgba(148,197,238,0.8)', lineHeight: 20, marginBottom: 20 },
  grievanceBtns:       { flexDirection: 'row', gap: 10 },
  grievanceBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.secondary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.full },
  grievanceBtnText:    { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Grievance Items
  grievanceItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.outlineVariant },
  grievanceItemDot:    { width: 10, height: 10, borderRadius: 5 },
  grievanceItemTitle:  { fontSize: 13, fontWeight: '600', color: Colors.primary },
  grievanceItemDesc:   { fontSize: 11, color: Colors.onSurfaceVariant },
  grievanceItemStatus: { fontSize: 10, fontWeight: '700' },

  // Bhatta Card
  bhattaCard:          { backgroundColor: 'rgba(26,82,118,0.08)', borderRadius: Radius.xl, padding: 20, flexDirection: 'row', gap: 16, alignItems: 'center', borderWidth: 2, borderColor: 'rgba(0,59,90,0.12)', borderStyle: 'dashed' },
  bhattaIcon:          { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bhattaTitle:         { fontSize: 15, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  bhattaDesc:          { fontSize: 11, color: Colors.onSurfaceVariant, lineHeight: 16 },
  bhattaBtn:           { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full, marginTop: 10 },
  bhattaBtnText:       { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Modal
  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:          { backgroundColor: '#fff', borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: 24, paddingBottom: 40 },
  modalHandle:         { width: 40, height: 4, backgroundColor: Colors.outlineVariant, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle:          { fontSize: 20, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  modalSubtitle:       { fontSize: 13, color: Colors.onSurfaceVariant, marginBottom: 16 },
  modalLabel:          { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  catScroll:           { marginBottom: 8 },
  catChip:             { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow, marginRight: 8, borderWidth: 1, borderColor: Colors.outlineVariant },
  catChipActive:       { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText:         { fontSize: 12, fontWeight: '600', color: Colors.primary },
  modalTextArea:       { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, padding: 14, fontSize: 14, color: Colors.onSurface, minHeight: 80, textAlignVertical: 'top' },
  modalInput:          { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: Colors.onSurface },
  serviceOption:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLow, marginBottom: 8 },
  serviceOptionActive: { backgroundColor: Colors.primary },
  serviceOptionText:   { fontSize: 13, fontWeight: '600', color: Colors.primary },
  modalBtns:           { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel:         { flex: 1, padding: 16, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerLow, alignItems: 'center' },
  modalCancelText:     { fontSize: 14, fontWeight: '600', color: Colors.onSurfaceVariant },
  modalSubmit:         { flex: 2, padding: 16, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center' },
  modalSubmitText:     { fontSize: 14, fontWeight: '700', color: '#fff' },
});