import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, Alert, ActivityIndicator,
  Switch, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { citizenAPI } from '../api/client';
import AppHeader from '../components/AppHeader';

export default function ProfileScreen({ navigation }: any) {
  const { citizen, tourist, isTourist, logout, myRequests, language, setLanguage } = useStore();
  const isNepali = language === 'ne';
  const t = (en: string, ne: string) => (isNepali ? ne : en);

  const [profile, setProfile] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  const touristRequests = myRequests.filter((req) => req.category === 'tourist');
  const citizenRequests = myRequests.filter((req) => req.category !== 'tourist');

  useEffect(() => {
    const loadCitizenProfile = async () => {
      if (!citizen) {
        setLoading(false);
        return;
      }

      try {
        const [profRes, docRes] = await Promise.allSettled([
          citizenAPI.getProfile(citizen.nid),
          citizenAPI.getDocuments(citizen.nid),
        ]);

        if (profRes.status === 'fulfilled' && profRes.value.success) {
          setProfile(profRes.value.profile);
        }
        if (docRes.status === 'fulfilled' && docRes.value.success) {
          setDocuments(docRes.value.documents || []);
        }
      } catch {
        // Demo fallback handled by store data below.
      } finally {
        setLoading(false);
      }
    };

    if (isTourist) {
      setJobs([
        { id: 1, title: 'Lake Side Walk', org: 'Pokhara Tourism Desk', deadline: 'Open now', icon: 'tour' },
        { id: 2, title: 'Sarangkot Sunrise', org: 'Visitor Guide Network', deadline: 'Morning slots', icon: 'sunny' },
        { id: 3, title: 'Permit Support', org: 'Tourist Help Desk', deadline: '24/7', icon: 'verified-user' },
      ]);
      setLoading(false);
      return;
    }

    loadCitizenProfile();

    setJobs([
      { id: 1, title: 'Public Health Officer', org: 'Pokhara Metropolitan City', deadline: '3 Days Left', icon: 'account-balance' },
      { id: 2, title: 'Civil Engineer (Contract)', org: 'Gandaki Province Planning', deadline: '1 Week Left', icon: 'engineering' },
    ]);
  }, [citizen, isTourist]);

  const displayName = isTourist ? tourist?.name || 'Traveler' : profile?.full_name || citizen?.name || 'Citizen';
  const displayNE = !isTourist ? profile?.full_name_ne || '' : '';
  const wardDisplay = profile?.ward_code || citizen?.ward_code || 'NPL-04-33-09';
  const wardNum = wardDisplay.split('-')[3] || '9';

  const approved = myRequests.filter((req) => req.status === 'APPROVED').length;
  const pending = myRequests.filter((req) => req.status === 'PENDING' || req.status === 'UNDER_REVIEW').length;

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const handleHeaderLanguageToggle = () => {
    setLanguage(language === 'ne' ? 'en' : 'ne');
  };

  const localizedMenuItems = [
    { icon: 'home', label: t('Home', 'गृहपृष्ठ'), action: () => navigation.navigate('Home') },
    { icon: 'apps', label: t('Services', 'सेवाहरू'), action: () => navigation.navigate('Request') },
    { icon: 'timeline', label: t('Tracker', 'ट्र्याकर'), action: () => navigation.navigate('Track') },
  ];

  const menuItems = [
    { icon: 'home', label: 'Home', action: () => navigation.navigate('Home') },
    { icon: 'apps', label: 'Services', action: () => navigation.navigate('Request') },
    { icon: 'timeline', label: 'Tracker', action: () => navigation.navigate('Track') },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title={t('Hamro Pokhara', 'हाम्रो पोखरा')}
        showMenu
        showNotif
        showLang
        leftContent={(
          <View style={styles.headerLogo}>
            <MaterialIcons name="location-city" size={18} color={Colors.primary} />
          </View>
        )}
        onMenu={() => setShowMenu(true)}
        onLang={handleHeaderLanguageToggle}
        onNotif={() => Alert.alert('Notifications', 'No new notifications')}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isTourist ? (
          <>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryContainer]}
              style={styles.touristHero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.touristTopRow}>
                <View style={styles.touristBadge}>
                  <MaterialIcons name="flight-takeoff" size={14} color={Colors.primary} />
                  <Text style={styles.touristBadgeText}>{t('Tourist Profile', 'पर्यटक प्रोफाइल')}</Text>
                </View>
                <TouchableOpacity style={styles.touristMenuBtn} onPress={() => navigation.navigate('Request')}>
                  <MaterialIcons name="support-agent" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.touristAvatarRow}>
                <View style={styles.touristAvatar}>
                  <MaterialIcons name="person" size={36} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.touristName}>{t('Welcome', 'स्वागत छ')}, {displayName}</Text>
                  <Text style={styles.touristSub}>{t('Use visitor tools, request support, and track travel services.', 'आगन्तुक उपकरण प्रयोग गर्नुहोस्, सहयोग माग्नुहोस्, र यात्रा सेवाहरू ट्र्याक गर्नुहोस्।')}</Text>
                </View>
              </View>

              <View style={styles.touristMetaRow}>
                <View style={styles.touristMetaPill}>
                  <Text style={styles.touristMetaLabel}>{t('Passport', 'पासपोर्ट')}</Text>
                  <Text style={styles.touristMetaValue}>{tourist?.passport_no || '—'}</Text>
                </View>
                <View style={styles.touristMetaPill}>
                  <Text style={styles.touristMetaLabel}>{t('Nationality', 'राष्ट्रियता')}</Text>
                  <Text style={styles.touristMetaValue}>{tourist?.nationality || '—'}</Text>
                </View>
                <View style={styles.touristMetaPill}>
                  <Text style={styles.touristMetaLabel}>{t('Mode', 'मोड')}</Text>
                  <Text style={styles.touristMetaValue}>{t('Tourist', 'पर्यटक')}</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.touristStatsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{touristRequests.length}</Text>
                <Text style={styles.statLbl}>{t('Visitor Requests', 'आगन्तुक अनुरोध')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: Colors.success }]}>{approved}</Text>
                <Text style={styles.statLbl}>{t('Approved', 'स्वीकृत')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: '#b7791f' }]}>{pending}</Text>
                <Text style={styles.statLbl}>{t('Pending', 'पेन्डिङ')}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('Quick Actions', 'छिटो कार्यहरू')}</Text>
              <View style={styles.actionGrid}>
                {[
                  { icon: 'map', label: t('Explore Pokhara', 'पोखरा अन्वेषण'), action: () => navigation.navigate('Home') },
                  { icon: 'verified-user', label: t('Permit Help', 'अनुमति सहायता'), action: () => navigation.navigate('Request') },
                  { icon: 'directions-bus', label: t('Transport', 'यातायात'), action: () => navigation.navigate('Track') },
                  { icon: 'sos', label: t('Emergency', 'आपतकालीन'), action: () => navigation.navigate('Verify') },
                ].map((item) => (
                  <TouchableOpacity key={item.label} style={styles.actionCard} onPress={item.action}>
                    <View style={styles.actionIcon}>
                      <MaterialIcons name={item.icon as any} size={22} color={Colors.primary} />
                    </View>
                    <Text style={styles.actionLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('Travel Support', 'यात्रा सहायता')}</Text>
              <View style={styles.supportItem}>
                <MaterialIcons name="location-on" size={18} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.supportTitle}>{t('Stay in Pokhara', 'पोखरामै बस्नुहोस्')}</Text>
                  <Text style={styles.supportText}>{t('Ward, hotel, and route help for your current visit.', 'तपाईंको वर्तमान यात्राका लागि वडा, होटल, र मार्ग सहायता।')}</Text>
                </View>
              </View>
              <View style={styles.supportItem}>
                <MaterialIcons name="security" size={18} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.supportTitle}>{t('Safety & Assistance', 'सुरक्षा र सहायता')}</Text>
                  <Text style={styles.supportText}>{t('Get help quickly from the tourist desk or local contacts.', 'पर्यटक डेस्क वा स्थानीय सम्पर्कबाट छिटो सहायता पाउनुहोस्।')}</Text>
                </View>
              </View>
              <View style={styles.supportItem}>
                <MaterialIcons name="bookmark-border" size={18} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.supportTitle}>{t('Travel Notes', 'यात्रा नोटहरू')}</Text>
                  <Text style={styles.supportText}>{t('Keep your passport, visa, and itinerary details visible here.', 'आफ्नो पासपोर्ट, भिसा, र यात्रा विवरण यहाँ देखिने गरी राख्नुहोस्।')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('Visitor Requests', 'आगन्तुक अनुरोध')}</Text>
              {touristRequests.length > 0 ? touristRequests.slice(0, 3).map((req) => (
                <View key={req.request_id} style={styles.requestItem}>
                  <View style={styles.requestIcon}>
                    <MaterialIcons name="description" size={16} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestTitle}>{req.document_type.replace(/_/g, ' ')}</Text>
                    <Text style={styles.requestText} numberOfLines={2}>{req.purpose}</Text>
                  </View>
                  <View style={styles.requestBadge}>
                    <Text style={styles.requestBadgeText}>{req.status}</Text>
                  </View>
                </View>
              )) : (
                <Text style={styles.emptyText}>{t('No tourist requests yet. Use the Request tab to ask for travel help or support documents.', 'अहिलेसम्म कुनै आगन्तुक अनुरोध छैन। यात्रा सहायता वा कागजातका लागि Request ट्याब प्रयोग गर्नुहोस्।')}</Text>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('Language', 'भाषा')}</Text>
              {[
                { code: 'en', flag: '🇺🇸', label: 'English' },
                { code: 'ne', flag: '🇳🇵', label: 'नेपाली' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langOption, language === lang.code && styles.langOptionActive]}
                  onPress={() => setLanguage(lang.code)}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text style={[styles.langLabel, language === lang.code && styles.langLabelActive]}>{lang.label}</Text>
                  {language === lang.code && <MaterialIcons name="check-circle" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('Tourist Settings', 'पर्यटक सेटिङ')}</Text>
              <View style={styles.toggleRow}>
                <MaterialIcons name="notifications" size={20} color={Colors.primary} />
                <Text style={styles.toggleText}>{t('Push Notifications', 'सूचना प्राप्त गर्नुहोस्')}</Text>
                <Switch
                  value={notificationsOn}
                  onValueChange={setNotificationsOn}
                  trackColor={{ false: Colors.outlineVariant, true: Colors.primaryFixed }}
                  thumbColor={notificationsOn ? Colors.primary : Colors.outline}
                />
              </View>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <MaterialIcons name="logout" size={18} color={Colors.secondary} />
                <Text style={styles.logoutText}>{t('Logout', 'लगआउट')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.profileHeader}>
              <View style={styles.profileTopRow}>
                <View style={styles.avatarWrap}>
                  <View style={styles.avatar}>
                    <MaterialIcons name="person" size={34} color={Colors.primary} />
                  </View>
                  <View style={styles.verifiedBadge}>
                    <MaterialIcons name="verified" size={11} color="#fff" />
                  </View>
                </View>
                <View style={styles.profileInfoWrap}>
                  <View style={styles.profileNameRow}>
                    <Text style={styles.profileName}>{t('Namaste', 'नमस्ते')}, {displayName}</Text>
                    <View style={styles.premiumBadge}>
                      <MaterialIcons name="workspace-premium" size={13} color={Colors.onPrimaryFixedVariant} />
                      <Text style={styles.premiumText}>{t('Verified', 'प्रमाणित')}</Text>
                    </View>
                  </View>
                  {displayNE !== '' && <Text style={styles.profileNameNE}>{displayNE}</Text>}
                  <View style={styles.locationRow}>
                    <MaterialIcons name="location-on" size={13} color={Colors.onSurfaceVariant} />
                    <Text style={styles.locationText}>{t('Ward No.', 'वडा नम्बर')} {wardNum}, {profile?.district || 'Kaski'}, Pokhara</Text>
                  </View>
                </View>
              </View>

              <View style={styles.profileMetaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipLabel}>{t('Card No', 'कार्ड नम्बर')}</Text>
                  <Text style={styles.metaChipValue}>{profile?.nid || citizen?.nid || 'PKR-9928-102'}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipLabel}>{t('Location', 'स्थान')}</Text>
                  <Text style={styles.metaChipValue}>{t('Ward', 'वडा')} {wardNum}</Text>
                </View>
              </View>
            </View>

            <View style={styles.idCard}>
              <LinearGradient
                colors={[Colors.primaryContainer, Colors.primary]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
              <View style={styles.idGlow} />

              <View style={{ position: 'relative', zIndex: 1 }}>
                <View style={styles.idTopRow}>
                  <View>
                    <Text style={styles.idGovLabel}>{t('Government of Nepal', 'नेपाल सरकार')}</Text>
                    <Text style={styles.idCardTitle}>{t('Digital National ID', 'डिजिटल राष्ट्रिय परिचयपत्र')}</Text>
                  </View>
                  <View style={styles.idHologram}>
                    <MaterialIcons name="security" size={28} color="rgba(255,255,255,0.5)" />
                  </View>
                </View>

                <View style={styles.idFields}>
                  <View style={styles.idField}>
                    <Text style={styles.idFieldLabel}>{t('Citizen NID', 'नागरिक NID')}</Text>
                    <Text style={styles.idFieldValue}>{profile?.nid || citizen?.nid || 'PKR-9928-102'}</Text>
                  </View>
                  <View style={styles.idField}>
                    <Text style={styles.idFieldLabel}>{t('Ward Profile', 'वडा प्रोफाइल')}</Text>
                    <Text style={styles.idFieldValue}>{t('Ward', 'वडा')} {wardNum}, {profile?.district || 'Kaski'}</Text>
                  </View>
                  <View style={styles.idField}>
                    <Text style={styles.idFieldLabel}>{t('Status', 'स्थिति')}</Text>
                    <View style={styles.activeStatus}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activeText}>{t('ACTIVE', 'सक्रिय')}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.idActions}>
                  <TouchableOpacity
                    style={styles.idBtnOutline}
                    onPress={() => navigation.navigate('Verify')}
                  >
                    <MaterialIcons name="qr-code-2" size={18} color="#fff" />
                    <Text style={styles.idBtnText}>{t('Show QR', 'QR देखाउनुहोस्')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.idBtnFilled}>
                    <MaterialIcons name="download" size={18} color={Colors.secondary} />
                    <Text style={[styles.idBtnText, { color: Colors.secondary }]}>{t('Download PDF', 'PDF डाउनलोड')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{citizenRequests.length}</Text>
                <Text style={styles.statLbl}>{t('Requests', 'अनुरोध')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: Colors.success }]}>{approved}</Text>
                <Text style={styles.statLbl}>{t('Approved', 'स्वीकृत')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: '#b7791f' }]}>{pending}</Text>
                <Text style={styles.statLbl}>{t('Pending', 'पेन्डिङ')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { color: Colors.primary }]}>{documents.length}</Text>
                <Text style={styles.statLbl}>{t('Documents', 'कागजात')}</Text>
              </View>
            </View>

            <View style={styles.langCard}>
              <Text style={styles.langCardTitle}>{t('Preferred Language', 'रुचाइएको भाषा')}</Text>
              {[
                { code: 'ne', flag: '🇳🇵', label: 'नेपाली' },
                { code: 'en', flag: '🇺🇸', label: 'English' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langOption, language === lang.code && styles.langOptionActive]}
                  onPress={() => setLanguage(lang.code)}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text style={[styles.langLabel, language === lang.code && styles.langLabelActive]}>
                    {lang.label}
                  </Text>
                  {language === lang.code && (
                    <MaterialIcons name="check-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
              <Text style={styles.langNote}>{t('Changes apply across all civic services.', 'परिवर्तन सबै नागरिक सेवामा लागू हुन्छ।')}</Text>
            </View>

            {documents.length > 0 && (
              <View style={styles.docsCard}>
                <Text style={styles.docsTitle}>{t('My PRATIBIMBA Documents', 'मेरो PRATIBIMBA कागजातहरू')}</Text>
                {documents.slice(0, 3).map((doc) => (
                  <View key={doc.dtid} style={styles.docItem}>
                    <View style={styles.docIcon}>
                      <MaterialIcons name="description" size={16} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docType}>{doc.document_type.replace(/_/g, ' ')}</Text>
                      <Text style={styles.docDtid} numberOfLines={1}>{doc.dtid}</Text>
                    </View>
                    <View style={[styles.docStatus, { backgroundColor: doc.status === 'ACTIVE' ? Colors.successLight : '#fdf0ef' }]}>
                      <Text style={[styles.docStatusText, { color: doc.status === 'ACTIVE' ? Colors.success : Colors.secondary }]}>
                        {doc.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <View>
                  <Text style={styles.jobTitle}>{t('Job Portal', 'रोजगार पोर्टल')}</Text>
                  <Text style={styles.jobSub}>{t('Active vacancies in Gandaki', 'गण्डकीका सक्रिय रिक्त पदहरू')}</Text>
                </View>
                <TouchableOpacity style={styles.jobHeaderBtn}>
                  <MaterialIcons name="work" size={20} color={Colors.onPrimaryFixedVariant} />
                </TouchableOpacity>
              </View>
              {jobs.map((job) => (
                <TouchableOpacity key={job.id} style={styles.jobItem}>
                  <View style={styles.jobItemIcon}>
                    <MaterialIcons name={job.icon as any} size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobItemTitle}>{job.title}</Text>
                    <Text style={styles.jobItemOrg}>{job.org} · {job.deadline}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.jobViewAll}>
                <Text style={styles.jobViewAllText}>{t('View All 12 Vacancies', 'सबै १२ पदहरू हेर्नुहोस्')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutBtnWide} onPress={handleLogout}>
              <MaterialIcons name="logout" size={20} color={Colors.secondary} />
              <Text style={styles.logoutBtnWideText}>{t('Logout', 'लगआउट')}</Text>
            </TouchableOpacity>

            <View style={styles.notifRow}>
              <MaterialIcons name="notifications" size={20} color={Colors.primary} />
              <Text style={styles.notifText}>{t('Push Notifications', 'पुश सूचना')}</Text>
              <Switch
                value={notificationsOn}
                onValueChange={setNotificationsOn}
                trackColor={{ false: Colors.outlineVariant, true: Colors.primaryFixed }}
                thumbColor={notificationsOn ? Colors.primary : Colors.outline}
              />
            </View>

            <Text style={styles.version}>{t('Hamro Pokhara v1.0.0 · Powered by PRATIBIMBA NDO', 'हाम्रो पोखरा v1.0.0 · PRATIBIMBA NDO द्वारा सञ्चालित')}</Text>
            <Text style={styles.versionSub}>{t('Nepal Electronic Transactions Act 2063', 'नेपाल इलेक्ट्रोनिक लेनदेन ऐन २०६३')}</Text>
          </>
        )}
      </ScrollView>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <TouchableOpacity style={styles.menuSheet} activeOpacity={1} onPress={() => {}}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>{t('Menu', 'मेनु')}</Text>
              <TouchableOpacity style={styles.menuClose} onPress={() => setShowMenu(false)}>
                <MaterialIcons name="close" size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            {localizedMenuItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  item.action();
                }}
              >
                <MaterialIcons name={item.icon as any} size={18} color={Colors.primary} />
                <Text style={styles.menuItemText}>{item.label}</Text>
                <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 48, gap: 14 },
  headerLogo: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  menuTitle: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  menuClose: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant,
  },
  menuItemText: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.primary },

  touristHero: { borderRadius: Radius.xxl, padding: 18, overflow: 'hidden', ...Shadow.lg },
  touristTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  touristBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  touristBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  touristMenuBtn: { width: 38, height: 38, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  touristAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  touristAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  touristName: { fontSize: 22, fontWeight: '900', color: '#fff' },
  touristSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 17 },
  touristMetaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 16 },
  touristMetaPill: { flexGrow: 1, minWidth: 96, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.xl, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  touristMetaLabel: { fontSize: 9, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.9, fontWeight: '700' },
  touristMetaValue: { fontSize: 12, color: '#fff', fontWeight: '800', marginTop: 4 },
  touristStatsRow: { flexDirection: 'row', gap: 10 },

  profileHeader: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 14, ...Shadow.sm },
  profileTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.surfaceContainerLowest },
  verifiedBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: Colors.secondary, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  profileInfoWrap: { flex: 1, minWidth: 0 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  profileName: { fontSize: 16, fontWeight: '800', color: Colors.primary, flexShrink: 1 },
  profileNameNE: { fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  locationText: { fontSize: 11.5, color: Colors.onSurfaceVariant, flexShrink: 1 },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryFixed, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  premiumText: { fontSize: 10, fontWeight: '700', color: Colors.onPrimaryFixedVariant },
  profileMetaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  metaChip: { flexGrow: 1, minWidth: 120, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 8 },
  metaChipLabel: { fontSize: 10, fontWeight: '700', color: Colors.outline, textTransform: 'uppercase', letterSpacing: 0.4 },
  metaChipValue: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginTop: 3 },

  idCard: { borderRadius: Radius.xxl, padding: 24, overflow: 'hidden', ...Shadow.lg },
  idGlow: { position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' },
  idTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  idGovLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5, textTransform: 'uppercase' },
  idCardTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 2 },
  idHologram: { width: 56, height: 56, borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  idFields: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  idField: { flexGrow: 1, minWidth: 96 },
  idFieldLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  idFieldValue: { fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: 'monospace' },
  activeStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  activeText: { color: '#4ade80', fontSize: 13, fontWeight: '700' },
  idActions: { flexDirection: 'row', gap: 10 },
  idBtnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingVertical: 12, borderRadius: Radius.full },
  idBtnFilled: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', paddingVertical: 12, borderRadius: Radius.full },
  idBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 14, alignItems: 'center', ...Shadow.sm },
  statNum: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  statLbl: { fontSize: 10, color: Colors.onSurfaceVariant, marginTop: 2 },
  sectionCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xxl, padding: 18, ...Shadow.sm },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.primary, marginBottom: 14 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: '48.5%', backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, padding: 14, alignItems: 'center', gap: 10 },
  actionIcon: { width: 44, height: 44, borderRadius: Radius.lg, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  supportItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.outlineVariant },
  supportTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  supportText: { fontSize: 12, color: Colors.onSurfaceVariant, lineHeight: 17, marginTop: 2 },
  requestItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.outlineVariant },
  requestIcon: { width: 36, height: 36, borderRadius: Radius.lg, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  requestTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  requestText: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
  requestBadge: { backgroundColor: Colors.primaryFixed, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  requestBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.onPrimaryFixedVariant },
  emptyText: { fontSize: 12, color: Colors.onSurfaceVariant, lineHeight: 17 },
  langCard: { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xxl, padding: 20 },
  langCardTitle: { fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  langOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, marginBottom: 8 },
  langOptionActive: { borderWidth: 1, borderColor: Colors.primaryFixed },
  langFlag: { fontSize: 20 },
  langLabel: { fontSize: 15, fontWeight: '600', color: Colors.primary, flex: 1 },
  langLabelActive: { fontWeight: '700' },
  langNote: { fontSize: 10, color: Colors.outline, marginTop: 8, paddingHorizontal: 4 },
  docsCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 18, ...Shadow.sm },
  docsTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 14 },
  docItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.outlineVariant },
  docIcon: { width: 36, height: 36, borderRadius: Radius.lg, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  docType: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  docDtid: { fontSize: 10, color: Colors.onSurfaceVariant, fontFamily: 'monospace', marginTop: 2 },
  docStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  docStatusText: { fontSize: 10, fontWeight: '700' },
  jobCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xxl, padding: 20, ...Shadow.sm },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  jobTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  jobSub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
  jobHeaderBtn: { width: 44, height: 44, backgroundColor: Colors.primaryFixed, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center' },
  jobItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl, marginBottom: 8 },
  jobItemIcon: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  jobItemTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  jobItemOrg: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
  jobViewAll: { paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(0,59,90,0.1)', borderRadius: Radius.xl, alignItems: 'center', marginTop: 4 },
  jobViewAllText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  logoutBtnWide: { marginTop: 10, backgroundColor: 'rgba(175,47,35,0.05)', borderWidth: 1, borderColor: 'rgba(175,47,35,0.15)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radius.xl },
  logoutBtnWideText: { fontSize: 13, fontWeight: '800', color: Colors.secondary },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.xl },
  notifText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.primary },
  version: { textAlign: 'center', fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 4 },
  versionSub: { textAlign: 'center', fontSize: 10, color: Colors.outline, marginTop: 2 },
  logoutBtn: { marginTop: 12, backgroundColor: 'rgba(175,47,35,0.05)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radius.xl },
  logoutText: { fontSize: 13, fontWeight: '800', color: Colors.secondary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surfaceContainerLowest, padding: 14, borderRadius: Radius.xl },
  toggleText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.primary },
});
