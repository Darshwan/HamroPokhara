import React, { useState } from 'react';
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

const DOC_TYPES = [
  { value: 'SIFARIS',              label: 'सिफारिस',        icon: 'description'    },
  { value: 'TAX_CLEARANCE',        label: 'कर चुक्ता',      icon: 'receipt-long'   },
  { value: 'BIRTH_CERTIFICATE',    label: 'जन्मदर्ता',      icon: 'child-care'     },
  { value: 'INCOME_PROOF',         label: 'आय प्रमाण',      icon: 'monetization-on'},
  { value: 'RELATIONSHIP_CERT',    label: 'नाता प्रमाण',    icon: 'people'         },
  { value: 'BUSINESS_REGISTRATION',label: 'व्यवसाय दर्ता',  icon: 'storefront'     },
];

export default function RequestScreen({ navigation }: any) {
  const { citizen, addRequest } = useStore();
  const [docType, setDocType]   = useState('SIFARIS');
  const [purpose, setPurpose]   = useState('');
  const [phone, setPhone]       = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    if (!purpose.trim()) {
      Toast.show({ type: 'error', text1: 'Purpose Required', text2: 'Please describe the purpose of your request' });
      return;
    }
    if (!citizen) {
      Toast.show({ type: 'error', text1: 'Not Logged In', text2: 'Please login first' });
      return;
    }

    setLoading(true);
    try {
      const response = await citizenAPI.submitRequest({
        citizen_nid:    citizen.nid,
        citizen_name:   citizen.name,
        citizen_phone:  phone,
        document_type:  docType,
        purpose:        purpose.trim(),
        ward_code:      citizen.ward_code || 'NPL-04-33-09',
        additional_info: info,
      });

      if (response.success) {
        // Save to local storage so citizen can track it
        await addRequest({
          request_id:    response.request_id,
          document_type: docType,
          purpose:       purpose.trim(),
          status:        'PENDING',
          submitted_at:  response.submitted_at,
        });

        Toast.show({
          type: 'success',
          text1: 'Request Submitted!',
          text2: `ID: ${response.request_id}`,
        });

        // Reset form
        setPurpose('');
        setPhone('');
        setInfo('');

        // Navigate to track screen
        navigation.navigate('Track');
      } else {
        Toast.show({ type: 'error', text1: 'Failed', text2: response.message });
      }
    } catch (e: any) {
      // Demo mode fallback
      const demoId = `MS-2082-${String(Math.floor(Math.random() * 9000) + 1000).padStart(6, '0')}`;
      await addRequest({
        request_id:    demoId,
        document_type: docType,
        purpose:       purpose.trim(),
        status:        'PENDING',
        submitted_at:  new Date().toISOString(),
      });
      Toast.show({
        type: 'success',
        text1: 'Request Submitted (Demo)',
        text2: `ID: ${demoId}`,
      });
      navigation.navigate('Track');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Request Document</Text>
        <Text style={styles.headerSub}>सिफारिस अनुरोध</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Document Type */}
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

          {/* Citizen Info (auto-filled) */}
          <View style={styles.citizenInfo}>
            <MaterialIcons name="verified-user" size={16} color={Colors.success} />
            <Text style={styles.citizenInfoText}>
              {citizen?.name || 'Citizen'} · {citizen?.nid || '—'} · {citizen?.ward_code || '—'}
            </Text>
          </View>

          {/* Purpose */}
          <Text style={styles.fieldLabel}>Purpose / उद्देश्य</Text>
          <TextInput
            style={styles.textArea}
            placeholder="e.g., बैंक खाता खोल्नका लागि सिफारिस"
            placeholderTextColor={Colors.outline}
            value={purpose}
            onChangeText={setPurpose}
            multiline
            numberOfLines={3}
          />

          {/* Phone */}
          <Text style={styles.fieldLabel}>Phone / फोन नम्बर</Text>
          <TextInput
            style={styles.input}
            placeholder="98XXXXXXXX"
            placeholderTextColor={Colors.outline}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          {/* Additional Info */}
          <Text style={styles.fieldLabel}>Additional Details (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Any additional information..."
            placeholderTextColor={Colors.outline}
            value={info}
            onChangeText={setInfo}
          />

          {/* Info Box */}
          <View style={styles.infoBox}>
            <MaterialIcons name="info" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>
              Your request will be reviewed by the Ward Officer within 2 working days.
              You will receive a notification when your document is ready.
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={submit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="send" size={18} color="#fff" />
                <Text style={styles.submitText}>Submit Request</Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.background },
  header:           { padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  headerTitle:      { fontSize: 22, fontWeight: '900', color: Colors.primary },
  headerSub:        { fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 2 },
  content:          { padding: 20, paddingBottom: 40 },
  fieldLabel:       { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, marginTop: 16 },
  typeGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard:         { width: '31%', padding: 14, borderRadius: Radius.xl, backgroundColor: Colors.surfaceContainerLowest, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.surfaceContainerHigh },
  typeCardSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeLabel:        { fontSize: 11, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  typeLabelSelected:{ color: '#fff' },
  citizenInfo:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.successLight, padding: 12, borderRadius: Radius.lg, marginTop: 16, borderWidth: 1, borderColor: 'rgba(45,122,82,0.2)' },
  citizenInfoText:  { fontSize: 12, color: Colors.success, fontWeight: '600', flex: 1 },
  textArea:         { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 16, fontSize: 14, color: Colors.onSurface, minHeight: 90, textAlignVertical: 'top', ...Shadow.sm },
  input:            { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, paddingHorizontal: 18, paddingVertical: 14, fontSize: 14, color: Colors.onSurface, ...Shadow.sm },
  infoBox:          { flexDirection: 'row', gap: 10, backgroundColor: Colors.primaryFixed, padding: 14, borderRadius: Radius.lg, marginTop: 16, alignItems: 'flex-start' },
  infoText:         { fontSize: 12, color: Colors.onPrimaryFixedVariant, lineHeight: 18, flex: 1 },
  submitBtn:        { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: Radius.full, marginTop: 24, ...Shadow.lg },
  submitText:       { color: '#fff', fontSize: 16, fontWeight: '700' },
});