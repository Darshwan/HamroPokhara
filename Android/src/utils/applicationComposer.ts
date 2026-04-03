import Constants from 'expo-constants';

export type LanguageMode = 'ne' | 'en';

export type ApplicantInput = {
  applicantName: string;
  address: string;
  wardCode: string;
  officeName: string;
  subject: string;
  purpose: string;
  supportingDetails: string;
  phone: string;
  citizenshipNo: string;
  rawText: string;
  audioTranscript: string;
  ocrText: string;
  recommendationLabel: string;
  categoryLabel: string;
  language: LanguageMode;
};

export type ApplicantFieldKey =
  | 'applicantName'
  | 'address'
  | 'wardCode'
  | 'officeName'
  | 'subject'
  | 'purpose'
  | 'supportingDetails'
  | 'phone'
  | 'citizenshipNo';

export type FollowUpQuestion = {
  field: ApplicantFieldKey;
  questionNe: string;
  questionEn: string;
  placeholderNe: string;
  placeholderEn: string;
};

export type ApplicantAnalysis = {
  applicantName: string;
  address: string;
  wardCode: string;
  officeName: string;
  subject: string;
  purpose: string;
  supportingDetails: string;
  phone: string;
  citizenshipNo: string;
  summary: string;
  missingFields: ApplicantFieldKey[];
  followUpQuestions: FollowUpQuestion[];
  applicationText: string;
  printHtml: string;
};

const DEFAULT_GEMINI_MODEL_CANDIDATES = ['gemini-2.0-flash', 'gemini-1.5-flash'];

const FIELD_LABELS: Record<ApplicantFieldKey, { ne: string; en: string }> = {
  applicantName: { ne: 'पूरा नाम', en: 'full name' },
  address: { ne: 'ठेगाना', en: 'address' },
  wardCode: { ne: 'वडा नं.', en: 'ward number' },
  officeName: { ne: 'कार्यालय', en: 'office name' },
  subject: { ne: 'विषय', en: 'subject' },
  purpose: { ne: 'उद्देश्य', en: 'purpose' },
  supportingDetails: { ne: 'अतिरिक्त विवरण', en: 'supporting details' },
  phone: { ne: 'फोन नम्बर', en: 'phone number' },
  citizenshipNo: { ne: 'नागरिकता नम्बर', en: 'citizenship number' },
};

const FOLLOW_UP_TEMPLATES: Record<ApplicantFieldKey, FollowUpQuestion> = {
  applicantName: {
    field: 'applicantName',
    questionNe: 'तपाईंको पूरा नाम के हो?',
    questionEn: 'What is your full name?',
    placeholderNe: 'जस्तै: रमेश श्रेष्ठ',
    placeholderEn: 'e.g. Ramesh Shrestha',
  },
  address: {
    field: 'address',
    questionNe: 'तपाईंको ठेगाना वा टोल के हो?',
    questionEn: 'What is your address or tole?',
    placeholderNe: 'जस्तै: लेकसाइड, पोखरा-६',
    placeholderEn: 'e.g. Lakeside, Pokhara-6',
  },
  wardCode: {
    field: 'wardCode',
    questionNe: 'तपाईंको वडा नम्बर कति हो?',
    questionEn: 'What is your ward number?',
    placeholderNe: 'जस्तै: वडा नं. ६',
    placeholderEn: 'e.g. Ward 6',
  },
  officeName: {
    field: 'officeName',
    questionNe: 'कुन कार्यालयका लागि निवेदन तयार गर्ने?',
    questionEn: 'Which office should receive the application?',
    placeholderNe: 'जस्तै: वडा कार्यालय, पोखरा महानगरपालिका',
    placeholderEn: 'e.g. Ward Office, Pokhara Metropolitan City',
  },
  subject: {
    field: 'subject',
    questionNe: 'निवेदनको विषय के हो?',
    questionEn: 'What is the subject of the application?',
    placeholderNe: 'जस्तै: निवास प्रमाणिकरण',
    placeholderEn: 'e.g. Residence verification',
  },
  purpose: {
    field: 'purpose',
    questionNe: 'यो निवेदन किन चाहिएको हो?',
    questionEn: 'Why do you need this application?',
    placeholderNe: 'जस्तै: छात्रवृत्तिका लागि',
    placeholderEn: 'e.g. For scholarship processing',
  },
  supportingDetails: {
    field: 'supportingDetails',
    questionNe: 'थप प्रमाण वा विवरण के समावेश गर्ने?',
    questionEn: 'What supporting details should be included?',
    placeholderNe: 'जस्तै: नागरिकता प्रतिलिपि संलग्न छ',
    placeholderEn: 'e.g. Citizenship copy attached',
  },
  phone: {
    field: 'phone',
    questionNe: 'सम्पर्क नम्बर के हो?',
    questionEn: 'What is your contact number?',
    placeholderNe: 'जस्तै: ९८XXXXXXXX',
    placeholderEn: 'e.g. 98XXXXXXXX',
  },
  citizenshipNo: {
    field: 'citizenshipNo',
    questionNe: 'नागरिकता नम्बर लेख्नुहोस्।',
    questionEn: 'Please enter the citizenship number.',
    placeholderNe: 'जस्तै: १२-०१-०२-००००१',
    placeholderEn: 'e.g. 12-01-02-00001',
  },
};

const mergeParts = (...parts: Array<string | undefined | null>) =>
  parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n\n');

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

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
  for (const model of getGeminiModelCandidates()) {
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

const extractModelText = (data: any) =>
  data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '';

const cleanJsonText = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
};

const toLowerSafe = (value: string) => value.trim().toLowerCase();

const detectMissingFields = (input: ApplicantInput): ApplicantFieldKey[] => {
  const required: ApplicantFieldKey[] = [
    'applicantName',
    'address',
    'wardCode',
    'officeName',
    'subject',
    'purpose',
    'supportingDetails',
  ];

  return required.filter((field) => !normalizeText(input[field]).length);
};

const buildFollowUps = (fields: ApplicantFieldKey[], language: LanguageMode): FollowUpQuestion[] =>
  fields.slice(0, 3).map((field) => FOLLOW_UP_TEMPLATES[field]);

const buildApplicationText = (input: ApplicantInput) => {
  const applicantName = normalizeText(input.applicantName) || 'आवेदक';
  const address = normalizeText(input.address) || 'उल्लेख नभएको ठेगाना';
  const wardCode = normalizeText(input.wardCode) || 'वडा नं. उल्लेख छैन';
  const officeName = normalizeText(input.officeName) || 'श्रीमान् वडा अध्यक्षज्यू';
  const subject = normalizeText(input.subject) || 'निवेदन';
  const purpose = normalizeText(input.purpose) || normalizeText(input.recommendationLabel) || subject;
  const supportingDetails = normalizeText(input.supportingDetails);
  const phone = normalizeText(input.phone) || 'उल्लेख नभएको';
  const citizenshipNo = normalizeText(input.citizenshipNo) || 'उल्लेख नभएको';
  const mergedEvidence = mergeParts(input.rawText, input.audioTranscript, input.ocrText, supportingDetails);
  const dateLine = (() => {
    try {
      const formatted = new Intl.DateTimeFormat('ne-NP-u-ca-nepali', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date());
      return `मिति: ${formatted}`;
    } catch {
      return `मिति: ${new Date().toLocaleDateString('en-GB')}`;
    }
  })();

  const lines = [
    dateLine,
    '',
    `${officeName}ज्यू,`,
    'विषय: ' + subject,
    '',
    `म, ${applicantName}, नागरिकता नं. ${citizenshipNo}, ${address} निवासी, ${wardCode} अन्तर्गत बसोबास गर्ने नागरिक हुँ।`,
    `${purpose} प्रयोजनका लागि यो निवेदन पेश गरेको छु।`,
    '',
    'उपलब्ध जानकारी तथा संलग्न विवरणलाई आधार मानी आवश्यक प्रमाणिकरण, सिफारिस वा स्वीकृति प्रदान गरिदिनुहुन विनम्र अनुरोध गर्दछु।',
    mergedEvidence ? '' : null,
    mergedEvidence ? `संलग्न/स्रोत विवरण: ${mergedEvidence}` : null,
    '',
    `सम्पर्क नम्बर: ${phone}`,
    '',
    'भवदीय,',
    applicantName,
    'हस्ताक्षर: ____________________',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    applicantName,
    address,
    wardCode,
    officeName,
    subject,
    purpose,
    supportingDetails,
    phone,
    citizenshipNo,
    text: lines,
    mergedEvidence,
    dateLine,
  };
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildApplicantAnalysisFallback = (input: ApplicantInput): ApplicantAnalysis => {
  const missingFields = detectMissingFields(input);
  const followUpQuestions = buildFollowUps(missingFields, input.language);
  const application = buildApplicationText(input);

  return {
    applicantName: application.applicantName,
    address: application.address,
    wardCode: application.wardCode,
    officeName: application.officeName,
    subject: application.subject,
    purpose: application.purpose,
    supportingDetails: application.supportingDetails,
    phone: application.phone,
    citizenshipNo: application.citizenshipNo,
    summary: missingFields.length
      ? `AI ले ${missingFields.length} वटा आवश्यक विवरण अझै पुष्टि गर्नुपर्ने देख्यो।`
      : 'सबै मुख्य विवरण तयार छन्।',
    missingFields,
    followUpQuestions,
    applicationText: application.text,
    printHtml: buildApplicationPrintHtml(application),
  };
};

const parseAnalysisResponse = (rawText: string, fallback: ApplicantAnalysis): ApplicantAnalysis => {
  try {
    const cleaned = cleanJsonText(rawText);
    const jsonText = cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned;
    const parsed = JSON.parse(jsonText);
    const application = buildApplicationText({
      applicantName: String(parsed.applicantName || fallback.applicantName),
      address: String(parsed.address || fallback.address),
      wardCode: String(parsed.wardCode || fallback.wardCode),
      officeName: String(parsed.officeName || fallback.officeName),
      subject: String(parsed.subject || fallback.subject),
      purpose: String(parsed.purpose || fallback.purpose),
      supportingDetails: String(parsed.supportingDetails || fallback.supportingDetails),
      phone: String(parsed.phone || fallback.phone),
      citizenshipNo: String(parsed.citizenshipNo || fallback.citizenshipNo),
      rawText: fallback.applicationText,
      audioTranscript: '',
      ocrText: '',
      recommendationLabel: fallback.subject,
      categoryLabel: fallback.subject,
      language: 'ne',
    });

    const missingFields = Array.isArray(parsed.missingFields)
      ? parsed.missingFields
          .map((item: any) => String(item || '').trim())
          .map((field: string) => {
            const normalized = toLowerSafe(field);
            const match = (Object.keys(FIELD_LABELS) as ApplicantFieldKey[]).find((key) => {
              const label = FIELD_LABELS[key].ne.toLowerCase();
              const labelEn = FIELD_LABELS[key].en.toLowerCase();
              return normalized.includes(label) || normalized.includes(labelEn);
            });
            return match;
          })
          .filter(Boolean) as ApplicantFieldKey[]
      : fallback.missingFields;

    const followUpQuestions = Array.isArray(parsed.followUpQuestions)
      ? parsed.followUpQuestions
          .map((item: any) => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((question: string, index: number) => ({
            field: missingFields[index] || fallback.missingFields[index] || 'purpose',
            questionNe: question,
            questionEn: question,
            placeholderNe: '',
            placeholderEn: '',
          }))
      : buildFollowUps(missingFields, 'ne');

    return {
      ...fallback,
      applicantName: application.applicantName,
      address: application.address,
      wardCode: application.wardCode,
      officeName: application.officeName,
      subject: application.subject,
      purpose: application.purpose,
      supportingDetails: application.supportingDetails,
      phone: application.phone,
      citizenshipNo: application.citizenshipNo,
      summary: String(parsed.summary || fallback.summary),
      missingFields,
      followUpQuestions,
      applicationText: application.text,
      printHtml: buildApplicationPrintHtml(application),
    };
  } catch {
    return fallback;
  }
};

export const analyzeApplicantInput = async (input: ApplicantInput): Promise<ApplicantAnalysis> => {
  const fallback = buildApplicantAnalysisFallback(input);
  const apiKey = getGeminiKey();

  if (!apiKey) {
    return fallback;
  }

  const prompt = [
    'तिमी पोखरा महानगरपालिकाको डिजिटल applicant assistant हौ।',
    'तपाईंलाई text, audio transcript र OCR text दिइएको छ। यी सबै स्रोतलाई मिलाएर औपचारिक सरकारी शैलीको आवेदन तयार गर।',
    'JSON मात्र फर्काऊ। Markdown, code fence, वा अतिरिक्त टिप्पणी नलेख।',
    'JSON schema:',
    '{"applicantName":"...","address":"...","wardCode":"...","officeName":"...","subject":"...","purpose":"...","supportingDetails":"...","phone":"...","citizenshipNo":"...","missingFields":["..."],"followUpQuestions":["..."],"summary":"..."}',
    'यदि विवरण अपूर्ण भए followUpQuestions मा छोटो र स्पष्ट प्रश्न राख।',
    'output after analysis must still be respectful Nepali application-ready text.',
    '',
    `चयन गरिएको वर्ग: ${input.categoryLabel}`,
    `सिफारिस / प्रकार: ${input.recommendationLabel}`,
    `नाम: ${input.applicantName || 'उल्लेख छैन'}`,
    `ठेगाना: ${input.address || 'उल्लेख छैन'}`,
    `वडा नं.: ${input.wardCode || 'उल्लेख छैन'}`,
    `कार्यालय: ${input.officeName || 'उल्लेख छैन'}`,
    `विषय: ${input.subject || 'उल्लेख छैन'}`,
    `उद्देश्य: ${input.purpose || 'उल्लेख छैन'}`,
    `समर्थन विवरण: ${input.supportingDetails || 'उल्लेख छैन'}`,
    `फोन: ${input.phone || 'उल्लेख छैन'}`,
    `नागरिकता नं.: ${input.citizenshipNo || 'उल्लेख छैन'}`,
    '',
    'TEXT INPUT:',
    input.rawText || 'उल्लेख छैन',
    '',
    'AUDIO TRANSCRIPT:',
    input.audioTranscript || 'उल्लेख छैन',
    '',
    'OCR TEXT:',
    input.ocrText || 'उल्लेख छैन',
  ].join('\n');

  const data = await geminiGenerate({
    apiKey,
    prompt,
    maxOutputTokens: 1500,
    responseMimeType: 'application/json',
  });

  if (!data) {
    return fallback;
  }

  const text = extractModelText(data);
  if (!text.trim()) {
    return fallback;
  }

  return parseAnalysisResponse(text, fallback);
};

export const buildApplicationPrintHtml = (application: {
  applicantName: string;
  address: string;
  wardCode: string;
  officeName: string;
  subject: string;
  purpose: string;
  supportingDetails: string;
  phone: string;
  citizenshipNo: string;
  text: string;
  mergedEvidence: string;
  dateLine: string;
}) => {
  const bodyLines = application.text.split('\n').map((line) => `<div>${escapeHtml(line || '&nbsp;')}</div>`).join('');

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page { margin: 24px; }
          body {
            font-family: 'Noto Sans Devanagari', 'Mangal', 'Nirmala UI', sans-serif;
            color: #1f2937;
            background: #f4f1ea;
            padding: 0;
            margin: 0;
          }
          .page {
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            padding: 28px;
            max-width: 760px;
            margin: 0 auto;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          }
          .masthead {
            text-align: center;
            border-bottom: 2px solid #d1d5db;
            padding-bottom: 14px;
            margin-bottom: 22px;
          }
          .office {
            font-size: 20px;
            font-weight: 800;
            color: #0f4c81;
          }
          .meta {
            font-size: 13px;
            color: #6b7280;
            margin-top: 6px;
          }
          .subject {
            font-size: 17px;
            font-weight: 800;
            margin: 18px 0 20px;
            color: #111827;
          }
          .application {
            line-height: 1.9;
            font-size: 15px;
          }
          .footer {
            margin-top: 28px;
            display: flex;
            justify-content: space-between;
            gap: 18px;
            font-size: 13px;
          }
          .sign {
            text-align: right;
            min-width: 220px;
          }
          .info {
            margin-top: 18px;
            border-top: 1px dashed #d1d5db;
            padding-top: 14px;
            font-size: 12px;
            color: #6b7280;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="masthead">
            <div class="office">${escapeHtml(application.officeName)}</div>
            <div class="meta">${escapeHtml(application.dateLine)}</div>
          </div>
          <div class="subject">विषय: ${escapeHtml(application.subject)}</div>
          <div class="application">${bodyLines}</div>
          <div class="footer">
            <div>
              <div><strong>नागरिकता नं.:</strong> ${escapeHtml(application.citizenshipNo)}</div>
              <div><strong>वडा नं.:</strong> ${escapeHtml(application.wardCode)}</div>
              <div><strong>सम्पर्क:</strong> ${escapeHtml(application.phone)}</div>
            </div>
            <div class="sign">
              <div><strong>निवेदक:</strong> ${escapeHtml(application.applicantName)}</div>
              <div style="margin-top: 14px;">हस्ताक्षर: ____________________</div>
            </div>
          </div>
          <div class="info">
            <div><strong>समर्थन विवरण:</strong> ${escapeHtml(application.supportingDetails || 'उल्लेख छैन')}</div>
            <div style="margin-top: 8px;"><strong>स्रोत/संलग्न विवरण:</strong> ${escapeHtml(application.mergedEvidence || 'उल्लेख छैन')}</div>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const buildFieldLabel = (field: ApplicantFieldKey, language: LanguageMode) =>
  language === 'ne' ? FIELD_LABELS[field].ne : FIELD_LABELS[field].en;

export const buildFollowUpPrompt = (field: ApplicantFieldKey, language: LanguageMode) => {
  const template = FOLLOW_UP_TEMPLATES[field];
  return language === 'ne' ? template.questionNe : template.questionEn;
};

export const buildFollowUpPlaceholder = (field: ApplicantFieldKey, language: LanguageMode) => {
  const template = FOLLOW_UP_TEMPLATES[field];
  return language === 'ne' ? template.placeholderNe : template.placeholderEn;
};

export const buildApplicationSummary = (input: ApplicantInput) => {
  const cleanedSource = mergeParts(input.rawText, input.audioTranscript, input.ocrText, input.supportingDetails);
  return cleanedSource
    ? cleanedSource.slice(0, 220)
    : `${normalizeText(input.applicantName) || 'आवेदक'} का लागि ${normalizeText(input.recommendationLabel) || normalizeText(input.subject) || 'निवेदन'} तयार हुँदैछ।`;
};

export const buildDemoApplicantInput = (): ApplicantInput => ({
  applicantName: 'रमेश श्रेष्ठ',
  address: 'लेकसाइड, पोखरा-६',
  wardCode: 'वडा नं. ६',
  officeName: 'श्रीमान् वडा अध्यक्षज्यू, वडा कार्यालय पोखरा महानगरपालिका',
  subject: 'निवास प्रमाणिकरण सम्बन्धी निवेदन',
  purpose: 'छात्रवृत्ति आवेदन र कार्यालयीय प्रमाणिकरणका लागि',
  supportingDetails: 'नागरिकताको प्रतिलिपि, बसोबास विवरण र टोल सिफारिस उपलब्ध छ।',
  phone: '९८५६००७१११',
  citizenshipNo: '12-01-02-000001',
  rawText: 'मलाई छात्रवृत्तिको लागि निवास प्रमाणिकरण आवश्यक छ।',
  audioTranscript: 'हामीले वडा कार्यालयमा निवेदन पेश गर्नेछौं।',
  ocrText: 'Household card and citizenship copy attached.',
  recommendationLabel: 'निवास प्रमाणिकरण',
  categoryLabel: 'व्यक्तिगत तथा परिचय सम्बन्धी सिफारिस',
  language: 'ne',
});
