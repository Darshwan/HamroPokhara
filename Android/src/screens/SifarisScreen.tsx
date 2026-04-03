import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { citizenAPI } from '../api/client';
import { PDFPreviewModal } from '../components/PDFPreviewModal';
import { PDFDocumentData } from '../utils/pdfGenerator';
import AppHeader from '../components/AppHeader';
import OCRHybridScreen from './OCRHybridScreen';
import {
  analyzeApplicantInput,
  ApplicantAnalysis,
  ApplicantFieldKey,
  buildFieldLabel,
  buildFollowUpPlaceholder,
  buildFollowUpPrompt,
} from '../utils/applicationComposer';

// Sifaris Categories Data Structure
const SIFARIS_CATEGORIES = {
  personal: {
    label: 'व्यक्तिगत तथा परिचय सम्बन्धी सिफारिस',
    label_en: 'Personal & Identification',
    subcategories: [
      { value: 'citizenship', label: 'नागरिकता सिफारिस', label_en: 'Citizenship Certificate' },
      { value: 'residence', label: 'बसोबास (स्थायी/अस्थायी) सिफारिस', label_en: 'Residence Certificate' },
      { value: 'birth', label: 'जन्म दर्ता सिफारिस', label_en: 'Birth Registration Certificate' },
      { value: 'marriage', label: 'विवाह दर्ता सिफारिस', label_en: 'Marriage Registration Certificate' },
      { value: 'relationship', label: 'सम्बन्ध प्रमाणित सिफारिस', label_en: 'Relationship Confirmation' },
      {
        value: 'correction',
        label: 'नाम, थर, उमेर सच्याउने सिफारिस',
        label_en: 'Name/Age Correction Certificate',
      },
    ],
  },
  residence: {
    label: 'बसोबास तथा स्थानान्तरण सम्बन्धी',
    label_en: 'Residence & Transfer',
    subcategories: [
      { value: 'transfer', label: 'बसाइँसराइ सिफारिस', label_en: 'Transfer/Migration Certificate' },
      {
        value: 'address',
        label: 'घर कायम (ठेगाना प्रमाणित) सिफारिस',
        label_en: 'Address Verification Certificate',
      },
      {
        value: 'land_residence',
        label: 'जग्गा बसोबास प्रमाणित सिफारिस',
        label_en: 'Land Residence Verification',
      },
    ],
  },
  economic: {
    label: 'आर्थिक तथा सामाजिक अवस्था सम्बन्धी',
    label_en: 'Economic & Social Status',
    subcategories: [
      { value: 'economic_poor', label: 'विपन्न/आर्थिक अवस्था कमजोर सिफारिस', label_en: 'Economic Hardship Certificate' },
      { value: 'unemployment', label: 'बेरोजगार सिफारिस', label_en: 'Unemployment Certificate' },
      { value: 'scholarship', label: 'छात्रवृत्ति सिफारिस', label_en: 'Scholarship Certificate' },
      { value: 'relief', label: 'राहत सिफारिस', label_en: 'Relief Certificate' },
    ],
  },
  property: {
    label: 'जग्गा तथा सम्पत्ति सम्बन्धी',
    label_en: 'Land & Property',
    subcategories: [
      { value: 'house_path', label: 'घर बाटो सिफारिस', label_en: 'House Access Route Certificate' },
      { value: 'boundary', label: 'चारकिल्ला प्रमाणित सिफारिस', label_en: 'Boundary Verification' },
      { value: 'land_transfer', label: 'जग्गा नामसारी सिफारिस', label_en: 'Land Transfer Certificate' },
      { value: 'construction', label: 'भवन निर्माण सिफारिस', label_en: 'Building Construction Certificate' },
    ],
  },
  legal: {
    label: 'कानुनी तथा प्रशासनिक प्रयोजनका लागि',
    label_en: 'Legal & Administrative',
    subcategories: [
      { value: 'court', label: 'अदालतका लागि सिफारिस', label_en: 'Court Certificate' },
      { value: 'police', label: 'प्रहरी रिपोर्ट सिफारिस', label_en: 'Police Report Certificate' },
      { value: 'foreign_employment', label: 'वैदेशिक रोजगारी सिफारिस', label_en: 'Foreign Employment Certificate' },
      { value: 'passport', label: 'पासपोर्ट सिफारिस', label_en: 'Passport Certificate' },
    ],
  },
  miscellaneous: {
    label: 'अन्य विविध सिफारिसहरू',
    label_en: 'Miscellaneous',
    subcategories: [
      { value: 'business', label: 'व्यवसाय दर्ता सिफारिस', label_en: 'Business Registration Certificate' },
      { value: 'school', label: 'विद्यालय भर्ना सिफारिस', label_en: 'School Enrollment Certificate' },
      { value: 'health', label: 'स्वास्थ्य सम्बन्धी सिफारिस', label_en: 'Health Certificate' },
      { value: 'elderly_disabled', label: 'वृद्ध/अपाङ्गता सिफारिस', label_en: 'Senior/Disability Certificate' },
    ],
  },
};

const getAiFallbackSuggestion = (language: 'ne' | 'en') =>
  language === 'ne'
    ? 'अहिले AI सेवा उपलब्ध छैन। कृपया सिफारिसमा प्रयोजन, सम्बन्धित कागजात, वार्ड विवरण, र सम्पर्क नम्बर समावेश गर्नुहोस्।'
    : 'AI is unavailable right now. Please include the purpose, supporting documents, ward details, and contact number in the request.';

type MainCategory = keyof typeof SIFARIS_CATEGORIES;
type SubcategoryValue = string;

export default function SifarisScreen({ navigation }: any) {
  const { citizen, isTourist, addRequest, language } = useStore();

  // Form state
  const [mainCategory, setMainCategory] = useState<MainCategory | null>(null);
  const [subcategory, setSubcategory] = useState<SubcategoryValue | null>(null);
  const [purpose, setPurpose] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [pdfData, setPdfData] = useState<PDFDocumentData | null>(null);
  const [rawTextInput, setRawTextInput] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [showOCRScanner, setShowOCRScanner] = useState(false);
  const [analysis, setAnalysis] = useState<ApplicantAnalysis | null>(null);
  const [followUpAnswers, setFollowUpAnswers] = useState<Partial<Record<ApplicantFieldKey, string>>>({});

  // Reset subcategory when main category changes
  useEffect(() => {
    setSubcategory(null);
    setAnalysis(null);
    setFollowUpAnswers({});
  }, [mainCategory]);

  const getMainCategories = () => {
    return Object.entries(SIFARIS_CATEGORIES).map(([key, data]) => ({
      key: key as MainCategory,
      label: language === 'ne' ? data.label : data.label_en,
    }));
  };

  const getSubcategories = () => {
    if (!mainCategory) return [];
    const cat = SIFARIS_CATEGORIES[mainCategory];
    return cat.subcategories.map((sub) => ({
      value: sub.value,
      label: language === 'ne' ? sub.label : sub.label_en,
    }));
  };

  const getSubcategoryLabel = (subValue: string) => {
    if (!mainCategory) return '';
    const sub = SIFARIS_CATEGORIES[mainCategory].subcategories.find((s) => s.value === subValue);
    return sub ? (language === 'ne' ? sub.label : sub.label_en) : '';
  };

  const getMainCategoryLabel = (mainKey: MainCategory) => {
    const cat = SIFARIS_CATEGORIES[mainKey];
    return language === 'ne' ? cat.label : cat.label_en;
  };

  const buildAIInputPayload = (extraSupportDetails?: string) => {
    const selectedMainLabel = mainCategory ? getMainCategoryLabel(mainCategory) : '';
    const selectedSubLabel = subcategory ? getSubcategoryLabel(subcategory) : '';
    const fallbackWard = String((citizen as any)?.ward_code || '');
    const sourceMerged = [
      rawTextInput.trim(),
      ocrText.trim(),
      extraSupportDetails?.trim() || '',
    ].filter(Boolean).join('\n\n');

    return {
      applicantName: String((citizen as any)?.name || ''),
      address: String((citizen as any)?.address || (citizen as any)?.tole || ''),
      wardCode: fallbackWard ? `वडा नं. ${fallbackWard}` : '',
      officeName: 'श्रीमान् वडा अध्यक्षज्यू, वडा कार्यालय पोखरा महानगरपालिका',
      subject: selectedSubLabel ? `${selectedSubLabel} सम्बन्धी निवेदन` : 'सिफारिस सम्बन्धी निवेदन',
      purpose: purpose.trim(),
      supportingDetails: (extraSupportDetails || additionalInfo).trim(),
      phone: String((citizen as any)?.phone || ''),
      citizenshipNo: String((citizen as any)?.nid || ''),
      rawText: sourceMerged,
      audioTranscript: '',
      ocrText: ocrText.trim(),
      recommendationLabel: selectedSubLabel,
      categoryLabel: selectedMainLabel,
      language: 'ne' as const,
    };
  };

  const applyOCRResult = (ocrResult: any) => {
    const merged = [
      ocrResult?.name ? `नाम: ${ocrResult.name}` : '',
      ocrResult?.citizenshipNo ? `नागरिकता नं.: ${ocrResult.citizenshipNo}` : '',
      ocrResult?.nid ? `NID: ${ocrResult.nid}` : '',
      ocrResult?.dob ? `जन्म मिति: ${ocrResult.dob}` : '',
      ocrResult?.nationality ? `राष्ट्रियता: ${ocrResult.nationality}` : '',
    ].filter(Boolean).join('\n');

    if (merged) {
      setOcrText(merged);
      setRawTextInput((current) => [current.trim(), merged].filter(Boolean).join('\n\n'));
      Toast.show({
        type: 'success',
        text1: language === 'ne' ? 'OCR सफल भयो' : 'OCR completed',
        text2: language === 'ne' ? 'स्क्यान गरिएको विवरण समावेश गरियो।' : 'Scanned details were added.',
      });
    }
    setShowOCRScanner(false);
  };

  const handleAiAssistance = async () => {
    if (!mainCategory || !subcategory) {
      Toast.show({
        type: 'error',
        text1: 'Selection Required',
        text2: 'Please select both category and type',
      });
      return;
    }

    setAiLoading(true);

    try {
      const analysisResult = await analyzeApplicantInput(buildAIInputPayload());
      setAnalysis(analysisResult);
      setPurpose(analysisResult.purpose || purpose);
      setAdditionalInfo(analysisResult.supportingDetails || additionalInfo);

      Toast.show({
        type: 'success',
        text1: language === 'ne' ? 'AI विश्लेषण पूरा भयो' : 'AI analysis completed',
        text2: analysisResult.missingFields.length
          ? (language === 'ne' ? 'थप प्रश्नको उत्तर दिएर फेरि Generate गर्नुहोस्।' : 'Answer follow-up questions and regenerate.')
          : (language === 'ne' ? 'निवेदन तयार छ, अब Preview गर्नुहोस्।' : 'Application is ready. Preview now.'),
      });
    } catch (error) {
      console.error('AI Assistance Error:', error);
      Toast.show({
        type: 'info',
        text1: language === 'ne' ? 'स्थानीय विश्लेषण प्रयोग गरियो' : 'Used local fallback analysis',
        text2: getAiFallbackSuggestion(language as 'ne' | 'en'),
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleRegenerateWithFollowUps = async () => {
    const mergedFollowUps = Object.entries(followUpAnswers)
      .map(([field, value]) => {
        const cleanValue = String(value || '').trim();
        if (!cleanValue) return '';
        const label = buildFieldLabel(field as ApplicantFieldKey, language as 'ne' | 'en');
        return `${label}: ${cleanValue}`;
      })
      .filter(Boolean)
      .join('\n');

    if (!mergedFollowUps) {
      Toast.show({
        type: 'info',
        text1: language === 'ne' ? 'उत्तर चाहिन्छ' : 'Answers needed',
        text2: language === 'ne' ? 'कम्तीमा एउटा follow-up प्रश्नको उत्तर दिनुहोस्।' : 'Answer at least one follow-up question.',
      });
      return;
    }

    setAiLoading(true);
    try {
      const analysisResult = await analyzeApplicantInput(buildAIInputPayload(mergedFollowUps));
      setAnalysis(analysisResult);
      setPurpose(analysisResult.purpose || purpose);
      setAdditionalInfo(analysisResult.supportingDetails || additionalInfo);
      Toast.show({
        type: 'success',
        text1: language === 'ne' ? 'निवेदन अपडेट भयो' : 'Application updated',
      });
    } catch (error) {
      console.error('Follow-up regeneration failed:', error);
      Toast.show({
        type: 'error',
        text1: language === 'ne' ? 'अपडेट असफल' : 'Update failed',
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!analysis?.printHtml) {
      Toast.show({
        type: 'info',
        text1: language === 'ne' ? 'पहिले AI Generate गर्नुहोस्' : 'Generate with AI first',
      });
      return;
    }

    try {
      const file = await Print.printToFileAsync({
        html: analysis.printHtml,
        base64: false,
      });
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: language === 'ne' ? 'निवेदन PDF सेयर/डाउनलोड' : 'Share/Download application PDF',
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      Toast.show({
        type: 'error',
        text1: language === 'ne' ? 'PDF तयार हुन सकेन' : 'Unable to generate PDF',
      });
    }
  };

  const handleShowPreview = () => {
    if (!mainCategory || !subcategory) {
      Toast.show({
        type: 'error',
        text1: 'Selection Required',
        text2: 'Please select both category and type',
      });
      return;
    }

    if (!purpose.trim() && !additionalInfo.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Details Required',
        text2: 'Please provide request details',
      });
      return;
    }

    if (!citizen) {
      Toast.show({
        type: 'error',
        text1: 'Not Logged In',
        text2: 'Please login as a citizen to request Sifaris',
      });
      return;
    }

    if (!mainCategory) return;

    const generatedPurpose = analysis?.purpose || purpose.trim() || additionalInfo.trim();
    const generatedDetails = analysis?.applicationText || additionalInfo.trim();

    const pdfDocData: PDFDocumentData = {
      docType: `SIFARIS_${subcategory}`,
      docTypeLabel: `${getMainCategoryLabel(mainCategory)} - ${getSubcategoryLabel(subcategory)}`,
      nid: citizen.nid,
      citizenName: citizen.name,
      wardCode: citizen.ward_code || 'NPL-04-33-09',
      purpose: generatedPurpose,
      additionalInfo: generatedDetails || undefined,
    };

    setPdfData(pdfDocData);
    setShowPDFPreview(true);
  };

  const handleSubmitRequest = async () => {
    if (!citizen) {
      Toast.show({
        type: 'error',
        text1: 'Not Logged In',
        text2: 'Please login first',
      });
      setShowPDFPreview(false);
      return;
    }

    setLoading(true);

    try {
      const requestId = `SIF-${Date.now()}`;
      const selectedCategoryLabel = mainCategory ? getMainCategoryLabel(mainCategory) : '';
      const selectedSubcategoryLabel = subcategory ? getSubcategoryLabel(subcategory) : '';
      const generatedPurpose = analysis?.purpose || purpose.trim() || additionalInfo.trim();
      const generatedDetails = analysis?.applicationText || additionalInfo.trim();

      const backendPayload = {
        citizen_nid: citizen.nid,
        citizenship_no: citizen.citizenship_no,
        citizen_name: citizen.name,
        ward_code: citizen.ward_code || 'NPL-04-33-09',
        document_type: subcategory || 'SIFARIS',
        category: mainCategory,
        subcategory,
        category_label: selectedCategoryLabel,
        subcategory_label: selectedSubcategoryLabel,
        purpose: generatedPurpose,
        additional_info: generatedDetails,
        supporting_details: generatedDetails,
        raw_text: rawTextInput.trim(),
        ocr_text: ocrText.trim(),
        application_text: analysis?.applicationText || '',
      };

      const response = await citizenAPI.submitRequest(backendPayload);

      if (response?.success === false) {
        throw new Error(response?.message || 'Backend rejected Sifaris submission');
      }

      const backendRequestId = response?.request_id || requestId;
      const backendSubmittedAt = response?.submitted_at || new Date().toISOString();

      await addRequest({
        request_id: backendRequestId,
        document_type: subcategory || 'SIFARIS',
        purpose: generatedPurpose,
        status: 'PENDING',
        submitted_at: backendSubmittedAt,
        category: 'citizen',
        details: [
          `Category: ${selectedCategoryLabel}`,
          `Type: ${selectedSubcategoryLabel}`,
          `Ward: ${citizen.ward_code || 'NPL-04-33-09'}`,
          `Details: ${generatedDetails || 'None'}`,
        ].join(' • '),
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Your Sifaris request has been submitted',
      });

      // Reset form
      setMainCategory(null);
      setSubcategory(null);
      setPurpose('');
      setAdditionalInfo('');
      setRawTextInput('');
      setOcrText('');
      setAnalysis(null);
      setFollowUpAnswers({});
      setShowPDFPreview(false);

      // Navigate to tracker
      setTimeout(() => {
        navigation.navigate('Track');
      }, 1500);
    } catch (error) {
      console.error('Submit Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit request',
      });
    } finally {
      setLoading(false);
    }
  };

  if (isTourist) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title={language === 'ne' ? 'सिफारिस' : 'Sifaris'} />
        <View style={styles.centerContainer}>
          <MaterialIcons name="block" size={48} color={Colors.error} />
          <Text style={styles.errorText}>
            {language === 'ne' ? 'यो सेवा नागरिकहरूको लागि मात्र उपलब्ध छ' : 'This service is only for citizens'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!citizen) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title={language === 'ne' ? 'सिफारिस' : 'Sifaris'} />
        <View style={styles.centerContainer}>
          <MaterialIcons name="lock" size={48} color={Colors.primary} />
          <Text style={styles.label}>
            {language === 'ne' ? 'कृपया लगइन गर्नुहोस्' : 'Please log in'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title={language === 'ne' ? 'सिफारिस अनुरोध' : 'Sifaris Request'} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Citizen Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>
              {language === 'ne' ? 'नागरिक' : 'Citizen'}
            </Text>
            <Text style={styles.infoValue}>{citizen.name}</Text>
            <Text style={styles.infoSubtile}>{citizen.nid}</Text>
          </View>

          {/* Main Category Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {language === 'ne' ? 'सिफारिसको किसिम' : 'Sifaris Type'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {getMainCategories().map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryButton,
                    mainCategory === cat.key && styles.categoryButtonActive,
                  ]}
                  onPress={() => setMainCategory(cat.key)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      mainCategory === cat.key && styles.categoryButtonTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Subcategory Selection */}
          {mainCategory && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {language === 'ne' ? 'विशिष्ट किसिम' : 'Specific Type'}
              </Text>
              {getSubcategories().map((subcat) => (
                <TouchableOpacity
                  key={subcat.value}
                  style={[
                    styles.subcategoryButton,
                    subcategory === subcat.value && styles.subcategoryButtonActive,
                  ]}
                  onPress={() => setSubcategory(subcat.value)}
                >
                  <View style={styles.subcategoryContent}>
                    <MaterialIcons
                      name={subcategory === subcat.value ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={20}
                      color={Colors.primary}
                    />
                    <Text style={styles.subcategoryText}>{subcat.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Multi Input: Text */}
          <View style={styles.section}>
            <Text style={styles.label}>{language === 'ne' ? '१) टाइप गरेर विवरण' : '1) Typed Details'}</Text>
            <View style={styles.typingHintRow}>
              <MaterialIcons name="mic" size={16} color={Colors.primary} />
              <Text style={styles.typingHintText}>
                {language === 'ne'
                  ? 'किबोर्डको mic थिचेर Nepali बोल्नुहोस्, AI ले बाँकी विवरण मिलाउँछ।'
                  : 'Tap the mic on your keyboard and speak in Nepali. AI will handle the rest.'}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder={language === 'ne' ? 'घटनाको विवरण, निवेदनको कारण, स्थान आदि लेख्नुहोस्...' : 'Type details, context, purpose, place, and supporting notes...'}
              multiline
              numberOfLines={4}
              value={rawTextInput}
              onChangeText={setRawTextInput}
              placeholderTextColor="#999"
            />
          </View>

          {/* Multi Input: OCR */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{language === 'ne' ? '२) फोटो/OCR इनपुट' : '2) Image/OCR Input'}</Text>
              <TouchableOpacity style={styles.scanBtn} onPress={() => setShowOCRScanner(true)}>
                <MaterialIcons name="document-scanner" size={16} color="#fff" />
                <Text style={styles.scanBtnText}>{language === 'ne' ? 'स्क्यान' : 'Scan'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder={language === 'ne' ? 'OCR बाट आएको विवरण यहाँ देखिन्छ...' : 'OCR extracted text appears here...'}
              multiline
              numberOfLines={3}
              value={ocrText}
              onChangeText={setOcrText}
              placeholderTextColor="#999"
            />
          </View>

          {/* AI Assistance Section */}
          {mainCategory && subcategory && (
            <View style={styles.section}>
              <Text style={styles.aiHintText}>
                {language === 'ne'
                  ? 'AI ले टाइप गरिएको विवरण र OCR डेटा विश्लेषण गरेर औपचारिक निवेदन बनाउँछ।'
                  : 'AI analyzes typed details and OCR data to generate a formal application.'}
              </Text>
              <TouchableOpacity
                style={[styles.aiButton, aiLoading && styles.aiButtonDisabled]}
                onPress={handleAiAssistance}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
                ) : (
                  <MaterialIcons name="auto-awesome" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                )}
                <Text style={styles.aiButtonText}>
                  {aiLoading
                    ? language === 'ne'
                      ? 'AI ले विश्लेषण गर्दै...'
                      : 'Analyzing with AI...'
                    : language === 'ne'
                      ? 'AI विश्लेषण र निवेदन तयार गर्नुहोस्'
                      : 'Analyze & Generate Application'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Generated structured fields */}
          {!!analysis && (
            <View style={styles.section}>
              <Text style={styles.label}>{language === 'ne' ? 'AI बाट निकालिएको उद्देश्य' : 'AI Extracted Purpose'}</Text>
              <TextInput
                style={styles.input}
                multiline
                numberOfLines={3}
                value={purpose}
                onChangeText={setPurpose}
              />

              <Text style={[styles.label, { marginTop: 12 }]}>{language === 'ne' ? 'समर्थन/विस्तारित विवरण' : 'Supporting Details'}</Text>
              <TextInput
                style={styles.input}
                multiline
                numberOfLines={4}
                value={additionalInfo}
                onChangeText={setAdditionalInfo}
              />

              <Text style={[styles.label, { marginTop: 12 }]}>{language === 'ne' ? 'AI Summary' : 'AI Summary'}</Text>
              <Text style={styles.summaryText}>{analysis.summary}</Text>
            </View>
          )}

          {/* Follow-up Chat Style */}
          {!!analysis?.followUpQuestions?.length && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{language === 'ne' ? 'AI Follow-up प्रश्नहरू' : 'AI Follow-up Questions'}</Text>
              {analysis.followUpQuestions.map((q) => (
                <View key={q.field} style={styles.followUpCard}>
                  <Text style={styles.followUpQuestion}>{buildFollowUpPrompt(q.field, language as 'ne' | 'en')}</Text>
                  <TextInput
                    style={styles.followUpInput}
                    placeholder={buildFollowUpPlaceholder(q.field, language as 'ne' | 'en')}
                    value={followUpAnswers[q.field] || ''}
                    onChangeText={(value) =>
                      setFollowUpAnswers((current) => ({
                        ...current,
                        [q.field]: value,
                      }))
                    }
                    placeholderTextColor="#999"
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.secondaryButton, aiLoading && styles.aiButtonDisabled]}
                onPress={handleRegenerateWithFollowUps}
                disabled={aiLoading}
              >
                <MaterialIcons name="refresh" size={18} color={Colors.primary} />
                <Text style={styles.secondaryButtonText}>{language === 'ne' ? 'उत्तरसहित पुन: Generate' : 'Regenerate with Answers'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Generated Application Preview Block */}
          {!!analysis?.applicationText && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{language === 'ne' ? 'तयार निवेदन (Auto Generated)' : 'Generated Application'}</Text>
              <View style={styles.generatedCard}>
                <Text style={styles.generatedText}>{analysis.applicationText}</Text>
              </View>
            </View>
          )}

          {/* Button Group */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.previewButton} onPress={handleShowPreview}>
              <MaterialIcons name="preview" size={20} color="white" />
              <Text style={styles.buttonText}>
                {language === 'ne' ? 'पूर्वावलोकन' : 'Preview'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadPdf}>
              <MaterialIcons name="download" size={20} color={Colors.primary} />
              <Text style={styles.downloadButtonText}>
                {language === 'ne' ? 'PDF डाउनलोड' : 'Download PDF'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showOCRScanner} animationType="slide" onRequestClose={() => setShowOCRScanner(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <OCRHybridScreen
            mode="citizen"
            docType="citizenship"
            documentLabel={language === 'ne' ? 'नागरिकता कार्ड' : 'Citizenship Card'}
            onClose={() => setShowOCRScanner(false)}
            onResult={applyOCRResult}
          />
        </SafeAreaView>
      </Modal>

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        visible={showPDFPreview}
        documentData={pdfData}
        onCancel={() => setShowPDFPreview(false)}
        onConfirm={handleSubmitRequest}
        isLoading={loading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: Radius.md,
    marginBottom: 20,
    ...Shadow.sm,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  infoSubtile: {
    fontSize: 12,
    color: '#999',
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    marginTop: 12,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  typingHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary + '18',
  },
  typingHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.onSurfaceVariant,
    fontWeight: '500',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scanBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  recordBtn: {
    backgroundColor: '#eef6fb',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordBtnActive: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  recordBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  recordBtnTextActive: {
    color: '#fff',
  },
  audioStatusText: {
    marginTop: 8,
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  categoryScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
    backgroundColor: 'white',
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: 'white',
  },
  subcategoryButton: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: Radius.sm,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  subcategoryButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  subcategoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subcategoryText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: Radius.sm,
    padding: 12,
    fontSize: 13,
    color: '#333',
    textAlignVertical: 'top',
  },
  aiButton: {
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.sm,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiButtonDisabled: {
    opacity: 0.6,
  },
  aiButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  aiHintText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 17,
  },
  summaryText: {
    backgroundColor: '#eef6fb',
    borderRadius: Radius.sm,
    padding: 10,
    color: '#1f2937',
    fontSize: 12,
    lineHeight: 18,
  },
  followUpCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 10,
    ...Shadow.sm,
  },
  followUpQuestion: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
    marginBottom: 8,
  },
  followUpInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: Radius.sm,
    padding: 10,
    color: '#111827',
    backgroundColor: '#f9fafb',
    fontSize: 13,
  },
  secondaryButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: '#eaf4fb',
    borderRadius: Radius.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  generatedCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: Radius.md,
    padding: 14,
  },
  generatedText: {
    color: '#111827',
    lineHeight: 22,
    fontSize: 13,
  },
  buttonGroup: {
    gap: 12,
    marginBottom: 20,
  },
  previewButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  downloadButton: {
    backgroundColor: '#eaf4fb',
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  downloadButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
