import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, SafeAreaView, Linking,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { citizenAPI, paymentAPI } from '../api/client';
import { PDFPreviewModal } from '../components/PDFPreviewModal';
import { PDFDocumentData } from '../utils/pdfGenerator';
import AppHeader from '../components/AppHeader';

const DOC_TYPES = [
  { value: 'SIFARIS',               label: 'सिफारिस',        icon: 'description' },
  { value: 'TAX_CLEARANCE',         label: 'कर चुक्ता',      icon: 'receipt-long' },
  { value: 'BIRTH_CERTIFICATE',     label: 'जन्मदर्ता',      icon: 'child-care' },
  { value: 'INCOME_PROOF',          label: 'आय प्रमाण',      icon: 'monetization-on' },
  { value: 'RELATIONSHIP_CERT',     label: 'नाता प्रमाण',    icon: 'people' },
  { value: 'BUSINESS_REGISTRATION', label: 'व्यवसाय दर्ता',  icon: 'storefront' },
];

const TOURIST_SERVICES = [
  { value: 'TRAVEL_GUIDE', label: 'Travel Guide', icon: 'map' },
  { value: 'PERMIT_HELP', label: 'Permit Help', icon: 'verified-user' },
  { value: 'TRANSPORT_HELP', label: 'Transport Help', icon: 'directions-bus' },
  { value: 'EMERGENCY_HELP', label: 'Emergency Help', icon: 'sos' },
];

const BILL_SERVICES = [
  { value: 'electricity', label: 'Electricity Bill', icon: 'bolt' },
  { value: 'water', label: 'Water Bill', icon: 'water-drop' },
  { value: 'tax', label: 'Municipal Tax', icon: 'receipt-long' },
];

export default function RequestScreen({ navigation }: any) {
  const { citizen, tourist, isTourist, addRequest } = useStore();
  const [docType, setDocType] = useState('SIFARIS');
  const [touristService, setTouristService] = useState('TRAVEL_GUIDE');
  const [passportNo, setPassportNo] = useState(tourist?.passport_no || '');
  const [fullName, setFullName] = useState(tourist?.name || '');
  const [nationality, setNationality] = useState(tourist?.nationality || '');
  const [visaNo, setVisaNo] = useState('');
  const [stayPlace, setStayPlace] = useState('');
  const [travelDates, setTravelDates] = useState('');
  const [purpose, setPurpose] = useState('');
  const [phone, setPhone] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [pdfData, setPdfData] = useState<PDFDocumentData | null>(null);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const [billService, setBillService] = useState<'electricity' | 'water' | 'tax'>('electricity');
  const [billAccountRef, setBillAccountRef] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billPhone, setBillPhone] = useState('');
  const [payingBill, setPayingBill] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isTourist) {
      setPassportNo(tourist?.passport_no || '');
      setFullName(tourist?.name || '');
      setNationality(tourist?.nationality || '');
    }
  }, [isTourist, tourist]);

  const handleShowPreview = () => {
    if (!purpose.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Purpose Required',
        text2: 'Please describe the purpose of your request',
      });
      return;
    }

    if (!isTourist && !citizen) {
      Toast.show({ type: 'error', text1: 'Not Logged In', text2: 'Please login first' });
      return;
    }

    if (isTourist && (!passportNo.trim() || !fullName.trim() || !nationality.trim())) {
      Toast.show({
        type: 'error',
        text1: 'Tourist Details Required',
        text2: 'Please fill in passport, name, and nationality',
      });
      return;
    }

    // Prepare PDF data
    if (!isTourist && citizen) {
      const activeCitizen = citizen;
      const pdfDocData: PDFDocumentData = {
        docType,
        docTypeLabel: DOC_TYPES.find((d) => d.value === docType)?.label || docType,
        nid: activeCitizen.nid,
        citizenName: activeCitizen.name,
        wardCode: activeCitizen.ward_code || 'NPL-04-33-09',
        purpose: purpose.trim(),
        additionalInfo: info.trim() || undefined,
      };
      setPdfData(pdfDocData);
      setShowPDFPreview(true);
    } else {
      // For tourists, submit directly
      submitRequest();
    }
  };

  const submitRequest = async () => {
    if (isTourist) {
      setIsConfirmingSubmit(true);
      setLoading(true);
    }

    try {
      if (isTourist) {
        const requestId = `TRV-${Date.now()}`;
        await addRequest({
          request_id: requestId,
          document_type: touristService,
          purpose: purpose.trim(),
          status: 'PENDING',
          submitted_at: new Date().toISOString(),
          category: 'tourist',
          details: [
            `Passport: ${passportNo.trim()}`,
            `Visa/Entry: ${visaNo.trim() || 'Not provided'}`,
            `Stay: ${stayPlace.trim() || 'Not provided'}`,
            `Travel dates: ${travelDates.trim() || 'Not provided'}`,
            `Nationality: ${nationality.trim()}`,
            `Phone: ${phone.trim() || 'Not provided'}`,
            `Notes: ${info.trim() || 'None'}`,
          ].join(' • '),
        });

        Toast.show({
          type: 'success',
          text1: 'Tourist Request Saved',
          text2: 'Your visitor document request is now in the tracker',
        });
      } else {
        const activeCitizen = citizen;
        if (!activeCitizen) {
          Toast.show({ type: 'error', text1: 'Not Logged In', text2: 'Please login first' });
          setShowPDFPreview(false);
          return;
        }

        const response = await citizenAPI.submitRequest({
          citizen_nid: activeCitizen.nid,
          citizen_name: activeCitizen.name,
          citizen_phone: phone,
          document_type: docType,
          purpose: purpose.trim(),
          ward_code: activeCitizen.ward_code || 'NPL-04-33-09',
          additional_info: info,
        });

        if (!response.success) {
          Toast.show({ type: 'error', text1: 'Failed', text2: response.message });
          setShowPDFPreview(false);
          return;
        }

        await addRequest({
          request_id: response.request_id,
          document_type: docType,
          purpose: purpose.trim(),
          status: 'PENDING',
          submitted_at: response.submitted_at,
          category: 'citizen',
        });

        Toast.show({
          type: 'success',
          text1: 'Request Submitted!',
          text2: `ID: ${response.request_id}`,
        });
      }

      setPurpose('');
      setPhone('');
      setInfo('');
      setVisaNo('');
      setStayPlace('');
      setTravelDates('');
      setShowPDFPreview(false);
      navigation.navigate('Track');
    } catch {
      const demoId = isTourist
        ? `TRV-${String(Math.floor(Math.random() * 9000) + 1000)}`
        : `MS-2082-${String(Math.floor(Math.random() * 9000) + 1000).padStart(6, '0')}`;

      await addRequest({
        request_id: demoId,
        document_type: isTourist ? touristService : docType,
        purpose: purpose.trim(),
        status: 'PENDING',
        submitted_at: new Date().toISOString(),
        category: isTourist ? 'tourist' : 'citizen',
        details: isTourist
          ? [
              `Passport: ${passportNo.trim()}`,
              `Visa/Entry: ${visaNo.trim() || 'Not provided'}`,
              `Stay: ${stayPlace.trim() || 'Not provided'}`,
              `Travel dates: ${travelDates.trim() || 'Not provided'}`,
            ].join(' • ')
          : info.trim() || undefined,
      });

      Toast.show({
        type: 'success',
        text1: isTourist ? 'Tourist Request Saved (Demo)' : 'Request Submitted (Demo)',
        text2: `ID: ${demoId}`,
      });
      setShowPDFPreview(false);
      navigation.navigate('Track');
    } finally {
      setLoading(false);
      setIsConfirmingSubmit(false);
    }
  };

  const buildFallbackEsewaUrl = (orderId: string, amount: number) => {
    const successUrl = `${'https://hamropokhara.app'}/payment/success?order_id=${encodeURIComponent(orderId)}`;
    const failureUrl = `${'https://hamropokhara.app'}/payment/failure?order_id=${encodeURIComponent(orderId)}`;
    const merchantCode = 'EPAYTEST';

    const params = new URLSearchParams({
      amt: String(amount),
      txAmt: '0',
      psc: '0',
      pdc: '0',
      tAmt: String(amount),
      pid: orderId,
      scd: merchantCode,
      su: successUrl,
      fu: failureUrl,
    });

    return `https://esewa.com.np/epay/main?${params.toString()}`;
  };

  const handlePayBillViaEsewa = async () => {
    const accountRef = billAccountRef.trim();
    const amount = Number(billAmount);

    if (!accountRef) {
      Toast.show({ type: 'error', text1: 'Account Required', text2: 'Enter consumer/account number first.' });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Amount', text2: 'Enter a valid bill amount.' });
      return;
    }

    setPayingBill(true);
    try {
      const orderRes = await paymentAPI.createEsewaOrder({
        service_type: billService,
        account_ref: accountRef,
        amount,
        phone: billPhone.trim() || undefined,
        citizen_nid: citizen?.nid,
      });

      const orderId = String(orderRes?.order_id || `ORD-${Date.now()}`);
      const paymentUrl = String(orderRes?.payment_url || buildFallbackEsewaUrl(orderId, amount));

      const canOpen = await Linking.canOpenURL(paymentUrl);
      if (!canOpen) {
        Toast.show({ type: 'error', text1: 'Payment Link Invalid', text2: 'Unable to open eSewa payment link.' });
        return;
      }

      await Linking.openURL(paymentUrl);
      Toast.show({
        type: 'info',
        text1: 'Redirected to eSewa',
        text2: 'Complete payment in eSewa, then return to verify status.',
      });
    } catch {
      const fallbackOrderId = `ORD-${Date.now()}`;
      const fallbackUrl = buildFallbackEsewaUrl(fallbackOrderId, amount);
      await Linking.openURL(fallbackUrl);
      Toast.show({
        type: 'info',
        text1: 'Opened eSewa (Fallback)',
        text2: 'Using fallback payment route while backend setup is in progress.',
      });
    } finally {
      setPayingBill(false);
    }
  };

  const filteredDocTypes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return DOC_TYPES;
    return DOC_TYPES.filter((item) => `${item.value} ${item.label}`.toLowerCase().includes(q));
  }, [searchQuery]);

  const selectedDocLabel = DOC_TYPES.find((item) => item.value === docType)?.label || docType;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title={isTourist ? 'Visitor Services' : 'Core Services'}
        showMenu={false}
        showLang
        showBack={navigation.canGoBack?.()}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!isTourist ? (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.heroTitle}>Sifaris Portal</Text>
                <Text style={styles.heroSubtitle}>Search forms, submit requests, and pay utility bills in one place.</Text>

                <View style={styles.searchBox}>
                  <MaterialIcons name="search" size={18} color={Colors.outline} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search Sifaris forms..."
                    placeholderTextColor={Colors.outline}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
              </View>

              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Categories</Text>
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={styles.sectionAction}>Clear</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {filteredDocTypes.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.categoryChip, docType === item.value && styles.categoryChipActive]}
                    onPress={() => setDocType(item.value)}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name={item.icon as any} size={16} color={docType === item.value ? '#fff' : Colors.primary} />
                    <Text style={[styles.categoryChipText, docType === item.value && styles.categoryChipTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionTitle}>Popular Forms</Text>
              <View style={styles.popularGrid}>
                {filteredDocTypes.slice(0, 4).map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={styles.popularCard}
                    onPress={() => setDocType(item.value)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.popularIconWrap}>
                      <MaterialIcons name={item.icon as any} size={18} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.popularTitle}>{item.label}</Text>
                      <Text style={styles.popularSub}>Official municipal form</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.billCard}>
                <View style={styles.billHeaderRow}>
                  <MaterialIcons name="account-balance-wallet" size={18} color={Colors.primary} />
                  <Text style={styles.billTitle}>Pay Utility Bills (eSewa)</Text>
                </View>
                <Text style={styles.billSubtitle}>Connected to backend order creation. Opens eSewa for secure payment.</Text>

                <View style={styles.billTypeRow}>
                  {BILL_SERVICES.map((service) => (
                    <TouchableOpacity
                      key={service.value}
                      style={[styles.billTypePill, billService === service.value && styles.billTypePillActive]}
                      onPress={() => setBillService(service.value as 'electricity' | 'water' | 'tax')}
                      activeOpacity={0.85}
                    >
                      <MaterialIcons
                        name={service.icon as any}
                        size={14}
                        color={billService === service.value ? '#fff' : Colors.primary}
                      />
                      <Text style={[styles.billTypePillText, billService === service.value && styles.billTypePillTextActive]}>
                        {service.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Consumer / Account No.</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter account reference"
                  placeholderTextColor={Colors.outline}
                  value={billAccountRef}
                  onChangeText={setBillAccountRef}
                  autoCapitalize="characters"
                />

                <View style={styles.billInlineRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Amount (NPR)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0.00"
                      placeholderTextColor={Colors.outline}
                      value={billAmount}
                      onChangeText={setBillAmount}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Phone (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="98XXXXXXXX"
                      placeholderTextColor={Colors.outline}
                      value={billPhone}
                      onChangeText={setBillPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.payBtn, payingBill && { opacity: 0.7 }]}
                  onPress={handlePayBillViaEsewa}
                  disabled={payingBill}
                  activeOpacity={0.85}
                >
                  {payingBill ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="open-in-new" size={16} color="#fff" />
                      <Text style={styles.payBtnText}>Pay via eSewa</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.billHint}>Final status is confirmed through backend verify/callback before ledger update.</Text>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Apply for {selectedDocLabel}</Text>
                <Text style={styles.formSubtitle}>Your request goes to ward workflow and is saved to tracker/database.</Text>

                <View style={styles.citizenInfo}>
                  <MaterialIcons name="verified-user" size={16} color={Colors.success} />
                  <Text style={styles.citizenInfoText}>
                    {citizen?.name || 'Citizen'} · {citizen?.nid || '—'} · {citizen?.ward_code || '—'}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Purpose / उद्देश्य</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe your request purpose..."
                  placeholderTextColor={Colors.outline}
                  value={purpose}
                  onChangeText={setPurpose}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.fieldLabel}>Phone / फोन नम्बर</Text>
                <TextInput
                  style={styles.input}
                  placeholder="98XXXXXXXX"
                  placeholderTextColor={Colors.outline}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>Additional Details (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Any additional information..."
                  placeholderTextColor={Colors.outline}
                  value={info}
                  onChangeText={setInfo}
                />

                <TouchableOpacity
                  style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                  onPress={handleShowPreview}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="send" size={18} color="#fff" />
                      <Text style={styles.submitText}>Review & Submit</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.heroTitle}>Tourist Help Services</Text>
                <Text style={styles.heroSubtitle}>Submit permit and support requests for your stay in Pokhara.</Text>
              </View>

              <Text style={styles.fieldLabel}>Service Type / अनुरोध प्रकार</Text>
              <View style={styles.typeGrid}>
                {TOURIST_SERVICES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeCard, touristService === t.value && styles.typeCardSelected]}
                    onPress={() => setTouristService(t.value)}
                  >
                    <MaterialIcons
                      name={t.icon as any}
                      size={22}
                      color={touristService === t.value ? '#fff' : Colors.primary}
                    />
                    <Text style={[styles.typeLabel, touristService === t.value && styles.typeLabelSelected]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Passport Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Passport number"
                placeholderTextColor={Colors.outline}
                value={passportNo}
                onChangeText={setPassportNo}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={Colors.outline}
                value={fullName}
                onChangeText={setFullName}
              />

              <Text style={styles.fieldLabel}>Nationality</Text>
              <TextInput
                style={styles.input}
                placeholder="Nationality"
                placeholderTextColor={Colors.outline}
                value={nationality}
                onChangeText={setNationality}
              />

              <Text style={styles.fieldLabel}>Visa / Entry Permit No.</Text>
              <TextInput
                style={styles.input}
                placeholder="Visa or entry permit number"
                placeholderTextColor={Colors.outline}
                value={visaNo}
                onChangeText={setVisaNo}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Hotel / Stay Location</Text>
              <TextInput
                style={styles.input}
                placeholder="Hotel name or stay location"
                placeholderTextColor={Colors.outline}
                value={stayPlace}
                onChangeText={setStayPlace}
              />

              <Text style={styles.fieldLabel}>Travel Dates / Duration</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Apr 2 - Apr 8"
                placeholderTextColor={Colors.outline}
                value={travelDates}
                onChangeText={setTravelDates}
              />
              <View style={styles.citizenInfo}>
              <MaterialIcons name="flight-takeoff" size={16} color={Colors.primary} />
              <Text style={styles.citizenInfoText}>
                {tourist?.name || 'Traveler'} · {tourist?.passport_no || 'Passport required'} · {tourist?.nationality || 'Nationality required'}
              </Text>
              </View>

              <Text style={styles.fieldLabel}>Purpose / उद्देश्य</Text>
              <TextInput
                style={styles.textArea}
                placeholder="e.g., Need help with local permit and transport"
                placeholderTextColor={Colors.outline}
                value={purpose}
                onChangeText={setPurpose}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.fieldLabel}>Phone / फोन नम्बर</Text>
              <TextInput
                style={styles.input}
                placeholder="98XXXXXXXX"
                placeholderTextColor={Colors.outline}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>Additional Details (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Special requests, safety notes, or itinerary details..."
                placeholderTextColor={Colors.outline}
                value={info}
                onChangeText={setInfo}
              />

              <View style={styles.infoBox}>
                <MaterialIcons name="info" size={16} color={Colors.primary} />
                <Text style={styles.infoText}>Your visitor request will be saved for support and help desk follow-up.</Text>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                onPress={handleShowPreview}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={18} color="#fff" />
                    <Text style={styles.submitText}>Save Tourist Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <PDFPreviewModal
        visible={showPDFPreview}
        documentData={pdfData}
        onConfirm={submitRequest}
        onCancel={() => {
          setShowPDFPreview(false);
          setPdfData(null);
        }}
        isLoading={isConfirmingSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  heroCard: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 14,
  },
  heroTitle: { fontSize: 20, fontWeight: '900', color: Colors.onPrimaryContainer },
  heroSubtitle: { fontSize: 12, color: Colors.onPrimaryFixedVariant, marginTop: 6, lineHeight: 18 },
  searchBox: {
    marginTop: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.onSurface,
    paddingVertical: 12,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.primary, marginBottom: 10 },
  sectionAction: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  categoryRow: { gap: 8, paddingRight: 4, marginBottom: 16 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  categoryChipTextActive: { color: '#fff' },
  popularGrid: { gap: 10, marginBottom: 14 },
  popularCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Shadow.sm,
  },
  popularIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularTitle: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  popularSub: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
  billCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    ...Shadow.sm,
    marginBottom: 14,
  },
  billHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  billTitle: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  billSubtitle: { fontSize: 12, color: Colors.onSurfaceVariant, marginBottom: 10, lineHeight: 17 },
  billTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  billTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  billTypePillActive: {
    backgroundColor: Colors.primary,
  },
  billTypePillText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  billTypePillTextActive: { color: '#fff' },
  billInlineRow: { flexDirection: 'row', gap: 10 },
  payBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    borderRadius: Radius.full,
    paddingVertical: 13,
  },
  payBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  billHint: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 8, lineHeight: 16 },
  formCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    ...Shadow.sm,
  },
  formTitle: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  formSubtitle: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 4, lineHeight: 17 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, marginTop: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: { width: '31%', padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.surfaceContainerHigh },
  typeCardSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  typeLabelSelected: { color: '#fff' },
  citizenInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.successLight, padding: 12, borderRadius: Radius.lg, marginTop: 16, borderWidth: 1, borderColor: 'rgba(45,122,82,0.2)' },
  citizenInfoText: { fontSize: 12, color: Colors.success, fontWeight: '600', flex: 1 },
  textArea: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 16, fontSize: 14, color: Colors.onSurface, minHeight: 90, textAlignVertical: 'top', ...Shadow.sm },
  input: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, paddingHorizontal: 18, paddingVertical: 14, fontSize: 14, color: Colors.onSurface, ...Shadow.sm },
  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: Colors.primaryFixed, padding: 14, borderRadius: Radius.lg, marginTop: 16, alignItems: 'flex-start' },
  infoText: { fontSize: 12, color: Colors.onPrimaryFixedVariant, lineHeight: 18, flex: 1 },
  submitBtn: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: Radius.full, marginTop: 24, ...Shadow.lg },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});