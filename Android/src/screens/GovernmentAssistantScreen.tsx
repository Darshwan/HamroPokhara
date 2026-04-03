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
import { Colors, Radius, Shadow } from '../constants/theme';
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
  followUps?: string[];
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

const buildFollowUps = (query: string, language: LanguageMode) => {
  const key = detectTemplateKey(query);
  const followUps: Record<string, Record<LanguageMode, string[]>> = {
    building_permit: {
      ne: ['कागजातको सूची देखाउनुहोस्', 'कति समय लाग्छ?', 'कहाँ बुझाउने?'],
      en: ['Show document checklist', 'How long does it take?', 'Where should I submit it?'],
    },
    citizenship_recommendation: {
      ne: ['आवश्यक फाइलहरू बताउनुहोस्', 'वडाबाट कसरी लिने?', 'फर्म भर्ने तरिका?'],
      en: ['List required files', 'How do I get it from the ward?', 'How do I fill the form?'],
    },
    sifaris: {
      ne: ['सिफारिसको नमुना दिनुहोस्', 'फीस छ कि छैन?', 'आजै लिन मिल्छ?'],
      en: ['Show a sample sifaris', 'Is there a fee?', 'Can I get it today?'],
    },
    tax_clearance: {
      ne: ['कर तिर्ने चरणहरू', 'कुन कागज चाहिन्छ?', 'अनलाइन गर्न मिल्छ?'],
      en: ['Tax payment steps', 'What documents are needed?', 'Can I do it online?'],
    },
    tourist_help: {
      ne: ['पर्यटक permit चाहिन्छ?', 'घुम्न कहाँ जाने?', 'आपतकालीन सम्पर्क?'],
      en: ['Do tourists need permits?', 'Where should I visit?', 'Emergency contacts?'],
    },
    fallback: {
      ne: ['वडा नम्बर खोज्नुहोस्', 'आवश्यक कागजात बताउनुहोस्', 'फेरि सरल भाषामा सोध्छु'],
      en: ['Find my ward number', 'Tell me the required documents', 'I will ask again in simpler words'],
    },
  };

  return followUps[key][language] || followUps.fallback[language];
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function GovernmentAssistantScreen({ navigation }: any) {
  const { citizen, tourist, isTourist, language, setLanguage } = useStore();
  const createWelcomeMessage = (lang: LanguageMode): ChatMessage => ({
    id: 'welcome',
    role: 'assistant',
    text:
      lang === 'ne'
        ? 'नमस्ते। म पोखरा महानगरपालिकाको सरकारी सहायक हुँ। सेवा, कागजात, कर, अनुमति, वा प्रक्रिया सम्बन्धी प्रश्न सोध्नुहोस्।'
        : 'Hello. I am the Government Assistant for Pokhara Metropolitan City. Ask about services, documents, taxes, permits, or municipal processes.',
    source: 'gemini',
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage(language as LanguageMode)]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedLang, setSelectedLang] = useState<LanguageMode>(language as LanguageMode);
  const chatScrollRef = useRef<ScrollView | null>(null);
  const typingTimersRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const userContext = useMemo(() => {
    if (isTourist && tourist) {
      return `tourist:${tourist.passport_no}`;
    }
    if (citizen) {
      return `citizen:${citizen.nid}`;
    }
    return 'guest';
  }, [citizen, isTourist, tourist]);

  useEffect(() => {
    const timer = setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      typingTimersRef.current.forEach((timer) => clearInterval(timer));
      typingTimersRef.current = [];
    };
  }, []);

  const syncLanguage = (lang: LanguageMode) => {
    setSelectedLang(lang);
    setLanguage(lang);
  };

  useEffect(() => {
    setSelectedLang(language as LanguageMode);
  }, [language]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 1 && current[0]?.id === 'welcome') {
        return [createWelcomeMessage(selectedLang)];
      }
      return current;
    });
  }, [selectedLang]);

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

  const animateAssistantReply = async (messageId: string, text: string) => {
    const tokens = Array.from(text);
    const step = Math.max(1, Math.ceil(tokens.length / 90));
    let index = 0;

    setMessages((current) => current.map((message) => (
      message.id === messageId ? { ...message, text: '' } : message
    )));

    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        index = Math.min(tokens.length, index + step);
        const nextText = tokens.slice(0, index).join('');

        setMessages((current) => current.map((message) => (
          message.id === messageId ? { ...message, text: nextText } : message
        )));

        if (index >= tokens.length) {
          clearInterval(timer);
          typingTimersRef.current = typingTimersRef.current.filter((item) => item !== timer);
          resolve();
        }
      }, 14);

      typingTimersRef.current.push(timer);
    });
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

      if (response.rateLimited) {
        Toast.show({
          type: 'info',
          text1: selectedLang === 'ne' ? 'AI सेवा अस्थायी रूपमा सीमित छ' : 'AI service is temporarily limited',
          text2:
            selectedLang === 'ne'
              ? 'स्थानीय template उत्तर देखाइँदैछ। केही समयपछि पुन: प्रयास गर्नुहोस्।'
              : 'A local template answer is shown for now. Please try again in a bit.',
        });
      }

      const apiAnswer = String(response.answer || '').trim();
      const answer = apiAnswer || buildTemplateAnswer(trimmed, selectedLang);
      const resolvedSource: AssistantSource = apiAnswer ? 'gemini' : 'template';
      const followUps = buildFollowUps(trimmed, selectedLang);
      const assistantId = `${Date.now()}-assistant`;

      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: 'assistant',
          text: '',
          source: resolvedSource,
          followUps,
        },
      ]);

      await wait(120);
      await animateAssistantReply(assistantId, answer);

      await logQuery({ query: trimmed, answer, source: resolvedSource });
    } catch {
      const answer = buildTemplateAnswer(trimmed, selectedLang);
      const followUps = buildFollowUps(trimmed, selectedLang);
      const assistantId = `${Date.now()}-assistant-offline`;
      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: 'assistant',
          text: '',
          source: 'offline',
          followUps,
        },
      ]);
      await wait(120);
      await animateAssistantReply(assistantId, answer);
      await logQuery({ query: trimmed, answer, source: 'offline' });
    } finally {
      setSending(false);
    }
  };

  const quickPromptLabel = (item: (typeof QUICK_SUGGESTIONS)[number]) => (selectedLang === 'ne' ? item.ne : item.en);

  const resetChat = () => {
    setMessages([createWelcomeMessage(selectedLang)]);
    setInput('');
  };

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
        style={styles.keyboardShell}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.screenScroll}
          contentContainerStyle={styles.screenScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{selectedLang === 'ne' ? 'छिटो सुझाव' : 'Quick prompts'}</Text>
                <Text style={styles.sectionSubtitle}>{selectedLang === 'ne' ? 'एक ट्यापमै सुरु गर्नुहोस्' : 'Start with one tap'}</Text>
              </View>
              <TouchableOpacity style={styles.resetBtn} onPress={resetChat} disabled={sending && messages.length <= 1}>
                <MaterialIcons name="refresh" size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
              {QUICK_SUGGESTIONS.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.quickChip}
                  onPress={() => sendToAssistant(quickPromptLabel(item))}
                  disabled={sending}
                >
                  <MaterialIcons name="auto-awesome" size={14} color={Colors.primary} />
                  <Text style={styles.quickChipText}>{quickPromptLabel(item)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <View>
                <Text style={styles.chatHeaderTitle}>{selectedLang === 'ne' ? 'संवाद' : 'Conversation'}</Text>
                <Text style={styles.chatHeaderSubtitle}>{selectedLang === 'ne' ? 'उत्तर तलको च्याटमा देखिन्छ' : 'Replies appear below in chat'}</Text>
              </View>
              <View style={styles.chatStatusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.chatStatusText}>{sending ? (selectedLang === 'ne' ? 'पठाउँदै' : 'Sending') : (selectedLang === 'ne' ? 'तयार' : 'Ready')}</Text>
              </View>
            </View>

            <ScrollView
              ref={chatScrollRef}
              style={styles.chatList}
              contentContainerStyle={styles.chatListContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((message) => (
                <View key={message.id} style={message.role === 'user' ? styles.userMessageBlock : styles.assistantMessageBlock}>
                  <View
                    style={[
                      styles.bubbleRow,
                      message.role === 'user' ? styles.userRow : styles.assistantRow,
                    ]}
                  >
                    {message.role === 'assistant' && (
                      <View style={styles.avatar}>
                        <MaterialIcons name="smart-toy" size={17} color={Colors.primary} />
                      </View>
                    )}
                    <View
                      style={[
                        styles.bubble,
                        message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                      ]}
                    >
                      <Text style={[styles.bubbleText, message.role === 'user' && styles.userBubbleText]}>{message.text || (message.role === 'assistant' ? ' ' : '')}</Text>
                      {message.source && message.role === 'assistant' && (
                        <View style={styles.sourceBadge}>
                          <Text style={styles.sourceText}>
                            {message.source === 'gemini'
                              ? (selectedLang === 'ne' ? 'Gemini उत्तर' : 'Gemini reply')
                              : message.source === 'template'
                                ? (selectedLang === 'ne' ? 'Template उत्तर' : 'Template reply')
                                : (selectedLang === 'ne' ? 'Offline fallback' : 'Offline fallback')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {message.role === 'assistant' && message.followUps?.length ? (
                    <View style={styles.followUpWrap}>
                      <Text style={styles.followUpLabel}>{selectedLang === 'ne' ? 'अर्को प्रश्न' : 'Follow-up questions'}</Text>
                      <View style={styles.followUpRow}>
                        {message.followUps.map((followUp) => (
                          <TouchableOpacity
                            key={followUp}
                            style={styles.followUpChip}
                            disabled={sending}
                            onPress={() => sendToAssistant(followUp)}
                          >
                            <Text style={styles.followUpChipText}>{followUp}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}

              {sending && (
                <View style={[styles.bubbleRow, styles.assistantRow]}>
                  <View style={styles.avatar}>
                    <MaterialIcons name="smart-toy" size={17} color={Colors.primary} />
                  </View>
                  <View style={[styles.bubble, styles.assistantBubble, styles.loadingBubble]}>
                    <ActivityIndicator color={Colors.primary} size="small" />
                    <Text style={styles.loadingText}>{selectedLang === 'ne' ? 'Gemini ले उत्तर तयार गर्दैछ...' : 'Gemini is preparing a reply...'}</Text>
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
                  activeOpacity={0.9}
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
  keyboardShell: {
    flex: 1,
  },
  screenScroll: {
    flex: 1,
  },
  screenScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 14,
  },
  resetBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  sectionCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.onSurface,
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  quickRow: {
    gap: 10,
    paddingRight: 6,
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
    maxWidth: 220,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  chatCard: {
    flex: 1,
    borderRadius: 28,
    padding: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.sm,
    minHeight: 420,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  chatHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.onSurface,
  },
  chatHeaderSubtitle: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 3,
  },
  chatStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: Colors.success,
  },
  chatStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    paddingBottom: 14,
    gap: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  userRow: {
    justifyContent: 'flex-end',
    marginLeft: 28,
  },
  assistantRow: {
    justifyContent: 'flex-start',
    marginRight: 28,
  },
  userMessageBlock: {
    alignItems: 'flex-end',
    gap: 8,
  },
  assistantMessageBlock: {
    alignItems: 'flex-start',
    gap: 8,
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
    maxWidth: '88%',
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
  sourceBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
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
  followUpWrap: {
    paddingLeft: 40,
    gap: 8,
  },
  followUpLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.outline,
  },
  followUpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  followUpChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  followUpChipText: {
    fontSize: 12,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  composer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
    marginTop: 4,
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
    minHeight: 46,
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
    opacity: 0.5,
  },
  helperText: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    lineHeight: 16,
    marginTop: 8,
    textAlign: 'center',
  },
});
