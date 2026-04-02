import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, TextInput, RefreshControl, Image, ImageBackground, Modal, Keyboard, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow, Typography } from '../constants/theme';
import { useStore } from '../store/useStore';
import { citizenAPI, statsAPI, weatherAPI } from '../api/client';
import AppHeader from '../components/AppHeader';

type WeatherCardData = {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  humidity: number;
  visibilityKm: number;
  uvIndex: number;
  aqi: number;
};

type ForecastDay = {
  date: string;
  weatherCode: number;
  maxTemp: number;
  minTemp: number;
};

const DEFAULT_WEATHER: WeatherCardData = {
  temperature: 24,
  weatherCode: 1,
  isDay: true,
  humidity: 62,
  visibilityKm: 10,
  uvIndex: 2,
  aqi: 42,
};

const getWeatherCondition = (code: number, isNepali = false) => {
  if (code === 0) return isNepali ? 'खुला आकाश' : 'Clear Sky';
  if (code <= 2) return isNepali ? 'आंशिक घाम' : 'Mostly Sunny';
  if (code === 3) return isNepali ? 'बादल' : 'Cloudy';
  if (code >= 45 && code <= 48) return isNepali ? 'कुहिरो' : 'Foggy';
  if (code >= 51 && code <= 67) return isNepali ? 'वर्षा' : 'Rainy';
  if (code >= 71 && code <= 77) return isNepali ? 'हिमपात' : 'Snow';
  if (code >= 80 && code <= 86) return isNepali ? 'वर्षा छिटा' : 'Rain Showers';
  if (code >= 95) return isNepali ? 'चट्याङ्गसहित वर्षा' : 'Thunderstorm';
  return isNepali ? 'मौसम अपडेट' : 'Weather Update';
};

const getWeatherIcon = (code: number, isDay: boolean) => {
  if (code === 0) return isDay ? 'wb-sunny' : 'nights-stay';
  if (code <= 3) return 'wb-cloudy';
  if (code >= 45 && code <= 48) return 'blur-on';
  if (code >= 51 && code <= 67) return 'grain';
  if (code >= 71 && code <= 77) return 'ac-unit';
  if (code >= 80 && code <= 86) return 'umbrella';
  if (code >= 95) return 'flash-on';
  return 'wb-sunny';
};

const getUVLabel = (uvIndex: number, isNepali = false) => {
  if (uvIndex < 3) return isNepali ? 'कम' : 'Low';
  if (uvIndex < 6) return isNepali ? 'मध्यम' : 'Moderate';
  if (uvIndex < 8) return isNepali ? 'उच्च' : 'High';
  if (uvIndex < 11) return isNepali ? 'धेरै उच्च' : 'Very High';
  return isNepali ? 'अत्यधिक' : 'Extreme';
};

const getAQIState = (aqi: number, isNepali = false) => {
  if (aqi <= 50) return isNepali ? 'उत्तम' : 'Excellent';
  if (aqi <= 100) return isNepali ? 'मध्यम' : 'Moderate';
  if (aqi <= 150) return isNepali ? 'संवेदनशील' : 'Sensitive';
  if (aqi <= 200) return isNepali ? 'अस्वस्थ' : 'Unhealthy';
  if (aqi <= 300) return isNepali ? 'धेरै अस्वस्थ' : 'Very Unhealthy';
  return isNepali ? 'खतरनाक' : 'Hazardous';
};

const SERVICES = [
  { icon: 'receipt-long', label: 'Pay Tax', labelNE: 'कर तिर्नुहोस्', screen: 'Request' },
  { icon: 'water-drop', label: 'Water Bill', labelNE: 'पानीको बिल', screen: 'Request' },
  { icon: 'bolt', label: 'NEA Pay', labelNE: 'नेपाल विद्युत्', screen: 'Request' },
  { icon: 'description', label: 'Sifarish', labelNE: 'सिफारिस', screen: 'Request' },
];

const TOURIST_SERVICES = [
  { icon: 'explore', label: 'Explore Pokhara', labelNE: 'पोखरा अन्वेषण', screen: 'Request', desc: 'Routes, maps, and highlights', descNE: 'रुट, नक्सा, र मुख्य ठाउँहरू' },
  { icon: 'confirmation-number', label: 'Permits', labelNE: 'अनुमतिपत्र', screen: 'Request', desc: 'TIMS and entry guidance', descNE: 'TIMS र प्रवेश सहायता' },
  { icon: 'local-taxi', label: 'Transport', labelNE: 'यातायात', screen: 'Track', desc: 'Shuttle, taxi, and ride help', descNE: 'शटल, ट्याक्सी, र यात्रा सहायता' },
  { icon: 'support-agent', label: 'Help Desk', labelNE: 'सहायता डेस्क', screen: 'Verify', desc: 'Emergency and visitor support', descNE: 'आपतकालीन र आगन्तुक सहायता' },
];

const TOURIST_MENU = [
  { icon: 'map', label: 'Explore Pokhara', labelNE: 'पोखरा अन्वेषण', screen: 'Request' },
  { icon: 'verified-user', label: 'Permit Help', labelNE: 'अनुमति सहायता', screen: 'Verify' },
  { icon: 'directions-bus', label: 'Transport', labelNE: 'यातायात', screen: 'Track' },
  { icon: 'smart-toy', label: 'AI Assistant', labelNE: 'AI सहायक', screen: 'AiAssistant' },
];

const CITIZEN_MENU = [
  { icon: 'assignment', label: 'Ward Services', labelNE: 'वडा सेवा', screen: 'Request' },
  { icon: 'qr-code', label: 'Digital Card', labelNE: 'डिजिटल कार्ड', screen: 'Verify' },
  { icon: 'history', label: 'My Requests', labelNE: 'मेरो अनुरोधहरू', screen: 'Track' },
  { icon: 'smart-toy', label: 'AI Assistant', labelNE: 'AI सहायक', screen: 'AiAssistant' },
];

const NOTICE_STORY_IMAGES = [
  'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1581092160607-ee22731c2b96?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1513279922550-3f2a4dff1d6a?auto=format&fit=crop&w=900&q=80',
];

const DEMO_NEWS = [
  {
    notice_id: 'demo-1',
    title: 'Lakeside Park Maintenance Schedule',
    title_ne: 'झील किनारमा पार्क मेरामत कार्यक्रम',
    category: 'INFRASTRUCTURE',
    content: 'The Lakeside Park will undergo maintenance from Monday to Friday. Please use alternative routes.',
    is_urgent: false,
    published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ward_no: 9,
  },
  {
    notice_id: 'demo-2',
    title: 'Health Checkup Camp - Ward 9',
    title_ne: 'स्वास्थ्य परीक्षण शिविर - वार्ड नं. ९',
    category: 'HEALTH',
    content: 'Free health checkup camp for senior citizens. Date: Next Saturday, 9 AM at Ward Office.',
    is_urgent: false,
    published_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    ward_no: 9,
  },
  {
    notice_id: 'demo-3',
    title: 'Water Supply Interruption - Emergency Notice',
    title_ne: 'पानीको आपूर्ति विच्छेद - आपतकालीन सूचना',
    category: 'UTILITIES',
    content: 'Water supply will be disrupted tomorrow 8 AM to 4 PM for pipeline maintenance.',
    is_urgent: true,
    published_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    ward_no: 9,
  },
  {
    notice_id: 'demo-4',
    title: 'Community Cleanup Drive - Volunteers Needed',
    title_ne: 'सामुदायिक सफाइ अभियान - स्वयंसेवक आवश्यक',
    category: 'COMMUNITY',
    content: 'Join us for a weekend cleanup drive. Supplies provided. Register at the ward office.',
    is_urgent: false,
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    ward_no: 9,
  },
  {
    notice_id: 'demo-5',
    title: 'Road Development Project Updates',
    title_ne: 'सडक विकास परियोजना अपडेट',
    category: 'INFRASTRUCTURE',
    content: 'Phase 2 of the main road construction is now 85% complete. Expected completion by next month.',
    is_urgent: false,
    published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    ward_no: 9,
  },
];

type NoticeFeedItem = {
  notice_id?: string;
  title?: string;
  title_ne?: string;
  category?: string;
  content?: string;
  is_urgent?: boolean;
  published_at?: string;
  ward_code?: string;
  ward_no?: string | number;
  ward?: string | number;
  posted_ward?: string | number;
  officer_ward?: string | number;
  posted_by_officer?: {
    ward_code?: string;
    ward_no?: string | number;
    ward?: string | number;
  };
};

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  screen: string;
  keywords: string[];
};

type MenuItem = {
  icon: string;
  label: string;
  labelNE: string;
  screen: string;
};

type ServiceItem = {
  icon: string;
  label: string;
  labelNE: string;
  screen: string;
  desc?: string;
  descNE?: string;
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);

const scoreSearchResult = (query: string, item: SearchResult) => {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const title = item.title.toLowerCase();
  const subtitle = item.subtitle.toLowerCase();
  const keywordText = item.keywords.join(' ').toLowerCase();

  if (title === q) return 100;
  if (title.startsWith(q)) return 85;
  if (title.includes(q)) return 70;
  if (keywordText.includes(q)) return 55;
  if (subtitle.includes(q)) return 40;

  const qTokens = tokenize(q);
  if (!qTokens.length) return 0;
  let tokenScore = 0;
  qTokens.forEach((token) => {
    if (title.includes(token)) tokenScore += 12;
    else if (keywordText.includes(token)) tokenScore += 8;
    else if (subtitle.includes(token)) tokenScore += 4;
  });

  return tokenScore;
};

export default function HomeScreen({ navigation }: any) {
  const { citizen, tourist, isTourist, logout, language } = useStore();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<any>(null);
  const [weather, setWeather] = useState<WeatherCardData>(DEFAULT_WEATHER);
  const [forecastDays, setForecastDays] = useState<ForecastDay[]>([]);
  const [notices, setNotices] = useState<NoticeFeedItem[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [selectedStory, setSelectedStory] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isNepali = language === 'ne';
  const today = new Date().toLocaleDateString(isNepali ? 'ne-NP' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const t = (en: string, ne: string) => (isNepali ? ne : en);

  const loadStats = async () => {
    try {
      const res = await statsAPI.getStats();
      if (res.success) setStats(res.stats);
    } catch (e) {
      // Demo mode — no server needed for home screen
    }
  };

  const loadWeather = async () => {
    try {
      const res = await weatherAPI.getPokharaWeather();
      if (!res.success || !res.weather) return;

      const nextWeather: WeatherCardData = {
        temperature: Number(res.weather.temperature ?? DEFAULT_WEATHER.temperature),
        weatherCode: Number(res.weather.weatherCode ?? DEFAULT_WEATHER.weatherCode),
        isDay: Boolean(res.weather.isDay),
        humidity: Number(res.weather.humidity ?? DEFAULT_WEATHER.humidity),
        visibilityKm: Number((Number(res.weather.visibilityMeters ?? DEFAULT_WEATHER.visibilityKm * 1000) / 1000).toFixed(1)),
        uvIndex: Number(res.weather.uvIndexMax ?? DEFAULT_WEATHER.uvIndex),
        aqi: Number(res.weather.aqi ?? DEFAULT_WEATHER.aqi),
      };

      setWeather(nextWeather);
    } catch {
      // Keep fallback defaults on fetch failures
    }
  };

  const loadForecast = async () => {
    try {
      const res = await weatherAPI.getPokharaFiveDayForecast();
      if (!res.success || !res.forecast) return;

      const dates = Array.isArray(res.forecast.dates) ? res.forecast.dates : [];
      const weatherCodes = Array.isArray(res.forecast.weatherCodes) ? res.forecast.weatherCodes : [];
      const maxTemps = Array.isArray(res.forecast.maxTemps) ? res.forecast.maxTemps : [];
      const minTemps = Array.isArray(res.forecast.minTemps) ? res.forecast.minTemps : [];

      const merged = dates.map((date: string, index: number) => ({
        date,
        weatherCode: Number(weatherCodes[index] ?? 0),
        maxTemp: Number(maxTemps[index] ?? 0),
        minTemp: Number(minTemps[index] ?? 0),
      }));

      setForecastDays(merged);
    } catch {
      setForecastDays([]);
    }
  };

  const loadNotices = async () => {
    setNoticesLoading(true);
    try {
      const wardCode = citizen?.ward_code || 'NPL-04-33-09';
      const res = await citizenAPI.getNotices(wardCode);
      if (res.success) {
        setNotices(Array.isArray(res.notices) ? res.notices : []);
      }
    } catch {
      setNotices([]);
    } finally {
      setNoticesLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadWeather(), loadForecast(), loadNotices()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadStats();
    loadWeather();
    loadForecast();
    loadNotices();
  }, []);

  const formatForecastDay = (isoDate: string) => {
    if (!isoDate) return isNepali ? 'दिन' : 'Day';
    const d = new Date(isoDate);
    const weekday = d.toLocaleDateString(isNepali ? 'ne-NP' : 'en-US', { weekday: 'short' });
    return weekday;
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 180);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const menuItems: MenuItem[] = isTourist ? TOURIST_MENU : CITIZEN_MENU;
  const serviceItems: ServiceItem[] = isTourist ? TOURIST_SERVICES : SERVICES;

  const getNoticeWardLabel = (notice: NoticeFeedItem | undefined) => {
    const rawWard =
      notice?.ward_no ??
      notice?.ward ??
      notice?.posted_ward ??
      notice?.officer_ward ??
      notice?.ward_code ??
      notice?.posted_by_officer?.ward_no ??
      notice?.posted_by_officer?.ward ??
      notice?.posted_by_officer?.ward_code;

    if (typeof rawWard === 'number') {
      return `${isNepali ? 'वडा' : 'Ward'} ${String(rawWard).padStart(2, '0')}`;
    }

    if (typeof rawWard === 'string' && rawWard.trim()) {
      const wardMatch = rawWard.match(/(\d+)/);
      if (wardMatch) {
        return `${isNepali ? 'वडा' : 'Ward'} ${wardMatch[1].padStart(2, '0')}`;
      }
      if (rawWard.startsWith('Ward') || rawWard.startsWith('वडा')) return rawWard;
      return `${isNepali ? 'वडा' : 'Ward'} ${rawWard}`;
    }

    const citizenWard = String(citizen?.ward_code || '').match(/(\d+)/g);
    const wardNo = citizenWard?.[citizenWard.length - 1] || '09';
    return `${isNepali ? 'वडा' : 'Ward'} ${wardNo.padStart(2, '0')}`;
  };

  const storyCards = useMemo(() => {
    return notices.slice(0, 5).map((notice, index) => ({
      title: isNepali ? (notice.title_ne || notice.title || 'सूचना') : (notice.title || notice.title_ne || 'Notice'),
      wardLabel: getNoticeWardLabel(notice),
      time: notice.published_at ? new Date(notice.published_at).toLocaleString(isNepali ? 'ne-NP' : [], { month: 'short', day: 'numeric' }) : index === 0 ? t('JUST NOW', 'अहिले') : t(`${index + 1} HRS AGO`, `${index + 1} घण्टा अघि`),
      image: NOTICE_STORY_IMAGES[index % NOTICE_STORY_IMAGES.length],
      summary: notice.content || t('Open the notice board for more detail.', 'थप विवरणका लागि सूचना बोर्ड खोल्नुहोस्।'),
    }));
  }, [notices, citizen?.ward_code, isNepali]);

  const searchableItems = useMemo<SearchResult[]>(() => {
    if (isTourist) {
      const serviceItems = TOURIST_SERVICES.map((item) => ({
        id: `tourist-service-${item.label}`,
        title: isNepali ? item.labelNE : item.label,
        subtitle: isNepali ? item.descNE || item.desc || '' : item.desc || '',
        icon: item.icon,
        screen: item.screen,
        keywords: [item.label, item.labelNE, item.desc || '', item.descNE || '', 'tourist', 'service', 'pokhara'],
      }));

      const menuSearchItems = TOURIST_MENU.map((item) => ({
        id: `tourist-menu-${item.label}`,
        title: isNepali ? item.labelNE : item.label,
        subtitle: t('Quick menu action', 'छिटो मेनु कार्य'),
        icon: item.icon,
        screen: item.screen,
        keywords: [item.label, item.labelNE, 'menu', 'tourist'],
      }));

      return [...serviceItems, ...menuSearchItems];
    }

    const serviceItems = SERVICES.map((item) => ({
      id: `citizen-service-${item.label}`,
        title: isNepali ? item.labelNE : item.label,
        subtitle: t('E-Sewa service', 'ई-सेवा सुविधा'),
      icon: item.icon,
      screen: item.screen,
        keywords: [item.label, item.labelNE, 'service', 'citizen', 'esewa'],
    }));

    const menuSearchItems = CITIZEN_MENU.map((item) => ({
      id: `citizen-menu-${item.label}`,
        title: isNepali ? item.labelNE : item.label,
        subtitle: t('Citizen menu action', 'नागरिक मेनु कार्य'),
      icon: item.icon,
      screen: item.screen,
        keywords: [item.label, item.labelNE, 'menu', 'citizen', 'ward'],
    }));

    const noticeItems = notices.map((item) => ({
      id: item.notice_id || item.title || 'notice',
      title: isNepali ? (item.title_ne || item.title || 'सूचना') : (item.title || item.title_ne || 'Notice'),
      subtitle: item.content || t('Municipal notice', 'नगरपालिका सूचना'),
      icon: item.is_urgent ? 'campaign' : item.category === 'HEALTH' ? 'local-hospital' : item.category === 'INFRASTRUCTURE' ? 'construction' : 'newspaper',
      screen: 'CitizenPortal',
      keywords: [item.title || '', item.title_ne || '', item.category || '', item.content || '', 'notice', 'news', 'ward'],
    }));

    return [...serviceItems, ...menuSearchItems, ...noticeItems];
  }, [isTourist, notices, isNepali]);

  const searchResults = useMemo(() => {
    if (!debouncedQuery) {
      return searchableItems.slice(0, 5);
    }

    return searchableItems
      .map((item) => ({ item, score: scoreSearchResult(debouncedQuery, item) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((entry) => entry.item);
  }, [debouncedQuery, searchableItems]);

  const showSearchPanel = !isTourist && (searchQuery.trim().length > 0 || debouncedQuery.length > 0);

  const handleSearchSelect = (item: SearchResult) => {
    setSearchQuery('');
    setDebouncedQuery('');
    Keyboard.dismiss();
    navigation.navigate(item.screen);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showMenu showNotif showLang onMenu={() => setShowMenu(true)} onNotif={() => {}} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {isTourist ? (
          <>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryContainer]}
              style={styles.touristHero}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={styles.touristBadge}>
                <MaterialIcons name="flight-takeoff" size={14} color={Colors.primary} />
                <Text style={styles.touristBadgeText}>{t('Tourist Mode', 'पर्यटक मोड')}</Text>
              </View>
              <Text style={styles.touristTitle}>{t('Welcome', 'स्वागत छ')}, {tourist?.name || t('Traveler', 'यात्रु')}</Text>
              <Text style={styles.touristDesc}>
                {t(
                  'Quick access to permits, transport, help, and the best places around Pokhara.',
                  'अनुमति, यातायात, सहायता, र पोखराका प्रमुख ठाउँहरूमा छिटो पहुँच।'
                )}
              </Text>
              <View style={styles.touristMetaRow}>
                <View style={styles.touristMetaPill}><Text style={styles.touristMetaText}>{today}</Text></View>
                <View style={styles.touristMetaPill}><Text style={styles.touristMetaText}>{tourist?.nationality || t('International visitor', 'अन्तर्राष्ट्रिय आगन्तुक')}</Text></View>
              </View>
            </LinearGradient>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('Visitor Hub', 'आगन्तुक केन्द्र')} <Text style={styles.sectionSub}>{t('/ Quick actions', '/ छिटो कार्यहरू')}</Text></Text>
            </View>
            <View style={styles.touristGrid}>
              {TOURIST_SERVICES.map((service) => (
                <TouchableOpacity
                  key={service.label}
                  style={styles.touristServiceCard}
                  onPress={() => navigation.navigate(service.screen)}
                  activeOpacity={0.85}
                >
                  <View style={styles.touristServiceIcon}>
                    <MaterialIcons name={service.icon as any} size={22} color={Colors.primary} />
                  </View>
                  <Text style={styles.touristServiceLabel}>{isNepali ? service.labelNE : service.label}</Text>
                  <Text style={styles.touristServiceDesc}>{isNepali ? service.descNE : service.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.touristBento}>
              <View style={styles.touristInfoCard}>
                <Text style={styles.touristInfoTag}>{t('Travel helper', 'यात्रा सहायक')}</Text>
                <Text style={styles.touristInfoTitle}>{t('Need a route, a guide, or a permit?', 'बाटो, गाइड, वा अनुमति चाहिएको छ?')}</Text>
                <Text style={styles.touristInfoDesc}>
                  {t(
                    'Use the hamburger menu for visitor-only shortcuts and local support.',
                    'आगन्तुकका लागि रहेका छोटा विकल्प र स्थानीय सहयोगका लागि मेनु प्रयोग गर्नुहोस्।'
                  )}
                </Text>
              </View>
              <View style={styles.touristSupportCard}>
                <MaterialIcons name="sos" size={26} color={Colors.secondary} />
                <Text style={styles.touristSupportTitle}>{t('Emergency', 'आपतकालीन')}</Text>
                <Text style={styles.touristSupportDesc}>{t('Instant access to help, police, and local contacts.', 'सहायता, प्रहरी, र स्थानीय सम्पर्कमा तुरुन्त पहुँच।')}</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Welcome */}
            <View style={styles.welcome}>
              <Text style={styles.dateText}>{today}</Text>
              <Text style={styles.greetText}>{t('Namaste, Pokhara', 'नमस्ते, पोखरा')}</Text>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
              <MaterialIcons name="search" size={22} color={Colors.primary} style={{ opacity: 0.6 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('What do you need today?', 'आज के चाहिएको छ?')}
                placeholderTextColor={Colors.outline}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                onSubmitEditing={() => {
                  if (searchResults.length) {
                    handleSearchSelect(searchResults[0]);
                  }
                }}
              />
              <TouchableOpacity
                style={styles.micBtn}
                onPress={() => {
                  if (searchQuery.trim()) {
                    setSearchQuery('');
                    setDebouncedQuery('');
                    Keyboard.dismiss();
                  }
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons name={searchQuery.trim() ? 'close' : 'mic'} size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {showSearchPanel && (
              <View style={styles.searchResultsCard}>
                {searchResults.length ? (
                  searchResults.map((item, index) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.searchResultRow, index === searchResults.length - 1 && styles.searchResultRowLast]}
                      activeOpacity={0.8}
                      onPress={() => handleSearchSelect(item)}
                    >
                      <View style={styles.searchResultIcon}>
                        <MaterialIcons name={item.icon as any} size={18} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={styles.searchResultTitle}>{item.title}</Text>
                        <Text numberOfLines={1} style={styles.searchResultSubtitle}>{item.subtitle}</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.searchEmptyState}>
                    <MaterialIcons name="search-off" size={18} color={Colors.outline} />
                    <Text style={styles.searchEmptyText}>{t('No matching services found', 'मिल्ने सेवा भेटिएन')}</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {!isTourist && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('Top Stories', 'मुख्य सूचना')} <Text style={styles.sectionSub}>{t('/ Quick updates', '/ ताजा अपडेट')}</Text></Text>
              <TouchableOpacity onPress={() => navigation.navigate('CitizenPortal')}>
                <Text style={styles.viewAll}>{t('Open', 'खोल्नुहोस्')}</Text>
              </TouchableOpacity>
            </View>
            {noticesLoading ? (
              <View style={styles.noticeEmptyState}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.noticeEmptyText}>{t('Loading notices...', 'सूचना लोड हुँदैछ...')}</Text>
              </View>
            ) : storyCards.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>
                {storyCards.map((story, index) => (
                  <TouchableOpacity
                    key={`${story.title}-${index}`}
                    activeOpacity={0.9}
                    style={styles.storyCard}
                    onPress={() => setSelectedStory(story)}
                  >
                    <ImageBackground source={{ uri: story.image }} style={styles.storyImage} imageStyle={styles.storyImageClip}>
                      <LinearGradient colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.72)']} style={StyleSheet.absoluteFill} />
                      <View style={styles.storyTopRow}>
                        <View style={styles.storyBadge}>
                          <Text style={styles.storyBadgeText}>{story.wardLabel}</Text>
                        </View>
                      </View>
                    </ImageBackground>
                    <View style={styles.storyCaption}>
                      <Text numberOfLines={2} style={styles.storyTitle}>{story.title}</Text>
                      <Text style={styles.storyMeta}>{story.time}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noticeEmptyState}>
                <MaterialIcons name="inbox" size={18} color={Colors.outline} />
                <Text style={styles.noticeEmptyText}>{t('No notices published yet.', 'अहिलेसम्म कुनै सूचना प्रकाशित छैन।')}</Text>
              </View>
            )}
          </>
        )}

        {!isTourist && (
          <>
            {/* Weather */}
            <View style={styles.fullWidthRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weatherStrip}>
                <View style={styles.weatherCard}>
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryContainer]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  />
                  <View style={styles.weatherBadge}>
                    <Text style={styles.weatherBadgeText}>{t('Atmosphere Today', 'आजको मौसम')}</Text>
                  </View>
                  <View style={styles.weatherMain}>
                    <MaterialIcons name={getWeatherIcon(weather.weatherCode, weather.isDay) as any} size={44} color="#fff" />
                    <View>
                      <Text style={styles.tempText}>{Math.round(weather.temperature)}°C</Text>
                      <Text style={styles.condText}>{getWeatherCondition(weather.weatherCode, isNepali)} · Pokhara-6</Text>
                    </View>
                    <View style={styles.aqiBox}>
                      <Text style={styles.aqiLabel}>{t('AQI Index', 'AQI सूचकांक')}</Text>
                      <Text style={styles.aqiNum}>{Math.round(weather.aqi)}</Text>
                      <Text style={styles.aqiState}>{getAQIState(weather.aqi, isNepali)}</Text>
                    </View>
                  </View>
                  <View style={styles.weatherStats}>
                    <View style={styles.weatherStat}>
                      <Text style={styles.weatherStatLabel}>{t('Humidity', 'आर्द्रता')}</Text>
                      <Text style={styles.weatherStatVal}>{Math.round(weather.humidity)}%</Text>
                    </View>
                    <View style={styles.weatherStat}>
                      <Text style={styles.weatherStatLabel}>{t('UV Index', 'UV सूचकांक')}</Text>
                      <Text style={styles.weatherStatVal}>{getUVLabel(weather.uvIndex, isNepali)}</Text>
                    </View>
                    <View style={styles.weatherStat}>
                      <Text style={styles.weatherStatLabel}>{t('Visibility', 'दृश्यता')}</Text>
                      <Text style={styles.weatherStatVal}>{weather.visibilityKm}km</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.weatherForecastCard}>
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryContainer]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  />
                  <View style={styles.weatherBadge}>
                    <Text style={styles.weatherBadgeText}>{t('5-Day Forecast', '५ दिनको पूर्वानुमान')}</Text>
                  </View>

                  {forecastDays.length ? (
                    <View style={styles.forecastList}>
                      {forecastDays.map((day) => (
                        <View key={day.date} style={styles.forecastRow}>
                          <Text style={styles.forecastDay}>{formatForecastDay(day.date)}</Text>
                          <View style={styles.forecastIconWrap}>
                            <MaterialIcons name={getWeatherIcon(day.weatherCode, true) as any} size={16} color="#fff" />
                          </View>
                          <Text style={styles.forecastCondition}>{getWeatherCondition(day.weatherCode, isNepali)}</Text>
                          <Text style={styles.forecastTemp}>{Math.round(day.maxTemp)}° / {Math.round(day.minTemp)}°</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.forecastEmptyState}>
                      <MaterialIcons name="cloud-off" size={18} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.forecastEmptyText}>{t('Forecast unavailable right now', 'अहिले पूर्वानुमान उपलब्ध छैन')}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>

            <View style={styles.fullWidthRow}>
              {/* Ward Card */}
              <View style={styles.wardCard}>
                <View style={styles.wardTop}>
                  <View style={styles.wardIcon}>
                    <MaterialIcons name="location-on" size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.wardBadge}>
                    <Text style={styles.wardBadgeText}>Ward 09</Text>
                  </View>
                </View>
                <Text style={styles.wardTitle}>{t('Ward Presence', 'वडा उपस्थिति')}</Text>
                <Text style={styles.wardDesc}>{t('Your local representatives are active. Check ward progress.', 'तपाईंका स्थानीय प्रतिनिधि सक्रिय छन्। वडाको प्रगति हेर्नुहोस्।')}</Text>
                <TouchableOpacity style={styles.wardBtn} onPress={() => navigation.navigate('WardMap')}>
                  <Text style={styles.wardBtnText}>{t('Open Ward Map', 'वडा नक्सा खोल्नुहोस्')}</Text>
                  <MaterialIcons name="arrow-forward" size={14} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Notices / News */}
        {!isTourist && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('Suchana', 'सूचना')} <Text style={styles.sectionSub}>{t('/ Notices & News', '/ सूचना र समाचार')}</Text></Text>
              <TouchableOpacity onPress={() => navigation.navigate('CitizenPortal')}>
                <Text style={styles.viewAll}>{t('View All', 'सबै हेर्नुहोस्')}</Text>
              </TouchableOpacity>
            </View>

            {(() => {
              const feed = DEMO_NEWS.slice(0, 5);
              if (!feed.length) {
                return (
                  <View style={styles.noticeEmptyState}>
                    <MaterialIcons name="newspaper" size={18} color={Colors.outline} />
                    <Text style={styles.noticeEmptyText}>{t('No notices available.', 'कुनै सूचना उपलब्ध छैन।')}</Text>
                  </View>
                );
              }

              const urgentItem = feed.find((item) => item.is_urgent) || feed[0];
              const secondaryItems = feed.filter((item) => item.notice_id !== urgentItem?.notice_id).slice(0, 4);

              return (
                <>
                  <TouchableOpacity activeOpacity={0.92} style={styles.heroNewsCard} onPress={() => navigation.navigate('CitizenPortal')}>
                    <LinearGradient
                      colors={[Colors.primary, Colors.primaryContainer]}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.heroNewsOverlay}>
                      <View style={styles.heroTagWrap}>
                        <Text style={styles.heroTag}>{urgentItem?.category || t('NOTICE', 'सूचना')}</Text>
                        <Text style={styles.heroLatest}>{urgentItem?.is_urgent ? t('URGENT', 'तत्काल') : t('LATEST', 'नयाँ')}</Text>
                      </View>
                      <Text style={styles.heroNewsTitle}>{urgentItem ? (isNepali ? (urgentItem.title_ne || urgentItem.title || 'सूचना') : (urgentItem.title || urgentItem.title_ne || 'Notice')) : t('Latest Notice', 'ताजा सूचना')}</Text>
                      <Text style={styles.heroNewsSummary}>{urgentItem?.content || t('Check the notices board for important updates.', 'महत्त्वपूर्ण अपडेटका लागि सूचना बोर्ड जाँच गर्नुहोस्।')}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.newsGrid}>
                    {secondaryItems.map((item) => (
                      <TouchableOpacity key={item.notice_id} activeOpacity={0.9} style={styles.newsItemCard} onPress={() => navigation.navigate('CitizenPortal')}>
                        <View style={[styles.newsThumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: item.is_urgent ? '#FEE2E2' : Colors.primaryFixed }]}>
                          <MaterialIcons
                            name={(item.is_urgent ? 'campaign' : item.category === 'HEALTH' ? 'local-hospital' : item.category === 'INFRASTRUCTURE' ? 'construction' : 'article') as any}
                            size={22}
                            color={item.is_urgent ? Colors.secondary : Colors.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={2} style={styles.newsItemTitle}>{isNepali ? (item.title_ne || item.title || 'सूचना') : (item.title || item.title_ne || 'Notice')}</Text>
                          <Text numberOfLines={2} style={styles.newsItemTime}>{item.content || t('Official update', 'आधिकारिक अपडेट')}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              );
            })()}
          </>
        )}

        {/* E-Sewa Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isTourist ? t('Visitor Services', 'आगन्तुक सेवा') : 'E-Sewa'} <Text style={styles.sectionSub}>{t('/ Direct', '/ सिधा पहुँच')}</Text></Text>
        </View>
        <View style={isTourist ? styles.touristGrid : styles.servicesGrid}>
          {serviceItems.map((s: ServiceItem) => (
            <TouchableOpacity
              key={s.label}
              style={isTourist ? styles.touristServiceCardCompact : styles.serviceCard}
              onPress={() => navigation.navigate(s.screen)}
              activeOpacity={0.8}
            >
              <MaterialIcons name={s.icon as any} size={28} color={Colors.primary} />
              <Text style={styles.serviceLabel}>{isNepali ? s.labelNE : s.label}</Text>
              {isTourist && <Text style={styles.touristServiceDesc}>{isNepali ? s.descNE : s.desc}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Digital Citizen Card */}
        {!isTourist ? (
          <View style={styles.digitalCard}>
            <View style={styles.digitalTop}>
              <MaterialIcons name="verified" size={20} color={Colors.goldLight} />
              <Text style={styles.digitalLabel}>{t('Digital Citizen Card', 'डिजिटल नागरिक कार्ड')}</Text>
            </View>
            <Text style={styles.digitalDesc}>
              {t('Your virtual identity card for quick verification at ward offices.', 'वडा कार्यालयमा छिटो प्रमाणीकरणका लागि तपाईंको डिजिटल परिचयपत्र।')}
            </Text>
            <TouchableOpacity
              style={styles.qrBtn}
              onPress={() => navigation.navigate('Verify')}
            >
              <MaterialIcons name="qr-code" size={16} color="#fff" />
              <Text style={styles.qrBtnText}>{t('Show QR Code', 'QR कोड देखाउनुहोस्')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.touristGuideCard}>
            <MaterialIcons name="travel-explore" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.touristGuideTitle}>{t('Stay connected while exploring.', 'अन्वेषण गर्दा पनि सम्पर्कमा रहनुहोस्।')}</Text>
              <Text style={styles.touristGuideDesc}>
                {t('Use the menu for permits, routes, and local support anytime.', 'अनुमति, मार्ग, र स्थानीय सहयोगका लागि जुनसुकै बेला मेनु प्रयोग गर्नुहोस्।')}
              </Text>
            </View>
          </View>
        )}

        {/* PRATIBIMBA Stats */}
        {!isTourist && stats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>{t('🔒 PRATIBIMBA Live', '🔒 PRATIBIMBA प्रत्यक्ष')}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.total_documents?.toLocaleString() || '—'}</Text>
                <Text style={styles.statLbl}>{t('Documents', 'कागजात')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.issued_today || '—'}</Text>
                <Text style={styles.statLbl}>{t('Today', 'आज')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: Colors.success }]}>
                  {stats.tampered_alerts === 0 ? '✓' : '⚠'}
                </Text>
                <Text style={styles.statLbl}>{t('Integrity', 'अखण्डता')}</Text>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      <Modal
        visible={Boolean(selectedStory)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedStory(null)}
      >
        <View style={styles.storyModalBackdrop}>
          <TouchableOpacity
            style={styles.storyModalDismissLayer}
            activeOpacity={1}
            onPress={() => setSelectedStory(null)}
          />

          <View style={styles.storyModalCard}>
            <View style={styles.storyModalMediaWrap}>
              <ImageBackground source={{ uri: selectedStory?.image }} style={styles.storyModalImage} imageStyle={styles.storyModalImageClip}>
                <LinearGradient colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
                <View style={styles.storyModalHeader}>
                  <View style={styles.storyModalTagPill}>
                    <Text style={styles.storyModalTag}>{selectedStory?.wardLabel || t('Ward 09', 'वडा ०९')}</Text>
                  </View>
                  <TouchableOpacity style={styles.storyModalClose} onPress={() => setSelectedStory(null)}>
                    <MaterialIcons name="close" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </ImageBackground>
            </View>

            <ScrollView
              style={styles.storyModalScroll}
              contentContainerStyle={styles.storyModalScrollContent}
              showsVerticalScrollIndicator={false}
              bounces
            >
              <Text style={styles.storyModalTitle}>{selectedStory?.title}</Text>
              <Text style={styles.storyModalSummary}>{selectedStory?.summary}</Text>
            </ScrollView>

            <View style={styles.storyModalActions}>
              <TouchableOpacity style={styles.storyModalPrimary} onPress={() => { setSelectedStory(null); navigation.navigate('CitizenPortal'); }}>
                <MaterialIcons name="article" size={16} color="#fff" />
                <Text style={styles.storyModalPrimaryText}>{t('Open notice board', 'सूचना बोर्ड खोल्नुहोस्')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.storyModalSecondary} onPress={() => setSelectedStory(null)}>
                <Text style={styles.storyModalSecondaryText}>{t('Close', 'बन्द गर्नुहोस्')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuKicker}>{isTourist ? t('Tourist menu', 'पर्यटक मेनु') : t('Citizen menu', 'नागरिक मेनु')}</Text>
                <Text style={styles.menuTitle}>{isTourist ? tourist?.name || t('Traveler', 'यात्रु') : citizen?.name || t('Resident', 'निवासी')}</Text>
              </View>
              <TouchableOpacity style={styles.menuClose} onPress={() => setShowMenu(false)}>
                <MaterialIcons name="close" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate(item.screen);
                }}
              >
                <MaterialIcons name={item.icon as any} size={20} color={Colors.primary} />
                <Text style={styles.menuItemText}>{isNepali ? item.labelNE : item.label}</Text>
                <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.menuLogout}
              onPress={async () => {
                setShowMenu(false);
                await logout();
              }}
            >
              <MaterialIcons name="logout" size={20} color={Colors.secondary} />
              <Text style={styles.menuLogoutText}>{t('Logout', 'लगआउट')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Emergency FAB */}
      <TouchableOpacity style={[styles.fab, { right: 16, bottom: 16 + insets.bottom }]}>
        <MaterialIcons name="sos" size={22} color="#fff" />
        <Text style={styles.fabText}>{t('Emergency', 'आपतकालीन')}</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scrollContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 130 },
  welcome: { marginBottom: 14 },
  touristHero: {
    borderRadius: Radius.xl,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
    ...Shadow.md,
  },
  touristBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  touristBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  touristTitle: { fontSize: 26, fontWeight: '900', color: '#fff', lineHeight: 32 },
  touristDesc: { fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 19, marginTop: 8 },
  touristMetaRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  touristMetaPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  touristMetaText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  dateText: { ...Typography.overline, color: Colors.onSurfaceVariant, letterSpacing: 1.5 },
  greetText: { ...Typography.display, color: Colors.primary, marginTop: 2 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.full, paddingHorizontal: 18,
    paddingVertical: 4, marginBottom: 18, ...Shadow.sm,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.onSurface, paddingVertical: 12 },
  micBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  searchResultsCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    marginTop: -8,
    marginBottom: 18,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant,
  },
  searchResultRowLast: {
    borderBottomWidth: 0,
  },
  searchResultIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  searchResultSubtitle: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  searchEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  searchEmptyText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { ...Typography.title, color: Colors.primary },
  sectionSub: { fontWeight: '400', color: Colors.outline },
  viewAll: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  noticeEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Radius.xl,
    paddingVertical: 14,
    marginBottom: 14,
  },
  noticeEmptyText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  storyRow: { gap: 12, paddingRight: 12, paddingBottom: 8, marginBottom: 14 },
  storyCard: {
    width: 96,
    alignItems: 'center',
  },
  storyImage: {
    width: 86,
    height: 86,
    justifyContent: 'flex-start',
  },
  storyImageClip: {
    borderRadius: 43,
  },
  storyTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 8,
  },
  storyBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  storyBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  storyCaption: {
    width: '100%',
    paddingTop: 8,
    alignItems: 'center',
    gap: 2,
  },
  storyTitle: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
    textAlign: 'center',
  },
  storyMeta: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  storyModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 20, 18, 0.45)',
    padding: 20,
    justifyContent: 'center',
  },
  storyModalDismissLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  storyModalCard: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    maxHeight: '84%',
    ...Shadow.lg,
  },
  storyModalMediaWrap: {
    padding: 10,
    paddingBottom: 0,
  },
  storyModalImage: {
    minHeight: 180,
    justifyContent: 'flex-start',
  },
  storyModalImageClip: {
    borderRadius: 20,
  },
  storyModalContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  storyModalScroll: {
    maxHeight: 220,
  },
  storyModalScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
  },
  storyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  storyModalTagPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  storyModalTag: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  storyModalClose: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyModalTitle: {
    color: Colors.primary,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 27,
  },
  storyModalSummary: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 20,
  },
  storyModalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  storyModalPrimary: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  storyModalPrimaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  storyModalSecondary: {
    flex: 0.65,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  storyModalSecondaryText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  noticesRow: { gap: 14, paddingRight: 12, paddingBottom: 8, marginBottom: 14 },
  noticeItem: { alignItems: 'center', gap: 6, width: 72 },
  noticeCircle: {
    width: 72, height: 72, borderRadius: 36, padding: 3,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  noticeCircleUrgent: {
    backgroundColor: Colors.secondary,
  },
  noticeInner: {
    flex: 1, borderRadius: 32, backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: Colors.surface,
  },
  noticeLabel: { fontSize: 10, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  noticeLabelUrgent: { color: Colors.secondary },
  fullWidthRow: { marginBottom: 12 },
  weatherStrip: { gap: 12, paddingRight: 8 },
  weatherCard: { borderRadius: Radius.xl, padding: 18, overflow: 'hidden', width: 320, ...Shadow.md },
  weatherForecastCard: {
    borderRadius: Radius.xl,
    padding: 18,
    overflow: 'hidden',
    width: 320,
    ...Shadow.md,
  },
  weatherBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,59,90,0.35)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  weatherBadgeText: { color: 'rgba(255,255,255,0.85)', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  weatherMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  tempText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  condText: { fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  aqiBox: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: Radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'flex-end',
  },
  aqiLabel: { fontSize: 9, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', fontWeight: '700' },
  aqiNum: { fontSize: 20, color: Colors.primaryFixedDim, fontWeight: '900' },
  aqiState: { fontSize: 10, color: '#7CE2A7', fontWeight: '700' },
  weatherStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  weatherStat: { flex: 1, alignItems: 'center' },
  weatherStatLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  weatherStatVal: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 },
  forecastList: { marginTop: 2, gap: 9 },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    paddingBottom: 8,
  },
  forecastDay: {
    width: 48,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  forecastIconWrap: {
    width: 24,
    alignItems: 'center',
  },
  forecastCondition: {
    flex: 1,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '600',
  },
  forecastTemp: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  forecastEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 22,
  },
  forecastEmptyText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    fontWeight: '600',
  },
  wardCard: {
    borderRadius: Radius.xl, padding: 18,
    backgroundColor: Colors.surfaceContainerLowest, ...Shadow.sm,
  },
  wardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  wardIcon: {
    width: 44, height: 44, borderRadius: Radius.lg,
    backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center',
  },
  wardBadge: {
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
  },
  wardBadgeText: { color: Colors.onPrimaryFixedVariant, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  wardTitle: { fontSize: 17, fontWeight: '800', color: Colors.primary, lineHeight: 22, marginBottom: 8 },
  wardDesc: { fontSize: 12, color: Colors.onSurfaceVariant, lineHeight: 18, marginBottom: 14 },
  wardBtn: {
    backgroundColor: Colors.surfaceContainerHigh, borderRadius: Radius.lg,
    paddingVertical: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  wardBtnText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  heroNewsCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    minHeight: 200,
    marginBottom: 10,
    ...Shadow.sm,
  },
  heroNewsImage: { width: '100%', height: 200 },
  heroNewsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.40)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  heroTagWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  heroTag: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroLatest: {
    backgroundColor: Colors.secondary,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.md,
  },
  heroNewsTitle: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 22 },
  heroNewsSummary: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 6, lineHeight: 17 },
  newsGrid: { gap: 10, marginBottom: 14 },
  newsItemCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.lg,
    padding: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  newsThumb: { width: 58, height: 58, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerHigh },
  newsItemTitle: { fontSize: 12, fontWeight: '700', color: Colors.primary, lineHeight: 17 },
  newsItemTime: { fontSize: 10, color: Colors.onSurfaceVariant, marginTop: 4, letterSpacing: 0.5 },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  touristGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  serviceCard: {
    width: '48.5%', height: 140,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.surfaceContainer, ...Shadow.sm,
  },
  serviceLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: Colors.onSurface },
  touristServiceCard: {
    width: '48.5%',
    minHeight: 156,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 14,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadow.sm,
  },
  touristServiceCardCompact: {
    width: '48.5%',
    minHeight: 122,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadow.sm,
  },
  touristServiceIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touristServiceLabel: { fontSize: 12, fontWeight: '800', color: Colors.primary, lineHeight: 16 },
  touristServiceDesc: { fontSize: 11, color: Colors.onSurfaceVariant, lineHeight: 16 },
  touristBento: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  touristInfoCard: {
    flex: 1.2,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Shadow.sm,
  },
  touristInfoTag: { fontSize: 10, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  touristInfoTitle: { fontSize: 16, fontWeight: '900', color: Colors.primary, lineHeight: 22 },
  touristInfoDesc: { fontSize: 12, color: Colors.onSurfaceVariant, lineHeight: 18, marginTop: 8 },
  touristSupportCard: {
    flex: 0.9,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    ...Shadow.sm,
  },
  touristSupportTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary, marginTop: 10 },
  touristSupportDesc: { fontSize: 11, color: Colors.onSurfaceVariant, lineHeight: 16, marginTop: 6 },
  touristGuideCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  touristGuideTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  touristGuideDesc: { fontSize: 12, color: Colors.onSurfaceVariant, lineHeight: 17 },
  digitalCard: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: 18, marginBottom: 12,
  },
  digitalTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  digitalLabel: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 1, textTransform: 'uppercase' },
  digitalDesc: { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 18, marginBottom: 14 },
  qrBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.lg,
    paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  qrBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  statsCard: {
    backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl,
    padding: 18, borderWidth: 1, borderColor: Colors.successLight, marginBottom: 8,
  },
  statsTitle: { fontSize: 13, fontWeight: '700', color: Colors.success, marginBottom: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  statLbl: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
  fab: {
    position: 'absolute', bottom: 16, right: 16,
    backgroundColor: Colors.secondary,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: Radius.full, ...Shadow.lg,
    zIndex: 20,
    elevation: 14,
  },
  fabText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,20,18,0.35)',
    justifyContent: 'flex-start',
    paddingTop: 72,
    paddingHorizontal: 16,
  },
  menuSheet: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    ...Shadow.lg,
  },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  menuKicker: { fontSize: 10, fontWeight: '800', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 },
  menuTitle: { fontSize: 18, fontWeight: '900', color: Colors.primary, marginTop: 4 },
  menuClose: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant,
  },
  menuItemText: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.primary },
  menuLogout: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant,
  },
  menuLogoutText: { fontSize: 14, fontWeight: '800', color: Colors.secondary },
});