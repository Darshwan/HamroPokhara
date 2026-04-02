export interface PDFDocumentData {
  docType: string;
  docTypeLabel: string;
  nid: string;
  citizenName: string;
  wardCode: string;
  purpose: string;
  additionalInfo?: string;
  submittedAt?: string;
  requestId?: string;
}

/**
 * Format document data for display (used in preview modal)
 * This prepares structured data for rendering in the PDF preview
 */
export const formatDocumentForPreview = (data: PDFDocumentData) => {
  return {
    documentType: data.docTypeLabel,
    dateRequested: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    applicantName: data.citizenName,
    nid: data.nid,
    wardCode: data.wardCode,
    purpose: data.purpose,
    additionalInfo: data.additionalInfo,
    processingTime: '5-7 business days',
  };
};
