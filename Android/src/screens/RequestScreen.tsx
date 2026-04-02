import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, SafeAreaView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { citizenAPI } from '../api/client';
import { PDFPreviewModal } from '../components/PDFPreviewModal';
import { PDFDocumentData } from '../utils/pdfGenerator';

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isTourist ? 'Tourist Request' : 'Request Document'}</Text>
        <Text style={styles.headerSub}>{isTourist ? 'Visitor services and travel documents' : 'सिफारिस अनुरोध'}</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isTourist ? (
            <>
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
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Document Type / कागज प्रकार</Text>
              <View style={styles.typeGrid}>
                {DOC_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeCard, docType === t.value && styles.typeCardSelected]}
                    onPress={() => setDocType(t.value)}
                  >
                    <MaterialIcons
                      name={t.icon as any}
                      size={22}
                      color={docType === t.value ? '#fff' : Colors.primary}
                    />
                    <Text style={[styles.typeLabel, docType === t.value && styles.typeLabelSelected]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {!isTourist ? (
            <View style={styles.citizenInfo}>
              <MaterialIcons name="verified-user" size={16} color={Colors.success} />
              <Text style={styles.citizenInfoText}>
                {citizen?.name || 'Citizen'} · {citizen?.nid || '—'} · {citizen?.ward_code || '—'}
              </Text>
            </View>
          ) : (
            <View style={styles.citizenInfo}>
              <MaterialIcons name="flight-takeoff" size={16} color={Colors.primary} />
              <Text style={styles.citizenInfoText}>
                {tourist?.name || 'Traveler'} · {tourist?.passport_no || 'Passport required'} · {tourist?.nationality || 'Nationality required'}
              </Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>Purpose / उद्देश्य</Text>
          <TextInput
            style={styles.textArea}
            placeholder={isTourist ? 'e.g., Need help with local permit and transport' : 'e.g., बैंक खाता खोल्नका लागि सिफारिस'}
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
            placeholder={isTourist ? 'Special requests, safety notes, or itinerary details...' : 'Any additional information...'}
            placeholderTextColor={Colors.outline}
            value={info}
            onChangeText={setInfo}
          />

          <View style={styles.infoBox}>
            <MaterialIcons name="info" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>
              {isTourist
                ? 'Your visitor request will be saved for support and help desk follow-up.'
                : 'Your request will be reviewed by the Ward Officer within 2 working days. You will receive a notification when your document is ready.'}
            </Text>
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
                <Text style={styles.submitText}>{isTourist ? 'Save Tourist Request' : 'Review & Submit'}</Text>
              </>
            )}
          </TouchableOpacity>
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
  header: { padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  headerTitle: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  headerSub: { fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 2 },
  content: { padding: 20, paddingBottom: 40 },
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