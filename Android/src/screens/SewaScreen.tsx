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

// ── Main Component ────────────────────────────────────────────

export default function SewaScreen({ navigation }: any) {
  const { citizen, myRequests } = useStore();
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Digital Governance</Text>
          <Text style={styles.headerTitle}>Pokhara Sewa Kendra</Text>
        </View>
        <View style={styles.wardChip}>
          <MaterialIcons name="location-on" size={12} color={Colors.onPrimaryFixedVariant} />
          <Text style={styles.wardChipText}>
            Ward {citizen?.ward_code?.split('-')[3] || '9'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >

        {/* ── AI-OCR SIFARIS CARD (PRATIBIMBA Hero) ─────────────── */}
        <TouchableOpacity
          style={styles.pratibimbaCard}
          onPress={() => navigation.navigate('Request')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[Colors.primaryContainer, Colors.primary]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={styles.aiOCRBadge}>
            <MaterialIcons name="auto-awesome" size={12} color="#fff" />
            <Text style={styles.aiOCRBadgeText}>Powered by Pratibimba AI</Text>
          </View>
          <Text style={styles.pratibimbaTitle}>AI-OCR Sifaris</Text>
          <Text style={styles.pratibimbaDesc}>
            Scan your citizenship card. Auto-fill your application. Zero typing.
          </Text>
          <View style={styles.pratibimbaBtn}>
            <MaterialIcons name="photo-camera" size={16} color={Colors.primary} />
            <Text style={styles.pratibimbaBtnText}>Open Camera Scan</Text>
          </View>
        </TouchableOpacity>

        {/* ── LIVE STATUS TRACKER (Real Data from PRATIBIMBA) ─────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Live Status</Text>
            <MaterialIcons name="pending-actions" size={20} color={Colors.secondary} />
          </View>

          {myRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="inbox" size={32} color={Colors.outline} style={{ opacity: 0.4 }} />
              <Text style={styles.emptyText}>No active requests</Text>
            </View>
          ) : (
            <>
              {/* Progress Steps */}
              <View style={styles.statusSteps}>
                {[
                  { label: 'Submitted',    done: true                                           },
                  { label: 'In Review',    done: pendingRequests > 0 || approvedRequests > 0   },
                  { label: 'Ready',        done: approvedRequests > 0                           },
                ].map((step, i) => (
                  <React.Fragment key={step.label}>
                    <View style={styles.statusStep}>
                      <View style={[styles.statusDot, step.done && styles.statusDotDone]}>
                        {step.done && <MaterialIcons name="check" size={12} color="#fff" />}
                        {!step.done && i === 1 && pendingRequests > 0 && (
                          <View style={styles.statusPulse} />
                        )}
                      </View>
                      <Text style={[styles.statusLabel, step.done && styles.statusLabelDone]}>
                        {step.label}
                      </Text>
                    </View>
                    {i < 2 && (
                      <View style={[styles.statusLine, step.done && styles.statusLineDone]} />
                    )}
                  </React.Fragment>
                ))}
              </View>

              {/* Latest request */}
              {myRequests[0] && (
                <View style={styles.latestReq}>
                  <Text style={styles.latestReqType}>{myRequests[0].document_type.replace(/_/g, ' ')}</Text>
                  <Text style={styles.latestReqStatus}>{myRequests[0].status}</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.trackAllBtn}
                onPress={() => navigation.navigate('Track')}
              >
                <Text style={styles.trackAllText}>Track All Applications</Text>
                <MaterialIcons name="arrow-forward" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── TAX PORTAL (Real Data) ─────────────────────────────── */}
        <TouchableOpacity style={styles.taxCard} activeOpacity={0.88}>
          <LinearGradient
            colors={[Colors.secondary, '#8b1a10']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View>
            <Text style={styles.taxTitle}>Tax Portal</Text>
            {outstanding > 0 ? (
              <Text style={styles.taxDesc}>
                Outstanding: Rs. {outstanding.toLocaleString()} due soon
              </Text>
            ) : (
              <Text style={styles.taxDesc}>All taxes paid. ✓</Text>
            )}
          </View>
          <View style={styles.taxBtns}>
            <TouchableOpacity style={styles.taxBtnOutline}>
              <Text style={styles.taxBtnOutlineText}>Details</Text>
            </TouchableOpacity>
            {outstanding > 0 && (
              <TouchableOpacity style={styles.taxBtnFilled}>
                <Text style={styles.taxBtnFilledText}>Pay Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {/* ── MIRROR VAULT (PRATIBIMBA Documents) ────────────────── */}
        <View style={styles.mirrorCard}>
          <View style={styles.mirrorLeft}>
            <Text style={styles.mirrorTitle}>Mirror Vault</Text>
            <Text style={styles.mirrorDesc}>Your PRATIBIMBA-secured document locker</Text>
            <View style={styles.mirrorDocIcons}>
              {['id-card', 'description', 'verified-user'].map((icon, i) => (
                <View key={i} style={[styles.mirrorDocIcon, { marginLeft: i > 0 ? -8 : 0 }]}>
                  <MaterialIcons name={icon as any} size={12} color={Colors.primary} />
                </View>
              ))}
              {ledgerDocs.length > 0 && (
                <Text style={styles.mirrorDocCount}>{ledgerDocs.length} documents</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.mirrorQR}
            onPress={() => navigation.navigate('Verify')}
          >
            <MaterialIcons name="qr-code-2" size={48} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── SMALL UTILITY CARDS ROW ────────────────────────────── */}
        <View style={styles.utilRow}>
          {/* Water & Electricity */}
          <View style={[styles.utilCard, { flex: 1 }]}>
            <View style={styles.utilIcon}>
              <MaterialIcons name="water-drop" size={18} color="#1d4ed8" />
            </View>
            <Text style={styles.utilTitle}>Water &amp; Electricity</Text>
            <Text style={styles.utilDesc}>NEA &amp; NWSC integration</Text>
            <TouchableOpacity style={styles.utilBtn}>
              <Text style={styles.utilBtnText}>Manage Bills</Text>
            </TouchableOpacity>
          </View>

          {/* Queue Token */}
          <View style={[styles.utilCard, { flex: 1 }]}>
            <View style={[styles.utilIcon, { backgroundColor: '#fef3c7' }]}>
              <MaterialIcons name="confirmation-number" size={18} color="#92400e" />
            </View>
            <Text style={styles.utilTitle}>Queue Token</Text>
            {activeToken ? (
              <View style={styles.activeToken}>
                <Text style={styles.activeTokenNum}>#{activeToken.token_number}</Text>
                <Text style={styles.activeTokenTime}>
                  {new Date(activeToken.estimated_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ) : (
              <Text style={styles.utilDesc}>Book your spot at Ward office</Text>
            )}
            <TouchableOpacity
              style={[styles.utilBtn, { backgroundColor: Colors.primary }]}
              onPress={() => setShowQueueModal(true)}
            >
              <Text style={[styles.utilBtnText, { color: '#fff' }]}>
                {activeToken ? 'Update' : 'Book Now'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Krisi Anudan */}
          <View style={[styles.utilCard, { flex: 1 }]}>
            <View style={[styles.utilIcon, { backgroundColor: '#dcfce7' }]}>
              <MaterialIcons name="grass" size={18} color="#15803d" />
            </View>
            <Text style={styles.utilTitle}>Krisi Anudan</Text>
            <Text style={styles.utilDesc}>Seed &amp; fertilizer subsidies</Text>
            <TouchableOpacity style={styles.utilBtn}>
              <Text style={styles.utilBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── REPORT A PROBLEM (Grievance) ───────────────────────── */}
        <TouchableOpacity
          style={styles.grievanceHero}
          onPress={() => setShowGrievanceModal(true)}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[Colors.primaryContainer, '#0c3550']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={{ position: 'relative', zIndex: 1 }}>
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>Immediate Action</Text>
              <Text style={styles.urgentNum}>311</Text>
            </View>
            <Text style={styles.grievanceTitle}>Report a Problem</Text>
            <Text style={styles.grievanceDesc}>
              Report potholes, broken streetlights, or water leakage instantly with GPS auto-tag.
            </Text>
            <View style={styles.grievanceBtns}>
              <View style={styles.grievanceBtn}>
                <MaterialIcons name="add-a-photo" size={16} color="#fff" />
                <Text style={styles.grievanceBtnText}>Upload Photo</Text>
              </View>
              <View style={[styles.grievanceBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <MaterialIcons name="my-location" size={16} color="#fff" />
                <Text style={styles.grievanceBtnText}>Auto-tag Location</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* My Grievances */}
        {grievances.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>My Reports</Text>
            {grievances.slice(0, 3).map((g) => (
              <View key={g.grievance_id} style={styles.grievanceItem}>
                <View style={[
                  styles.grievanceItemDot,
                  { backgroundColor: g.status === 'RESOLVED' ? Colors.success : '#b7791f' }
                ]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.grievanceItemTitle}>{g.category.replace(/_/g, ' ')}</Text>
                  <Text style={styles.grievanceItemDesc} numberOfLines={1}>{g.description}</Text>
                </View>
                <Text style={[
                  styles.grievanceItemStatus,
                  { color: g.status === 'RESOLVED' ? Colors.success : '#b7791f' }
                ]}>
                  {g.status}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── SOCIAL SECURITY ─────────────────────────────────────── */}
        <View style={styles.bhattaCard}>
          <View style={styles.bhattaIcon}>
            <MaterialIcons name="family-restroom" size={36} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bhattaTitle}>Social Security &amp; Allowances</Text>
            <Text style={styles.bhattaDesc}>
              Track Briddha Bhatta, Single Mother support, and disability allowances.
              Disbursed on 1st of every month.
            </Text>
          </View>
          <TouchableOpacity style={styles.bhattaBtn}>
            <Text style={styles.bhattaBtnText}>Track My Bhatta</Text>
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
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  headerSub:           { fontSize: 10, fontWeight: '700', color: Colors.primary, opacity: 0.6, letterSpacing: 1.5, textTransform: 'uppercase' },
  headerTitle:         { fontSize: 26, fontWeight: '900', color: Colors.primary, letterSpacing: -0.5 },
  wardChip:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryFixed, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  wardChipText:        { fontSize: 11, fontWeight: '700', color: Colors.onPrimaryFixedVariant },
  scroll:              { padding: 16, gap: 14, paddingBottom: 40 },

  // PRATIBIMBA Card
  pratibimbaCard:      { borderRadius: Radius.xxl, padding: 28, overflow: 'hidden', minHeight: 200, justifyContent: 'space-between', ...Shadow.lg },
  aiOCRBadge:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, alignSelf: 'flex-start', marginBottom: 12 },
  aiOCRBadgeText:      { color: '#fff', fontSize: 11, fontWeight: '700' },
  pratibimbaTitle:     { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 8 },
  pratibimbaDesc:      { fontSize: 13, color: 'rgba(148,197,238,0.85)', lineHeight: 20, marginBottom: 20 },
  pratibimbaBtn:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14, borderRadius: Radius.full, alignSelf: 'flex-start' },
  pratibimbaBtnText:   { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  // Generic Card
  card:                { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 20, ...Shadow.sm },
  cardHeader:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardTitle:           { fontSize: 16, fontWeight: '700', color: Colors.primary },
  emptyState:          { alignItems: 'center', padding: 24, gap: 8 },
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