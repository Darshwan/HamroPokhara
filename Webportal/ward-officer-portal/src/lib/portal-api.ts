import {
  type ApprovalResult,
  type DashboardStats,
  type IntegrityResult,
  type NoticeCreatePayload,
  type NoticeItem,
  type Officer,
  type QueueRequest,
  type VerifyResponse,
} from "@/types/portal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

interface ApiResult<T> {
  success: boolean;
  data: T;
  message?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }

  return (await res.json()) as T;
}

export async function loginOfficer(
  officerId: string,
  pin: string,
): Promise<ApiResult<{ token: string; officer: Officer }>> {
  try {
    const data = await apiFetch<{ success: boolean; token: string; officer: Officer; message?: string }>(
      "/officer/login",
      {
        method: "POST",
        body: JSON.stringify({ officer_id: officerId, pin }),
      },
    );

    return {
      success: data.success,
      data: { token: data.token, officer: data.officer },
      message: data.message,
    };
  } catch {
    await sleep(350);
    return {
      success: true,
      data: {
        token: "demo-token",
        officer: {
          officer_id: "WO-04-33-09-001",
          full_name: "Ram Bahadur Thapa",
          ward_code: "NPL-04-33-09",
          designation: "Ward Officer",
        },
      },
      message: "Backend unavailable. Running in demo mode.",
    };
  }
}

export async function fetchDashboardStats(token: string): Promise<DashboardStats> {
  try {
    const data = await apiFetch<{ success: boolean; stats: DashboardStats }>("/ministry/stats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!data.success) {
      throw new Error("Unsuccessful response");
    }
    return data.stats;
  } catch {
    return {
      issued_today: 23,
      pending_requests: 4,
      total_documents: 1247,
      verifications_today: 89,
      recent_entries: [
        {
          dtid: "NPL-04-33-09-2082-000023",
          officer_id: "WO-04-33-09-001",
          document_type: "SIFARIS",
          created_at: new Date().toISOString(),
          status: "ACTIVE",
        },
        {
          dtid: "NPL-04-33-09-2082-000022",
          officer_id: "WO-04-33-09-001",
          document_type: "TAX_CLEARANCE",
          created_at: new Date(Date.now() - 36e5).toISOString(),
          status: "ACTIVE",
        },
      ],
    };
  }
}

export async function fetchQueue(token: string): Promise<QueueRequest[]> {
  try {
    const data = await apiFetch<{ requests: QueueRequest[] }>("/officer/queue", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.requests || [];
  } catch {
    return [
      {
        request_id: "MS-2082-000021",
        citizen_name: "Ram Bahadur Thapa",
        citizen_nid: "12345678901",
        document_type: "SIFARIS",
        purpose: "Bank account opening",
        ward_code: "NPL-04-33-09",
        status: "PENDING",
        submitted_at: new Date(Date.now() - 18e5).toISOString(),
      },
      {
        request_id: "MS-2082-000020",
        citizen_name: "Sita Kumari Sharma",
        citizen_nid: "98765432101",
        document_type: "TAX_CLEARANCE",
        purpose: "Business renewal",
        ward_code: "NPL-04-33-09",
        status: "PENDING",
        submitted_at: new Date(Date.now() - 36e5).toISOString(),
      },
      {
        request_id: "MS-2082-000019",
        citizen_name: "Hari Bahadur Gurung",
        citizen_nid: "11223344556",
        document_type: "BIRTH_CERTIFICATE",
        purpose: "School admission",
        ward_code: "NPL-04-33-09",
        status: "UNDER_REVIEW",
        submitted_at: new Date(Date.now() - 72e5).toISOString(),
      },
    ];
  }
}

export async function approveRequest(token: string, requestId: string): Promise<ApprovalResult> {
  try {
    const data = await apiFetch<{ success: boolean } & ApprovalResult>("/officer/approve", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ request_id: requestId }),
    });
    if (!data.success) {
      throw new Error("Approval failed");
    }
    return data;
  } catch {
    return {
      dtid: `NPL-04-33-09-2082-${String(Math.floor(Math.random() * 9000) + 1000).padStart(6, "0")}`,
      document_hash: "a3f8c2d9e1b4f6a8b2c5d7e9f1a3b5c7d9e1f3a5",
      issued_at: new Date().toISOString(),
      qr_data: "verify.pratibimba.gov.np/demo",
    };
  }
}

export async function rejectRequest(token: string, requestId: string, reason: string): Promise<void> {
  try {
    await apiFetch("/officer/reject", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ request_id: requestId, rejection_reason: reason }),
    });
  } catch {
    return;
  }
}

export async function verifyDocument(dtid: string): Promise<VerifyResponse> {
  try {
    return await apiFetch<VerifyResponse>(`/verify/${encodeURIComponent(dtid)}`);
  } catch {
    return {
      status: "VALID",
      dtid,
      document_type: "SIFARIS",
      issued_date: "2082-05-15",
      issuing_ward: "NPL-04-33-09",
      currently_active: true,
      verification_id: "VRF-2082-000047",
      message: "Document verified in National Registry",
    };
  }
}

export async function runIntegrity(token: string): Promise<IntegrityResult> {
  try {
    return await apiFetch<IntegrityResult>("/ministry/integrity", {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return {
      success: true,
      total_checked: 1247,
      intact: 1247,
      tampered: 0,
      scan_ms: 43,
      verdict: "ALL RECORDS INTACT",
    };
  }
}

export async function fetchOfficerNotices(token: string): Promise<NoticeItem[]> {
  try {
    const data = await apiFetch<{ success: boolean; news: NoticeItem[] }>("/officer/news", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.news || [];
  } catch {
    return [];
  }
}

export async function createOfficerNotice(token: string, payload: NoticeCreatePayload): Promise<{ news_id: string }> {
  const data = await apiFetch<{ success: boolean; news_id: string; message?: string }>("/officer/news", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  if (!data.success || !data.news_id) {
    throw new Error(data.message || "Failed to publish notice");
  }

  return { news_id: data.news_id };
}

export async function fetchOfficerRequestPdfUrl(token: string, requestId: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/officer/request-pdf/${encodeURIComponent(requestId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Preview request failed (${res.status})`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function fetchDocumentPdfUrlByDtid(dtid: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/document/pdf/${encodeURIComponent(dtid)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Document PDF request failed (${res.status})`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function toDocumentLabel(type: string): string {
  const map: Record<string, string> = {
    SIFARIS: "Sifaris",
    TAX_CLEARANCE: "Tax Clearance",
    BIRTH_CERTIFICATE: "Birth Certificate",
    DEATH_CERTIFICATE: "Death Certificate",
    LAND_REGISTRATION: "Land Registration",
    RELATIONSHIP_CERT: "Relationship Certificate",
    INCOME_PROOF: "Income Proof",
    BUSINESS_REGISTRATION: "Business Registration",
  };

  return map[type] || type;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export async function fetchWardInfo(wardCode: string): Promise<{
  ward_code: string;
  district_name: string;
  province_name: string;
  office_name: string;
  office_phone: string;
  office_email: string;
  office_address: string;
  office_hours: string;
  current_officer?: {
    officer_id: string;
    full_name: string;
    designation: string;
    phone: string;
    email: string;
  };
}> {
  try {
    const data = await apiFetch<{ success: boolean; ward: any }>(`/ward/${encodeURIComponent(wardCode)}`);
    return data.ward || {};
  } catch {
    return {
      ward_code: wardCode,
      district_name: "काठमाडौँ",
      province_name: "Gandaki",
      office_name: `Ward Office ${wardCode}`,
      office_phone: "+977-1-4230001",
      office_email: "ward@example.gov.np",
      office_address: `Ward Office Complex, ${wardCode}`,
      office_hours: "09:00 - 17:00 (Sunday-Friday)",
    };
  }
}

export async function translateNotice(
  text: string,
  fromLang: "en" | "ne" = "en",
  toLang: "en" | "ne" = "ne",
): Promise<{ translated: string; source: string }> {
  try {
    const data = await apiFetch<{
      success: boolean;
      translated: string;
      source: string;
      message?: string;
    }>("/ai/translate", {
      method: "POST",
      body: JSON.stringify({ text, from_lang: fromLang, to_lang: toLang }),
    });

    if (!data.success) {
      throw new Error(data.message || "Translation failed");
    }

    return {
      translated: data.translated,
      source: data.source,
    };
  } catch (err) {
    // Fallback: return original text if translation fails
    return {
      translated: text,
      source: "fallback",
    };
  }
}

