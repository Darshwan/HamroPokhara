import Constants from 'expo-constants';

export type SifarisDraftInput = {
  applicantName: string;
  citizenshipNo: string;
  wardCode: string;
  tole: string;
  phone: string;
  purpose: string;
  extraNotes: string;
  templateLabel: string;
};

export type SifarisDraft = {
  subject: string;
  title: string;
  body: string;
  summary: string;
  missingFields: string[];
  suggestions: string[];
};

export type PurposeAssistResult = {
  formalPurpose: string;
  extraDetailSuggestions: string[];
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

const geminiGenerate = async (params: {
  apiKey: string;
  prompt: string;
  maxOutputTokens: number;
  responseMimeType?: string;
}) => {
  const modelCandidates = getGeminiModelCandidates();

  for (const model of modelCandidates) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(params.apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: params.prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.95,
            maxOutputTokens: params.maxOutputTokens,
            ...(params.responseMimeType ? { responseMimeType: params.responseMimeType } : {}),
          },
        }),
      }
    );

    if (response.ok) {
      return response.json();
    }

    if (response.status !== 404) {
      return null;
    }
  }

  return null;
};

const cleanJsonText = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
};

const buildLocalExtraDetailSuggestions = (templateLabel: string, purpose: string) => {
  const cleanPurpose = purpose.trim() || templateLabel;
  return [
    `प्रयोजन: ${cleanPurpose}`,
    'सम्बन्धित कागजात (नागरिकता/आवश्यक प्रमाणपत्र) संलग्न गरिएको।',
    'आवश्यक परे स्थल सत्यापन तथा थप विवरण उपलब्ध गराइनेछ।',
  ];
};

const parsePurposeAssist = (rawText: string, fallback: PurposeAssistResult): PurposeAssistResult => {
  try {
    const cleaned = cleanJsonText(rawText);
    const jsonText = cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned;
    const parsed = JSON.parse(jsonText);

    const formalPurpose = String(parsed.formalPurpose || fallback.formalPurpose).trim() || fallback.formalPurpose;
    const extraDetailSuggestions = Array.isArray(parsed.extraDetailSuggestions)
      ? parsed.extraDetailSuggestions.map((item: any) => String(item).trim()).filter(Boolean)
      : [];

    const normalized = [...extraDetailSuggestions, ...fallback.extraDetailSuggestions]
      .filter(Boolean)
      .filter((item, index, arr) => arr.indexOf(item) === index)
      .slice(0, 5);

    return {
      formalPurpose,
      extraDetailSuggestions: normalized.slice(0, 3),
    };
  } catch {
    return fallback;
  }
};

const parseDraft = (rawText: string, fallback: SifarisDraft): SifarisDraft => {
  try {
    const cleaned = cleanJsonText(rawText);
    const jsonText = cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned;
    const parsed = JSON.parse(jsonText);

    return {
      subject: String(parsed.subject || fallback.subject),
      title: String(parsed.title || fallback.title),
      body: String(parsed.body || fallback.body),
      summary: String(parsed.summary || fallback.summary),
      missingFields: Array.isArray(parsed.missingFields)
        ? parsed.missingFields.map((item: any) => String(item)).filter(Boolean)
        : fallback.missingFields,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map((item: any) => String(item)).filter(Boolean)
        : fallback.suggestions,
    };
  } catch {
    return fallback;
  }
};

export const buildLocalSifarisDraft = (input: SifarisDraftInput): SifarisDraft => {
  const applicantName = input.applicantName.trim() || 'आवेदक';
  const citizenshipNo = input.citizenshipNo.trim() || 'उल्लेख नभएको';
  const wardCode = input.wardCode.trim() || 'NPL-04-33-09';
  const tole = input.tole.trim() || 'उल्लेख नभएको';
  const purpose = input.purpose.trim() || input.templateLabel;
  const extraNotes = input.extraNotes.trim();
  const phone = input.phone.trim() || 'उल्लेख नभएको';

  const subject = `${input.templateLabel} सम्बन्धी सिफारिसको निवेदन`;
  const body = [
    'श्रीमान् वडा अध्यक्षज्यू / सम्बन्धित निकाय,',
    '',
    `म, ${applicantName}, नागरिकता नं. ${citizenshipNo}, ${wardCode} अन्तर्गत ${tole} निवासी, ${purpose} प्रयोजनका लागि सिफारिस पत्र आवश्यक परेकोले यो निवेदन पेश गरेको छु।`,
    '',
    'उल्लेखित विवरणको स्थानीय सत्यापन गरि आवश्यक सिफारिस उपलब्ध गराइदिनुहुन विनम्र अनुरोध गर्दछु।',
    extraNotes ? '' : null,
    extraNotes ? `अतिरिक्त विवरण: ${extraNotes}` : null,
    '',
    `सम्पर्क नम्बर: ${phone}`,
    '',
    'भवदीय,',
    applicantName,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    title: subject,
    body,
    summary: `${applicantName} का लागि ${purpose} प्रयोजनको सिफारिस तयार भयो।`,
    missingFields: [
      ...(!input.applicantName.trim() ? ['आवेदकको नाम'] : []),
      ...(!input.citizenshipNo.trim() ? ['नागरिकता नम्बर'] : []),
      ...(!input.tole.trim() ? ['टोल / ठेगाना'] : []),
      ...(!input.phone.trim() ? ['सम्पर्क नम्बर'] : []),
    ],
    suggestions: [
      'आधिकारिक प्रयोजनका लागि पूरा नाम र सही वार्ड कोड राख्नुहोस्।',
      'आवश्यक कागजातहरू भएमा अतिरिक्त विवरणमा उल्लेख गर्नुहोस्।',
    ],
  };
};

export const generateNepaliSifarisDraft = async (input: SifarisDraftInput): Promise<SifarisDraft> => {
  const fallback = buildLocalSifarisDraft(input);
  const apiKey = getGeminiKey();

  if (!apiKey) {
    return fallback;
  }

  const prompt = [
    'तिमी पोखरा महानगरपालिकाका लागि डिजिटल सिफारिस पत्र तयार गर्ने सहायक हौ।',
    'विवरणलाई औपचारिक, स्पष्ट र शुद्ध नेपाली भाषामा रूपान्तरण गर।',
    'केवल JSON object मात्र फर्काऊ, markdown वा अतिरिक्त टिप्पणी नलेख।',
    'JSON schema: {"subject":"...","title":"...","body":"...","summary":"...","missingFields":["..."],"suggestions":["..."]}',
    'यदि कुनै जानकारी अपूर्ण छ भने missingFields मा उल्लेख गर तर अनुमान गरेर संवेदनशील विवरण नलेख।',
    '',
    `आवेदकको नाम: ${input.applicantName || 'उल्लेख छैन'}`,
    `नागरिकता नं.: ${input.citizenshipNo || 'उल्लेख छैन'}`,
    `वार्ड कोड: ${input.wardCode || 'उल्लेख छैन'}`,
    `टोल / ठेगाना: ${input.tole || 'उल्लेख छैन'}`,
    `फोन: ${input.phone || 'उल्लेख छैन'}`,
    `सिफारिसको प्रकार: ${input.templateLabel}`,
    `आवेदनको उद्देश्य: ${input.purpose || 'उल्लेख छैन'}`,
    `अतिरिक्त विवरण: ${input.extraNotes || 'उल्लेख छैन'}`,
  ].join('\n');

  const data = await geminiGenerate({
    apiKey,
    prompt,
    maxOutputTokens: 1200,
    responseMimeType: 'application/json',
  });

  if (!data) {
    return fallback;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '';
  if (!text.trim()) {
    return fallback;
  }

  return parseDraft(text, fallback);
};

export const enhancePurposeAndSuggestDetails = async (params: {
  romanPurpose: string;
  templateLabel: string;
  wardCode?: string;
  tole?: string;
}): Promise<PurposeAssistResult> => {
  const fallback: PurposeAssistResult = {
    formalPurpose: params.romanPurpose.trim(),
    extraDetailSuggestions: buildLocalExtraDetailSuggestions(params.templateLabel, params.romanPurpose),
  };

  const apiKey = getGeminiKey();
  if (!apiKey) {
    return fallback;
  }

  const prompt = [
    'तिमी वडा कार्यालयका लागि डिजिटल सिफारिस निवेदन सहायक हौ।',
    'प्रयोगकर्ताले Roman Nepali मा लेखेको उद्देश्यलाई औपचारिक, स्पष्ट, विनम्र र शुद्ध नेपालीमा रूपान्तरण गर।',
    'अतिरिक्त विवरण (अतिरिक्त बिबरण) का लागि कम्तीमा ३ वटा छोटा, उपयोगी र सरकारी प्रक्रियामा मिल्ने विकल्प देऊ।',
    'केवल JSON object मात्र फर्काऊ, markdown वा अन्य टिप्पणी नदेऊ।',
    'JSON schema: {"formalPurpose":"...","extraDetailSuggestions":["...","...","..."]}',
    '',
    `सिफारिसको प्रकार: ${params.templateLabel}`,
    `वार्ड कोड: ${params.wardCode || 'उल्लेख छैन'}`,
    `टोल / ठेगाना: ${params.tole || 'उल्लेख छैन'}`,
    `Roman Nepali उद्देश्य: ${params.romanPurpose}`,
  ].join('\n');

  const data = await geminiGenerate({
    apiKey,
    prompt,
    maxOutputTokens: 700,
    responseMimeType: 'application/json',
  });

  if (!data) {
    return fallback;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '';
  if (!text.trim()) {
    return fallback;
  }

  return parsePurposeAssist(text, fallback);
};
