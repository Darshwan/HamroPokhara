import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Radius, Shadow } from '../constants/theme';
import { useStore } from '../store/useStore';
import { citizenAPI, documentAPI, API_BASE } from '../api/client';
import * as Linking from 'expo-linking';
import AppHeader from '../components/AppHeader';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  PENDING:      { color: '#b7791f', bg: '#fef9ee', icon: 'schedule',      label: 'Pending Review' },
  UNDER_REVIEW: { color: '#1d4ed8', bg: '#eff6ff', icon: 'rate-review',   label: 'Under Review'   },
  APPROVED:     { color: '#2d7a52', bg: '#d9f2e3', icon: 'check-circle',  label: 'Ready!'         },
  REJECTED:     { color: '#c0392b', bg: '#fdf0ef', icon: 'cancel',        label: 'Rejected'       },
  NOT_FOUND:    { color: '#6b7280', bg: '#f3f4f6', icon: 'help-outline',  label: 'Not Found'      },
};

export default function TrackScreen() {
  const { myRequests, updateRequest } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // Refresh all request statuses from server
  const refreshStatuses = async () => {
    for (const req of myRequests) {
      if (req.status === 'PENDING' || req.status === 'UNDER_REVIEW') {
        try {
          const res = await citizenAPI.getRequestStatus(req.request_id);
          if (res.success) {
            await updateRequest(req.request_id, {
              status:  res.status,
              dtid:    res.dtid,
              qr_data: res.qr_data,
            });
          } else if (res.status === 404) {
            // Legacy/local request IDs from older app versions should not be polled forever.
            await updateRequest(req.request_id, {
              status: 'NOT_FOUND',
            });
          }
        } catch (e) { /* offline — keep local status */ }
      }
    }
  };

  // Auto-refresh when screen comes into focus
  useFocusEffect(useCallback(() => {
    refreshStatuses();
  }, [myRequests.length]));

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshStatuses();
    setRefreshing(false);
  };

  const downloadPDF = async (dtid: string) => {
    const url = documentAPI.getPDFUrl(dtid);
    await Linking.openURL(url);
  };

  if (myRequests.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title="Track Requests" showMenu={false} showLang />
        <View style={styles.empty}>
          <MaterialIcons name="inbox" size={48} color={Colors.outline} style={{ opacity: 0.4 }} />
          <Text style={styles.emptyTitle}>No Requests Yet</Text>
          <Text style={styles.emptySub}>Submit a document request to start tracking it here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Track Requests" showMenu={false} showLang />
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {myRequests.map((req) => {
          const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;
          return (
            <View key={req.request_id} style={styles.card}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardId}>{req.request_id}</Text>
                  <Text style={styles.cardType}>{req.document_type.replace(/_/g, ' ')}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                  <MaterialIcons name={cfg.icon as any} size={14} color={cfg.color} />
                  <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>

              {/* Purpose */}
              <Text style={styles.purpose}>{req.purpose}</Text>

              {/* Progress Steps */}
              <View style={styles.steps}>
                {['Submitted', 'Review', 'Ready'].map((step, i) => {
                  const stepStatus = req.status;
                  const active =
                    (i === 0) ||
                    (i === 1 && (stepStatus === 'UNDER_REVIEW' || stepStatus === 'APPROVED')) ||
                    (i === 2 && stepStatus === 'APPROVED');
                  return (
                    <React.Fragment key={step}>
                      <View style={styles.step}>
                        <View style={[styles.stepDot, active && styles.stepDotActive]}>
                          {active && <View style={styles.stepDotInner} />}
                        </View>
                        <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{step}</Text>
                      </View>
                      {i < 2 && (
                        <View style={[styles.stepLine, active && i < 1 && styles.stepLineActive]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>

              {/* Submitted date */}
              <Text style={styles.submittedDate}>
                Submitted: {new Date(req.submitted_at).toLocaleDateString()}
              </Text>

              {/* APPROVED — show DTID + download */}
              {req.status === 'APPROVED' && req.dtid && (
                <View style={styles.approvedBox}>
                  <View style={styles.dtidRow}>
                    <MaterialIcons name="verified" size={16} color={Colors.success} />
                    <Text style={styles.dtidLabel}>DTID</Text>
                    <Text style={styles.dtidValue}>{req.dtid}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    onPress={() => downloadPDF(req.dtid!)}
                  >
                    <MaterialIcons name="download" size={18} color="#fff" />
                    <Text style={styles.downloadText}>Download PDF</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* REJECTED — show reason */}
              {req.status === 'REJECTED' && (
                <View style={styles.rejectedBox}>
                  <Text style={styles.rejectedTitle}>Rejection Reason:</Text>
                  <Text style={styles.rejectedReason}>
                    Please check your documents and resubmit.
                  </Text>
                </View>
              )}

              {/* NOT_FOUND — usually stale local request IDs from old app versions */}
              {req.status === 'NOT_FOUND' && (
                <View style={styles.rejectedBox}>
                  <Text style={styles.rejectedTitle}>Request Not Found:</Text>
                  <Text style={styles.rejectedReason}>
                    This request ID is not available on the server. It may be a legacy local record.
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.background },
  empty:            { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle:       { fontSize: 18, fontWeight: '700', color: Colors.primary, marginTop: 16 },
  emptySub:         { fontSize: 13, color: Colors.onSurfaceVariant, textAlign: 'center', marginTop: 8 },
  list:             { padding: 16, gap: 14, paddingBottom: 40 },
  card:             { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.xl, padding: 18, ...Shadow.sm },
  cardHeader:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  cardId:           { fontSize: 12, fontWeight: '700', color: Colors.primary, fontFamily: 'monospace' },
  cardType:         { fontSize: 14, fontWeight: '600', color: Colors.onSurface, marginTop: 2 },
  statusBadge:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  statusText:       { fontSize: 11, fontWeight: '700' },
  purpose:          { fontSize: 13, color: Colors.onSurfaceVariant, marginBottom: 16 },
  steps:            { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  step:             { alignItems: 'center', gap: 4 },
  stepDot:          { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  stepDotActive:    { backgroundColor: Colors.primary },
  stepDotInner:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  stepLine:         { flex: 1, height: 2, backgroundColor: Colors.outlineVariant, marginBottom: 16 },
  stepLineActive:   { backgroundColor: Colors.primary },
  stepLabel:        { fontSize: 10, color: Colors.outline, fontWeight: '600' },
  stepLabelActive:  { color: Colors.primary },
  submittedDate:    { fontSize: 11, color: Colors.outline },
  approvedBox:      { backgroundColor: Colors.successLight, borderRadius: Radius.lg, padding: 14, marginTop: 12, borderWidth: 1, borderColor: 'rgba(45,122,82,0.2)' },
  dtidRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dtidLabel:        { fontSize: 11, fontWeight: '700', color: Colors.success },
  dtidValue:        { fontSize: 11, color: Colors.success, fontFamily: 'monospace', flex: 1 },
  downloadBtn:      { backgroundColor: Colors.success, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: Radius.lg },
  downloadText:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  rejectedBox:      { backgroundColor: '#fdf0ef', borderRadius: Radius.lg, padding: 14, marginTop: 12, borderWidth: 1, borderColor: 'rgba(192,57,43,0.2)' },
  rejectedTitle:    { fontSize: 12, fontWeight: '700', color: Colors.secondary, marginBottom: 4 },
  rejectedReason:   { fontSize: 12, color: Colors.onSurfaceVariant },
});