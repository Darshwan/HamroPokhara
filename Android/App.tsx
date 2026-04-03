import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { Linking, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import SplashScreen    from './src/screens/SplashScreen';
import LanguageScreen  from './src/screens/LanguageScreen';
import ContinueAsScreen from './src/screens/ContinueAsScreen';
import LoginScreen     from './src/screens/LoginScreen';
import HomeScreen      from './src/screens/HomeScreen';
import TrackScreen     from './src/screens/TrackScreen';
import VerifyScreen    from './src/screens/VerifyScreen';
import ProfileScreen   from './src/screens/ProfileScreen';
import GovernmentAssistantScreen from './src/screens/GovernmentAssistantScreen';
import FeaturesScreen from './src/screens/FeaturesScreen';
import SifarisScreen from './src/screens/SifarisScreen';
import WardMapScreen from './src/screens/WardMapScreen';
import WardDetailScreen from './src/screens/WardDetailScreen';

import { Colors } from './src/constants/theme';
import { useStore } from './src/store/useStore';
import AppHeader from './src/components/AppHeader';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

const TAB_ORDER = ['Home', 'Services', 'AiAssistant', 'Profile'] as const;
type TabRouteName = (typeof TAB_ORDER)[number];

type ServiceLink = {
  id: string;
  icon: string;
  title: string;
  titleNE: string;
  subtitle: string;
  subtitleNE: string;
  route: string;
  params?: Record<string, unknown>;
};

type DepartmentService = {
  id: string;
  icon: string;
  title: string;
  titleNE: string;
  subtitle: string;
  subtitleNE: string;
  headName: string;
  headRole: string;
  contact: string;
  portalUrl: string;
};

type SwipeableTabScreenProps = {
  navigation: any;
  route: { name: string };
  children: React.ReactNode;
};

function SwipeableTabScreen({ navigation, route, children }: SwipeableTabScreenProps) {
  return <View style={{ flex: 1 }}>{children}</View>;
}

const CORE_SERVICES: ServiceLink[] = [
  {
    id: 'request',
    icon: 'description',
    title: 'Sifaris',
    titleNE: 'सिफारिस',
    subtitle: 'Apply for municipal documents',
    subtitleNE: 'नगरपालिकाका कागजातको लागि आवेदन दिनुहोस्',
    route: 'Request',
  },
  {
    id: 'track',
    icon: 'history',
    title: 'Track Request',
    titleNE: 'अनुरोध ट्र्याक',
    subtitle: 'Check current request status',
    subtitleNE: 'हालको अनुरोधको स्थिति हेर्नुहोस्',
    route: 'Track',
  },
];

const DEPARTMENT_SERVICES: ServiceLink[] = [
  {
    id: 'administration',
    icon: 'account-balance',
    title: 'Administration',
    titleNE: 'प्रशासन',
    subtitle: 'Office and governance support',
    subtitleNE: 'कार्यालय र सुशासन सहयोग',
    route: 'Features',
    params: { openFeature: 'feedback', serviceCategory: 'administration' },
  },
  {
    id: 'agriculture',
    icon: 'yard',
    title: 'Agriculture',
    titleNE: 'कृषि',
    subtitle: 'Farmer and crop related services',
    subtitleNE: 'किसान र बालीसम्बन्धी सेवाहरू',
    route: 'Features',
    params: { openFeature: 'krishi', serviceCategory: 'agriculture' },
  },
  {
    id: 'infrastructure',
    icon: 'construction',
    title: 'Infrastructure',
    titleNE: 'पूर्वाधार',
    subtitle: 'Road and public infrastructure requests',
    subtitleNE: 'सडक र सार्वजनिक पूर्वाधार अनुरोध',
    route: 'Features',
    params: { openFeature: 'grievance', serviceCategory: 'infrastructure' },
  },
  {
    id: 'environment',
    icon: 'eco',
    title: 'Environment',
    titleNE: 'वातावरण',
    subtitle: 'Clean city and environment matters',
    subtitleNE: 'सफा सहर र वातावरणका विषयहरू',
    route: 'Features',
    params: { openFeature: 'grievance', serviceCategory: 'environment' },
  },
  {
    id: 'business-center',
    icon: 'storefront',
    title: 'Business Promotion Center',
    titleNE: 'व्यवसाय प्रवर्धन केन्द्र',
    subtitle: 'Business registration and promotion',
    subtitleNE: 'व्यवसाय दर्ता र प्रवर्धन सेवा',
    route: 'Features',
    params: { openFeature: 'tax', serviceCategory: 'business-promotion-center' },
  },
  {
    id: 'projects',
    icon: 'engineering',
    title: 'Projects',
    titleNE: 'आयोजना',
    subtitle: 'Municipal project information',
    subtitleNE: 'नगर आयोजनासम्बन्धी जानकारी',
    route: 'Features',
    params: { openFeature: 'grievance', serviceCategory: 'projects' },
  },
  {
    id: 'tourism',
    icon: 'travel-explore',
    title: 'Tourism',
    titleNE: 'पर्यटन',
    subtitle: 'Tourism and visitor support',
    subtitleNE: 'पर्यटन र आगन्तुक सहायता',
    route: 'Features',
    params: { openFeature: 'tourism', serviceCategory: 'tourism' },
  },
  {
    id: 'education',
    icon: 'school',
    title: 'Education',
    titleNE: 'शिक्षा',
    subtitle: 'Education related recommendations',
    subtitleNE: 'शिक्षासम्बन्धी सिफारिस सेवा',
    route: 'Features',
    params: { openFeature: 'hearing', serviceCategory: 'education' },
  },
  {
    id: 'judicial-committee',
    icon: 'gavel',
    title: 'Local Judicial Committee',
    titleNE: 'स्थानीय न्याय समिति',
    subtitle: 'Local dispute support requests',
    subtitleNE: 'स्थानीय विवाद समाधान सहयोग',
    route: 'Features',
    params: { openFeature: 'hearing', serviceCategory: 'local-judicial-committee' },
  },
  {
    id: 'social-culture',
    icon: 'celebration',
    title: 'Social Culture',
    titleNE: 'सामाजिक संस्कृति',
    subtitle: 'Community and culture programs',
    subtitleNE: 'समुदाय र संस्कृति कार्यक्रम',
    route: 'Features',
    params: { openFeature: 'volunteer', serviceCategory: 'social-culture' },
  },
];

function ServicesScreen({ navigation }: any) {
  const { language } = useStore();
  const [mode, setMode] = useState<'services' | 'tools'>('services');
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentService | null>(null);
  const lang = language;
  const defaultPortalUrl = 'https://pokharamun.gov.np';

  const openService = (item: ServiceLink) => {
    navigation.navigate({
      name: item.route,
      params: item.params || {},
    });
  };

  const departmentDetails: DepartmentService[] = [
    {
      id: 'administration',
      icon: 'account-balance',
      title: 'Administration',
      titleNE: 'प्रशासन',
      subtitle: 'Office and governance support',
      subtitleNE: 'कार्यालय र सुशासन सहयोग',
      headName: 'Jayaram Poudel',
      headRole: 'Mahashakha Chief (Finance)',
      contact: 'Email: (not listed)\nTel: 9856007112, 9856031318',
      portalUrl: defaultPortalUrl,
    },
    {
      id: 'agriculture',
      icon: 'yard',
      title: 'Agriculture',
      titleNE: 'कृषि',
      subtitle: 'Farmer and crop related services',
      subtitleNE: 'किसान र बालीसम्बन्धी सेवाहरू',
      headName: 'Dr. Ashesh Raj B.K.',
      headRole: 'Branch Chief (Animal Dev.)',
      contact: 'Email: veterinarian.pokharamun@gmail.com\nTel: 9865382321',
      portalUrl: 'https://www.pokharakrishi.com/',
    },
    {
      id: 'infrastructure',
      icon: 'construction',
      title: 'Infrastructure',
      titleNE: 'पूर्वाधार',
      subtitle: 'Road and public infrastructure requests',
      subtitleNE: 'सडक र सार्वजनिक पूर्वाधार अनुरोध',
      headName: 'E. Surendra Pande',
      headRole: 'Mahashakha Chief (Infra.)',
      contact: 'Tel: 9856035904',
      portalUrl: defaultPortalUrl,
    },
    {
      id: 'environment',
      icon: 'eco',
      title: 'Environment',
      titleNE: 'वातावरण',
      subtitle: 'Clean city and environment matters',
      subtitleNE: 'सफा सहर र वातावरणका विषयहरू',
      headName: 'E. Bimal Ranjan Karki',
      headRole: 'Mahashakha Chief (Urban/Tourism/Env.)',
      contact: 'Email: pokharamunurbandevelopment@gmail.com\nTel: 061-591288',
      portalUrl: defaultPortalUrl,
    },
    {
      id: 'business-center',
      icon: 'storefront',
      title: 'Business Promotion Center',
      titleNE: 'व्यवसाय प्रवर्धन केन्द्र',
      subtitle: 'Business registration and promotion',
      subtitleNE: 'व्यवसाय दर्ता र प्रवर्धन सेवा',
      headName: 'Manhar Kadariya',
      headRole: 'Mahashakha Chief (Econ. Dev.)',
      contact: 'Email: agriculture.pokharamun@gmail.com\nTel: 9856053320',
      portalUrl: defaultPortalUrl,
    },
    {
      id: 'projects',
      icon: 'engineering',
      title: 'Projects',
      titleNE: 'आयोजना',
      subtitle: 'Municipal project information',
      subtitleNE: 'नगर आयोजनासम्बन्धी जानकारी',
      headName: 'E. Surendra Pande',
      headRole: 'Mahashakha Chief (Infra.)',
      contact: 'Tel: 9856035904',
      portalUrl: defaultPortalUrl,
    },
    {
      id: 'tourism',
      icon: 'travel-explore',
      title: 'Tourism',
      titleNE: 'पर्यटन',
      subtitle: 'Tourism and visitor support',
      subtitleNE: 'पर्यटन र आगन्तुक सहायता',
      headName: 'Kripa Ranjit',
      headRole: 'Branch Chief, Tourism',
      contact: 'Tel: 9846380032',
      portalUrl: defaultPortalUrl,
    },
    {
      id: 'education',
      icon: 'school',
      title: 'Education',
      titleNE: 'शिक्षा',
      subtitle: 'Education related recommendations',
      subtitleNE: 'शिक्षासम्बन्धी सिफारिस सेवा',
      headName: 'Hem Prasad Acharya',
      headRole: 'Mahashakha Chief (Sec. Ed.)',
      contact: 'Email: metroedupkr@gmail.com\nTel: 9846219433',
      portalUrl: defaultPortalUrl,
    },
    {
      id: 'judicial-committee',
      icon: 'gavel',
      title: 'Local Judicial Committee',
      titleNE: 'स्थानीय न्याय समिति',
      subtitle: 'Local dispute support requests',
      subtitleNE: 'स्थानीय विवाद समाधान सहयोग',
      headName: 'Not specified on site',
      headRole: 'Not specified on site',
      contact: 'Not specified on site',
      portalUrl: defaultPortalUrl,
    },
    {
      id: 'social-culture',
      icon: 'celebration',
      title: 'Social Culture',
      titleNE: 'सामाजिक संस्कृति',
      subtitle: 'Community and culture programs',
      subtitleNE: 'समुदाय र संस्कृति कार्यक्रम',
      headName: 'Nirmala Sharma',
      headRole: 'Mahashakha Chief (Social Dev.)',
      contact: 'Email: pokharamunsamajikabikash@gmail.com\nTel: 9856067367',
      portalUrl: defaultPortalUrl,
    },
  ];

  const openDepartmentPortal = async () => {
    const url = selectedDepartment?.portalUrl;
    if (!url) return;

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Toast.show({
        type: 'error',
        text1: lang === 'ne' ? 'पोर्टल खोल्न मिलेन' : 'Unable to open portal',
        text2: url,
      });
      return;
    }

    await Linking.openURL(url);
  };

  const openDepartmentService = (item: ServiceLink) => {
    const selected = departmentDetails.find((department) => department.id === item.id);
    if (selected) {
      setMode('services');
      setSelectedDepartment(selected);
    }
  };

  const openToolsTab = () => {
    setSelectedDepartment(null);
    setMode('tools');
  };

  return (
    <SafeAreaView style={servicesStyles.container}>
      <AppHeader title={lang === 'ne' ? 'सेवाहरू' : 'Services'} showMenu={false} showLang />
      <View style={servicesStyles.header}>
        <Text style={servicesStyles.subtitle}>
          {lang === 'ne'
            ? 'साधारण, छिटो, र स्पष्ट पहुँचका लागि मुख्य सेवा र उपकरणहरू'
            : 'Simple access to the core municipal services and tools you use most.'}
        </Text>
      </View>

      <View style={servicesStyles.segmentRow}>
        <TouchableOpacity
          style={[servicesStyles.segment, mode === 'services' && servicesStyles.segmentActive]}
          onPress={() => setMode('services')}
          activeOpacity={0.9}
        >
          <Text style={[servicesStyles.segmentText, mode === 'services' && servicesStyles.segmentTextActive]}>
            {lang === 'ne' ? 'मुख्य सेवा' : 'Core services'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[servicesStyles.segment, mode === 'tools' && servicesStyles.segmentActive]}
          onPress={openToolsTab}
          activeOpacity={0.9}
        >
          <Text style={[servicesStyles.segmentText, mode === 'tools' && servicesStyles.segmentTextActive]}>
            {lang === 'ne' ? 'उपकरण' : 'Tools'}
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'services' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={servicesStyles.content}>
          <View style={servicesStyles.section}>
            <Text style={servicesStyles.sectionTitle}>{lang === 'ne' ? 'मुख्य सेवाहरू' : 'Core services'}</Text>
            <View style={servicesStyles.serviceGrid}>
              {CORE_SERVICES.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={servicesStyles.serviceCard}
                  onPress={() => openService(item)}
                  activeOpacity={0.9}
                >
                  <View style={servicesStyles.serviceIconWrap}>
                    <View style={servicesStyles.serviceIcon}>
                      <MaterialIcons name={item.icon as any} size={22} color={Colors.primary} />
                    </View>
                  </View>
                  <View style={servicesStyles.serviceBody}>
                    <Text style={servicesStyles.serviceTitle}>{lang === 'ne' ? item.titleNE : item.title}</Text>
                    <Text style={servicesStyles.serviceSubtitle}>{lang === 'ne' ? item.subtitleNE : item.subtitle}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={servicesStyles.section}>
            <Text style={servicesStyles.sectionTitle}>{lang === 'ne' ? 'विभागीय सेवाहरू' : 'Department services'}</Text>
            <Text style={servicesStyles.sectionHint}>
              {lang === 'ne'
                ? 'डेमो मोडमा यी विकल्पहरूले सम्बन्धित उपकरण/सेवा डेमो खोल्छन्।'
                : 'In demo mode, each option opens its related service/tool demo.'}
            </Text>
            <View style={servicesStyles.departmentGrid}>
              {DEPARTMENT_SERVICES.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={servicesStyles.departmentCard}
                  onPress={() => openDepartmentService(item)}
                  activeOpacity={0.9}
                >
                  <View style={servicesStyles.departmentIcon}>
                    <MaterialIcons name={item.icon as any} size={20} color={Colors.primary} />
                  </View>
                  <Text style={servicesStyles.departmentTitle} numberOfLines={2}>{lang === 'ne' ? item.titleNE : item.title}</Text>
                  <Text style={servicesStyles.departmentSubtitle} numberOfLines={2}>{lang === 'ne' ? item.subtitleNE : item.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        <FeaturesScreen
          navigation={navigation}
          embedded
          route={{ params: { openFeature: null, openFeatureToken: 0, serviceCategory: null } }}
        />
      )}

      <Modal visible={!!selectedDepartment} transparent animationType="fade" onRequestClose={() => setSelectedDepartment(null)}>
        <TouchableOpacity style={servicesStyles.dialogBackdrop} activeOpacity={1} onPress={() => setSelectedDepartment(null)}>
          <TouchableOpacity style={servicesStyles.dialogCard} activeOpacity={1} onPress={() => {}}>
            <View style={servicesStyles.dialogIconWrap}>
              <MaterialIcons name={(selectedDepartment?.icon || 'business') as any} size={24} color={Colors.primary} />
            </View>
            <Text style={servicesStyles.dialogTitle}>{selectedDepartment?.title ?? ''}</Text>
            <Text style={servicesStyles.dialogSubtitle}>{selectedDepartment?.subtitle ?? ''}</Text>

            <View style={servicesStyles.dialogInfoBlock}>
              <Text style={servicesStyles.dialogLabel}>{lang === 'ne' ? 'विभागीय प्रमुख (Pramukh)' : 'Department Head (Pramukh)'}</Text>
              <Text style={servicesStyles.dialogValue}>{selectedDepartment?.headName ?? ''}</Text>
              <Text style={servicesStyles.dialogMeta}>{selectedDepartment?.headRole ?? ''}</Text>
            </View>

            <View style={servicesStyles.dialogInfoBlock}>
              <Text style={servicesStyles.dialogLabel}>{lang === 'ne' ? 'सम्पर्क' : 'Contact'}</Text>
              <Text style={servicesStyles.dialogContact}>{selectedDepartment?.contact ?? ''}</Text>
            </View>

            <View style={servicesStyles.dialogInfoBlock}>
              <Text style={servicesStyles.dialogLabel}>{lang === 'ne' ? 'पोर्टल' : 'Portal'}</Text>
              <Text style={servicesStyles.dialogContact}>{selectedDepartment?.portalUrl ?? ''}</Text>
            </View>

            <Text style={servicesStyles.dialogHint}>
              {lang === 'ne'
                ? 'समस्या वा सहयोगका लागि माथिको सम्पर्क प्रयोग गर्नुहोस्।'
                : 'Use the contact above to complain or ask for help.'}
            </Text>

            <TouchableOpacity style={servicesStyles.dialogPortalBtn} onPress={openDepartmentPortal}>
              <Text style={servicesStyles.dialogPortalText}>{lang === 'ne' ? 'पोर्टल खोल्नुहोस्' : 'Open Portal'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={servicesStyles.dialogCloseBtn} onPress={() => setSelectedDepartment(null)}>
              <Text style={servicesStyles.dialogCloseText}>{lang === 'ne' ? 'बन्द' : 'Close'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Bottom Tab Navigator (shown after login) ──────────────────
function MainTabs() {
  const { language } = useStore();
  const isNepali = language === 'ne';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          ...styles.tabBar,
        },
        tabBarItemStyle: styles.tabItem,
        tabBarIconStyle: styles.tabIcon,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.outline,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveBackgroundColor: 'rgba(0,59,90,0.08)',
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarLabel: isNepali ? 'गृह' : 'Home',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name={focused ? 'home' : 'home-filled'}
              size={24} color={color}
            />
          ),
        }}
      >
        {(props) => (
          <SwipeableTabScreen navigation={props.navigation} route={props.route}>
            <HomeScreen {...props} />
          </SwipeableTabScreen>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Services"
        options={{
          tabBarLabel: isNepali ? 'सेवा' : 'Services',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="apps" size={22} color={color} />
          ),
        }}
      >
        {(props) => (
          <SwipeableTabScreen navigation={props.navigation} route={props.route}>
            <ServicesScreen {...props} />
          </SwipeableTabScreen>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="AiAssistant"
        options={{
          tabBarLabel: isNepali ? 'एआई सहायक' : 'AI Assistant',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'smart-toy' : 'smart-toy'} size={22} color={color} />
          ),
        }}
      >
        {(props) => (
          <SwipeableTabScreen navigation={props.navigation} route={props.route}>
            <GovernmentAssistantScreen {...props} />
          </SwipeableTabScreen>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: isNepali ? 'प्रोफाइल' : 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      >
        {(props) => (
          <SwipeableTabScreen navigation={props.navigation} route={props.route}>
            <ProfileScreen {...props} />
          </SwipeableTabScreen>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 66,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e6e9e8',
    paddingTop: 6,
    paddingBottom: 8,
    shadowColor: '#003b5a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 6,
  },
  tabItem: {
    borderRadius: 12,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  tabIcon: {
    marginTop: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginBottom: 2,
  },
});

const servicesStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.outline,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: Colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 4,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceContainerLow,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 9999,
  },
  segmentActive: {
    backgroundColor: Colors.surfaceContainerLowest,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.outline,
  },
  segmentTextActive: {
    color: Colors.primary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  sectionHint: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: -4,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  serviceCard: {
    width: '48%',
    minHeight: 158,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 14,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHigh,
    shadowColor: '#003b5a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceIconWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceBody: {
    gap: 6,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  serviceSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
  departmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  departmentCard: {
    width: '48%',
    minHeight: 146,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 10,
  },
  departmentIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  departmentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
    lineHeight: 18,
  },
  departmentSubtitle: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    lineHeight: 16,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 10,
  },
  dialogIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  dialogSubtitle: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
  dialogInfoBlock: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
    gap: 4,
  },
  dialogLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dialogValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  dialogMeta: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 17,
  },
  dialogContact: {
    fontSize: 13,
    color: Colors.onSurface,
    lineHeight: 19,
  },
  dialogHint: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
    marginTop: 4,
  },
  dialogPortalBtn: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  dialogPortalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  dialogCloseBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.primaryFixed,
  },
  dialogCloseText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolCard: {
    width: '48.5%',
    minHeight: 112,
    borderRadius: 24,
    padding: 14,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#003b5a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  toolIcon: {
    width: 38,
    height: 38,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
});

export default function App() {
  const { isLoggedIn, isGuest, isTourist, loadFromStorage } = useStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!(isLoggedIn || isGuest || isTourist) ? (
              // ── Onboarding Flow ───────────────────────────────
              <>
                <Stack.Screen name="Splash"      component={SplashScreen} />
                <Stack.Screen name="Language"    component={LanguageScreen} />
                <Stack.Screen name="ContinueAs"  component={ContinueAsScreen} />
                <Stack.Screen name="Login"       component={LoginScreen} />
              </>
            ) : (
              // ── Main App ──────────────────────────────────────
              <>
                <Stack.Screen name="Main" component={MainTabs} />
                <Stack.Screen name="Request" component={SifarisScreen} />
                <Stack.Screen name="Track" component={TrackScreen} />
                <Stack.Screen name="Verify" component={VerifyScreen} />
                <Stack.Screen name="Assistant" component={GovernmentAssistantScreen} />
                <Stack.Screen name="Features" component={FeaturesScreen} />
                <Stack.Screen name="WardMap" component={WardMapScreen} />
                <Stack.Screen name="WardDetail" component={WardDetailScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}