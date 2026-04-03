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
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { citizenAPI } from '../api/client';
import { PDFPreviewModal } from '../components/PDFPreviewModal';
import { PDFDocumentData } from '../utils/pdfGenerator';
import AppHeader from '../components/AppHeader';
import { askGeminiGovernmentAssistant } from '../utils/geminiAssistant';

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
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');

  // Reset subcategory when main category changes
  useEffect(() => {
    setSubcategory(null);
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
    setAiSuggestion('');

    try {
      const mainCatLabel = getMainCategoryLabel(mainCategory);
      const subCatLabel = getSubcategoryLabel(subcategory);

      const prompt =
        language === 'ne'
          ? `म ${mainCatLabel} को "${subCatLabel}" सिफारिसको लागि आवेदन गर्दैछु। कृपया मलाई यस सिफारिसमा क्या लेख्नु पर्छ भन्ने सम्बन्धमा औपचारिक सुझाव दिनुहोस्। संक्षिप्त, औपचारिक र व्यावहारिक सुझाव दिनुहोस्।`
          : `I am applying for a "${subCatLabel}" certificate under ${mainCatLabel}. Please provide formal suggestions on what should be included in this request. Keep it brief, formal, and practical.`;

      const result = await askGeminiGovernmentAssistant({
        query: prompt,
        language: language as 'ne' | 'en',
        context: `citizen-${citizen?.nid}`,
      });

      if (result.missingKey) {
        Toast.show({
          type: 'info',
          text1: 'AI Service Not Available',
          text2: 'Gemini API key not configured',
        });
        setAiSuggestion(getAiFallbackSuggestion(language as 'ne' | 'en'));
        return;
      }

      const answer = String(result.answer || '').trim();
      setAiSuggestion(answer || getAiFallbackSuggestion(language as 'ne' | 'en'));

      if (result.rateLimited && !answer) {
        Toast.show({
          type: 'info',
          text1: language === 'ne' ? 'AI सेवा अस्थायी रूपमा सीमित छ' : 'AI service is temporarily limited',
          text2: language === 'ne'
            ? 'अहिले स्थानीय सुझाव देखाइँदैछ। केही समयपछि पुन: प्रयास गर्नुहोस्।'
            : 'A local suggestion is shown for now. Please try again in a bit.',
        });
      }
    } catch (error) {
      console.error('AI Assistance Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to get AI assistance',
      });
      setAiSuggestion(getAiFallbackSuggestion(language as 'ne' | 'en'));
    } finally {
      setAiLoading(false);
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

    const pdfDocData: PDFDocumentData = {
      docType: `SIFARIS_${subcategory}`,
      docTypeLabel: `${getMainCategoryLabel(mainCategory)} - ${getSubcategoryLabel(subcategory)}`,
      nid: citizen.nid,
      citizenName: citizen.name,
      wardCode: citizen.ward_code || 'NPL-04-33-09',
      purpose: purpose.trim() || additionalInfo.trim(),
      additionalInfo: additionalInfo.trim() || undefined,
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

      await addRequest({
        request_id: requestId,
        document_type: subcategory || 'SIFARIS',
        purpose: purpose.trim() || additionalInfo.trim(),
        status: 'PENDING',
        submitted_at: new Date().toISOString(),
        category: 'citizen',
        details: [
          `Category: ${mainCategory ? getMainCategoryLabel(mainCategory) : ''}`,
          `Type: ${subcategory ? getSubcategoryLabel(subcategory) : ''}`,
          `Ward: ${citizen.ward_code || 'NPL-04-33-09'}`,
          `Details: ${additionalInfo.trim() || 'None'}`,
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

          {/* Purpose Input */}
          <View style={styles.section}>
            <Text style={styles.label}>
              {language === 'ne' ? 'उद्देश्य' : 'Purpose'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={language === 'ne' ? 'उद्देश्य लेख्नुहोस्...' : 'Enter purpose...'}
              multiline
              numberOfLines={3}
              value={purpose}
              onChangeText={setPurpose}
              placeholderTextColor="#999"
            />
          </View>

          {/* Additional Info */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                {language === 'ne' ? 'विस्तारित जानकारी' : 'Additional Details'}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder={
                language === 'ne' ? 'अन्य जानकारी (वैकल्पिक)...' : 'Other information (optional)...'
              }
              multiline
              numberOfLines={3}
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              placeholderTextColor="#999"
            />
          </View>

          {/* AI Assistance Section */}
          {mainCategory && subcategory && (
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.aiButton, aiLoading && styles.aiButtonDisabled]}
                onPress={() => {
                  setShowAiAssistant(true);
                  handleAiAssistance();
                }}
                disabled={aiLoading}
              >
                <MaterialIcons
                  name="auto-awesome"
                  size={20}
                  color={Colors.primary}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.aiButtonText}>
                  {aiLoading
                    ? language === 'ne'
                      ? 'AI सहायता प्राप्त गर्दै...'
                      : 'Getting AI assistance...'
                    : language === 'ne'
                      ? 'AI सहायताले सुझाव दिन दिनुहोस्'
                      : 'Get AI Writing Assistance'}
                </Text>
              </TouchableOpacity>
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
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* AI Suggestion Modal */}
      <Modal visible={showAiAssistant} animationType="slide" transparent>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAiAssistant(false)}>
              <MaterialIcons name="close" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {language === 'ne' ? 'AI सहायता' : 'AI Assistance'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {aiLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>
                  {language === 'ne' ? 'सुझाव तयार गर्दै...' : 'Generating suggestion...'}
                </Text>
              </View>
            ) : aiSuggestion ? (
              <>
                <Text style={styles.suggestionContent}>{aiSuggestion}</Text>
                <TouchableOpacity
                  style={styles.useSuggestionButton}
                  onPress={() => {
                    setPurpose(aiSuggestion);
                    setShowAiAssistant(false);
                  }}
                >
                  <MaterialIcons name="check" size={20} color="white" />
                  <Text style={styles.buttonText}>
                    {language === 'ne' ? 'यो प्रयोग गर्नुहोस्' : 'Use This'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </ScrollView>
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#666',
  },
  suggestionContent: {
    fontSize: 13,
    lineHeight: 20,
    color: '#333',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: Radius.md,
    marginBottom: 16,
  },
  useSuggestionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
  },
});
