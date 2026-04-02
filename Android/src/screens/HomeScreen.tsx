import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, TextInput, RefreshControl, Image, ImageBackground, Modal, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
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

const DEFAULT_WEATHER: WeatherCardData = {
  temperature: 24,
  weatherCode: 1,
  isDay: true,
  humidity: 62,
  visibilityKm: 10,
  uvIndex: 2,
  aqi: 42,
};

const getWeatherCondition = (code: number) => {
  if (code === 0) return 'Clear Sky';
  if (code <= 2) return 'Mostly Sunny';
  if (code === 3) return 'Cloudy';
  if (code >= 45 && code <= 48) return 'Foggy';
  if (code >= 51 && code <= 67) return 'Rainy';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 86) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Weather Update';
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

const getUVLabel = (uvIndex: number) => {
  if (uvIndex < 3) return 'Low';
  if (uvIndex < 6) return 'Moderate';
  if (uvIndex < 8) return 'High';
  if (uvIndex < 11) return 'Very High';
  return 'Extreme';
};

const getAQIState = (aqi: number) => {
  if (aqi <= 50) return 'Excellent';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};

const SERVICES = [
  { icon: 'receipt-long', label: 'Pay Tax',    screen: 'Request' },
  { icon: 'water-drop',   label: 'Water Bill', screen: 'Request' },
  { icon: 'bolt',         label: 'NEA Pay',    screen: 'Request' },
  { icon: 'description',  label: 'Sifarish',   screen: 'Request' },
];

const TOURIST_SERVICES = [
  { icon: 'explore', label: 'Explore Pokhara', screen: 'Request', desc: 'Routes, maps, and highlights' },
  { icon: 'confirmation-number', label: 'Permits', screen: 'Request', desc: 'TIMS and entry guidance' },
  { icon: 'local-taxi', label: 'Transport', screen: 'Track', desc: 'Shuttle, taxi, and ride help' },
  { icon: 'support-agent', label: 'Help Desk', screen: 'Verify', desc: 'Emergency and visitor support' },
];

const TOURIST_MENU = [
  { icon: 'map', label: 'Explore Pokhara', screen: 'Request' },
  { icon: 'verified-user', label: 'Permit Help', screen: 'Verify' },
  { icon: 'directions-bus', label: 'Transport', screen: 'Track' },
  { icon: 'smart-toy', label: 'AI Assistant', screen: 'Assistant' },
];

const CITIZEN_MENU = [
  { icon: 'assignment', label: 'Ward Services', screen: 'Request' },
  { icon: 'qr-code', label: 'Digital Card', screen: 'Verify' },
  { icon: 'history', label: 'My Requests', screen: 'Track' },
  { icon: 'smart-toy', label: 'AI Assistant', screen: 'Assistant' },
];

const NOTICES = ['Urgent', 'Infrastructure', 'Health', 'Culture', 'Tourism'];

const STORY_NEWS = [
  {
    title: 'Ward office opens a new online token desk for faster service pickup.',
    wardLabel: 'Ward 09',
    time: 'JUST NOW',
    image:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80',
    summary: 'A story-style card can surface the latest update without feeling heavy or formal.',
  },
  {
    title: 'Pokhara set to receive cleaner bus stops and better route signage.',
    wardLabel: 'Ward 08',
    time: '2 HOURS AGO',
    image:
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80',
    summary: 'This can become a short official update, a feature story, or a service notice.',
  },
  {
    title: 'Water quality testing is now displayed ward-by-ward for residents.',
    wardLabel: 'Ward 10',
    time: '5 HOURS AGO',
    image:
      'https://images.unsplash.com/photo-1581092160607-ee22731c2b96?auto=format&fit=crop&w=900&q=80',
    summary: 'The modal can show a short explainer and a direct action button.',
  },
  {
    title: 'Digital permit queue reduced after the first mobile rollout.',
    wardLabel: 'Ward 07',
    time: '8 HOURS AGO',
    image:
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=80',
    summary: 'A lighter, rounded box layout feels closer to modern consumer apps.',
  },
  {
    title: 'Community festival stories and official notices can live in the same feed.',
    wardLabel: 'Ward 11',
    time: '1 DAY AGO',
    image:
      'https://images.unsplash.com/photo-1513279922550-3f2a4dff1d6a?auto=format&fit=crop&w=900&q=80',
    summary: 'You can keep the feed demo-based while the rest of the app stays functional.',
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
  const { citizen, tourist, isTourist, logout } = useStore();
  const [stats, setStats] = useState<any>(null);
  const [weather, setWeather] = useState<WeatherCardData>(DEFAULT_WEATHER);
  const [notices, setNotices] = useState<NoticeFeedItem[]>([]);
  const [selectedStory, setSelectedStory] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

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

  const loadNotices = async () => {
    try {
      const wardCode = citizen?.ward_code || 'NPL-04-33-09';
      const res = await citizenAPI.getNotices(wardCode);
      if (res.success) {
        setNotices(Array.isArray(res.notices) ? res.notices : []);
      }
    } catch {
      setNotices([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadWeather(), loadNotices()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadStats();
    loadWeather();
    loadNotices();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 180);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const menuItems = isTourist ? TOURIST_MENU : CITIZEN_MENU;

  const getNoticeWardLabel = (notice: NoticeFeedItem | undefined, fallbackIndex: number) => {
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
      return `Ward ${String(rawWard).padStart(2, '0')}`;
    }

    if (typeof rawWard === 'string' && rawWard.trim()) {
      const wardMatch = rawWard.match(/(\d+)/);
      if (wardMatch) {
        return `Ward ${wardMatch[1].padStart(2, '0')}`;
      }
      return rawWard.startsWith('Ward') ? rawWard : `Ward ${rawWard}`;
    }

    return STORY_NEWS[fallbackIndex % STORY_NEWS.length]?.wardLabel || 'Ward 09';
  };

  const storyCards = useMemo(() => {
    const source = notices.length ? notices : [];

    if (!source.length) {
      return STORY_NEWS;
    }

    return source.slice(0, 5).map((notice, index) => ({
      title: notice.title || notice.title_ne || 'Notice',
      wardLabel: getNoticeWardLabel(notice, index),
      time: notice.published_at ? new Date(notice.published_at).toLocaleString([], { month: 'short', day: 'numeric' }) : index === 0 ? 'JUST NOW' : `${index + 1} HRS AGO`,
      image: STORY_NEWS[index % STORY_NEWS.length].image,
      summary: notice.content || 'Open the notice board for more detail.',
    }));
  }, [notices]);

  const searchableItems = useMemo<SearchResult[]>(() => {
    if (isTourist) {
      const serviceItems = TOURIST_SERVICES.map((item) => ({
        id: `tourist-service-${item.label}`,
        title: item.label,
        subtitle: item.desc,
        icon: item.icon,
        screen: item.screen,
        keywords: [item.label, item.desc, 'tourist', 'service', 'pokhara'],
      }));

      const menuSearchItems = TOURIST_MENU.map((item) => ({
        id: `tourist-menu-${item.label}`,
        title: item.label,
        subtitle: 'Quick menu action',
        icon: item.icon,
        screen: item.screen,
        keywords: [item.label, 'menu', 'tourist'],
      }));

      return [...serviceItems, ...menuSearchItems];
    }

    const serviceItems = SERVICES.map((item) => ({
      id: `citizen-service-${item.label}`,
      title: item.label,
      subtitle: 'E-Sewa service',
      icon: item.icon,
      screen: item.screen,
      keywords: [item.label, 'service', 'citizen', 'esewa'],
    }));

    const menuSearchItems = CITIZEN_MENU.map((item) => ({
      id: `citizen-menu-${item.label}`,
      title: item.label,
      subtitle: 'Citizen menu action',
      icon: item.icon,
      screen: item.screen,
      keywords: [item.label, 'menu', 'citizen', 'ward'],
    }));

    const noticeSource = notices.length
      ? notices
      : [
          { notice_id: 'fallback-urgent', title: 'Water Supply Interruption', title_ne: 'पानी आपूर्ति बन्द', category: 'URGENT', content: 'Water supply interrupted 8AM-4PM on 2082/06/15.', is_urgent: true },
          { notice_id: 'fallback-infra', title: 'Road Widening Project', title_ne: 'सडक चौडाइ', category: 'INFRASTRUCTURE', content: 'Prithvi Chowk road widening begins next week.', is_urgent: false },
          { notice_id: 'fallback-health', title: 'Free Health Camp', title_ne: 'स्वास्थ्य शिविर', category: 'HEALTH', content: 'Free checkup at Ward 9 hall on 2082/06/20.', is_urgent: false },
        ];

    const noticeItems = noticeSource.map((item) => ({
      id: item.notice_id || item.title || 'notice',
      title: item.title || item.title_ne || 'Notice',
      subtitle: item.content || 'Municipal notice',
      icon: item.is_urgent ? 'campaign' : item.category === 'HEALTH' ? 'local-hospital' : item.category === 'INFRASTRUCTURE' ? 'construction' : 'newspaper',
      screen: 'CitizenPortal',
      keywords: [item.title || '', item.title_ne || '', item.category || '', item.content || '', 'notice', 'news', 'ward'],
    }));

    return [...serviceItems, ...menuSearchItems, ...noticeItems];
  }, [isTourist, notices]);

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
                <Text style={styles.touristBadgeText}>Tourist Mode</Text>
              </View>
              <Text style={styles.touristTitle}>Welcome, {tourist?.name || 'Traveler'}</Text>
              <Text style={styles.touristDesc}>
                Quick access to permits, transport, help, and the best places around Pokhara.
              </Text>
              <View style={styles.touristMetaRow}>
                <View style={styles.touristMetaPill}><Text style={styles.touristMetaText}>{today}</Text></View>
                <View style={styles.touristMetaPill}><Text style={styles.touristMetaText}>{tourist?.nationality || 'International visitor'}</Text></View>
              </View>
            </LinearGradient>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Visitor Hub <Text style={styles.sectionSub}>/ Quick actions</Text></Text>
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
                  <Text style={styles.touristServiceLabel}>{service.label}</Text>
                  <Text style={styles.touristServiceDesc}>{service.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.touristBento}>
              <View style={styles.touristInfoCard}>
                <Text style={styles.touristInfoTag}>Travel helper</Text>
                <Text style={styles.touristInfoTitle}>Need a route, a guide, or a permit?</Text>
                <Text style={styles.touristInfoDesc}>
                  Use the hamburger menu for visitor-only shortcuts and local support.
                </Text>
              </View>
              <View style={styles.touristSupportCard}>
                <MaterialIcons name="sos" size={26} color={Colors.secondary} />
                <Text style={styles.touristSupportTitle}>Emergency</Text>
                <Text style={styles.touristSupportDesc}>Instant access to help, police, and local contacts.</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Welcome */}
            <View style={styles.welcome}>
              <Text style={styles.dateText}>{today}</Text>
              <Text style={styles.greetText}>Namaste, Pokhara</Text>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
              <MaterialIcons name="search" size={22} color={Colors.primary} style={{ opacity: 0.6 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="What do you need today?"
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
                    <Text style={styles.searchEmptyText}>No matching services found</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {!isTourist && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Stories <Text style={styles.sectionSub}>/ Quick updates</Text></Text>
              <TouchableOpacity onPress={() => setSelectedStory(storyCards[0])}>
                <Text style={styles.viewAll}>Open</Text>
              </TouchableOpacity>
            </View>
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
          </>
        )}

        {!isTourist && (
          <>
            {/* Weather */}
            <View style={styles.fullWidthRow}>
              {/* Weather */}
              <View style={styles.weatherCard}>
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryContainer]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
                <View style={styles.weatherBadge}>
                  <Text style={styles.weatherBadgeText}>Atmosphere Today</Text>
                </View>
                <View style={styles.weatherMain}>
                  <MaterialIcons name={getWeatherIcon(weather.weatherCode, weather.isDay) as any} size={44} color="#fff" />
                  <View>
                    <Text style={styles.tempText}>{Math.round(weather.temperature)}°C</Text>
                    <Text style={styles.condText}>{getWeatherCondition(weather.weatherCode)} · Pokhara-6</Text>
                  </View>
                  <View style={styles.aqiBox}>
                    <Text style={styles.aqiLabel}>AQI Index</Text>
                    <Text style={styles.aqiNum}>{Math.round(weather.aqi)}</Text>
                    <Text style={styles.aqiState}>{getAQIState(weather.aqi)}</Text>
                  </View>
                </View>
                <View style={styles.weatherStats}>
                  <View style={styles.weatherStat}>
                    <Text style={styles.weatherStatLabel}>Humidity</Text>
                    <Text style={styles.weatherStatVal}>{Math.round(weather.humidity)}%</Text>
                  </View>
                  <View style={styles.weatherStat}>
                    <Text style={styles.weatherStatLabel}>UV Index</Text>
                    <Text style={styles.weatherStatVal}>{getUVLabel(weather.uvIndex)}</Text>
                  </View>
                  <View style={styles.weatherStat}>
                    <Text style={styles.weatherStatLabel}>Visibility</Text>
                    <Text style={styles.weatherStatVal}>{weather.visibilityKm}km</Text>
                  </View>
                </View>
              </View>

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
                <Text style={styles.wardTitle}>Ward Presence</Text>
                <Text style={styles.wardDesc}>Your local representatives are active. Check ward progress.</Text>
                <TouchableOpacity style={styles.wardBtn}>
                  <Text style={styles.wardBtnText}>Open Ward Map</Text>
                  <MaterialIcons name="arrow-forward" size={14} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Notices / News */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isTourist ? 'Travel Stories' : 'Suchana'} <Text style={styles.sectionSub}>/ Notices & News</Text></Text>
          <TouchableOpacity onPress={() => navigation.navigate('CitizenPortal')}>
            <Text style={styles.viewAll}>{isTourist ? 'Visitor Guide' : 'View All'}</Text>
          </TouchableOpacity>
        </View>

        {(() => {
          const fallbackNotices = [
            { notice_id: 'fallback-urgent', title: 'Water Supply Interruption', title_ne: 'पानी आपूर्ति बन्द', category: 'URGENT', content: 'Water supply interrupted 8AM-4PM on 2082/06/15.', is_urgent: true },
            { notice_id: 'fallback-infra', title: 'Road Widening Project', title_ne: 'सडक चौडाइ', category: 'INFRASTRUCTURE', content: 'Prithvi Chowk road widening begins next week.', is_urgent: false },
            { notice_id: 'fallback-health', title: 'Free Health Camp', title_ne: 'स्वास्थ्य शिविर', category: 'HEALTH', content: 'Free checkup at Ward 9 hall on 2082/06/20.', is_urgent: false },
            { notice_id: 'fallback-culture', title: 'Lakhe Festival', title_ne: 'लाखे जात्रा', category: 'CULTURE', content: 'Community festival this weekend around Lakeside.', is_urgent: false },
          ];

          const feed = (notices.length ? notices : fallbackNotices).slice(0, 5);
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
                    <Text style={styles.heroTag}>{urgentItem?.category || 'NOTICE'}</Text>
                    <Text style={styles.heroLatest}>{urgentItem?.is_urgent ? 'URGENT' : 'LATEST'}</Text>
                  </View>
                  <Text style={styles.heroNewsTitle}>{urgentItem ? (urgentItem.title || urgentItem.title_ne || 'Notice') : 'Latest Notice'}</Text>
                  <Text style={styles.heroNewsSummary}>{urgentItem?.content || 'Open the notices board to see the latest official updates.'}</Text>
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
                      <Text numberOfLines={2} style={styles.newsItemTitle}>{item.title || item.title_ne || 'Notice'}</Text>
                      <Text numberOfLines={2} style={styles.newsItemTime}>{item.content || 'Official update'}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          );
        })()}

        {/* E-Sewa Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isTourist ? 'Visitor Services' : 'E-Sewa'} <Text style={styles.sectionSub}>/ Direct</Text></Text>
        </View>
        <View style={isTourist ? styles.touristGrid : styles.servicesGrid}>
          {(isTourist ? TOURIST_SERVICES : SERVICES).map((s: any) => (
            <TouchableOpacity
              key={s.label}
              style={isTourist ? styles.touristServiceCardCompact : styles.serviceCard}
              onPress={() => navigation.navigate(s.screen)}
              activeOpacity={0.8}
            >
              <MaterialIcons name={s.icon as any} size={28} color={Colors.primary} />
              <Text style={styles.serviceLabel}>{s.label}</Text>
              {isTourist && <Text style={styles.touristServiceDesc}>{s.desc}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Digital Citizen Card */}
        {!isTourist ? (
          <View style={styles.digitalCard}>
            <View style={styles.digitalTop}>
              <MaterialIcons name="verified" size={20} color={Colors.goldLight} />
              <Text style={styles.digitalLabel}>Digital Citizen Card</Text>
            </View>
            <Text style={styles.digitalDesc}>
              Your virtual identity card for quick verification at ward offices.
            </Text>
            <TouchableOpacity
              style={styles.qrBtn}
              onPress={() => navigation.navigate('Verify')}
            >
              <MaterialIcons name="qr-code" size={16} color="#fff" />
              <Text style={styles.qrBtnText}>Show QR Code</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.touristGuideCard}>
            <MaterialIcons name="travel-explore" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.touristGuideTitle}>Stay connected while exploring.</Text>
              <Text style={styles.touristGuideDesc}>
                Use the menu for permits, routes, and local support anytime.
              </Text>
            </View>
          </View>
        )}

        {/* PRATIBIMBA Stats */}
        {!isTourist && stats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>🔒 PRATIBIMBA Live</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.total_documents?.toLocaleString() || '—'}</Text>
                <Text style={styles.statLbl}>Documents</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.issued_today || '—'}</Text>
                <Text style={styles.statLbl}>Today</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: Colors.success }]}>
                  {stats.tampered_alerts === 0 ? '✓' : '⚠'}
                </Text>
                <Text style={styles.statLbl}>Integrity</Text>
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
        <TouchableOpacity style={styles.storyModalBackdrop} activeOpacity={1} onPress={() => setSelectedStory(null)}>
          <TouchableOpacity style={styles.storyModalCard} activeOpacity={1} onPress={() => {}}>
            <ImageBackground source={{ uri: selectedStory?.image }} style={styles.storyModalImage} imageStyle={styles.storyModalImageClip}>
              <LinearGradient colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.82)']} style={StyleSheet.absoluteFill} />
              <View style={styles.storyModalContent}>
                  <View style={styles.storyModalHeader}>
                    <Text style={styles.storyModalTag}>{selectedStory?.wardLabel || 'Ward 09'}</Text>
                  <TouchableOpacity style={styles.storyModalClose} onPress={() => setSelectedStory(null)}>
                    <MaterialIcons name="close" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.storyModalTitle}>{selectedStory?.title}</Text>
                <Text style={styles.storyModalSummary}>{selectedStory?.summary}</Text>
                <View style={styles.storyModalActions}>
                  <TouchableOpacity style={styles.storyModalPrimary} onPress={() => { setSelectedStory(null); navigation.navigate('CitizenPortal'); }}>
                    <Text style={styles.storyModalPrimaryText}>Open notice board</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.storyModalSecondary} onPress={() => setSelectedStory(null)}>
                    <Text style={styles.storyModalSecondaryText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuKicker}>{isTourist ? 'Tourist menu' : 'Citizen menu'}</Text>
                <Text style={styles.menuTitle}>{isTourist ? tourist?.name || 'Traveler' : citizen?.name || 'Resident'}</Text>
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
                <Text style={styles.menuItemText}>{item.label}</Text>
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
              <Text style={styles.menuLogoutText}>Logout</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Emergency FAB */}
      <TouchableOpacity style={styles.fab}>
        <MaterialIcons name="sos" size={22} color="#fff" />
        <Text style={styles.fabText}>Emergency</Text>
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
    backgroundColor: 'rgba(12, 20, 18, 0.52)',
    padding: 20,
    justifyContent: 'center',
  },
  storyModalCard: {
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    ...Shadow.lg,
  },
  storyModalImage: {
    minHeight: 340,
    justifyContent: 'flex-end',
  },
  storyModalImageClip: {
    borderRadius: 40,
  },
  storyModalContent: {
    padding: 18,
    gap: 10,
  },
  storyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storyModalTag: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  storyModalClose: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyModalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  storyModalSummary: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
  },
  storyModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  storyModalPrimary: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: 'center',
  },
  storyModalPrimaryText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  storyModalSecondary: {
    flex: 0.8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  storyModalSecondaryText: {
    color: '#fff',
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
  weatherCard: { borderRadius: Radius.xl, padding: 18, overflow: 'hidden', ...Shadow.md },
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
    position: 'absolute', bottom: 104, right: 18,
    backgroundColor: Colors.secondary,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: Radius.full, ...Shadow.lg,
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