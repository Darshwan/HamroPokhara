import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { Text } from 'react-native';
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

import { Colors } from './src/constants/theme';
import { useStore } from './src/store/useStore';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Bottom Tab Navigator (shown after login) ──────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderTopColor: '#e6e9e8',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.outline,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name={focused ? 'home' : 'home'}
              size={24} color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Request"
        component={RequestScreen}
        options={{
          tabBarLabel: 'Sifaris',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="description" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Track"
        component={TrackScreen}
        options={{
          tabBarLabel: 'Track',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="track-changes" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Verify"
        component={VerifyScreen}
        options={{
          tabBarLabel: 'Verify',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="qr-code-scanner" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person" size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const { isLoggedIn, isGuest, loadFromStorage } = useStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!(isLoggedIn || isGuest) ? (
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