import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Shadow, Typography } from '../constants/theme';
import { useStore } from '../store/useStore';
import { aiAPI } from '../api/client';
import AppHeader from '../components/AppHeader';
import { askGeminiGovernmentAssistant } from '../utils/geminiAssistant';

type LanguageMode = 'ne' | 'en';
type AssistantSource = 'gemini' | 'template' | 'offline';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  source?: AssistantSource;
}

const QUICK_SUGGESTIONS: Array<{
  key: string;
  ne: string;
  en: string;
  context: string;
}> = [
  {
    key: 'building-permit',
    ne: 'building permit कसरी लिने?',
    en: 'How do I apply for a building permit?',
    context: 'building_permit',
  },
  {
    key: 'citizenship',
    ne: 'नागरिकता सिफारिसका लागि के चाहिन्छ?',
    en: 'What is required for citizenship recommendation?',
    context: 'citizenship_recommendation',
  },
  {
    key: 'sifaris',
    ne: 'सिफारिस लिन कागजपत्र के चाहिन्छ?',
    en: 'What documents are needed for a sifaris?',
    context: 'sifaris',
  },
  {
    key: 'tax',
    ne: 'कर चुक्ता प्रक्रिया के हो?',
    en: 'What is the tax clearance process?',
    context: 'tax_clearance',
  },
  {
    key: 'tourist',
    ne: 'पर्यटकले पोखरामा के गर्नुपर्छ?',
    en: 'What should tourists know in Pokhara?',
    context: 'tourist_help',
  },
];

const TEMPLATE_RESPONSES: Record<string, { ne: string; en: string }> = {
  building_permit: {
    ne: 'घर वा भवन निर्माण अनुमति लिनका लागि जग्गाको कागज, नक्सा, नागरिकताको प्रतिलिपि, र वडाको सिफारिस चाहिन्छ। आवेदन पछि नगरपालिकाबाट प्राविधिक जाँच हुन्छ।',
    en: 'For a building permit, you usually need land documents, a building map, a citizenship copy, and ward recommendation. The municipality will then review the technical details.',
  },
  citizenship_recommendation: {
    ne: 'नागरिकता सिफारिसका लागि जन्मदर्ता, बाबु/आमाको नागरिकता, बसोबास प्रमाण, र वडाको निवेदन आवश्यक पर्छ।',
    en: 'For a citizenship recommendation, you typically need a birth certificate, parent citizenship copies, proof of residence, and a ward application.',
  },
  sifaris: {
    ne: 'सिफारिसका लागि आवश्यक कागजात सेवा अनुसार फरक हुन्छ। सामान्यतया नागरिकता, निवेदन, र सम्बन्धित प्रमाणपत्र चाहिन्छ।',
    en: 'Required documents for a sifaris depend on the service. Usually you need an ID, an application, and supporting certificates.',
  },
  tax_clearance: {
    ne: 'कर चुक्ता गर्न कर विवरण, पूर्व भुक्तानीको प्रमाण, र सम्पत्ति/घरसम्बन्धी कागज आवश्यक हुन सक्छ।',
    en: 'For tax clearance, you may need tax records, proof of previous payments, and property-related documents.',
  },
  tourist_help: {
    ne: 'पर्यटकहरूले पासपोर्ट सुरक्षित राख्ने, होटल दर्ता गर्ने, र आवश्यक परे permit/help desk प्रयोग गर्ने गर्नुपर्छ।',
    en: 'Tourists should keep their passport safe, register at their hotel, and use the permit/help desk if needed.',
  },
  fallback: {
    ne: 'माफ गर्नुहोस्, अहिले सर्भरबाट उत्तर आउन सकेन। कृपया अलि फरक तरिकाले सोध्नुहोस् वा नजिकको वडामा सम्पर्क गर्नुहोस्।',
    en: 'Sorry, I could not get a live answer right now. Please try asking in a different way or contact the ward office for assistance.',
  },
};

const normalizeText = (text: string) => text.toLowerCase().trim();

const detectTemplateKey = (query: string): keyof typeof TEMPLATE_RESPONSES | 'fallback' => {
  const normalized = normalizeText(query);
  if (/(building|map|permit|house|construction|bhawan|naksa|naksa)/.test(normalized)) {
    return 'building_permit';
  }
  if (/(citizenship|nagarikta|nagariktaa|नागरिकता)/.test(normalized)) {
    return 'citizenship_recommendation';
  }
  if (/(sifaris|recommendation|reference|sifarish|सिफारिस)/.test(normalized)) {
    return 'sifaris';
  }
  if (/(tax|clearance|कर|kharid|property tax)/.test(normalized)) {
    return 'tax_clearance';
  }
  if (/(tourist|visitor|passport|hotel|permit|travel|पर्यटक)/.test(normalized)) {
    return 'tourist_help';
  }
  return 'fallback';
};

const buildTemplateAnswer = (query: string, language: LanguageMode) => {
  const key = detectTemplateKey(query);
  return TEMPLATE_RESPONSES[key][language] || TEMPLATE_RESPONSES.fallback[language];
};

export default function GovernmentAssistantScreen({ navigation }: any) {
  const { citizen, tourist, isTourist, language, setLanguage } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        language === 'ne'
          ? 'नमस्ते। म पोखरा महानगरपालिकाको सरकारी सहायक हुँ। कृपया आफ्नो प्रश्न सोध्नुहोस्, म अत्यन्त औपचारिक रूपमा सहयोग गर्नेछु।'
          : 'Greetings. I am the official Government Assistant of Pokhara Metropolitan City. Please ask your question, and I will respond in a highly formal manner.',
      source: 'gemini',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedLang, setSelectedLang] = useState<LanguageMode>(language as LanguageMode);
  const chatScrollRef = useRef<ScrollView | null>(null);

  const userContext = useMemo(() => {
    if (isTourist && tourist) {
      return `tourist:${tourist.passport_no}`;
    }
    if (citizen) {
      return `citizen:${citizen.nid}`;
    }
    return 'guest';
  }, [citizen, isTourist, tourist]);

  const assistantIntro = selectedLang === 'ne'
    ? 'कुनै पनि सरकारी सेवा सम्बन्धी प्रश्न सोध्नुहोस्। उत्तर अत्यन्त औपचारिक र स्पष्ट रूपमा प्रदान गरिनेछ।'
    : 'Ask any government-service question. Responses are provided in a highly formal and clear format.';

  useEffect(() => {
    const timer = setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages, sending]);

  const syncLanguage = (lang: LanguageMode) => {
    setSelectedLang(lang);
    setLanguage(lang);
  };

  const logQuery = async (payload: {
    query: string;
    answer: string;
    source: AssistantSource;
  }) => {
    try {
      await aiAPI.logChatQuery({
        query: payload.query,
        language: selectedLang,
        answer: payload.answer,
        source: payload.source,
        context: userContext,
        user_id: userContext,
      });
    } catch {
      // Logging should never block the chat flow.
    }
  };

  const sendToAssistant = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      Toast.show({
        type: 'error',
        text1: selectedLang === 'ne' ? 'प्रश्न लेख्नुहोस्' : 'Enter a question',
      });
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);

    try {
      const response = await askGeminiGovernmentAssistant({
        query: trimmed,
        language: selectedLang,
        context: userContext,
      });

      if (response.missingKey) {
        const keyName = 'EXPO_PUBLIC_GEMINI_API_KEY';
        Toast.show({
          type: 'info',
          text1:
            selectedLang === 'ne'
              ? `.env मा ${keyName} थप्नुहोस्` 
              : `Add ${keyName} to .env`,
          text2:
            selectedLang === 'ne'
              ? 'हालका लागि template उत्तर देखाइँदैछ।'
              : 'Template fallback is shown for now.',
        });
      }

      const apiAnswer = String(response.answer || '').trim();
      const answer = apiAnswer || buildTemplateAnswer(trimmed, selectedLang);
      const resolvedSource: AssistantSource = apiAnswer ? 'gemini' : 'template';

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          text: answer,
          source: resolvedSource,
        },
      ]);

      await logQuery({ query: trimmed, answer, source: resolvedSource });
    } catch {
      const answer = buildTemplateAnswer(trimmed, selectedLang);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant-offline`,
          role: 'assistant',
          text: answer,
          source: 'offline',
        },
      ]);
      await logQuery({ query: trimmed, answer, source: 'offline' });
    } finally {
      setSending(false);
    }
  };

  const quickPromptLabel = (item: (typeof QUICK_SUGGESTIONS)[number]) => (selectedLang === 'ne' ? item.ne : item.en);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title={selectedLang === 'ne' ? 'AI सहायक' : 'AI Assistant'}
        showBack
        showLang
        showMenu={false}
        onBack={() => navigation.goBack()}
        onLang={() => syncLanguage(selectedLang === 'ne' ? 'en' : 'ne')}
      />

      <KeyboardAvoidingView
        style={styles.chatShell}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>{selectedLang === 'ne' ? 'औपचारिक सरकारी मार्गदर्शन' : 'Formal Government Guidance'}</Text>
              <Text style={styles.title}>{selectedLang === 'ne' ? 'सरकारी सहायक' : 'Government Assistant'}</Text>
            </View>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setMessages((current) => current.slice(0, 1))}
              disabled={sending || messages.length <= 1}
            >
              <MaterialIcons name="delete-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>{assistantIntro}</Text>

          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langPill, selectedLang === 'ne' && styles.langPillActive]}
              onPress={() => syncLanguage('ne')}
            >
              <Text style={[styles.langPillText, selectedLang === 'ne' && styles.langPillTextActive]}>नेपाली</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langPill, selectedLang === 'en' && styles.langPillActive]}
              onPress={() => syncLanguage('en')}
            >
              <Text style={[styles.langPillText, selectedLang === 'en' && styles.langPillTextActive]}>English</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.quickWrap}>
          <Text style={styles.sectionTitle}>{selectedLang === 'ne' ? 'छिटो सुझाव' : 'Quick Suggestions'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
            {QUICK_SUGGESTIONS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.quickChip}
                onPress={() => sendToAssistant(quickPromptLabel(item))}
                disabled={sending}
              >
                <MaterialIcons name="help-outline" size={16} color={Colors.primary} />
                <Text style={styles.quickChipText}>{quickPromptLabel(item)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.chatCard}>
          <ScrollView
            ref={chatScrollRef}
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
            showsVerticalScrollIndicator={false}
          >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubbleRow,
                message.role === 'user' ? styles.userRow : styles.assistantRow,
              ]}
            >
              {message.role === 'assistant' && (
                <View style={styles.avatar}>
                  <MaterialIcons name="smart-toy" size={18} color={Colors.primary} />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text style={[styles.bubbleText, message.role === 'user' && styles.userBubbleText]}>{message.text}</Text>
                {message.source && message.role === 'assistant' && (
                  <Text style={styles.sourceText}>
                    {message.source === 'gemini'
                      ? (selectedLang === 'ne' ? 'Gemini प्रत्यक्ष' : 'Gemini Live')
                      : message.source === 'template'
                        ? (selectedLang === 'ne' ? 'Template उत्तर' : 'Template answer')
                        : (selectedLang === 'ne' ? 'Offline fallback' : 'Offline fallback')}
                  </Text>
                )}
              </View>
            </View>
          ))}

          {sending && (
            <View style={[styles.bubbleRow, styles.assistantRow]}>
              <View style={styles.avatar}>
                <MaterialIcons name="smart-toy" size={18} color={Colors.primary} />
              </View>
              <View style={[styles.bubble, styles.assistantBubble, styles.loadingBubble]}>
                <ActivityIndicator color={Colors.primary} size="small" />
                <Text style={styles.loadingText}>{selectedLang === 'ne' ? 'सोच्दैछ...' : 'Thinking...'}</Text>
              </View>
            </View>
          )}
          </ScrollView>

          <View style={styles.composer}>
            <View style={styles.inputCard}>
              <TextInput
                style={styles.input}
                placeholder={selectedLang === 'ne' ? 'यहाँ प्रश्न लेख्नुहोस्...' : 'Type your question here...'}
                placeholderTextColor={Colors.outline}
                value={input}
                onChangeText={setInput}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
                onPress={() => sendToAssistant(input)}
                disabled={sending || !input.trim()}
              >
                <MaterialIcons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              {selectedLang === 'ne'
                ? 'Gemini उपलब्ध नभए template उत्तर देखाइनेछ।'
                : 'If Gemini is unavailable, a template answer will be shown.'}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Shadow.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  title: {
    ...Typography.h3,
    color: '#fff',
    marginTop: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  clearBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  langPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  langPillActive: {
    backgroundColor: '#fff',
  },
  langPillText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  langPillTextActive: {
    color: Colors.primary,
  },
  quickWrap: {
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
    marginBottom: 10,
  },
  quickRow: {
    paddingRight: 20,
    gap: 10,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  chatShell: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 6,
  },
  chatCard: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    overflow: 'hidden',
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  assistantBubble: {
    backgroundColor: Colors.surfaceContainerLow,
    borderTopLeftRadius: 6,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderTopRightRadius: 6,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.onSurface,
  },
  userBubbleText: {
    color: '#fff',
  },
  sourceText: {
    marginTop: 7,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: Colors.outline,
    textTransform: 'uppercase',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  composer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 22,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    fontSize: 14,
    color: Colors.onSurface,
    paddingHorizontal: 8,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.55,
  },
  helperText: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    lineHeight: 16,
    marginTop: 8,
    textAlign: 'center',
  },
});
