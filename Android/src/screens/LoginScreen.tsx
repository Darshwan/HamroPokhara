import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { authAPI, healthCheck } from '../api/client';

// Runtime require avoids the resolver edge case on the shared hybrid OCR screen.
const OCRHybridScreen = require('./OCRHybridScreen').default;

type OCRHybridResult = {
  name?: string;
  nid?: string;
  citizenshipNo?: string;
  dob?: string;
  imageUri?: string;
  passportNo?: string;
  nationality?: string;
};

const AUTH_UI_LOG = '[AuthFlow]';

const maskValue = (value: string) => {
  const clean = (value || '').trim();
  if (!clean) return '';
  if (clean.length <= 4) return '*'.repeat(clean.length);
  return `${'*'.repeat(clean.length - 4)}${clean.slice(-4)}`;
};

const resolveAuthToken = (response: any) =>
  String(
    response?.token ||
    response?.access_token ||
    response?.auth_token ||
    response?.session_id ||
    ''
  ).trim();

const isSuccessLikeMessage = (message: string) => {
  const normalized = (message || '').trim().toLowerCase();
  return normalized.includes('login successful') || normalized === 'success' || normalized === 'ok';
};

const getAuthFailureMessage = (response: any, fallback = 'Invalid credentials') => {
  const raw = String(response?.message || '').trim();
  return !raw || isSuccessLikeMessage(raw) ? fallback : raw;
};

export default function LoginScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const mode = route?.params?.mode || 'citizen';
  const isTourist = mode === 'tourist';

  const [citizenshipNo, setCitizenshipNo] = useState('');
  const [passportNo, setPassportNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [nationality, setNationality] = useState('');
  const [showOCR, setShowOCR] = useState(false);
  const [showScanPrompt, setShowScanPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectionState, setConnectionState] = useState<'checking' | 'online' | 'offline'>('checking');
  const { login, loginAsTourist, continueAsGuest } = useStore();
  const selectedDocLabel = isTourist ? 'Passport' : 'Citizenship';

  useEffect(() => {
    let active = true;

    const checkConnection = async () => {
      setConnectionState('checking');
      const ok = await healthCheck();
      console.info(`${AUTH_UI_LOG} backend:health`, { ok });
      if (active) {
        setConnectionState(ok ? 'online' : 'offline');
      }
    };

    checkConnection();

    return () => {
      active = false;
    };
  }, []);

  const handleOCRResult = (fields: any) => {
    console.info(`${AUTH_UI_LOG} ocr:result-received`, {
      mode: isTourist ? 'tourist' : 'citizen',
      keys: fields ? Object.keys(fields) : [],
    });

    if (isTourist) {
      const passport = String(fields?.passportNo || fields?.passport_no || fields?.passport || '').trim();
      const name = String(fields?.name || fields?.full_name || '').trim();
      const nation = String(fields?.nationality || '').trim();

      if (passport) setPassportNo(passport);
      if (name) setFullName(name);
      if (nation) setNationality(nation);
      console.info(`${AUTH_UI_LOG} ocr:tourist-prefill`, {
        passport: maskValue(passport),
        hasName: Boolean(name),
        hasNationality: Boolean(nation),
      });
      return;
    }

    const extractedCitizenship = String(fields?.citizenshipNo || fields?.citizenship_no || fields?.citizenship || '').trim();
    if (extractedCitizenship) setCitizenshipNo(extractedCitizenship);
    console.info(`${AUTH_UI_LOG} ocr:citizen-prefill`, {
      citizenship: maskValue(extractedCitizenship),
    });
  };

  const handleLoginWithPayload = async (nidValue: string, citizenshipValue: string) => {
    console.info('[Auth] Login to Portal requested');

    const response = await authAPI.loginCitizen(nidValue.trim(), citizenshipValue.trim());
    const token = resolveAuthToken(response);

    if (response.success && response.citizen && token) {
      console.info('[Auth] user connected to db');
      await login(response.citizen, token);
      Toast.show({
        type: 'success',
        text1: 'Login successful',
        text2: `Namaste, ${response.citizen.name}`,
      });
      return true;
    }

    console.warn(`${AUTH_UI_LOG} citizen:login-incomplete-success`, {
      success: Boolean(response?.success),
      hasCitizen: Boolean(response?.citizen),
      hasToken: Boolean(token),
      rawMessage: response?.message || '',
    });

    const failureMessage = getAuthFailureMessage(response);

    Toast.show({
      type: 'error',
      text1: 'Unable to log in',
      text2: failureMessage,
    });

    console.warn(`${AUTH_UI_LOG} citizen:login-failed`, {
      message: failureMessage,
      rawMessage: response?.message || '',
    });

    return false;
  };

  const handleCitizenLogin = async () => {
    const citizenship = citizenshipNo.trim();
    console.info(`${AUTH_UI_LOG} citizen:login-attempt`, {
      hasCitizenship: Boolean(citizenship),
      citizenship: maskValue(citizenship),
    });

    if (!citizenship) {
      console.warn(`${AUTH_UI_LOG} citizen:missing-citizenship`);
      setShowScanPrompt(true);
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.loginCitizen(citizenship, citizenship);
      const token = resolveAuthToken(response);
      console.info(`${AUTH_UI_LOG} citizen:login-response`, {
        success: Boolean(response?.success),
        hasCitizen: Boolean(response?.citizen),
        hasToken: Boolean(token),
        message: response?.message || '',
      });

      if (response.success && response.citizen && token) {
        console.info(`${AUTH_UI_LOG} citizen:login-success`, {
          citizenId: response?.citizen?.id || response?.citizen?.nid || 'unknown',
        });
        await login(response.citizen, token);
        Toast.show({
          type: 'success',
          text1: 'Login successful',
          text2: `Namaste, ${response.citizen.name}`,
        });
        return;
      }

      if (response?.success && response?.citizen && !token) {
        console.warn(`${AUTH_UI_LOG} citizen:missing-token-on-success`, {
          message: response?.message || '',
        });
        Toast.show({
          type: 'error',
          text1: 'Login response incomplete',
          text2: 'Server did not return a session token. Please check backend auth response.',
        });
        return;
      }

      const failureMessage = getAuthFailureMessage(response);

      Toast.show({
        type: 'error',
        text1: 'Unable to log in',
        text2: failureMessage,
      });
      console.warn(`${AUTH_UI_LOG} citizen:login-failed`, {
        message: failureMessage,
        rawMessage: response?.message || '',
      });
    } catch (error: any) {
      console.error(`${AUTH_UI_LOG} citizen:login-error`, {
        message: error?.message || 'Unknown error',
      });
      Toast.show({
        type: 'error',
        text1: 'Unable to log in',
        text2: error?.message || 'Unable to process login.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTouristLogin = async () => {
    const passport = passportNo.trim().toUpperCase();
    console.info(`${AUTH_UI_LOG} tourist:login-attempt`, {
      passport: maskValue(passport),
      hasName: Boolean(fullName.trim()),
      hasNationality: Boolean(nationality.trim()),
    });

    if (!passport || passport.length < 6) {
      console.warn(`${AUTH_UI_LOG} tourist:invalid-passport`, {
        length: passport.length,
      });
      Toast.show({
        type: 'error',
        text1: 'Invalid Passport',
        text2: 'Enter a valid passport number.',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.loginTourist({
        passport_no: passport,
        full_name: fullName.trim(),
        nationality: nationality.trim(),
        device_info: Platform.OS,
      });
      console.info(`${AUTH_UI_LOG} tourist:login-response`, {
        success: Boolean(res?.success),
        hasTourist: Boolean(res?.tourist),
        hasSessionId: Boolean(res?.session_id),
        message: res?.message || '',
      });

      const touristPayload = {
        passport_no: passport,
        name: fullName.trim() || passport,
        nationality: nationality.trim() || 'Unknown',
      };

      if (res.success) {
        console.info(`${AUTH_UI_LOG} tourist:login-success`);
        await loginAsTourist(res.tourist || touristPayload, res.session_id || `tourist-${Date.now()}`);
        Toast.show({
          type: 'success',
          text1: 'Login successful',
          text2: `Welcome to Pokhara, ${fullName.trim() || passport}!`,
        });
      } else {
        console.warn(`${AUTH_UI_LOG} tourist:login-fallback-demo`, {
          reason: res?.message || 'Backend rejected login',
        });
        await loginAsTourist(touristPayload, `tourist-demo-${Date.now()}`);
        Toast.show({
          type: 'info',
          text1: 'Tourist Demo Mode',
          text2: res.message || 'Continuing with guest access',
        });
      }
    } catch (error: any) {
      console.error(`${AUTH_UI_LOG} tourist:login-error`, {
        message: error?.message || 'Unknown error',
      });
      await loginAsTourist(
        {
          passport_no: passport,
          name: fullName.trim() || passport,
          nationality: nationality.trim() || 'Unknown',
        },
        `tourist-demo-${Date.now()}`
      );
      Toast.show({ type: 'info', text1: 'Tourist Demo Mode' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <MaterialIcons name="arrow-back" size={20} color={Colors.primary} />
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.connectionChip,
              connectionState === 'online' && styles.connectionChipOnline,
              connectionState === 'offline' && styles.connectionChipOffline,
            ]}
            activeOpacity={0.9}
            onPress={() => {
              setConnectionState('checking');
              healthCheck().then((ok) => {
                console.info(`${AUTH_UI_LOG} backend:manual-health`, { ok });
                setConnectionState(ok ? 'online' : 'offline');
              });
            }}
          >
            <MaterialIcons
              name={connectionState === 'online' ? 'cloud-done' : connectionState === 'offline' ? 'cloud-off' : 'sync'}
              size={14}
              color={connectionState === 'online' ? '#1b7f4a' : connectionState === 'offline' ? '#b42318' : Colors.primary}
            />
            <Text
              style={[
                styles.connectionChipText,
                connectionState === 'online' && styles.connectionChipTextOnline,
                connectionState === 'offline' && styles.connectionChipTextOffline,
              ]}
            >
              {connectionState === 'checking' && 'Checking backend...'}
              {connectionState === 'online' && 'Backend connected'}
              {connectionState === 'offline' && 'Backend offline'}
            </Text>
          </TouchableOpacity>

          <View style={styles.heroPanel}>
            <LinearGradient
              colors={isTourist ? ['#1a5276', '#2e86c1'] : [Colors.primaryContainer, Colors.primary]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.glowTR} />
            <View style={styles.glowBL} />
            <View style={{ position: 'relative', zIndex: 1 }}>
              <View style={styles.secureBadge}>
                <Text style={styles.secureBadgeText}>Secure Access</Text>
              </View>
              <Text style={styles.heroTitle}>{isTourist ? `Tourist${'\n'}Login` : `Citizen${'\n'}Login`}</Text>
              <Text style={styles.heroDesc}>
                {isTourist
                  ? 'Verify your passport to access permits, tourism services and visitor support.'
                  : 'Access municipal services, track applications, and engage with your city governance.'}
              </Text>
            </View>
          </View>

          {!isTourist && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Citizenship Verification</Text>
              <Text style={styles.formSubtitle}>Enter your citizenship number or scan to prefill it</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Citizenship Number</Text>
                <View style={styles.fieldRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter citizenship number"
                    placeholderTextColor={Colors.outline}
                    value={citizenshipNo}
                    onChangeText={setCitizenshipNo}
                    returnKeyType="done"
                    onSubmitEditing={handleCitizenLogin}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity style={styles.scanBtn} onPress={() => setShowOCR(true)}>
                    <MaterialIcons name="photo-camera" size={22} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                onPress={handleCitizenLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.loginBtnText}>Login to Portal</Text>
                    <MaterialIcons name="login" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {isTourist && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Passport Verification</Text>
              <Text style={styles.formSubtitle}>Enter your passport details or scan to prefill them</Text>

              <TouchableOpacity style={styles.passportScanBtn} onPress={() => setShowOCR(true)}>
                <MaterialIcons name="document-scanner" size={24} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.passportScanTitle}>Scan Passport</Text>
                  <Text style={styles.passportScanSub}>Use OCR to auto-fill your details</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Passport Number</Text>
              <TextInput
                style={styles.input}
                placeholder="A12345678"
                placeholderTextColor={Colors.outline}
                value={passportNo}
                onChangeText={setPassportNo}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="JOHN SMITH"
                placeholderTextColor={Colors.outline}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Nationality</Text>
              <TextInput
                style={styles.input}
                placeholder="American"
                placeholderTextColor={Colors.outline}
                value={nationality}
                onChangeText={setNationality}
              />

              <TouchableOpacity
                style={[styles.loginBtn, styles.touristLoginBtn, loading && styles.loginBtnDisabled]}
                onPress={handleTouristLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="flight" size={20} color="#fff" />
                    <Text style={styles.loginBtnText}>Enter Tourist Portal</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.secondaryGrid}>
            <TouchableOpacity style={styles.secondaryCard}>
              <View style={[styles.secIconBox, { backgroundColor: 'rgba(0,59,90,0.05)' }]}>
                <MaterialIcons name="person-add" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.secTitle}>New Citizen</Text>
              <Text style={styles.secSub}>Register for ID</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryCard}>
              <View style={[styles.secIconBox, { backgroundColor: 'rgba(175,47,35,0.05)' }]}>
                <MaterialIcons name="support-agent" size={20} color={Colors.secondary} />
              </View>
              <Text style={styles.secTitle}>Help Desk</Text>
              <Text style={styles.secSub}>Technical support</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showOCR} animationType="slide" onRequestClose={() => setShowOCR(false)}>
        <OCRHybridScreen
          docType={isTourist ? 'passport' : 'citizenship'}
          documentLabel={selectedDocLabel}
          mode={isTourist ? 'tourist' : 'citizen'}
          onResult={(fields: OCRHybridResult) => {
            handleOCRResult(fields);
            setShowOCR(false);
          }}
          onClose={() => setShowOCR(false)}
        />
      </Modal>

      <Modal visible={showScanPrompt} transparent animationType="fade" onRequestClose={() => setShowScanPrompt(false)}>
        <TouchableOpacity style={styles.promptOverlay} activeOpacity={1} onPress={() => setShowScanPrompt(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.promptCard}>
            <MaterialIcons name="document-scanner" size={28} color={Colors.primary} />
            <Text style={styles.promptTitle}>Scan {selectedDocLabel}</Text>
            <Text style={styles.promptText}>
              You need to scan your {selectedDocLabel.toLowerCase()} before logging in. Tap Scan Now to continue.
            </Text>
            <View style={styles.promptActions}>
              <TouchableOpacity style={styles.promptCancelBtn} onPress={() => setShowScanPrompt(false)}>
                <Text style={styles.promptCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.promptScanBtn}
                onPress={() => {
                  console.info(`${AUTH_UI_LOG} citizen:scan-prompt-confirmed`);
                  setShowScanPrompt(false);
                  setShowOCR(true);
                }}
              >
                <Text style={styles.promptScanText}>Scan Now</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  backBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  connectionChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  connectionChipOnline: {
    backgroundColor: 'rgba(217,242,227,0.9)',
    borderColor: 'rgba(45,122,82,0.25)',
  },
  connectionChipOffline: {
    backgroundColor: 'rgba(255,218,214,0.9)',
    borderColor: 'rgba(186,26,26,0.25)',
  },
  connectionChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  connectionChipTextOnline: {
    color: '#1b7f4a',
  },
  connectionChipTextOffline: {
    color: '#b42318',
  },
  heroPanel: {
    borderRadius: Radius.xxl,
    padding: 28,
    marginBottom: 16,
    overflow: 'hidden',
    minHeight: 220,
    justifyContent: 'flex-end',
  },
  glowTR: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  glowBL: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(0,59,90,0.25)',
  },
  secureBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,59,90,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  secureBadgeText: {
    color: 'rgba(203,230,255,0.9)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 44,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
    lineHeight: 48,
    marginBottom: 10,
  },
  heroDesc: {
    fontSize: 13,
    color: 'rgba(148,197,238,0.85)',
    lineHeight: 20,
  },
  wardBadge: {
    alignSelf: 'flex-end',
    marginBottom: 12,
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  wardBadgeText: {
    color: Colors.onPrimaryFixedVariant,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  formCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.xxl,
    padding: 24,
    marginBottom: 14,
    ...Shadow.sm,
  },
  formTitle: { fontSize: 17, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  formSubtitle: { fontSize: 12, color: Colors.onSurfaceVariant, marginBottom: 24 },
  fieldGroup: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  docTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  docTypePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  docTypePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  docTypePillText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  docTypePillTextActive: {
    color: '#fff',
  },
  fieldRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.onSurface,
    ...Shadow.sm,
  },
  scanBtn: {
    width: 52,
    height: 52,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  loginBtn: {
    backgroundColor: Colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: Radius.full,
    marginTop: 18,
    ...Shadow.md,
  },
  touristLoginBtn: {
    backgroundColor: '#2e86c1',
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryGrid: { flexDirection: 'row', gap: 12 },
  secondaryCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.xxl,
    padding: 20,
    ...Shadow.sm,
  },
  secIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  secTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  secSub: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
  passportScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.primaryFixed,
    borderRadius: Radius.xl,
    padding: 14,
    marginBottom: 10,
  },
  passportScanTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  passportScanSub: {
    fontSize: 12,
    color: Colors.onPrimaryFixedVariant,
    marginTop: 2,
  },
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 18, 16, 0.42)',
    justifyContent: 'center',
    padding: 20,
  },
  promptCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: 22,
    alignItems: 'center',
    gap: 10,
    ...Shadow.lg,
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
    textAlign: 'center',
  },
  promptText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 19,
  },
  promptActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    width: '100%',
  },
  promptCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
  },
  promptCancelText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  promptScanBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  promptScanText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});