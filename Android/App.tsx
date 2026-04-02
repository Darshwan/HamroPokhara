import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import SplashScreen    from './src/screens/SplashScreen';
import LanguageScreen  from './src/screens/LanguageScreen';
import ContinueAsScreen from './src/screens/ContinueAsScreen';
import LoginScreen     from './src/screens/LoginScreen';
import HomeScreen      from './src/screens/HomeScreen';
import TrackScreen     from './src/screens/TrackScreen';
import VerifyScreen    from './src/screens/VerifyScreen';
import ProfileScreen   from './src/screens/ProfileScreen';
import CitizenPortalScreen from './src/screens/CitizenPortalScreen';
import GovernmentAssistantScreen from './src/screens/GovernmentAssistantScreen';
import FeaturesScreen from './src/screens/FeaturesScreen';
import SifarisRequestScreen from './src/screens/SifarisRequestScreen';
import WardMapScreen from './src/screens/WardMapScreen';
import WardDetailScreen from './src/screens/WardDetailScreen';

import { Colors } from './src/constants/theme';
import { useStore } from './src/store/useStore';
import AppHeader from './src/components/AppHeader';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

const CORE_SERVICES = [
  {
    id: 'request',
    icon: 'description',
    title: 'Sifaris & Requests',
    titleNE: 'सिफारिस र अनुरोध',
    subtitle: 'Apply for documents and municipal requests',
    subtitleNE: 'कागजात र नगर अनुरोध पेश गर्नुहोस्',
    route: 'Request',
  },
  {
    id: 'track',
    icon: 'history',
    title: 'Track Requests',
    titleNE: 'अनुरोध ट्र्याक',
    subtitle: 'Check the status of submitted work',
    subtitleNE: 'पेश भएका कामको स्थिति हेर्नुहोस्',
    route: 'Track',
  },
  {
    id: 'verify',
    icon: 'verified-user',
    title: 'Verify Documents',
    titleNE: 'कागजात प्रमाणीकरण',
    subtitle: 'Scan QR or validate DTID records',
    subtitleNE: 'QR स्क्यान वा DTID प्रमाणीकरण',
    route: 'Verify',
  },
  {
    id: 'assistant',
    icon: 'smart-toy',
    title: 'AI Assistant',
    titleNE: 'AI सहायक',
    subtitle: 'Ask questions about services and forms',
    subtitleNE: 'सेवा र फारमबारे प्रश्न सोध्नुहोस्',
    route: 'AiAssistant',
  },
];

function ServicesScreen({ navigation }: any) {
  const { language } = useStore();
  const [mode, setMode] = useState<'services' | 'tools'>('services');
  const lang = language;

  return (
    <SafeAreaView style={servicesStyles.container}>
      <AppHeader title={lang === 'ne' ? 'सेवाहरू' : 'Services'} showMenu={false} showLang />
      <View style={servicesStyles.header}>
        <Text style={servicesStyles.kicker}>{lang === 'ne' ? 'एकै ठाउँमा सेवा' : 'All in one place'}</Text>
        <Text style={servicesStyles.title}>{lang === 'ne' ? 'सेवाहरू' : 'Services'}</Text>
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
          onPress={() => setMode('tools')}
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
            <Text style={servicesStyles.sectionTitle}>{lang === 'ne' ? 'द्रुत पहुँच' : 'Quick access'}</Text>
            <View style={servicesStyles.serviceList}>
              {CORE_SERVICES.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={servicesStyles.serviceCard}
                  onPress={() => navigation.navigate(item.route)}
                  activeOpacity={0.9}
                >
                  <View style={servicesStyles.serviceIcon}>
                    <MaterialIcons name={item.icon as any} size={22} color={Colors.primary} />
                  </View>
                  <View style={servicesStyles.serviceBody}>
                    <Text style={servicesStyles.serviceTitle}>{lang === 'ne' ? item.titleNE : item.title}</Text>
                    <Text style={servicesStyles.serviceSubtitle}>{lang === 'ne' ? item.subtitleNE : item.subtitle}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={Colors.outline} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        <FeaturesScreen navigation={navigation} embedded />
      )}
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
        component={HomeScreen}
        options={{
          tabBarLabel: isNepali ? 'गृह' : 'Home',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name={focused ? 'home' : 'home-filled'}
              size={24} color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Services"
        component={ServicesScreen}
        options={{
          tabBarLabel: isNepali ? 'सेवा' : 'Services',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="apps" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AiAssistant"
        component={GovernmentAssistantScreen}
        options={{
          tabBarLabel: isNepali ? 'एआई सहायक' : 'AI Assistant',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'smart-toy' : 'smart-toy'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: isNepali ? 'प्रोफाइल' : 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
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
  serviceList: {
    gap: 12,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    shadowColor: '#003b5a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceBody: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: 3,
  },
  serviceSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.onSurfaceVariant,
    lineHeight: 17,
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
                <Stack.Screen name="Request" component={SifarisRequestScreen} />
                <Stack.Screen name="Track" component={TrackScreen} />
                <Stack.Screen name="Verify" component={VerifyScreen} />
                <Stack.Screen name="Assistant" component={GovernmentAssistantScreen} />
                <Stack.Screen name="Features" component={FeaturesScreen} />
                <Stack.Screen name="CitizenPortal" component={CitizenPortalScreen} />
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