import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, SafeAreaView, Modal, TextInput,
    ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Toast from 'react-native-toast-message';
import * as Location from 'expo-location';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import api from '../api/client';
import AppHeader from '../components/AppHeader';

const { width } = Dimensions.get('window');

// Feature tile config
const TILES = [
    { id: 'ai', icon: 'smart-toy', label: 'AI Assistant', labelNE: 'AI सहायक', color: '#6750A4', bg: '#F3EEFF' },
    { id: 'grievance', icon: 'report-problem', label: 'Report 311', labelNE: '311 रिपोर्ट', color: '#B3261E', bg: '#FFEDEA' },
    { id: 'hearing', icon: 'how-to-vote', label: 'Public Hearing', labelNE: 'सार्वजनिक सुनुवाई', color: '#0057B8', bg: '#E8F0FE' },
    { id: 'tax', icon: 'payments', label: 'Tax & Fines', labelNE: 'कर र जरिमाना', color: '#1D6B34', bg: '#E8F5E9' },
    { id: 'krishi', icon: 'eco', label: 'Krishi Anudan', labelNE: 'कृषि अनुदान', color: '#2E7D32', bg: '#DCEDC8' },
    { id: 'bhatta', icon: 'elderly', label: 'Briddha Bhatta', labelNE: 'बृद्धभत्ता', color: '#0277BD', bg: '#E1F5FE' },
    { id: 'blood', icon: 'bloodtype', label: 'Blood Connect', labelNE: 'रक्त दान', color: '#C62828', bg: '#FFEBEE' },
    { id: 'tourism', icon: 'landscape', label: 'Tourism Guide', labelNE: 'पर्यटन गाइड', color: '#00695C', bg: '#E0F2F1' },
    { id: 'lost', icon: 'search', label: 'Lost & Found', labelNE: 'हराएको/भेटिएको', color: '#E65100', bg: '#FFF3E0' },
    { id: 'volunteer', icon: 'volunteer-activism', label: 'Volunteer', labelNE: 'स्वयंसेवक', color: '#4527A0', bg: '#EDE7F6' },
    { id: 'digsig', icon: 'draw', label: 'Digital Sign', labelNE: 'डिजिटल हस्ताक्षर', color: '#37474F', bg: '#ECEFF1' },
    { id: 'feedback', icon: 'star', label: 'Rate Officer', labelNE: 'अधिकारी मूल्यांकन', color: '#F57F17', bg: '#FFFDE7' },
];

const WARD_OFFICER_ROSTER: Array<{
    wardNo: string;
    officers: Array<{ id: string; name: string; title: string }>;
}> = [
    { wardNo: '01', officers: [{ id: 'WO-01-01', name: 'Asha Gurung', title: 'Ward Officer' }, { id: 'WO-01-02', name: 'Bikash Shrestha', title: 'Assistant Officer' }] },
    { wardNo: '02', officers: [{ id: 'WO-02-01', name: 'Mina Thapa', title: 'Ward Officer' }, { id: 'WO-02-02', name: 'Sandeep KC', title: 'Assistant Officer' }] },
    { wardNo: '03', officers: [{ id: 'WO-03-01', name: 'Ramesh Karki', title: 'Ward Officer' }, { id: 'WO-03-02', name: 'Sujata Adhikari', title: 'Assistant Officer' }] },
    { wardNo: '04', officers: [{ id: 'WO-04-01', name: 'Nirmala Rai', title: 'Ward Officer' }, { id: 'WO-04-02', name: 'Prakash Bhandari', title: 'Assistant Officer' }] },
    { wardNo: '05', officers: [{ id: 'WO-05-01', name: 'Dipak Gurung', title: 'Ward Officer' }, { id: 'WO-05-02', name: 'Kriti Shakya', title: 'Assistant Officer' }] },
    { wardNo: '06', officers: [{ id: 'WO-06-01', name: 'Sarita Tamang', title: 'Ward Officer' }, { id: 'WO-06-02', name: 'Suman Paudel', title: 'Assistant Officer' }] },
    { wardNo: '07', officers: [{ id: 'WO-07-01', name: 'Hari Adhikari', title: 'Ward Officer' }, { id: 'WO-07-02', name: 'Anita KC', title: 'Assistant Officer' }] },
    { wardNo: '08', officers: [{ id: 'WO-08-01', name: 'Keshav Poudel', title: 'Ward Officer' }, { id: 'WO-08-02', name: 'Rupa Gurung', title: 'Assistant Officer' }] },
    { wardNo: '09', officers: [{ id: 'WO-09-01', name: 'Ram Bahadur Thapa', title: 'Ward Officer' }, { id: 'WO-09-02', name: 'Sita Bista', title: 'Assistant Officer' }] },
    { wardNo: '10', officers: [{ id: 'WO-10-01', name: 'Anil Shrestha', title: 'Ward Officer' }, { id: 'WO-10-02', name: 'Madhavi Khatri', title: 'Assistant Officer' }] },
    { wardNo: '11', officers: [{ id: 'WO-11-01', name: 'Dinesh Lama', title: 'Ward Officer' }, { id: 'WO-11-02', name: 'Sangita Joshi', title: 'Assistant Officer' }] },
    { wardNo: '12', officers: [{ id: 'WO-12-01', name: 'Binod Gautam', title: 'Ward Officer' }, { id: 'WO-12-02', name: 'Puja Subedi', title: 'Assistant Officer' }] },
    { wardNo: '13', officers: [{ id: 'WO-13-01', name: 'Kamal BK', title: 'Ward Officer' }, { id: 'WO-13-02', name: 'Maya Rana', title: 'Assistant Officer' }] },
    { wardNo: '14', officers: [{ id: 'WO-14-01', name: 'Suresh Giri', title: 'Ward Officer' }, { id: 'WO-14-02', name: 'Ritu Koirala', title: 'Assistant Officer' }] },
    { wardNo: '15', officers: [{ id: 'WO-15-01', name: 'Nabin Dahal', title: 'Ward Officer' }, { id: 'WO-15-02', name: 'Sushmita Neupane', title: 'Assistant Officer' }] },
    { wardNo: '16', officers: [{ id: 'WO-16-01', name: 'Bimal Dhakal', title: 'Ward Officer' }, { id: 'WO-16-02', name: 'Kanchan Gurung', title: 'Assistant Officer' }] },
    { wardNo: '17', officers: [{ id: 'WO-17-01', name: 'Rajan Tiwari', title: 'Ward Officer' }, { id: 'WO-17-02', name: 'Nisha Pahari', title: 'Assistant Officer' }] },
    { wardNo: '18', officers: [{ id: 'WO-18-01', name: 'Pradeep Aarya', title: 'Ward Officer' }, { id: 'WO-18-02', name: 'Rekha Shahi', title: 'Assistant Officer' }] },
    { wardNo: '19', officers: [{ id: 'WO-19-01', name: 'Sunil Bista', title: 'Ward Officer' }, { id: 'WO-19-02', name: 'Anju Chaudhary', title: 'Assistant Officer' }] },
    { wardNo: '20', officers: [{ id: 'WO-20-01', name: 'Sanjay K.C.', title: 'Ward Officer' }, { id: 'WO-20-02', name: 'Pratima Rai', title: 'Assistant Officer' }] },
    { wardNo: '21', officers: [{ id: 'WO-21-01', name: 'Arjun Bhandari', title: 'Ward Officer' }, { id: 'WO-21-02', name: 'Niruta Sharma', title: 'Assistant Officer' }] },
    { wardNo: '22', officers: [{ id: 'WO-22-01', name: 'Mohan Sharma', title: 'Ward Officer' }, { id: 'WO-22-02', name: 'Rashmi Thapa', title: 'Assistant Officer' }] },
    { wardNo: '23', officers: [{ id: 'WO-23-01', name: 'Ganesh Pariyar', title: 'Ward Officer' }, { id: 'WO-23-02', name: 'Samiksha Joshi', title: 'Assistant Officer' }] },
    { wardNo: '24', officers: [{ id: 'WO-24-01', name: 'Kiran Adhikari', title: 'Ward Officer' }, { id: 'WO-24-02', name: 'Bindu Bhandari', title: 'Assistant Officer' }] },
    { wardNo: '25', officers: [{ id: 'WO-25-01', name: 'Rabin Gurung', title: 'Ward Officer' }, { id: 'WO-25-02', name: 'Sneha Panta', title: 'Assistant Officer' }] },
    { wardNo: '26', officers: [{ id: 'WO-26-01', name: 'Bhuwan Shrestha', title: 'Ward Officer' }, { id: 'WO-26-02', name: 'Manisha Lama', title: 'Assistant Officer' }] },
    { wardNo: '27', officers: [{ id: 'WO-27-01', name: 'Tika Basnet', title: 'Ward Officer' }, { id: 'WO-27-02', name: 'Pallavi Karki', title: 'Assistant Officer' }] },
    { wardNo: '28', officers: [{ id: 'WO-28-01', name: 'Hemant Khatri', title: 'Ward Officer' }, { id: 'WO-28-02', name: 'Sanjita Adhikari', title: 'Assistant Officer' }] },
    { wardNo: '29', officers: [{ id: 'WO-29-01', name: 'Birendra Thapa', title: 'Ward Officer' }, { id: 'WO-29-02', name: 'Smriti Gurung', title: 'Assistant Officer' }] },
    { wardNo: '30', officers: [{ id: 'WO-30-01', name: 'Anup Rai', title: 'Ward Officer' }, { id: 'WO-30-02', name: 'Kalpana Sharma', title: 'Assistant Officer' }] },
    { wardNo: '31', officers: [{ id: 'WO-31-01', name: 'Jitendra K.C.', title: 'Ward Officer' }, { id: 'WO-31-02', name: 'Sangeeta Neupane', title: 'Assistant Officer' }] },
    { wardNo: '32', officers: [{ id: 'WO-32-01', name: 'Mahesh Poudel', title: 'Ward Officer' }, { id: 'WO-32-02', name: 'Dipa Shakya', title: 'Assistant Officer' }] },
    { wardNo: '33', officers: [{ id: 'WO-33-01', name: 'Bishnu Aryal', title: 'Ward Officer' }, { id: 'WO-33-02', name: 'Mina Koirala', title: 'Assistant Officer' }] },
];

export default function FeaturesScreen({ navigation, route, embedded = false }: any) {
    const { citizen, tourist, language } = useStore();
    const [activeFeature, setActiveFeature] = useState<string | null>(null);
    const lang = language;

    useEffect(() => {
        const openFeature = route?.params?.openFeature;
        if (typeof openFeature === 'string' && openFeature) {
            setActiveFeature(openFeature);
        }
    }, [route?.params?.openFeature]);

    const openFeature = (id: string) => setActiveFeature(id);
    const closeFeature = () => setActiveFeature(null);

    const content = (
        <>
            {!embedded && <AppHeader title={lang === 'ne' ? 'नागरिक सेवाहरू' : 'Citizen Services'} showMenu={false} showLang />}
            {!embedded && (
                <View style={s.header}>
                    <Text style={s.headerTitle}>{lang === 'ne' ? 'नागरिक सेवाहरू' : 'Citizen Services'}</Text>
                    <Text style={s.headerSub}>{TILES.length} {lang === 'ne' ? 'सेवाहरू उपलब्ध' : 'services available'}</Text>
                </View>
            )}

            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                <View style={s.grid}>
                    {TILES.map(tile => (
                        <TouchableOpacity
                            key={tile.id}
                            style={[s.tile, { backgroundColor: tile.bg }]}
                            onPress={() => openFeature(tile.id)}
                            activeOpacity={0.85}
                        >
                            <View style={[s.tileIcon, { backgroundColor: tile.color + '20' }]}>
                                <MaterialIcons name={tile.icon as any} size={22} color={tile.color} />
                            </View>
                            <Text style={[s.tileLabel, { color: tile.color }]}>
                                {lang === 'ne' ? tile.labelNE : tile.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {activeFeature === 'ai' && <AIAssistantModal onClose={closeFeature} citizen={citizen} lang={lang} />}
            {activeFeature === 'grievance' && <GrievanceModal onClose={closeFeature} citizen={citizen} lang={lang} />}
            {activeFeature === 'hearing' && <HearingModal onClose={closeFeature} citizen={citizen} lang={lang} />}
            {activeFeature === 'blood' && <BloodModal onClose={closeFeature} lang={lang} />}
            {activeFeature === 'lost' && <LostFoundModal onClose={closeFeature} citizen={citizen} lang={lang} />}
            {activeFeature === 'volunteer' && <VolunteerModal onClose={closeFeature} citizen={citizen} lang={lang} />}
            {activeFeature === 'feedback' && <FeedbackModal onClose={closeFeature} citizen={citizen} lang={lang} />}
            {activeFeature === 'krishi' && <KrishiModal onClose={closeFeature} citizen={citizen} lang={lang} />}
            {activeFeature === 'digsig' && <DigSigModal onClose={closeFeature} citizen={citizen} lang={lang} />}
            {activeFeature === 'bhatta' && <BhattaModal onClose={closeFeature} citizen={citizen} lang={lang} />}
            {activeFeature === 'tourism' && <TourismModal onClose={closeFeature} lang={lang} />}
            {activeFeature === 'tax' && <TaxModal onClose={closeFeature} citizen={citizen} lang={lang} />}
        </>
    );

    if (embedded) {
        return <View style={s.embeddedContainer}>{content}</View>;
    }

    return <SafeAreaView style={s.container}>{content}</SafeAreaView>;
}

// ── AI ASSISTANT ──────────────────────────────────────────────
function AIAssistantModal({ onClose, citizen, lang }: any) {
    const [messages, setMessages] = useState([
        {
            role: 'bot', text: lang === 'ne'
                ? 'नमस्ते! म पोखरा AI सहायक हुँ। सरकारी सेवाबारे जुनसुकै प्रश्न सोध्नुस्।'
                : 'Hello! I\'m the Pokhara AI Assistant. Ask me anything about government services.'
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const SUGGESTIONS = lang === 'ne'
        ? ['भवन अनुमति', 'नागरिकता', 'सिफारिस', 'कर तिर्ने', 'पासपोर्ट']
        : ['Building permit', 'Citizenship', 'Sifaris', 'Pay tax', 'Passport'];

    const sendMessage = async (q?: string) => {
        const query = (q || input).trim();
        if (!query) return;
        setMessages(m => [...m, { role: 'user', text: query }]);
        setInput('');
        setLoading(true);
        try {
            const res = await api.post('/ai/chat', {
                query, language: lang,
                citizen_nid: citizen?.nid || '',
                session_id: `sess-${Date.now()}`,
            });
            const data = res.data;
            if (data.success) {
                setMessages(m => [...m, { role: 'bot', text: data.response }]);
            }
        } catch {
            setMessages(m => [...m, { role: 'bot', text: lang === 'ne' ? 'माफ गर्नुस्, सर्भर उपलब्ध छैन।' : 'Sorry, server unavailable.' }]);
        }
        setLoading(false);
    };

    return (
        <FeatureModal title={lang === 'ne' ? '🤖 AI सरकारी सहायक' : '🤖 AI Gov Assistant'} onClose={onClose}>
            <ScrollView style={{ maxHeight: 240, marginBottom: 10 }}>
                {messages.map((m, i) => (
                    <View key={i} style={[mStyles.bubble, m.role === 'user' ? mStyles.user : mStyles.bot]}>
                        <Text style={[mStyles.bubbleText, m.role === 'user' && { color: '#fff' }]}>
                            {m.text}
                        </Text>
                    </View>
                ))}
                {loading && <ActivityIndicator color={Colors.primary} style={{ margin: 8 }} />}
            </ScrollView>
            {/* Suggestions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {SUGGESTIONS.map(s => (
                    <TouchableOpacity key={s} style={mStyles.suggestion} onPress={() => sendMessage(s)}>
                        <Text style={mStyles.suggestionText}>{s}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            <View style={mStyles.inputRow}>
                <TextInput
                    style={[mStyles.input, { flex: 1 }]}
                    placeholder={lang === 'ne' ? 'प्रश्न सोध्नुस्...' : 'Ask a question...'}
                    placeholderTextColor={Colors.outline}
                    value={input}
                    onChangeText={setInput}
                    onSubmitEditing={() => sendMessage()}
                />
                <TouchableOpacity style={mStyles.sendBtn} onPress={() => sendMessage()}>
                    <MaterialIcons name="send" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </FeatureModal>
    );
}

// ── GRIEVANCE 311 ─────────────────────────────────────────────
function GrievanceModal({ onClose, citizen, lang }: any) {
    const CATS = [
        { id: 'POTHOLE', label: 'Pothole', labelNE: 'खाल्डो', icon: 'warning' },
        { id: 'STREETLIGHT', label: 'Streetlight', labelNE: 'बत्ती', icon: 'lightbulb' },
        { id: 'WATER_LEAK', label: 'Water Leak', labelNE: 'पानी', icon: 'water-drop' },
        { id: 'GARBAGE', label: 'Garbage', labelNE: 'फोहोर', icon: 'delete' },
        { id: 'OTHER', label: 'Other', labelNE: 'अन्य', icon: 'more-horiz' },
    ];
    const [cat, setCat] = useState('POTHOLE');
    const [desc, setDesc] = useState('');
    const [loc, setLoc] = useState('');
    const [gps, setGPS] = useState<{ lat: number; lng: number } | null>(null);
    const [loading, setLoading] = useState(false);

    const getGPS = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
            const l = await Location.getCurrentPositionAsync({});
            setGPS({ lat: l.coords.latitude, lng: l.coords.longitude });
            Toast.show({ type: 'success', text1: 'GPS tagged', text2: `${l.coords.latitude.toFixed(4)}, ${l.coords.longitude.toFixed(4)}` });
        }
    };

    const submit = async () => {
        if (!desc.trim()) { Toast.show({ type: 'error', text1: 'Description required' }); return; }
        setLoading(true);
        try {
            const res = await api.post('/citizen/grievance', {
                citizen_nid: citizen?.nid || 'GUEST',
                citizen_name: citizen?.name || 'Citizen',
                ward_code: citizen?.ward_code || 'NPL-04-33-09',
                category: cat, description: desc,
                location_lat: gps?.lat || 0, location_lng: gps?.lng || 0,
                location_desc: loc,
            });
            if (res.data.success) {
                Toast.show({ type: 'success', text1: `Report submitted! ID: ${res.data.grievance_id}` });
                onClose();
            }
        } catch {
            Toast.show({ type: 'success', text1: 'Report submitted (demo)' });
            onClose();
        }
        setLoading(false);
    };

    return (
        <FeatureModal title={lang === 'ne' ? '📍 311 समस्या रिपोर्ट' : '📍 Report a Problem (311)'} onClose={onClose}>
            <Text style={mStyles.fieldLabel}>{lang === 'ne' ? 'समस्याको प्रकार' : 'Problem Category'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {CATS.map(c => (
                    <TouchableOpacity
                        key={c.id}
                        style={[mStyles.catChip, cat === c.id && mStyles.catChipActive]}
                        onPress={() => setCat(c.id)}
                    >
                        <MaterialIcons name={c.icon as any} size={14} color={cat === c.id ? '#fff' : Colors.primary} />
                        <Text style={[mStyles.catChipText, cat === c.id && { color: '#fff' }]}>
                            {lang === 'ne' ? c.labelNE : c.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            <Text style={mStyles.fieldLabel}>{lang === 'ne' ? 'विवरण' : 'Description'}</Text>
            <TextInput style={[mStyles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder={lang === 'ne' ? 'समस्याको विवरण...' : 'Describe the problem...'}
                placeholderTextColor={Colors.outline} value={desc} onChangeText={setDesc} multiline />
            <Text style={mStyles.fieldLabel}>{lang === 'ne' ? 'ठेगाना' : 'Location'}</Text>
            <TextInput style={mStyles.input} placeholder="Ward 9, Prithvi Path..."
                placeholderTextColor={Colors.outline} value={loc} onChangeText={setLoc} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity style={[mStyles.actionBtn, { flex: 1 }]} onPress={getGPS}>
                    <MaterialIcons name="my-location" size={16} color={Colors.primary} />
                    <Text style={mStyles.actionBtnText}>{gps ? '📍 Tagged' : 'GPS Tag'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[mStyles.actionBtn, { flex: 1 }]}>
                    <MaterialIcons name="photo-camera" size={16} color={Colors.primary} />
                    <Text style={mStyles.actionBtnText}>{lang === 'ne' ? 'फोटो' : 'Photo'}</Text>
                </TouchableOpacity>
            </View>
            <SubmitButton loading={loading} onPress={submit} label={lang === 'ne' ? 'रिपोर्ट पेश' : 'Submit Report'} />
        </FeatureModal>
    );
}

// ── BLOOD CONNECT ─────────────────────────────────────────────
function BloodModal({ onClose, lang }: any) {
    const GROUPS = ['All', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    const [selected, setSelected] = useState('All');
    const [donors, setDonors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get(`/blood/donors${selected !== 'All' ? `?group=${encodeURIComponent(selected)}` : ''}`);
                setDonors(res.data.donors || []);
            } catch {
                setDonors([
                    { name: 'Ram K.', blood_group: 'A+', ward_code: 'NPL-04-33-09', phone: '980000001', last_donated: '2024-04-10', is_available: true },
                    { name: 'Sita M.', blood_group: 'B+', ward_code: 'NPL-04-33-06', phone: '980000002', last_donated: '2024-03-15', is_available: true },
                ]);
            }
            setLoading(false);
        };
        load();
    }, [selected]);

    return (
        <FeatureModal title={lang === 'ne' ? '🩸 रक्त दान डाइरेक्टरी' : '🩸 Blood Donor Connect'} onClose={onClose}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {GROUPS.map(g => (
                    <TouchableOpacity
                        key={g}
                        style={[mStyles.catChip, selected === g && mStyles.catChipActive]}
                        onPress={() => setSelected(g)}
                    >
                        <Text style={[mStyles.catChipText, selected === g && { color: '#fff' }]}>{g}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            {loading ? <ActivityIndicator color={Colors.primary} /> : (
                donors.map((d, i) => (
                    <View key={i} style={mStyles.donorRow}>
                        <View style={mStyles.bloodBadge}>
                            <Text style={mStyles.bloodBadgeText}>{d.blood_group}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.primary }}>{d.name}</Text>
                            <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant }}>Ward {d.ward_code?.split('-')[3]} · Last donated: {d.last_donated}</Text>
                        </View>
                        <TouchableOpacity style={mStyles.contactBtn}>
                            <Text style={mStyles.contactBtnText}>Contact</Text>
                        </TouchableOpacity>
                    </View>
                ))
            )}
        </FeatureModal>
    );
}

// ── OFFICER FEEDBACK ──────────────────────────────────────────
function FeedbackModal({ onClose, citizen, lang }: any) {
    const [ratings, setRatings] = useState({ speed: 0, helpfulness: 0, transparency: 0 });
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [wardNo, setWardNo] = useState('09');
    const [officerId, setOfficerId] = useState('WO-09-01');

    const wardOfficers = useMemo(() => {
        const ward = String(wardNo).padStart(2, '0');
        const entry = WARD_OFFICER_ROSTER.find((item) => item.wardNo === ward);
        return entry?.officers || [];
    }, [wardNo, lang]);

    useEffect(() => {
        const ward = String(wardNo).padStart(2, '0');
        const firstOfficer = WARD_OFFICER_ROSTER.find((item) => item.wardNo === ward)?.officers?.[0];
        setOfficerId(firstOfficer?.id || `WO-${ward}-01`);
    }, [wardNo]);

    const Star = ({ field, val }: { field: keyof typeof ratings; val: number }) => (
        <TouchableOpacity onPress={() => setRatings(r => ({ ...r, [field]: val }))}>
            <MaterialIcons name="star" size={28} color={val <= ratings[field] ? '#EF9F27' : Colors.outlineVariant} />
        </TouchableOpacity>
    );

    const submit = async () => {
        if (ratings.speed === 0) { Toast.show({ type: 'error', text1: 'Please rate all categories' }); return; }
        setLoading(true);
        try {
            await api.post('/feedback', {
                citizen_nid: citizen?.nid || '',
                officer_id: officerId,
                ward_no: wardNo,
                speed_rating: ratings.speed,
                helpfulness: ratings.helpfulness,
                transparency: ratings.transparency,
                comment,
            });
            Toast.show({ type: 'success', text1: 'Feedback submitted! Thank you.' });
            onClose();
        } catch {
            Toast.show({ type: 'success', text1: 'Feedback recorded (demo)' });
            onClose();
        }
        setLoading(false);
    };

    const fields: { label: string; labelNE: string; field: keyof typeof ratings }[] = [
        { label: 'Speed of service', labelNE: 'सेवाको गति', field: 'speed' },
        { label: 'Helpfulness', labelNE: 'सहायकता', field: 'helpfulness' },
        { label: 'Transparency', labelNE: 'पारदर्शिता', field: 'transparency' },
    ];

    const selectedOfficer = wardOfficers.find((officer) => officer.id === officerId) || wardOfficers[0];

    return (
        <FeatureModal title={lang === 'ne' ? '⭐ अधिकारी मूल्यांकन' : '⭐ Rate Your Experience'} onClose={onClose}>
            <Text style={mStyles.fieldLabel}>{lang === 'ne' ? 'वडा नम्बर छान्नुहोस्' : 'Select Ward No.'}</Text>
            <View style={mStyles.selectBox}>
                <Picker
                    selectedValue={wardNo}
                    onValueChange={(value) => setWardNo(String(value))}
                    style={mStyles.picker}
                    dropdownIconColor={Colors.primary}
                >
                    {Array.from({ length: 33 }, (_, index) => String(index + 1).padStart(2, '0')).map((ward) => (
                        <Picker.Item key={ward} label={`${lang === 'ne' ? 'वडा' : 'Ward'} ${ward}`} value={ward} />
                    ))}
                </Picker>
            </View>

            <Text style={mStyles.fieldLabel}>{lang === 'ne' ? 'अधिकारी छान्नुहोस्' : 'Select Officer'}</Text>
            <View style={mStyles.selectBox}>
                <Picker
                    selectedValue={officerId}
                    onValueChange={(value) => setOfficerId(String(value))}
                    style={mStyles.picker}
                    dropdownIconColor={Colors.primary}
                >
                    {wardOfficers.map((officer) => (
                        <Picker.Item key={officer.id} label={`${officer.title} · ${officer.name}`} value={officer.id} />
                    ))}
                </Picker>
            </View>

            <View style={mStyles.officerCard}>
                <View style={mStyles.officerAvatar}><MaterialIcons name="person" size={20} color={Colors.primary} /></View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.primary }}>{selectedOfficer?.name}</Text>
                    <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant }}>
                        {lang === 'ne' ? 'वडा' : 'Ward'} {wardNo} · {selectedOfficer?.title} · {officerId}
                    </Text>
                </View>
            </View>

            {fields.map(f => (
                <View key={f.field} style={{ marginBottom: 12 }}>
                    <Text style={mStyles.fieldLabel}>{lang === 'ne' ? f.labelNE : f.label}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                        {[1, 2, 3, 4, 5].map(v => <Star key={v} field={f.field} val={v} />)}
                    </View>
                </View>
            ))}

            <Text style={mStyles.fieldLabel}>{lang === 'ne' ? 'टिप्पणी' : 'Comment (optional)'}</Text>
            <TextInput style={[mStyles.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder={lang === 'ne' ? 'तपाईंको अनुभव...' : 'Your experience...'}
                placeholderTextColor={Colors.outline} value={comment} onChangeText={setComment} multiline />
            <SubmitButton loading={loading} onPress={submit} label={lang === 'ne' ? 'फिडब्याक पेश' : 'Submit Feedback'} />
        </FeatureModal>
    );
}

// ── HEARING / VOTE ────────────────────────────────────────────
function HearingModal({ onClose, citizen, lang }: any) {
    const [hearings, setHearings] = useState<any[]>([]);
    const [voted, setVoted] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const ward = citizen?.ward_code || 'NPL-04-33-09';

    useEffect(() => {
        api.get(`/hearing/${ward}`)
            .then(r => setHearings(r.data.hearings || []))
            .catch(() => setHearings([{
                hearing_id: 'PH-2082-001',
                title: 'New Park at Phewa North Shoreline',
                title_ne: 'फेवा उत्तर किनारामा नयाँ पार्क',
                description: 'Proposed 2-hectare park. Budget: NPR 45 Lakh.',
                status: 'LIVE',
                votes_yes: 847, votes_no: 267, votes_abstain: 133,
            }]))
            .finally(() => setLoading(false));
    }, []);

    const vote = async (hearingId: string, v: string) => {
        try {
            await api.post('/hearing/vote', { hearing_id: hearingId, citizen_nid: citizen?.nid || 'GUEST', vote: v });
        } catch { }
        setVoted(prev => ({ ...prev, [hearingId]: v }));
        Toast.show({ type: 'success', text1: 'Vote recorded!', text2: lang === 'ne' ? 'मतदान गरियो' : 'Thank you for participating' });
    };

    return (
        <FeatureModal title={lang === 'ne' ? '🏛️ सार्वजनिक सुनुवाई' : '🏛️ Public Hearing'} onClose={onClose}>
            {loading ? <ActivityIndicator color={Colors.primary} /> : hearings.map(h => {
                const total = h.votes_yes + h.votes_no + h.votes_abstain || 1;
                const myVote = voted[h.hearing_id];
                return (
                    <View key={h.hearing_id} style={mStyles.hearingCard}>
                        <View style={mStyles.liveBadge}>
                            <View style={mStyles.liveDot} />
                            <Text style={mStyles.liveBadgeText}>{h.status === 'LIVE' ? 'LIVE' : 'SCHEDULED'}</Text>
                        </View>
                        <Text style={mStyles.hearingTitle}>{lang === 'ne' && h.title_ne ? h.title_ne : h.title}</Text>
                        <Text style={mStyles.hearingDesc}>{h.description}</Text>
                        {/* Vote bars */}
                        <View style={{ gap: 6, marginBottom: 12 }}>
                            {[
                                { label: lang === 'ne' ? 'सहमत' : 'Yes', count: h.votes_yes, color: '#2d7a52' },
                                { label: lang === 'ne' ? 'असहमत' : 'No', count: h.votes_no, color: '#c0392b' },
                                { label: lang === 'ne' ? 'तटस्थ' : 'Abstain', count: h.votes_abstain, color: '#b7791f' },
                            ].map(opt => (
                                <View key={opt.label}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                        <Text style={{ fontSize: 11, color: opt.color, fontWeight: '600' }}>{opt.label}</Text>
                                        <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant }}>{Math.round(opt.count / total * 100)}%</Text>
                                    </View>
                                    <View style={{ height: 5, backgroundColor: Colors.surfaceContainerHigh, borderRadius: 3 }}>
                                        <View style={{ height: 5, width: `${Math.round(opt.count / total * 100)}%` as any, backgroundColor: opt.color, borderRadius: 3 }} />
                                    </View>
                                </View>
                            ))}
                        </View>
                        {!myVote ? (
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity style={[mStyles.voteBtn, { borderColor: '#2d7a52' }]} onPress={() => vote(h.hearing_id, 'YES')}>
                                    <Text style={{ color: '#2d7a52', fontWeight: '700', fontSize: 12 }}>✓ {lang === 'ne' ? 'सहमत' : 'Yes'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[mStyles.voteBtn, { borderColor: '#c0392b' }]} onPress={() => vote(h.hearing_id, 'NO')}>
                                    <Text style={{ color: '#c0392b', fontWeight: '700', fontSize: 12 }}>✗ {lang === 'ne' ? 'असहमत' : 'No'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[mStyles.voteBtn, { borderColor: Colors.outline }]} onPress={() => vote(h.hearing_id, 'ABSTAIN')}>
                                    <Text style={{ color: Colors.outline, fontWeight: '600', fontSize: 12 }}>{lang === 'ne' ? 'तटस्थ' : 'Abstain'}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={mStyles.votedBadge}>
                                <MaterialIcons name="check-circle" size={14} color={Colors.success} />
                                <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '600' }}>
                                    {lang === 'ne' ? 'मत दिइयो' : `Voted: ${myVote}`}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            })}
        </FeatureModal>
    );
}

// ── KRISHI ANUDAN ─────────────────────────────────────────────
function KrishiModal({ onClose, citizen, lang }: any) {
    const [subsidyType, setSubsidyType] = useState('SEEDS');
    const [cropType, setCropType] = useState('RICE');
    const [landArea, setLandArea] = useState('2');
    const [loading, setLoading] = useState(false);

    const SUBSIDIES = [
        { id: 'SEEDS', label: 'बीउ (Seeds)', en: 'Seeds' },
        { id: 'FERTILIZER_CHEMICAL', label: 'रासायनिक मल', en: 'Chemical Fertilizer' },
        { id: 'FERTILIZER_ORGANIC', label: 'जैविक मल', en: 'Organic Fertilizer' },
        { id: 'MACHINERY', label: 'कृषि यन्त्र', en: 'Farm Machinery' },
        { id: 'IRRIGATION', label: 'सिँचाइ', en: 'Irrigation' },
    ];

    const submit = async () => {
        setLoading(true);
        try {
            const res = await api.post('/krishi/apply', {
                citizen_nid: citizen?.nid || '', subsidy_type: subsidyType,
                crop_type: cropType, land_area: parseFloat(landArea),
                ward_code: citizen?.ward_code || 'NPL-04-33-09',
            });
            Toast.show({ type: 'success', text1: `Application submitted! ID: ${res.data.application_id}` });
            onClose();
        } catch {
            Toast.show({ type: 'success', text1: 'Application KRS-2082-DEMO submitted' });
            onClose();
        }
        setLoading(false);
    };

    return (
        <FeatureModal title={lang === 'ne' ? '🌾 कृषि अनुदान आवेदन' : '🌾 Krishi Anudan Application'} onClose={onClose}>
            <Text style={mStyles.fieldLabel}>{lang === 'ne' ? 'अनुदानको प्रकार' : 'Subsidy Type'}</Text>
            {SUBSIDIES.map(s => (
                <TouchableOpacity key={s.id} style={[mStyles.radioRow, subsidyType === s.id && mStyles.radioRowActive]} onPress={() => setSubsidyType(s.id)}>
                    <View style={[mStyles.radioCircle, subsidyType === s.id && mStyles.radioCircleActive]} />
                    <Text style={{ fontSize: 13, color: Colors.primary }}>{lang === 'ne' ? s.label : s.en}</Text>
                </TouchableOpacity>
            ))}
            <Text style={mStyles.fieldLabel}>{lang === 'ne' ? 'जमिनको क्षेत्रफल (रोपनी)' : 'Land Area (Ropani)'}</Text>
            <TextInput style={mStyles.input} value={landArea} onChangeText={setLandArea} keyboardType="numeric" placeholderTextColor={Colors.outline} />
            <SubmitButton loading={loading} onPress={submit} label={lang === 'ne' ? 'आवेदन पेश गर्नुस्' : 'Submit Application'} />
        </FeatureModal>
    );
}

// ── DIGITAL SIGNATURE ─────────────────────────────────────────
function DigSigModal({ onClose, citizen, lang }: any) {
    const [signing, setSigning] = useState(false);
    const [signed, setSigned] = useState<any>(null);

    const sign = async () => {
        setSigning(true);
        try {
            const docHash = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            const res = await api.post('/sign', {
                citizen_nid: citizen?.nid || '',
                document_ref: 'SIFARIS-APPLICATION',
                document_hash: docHash,
            });
            if (res.data.success) setSigned(res.data);
        } catch {
            setSigned({ signature_id: 'SIG-2082-DEMO', signature_hash: 'a3f8c2d9e1b4f6a8...', signed_at: new Date() });
        }
        setSigning(false);
    };

    return (
        <FeatureModal title={lang === 'ne' ? '✍️ डिजिटल हस्ताक्षर' : '✍️ Digital Signature'} onClose={onClose}>
            <View style={mStyles.sigCard}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.primary, marginBottom: 4 }}>
                    {lang === 'ne' ? 'कागज' : 'Document'}
                </Text>
                <Text style={{ fontSize: 13, color: Colors.onSurface }}>Sifaris Application Form</Text>
                <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 }}>
                    {lang === 'ne' ? 'नागरिक NID:' : 'Citizen NID:'} {citizen?.nid || 'N/A'}
                </Text>
            </View>

            {!signed ? (
                <TouchableOpacity style={mStyles.fingerprintBtn} onPress={sign} disabled={signing}>
                    {signing ? <ActivityIndicator color={Colors.primary} /> : (
                        <>
                            <MaterialIcons name="fingerprint" size={48} color={Colors.primary} />
                            <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 8 }}>
                                {lang === 'ne' ? 'हस्ताक्षरका लागि थिच्नुस्' : 'Tap to apply biometric signature'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            ) : (
                <View style={mStyles.sigSuccess}>
                    <MaterialIcons name="check-circle" size={24} color={Colors.success} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.success, marginTop: 6 }}>
                        {lang === 'ne' ? 'हस्ताक्षर सफल!' : 'Signature Applied!'}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', color: Colors.onSurfaceVariant, marginTop: 4 }}>
                        ID: {signed.signature_id}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', color: Colors.onSurfaceVariant }}>
                        Hash: {signed.signature_hash}
                    </Text>
                </View>
            )}
        </FeatureModal>
    );
}

// ── BRIDDHA BHATTA ────────────────────────────────────────────
function BhattaModal({ onClose, citizen, lang }: any) {
    const schemes = [
        { name: 'Briddha Bhatta', nameNE: 'बृद्धभत्ता', amount: 4000, disbursed: '2082/06/01', next: '2082/07/01', status: 'ACTIVE' },
        { name: 'Single Mother', nameNE: 'एकल महिला सहायता', amount: 2000, disbursed: '2082/06/01', next: '2082/07/01', status: 'PENDING' },
    ];
    return (
        <FeatureModal title={lang === 'ne' ? '👴 सामाजिक सुरक्षा' : '👴 Social Security Tracker'} onClose={onClose}>
            {schemes.map((s, i) => (
                <View key={i} style={mStyles.bhattaCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>{lang === 'ne' ? s.nameNE : s.name}</Text>
                        <View style={[mStyles.statusPill, { backgroundColor: s.status === 'ACTIVE' ? Colors.successLight : '#fef9ee' }]}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: s.status === 'ACTIVE' ? Colors.success : '#b7791f' }}>{s.status}</Text>
                        </View>
                    </View>
                    {[
                        [lang === 'ne' ? 'मासिक रकम' : 'Monthly', `NPR ${s.amount.toLocaleString()}`],
                        [lang === 'ne' ? 'अन्तिम भुक्तानी' : 'Last disbursed', s.disbursed],
                        [lang === 'ne' ? 'अर्को भुक्तानी' : 'Next disbursal', s.next],
                    ].map(([k, v]) => (
                        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: Colors.outlineVariant }}>
                            <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>{k}</Text>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.primary }}>{v}</Text>
                        </View>
                    ))}
                </View>
            ))}
        </FeatureModal>
    );
}

// ── TOURISM ───────────────────────────────────────────────────
function TourismModal({ onClose, lang }: any) {
    const [type, setType] = useState('All');
    const TYPES = ['All', 'HOTEL', 'TRAIL', 'ADVENTURE', 'RESTAURANT'];
    const [listings, setListings] = useState<any[]>([]);

    useEffect(() => {
        api.get(`/tourism${type !== 'All' ? `?type=${type}` : ''}`)
            .then(r => setListings(r.data.listings || []))
            .catch(() => setListings([
                { name: 'Fishtail Lodge', listing_type: 'HOTEL', safety_rating: 'A', star_rating: 4.8, is_approved: true, tims_required: false },
                { name: 'Annapurna Base Camp', listing_type: 'TRAIL', safety_rating: 'A', star_rating: 4.7, is_approved: true, tims_required: true },
                { name: 'Paragliding Point', listing_type: 'ADVENTURE', safety_rating: 'A', star_rating: 4.6, is_approved: true, tims_required: false },
            ]));
    }, [type]);

    return (
        <FeatureModal title={lang === 'ne' ? '🏔️ पोखरा पर्यटन गाइड' : '🏔️ Pokhara Tourism Guide'} onClose={onClose}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {TYPES.map(t => (
                    <TouchableOpacity key={t} style={[mStyles.catChip, type === t && mStyles.catChipActive]} onPress={() => setType(t)}>
                        <Text style={[mStyles.catChipText, type === t && { color: '#fff' }]}>{t}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            {listings.map((l, i) => (
                <View key={i} style={mStyles.tourismCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>{l.name}</Text>
                        <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant }}>
                            {l.listing_type} · ⭐ {l.star_rating}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        {l.is_approved && (
                            <View style={mStyles.approvedBadge}>
                                <Text style={{ color: Colors.success, fontSize: 10, fontWeight: '700' }}>✓ Approved</Text>
                            </View>
                        )}
                        <Text style={{ fontSize: 10, color: Colors.onSurfaceVariant }}>Safety: {l.safety_rating}</Text>
                        {l.tims_required && <Text style={{ fontSize: 10, color: '#b7791f' }}>TIMS req.</Text>}
                    </View>
                </View>
            ))}
        </FeatureModal>
    );
}

// ── LOST & FOUND ──────────────────────────────────────────────
function LostFoundModal({ onClose, citizen, lang }: any) {
    const [tab, setTab] = useState<'browse' | 'report'>('browse');
    const [items, setItems] = useState<any[]>([]);
    const [desc, setDesc] = useState('');
    const [loc, setLoc] = useState('');
    const [rtype, setRtype] = useState('LOST');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/lost-found').then(r => setItems(r.data.items || [])).catch(() => setItems([
            { item_id: 'LF-001', type: 'FOUND', description: 'Citizenship Card (Blue Cover)', location: 'Lakeside Sector 6', reported_at: new Date() },
            { item_id: 'LF-002', type: 'LOST', description: 'Silver Keyring (3 keys)', location: 'Pokhara Bus Park', reported_at: new Date() },
        ]));
    }, []);

    const report = async () => {
        if (!desc.trim()) return;
        setLoading(true);
        try {
            const res = await api.post('/lost-found', {
                reporter_nid: citizen?.nid || '', report_type: rtype,
                item_desc: desc, location_desc: loc, ward_code: citizen?.ward_code || '',
                contact_phone: citizen?.phone || '',
            });
            Toast.show({ type: 'success', text1: `Report ${res.data.item_id} submitted!` });
            setTab('browse');
        } catch {
            Toast.show({ type: 'success', text1: 'Report submitted (demo)' });
            setTab('browse');
        }
        setLoading(false);
    };

    return (
        <FeatureModal title={lang === 'ne' ? '🔍 हराएको/भेटिएको' : '🔍 Lost & Found'} onClose={onClose}>
            <View style={mStyles.tabRow}>
                <TouchableOpacity style={[mStyles.tab, tab === 'browse' && mStyles.tabActive]} onPress={() => setTab('browse')}>
                    <Text style={[mStyles.tabText, tab === 'browse' && mStyles.tabTextActive]}>Browse Found</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[mStyles.tab, tab === 'report' && mStyles.tabActive]} onPress={() => setTab('report')}>
                    <Text style={[mStyles.tabText, tab === 'report' && mStyles.tabTextActive]}>Report</Text>
                </TouchableOpacity>
            </View>
            {tab === 'browse' ? (
                items.map((item, i) => (
                    <View key={i} style={mStyles.lfItem}>
                        <View style={[mStyles.lfBadge, { backgroundColor: item.type === 'FOUND' ? '#E6F1FB' : '#FFEDEA' }]}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: item.type === 'FOUND' ? '#0C447C' : '#A32D2D' }}>{item.type}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.primary }}>{item.description}</Text>
                            <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant }}>{item.location}</Text>
                        </View>
                    </View>
                ))
            ) : (
                <>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        {['LOST', 'FOUND'].map(r => (
                            <TouchableOpacity key={r} style={[mStyles.catChip, rtype === r && mStyles.catChipActive]} onPress={() => setRtype(r)}>
                                <Text style={[mStyles.catChipText, rtype === r && { color: '#fff' }]}>{r}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TextInput style={mStyles.input} placeholder="Item description..." placeholderTextColor={Colors.outline} value={desc} onChangeText={setDesc} />
                    <TextInput style={[mStyles.input, { marginTop: 8 }]} placeholder="Location..." placeholderTextColor={Colors.outline} value={loc} onChangeText={setLoc} />
                    <SubmitButton loading={loading} onPress={report} label="Submit Report" />
                </>
            )}
        </FeatureModal>
    );
}

// ── VOLUNTEER ─────────────────────────────────────────────────
function VolunteerModal({ onClose, citizen, lang }: any) {
    const SKILLS = [
        { id: 'CLEANUP', label: '🚿 Cleanup', labelNE: 'सफाइ' },
        { id: 'FIRST_AID', label: '🏥 First Aid', labelNE: 'प्राथमिक उपचार' },
        { id: 'PLANTING', label: '🌳 Tree Planting', labelNE: 'रूख रोप्ने' },
        { id: 'TECH', label: '📱 Tech Support', labelNE: 'प्राविधिक' },
        { id: 'DISASTER', label: '🚧 Disaster Mgmt', labelNE: 'विपद् व्यवस्थापन' },
    ];
    const [selected, setSelected] = useState<string[]>([]);
    const [availability, setAvailability] = useState('WEEKENDS');
    const [loading, setLoading] = useState(false);

    const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

    const register = async () => {
        if (selected.length === 0) { Toast.show({ type: 'error', text1: 'Select at least one skill' }); return; }
        setLoading(true);
        try {
            const res = await api.post('/volunteer/register', {
                citizen_nid: citizen?.nid || '', full_name: citizen?.name || 'Volunteer',
                phone: citizen?.phone || '', skills: selected,
                availability, ward_code: citizen?.ward_code || '',
            });
            Toast.show({ type: 'success', text1: `Registered! ID: ${res.data.volunteer_id}` });
            onClose();
        } catch {
            Toast.show({ type: 'success', text1: 'Registered as volunteer (demo)' });
            onClose();
        }
        setLoading(false);
    };

    return (
        <FeatureModal title={lang === 'ne' ? '🤝 स्वयंसेवक दर्ता' : '🤝 Volunteer Registry'} onClose={onClose}>
            <Text style={mStyles.fieldLabel}>{lang === 'ne' ? 'सीपहरू' : 'Your Skills'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {SKILLS.map(sk => (
                    <TouchableOpacity
                        key={sk.id}
                        style={[mStyles.catChip, selected.includes(sk.id) && mStyles.catChipActive]}
                        onPress={() => toggle(sk.id)}
                    >
                        <Text style={[mStyles.catChipText, selected.includes(sk.id) && { color: '#fff' }]}>
                            {lang === 'ne' ? sk.labelNE : sk.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            <Text style={mStyles.fieldLabel}>{lang === 'ne' ? 'उपलब्धता' : 'Availability'}</Text>
            {['WEEKENDS', 'WEEKDAYS', 'ANYTIME', 'EMERGENCY_ONLY'].map(a => (
                <TouchableOpacity key={a} style={[mStyles.radioRow, availability === a && mStyles.radioRowActive]} onPress={() => setAvailability(a)}>
                    <View style={[mStyles.radioCircle, availability === a && mStyles.radioCircleActive]} />
                    <Text style={{ fontSize: 13, color: Colors.primary }}>{a.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
            ))}
            <SubmitButton loading={loading} onPress={register} label={lang === 'ne' ? 'दर्ता गर्नुस्' : 'Join Volunteer Database'} />
        </FeatureModal>
    );
}

// ── TAX MODAL (simplified) ────────────────────────────────────
function TaxModal({ onClose, citizen, lang }: any) {
    const [method, setMethod] = useState('ESEWA');
    const [paying, setPaying] = useState(false);

    const pay = async () => {
        setPaying(true);
        try {
            const res = await api.post('/tax/pay', {
                citizen_nid: citizen?.nid || '', tax_record_id: 1,
                amount: 8500, payment_method: method,
            });
            Toast.show({ type: 'success', text1: `Payment done! ID: ${res.data.payment_id}` });
            onClose();
        } catch {
            Toast.show({ type: 'success', text1: 'Payment TXN-2082-DEMO processed (demo)' });
            onClose();
        }
        setPaying(false);
    };

    return (
        <FeatureModal title={lang === 'ne' ? '💳 कर तथा जरिमाना' : '💳 Tax & Fine Portal'} onClose={onClose}>
            <View style={mStyles.taxCard}>
                {[['Property (Malpot)', 'NPR 8,500'], ['Due Date', '2082/09/30'], ['Property ID', 'PKR-09-2024-04521']].map(([k, v]) => (
                    <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.outlineVariant }}>
                        <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>{k}</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.primary }}>{v}</Text>
                    </View>
                ))}
            </View>
            <Text style={mStyles.fieldLabel}>{lang === 'ne' ? 'भुक्तानी माध्यम' : 'Payment Method'}</Text>
            {['ESEWA', 'KHALTI', 'CONNECTIPS'].map(m => (
                <TouchableOpacity key={m} style={[mStyles.radioRow, method === m && mStyles.radioRowActive]} onPress={() => setMethod(m)}>
                    <View style={[mStyles.radioCircle, method === m && mStyles.radioCircleActive]} />
                    <Text style={{ fontSize: 13, color: Colors.primary }}>{m}</Text>
                </TouchableOpacity>
            ))}
            <SubmitButton loading={paying} onPress={pay} label={lang === 'ne' ? 'NPR 8,500 तिर्नुस्' : 'Pay NPR 8,500'} />
        </FeatureModal>
    );
}

// ── SHARED COMPONENTS ─────────────────────────────────────────
function FeatureModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <Modal animationType="slide" transparent onRequestClose={onClose}>
            <TouchableOpacity style={mStyles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity style={mStyles.sheet} activeOpacity={1} onPress={() => {}}>
                    <View style={mStyles.sheetHeader}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text numberOfLines={2} ellipsizeMode="tail" style={mStyles.sheetTitle}>{title}</Text>
                            <Text style={mStyles.sheetSub}>Tap outside or use the exit icon to close.</Text>
                        </View>
                        <TouchableOpacity style={mStyles.closeBtn} onPress={onClose}>
                            <MaterialIcons name="close" size={18} color={Colors.onSurfaceVariant} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled contentContainerStyle={mStyles.sheetBody}>
                        {children}
                    </ScrollView>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

function SubmitButton({ loading, onPress, label }: { loading: boolean; onPress: () => void; label: string }) {
    return (
        <TouchableOpacity style={[mStyles.submitBtn, loading && { opacity: 0.7 }]} onPress={onPress} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={mStyles.submitBtnText}>{label}</Text>}
        </TouchableOpacity>
    );
}

// ── STYLES ────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8faf9' },
    embeddedContainer: { flex: 1, backgroundColor: '#f8faf9' },
    header: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.outlineVariant },
    headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary },
    headerSub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
    scroll: { padding: 16, paddingBottom: 40 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    tile: {
        width: '48%',
        marginBottom: 12,
        borderRadius: 18,
        padding: 16,
        borderWidth: 0.5,
        borderColor: 'rgba(0,0,0,0.05)',
        minHeight: 104,
        justifyContent: 'space-between',
    },
    tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    tileLabel: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
});

const mStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'center', padding: 18 },
    sheet: { backgroundColor: '#fff', borderRadius: 28, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18, maxHeight: '88%', ...Shadow.lg },
    sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
    sheetTitle: { fontSize: 15, fontWeight: '800', color: Colors.primary, flex: 1, lineHeight: 20, marginBottom: 2 },
    sheetSub: { fontSize: 11, color: Colors.onSurfaceVariant, lineHeight: 16 },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
    sheetBody: { paddingBottom: 6 },
    fieldLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
    input: { backgroundColor: Colors.surfaceContainerLow, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.onSurface },
    catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineVariant, marginRight: 7 },
    catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    catChipText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
    submitBtn: { backgroundColor: Colors.primary, borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
    submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineVariant },
    actionBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
    radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: Colors.surfaceContainerLow, marginBottom: 6, borderWidth: 1, borderColor: Colors.outlineVariant },
    radioRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFixed },
    radioCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: Colors.outline },
    radioCircleActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
    bubble: { padding: 10, borderRadius: 14, marginBottom: 6, maxWidth: '85%' },
    user: { backgroundColor: Colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    bot: { backgroundColor: Colors.surfaceContainerLow, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
    bubbleText: { fontSize: 12, lineHeight: 18, color: Colors.onSurface },
    suggestion: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.primaryFixed, borderRadius: 999, marginRight: 7 },
    suggestionText: { fontSize: 11, fontWeight: '600', color: Colors.onPrimaryFixedVariant },
    inputRow: { flexDirection: 'row', gap: 8 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
    donorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.outlineVariant },
    bloodBadge: { backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    bloodBadgeText: { color: '#C62828', fontSize: 11, fontWeight: '800' },
    contactBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surfaceContainerLow, borderWidth: 0.5, borderColor: Colors.outlineVariant },
    contactBtnText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
    officerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surfaceContainerLow, borderRadius: 14, padding: 12, marginBottom: 14 },
    officerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
    selectBox: {
        backgroundColor: Colors.surfaceContainerLow,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.outlineVariant,
        overflow: 'hidden',
        marginBottom: 10,
    },
    picker: { width: '100%', color: Colors.onSurface },
    hearingCard: { backgroundColor: Colors.surfaceContainerLow, borderRadius: 16, padding: 14, marginBottom: 10 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
    liveBadgeText: { fontSize: 10, fontWeight: '800', color: '#15803d', letterSpacing: 1 },
    hearingTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
    hearingDesc: { fontSize: 12, color: Colors.onSurfaceVariant, marginBottom: 10 },
    voteBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
    votedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.successLight, padding: 10, borderRadius: 10 },
    bhattaCard: { backgroundColor: Colors.surfaceContainerLow, borderRadius: 16, padding: 14, marginBottom: 10 },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    tourismCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: Colors.surfaceContainerLow, borderRadius: 14, marginBottom: 8 },
    approvedBadge: { backgroundColor: Colors.successLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
    tabRow: { flexDirection: 'row', backgroundColor: Colors.surfaceContainerHigh, borderRadius: 10, padding: 3, marginBottom: 14 },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    tabActive: { backgroundColor: '#fff' },
    tabText: { fontSize: 12, color: Colors.onSurfaceVariant, fontWeight: '500' },
    tabTextActive: { color: Colors.primary, fontWeight: '700' },
    lfItem: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: Colors.surfaceContainerLow, borderRadius: 12, marginBottom: 8 },
    lfBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
    taxCard: { backgroundColor: Colors.surfaceContainerLow, borderRadius: 16, padding: 14, marginBottom: 14 },
    sigCard: { backgroundColor: Colors.primaryFixed, borderRadius: 14, padding: 14, marginBottom: 14 },
    fingerprintBtn: { alignItems: 'center', padding: 28, backgroundColor: Colors.surfaceContainerLow, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.outlineVariant, borderStyle: 'dashed', marginBottom: 14 },
    sigSuccess: { alignItems: 'center', backgroundColor: Colors.successLight, borderRadius: 14, padding: 16, marginBottom: 14 },
});