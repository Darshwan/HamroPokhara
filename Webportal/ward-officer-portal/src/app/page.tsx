"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveRequest,
  createOfficerNotice,
  fetchDocumentPdfUrlByDtid,
  fetchDashboardStats,
  fetchOfficerNotices,
  fetchOfficerRequestPdfUrl,
  fetchQueue,
  loginOfficer,
  rejectRequest,
  relativeTime,
  runIntegrity,
  toDocumentLabel,
  verifyDocument,
} from "@/lib/portal-api";
import type {
  DashboardStats,
  IntegrityResult,
  NavPage,
  NoticeItem,
  Officer,
  QueueRequest,
  VerifyResponse,
} from "@/types/portal";

const emptyStats: DashboardStats = {
  issued_today: 0,
  pending_requests: 0,
  total_documents: 0,
  verifications_today: 0,
  recent_entries: [],
};

const nav: Array<{ key: NavPage }> = [
  { key: "dashboard" },
  { key: "queue" },
  { key: "notices" },
  { key: "verify" },
  { key: "integrity" },
];

const noticeCategories = ["GENERAL", "URGENT", "INFRASTRUCTURE", "HEALTH", "WATER", "ELECTRICITY", "ROAD", "CULTURE", "TOURISM"] as const;

const copy = {
  en: {
    nav: {
      dashboard: "Dashboard",
      queue: "Request Queue",
      notices: "Notices",
      verify: "Verify",
      integrity: "Integrity",
    },
    topTitle: "Digital Governance Desk",
    topSub: "Connected to ward services and national traceability.",
    refresh: "Refresh",
    loginTitle: "Pratibimba Portal",
    loginSub: "Sign in to access digital governance tools for citizen services.",
    officerId: "Officer ID",
    pin: "PIN",
    login: "Login",
    signingIn: "Signing in...",
    logout: "Logout",
    noticesTitle: "Publish Ward Notice",
    noticesSub: "Published notices are visible in the Android app through citizen notices feed.",
    publish: "Publish Notice",
    publishing: "Publishing...",
    recentNotices: "Recent Published Notices",
    recentNoticesSub: "Latest notices visible to ward citizens in app.",
    noNotices: "No notices published yet.",
  },
  np: {
    nav: {
      dashboard: "ड्यासबोर्ड",
      queue: "अनुरोध सूची",
      notices: "सूचना",
      verify: "प्रमाणीकरण",
      integrity: "अखण्डता जाँच",
    },
    topTitle: "डिजिटल सेवा डेस्क",
    topSub: "वडा सेवा र राष्ट्रिय ट्रेसबिलिटीसँग जोडिएको।",
    refresh: "रिफ्रेस",
    loginTitle: "प्रतीबिम्ब पोर्टल",
    loginSub: "नागरिक सेवाका लागि डिजिटल शासन उपकरणमा पहुँच गर्न लगइन गर्नुहोस्।",
    officerId: "अधिकृत आईडी",
    pin: "पिन",
    login: "लगइन",
    signingIn: "लगइन हुँदै...",
    logout: "लगआउट",
    noticesTitle: "वडा सूचना प्रकाशित गर्नुहोस्",
    noticesSub: "प्रकाशित सूचना नागरिकको Android एपको notices feed मा देखिन्छ।",
    publish: "सूचना प्रकाशित गर्नुहोस्",
    publishing: "प्रकाशित हुँदै...",
    recentNotices: "हालै प्रकाशित सूचना",
    recentNoticesSub: "एपमा देखिने ताजा वडा सूचना।",
    noNotices: "अहिलेसम्म कुनै सूचना प्रकाशित गरिएको छैन।",
  },
} as const;

export default function Home() {
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("pratibimba_token") || "";
  });
  const [officer, setOfficer] = useState<Officer | null>(() => {
    if (typeof window === "undefined") return null;
    const savedOfficer = localStorage.getItem("pratibimba_officer");
    if (!savedOfficer) return null;
    return JSON.parse(savedOfficer) as Officer;
  });
  const [page, setPage] = useState<NavPage>("dashboard");
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [queue, setQueue] = useState<QueueRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<QueueRequest | null>(null);
  const [filter, setFilter] = useState<"all" | "PENDING" | "UNDER_REVIEW">("all");
  const [query, setQuery] = useState("");
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [lang, setLang] = useState<"en" | "np">("en");
  const [nepaliTime, setNepaliTime] = useState("");
  const text = copy[lang];
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    title_ne: "",
    body: "",
    body_ne: "",
    category: "GENERAL",
    priority: 0,
    image_url: "",
    expires_in_days: 0,
  });
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewReadyForRequest, setPreviewReadyForRequest] = useState<string | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [recentPdfUrl, setRecentPdfUrl] = useState<string | null>(null);
  const [recentPdfLoading, setRecentPdfLoading] = useState(false);
  const [recentPdfDtid, setRecentPdfDtid] = useState<string | null>(null);
  const [recentPdfFullscreen, setRecentPdfFullscreen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setNepaliTime(timeStr);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
    };
  }, [previewPdfUrl]);

  useEffect(() => {
    return () => {
      if (recentPdfUrl) {
        URL.revokeObjectURL(recentPdfUrl);
      }
    };
  }, [recentPdfUrl]);

  useEffect(() => {
    setPreviewPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewReadyForRequest(null);
    setReviewConfirmed(false);
  }, [selectedRequest?.request_id]);

  const visibleQueue = useMemo(() => {
    const byFilter = filter === "all" ? queue : queue.filter((item) => item.status === filter);
    if (!query.trim()) return byFilter;
    const q = query.trim().toLowerCase();
    return byFilter.filter((item) => {
      return (
        item.citizen_name.toLowerCase().includes(q) ||
        item.citizen_nid.includes(q) ||
        item.request_id.toLowerCase().includes(q)
      );
    });
  }, [queue, filter, query]);

  const refreshData = useCallback(async (authToken: string) => {
    const [statsResult, queueResult, noticesResult] = await Promise.all([
      fetchDashboardStats(authToken),
      fetchQueue(authToken),
      fetchOfficerNotices(authToken),
    ]);
    setStats(statsResult);
    setQueue(queueResult);
    setNotices(noticesResult);
    if (selectedRequest) {
      const found = queueResult.find((item) => item.request_id === selectedRequest.request_id) || null;
      setSelectedRequest(found);
    }
  }, [selectedRequest]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      void refreshData(token);
    }, 0);
    return () => clearTimeout(t);
  }, [token, refreshData]);

  async function handleLogin(formData: FormData) {
    const officerId = String(formData.get("officerId") || "").trim();
    const pin = String(formData.get("pin") || "").trim();
    if (!officerId || !pin) {
      setToast(lang === "np" ? "अधिकृत आईडी र पिन आवश्यक छ।" : "Officer ID and PIN are required.");
      return;
    }

    setLoading(true);
    const result = await loginOfficer(officerId, pin);
    setLoading(false);

    if (!result.success) {
      setToast(result.message || (lang === "np" ? "लगइन असफल भयो।" : "Login failed."));
      return;
    }

    localStorage.setItem("pratibimba_token", result.data.token);
    localStorage.setItem("pratibimba_officer", JSON.stringify(result.data.officer));
    setToken(result.data.token);
    setOfficer(result.data.officer);
    setToast(result.message || (lang === "np" ? "लगइन सफल भयो।" : "Login successful."));
  }

  async function handleApprove() {
    if (!selectedRequest || !token) return;
    if (previewReadyForRequest !== selectedRequest.request_id || !reviewConfirmed) {
      setToast(lang === "np" ? "निर्णय अघि PDF समीक्षा पुष्टि आवश्यक छ।" : "You must review and confirm the PDF before decision.");
      return;
    }
    setLoading(true);
    const approval = await approveRequest(token, selectedRequest.request_id);
    setLoading(false);
    setToast(`Issued ${approval.dtid}`);
    const next = queue.filter((item) => item.request_id !== selectedRequest.request_id);
    setQueue(next);
    setSelectedRequest(null);
    setStats((prev) => ({
      ...prev,
      issued_today: prev.issued_today + 1,
      pending_requests: Math.max(prev.pending_requests - 1, 0),
    }));
  }

  async function handleReject() {
    if (!selectedRequest || !token || !rejectReason.trim()) return;
    if (previewReadyForRequest !== selectedRequest.request_id || !reviewConfirmed) {
      setToast(lang === "np" ? "निर्णय अघि PDF समीक्षा पुष्टि आवश्यक छ।" : "You must review and confirm the PDF before decision.");
      return;
    }
    setLoading(true);
    await rejectRequest(token, selectedRequest.request_id, rejectReason.trim());
    setLoading(false);
    setToast("Request rejected.");
    setQueue((prev) => prev.filter((item) => item.request_id !== selectedRequest.request_id));
    setSelectedRequest(null);
    setRejectReason("");
  }

  async function handleVerify() {
    if (!verifyInput.trim()) {
      setToast("Enter a DTID first.");
      return;
    }
    setLoading(true);
    const result = await verifyDocument(verifyInput.trim());
    setLoading(false);
    setVerifyResult(result);
  }

  async function handleIntegrity() {
    if (!token) return;
    setLoading(true);
    const result = await runIntegrity(token);
    setLoading(false);
    setIntegrityResult(result);
  }

  async function handlePublishNotice() {
    if (!token) return;
    if (!noticeForm.title.trim() || !noticeForm.body.trim()) {
      setToast(lang === "np" ? "शीर्षक र सामग्री आवश्यक छ।" : "Title and content are required.");
      return;
    }

    setLoading(true);
    try {
      const result = await createOfficerNotice(token, {
        title: noticeForm.title.trim(),
        title_ne: noticeForm.title_ne.trim() || undefined,
        body: noticeForm.body.trim(),
        body_ne: noticeForm.body_ne.trim() || undefined,
        category: noticeForm.category,
        priority: noticeForm.priority,
        image_url: noticeForm.image_url.trim() || undefined,
        expires_in_days: noticeForm.expires_in_days > 0 ? noticeForm.expires_in_days : undefined,
      });
      setToast(lang === "np" ? `सूचना प्रकाशित भयो: ${result.news_id}` : `Notice published: ${result.news_id}`);
      setNoticeForm({
        title: "",
        title_ne: "",
        body: "",
        body_ne: "",
        category: "GENERAL",
        priority: 0,
        image_url: "",
        expires_in_days: 0,
      });
      await refreshData(token);
    } catch {
      setToast(lang === "np" ? "सूचना प्रकाशित गर्न सकिएन। फेरि प्रयास गर्नुहोस्।" : "Failed to publish notice. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadRequestPreview() {
    if (!token || !selectedRequest) return;
    setPreviewLoading(true);
    try {
      const nextUrl = await fetchOfficerRequestPdfUrl(token, selectedRequest.request_id);
      setPreviewPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setPreviewReadyForRequest(selectedRequest.request_id);
      setReviewConfirmed(false);
      setToast(lang === "np" ? "PDF प्रिभ्यु तयार भयो। समीक्षा गर्नुहोस्।" : "PDF preview ready. Please review before decision.");
    } catch {
      setToast(lang === "np" ? "PDF प्रिभ्यु लोड गर्न सकिएन।" : "Failed to load request PDF preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleViewRecentPdf(dtid: string) {
    setRecentPdfLoading(true);
    try {
      const nextUrl = await fetchDocumentPdfUrlByDtid(dtid);
      setRecentPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setRecentPdfDtid(dtid);
      setToast(lang === "np" ? "कागजात PDF लोड भयो।" : "Document PDF loaded.");
    } catch {
      setToast(lang === "np" ? "कागजात PDF लोड गर्न सकिएन।" : "Failed to load document PDF.");
    } finally {
      setRecentPdfLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("pratibimba_token");
    localStorage.removeItem("pratibimba_officer");
    setOfficer(null);
    setToken("");
    setQueue([]);
    setNotices([]);
    setPreviewPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewReadyForRequest(null);
    setReviewConfirmed(false);
    setRecentPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRecentPdfDtid(null);
    setRecentPdfFullscreen(false);
    setSelectedRequest(null);
    setStats(emptyStats);
    setVerifyResult(null);
    setIntegrityResult(null);
    setPage("dashboard");
  }

  if (!officer || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-[24px] border border-[var(--line)] bg-white p-8 shadow-[var(--shadow)] fade-up">
          <div className="mb-8">
            <p className="np text-[13px] tracking-wide text-[var(--mint-700)]">वडा अधिकृत प्रवेश</p>
            <h1 className="mt-2 text-3xl font-semibold np">{text.loginTitle}</h1>
            <p className="mt-2 text-sm text-[var(--ink-500)]">
              <span className="np">{text.loginSub}</span>
            </p>
          </div>
          <form action={handleLogin} className="space-y-4">
            <label className="text-sm font-medium text-[var(--ink-700)]" htmlFor="officerId">
              <span className="np">{text.officerId}</span>
            </label>
            <input
              id="officerId"
              name="officerId"
              defaultValue="WO-04-33-09-001"
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--mint-700)]"
            />
            <label className="text-sm font-medium text-[var(--ink-700)]" htmlFor="pin">
              <span className="np">{text.pin}</span>
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              defaultValue="1234"
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--mint-700)]"
            />
            <button
              type="submit"
              disabled={loading}
              className="mt-3 w-full rounded-xl bg-[var(--mint-800)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <span className="np">{loading ? text.signingIn : text.login}</span>
            </button>
          </form>
        </div>
        {toast && (
          <div className="fixed bottom-5 right-5 rounded-xl bg-[var(--ink-900)] px-4 py-2 text-sm font-medium text-white">
            {toast}
          </div>
        )}
      </div>
    );
  }

  const pendingCount = queue.filter((item) => item.status === "PENDING").length;
  const integrityPercent = integrityResult
    ? Math.round((integrityResult.intact / Math.max(integrityResult.total_checked, 1)) * 100)
    : 0;

  return (
    <div className="portal-shell">
      <div className="grid min-h-[88vh] grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="bg-[var(--mint-800)] p-5 text-white">
          <div>
            <p className="np text-sm text-[var(--mint-200)]">प्रतीबिम्ब</p>
            <h2 className="mt-1 text-xl font-semibold">Ward Portal</h2>
          </div>
          <nav className="mt-8 space-y-2">
            {nav.map((item) => (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  page === item.key ? "bg-white/18 text-white" : "text-white/70 hover:bg-white/12"
                }`}
              >
                <span className="np">{text.nav[item.key]}</span>
                {item.key === "queue" && (
                  <span className="rounded-full bg-[var(--coral)] px-2 py-0.5 text-xs font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-10 rounded-xl border border-white/15 bg-white/10 p-3 text-sm">
            <p className="font-semibold">{officer.full_name}</p>
            <p className="text-white/70">{officer.ward_code}</p>
            <button
              onClick={logout}
              className="mt-3 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/85 transition hover:bg-white/10"
            >
              <span className="np">{text.logout}</span>
            </button>
          </div>
        </aside>

        <section className="flex flex-1 flex-col">
          {/* Top Navbar */}
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-white px-5 py-3 lg:px-7">
            <div>
              <h1 className="np text-xl font-semibold text-[var(--ink-900)]">{text.topTitle}</h1>
              <p className="np mt-0.5 text-xs text-[var(--ink-500)]">{text.topSub}</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Language Toggle */}
              <div className="flex rounded-full border border-[var(--line)] bg-[var(--surface-soft)]">
                <button
                  onClick={() => setLang("en")}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${
                    lang === "en" ? "bg-[var(--mint-800)] text-white" : "text-[var(--ink-700)]"
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setLang("np")}
                  className={`np px-3 py-1.5 text-xs font-semibold transition ${
                    lang === "np" ? "bg-[var(--mint-800)] text-white" : "text-[var(--ink-700)]"
                  }`}
                >
                  नेपाली
                </button>
              </div>
              {/* Nepali Time */}
              <div className="np text-sm font-semibold text-[var(--mint-800)]">{nepaliTime}</div>
              {/* Refresh Button */}
              <button
                onClick={() => void refreshData(token)}
                className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)] transition hover:bg-[var(--mint-50)]"
              >
                <span className="np">↻ {text.refresh}</span>
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-5 lg:p-7">

          {page === "dashboard" && (
            <div className="fade-up space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Issued Today" value={stats.issued_today} note="Officially issued documents" color="mint" />
                <StatCard title="Pending Review" value={stats.pending_requests} note="Requests waiting for approval" color="amber" />
                <StatCard title="Total Documents" value={stats.total_documents} note="In national ledger" color="mint" />
                <StatCard title="Verifications" value={stats.verifications_today} note="Checked today" color="coral" />
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
                <h3 className="text-lg font-semibold">Recent Documents</h3>
                <div className="mt-4 space-y-2">
                  {stats.recent_entries.length === 0 && (
                    <p className="rounded-xl bg-[var(--mint-50)] p-4 text-sm text-[var(--ink-500)]">
                      No recent documents to display.
                    </p>
                  )}
                  {stats.recent_entries.map((entry) => (
                    <div
                      key={entry.dtid}
                      className="grid grid-cols-[1fr_auto_auto_auto] gap-3 rounded-xl border border-[var(--line)] p-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold">{entry.dtid}</p>
                        <p className="text-xs text-[var(--ink-500)]">{entry.officer_id}</p>
                      </div>
                      <span className="rounded-md bg-[var(--mint-50)] px-2 py-1 text-xs font-semibold text-[var(--mint-800)]">
                        {toDocumentLabel(entry.document_type)}
                      </span>
                      <span className="text-xs text-[var(--ink-500)]">{relativeTime(entry.created_at)}</span>
                      <button
                        onClick={() => void handleViewRecentPdf(entry.dtid)}
                        disabled={recentPdfLoading}
                        className="rounded-lg border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ink-700)] transition hover:bg-[var(--mint-50)] disabled:opacity-60"
                      >
                        {recentPdfLoading && recentPdfDtid === entry.dtid ? "Loading..." : "View"}
                      </button>
                    </div>
                  ))}
                </div>

                {recentPdfLoading && (
                  <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                    <div className="mb-3 h-4 w-44 animate-pulse rounded bg-[var(--mint-100)]" />
                    <div className="h-[520px] w-full animate-pulse rounded-lg border border-[var(--line)] bg-[var(--mint-50)]" />
                  </div>
                )}

                {recentPdfUrl && recentPdfDtid && (
                  <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--ink-900)]">Document PDF: {recentPdfDtid}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRecentPdfFullscreen(true)}
                          className="rounded-lg border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ink-700)]"
                        >
                          Fullscreen
                        </button>
                        <button
                          onClick={() => {
                            setRecentPdfUrl((prev) => {
                              if (prev) URL.revokeObjectURL(prev);
                              return null;
                            });
                            setRecentPdfDtid(null);
                            setRecentPdfFullscreen(false);
                          }}
                          className="rounded-lg border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ink-700)]"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                    <iframe
                      src={recentPdfUrl}
                      title={`Recent document PDF ${recentPdfDtid}`}
                      className="h-[520px] w-full rounded-lg border border-[var(--line)] bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {page === "queue" && (
            <div className="fade-up grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {(["all", "PENDING", "UNDER_REVIEW"] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setFilter(item)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        filter === item
                          ? "bg-[var(--mint-800)] text-white"
                          : "border border-[var(--line)] bg-white text-[var(--ink-700)]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search name / NID / request"
                    className="ml-auto min-w-[220px] rounded-full border border-[var(--line)] px-3 py-1.5 text-xs outline-none"
                  />
                </div>

                <div className="space-y-2">
                  {visibleQueue.length === 0 && (
                    <p className="rounded-xl bg-[var(--mint-50)] p-4 text-sm text-[var(--ink-500)]">
                      Queue is empty for the selected filter.
                    </p>
                  )}
                  {visibleQueue.map((item) => (
                    <button
                      key={item.request_id}
                      onClick={() => setSelectedRequest(item)}
                      className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-3 text-left transition ${
                        selectedRequest?.request_id === item.request_id
                          ? "border-[var(--mint-700)] bg-[var(--mint-50)]"
                          : "border-[var(--line)] bg-white hover:border-[var(--mint-200)]"
                      }`}
                    >
                      <span className={`badge-dot ${item.status === "PENDING" ? "pending" : "review"}`} />
                      <div>
                        <p className="text-sm font-semibold">{item.citizen_name}</p>
                        <p className="text-xs text-[var(--ink-500)]">{item.citizen_nid}</p>
                      </div>
                      <span className="text-xs text-[var(--ink-500)]">{relativeTime(item.submitted_at)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
                {!selectedRequest && (
                  <p className="text-sm text-[var(--ink-500)]">Select a request to review and decide.</p>
                )}
                {selectedRequest && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{toDocumentLabel(selectedRequest.document_type)}</h3>
                      <p className="text-xs text-[var(--ink-500)]">{selectedRequest.request_id}</p>
                    </div>
                    <InfoRow label="Citizen" value={selectedRequest.citizen_name} />
                    <InfoRow label="NID" value={selectedRequest.citizen_nid} />
                    <InfoRow label="Purpose" value={selectedRequest.purpose} />
                    <InfoRow label="Ward" value={selectedRequest.ward_code} />
                    <InfoRow label="Status" value={selectedRequest.status} />

                    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--ink-900)]">Backend PDF Preview</p>
                        <button
                          onClick={() => void handleLoadRequestPreview()}
                          disabled={previewLoading}
                          className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)] disabled:opacity-60"
                        >
                          {previewLoading ? "Loading PDF..." : "Load PDF Preview"}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ink-500)]">
                        Review this generated document before approving or rejecting the request.
                      </p>

                      {previewPdfUrl && previewReadyForRequest === selectedRequest.request_id ? (
                        <>
                          <iframe
                            src={previewPdfUrl}
                            title={`PDF preview ${selectedRequest.request_id}`}
                            className="mt-3 h-[420px] w-full rounded-lg border border-[var(--line)] bg-white"
                          />
                          <label className="mt-3 flex items-start gap-2 text-sm text-[var(--ink-700)]">
                            <input
                              type="checkbox"
                              checked={reviewConfirmed}
                              onChange={(event) => setReviewConfirmed(event.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-[var(--line)]"
                            />
                            <span>I have reviewed this document</span>
                          </label>
                        </>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-[var(--line)] bg-white p-4 text-xs text-[var(--ink-500)]">
                          PDF preview not loaded yet.
                        </div>
                      )}
                    </div>

                    <textarea
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Add rejection reason (optional unless rejecting)"
                      className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleApprove()}
                        disabled={loading || previewReadyForRequest !== selectedRequest.request_id || !reviewConfirmed}
                        className="flex-1 rounded-xl bg-[var(--mint-800)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => void handleReject()}
                        disabled={loading || previewReadyForRequest !== selectedRequest.request_id || !reviewConfirmed || !rejectReason.trim()}
                        className="flex-1 rounded-xl border border-[var(--coral)] px-4 py-2 text-sm font-semibold text-[var(--coral)] disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                    {(previewReadyForRequest !== selectedRequest.request_id || !reviewConfirmed) && (
                      <p className="text-xs text-[var(--amber)]">
                        {previewReadyForRequest !== selectedRequest.request_id
                          ? "Load and review the backend PDF preview before taking action."
                          : "Please check \"I have reviewed this document\" before taking action."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {page === "notices" && (
            <div className="fade-up grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
              <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
                <h3 className="np text-xl font-semibold">{text.noticesTitle}</h3>
                <p className="np mt-1 text-sm text-[var(--ink-500)]">
                  {text.noticesSub}
                </p>
                <div className="mt-4 space-y-3">
                  <input
                    value={noticeForm.title}
                    onChange={(event) => setNoticeForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Title (English)"
                    className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none"
                  />
                  <input
                    value={noticeForm.title_ne}
                    onChange={(event) => setNoticeForm((prev) => ({ ...prev, title_ne: event.target.value }))}
                    placeholder="Title (Nepali, optional)"
                    className="np w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none"
                  />
                  <textarea
                    value={noticeForm.body}
                    onChange={(event) => setNoticeForm((prev) => ({ ...prev, body: event.target.value }))}
                    rows={4}
                    placeholder="Notice content (English)"
                    className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none"
                  />
                  <textarea
                    value={noticeForm.body_ne}
                    onChange={(event) => setNoticeForm((prev) => ({ ...prev, body_ne: event.target.value }))}
                    rows={3}
                    placeholder="Notice content (Nepali, optional)"
                    className="np w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none"
                  />

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <select
                      value={noticeForm.category}
                      onChange={(event) => setNoticeForm((prev) => ({ ...prev, category: event.target.value }))}
                      className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none"
                    >
                      {noticeCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <select
                      value={noticeForm.priority}
                      onChange={(event) =>
                        setNoticeForm((prev) => ({ ...prev, priority: Number(event.target.value) }))
                      }
                      className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none"
                    >
                      <option value={0}>Priority 0 - Normal</option>
                      <option value={1}>Priority 1 - Important</option>
                      <option value={2}>Priority 2 - Urgent</option>
                      <option value={3}>Priority 3 - Critical</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={noticeForm.expires_in_days}
                      onChange={(event) =>
                        setNoticeForm((prev) => ({ ...prev, expires_in_days: Number(event.target.value || 0) }))
                      }
                      placeholder="Expiry days (0 = no expiry)"
                      className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none"
                    />
                  </div>

                  <input
                    value={noticeForm.image_url}
                    onChange={(event) => setNoticeForm((prev) => ({ ...prev, image_url: event.target.value }))}
                    placeholder="Image URL (optional)"
                    className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none"
                  />

                  <button
                    onClick={() => void handlePublishNotice()}
                    disabled={loading}
                    className="rounded-xl bg-[var(--mint-800)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <span className="np">{loading ? text.publishing : text.publish}</span>
                  </button>
                </div>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
                <h3 className="np text-xl font-semibold">{text.recentNotices}</h3>
                <p className="np mt-1 text-sm text-[var(--ink-500)]">{text.recentNoticesSub}</p>

                <div className="mt-4 space-y-3">
                  {notices.length === 0 && (
                    <p className="rounded-xl bg-[var(--mint-50)] p-4 text-sm text-[var(--ink-500)]">
                      <span className="np">{text.noNotices}</span>
                    </p>
                  )}
                  {notices.map((item) => (
                    <article key={item.news_id} className="rounded-xl border border-[var(--line)] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--mint-50)] px-2 py-1 text-xs font-semibold text-[var(--mint-800)]">
                          {item.category}
                        </span>
                        <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1 text-xs text-[var(--ink-700)]">
                          Priority {item.priority}
                        </span>
                        <span className="ml-auto text-xs text-[var(--ink-500)]">{relativeTime(item.published_at)}</span>
                      </div>
                      <h4 className="mt-2 text-sm font-semibold text-[var(--ink-900)]">{item.title}</h4>
                      {item.title_ne && <p className="np mt-1 text-sm text-[var(--ink-700)]">{item.title_ne}</p>}
                      <p className="mt-2 text-sm text-[var(--ink-700)]">{item.body}</p>
                      <p className="mt-3 text-xs text-[var(--ink-500)]">Views: {item.view_count.toLocaleString()}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}

          {page === "verify" && (
            <div className="fade-up mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6">
              <h3 className="text-xl font-semibold">Document Verification</h3>
              <p className="mt-2 text-sm text-[var(--ink-500)]">Verify DTID from QR or printed copy.</p>
              <div className="mt-4 flex gap-2">
                <input
                  value={verifyInput}
                  onChange={(event) => setVerifyInput(event.target.value)}
                  placeholder="NPL-04-33-09-2082-000001"
                  className="flex-1 rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none"
                />
                <button
                  onClick={() => void handleVerify()}
                  disabled={loading}
                  className="rounded-xl bg-[var(--mint-800)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Verify
                </button>
              </div>

              {verifyResult && (
                <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--mint-50)] p-4 text-sm">
                  <p className="text-base font-semibold">Status: {verifyResult.status}</p>
                  <p className="mt-2">{verifyResult.message}</p>
                  <div className="mt-3 space-y-1 text-[var(--ink-700)]">
                    <p>Document Type: {verifyResult.document_type || "-"}</p>
                    <p>Issuing Ward: {verifyResult.issuing_ward || "-"}</p>
                    <p>Verification ID: {verifyResult.verification_id || "-"}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {page === "integrity" && (
            <div className="fade-up mx-auto max-w-3xl rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6">
              <h3 className="text-xl font-semibold">Ledger Integrity Check</h3>
              <p className="mt-2 text-sm text-[var(--ink-500)]">
                Recompute record hashes and detect tampering in the governance ledger.
              </p>
              <button
                onClick={() => void handleIntegrity()}
                disabled={loading}
                className="mt-4 rounded-xl bg-[var(--mint-800)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Run Integrity Scan
              </button>

              {integrityResult && (
                <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                  <p className="text-3xl font-bold text-[var(--mint-700)]">{integrityPercent}%</p>
                  <div className="mt-2 h-2 rounded-full bg-[var(--mint-100)]">
                    <div
                      className="h-2 rounded-full bg-[var(--mint-800)]"
                      style={{ width: `${integrityPercent}%` }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <InfoMetric title="Checked" value={integrityResult.total_checked.toLocaleString()} />
                    <InfoMetric title="Intact" value={integrityResult.intact.toLocaleString()} />
                    <InfoMetric title="Tampered" value={String(integrityResult.tampered)} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[var(--ink-700)]">{integrityResult.verdict}</p>
                </div>
              )}
            </div>
          )}
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 rounded-xl bg-[var(--ink-900)] px-4 py-2 text-sm font-medium text-white">
          {toast}
        </div>
      )}

      {recentPdfFullscreen && recentPdfUrl && recentPdfDtid && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4">
          <div className="flex h-full w-full flex-col rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--ink-900)]">Document PDF: {recentPdfDtid}</p>
              <button
                onClick={() => setRecentPdfFullscreen(false)}
                className="rounded-lg border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ink-700)]"
              >
                Exit Fullscreen
              </button>
            </div>
            <iframe
              src={recentPdfUrl}
              title={`Recent document PDF fullscreen ${recentPdfDtid}`}
              className="h-full w-full rounded-lg border border-[var(--line)] bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  note,
  color,
}: {
  title: string;
  value: number;
  note: string;
  color: "mint" | "amber" | "coral";
}) {
  const accent =
    color === "mint" ? "var(--mint-700)" : color === "amber" ? "var(--amber)" : "var(--coral)";

  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">{title}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color: accent }}>
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-[var(--ink-500)]">{note}</p>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-3">
      <p className="text-xs text-[var(--ink-500)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--ink-900)]">{value}</p>
    </div>
  );
}

function InfoMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-3">
      <p className="text-xs text-[var(--ink-500)]">{title}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--ink-900)]">{value}</p>
    </div>
  );
}
