"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveRequest,
  fetchDashboardStats,
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

const nav: Array<{ key: NavPage; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "queue", label: "Request Queue" },
  { key: "verify", label: "Verify" },
  { key: "integrity", label: "Integrity" },
];

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
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [lang, setLang] = useState<"en" | "np">("en");
  const [nepaliTime, setNepaliTime] = useState("");

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
    const [statsResult, queueResult] = await Promise.all([
      fetchDashboardStats(authToken),
      fetchQueue(authToken),
    ]);
    setStats(statsResult);
    setQueue(queueResult);
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
      setToast("Officer ID and PIN are required.");
      return;
    }

    setLoading(true);
    const result = await loginOfficer(officerId, pin);
    setLoading(false);

    if (!result.success) {
      setToast(result.message || "Login failed.");
      return;
    }

    localStorage.setItem("pratibimba_token", result.data.token);
    localStorage.setItem("pratibimba_officer", JSON.stringify(result.data.officer));
    setToken(result.data.token);
    setOfficer(result.data.officer);
    setToast(result.message || "Login successful.");
  }

  async function handleApprove() {
    if (!selectedRequest || !token) return;
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

  function logout() {
    localStorage.removeItem("pratibimba_token");
    localStorage.removeItem("pratibimba_officer");
    setOfficer(null);
    setToken("");
    setQueue([]);
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
            <h1 className="mt-2 text-3xl font-semibold">Pratibimba Portal</h1>
            <p className="mt-2 text-sm text-[var(--ink-500)]">
              Sign in to access digital governance tools for citizen services.
            </p>
          </div>
          <form action={handleLogin} className="space-y-4">
            <label className="text-sm font-medium text-[var(--ink-700)]" htmlFor="officerId">
              Officer ID
            </label>
            <input
              id="officerId"
              name="officerId"
              defaultValue="WO-04-33-09-001"
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--mint-700)]"
            />
            <label className="text-sm font-medium text-[var(--ink-700)]" htmlFor="pin">
              PIN
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
              {loading ? "Signing in..." : "Login"}
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
                <span>{item.label}</span>
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
              Logout
            </button>
          </div>
        </aside>

        <section className="flex flex-1 flex-col">
          {/* Top Navbar */}
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-white px-5 py-3 lg:px-7">
            <div>
              <h1 className="text-xl font-semibold text-[var(--ink-900)]">Digital Governance Desk</h1>
              <p className="mt-0.5 text-xs text-[var(--ink-500)]">Connected to ward services and national traceability.</p>
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
                ↻ Refresh
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
                      className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-xl border border-[var(--line)] p-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold">{entry.dtid}</p>
                        <p className="text-xs text-[var(--ink-500)]">{entry.officer_id}</p>
                      </div>
                      <span className="rounded-md bg-[var(--mint-50)] px-2 py-1 text-xs font-semibold text-[var(--mint-800)]">
                        {toDocumentLabel(entry.document_type)}
                      </span>
                      <span className="text-xs text-[var(--ink-500)]">{relativeTime(entry.created_at)}</span>
                    </div>
                  ))}
                </div>
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

                    <textarea
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Add rejection reason (optional unless rejecting)"
                      className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleApprove()}
                        disabled={loading}
                        className="flex-1 rounded-xl bg-[var(--mint-800)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => void handleReject()}
                        disabled={loading || !rejectReason.trim()}
                        className="flex-1 rounded-xl border border-[var(--coral)] px-4 py-2 text-sm font-semibold text-[var(--coral)] disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
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
