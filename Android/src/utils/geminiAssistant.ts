import Constants from 'expo-constants';

type AssistantLanguage = 'ne' | 'en';

const GEMINI_MODEL = 'gemini-1.5-flash';

const getGeminiKey = () => {
  const extra = (Constants.expoConfig?.extra || {}) as Record<string, unknown>;
  const fromExpoConfig = String(extra.geminiApiKey || '').trim();
  if (fromExpoConfig) return fromExpoConfig;

  const env = (globalThis as any)?.process?.env ?? {};
  return String(env.EXPO_PUBLIC_GEMINI_API_KEY || env.GEMINI_API_KEY || '').trim();
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
}): Promise<{ answer: string; missingKey: boolean }> => {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    logGeminiStatus('Gemini API key missing. Falling back to template response.');
    return { answer: '', missingKey: true };
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
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

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logGeminiStatus(`Gemini request failed with status ${response.status}. Body: ${errorBody || '[empty]'}`);
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => String(part?.text || ''))
      .join('') || '';

  return {
    answer: cleanText(text),
    missingKey: false,
  };
};
