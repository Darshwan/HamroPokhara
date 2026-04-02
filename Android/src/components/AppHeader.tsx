import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Typography } from '../constants/theme';
import { useStore } from '../store/useStore';

interface Props {
  title?:       string;
  showMenu?:    boolean;
  showNotif?:   boolean;
  showBack?:    boolean;
  showLang?:    boolean;
  leftContent?: React.ReactNode;
  onMenu?:      () => void;
  onBack?:      () => void;
  onNotif?:     () => void;
  onLang?:      () => void;
  rightContent?: React.ReactNode;
  transparent?: boolean;
  showLogo?:    boolean;
}

export default function AppHeader({
  title       = 'Hamro Pokhara',
  showMenu    = true,
  showNotif   = false,
  showBack    = false,
  showLang    = true,
  leftContent,
  onMenu,
  onBack,
  onNotif,
  onLang,
  rightContent,
  transparent = false,
  showLogo = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useStore();
  const handleLangPress = onLang || (() => setLanguage(language === 'ne' ? 'en' : 'ne'));

  return (
    <View
      style={[
        h.outer,
        { paddingTop: insets.top + 8 },
        transparent && h.transparent,
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={h.inner}>
        {/* Left side */}
        <View style={h.left}>
          {leftContent}
          {showBack && (
            <TouchableOpacity style={h.iconBtn} onPress={onBack}>
              <MaterialIcons name="arrow-back" size={22} color={Colors.primary} />
            </TouchableOpacity>
          )}
          {showMenu && !showBack && (
            <TouchableOpacity style={h.iconBtn} onPress={onMenu}>
              <MaterialIcons name="menu" size={22} color={Colors.primary} />
            </TouchableOpacity>
          )}
          {showLogo && (
            <View style={h.logoWrap}>
              <Image source={require('../../assets/logo.png')} style={h.logo} resizeMode="contain" />
            </View>
          )}
          <Text style={h.title}>{title}</Text>
        </View>

        {/* Right side */}
        <View style={h.right}>
          {showLang && (
            <TouchableOpacity style={h.iconBtn} onPress={handleLangPress}>
              <MaterialIcons name="language" size={20} color={Colors.primary} />
            </TouchableOpacity>
          )}
          {showNotif && (
            <TouchableOpacity style={h.iconBtn} onPress={onNotif}>
              <MaterialIcons name="notifications-none" size={22} color={Colors.primary} />
            </TouchableOpacity>
          )}
          {rightContent}
        </View>
      </View>
    </View>
  );
}

const h = StyleSheet.create({
  outer: {
    backgroundColor: 'rgba(248,250,249,0.97)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant,
    // Subtle blur effect via opacity
  },
  transparent: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  logoWrap: {
    width: 60,
    height: 60,
    overflow: 'hidden',
    borderWidth: 0,
    // backgroundColor: '#FFFFFF',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    ...Typography.h3,
    color: Colors.primary,
  },
});