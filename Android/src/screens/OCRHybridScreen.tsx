import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  TextInput,
  useWindowDimensions,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../constants/theme';
import { authAPI } from '../api/client';

type ScanDocType = 'nid' | 'citizenship' | 'license' | 'passport';

type ScanMode = 'citizen' | 'tourist';

interface OCRHybridFields {
  name: string;
  nid?: string;
  citizenshipNo?: string;
  passportNo?: string;
  nationality?: string;
  dob: string;
  imageUri?: string;
}

interface OCRResult {
  name?: string;
  nid?: string;
  citizenshipNo?: string;
  passportNo?: string;
  nationality?: string;
  dob?: string;
}

interface Props {
  onResult: (result: OCRHybridFields) => void;
  onClose: () => void;
  docType: ScanDocType;
  documentLabel?: string;
  mode?: ScanMode;
}

const AUTH_OCR_LOG = '[AuthOCR]';

const maskValue = (value?: string) => {
  const clean = (value || '').trim();
  if (!clean) return '';
  if (clean.length <= 4) return '*'.repeat(clean.length);
  return `${'*'.repeat(clean.length - 4)}${clean.slice(-4)}`;
};

const normalizeOCRResult = (raw: any): OCRResult => ({
  name: raw?.name || raw?.full_name || raw?.citizen_name || '',
  nid: raw?.nid || raw?.national_id || '',
  citizenshipNo: raw?.citizenshipNo || raw?.citizenship_no || raw?.citizenship || '',
  passportNo: raw?.passportNo || raw?.passport_no || raw?.passport_number || raw?.passport || '',
  nationality: raw?.nationality || raw?.country || '',
  dob: raw?.dob || raw?.date_of_birth || '',
});

const extractOCRPayload = (response: any) => {
  const candidate = response?.fields || response?.extracted || response?.result || response?.data || response?.ocr || response;
  return candidate?.fields || candidate?.extracted || candidate?.result || candidate?.data || candidate || {};
};

export default function OCRHybridScreen({
  onResult,
  onClose,
  docType,
  documentLabel = 'Citizenship Card',
  mode = 'citizen',
}: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const isTourist = mode === 'tourist';

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState('');
  const [rawExtracted, setRawExtracted] = useState<Record<string, any>>({});
  const [fields, setFields] = useState<OCRHybridFields>({
    name: '',
    nid: '',
    citizenshipNo: '',
    passportNo: '',
    nationality: '',
    dob: '',
  });

  const title = useMemo(() => `Scan ${documentLabel}`, [documentLabel]);

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    console.info(`${AUTH_OCR_LOG} camera:permission`, { status });
    setHasPermission(status === 'granted');
    return status === 'granted';
  };

  const applyOCRFields = (rawFields: any, imageUri?: string) => {
    const normalized = normalizeOCRResult(rawFields);
    setFields((current) => ({
      ...current,
      name: normalized.name || current.name,
      nid: normalized.nid || current.nid,
      citizenshipNo: normalized.citizenshipNo || current.citizenshipNo,
      passportNo: normalized.passportNo || current.passportNo,
      nationality: normalized.nationality || current.nationality,
      dob: normalized.dob || current.dob,
      imageUri: imageUri || current.imageUri,
    }));
  };

  const captureAndProcess = async () => {
    console.info(`${AUTH_OCR_LOG} scan:start`, {
      mode: isTourist ? 'tourist' : 'citizen',
      docType,
    });

    const granted = await requestCameraPermission();
    if (!granted) return;

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.8,
      allowsEditing: false,
      cameraType: ImagePicker.CameraType.back,
    });

    if (result.canceled || !result.assets?.length) {
      console.warn(`${AUTH_OCR_LOG} scan:canceled`);
      return;
    }

    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setLoading(true);

    try {
      const response = await authAPI.scanOcrDocument({
        image_base64: asset.base64 || '',
        document_type: docType,
        language: isTourist ? 'en' : 'ne',
      });

      const extracted = extractOCRPayload(response);
      console.info(`${AUTH_OCR_LOG} scan:response`, {
        success: Boolean(response?.success !== false),
        keys: Object.keys(extracted || {}),
        stored: Boolean(response?.stored || response?.saved || response?.scan_id),
      });
      setRawExtracted(extracted || {});
      applyOCRFields(extracted, asset.uri);
    } catch (error: any) {
      console.error(`${AUTH_OCR_LOG} scan:error`, {
        message: error?.message || 'Unknown scan error',
      });
      applyOCRFields({}, asset.uri);
    } finally {
      setLoading(false);
    }
  };

  const handleUseDetails = async () => {
    const corrected = {
      name: fields.name?.trim() || '',
      nid: fields.nid?.trim() || '',
      citizenship_no: fields.citizenshipNo?.trim() || '',
      passport_no: fields.passportNo?.trim() || '',
      nationality: fields.nationality?.trim() || '',
      dob: fields.dob?.trim() || '',
    };

    if (!isTourist && !corrected.citizenship_no) {
      Alert.alert('Required Field', 'Please confirm your citizenship number before continuing.');
      return;
    }

    if (isTourist && !corrected.passport_no) {
      Alert.alert('Required Field', 'Please confirm your passport number before continuing.');
      return;
    }

    console.info(`${AUTH_OCR_LOG} scan:confirm`, {
      mode: isTourist ? 'tourist' : 'citizen',
      passport: maskValue(fields.passportNo),
      citizenship: maskValue(fields.citizenshipNo),
      hasName: Boolean(fields.name?.trim()),
      hasNationality: Boolean(fields.nationality?.trim()),
      hasDob: Boolean(fields.dob?.trim()),
    });

    try {
      const wasCorrect =
        (rawExtracted?.citizenship_no || rawExtracted?.citizenshipNo || '') === corrected.citizenship_no &&
        (rawExtracted?.passport_no || rawExtracted?.passportNo || '') === corrected.passport_no;

      const saveRes = await authAPI.validateOcrResult({
        original_fields: rawExtracted || {},
        corrected_fields: corrected,
        document_type: docType,
        was_correct: Boolean(wasCorrect),
      });

      console.info(`${AUTH_OCR_LOG} scan:validated`, {
        success: Boolean(saveRes?.success !== false),
        stored: Boolean(saveRes?.stored || saveRes?.saved || saveRes?.scan_id),
      });
    } catch (error: any) {
      console.warn(`${AUTH_OCR_LOG} scan:validate-failed`, {
        message: error?.message || 'Failed to persist OCR confirmation',
      });
    }

    onResult({
      name: corrected.name,
      nid: corrected.nid,
      citizenshipNo: corrected.citizenship_no,
      passportNo: corrected.passport_no,
      nationality: corrected.nationality,
      dob: corrected.dob,
      imageUri: photoUri,
    });
  };

  const handleRetake = async () => {
    console.info(`${AUTH_OCR_LOG} scan:retake`);
    setPhotoUri('');
    setFields({ name: '', nid: '', citizenshipNo: '', passportNo: '', nationality: '', dob: '' });
    await captureAndProcess();
  };

  const formTitle = isTourist ? 'Correct your passport details' : 'Correct the details';
  const formSub = isTourist
    ? 'Check the extracted passport fields and edit anything that looks wrong.'
    : 'Check the extracted fields and edit any mistakes.';

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionState}>
          <MaterialIcons name="no-photography" size={44} color={Colors.outline} />
          <Text style={styles.permissionTitle}>Camera permission needed</Text>
          <Text style={styles.permissionText}>
            We need camera access to capture and prefill your {documentLabel.toLowerCase()}.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub}>Photo first. Then correct the details before continuing.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!photoUri ? (
          <TouchableOpacity style={styles.captureCard} onPress={captureAndProcess} activeOpacity={0.88}>
            <View style={styles.captureIconWrap}>
              <MaterialIcons name="camera-enhance" size={34} color={Colors.primary} />
            </View>
            <Text style={styles.captureTitle}>Tap to scan {documentLabel}</Text>
            <Text style={styles.captureSub}>
              We will prefill what we can, then you can edit the form below.
            </Text>
            {loading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />}
          </TouchableOpacity>
        ) : (
          <View style={[styles.editorShell, isWide && styles.editorShellWide]}>
            <View style={[styles.photoCard, isWide && styles.photoCardWide]}>
              <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="contain" />
              <View style={styles.photoToolbar}>
                <TouchableOpacity style={styles.toolbarBtn} onPress={handleRetake} activeOpacity={0.8}>
                  <MaterialIcons name="refresh" size={18} color={Colors.primary} />
                  <Text style={styles.toolbarBtnText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toolbarBtn, styles.toolbarBtnPrimary]} onPress={captureAndProcess} activeOpacity={0.8}>
                  <MaterialIcons name="camera" size={18} color="#fff" />
                  <Text style={[styles.toolbarBtnText, styles.toolbarBtnTextPrimary]}>Scan Again</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.fieldCard, Shadow.md, isWide && styles.formCardWide]}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>{formTitle}</Text>
                <Text style={styles.formSub}>{formSub}</Text>
              </View>

              {isTourist ? (
                <>
                  <Text style={styles.fieldLabel}>Passport Number</Text>
                  <TextInput
                    style={styles.input}
                    value={fields.passportNo}
                    onChangeText={(value) => setFields((current) => ({ ...current, passportNo: value }))}
                    placeholder="Enter passport number"
                    placeholderTextColor={Colors.outline}
                    autoCapitalize="characters"
                  />

                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    value={fields.name}
                    onChangeText={(value) => setFields((current) => ({ ...current, name: value }))}
                    placeholder="Enter your full name"
                    placeholderTextColor={Colors.outline}
                    autoCapitalize="words"
                  />

                  <Text style={styles.fieldLabel}>Nationality</Text>
                  <TextInput
                    style={styles.input}
                    value={fields.nationality}
                    onChangeText={(value) => setFields((current) => ({ ...current, nationality: value }))}
                    placeholder="Enter nationality"
                    placeholderTextColor={Colors.outline}
                  />

                  <Text style={styles.fieldLabel}>Date of Birth</Text>
                  <TextInput
                    style={styles.input}
                    value={fields.dob}
                    onChangeText={(value) => setFields((current) => ({ ...current, dob: value }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.outline}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Citizenship No.</Text>
                  <TextInput
                    style={styles.input}
                    value={fields.citizenshipNo}
                    onChangeText={(value) => setFields((current) => ({ ...current, citizenshipNo: value }))}
                    placeholder="Enter citizenship number"
                    placeholderTextColor={Colors.outline}
                    autoCapitalize="none"
                  />
                </>
              )}

              <View style={styles.helperBox}>
                <MaterialIcons name="info-outline" size={16} color={Colors.primary} />
                <Text style={styles.helperText}>
                  OCR is only assisting you. Correct anything that looks wrong before you continue.
                </Text>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleUseDetails} activeOpacity={0.85}>
                <MaterialIcons name="check" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Use These Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading && photoUri && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Reading document...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    backgroundColor: Colors.background,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  headerSub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
  scrollContent: { padding: 16, paddingBottom: 28, gap: 14 },
  captureCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.xl,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 320,
    ...Shadow.md,
  },
  captureIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  captureTitle: { fontSize: 18, fontWeight: '800', color: Colors.onSurface, textAlign: 'center' },
  captureSub: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
  },
  editorShell: { gap: 14 },
  editorShellWide: { flexDirection: 'row', alignItems: 'flex-start' },
  photoCard: { backgroundColor: '#fff', borderRadius: Radius.xl, padding: 12, ...Shadow.md },
  photoCardWide: { flex: 0.95 },
  photo: { width: '100%', height: 240, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerLow },
  photoToolbar: { flexDirection: 'row', gap: 10, marginTop: 12 },
  toolbarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  toolbarBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toolbarBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  toolbarBtnTextPrimary: { color: '#fff' },
  fieldCard: { backgroundColor: '#fff', borderRadius: Radius.xl, padding: 16 },
  formCardWide: { flex: 1 },
  formHeader: { marginBottom: 8 },
  formTitle: { fontSize: 16, fontWeight: '800', color: Colors.onSurface },
  formSub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 4, lineHeight: 18 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.onSurface,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  helperBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primaryFixed,
    borderRadius: Radius.lg,
    padding: 12,
    marginTop: 14,
  },
  helperText: { flex: 1, fontSize: 12, lineHeight: 18, color: Colors.onPrimaryFixedVariant },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    marginTop: 16,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 4 },
  loadingText: { color: Colors.onSurfaceVariant, fontSize: 13 },
  permissionState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  permissionTitle: { fontSize: 18, fontWeight: '800', color: Colors.onSurface, textAlign: 'center' },
  permissionText: { fontSize: 13, color: Colors.onSurfaceVariant, lineHeight: 20, textAlign: 'center', maxWidth: 320 },
});
