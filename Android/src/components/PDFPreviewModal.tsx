import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../constants/theme';
import { PDFDocumentData } from '../utils/pdfGenerator';

export interface PDFPreviewModalProps {
  visible: boolean;
  documentData: PDFDocumentData | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  visible,
  documentData,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    const updated = new Set(expandedSections);
    if (updated.has(section)) {
      updated.delete(section);
    } else {
      updated.add(section);
    }
    setExpandedSections(updated);
  };

  if (!documentData) return null;

  const docDescriptions: Record<string, string> = {
    SIFARIS: 'Recommendation Letter / सिफारिस',
    TAX_CLEARANCE: 'Tax Clearance Certificate / कर चुक्ता',
    BIRTH_CERTIFICATE: 'Birth Certificate / जन्मदर्ता',
    INCOME_PROOF: 'Income Proof Certificate / आय प्रमाण',
    RELATIONSHIP_CERT: 'Relationship Certificate / नाता प्रमाण',
    BUSINESS_REGISTRATION: 'Business Registration / व्यवसाय दर्ता',
  };

  const docDescription = docDescriptions[documentData.docType] || documentData.docTypeLabel;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity style={styles.modalContainer} activeOpacity={1}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerContent}>
              <MaterialIcons name="description" size={24} color={Colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.modalTitle}>Document Preview</Text>
                <Text style={styles.modalSubtitle}>{docDescription}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onCancel} disabled={isLoading}>
              <MaterialIcons name="close" size={24} color={Colors.outline} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.previewContent}>
            {/* Document Header Section */}
            <View style={styles.previewSection}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('header')}
              >
                <View style={styles.sectionHeaderLeft}>
                  <MaterialIcons name="info" size={18} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Document Type</Text>
                </View>
                <MaterialIcons
                  name={expandedSections.has('header') ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={Colors.outline}
                />
              </TouchableOpacity>

              {expandedSections.has('header') && (
                <View style={styles.sectionContent}>
                  <PreviewField label="Document Type" value={docDescription} />
                  <PreviewField
                    label="Request Date"
                    value={new Date().toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  />
                  {documentData.requestId && (
                    <PreviewField label="Request ID" value={documentData.requestId} isCode />
                  )}
                </View>
              )}
            </View>

            {/* Applicant Information */}
            <View style={styles.previewSection}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('applicant')}
              >
                <View style={styles.sectionHeaderLeft}>
                  <MaterialIcons name="person" size={18} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Applicant Information</Text>
                </View>
                <MaterialIcons
                  name={expandedSections.has('applicant') ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={Colors.outline}
                />
              </TouchableOpacity>

              {expandedSections.has('applicant') && (
                <View style={styles.sectionContent}>
                  <PreviewField label="Full Name" value={documentData.citizenName} />
                  <PreviewField label="National ID (NID)" value={documentData.nid} isCode />
                  <PreviewField label="Ward Code" value={documentData.wardCode} />
                </View>
              )}
            </View>

            {/* Request Details */}
            <View style={styles.previewSection}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('details')}
              >
                <View style={styles.sectionHeaderLeft}>
                  <MaterialIcons name="assignment" size={18} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Request Details</Text>
                </View>
                <MaterialIcons
                  name={expandedSections.has('details') ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={Colors.outline}
                />
              </TouchableOpacity>

              {expandedSections.has('details') && (
                <View style={styles.sectionContent}>
                  <PreviewField label="Purpose" value={documentData.purpose} isLarge />
                  {documentData.additionalInfo && (
                    <PreviewField
                      label="Additional Information"
                      value={documentData.additionalInfo}
                      isLarge
                    />
                  )}
                </View>
              )}
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <View style={styles.infoIconBox}>
                <MaterialIcons name="check-circle" size={20} color="#2e7d32" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>✓ Processing Information</Text>
                <Text style={styles.infoText}>
                  Your document request will be reviewed by the municipal office. Normal processing time is
                  5-7 business days. You can track the status from your dashboard.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <MaterialIcons name="close" size={18} color={Colors.primary} />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton, isLoading && styles.confirmButtonDisabled]}
              onPress={onConfirm}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="check" size={18} color="#fff" />
                  <Text style={styles.confirmButtonText}>Confirm & Submit</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

/**
 * Reusable field component for preview
 */
const PreviewField: React.FC<{
  label: string;
  value: string;
  isCode?: boolean;
  isLarge?: boolean;
}> = ({ label, value, isCode, isLarge }) => (
  <View style={[styles.previewField, isLarge && styles.previewFieldLarge]}>
    <Text style={styles.previewLabel}>{label}</Text>
    <Text style={[styles.previewValue, isCode && styles.previewValueCode]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: Colors.background,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.md,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.outline,
    marginTop: 2,
  },
  previewContent: {
    padding: 16,
    maxHeight: 400,
  },
  previewSection: {
    marginBottom: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurface,
    marginLeft: 10,
  },
  sectionContent: {
    padding: 14,
  },
  previewField: {
    marginBottom: 12,
  },
  previewFieldLarge: {
    minHeight: 50,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.outline,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.onSurface,
    lineHeight: 18,
  },
  previewValueCode: {
    fontFamily: 'monospace',
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(46, 125, 50, 0.08)',
    borderLeftWidth: 4,
    borderLeftColor: '#2e7d32',
    padding: 12,
    marginVertical: 12,
    borderRadius: Radius.md,
  },
  infoIconBox: {
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 11,
    color: '#555',
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
