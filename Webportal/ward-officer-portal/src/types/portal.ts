export type NavPage = "dashboard" | "queue" | "verify" | "integrity";

export interface Officer {
  officer_id: string;
  full_name: string;
  ward_code: string;
  designation: string;
  district_code?: number;
  province_code?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface DashboardStats {
  issued_today: number;
  pending_requests: number;
  total_documents: number;
  verifications_today: number;
  recent_entries: RecentEntry[];
}

export interface RecentEntry {
  dtid: string;
  officer_id: string;
  document_type: string;
  created_at: string;
  status: string;
}

export interface QueueRequest {
  request_id: string;
  citizen_name: string;
  citizen_nid: string;
  document_type: string;
  purpose: string;
  ward_code: string;
  status: "PENDING" | "UNDER_REVIEW";
  submitted_at: string;
}

export interface ApprovalResult {
  dtid: string;
  document_hash: string;
  issued_at: string;
  qr_data: string;
}

export interface VerifyResponse {
  status: "VALID" | "INVALID" | "TAMPERED";
  dtid: string;
  document_type?: string;
  issued_date?: string;
  issuing_ward?: string;
  currently_active?: boolean;
  verification_id?: string;
  message: string;
}

export interface IntegrityResult {
  success: boolean;
  total_checked: number;
  intact: number;
  tampered: number;
  scan_ms: number;
  verdict: string;
}
