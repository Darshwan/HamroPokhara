import Constants from 'expo-constants';

type AssistantLanguage = 'ne' | 'en';

export type GeminiAssistantResponse = {
  answer: string;
  missingKey: boolean;
  rateLimited: boolean;
};

const DEFAULT_GEMINI_MODEL_CANDIDATES = ['gemini-2.0-flash', 'gemini-1.5-flash'];

const getGeminiKey = () => {
  const extra = (Constants.expoConfig?.extra || {}) as Record<string, unknown>;
  const fromExpoConfig = String(extra.geminiApiKey || '').trim();
  if (fromExpoConfig) return fromExpoConfig;

  const env = (globalThis as any)?.process?.env ?? {};
  return String(env.EXPO_PUBLIC_GEMINI_API_KEY || env.GEMINI_API_KEY || '').trim();
};

const getGeminiModelCandidates = () => {
  const extra = (Constants.expoConfig?.extra || {}) as Record<string, unknown>;
  const fromExtra = String(extra.geminiModel || '').trim();
  const env = (globalThis as any)?.process?.env ?? {};
  const fromEnv = String(env.EXPO_PUBLIC_GEMINI_MODEL || env.GEMINI_MODEL || '').trim();

  const configured = [fromExtra, fromEnv].filter(Boolean);
  const merged = [...configured, ...DEFAULT_GEMINI_MODEL_CANDIDATES];
  return merged.filter((model, index, arr) => arr.indexOf(model) === index);
};

const cleanText = (raw: string) =>
  raw
    .replace(/^```[a-zA-Z]*\s*/g, '')
    .replace(/```$/g, '')
    .trim();

const logGeminiStatus = (message: string) => {
  console.log(`[Gemini Assistant] ${message}`);
};

export const askGeminiGovernmentAssistant = async (params: {
  query: string;
  language: AssistantLanguage;
  context?: string;
}): Promise<GeminiAssistantResponse> => {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    logGeminiStatus('Gemini API key missing. Falling back to template response.');
    return { answer: '', missingKey: true, rateLimited: false };
  }

  logGeminiStatus('Gemini API key found. Sending request.');

  const langInstruction =
    params.language === 'ne'
      ? 'उत्तर पूर्ण रूपमा औपचारिक, विनम्र, स्पष्ट र शुद्ध नेपालीमा देऊ।'
      : 'Respond in very formal, polite, and clear English.';

  const prompt = [
    'You are the official Government Assistant for Pokhara Metropolitan City.',
    'Always provide highly formal responses with respectful tone and practical steps.',
    'If the question is about a civic process, include: (1) brief guidance, (2) required documents, (3) where to contact.',
    'If details are uncertain, clearly state that exact requirements may vary by ward/office.',
    'Do not hallucinate legal clauses or exact fees/dates.',
    langInstruction,
    `User context: ${params.context || 'guest'}`,
    `Question: ${params.query}`,
  ].join('\n');

  const modelCandidates = getGeminiModelCandidates();
  let data: any = null;
  let lastStatus = 0;
  let lastBody = '';

  try {
    for (const model of modelCandidates) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              topP: 0.95,
              maxOutputTokens: 900,
            },
          }),
        }
      );

      if (response.ok) {
        data = await response.json();
        logGeminiStatus(`Gemini request succeeded with model ${model}.`);
        break;
      }

      lastStatus = response.status;
      lastBody = await response.text().catch(() => '');
      logGeminiStatus(`Model ${model} failed with status ${response.status}.`);

      if (response.status !== 404) {
        break;
      }
    }
  } catch (error) {
    logGeminiStatus(`Gemini request failed before receiving a response: ${String(error)}`);
  }

  if (!data) {
    logGeminiStatus(`Gemini request failed with status ${lastStatus}. Body: ${lastBody || '[empty]'}`);
    return {
      answer: '',
      missingKey: false,
      rateLimited: lastStatus === 429,
    };
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => String(part?.text || ''))
      .join('') || '';

  return {
    answer: cleanText(text),
    missingKey: false,
    rateLimited: false,
  };
};
