import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { authAPI } from '../api/client';

type ScanDocType = 'nid' | 'citizenship' | 'license';

export default function LoginScreen({ navigation }: any) {
  const [nid, setNid]                         = useState('');
  const [citizenshipNo, setCitizenshipNo]     = useState('');
  const [loading, setLoading]                 = useState(false);
  const citizenshipRef = useRef<TextInput>(null);
  const { login } = useStore();

  const handleLoginWithPayload = async (nidValue: string, citizenshipValue: string) => {
    const response = await authAPI.loginCitizen(nidValue.trim(), citizenshipValue.trim());
    if (response.success && response.citizen && response.token) {
      await login(response.citizen, response.token);
      Toast.show({
        type: 'success',
        text1: 'Welcome!',
        text2: `Namaste, ${response.citizen.name}`,
      });
      return true;
    }

    Toast.show({
      type: 'error',
      text1: 'Login Failed',
      text2: response.message || 'Invalid credentials',
    });
    return false;
  };

  const handleLogin = async () => {
    // Validation
    if (!nid.trim()) {
      Toast.show({ type: 'error', text1: 'NID Required', text2: 'Please enter your National ID Number' });
      return;
    }
    if (!citizenshipNo.trim()) {
      Toast.show({ type: 'error', text1: 'Citizenship Required', text2: 'Please enter your citizenship number' });
      return;
    }

    setLoading(true);
    try {
      await handleLoginWithPayload(nid, citizenshipNo);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Connection Error',
        text2: error.message || 'Could not connect to server',
      });
    } finally {
      setLoading(false);
    }
  };

  const runDocumentScan = async (docType: ScanDocType) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Camera Permission Needed',
        text2: 'Please grant camera access to scan your document.',
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
      cameraType: ImagePicker.CameraType.back,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    setLoading(true);
    try {
      const imageUri = result.assets[0].uri;

      // Try direct scan-login route first for best UX.
      const directLogin = await authAPI.loginWithScannedDocument(docType, imageUri);
      if (directLogin.success && directLogin.citizen && directLogin.token) {
        await login(directLogin.citizen, directLogin.token);
        Toast.show({
          type: 'success',
          text1: 'Scan Login Successful',
          text2: `Namaste, ${directLogin.citizen.name}`,
        });
        return;
      }

      // Fallback to OCR extraction and prefill fields.
      const ocrResult = await authAPI.scanIdentityDocument(docType, imageUri);
      const extracted = ocrResult.extracted || {};

      const nextNid = String(extracted.nid || extracted.national_id || nid || '').trim();
      const nextCitizenship = String(
        extracted.citizenship_no || extracted.citizenship || citizenshipNo || ''
      ).trim();

      if (nextNid) {
        setNid(nextNid);
      }
      if (nextCitizenship) {
        setCitizenshipNo(nextCitizenship);
      }

      if (nextNid && nextCitizenship) {
        await handleLoginWithPayload(nextNid, nextCitizenship);
      } else {
        Toast.show({
          type: 'info',
          text1: 'Scan Captured',
          text2: ocrResult.message || 'Please review extracted data and continue login.',
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Scan Failed',
        text2: error?.message || 'Unable to process document scan.',
      });
    } finally {
      setLoading(false);
    }
  };

  const openIdentityScanChooser = () => {
    Alert.alert('Scan Identity Document', 'Choose the document to scan', [
      { text: 'National ID', onPress: () => runDocumentScan('nid') },
      { text: 'Citizenship Card', onPress: () => runDocumentScan('citizenship') },
      { text: 'Driving License', onPress: () => runDocumentScan('license') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Asymmetric Hero Panel */}
          <View style={styles.heroPanel}>
            <LinearGradient
              colors={[Colors.primaryContainer, Colors.primary]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />
            {/* Glow orbs */}
            <View style={styles.glowTR} />
            <View style={styles.glowBL} />
            <View style={{ position: 'relative', zIndex: 1 }}>
              <View style={styles.secureBadge}>
                <Text style={styles.secureBadgeText}>Secure Access</Text>
              </View>
              <Text style={styles.heroTitle}>Citizen{'\n'}Login</Text>
              <Text style={styles.heroDesc}>
                Access municipal services, track applications, and engage with your city governance.
              </Text>
            </View>
          </View>

          {/* Ward Badge */}
          <View style={styles.wardBadge}>
            <Text style={styles.wardBadgeText}>WARD BADGE: 09</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Personal Identity</Text>
            <Text style={styles.formSubtitle}>Enter your government issued credentials</Text>

            {/* NID Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>National Identity Number (NID)</Text>
              <View style={styles.fieldRow}>
                <TextInput
                  style={styles.input}
                  placeholder="123-456-789-0"
                  placeholderTextColor={Colors.outline}
                  value={nid}
                  onChangeText={setNid}
                  keyboardType="numeric"
                  returnKeyType="next"
                  onSubmitEditing={() => citizenshipRef.current?.focus()}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity style={styles.scanBtn} onPress={openIdentityScanChooser}>
                  <MaterialIcons name="camera-enhance" size={22} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Citizenship Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Citizenship Number</Text>
              <View style={styles.fieldRow}>
                <TextInput
                  ref={citizenshipRef}
                  style={styles.input}
                  placeholder="01-02-03-04567"
                  placeholderTextColor={Colors.outline}
                  value={citizenshipNo}
                  onChangeText={setCitizenshipNo}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity style={styles.scanBtn} onPress={openIdentityScanChooser}>
                  <MaterialIcons name="photo-camera" size={22} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
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

            <TouchableOpacity style={styles.forgotLink}>
              <Text style={styles.forgotText}>Forgot ID?</Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Actions */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  heroPanel: {
    borderRadius: Radius.xxl, padding: 28, marginBottom: 16,
    overflow: 'hidden', minHeight: 220,
    justifyContent: 'flex-end',
  },
  glowTR: {
    position: 'absolute', top: -60, right: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  glowBL: {
    position: 'absolute', bottom: -50, left: -50,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(0,59,90,0.25)',
  },
  secureBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,59,90,0.3)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: Radius.full, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  secureBadgeText: {
    color: 'rgba(203,230,255,0.9)', fontSize: 10,
    fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 44, fontWeight: '900', color: '#fff',
    letterSpacing: -1, lineHeight: 48, marginBottom: 10,
  },
  heroDesc: {
    fontSize: 13, color: 'rgba(148,197,238,0.85)', lineHeight: 20,
  },
  wardBadge: {
    alignSelf: 'flex-end', marginBottom: 12,
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.md,
  },
  wardBadgeText: {
    color: Colors.onPrimaryFixedVariant, fontSize: 10,
    fontWeight: '700', letterSpacing: 0.8,
  },
  formCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.xxl, padding: 24, marginBottom: 14,
    ...Shadow.sm,
  },
  formTitle: { fontSize: 17, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  formSubtitle: { fontSize: 12, color: Colors.onSurfaceVariant, marginBottom: 24 },
  fieldGroup: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
  },
  fieldRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1, backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, paddingHorizontal: 18, paddingVertical: 14,
    fontSize: 15, color: Colors.onSurface,
    ...Shadow.sm,
  },
  scanBtn: {
    width: 52, height: 52, backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  loginBtn: {
    backgroundColor: Colors.primaryContainer,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: Radius.full,
    marginTop: 8, ...Shadow.md,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  forgotLink: { alignItems: 'center', marginTop: 16 },
  forgotText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  secondaryGrid: { flexDirection: 'row', gap: 12 },
  secondaryCard: {
    flex: 1, backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.xxl, padding: 20, ...Shadow.sm,
  },
  secIconBox: {
    width: 40, height: 40, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  secTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  secSub: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
});