import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Toast from 'react-native-toast-message';
import { Colors, Radius, Shadow, Typography } from '../constants/theme';
import { useStore } from '../store/useStore';
import { citizenAPI } from '../api/client';
import AppHeader from '../components/AppHeader';
import {
  buildLocalSifarisDraft,
  enhancePurposeAndSuggestDetails,
  generateNepaliSifarisDraft,
  SifarisDraft,
} from '../utils/geminiSifaris';

type TemplateId =
  | 'general'
  | 'residence'
  | 'relationship'
  | 'income'
  | 'citizenship'
  | 'character';

const TEMPLATES: Array<{
  id: TemplateId;
  label: string;
  labelNE: string;
  helperEN: string;
  helperNE: string;
}> = [
  {
    id: 'general',
    label: 'General Recommendation',
    labelNE: 'सामान्य सिफारिस',
    helperEN: 'General ward recommendation for official submission',
    helperNE: 'सम्बन्धित निकायमा पेश गर्न सामान्य सिफारिस आवश्यक परेको।',
  },
  {
    id: 'residence',
    label: 'Residence Verification',
    labelNE: 'बसोबास प्रमाण',
    helperEN: 'Residence verification for official process',
    helperNE: 'उक्त ठेगानामा स्थायी/अस्थायी बसोबास पुष्टि गर्न सिफारिस आवश्यक परेको।',
  },
  {
    id: 'relationship',
    label: 'Relationship Proof',
    labelNE: 'नाता प्रमाण',
    helperEN: 'Family relationship verification letter',
    helperNE: 'पारिवारिक नाता पुष्टि गर्न आधिकारिक सिफारिस आवश्यक परेको।',
  },
  {
    id: 'income',
    label: 'Income Certificate',
    labelNE: 'आय प्रमाण',
    helperEN: 'Income verification for public service process',
    helperNE: 'सेवा/सुविधा प्रयोजनका लागि आय विवरण पुष्टि सिफारिस आवश्यक परेको।',
  },
  {
    id: 'citizenship',
    label: 'Citizenship Support',
    labelNE: 'नागरिकता सहयोग',
    helperEN: 'Ward recommendation for citizenship processing',
    helperNE: 'नागरिकता सम्बन्धी प्रक्रिया पूरा गर्न वडा सिफारिस आवश्यक परेको।',
  },
  {
    id: 'character',
    label: 'Character Certificate',
    labelNE: 'चरित्र प्रमाण',
    helperEN: 'Character verification for official purpose',
    helperNE: 'आधिकारिक प्रयोजनका लागि असल चालचलन सम्बन्धी सिफारिस आवश्यक परेको।',
  },
];

const AI_HINTS = [
  {
    ne: 'वडा कार्यालय शैलीको औपचारिक भाषा',
    en: 'Formal ward-office language',
  },
  {
    ne: 'अपूर्ण विवरण छुट्टै देखाउँछ',
    en: 'Highlights missing details',
  },
  {
    ne: 'तथ्यमा आधारित, छोटो र विनम्र निवेदन',
    en: 'Fact-based, concise, respectful draft',
  },
];

const pickTemplate = (templateId: TemplateId) => TEMPLATES.find((item) => item.id === templateId) || TEMPLATES[0];

const buildFallbackExtraDetails = (template: { helperNE: string }) => [
  template.helperNE,
  'आवश्यक कागजातको प्रतिलिपि संलग्न गरिएको।',
  'आवश्यक परे थप प्रमाण तथा स्थल सत्यापन उपलब्ध गराइनेछ।',
];

const buildFallbackRequestId = () => `SFR-${Date.now()}`;

export default function SifarisRequestScreen({ navigation }: any) {
  const { citizen, language, addRequest } = useStore();

  const [templateId, setTemplateId] = useState<TemplateId>('general');
  const [applicantName, setApplicantName] = useState(citizen?.name || '');
  const [citizenshipNo, setCitizenshipNo] = useState('');
  const [wardCode, setWardCode] = useState(citizen?.ward_code || 'NPL-04-33-09');
  const [tole, setTole] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [draft, setDraft] = useState<SifarisDraft | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [purposeAiLoading, setPurposeAiLoading] = useState(false);
  const [extraDetailOptions, setExtraDetailOptions] = useState<string[]>(buildFallbackExtraDetails(TEMPLATES[0]));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (citizen) {
      setApplicantName(citizen.name || '');
      setWardCode(citizen.ward_code || 'NPL-04-33-09');
    }
  }, [citizen]);

  const selectedTemplate = useMemo(() => pickTemplate(templateId), [templateId]);
  const lang = language;

  useEffect(() => {
    setExtraDetailOptions(buildFallbackExtraDetails(selectedTemplate));
  }, [selectedTemplate]);

  const createDraftInput = () => ({
    applicantName,
    citizenshipNo,
    wardCode,
    tole,
    phone,
    purpose: purpose || (lang === 'ne' ? selectedTemplate.helperNE : selectedTemplate.helperEN),
    extraNotes,
    templateLabel: selectedTemplate.labelNE,
  });

  const ensureDraft = async () => {
    const input = createDraftInput();
    setAiLoading(true);
    try {
      const generated = await generateNepaliSifarisDraft(input);
      setDraft(generated);

      if (!purpose.trim()) {
        setPurpose(generated.summary || selectedTemplate.helperNE);
      }

      if (!applicantName.trim() && citizen?.name) {
        setApplicantName(citizen.name);
      }

      Toast.show({
        type: 'success',
        text1: lang === 'ne' ? 'AI सिफारिस तयार भयो' : 'AI draft ready',
        text2: lang === 'ne' ? 'समीक्षा गरेर submit गर्न सक्नुहुन्छ।' : 'Review the draft and submit when ready.',
      });
    } catch {
      const local = buildLocalSifarisDraft(input);
      setDraft(local);
      Toast.show({
        type: 'info',
        text1: lang === 'ne' ? 'स्थानीय ड्राफ्ट तयार भयो' : 'Local draft ready',
        text2: lang === 'ne' ? 'Gemini key नहुँदा fallback प्रयोग गरियो।' : 'Fallback used because the Gemini key is missing.',
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handlePurposeAiAssist = async () => {
    if (!purpose.trim()) {
      Toast.show({
        type: 'info',
        text1: lang === 'ne' ? 'पहिले उद्देश्य लेख्नुहोस्' : 'Write purpose first',
        text2: lang === 'ne' ? 'Roman Nepali वा मिश्रित text लेखेर Gemini चलाउनुहोस्।' : 'Enter Roman Nepali or mixed text and run Gemini.',
      });
      return;
    }

    setPurposeAiLoading(true);
    try {
      const assisted = await enhancePurposeAndSuggestDetails({
        romanPurpose: purpose,
        templateLabel: selectedTemplate.labelNE,
        wardCode,
        tole,
      });

      setPurpose(assisted.formalPurpose);
      setExtraDetailOptions(assisted.extraDetailSuggestions);

      if (!extraNotes.trim()) {
        setExtraNotes(assisted.extraDetailSuggestions.map((item) => `- ${item}`).join('\n'));
      }

      Toast.show({
        type: 'success',
        text1: lang === 'ne' ? 'उद्देश्य परिमार्जन भयो' : 'Purpose refined',
        text2: lang === 'ne' ? 'औपचारिक नेपालीमा रूपान्तरण र अतिरिक्त विकल्प तयार गरियो।' : 'Converted to formal Nepali and extra-detail options were prepared.',
      });
    } catch {
      setExtraDetailOptions(buildFallbackExtraDetails(selectedTemplate));
      Toast.show({
        type: 'info',
        text1: lang === 'ne' ? 'स्थानीय सुझाव देखाइयो' : 'Local suggestions shown',
        text2: lang === 'ne' ? 'Gemini उपलब्ध नभए fallback विकल्प प्रयोग भयो।' : 'Gemini unavailable, fallback options were used.',
      });
    } finally {
      setPurposeAiLoading(false);
    }
  };

  const appendExtraDetailOption = (option: string) => {
    setExtraNotes((previous) => {
      const normalized = previous.trim();
      if (normalized.includes(option)) {
        return previous;
      }
      return normalized ? `${normalized}\n- ${option}` : `- ${option}`;
    });
  };

  const submitSifaris = async () => {
    if (!citizen) {
      Toast.show({
        type: 'error',
        text1: lang === 'ne' ? 'लगइन आवश्यक छ' : 'Login required',
        text2: lang === 'ne' ? 'डिजिटल सिफारिस पेश गर्न पहिले लगइन गर्नुहोस्।' : 'Please login before submitting a digital sifaris.',
      });
      return;
    }

    if (!applicantName.trim() || !purpose.trim()) {
      Toast.show({
        type: 'error',
        text1: lang === 'ne' ? 'आवश्यक विवरण अपूर्ण' : 'Missing required details',
        text2: lang === 'ne' ? 'नाम र उद्देश्य अनिवार्य छन्।' : 'Name and purpose are required.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const currentDraft = draft || buildLocalSifarisDraft(createDraftInput());
      const requestId = buildFallbackRequestId();
      const response = await citizenAPI.submitRequest({
        citizen_nid: citizen.nid,
        citizen_name: applicantName.trim(),
        citizen_phone: phone.trim(),
        document_type: 'SIFARIS',
        purpose: currentDraft.subject,
        ward_code: wardCode.trim() || citizen.ward_code || 'NPL-04-33-09',
        additional_info: [
          `टोल / ठेगाना: ${tole.trim() || 'उल्लेख छैन'}`,
          `नागरिकता नं.: ${citizenshipNo.trim() || 'उल्लेख छैन'}`,
          `AI ड्राफ्ट: ${currentDraft.body}`,
        ].join('\n\n'),
      });

      if (!response.success) {
        throw new Error(response.message || 'Request failed');
      }

      await addRequest({
        request_id: response.request_id || requestId,
        document_type: 'SIFARIS',
        purpose: currentDraft.subject,
        status: 'PENDING',
        submitted_at: response.submitted_at || new Date().toISOString(),
        category: 'citizen',
        details: currentDraft.body,
      });

      Toast.show({
        type: 'success',
        text1: lang === 'ne' ? 'सिफारिस पेश भयो' : 'Sifaris submitted',
        text2: response.request_id ? `ID: ${response.request_id}` : undefined,
      });

      navigation.navigate('Track');
    } catch {
      const fallbackId = buildFallbackRequestId();
      const currentDraft = draft || buildLocalSifarisDraft(createDraftInput());

      await addRequest({
        request_id: fallbackId,
        document_type: 'SIFARIS',
        purpose: currentDraft.subject,
        status: 'PENDING',
        submitted_at: new Date().toISOString(),
        category: 'citizen',
        details: currentDraft.body,
      });

      Toast.show({
        type: 'info',
        text1: lang === 'ne' ? 'डेमो रूपमा सुरक्षित भयो' : 'Saved in demo mode',
        text2: lang === 'ne' ? 'ब्याकएन्ड नभए पनि ट्र्याकमा देखिनेछ।' : 'It will still appear in the tracker.',
      });

      navigation.navigate('Track');
    } finally {
      setSubmitting(false);
    }
  };

  const currentDraft = draft || buildLocalSifarisDraft(createDraftInput());

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title={lang === 'ne' ? 'डिजिटल सिफारिस' : 'Digital Sifaris'} showMenu={false} showLang showBack={navigation.canGoBack?.()} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{lang === 'ne' ? 'डिजिटल सिफारिस' : 'Digital Sifaris'}</Text>
              </View>
              <MaterialIcons name="description" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.heroTitle}>{lang === 'ne' ? 'AI-सहायता प्राप्त सिफारिस' : 'AI-assisted Sifaris'}</Text>
            <Text style={styles.heroSubtitle}>
              {lang === 'ne'
                ? 'फारम भर्नुहोस्, AI बाट औपचारिक नेपाली ड्राफ्ट बनाउनुहोस्, अनि सिधै submit गर्नुहोस्।'
                : 'Fill the form, generate a formal Nepali draft with AI, and submit directly.'}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{lang === 'ne' ? 'सिफारिस प्रकार' : 'Sifaris type'}</Text>
            <View style={styles.selectWrap}>
              <Picker
                selectedValue={templateId}
                onValueChange={(value) => setTemplateId(value as TemplateId)}
                style={styles.selectControl}
              >
                {TEMPLATES.map((template) => (
                  <Picker.Item
                    key={template.id}
                    label={lang === 'ne' ? template.labelNE : template.label}
                    value={template.id}
                  />
                ))}
              </Picker>
            </View>
            <Text style={styles.selectHelperText}>{lang === 'ne' ? selectedTemplate.helperNE : selectedTemplate.helperEN}</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{lang === 'ne' ? 'आवेदक विवरण' : 'Applicant details'}</Text>
              <TouchableOpacity style={styles.aiButton} onPress={ensureDraft} activeOpacity={0.9}>
                {aiLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="auto-awesome" size={16} color="#fff" />
                    <Text style={styles.aiButtonText}>{lang === 'ne' ? 'AI ड्राफ्ट' : 'AI draft'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{lang === 'ne' ? 'पूरा नाम' : 'Full name'}</Text>
              <TextInput
                style={styles.input}
                placeholder={lang === 'ne' ? 'आवेदकको नाम' : 'Applicant name'}
                placeholderTextColor={Colors.outline}
                value={applicantName}
                onChangeText={setApplicantName}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{lang === 'ne' ? 'नागरिकता नम्बर' : 'Citizenship no.'}</Text>
              <TextInput
                style={styles.input}
                placeholder="NPL-04-33-09-000001"
                placeholderTextColor={Colors.outline}
                value={citizenshipNo}
                onChangeText={setCitizenshipNo}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inlineRow}>
              <View style={[styles.fieldBlock, { flex: 1, marginRight: 10 }]}> 
                <Text style={styles.fieldLabel}>{lang === 'ne' ? 'वार्ड कोड' : 'Ward code'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="NPL-04-33-09"
                  placeholderTextColor={Colors.outline}
                  value={wardCode}
                  onChangeText={setWardCode}
                  autoCapitalize="characters"
                />
              </View>
              <View style={[styles.fieldBlock, { flex: 1 }]}> 
                <Text style={styles.fieldLabel}>{lang === 'ne' ? 'फोन नम्बर' : 'Phone no.'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="98XXXXXXXX"
                  placeholderTextColor={Colors.outline}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{lang === 'ne' ? 'टोल / ठेगाना' : 'Tole / address'}</Text>
              <TextInput
                style={styles.input}
                placeholder={lang === 'ne' ? 'उदाहरण: लेकसाइड, वार्ड ६' : 'Example: Lakeside, Ward 6'}
                placeholderTextColor={Colors.outline}
                value={tole}
                onChangeText={setTole}
              />
            </View>

            <View style={styles.fieldBlock}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>{lang === 'ne' ? 'उद्देश्य' : 'Purpose'}</Text>
                <TouchableOpacity
                  style={styles.smallAiButton}
                  onPress={handlePurposeAiAssist}
                  disabled={purposeAiLoading}
                  activeOpacity={0.9}
                >
                  {purposeAiLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialIcons name="auto-awesome" size={15} color="#fff" />
                  )}
                  <Text style={styles.smallAiButtonText}>{lang === 'ne' ? 'Nepali बनाउनुहोस्' : 'Formal Nepali'}</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.textArea}
                placeholder={lang === 'ne' ? 'सिफारिस चाहिएको कारण लेख्नुहोस्' : 'Describe why you need the sifaris'}
                placeholderTextColor={Colors.outline}
                value={purpose}
                onChangeText={setPurpose}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{lang === 'ne' ? 'अतिरिक्त विवरण' : 'Extra notes'}</Text>
              <TextInput
                style={styles.textAreaSmall}
                placeholder={lang === 'ne' ? 'AI ले ड्राफ्टमा समेट्ने जानकारी' : 'Optional notes for the AI draft'}
                placeholderTextColor={Colors.outline}
                value={extraNotes}
                onChangeText={setExtraNotes}
                multiline
                numberOfLines={3}
              />
              <Text style={styles.extraSuggestionTitle}>{lang === 'ne' ? 'AI सुझाव (कम्तीमा ३)' : 'AI suggestions (at least 3)'}</Text>
              <View style={styles.extraSuggestionRow}>
                {extraDetailOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.extraSuggestionChip}
                    onPress={() => appendExtraDetailOption(option)}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="add" size={14} color={Colors.primary} />
                    <Text style={styles.extraSuggestionChipText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{lang === 'ne' ? 'AI सुझावहरू' : 'AI hints'}</Text>
            <View style={styles.hintRow}>
              {AI_HINTS.map((hint) => (
                <View key={hint.en} style={styles.hintChip}>
                  <Text style={styles.hintChipText}>{lang === 'ne' ? hint.ne : hint.en}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.helperText}>
              {lang === 'ne'
                ? 'Gemini API key भएमा सामग्री smart draft मा रूपान्तरण हुन्छ। नभए स्थानीय Nepali fallback प्रयोग हुन्छ।'
                : 'When the Gemini API key is available, the form is converted into a smart draft. Otherwise a local Nepali fallback is used.'}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{lang === 'ne' ? 'सिफारिस पूर्वावलोकन' : 'Draft preview'}</Text>
              <TouchableOpacity style={styles.ghostButton} onPress={ensureDraft} activeOpacity={0.85}>
                <MaterialIcons name="refresh" size={16} color={Colors.primary} />
                <Text style={styles.ghostButtonText}>{lang === 'ne' ? 'पुनः तयार गर्नुहोस्' : 'Regenerate'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewBox}>
              <Text style={styles.previewSubject}>{currentDraft.subject}</Text>
              <Text style={styles.previewBody}>{currentDraft.body}</Text>
            </View>

            <Text style={styles.previewSummary}>{currentDraft.summary}</Text>

            {currentDraft.missingFields.length > 0 && (
              <View style={styles.missingBox}>
                <Text style={styles.missingTitle}>{lang === 'ne' ? 'अपूर्ण विवरण' : 'Missing details'}</Text>
                <Text style={styles.missingText}>{currentDraft.missingFields.join(' · ')}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && { opacity: 0.75 }]}
            onPress={submitSifaris}
            disabled={submitting}
            activeOpacity={0.9}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="send" size={18} color="#fff" />
                <Text style={styles.submitText}>{lang === 'ne' ? 'सिफारिस submit गर्नुहोस्' : 'Submit sifaris'}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>
              {lang === 'ne'
                ? 'सबमिट भएपछि request tracker मा देखिनेछ।'
                : 'After submission, it will appear in the request tracker.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 14,
  },
  hero: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 16,
    ...Shadow.sm,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroBadge: {
    backgroundColor: Colors.primaryFixed,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  heroTitle: {
    ...Typography.h2,
    color: Colors.primary,
    marginBottom: 8,
  },
  heroSubtitle: {
    ...Typography.body,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 16,
    gap: 12,
    ...Shadow.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.onSurface,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  selectWrap: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    overflow: 'hidden',
  },
  selectControl: {
    color: Colors.onSurface,
  },
  selectHelperText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
  templateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  templateChip: {
    width: '48.5%',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  templateChipActive: {
    backgroundColor: Colors.primaryFixed,
    borderColor: Colors.primaryFixedDim,
  },
  templateChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
    marginBottom: 4,
  },
  templateChipTextActive: {
    color: Colors.primary,
  },
  templateChipHint: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    lineHeight: 16,
  },
  templateChipHintActive: {
    color: Colors.onPrimaryFixedVariant,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.onSurface,
  },
  textArea: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.onSurface,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  textAreaSmall: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.onSurface,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  smallAiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallAiButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  extraSuggestionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  extraSuggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  extraSuggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryFixed,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  extraSuggestionChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  hintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hintChip: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hintChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  helperText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  ghostButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  previewBox: {
    backgroundColor: '#f9fbfd',
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 10,
  },
  previewSubject: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  previewBody: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.onSurface,
  },
  previewSummary: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
  missingBox: {
    backgroundColor: Colors.goldLight,
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(200,168,75,0.24)',
  },
  missingTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 4,
  },
  missingText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    ...Shadow.md,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  footerNote: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  footerNoteText: {
    fontSize: 11,
    color: Colors.outline,
  },
});
