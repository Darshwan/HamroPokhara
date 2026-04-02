import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import SplashScreen    from './src/screens/SplashScreen';
import LanguageScreen  from './src/screens/LanguageScreen';
import ContinueAsScreen from './src/screens/ContinueAsScreen';
import LoginScreen     from './src/screens/LoginScreen';
import HomeScreen      from './src/screens/HomeScreen';
import RequestScreen   from './src/screens/RequestScreen';
import TrackScreen     from './src/screens/TrackScreen';
import VerifyScreen    from './src/screens/VerifyScreen';
import ProfileScreen   from './src/screens/ProfileScreen';
import SewaScreen from './src/screens/SewaScreen';
import CitizenPortalScreen from './src/screens/CitizenPortalScreen';
import GovernmentAssistantScreen from './src/screens/GovernmentAssistantScreen';
import FeaturesScreen from './src/screens/FeaturesScreen';

import { Colors } from './src/constants/theme';
import { useStore } from './src/store/useStore';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Bottom Tab Navigator (shown after login) ──────────────────
function MainTabs() {
  const { language } = useStore();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
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
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name={focused ? 'home' : 'home-filled'}
              size={24} color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Request"
        component={RequestScreen}
        options={{
          tabBarLabel: 'Services',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'apps' : 'apps'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Track"
        component={TrackScreen}
        options={{
          tabBarLabel: 'Tracker',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'timeline' : 'show-chart'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Verify"
        component={VerifyScreen}
        options={{
          tabBarLabel: 'Wallet',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'account-balance-wallet' : 'account-balance-wallet'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Features"
        component={FeaturesScreen}
        options={{
          tabBarLabel: language === 'ne' ? 'सेवाहरू' : 'Services',
          tabBarIcon: ({ color }) => <MaterialIcons name="apps" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Assistant"
        component={GovernmentAssistantScreen}
        options={{
          tabBarLabel: 'Assistant',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name={focused ? 'smart-toy' : 'smart-toy'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
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
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: '#e6e9e8',
    paddingTop: 8,
    paddingBottom: 10,
    shadowColor: '#003b5a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  tabItem: {
    borderRadius: 14,
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
              <Stack.Screen name="Main" component={MainTabs} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}