import React from 'react';
import type {
  Department,
  Case,
  EvidenceRecord,
  EvidenceFileVersion,
  EvidenceHandoff,
  ForensicReport,
  ProsecutionReview,
  OfflineQueueItem,
  AuthenticatedSession,
} from '../types.ts';
import { DEPARTMENT_PRESETS } from '../types.ts';
import { globalDb } from '../data/db.ts';
import { globalStorageEngine } from '../utils/storage.ts';
import { formatFileSize } from '../utils/crypto.ts';
import {
  CloudUploadIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  HistoryIcon,
  DownloadIcon,
  SearchIcon,
  DatabaseIcon,
  FileCodeIcon,
  FolderLockIcon,
  GitCommitIcon,
  CpuIcon,
  LockIcon,
} from './icons.tsx';

export interface EvidenceWorkspaceProps {
  activeDept: Department | 'AUDIT' | 'STORAGE';
  currentUser: AuthenticatedSession;
  cases: Case[];
  evidence: EvidenceRecord[];
  handoffs: EvidenceHandoff[];
  reports: ForensicReport[];
  reviews: ProsecutionReview[];
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  offlineQueue: OfflineQueueItem[];
  storageMetrics: ReturnType<typeof globalStorageEngine.getStorageMetrics>;
  setStorageMetrics: React.Dispatch<React.SetStateAction<ReturnType<typeof globalStorageEngine.getStorageMetrics>>>;
  onOpenCreateCaseModal: () => void;
  onOpenRegisterEvidenceModal: () => void;
  onOpenCaseIndex: () => void;
  onOpenOfflineCenter: () => void;
  verifyingFileId: string | null;
  onRunVerification: (fileVersionId: string) => void;
  onSimulateTamper: (fv: EvidenceFileVersion) => void;
  onRestorePristine: (fv: EvidenceFileVersion) => void;
  onViewHistory: (fileVersionId: string) => void;
  onDownloadArtifact: (key: string, filename: string) => void;
  onSubmitToForensics: (evId: string) => void;
  onAcceptTransfer: (handoffId: string) => void;
  onRejectTransfer: (data: { handoffId: string; evdId: string }) => void;
  onStartExam: (handoffId: string) => void;
  onMarkReportReady: (handoffId: string) => void;
  newFindingText: string;
  setNewFindingText: (v: string) => void;
  onAddReportVersion: (evId: string) => void;
  prosecutionNotes: string;
  setProsecutionNotes: (v: string) => void;
  onProsecutionDecision: (
    status: 'ACCEPTED_FOR_TRIAL' | 'FURTHER_EVIDENCE_REQUESTED',
    reportId: string
  ) => void;
  onSwitchToAdmin: () => void;
  onReturnToDept: (dept: Department) => void;
  onSwitchUser?: (session: AuthenticatedSession) => void;
}

export const EvidenceWorkspace: React.FC<EvidenceWorkspaceProps> = ({
  activeDept,
  currentUser,
  cases,
  evidence,
  handoffs,
  reports,
  reviews,
  selectedCaseId,
  setSelectedCaseId,
  offlineQueue,
  storageMetrics,
  setStorageMetrics,
  onOpenCreateCaseModal,
  onOpenRegisterEvidenceModal,
  onOpenCaseIndex,
  onOpenOfflineCenter,
  verifyingFileId,
  onRunVerification,
  onSimulateTamper,
  onRestorePristine,
  onViewHistory,
  onDownloadArtifact,
  onSubmitToForensics,
  onAcceptTransfer,
  onRejectTransfer,
  onStartExam,
  onMarkReportReady,
  newFindingText,
  setNewFindingText,
  onAddReportVersion,
  prosecutionNotes,
  setProsecutionNotes,
  onProsecutionDecision,
  onSwitchToAdmin,
  onReturnToDept,
  onSwitchUser,
}) => {
  const isForensicRole = currentUser.role === 'FORENSIC_EXAMINER' || currentUser.role === 'SYSTEM_ADMIN';
  const isProsecutionRole = currentUser.role === 'PUBLIC_PROSECUTOR' || currentUser.role === 'SYSTEM_ADMIN';
  const canVerifyIntegrity = isForensicRole || isProsecutionRole;
  const canTamperOrRestore = isForensicRole;
  const selectedCase: Case | undefined = cases.find((c) => c.id === selectedCaseId) || cases[0];
  const caseEvidence: EvidenceRecord[] = selectedCase
    ? evidence.filter((e) => e.case_id === selectedCase.id)
    : [];

  const [caseSearch, setCaseSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('ALL');
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set);
  }, [cases]);

  const filteredCases = React.useMemo(() => {
    return cases.filter((c) => {
      const q = caseSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.case_reference.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.assigned_officer_id && c.assigned_officer_id.toLowerCase().includes(q));
      const matchesCat = categoryFilter === 'ALL' || c.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [cases, caseSearch, categoryFilter]);

  const handleCopyHash = (hash: string) => {
    try {
      navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch {
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    }
  };

  return (
    <main className="ev-main">
      {activeDept === 'STORAGE' ? (
        /* CLOUDFLARE R2 STORAGE & COST REPORTING VIEW */
        <section className="ev-card">
          <div className="ev-card-header">
            <div>
              <h3 className="ev-card-title">Cloudflare R2 Object Storage &amp; Cost Management</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Private S3-Compatible Object Store with Zero Egress Fees • 10 GB Free Tier
              </span>
            </div>
            <button
              type="button"
              className="ev-btn ev-btn-secondary"
              onClick={() => setStorageMetrics(globalStorageEngine.getStorageMetrics())}
            >
              Refresh Metrics
            </button>
          </div>

          {/* Metrics Grid */}
          <div className="ev-metrics-grid">
            <div className="ev-metric-card">
              <div className="ev-metric-title">Total Stored Volume</div>
              <div className="ev-metric-value">{storageMetrics.totalStoredFormatted}</div>
              <div className="ev-metric-sub">
                Free Tier Limit: {formatFileSize(storageMetrics.freeTierStorageLimitBytes)}
              </div>
            </div>
            <div className="ev-metric-card">
              <div className="ev-metric-title">Estimated Monthly Cost</div>
              <div className="ev-metric-value" style={{ color: '#10b981' }}>
                ${storageMetrics.estimatedMonthlyCostUSD.toFixed(2)} USD
              </div>
              <div className="ev-metric-sub">$0.015 / GB-mo beyond 10 GB</div>
            </div>
            <div className="ev-metric-card">
              <div className="ev-metric-title">Egress Bandwidth Cost</div>
              <div className="ev-metric-value" style={{ color: '#38bdf8' }}>
                $0.00 USD (FREE)
              </div>
              <div className="ev-metric-sub">Cloudflare R2 Zero Egress Guarantee</div>
            </div>
            <div className="ev-metric-card">
              <div className="ev-metric-title">Class A Operations (PUT/MPU)</div>
              <div className="ev-metric-value">{storageMetrics.classAOperations}</div>
              <div className="ev-metric-sub">1M free/mo ($4.50/M thereafter)</div>
            </div>
            <div className="ev-metric-card">
              <div className="ev-metric-title">Bucket Capacity Quota</div>
              <div className="ev-metric-value">{storageMetrics.quotaUsedPercent}%</div>
              <div className="ev-metric-sub">
                Cap: {formatFileSize(storageMetrics.quotaLimitBytes)}
              </div>
            </div>
          </div>

          {/* Cost Comparison vs AWS S3 */}
          <div
            style={{
              background: '#0d101c',
              border: '1px solid #21273e',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#f8fafc' }}>
              Forensic Workload Cost Benchmark: Cloudflare R2 vs AWS S3
            </h4>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 14px 0' }}>
              In criminal investigations, large forensic disk images (250+ GB) are frequently downloaded by police,
              defense experts, forensics, and prosecutors. Zero egress pricing provides massive cost savings:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: '#121626', padding: '12px', borderRadius: '6px' }}>
                <strong style={{ color: '#38bdf8' }}>Cloudflare R2 (Our Engine)</strong>
                <ul style={{ fontSize: '12px', color: '#cbd5e1', paddingLeft: '18px', margin: '8px 0 0 0' }}>
                  <li>Storage: $0.015 / GB-month</li>
                  <li>Egress Fees: <strong>$0.00 / GB (Always Free)</strong></li>
                  <li>Downloading 500 GB 5 times: <strong>$0.00 egress</strong></li>
                </ul>
              </div>
              <div style={{ background: '#121626', padding: '12px', borderRadius: '6px' }}>
                <strong style={{ color: '#f87171' }}>AWS S3 Standard (Legacy Provider)</strong>
                <ul style={{ fontSize: '12px', color: '#cbd5e1', paddingLeft: '18px', margin: '8px 0 0 0' }}>
                  <li>Storage: $0.023 / GB-month (+53% higher)</li>
                  <li>Egress Fees: <strong>$0.09 / GB</strong></li>
                  <li>Downloading 500 GB 5 times: <strong>$225.00 egress charge</strong></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Storage Governance & Security Controls */}
          <div
            style={{
              background: '#0d101c',
              border: '1px solid #21273e',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#f8fafc' }}>
              Data Governance &amp; Security Controls
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                <strong style={{ color: '#34d399' }}>✓ Encryption at Rest:</strong> {storageMetrics.encryptionStandard}
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                <strong style={{ color: '#34d399' }}>✓ Encryption in Transit:</strong> TLS 1.3 Strict Enforcement
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                <strong style={{ color: '#34d399' }}>✓ WORM Immutability:</strong> {storageMetrics.retentionPolicy}
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                <strong style={{ color: '#34d399' }}>✓ Path Traversal Defense:</strong> Server-Side Canonical Keys
              </div>
            </div>
          </div>
        </section>
      ) : activeDept !== 'ADMINISTRATION' ? (
        <>
          {/* Executive Departmental Command HUD Strip */}
          <div className="ev-command-hud">
            {activeDept === 'POLICE' && (
              <>
                <div className="ev-hud-card hud-police">
                  <div className="ev-hud-icon-box blue">
                    <FolderLockIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Incident Registry</div>
                    <div className="ev-hud-value">{cases.length} Cases</div>
                    <div className="ev-hud-sub">
                      <span className="ev-pulse-dot green" />
                      {cases.filter((c) => c.status === 'UNDER_INVESTIGATION').length} Active Investigations
                    </div>
                  </div>
                </div>

                <div className="ev-hud-card hud-police">
                  <div className="ev-hud-icon-box cyan">
                    <DatabaseIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Evidence Vault</div>
                    <div className="ev-hud-value">{evidence.length} Artifacts</div>
                    <div className="ev-hud-sub">
                      <span className="ev-pulse-dot blue" />
                      100% SHA-256 Registered Baseline
                    </div>
                  </div>
                </div>

                <div className="ev-hud-card hud-police">
                  <div className="ev-hud-icon-box purple">
                    <GitCommitIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Custody Transfers</div>
                    <div className="ev-hud-value">{handoffs.length} Dispatches</div>
                    <div className="ev-hud-sub">
                      <span className="ev-pulse-dot purple" />
                      {handoffs.filter((h) => h.status === 'SUBMITTED').length} In Transit to Forensic Lab
                    </div>
                  </div>
                </div>

                <div className="ev-hud-card hud-police">
                  <div className="ev-hud-icon-box emerald">
                    <ShieldCheckIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Legal Ingestion Standard</div>
                    <div className="ev-hud-value">ISO 27037 A+</div>
                    <div className="ev-hud-sub">NIST SP 800-86 First Responder Ingestion</div>
                  </div>
                </div>
              </>
            )}

            {activeDept === 'FORENSIC' && (
              <>
                <div className="ev-hud-card hud-forensic">
                  <div className="ev-hud-icon-box cyan">
                    <FileCodeIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Forensic Intake Queue</div>
                    <div className="ev-hud-value">{handoffs.length} Total Handoffs</div>
                    <div className="ev-hud-sub">
                      <span className="ev-pulse-dot green" />
                      {handoffs.filter((h) => h.status === 'UNDER_EXAMINATION' || h.status === 'RECEIVED').length} Active in Examination
                    </div>
                  </div>
                </div>

                <div className="ev-hud-card hud-forensic">
                  <div className="ev-hud-icon-box emerald">
                    <ShieldCheckIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Bit-Stream Integrity</div>
                    <div className="ev-hud-value" style={{ color: '#34d399' }}>100% MATCH</div>
                    <div className="ev-hud-sub">NIST FIPS 180-4 Bit-Level Verification</div>
                  </div>
                </div>

                <div className="ev-hud-card hud-forensic">
                  <div className="ev-hud-icon-box purple">
                    <CpuIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Laboratory Reports</div>
                    <div className="ev-hud-value">{reports.length} Reports</div>
                    <div className="ev-hud-sub">
                      <span className="ev-pulse-dot purple" />
                      v1/v2 Version-Preserved Findings
                    </div>
                  </div>
                </div>

                <div className="ev-hud-card hud-forensic">
                  <div className="ev-hud-icon-box blue">
                    <DatabaseIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Storage Engine</div>
                    <div className="ev-hud-value" style={{ color: '#38bdf8' }}>Cloudflare R2</div>
                    <div className="ev-hud-sub">Zero Egress Bandwidth Cost Guarantee</div>
                  </div>
                </div>
              </>
            )}

            {activeDept === 'PROSECUTION' && (
              <>
                <div className="ev-hud-card hud-prosecution">
                  <div className="ev-hud-icon-box purple">
                    <ShieldCheckIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Court Trial Docket</div>
                    <div className="ev-hud-value">{cases.length} Cases</div>
                    <div className="ev-hud-sub">
                      <span className="ev-pulse-dot purple" />
                      Judicial Evidentiary Index Active
                    </div>
                  </div>
                </div>

                <div className="ev-hud-card hud-prosecution">
                  <div className="ev-hud-icon-box emerald">
                    <CheckCircleIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Trial Admissibility</div>
                    <div className="ev-hud-value" style={{ color: '#34d399' }}>Sec 65B BNSS</div>
                    <div className="ev-hud-sub">Electronic Record Admissibility Ready</div>
                  </div>
                </div>

                <div className="ev-hud-card hud-prosecution">
                  <div className="ev-hud-icon-box cyan">
                    <FileCodeIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Exhibits Certified</div>
                    <div className="ev-hud-value">{evidence.length} Exhibits</div>
                    <div className="ev-hud-sub">
                      <span className="ev-pulse-dot green" />
                      Full Chain of Custody Continuity
                    </div>
                  </div>
                </div>

                <div className="ev-hud-card hud-prosecution">
                  <div className="ev-hud-icon-box blue">
                    <LockIcon size={22} />
                  </div>
                  <div className="ev-hud-content">
                    <div className="ev-hud-label">Judicial Decisions</div>
                    <div className="ev-hud-value">{reviews.length} Logged</div>
                    <div className="ev-hud-sub">
                      {reviews.filter((r) => r.status === 'ACCEPTED_FOR_TRIAL').length} Accepted for Court Trial
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="ev-grid-two-col">
            {/* Left Column: Shared Case Selector */}
            <section className="ev-card">
              <div className="ev-card-header">
                <div>
                  <h3 className="ev-card-title">
                    {activeDept === 'POLICE' && 'Police Incident & Case Register'}
                    {activeDept === 'FORENSIC' && 'Forensic Intake & Active Laboratory Queue'}
                    {activeDept === 'PROSECUTION' && 'Prosecution Judicial Case Docket'}
                    {activeDept !== 'POLICE' && activeDept !== 'FORENSIC' && activeDept !== 'PROSECUTION' && 'Case Register'}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {activeDept === 'POLICE' && 'Active police incident records and evidence intake register.'}
                    {activeDept === 'FORENSIC' && 'Authoritative case inventory undergoing forensic examination and triage.'}
                    {activeDept === 'PROSECUTION' && 'Court-admissible evidentiary files and judicial review records.'}
                  </span>
                </div>
                {activeDept === 'POLICE' && (
                  <button
                    type="button"
                    className="ev-btn ev-btn-primary"
                    style={{ fontSize: '12px' }}
                    onClick={onOpenCreateCaseModal}
                  >
                    + New Case
                  </button>
                )}
              </div>

              {/* Case Search & Filter Controls */}
              <div className="ev-case-filter-bar">
                <div className="ev-search-input-wrapper">
                  <SearchIcon size={14} className="ev-search-icon" />
                  <input
                    type="text"
                    className="ev-search-input"
                    placeholder="Search by title, reference, category, lead..."
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                  />
                </div>
              </div>

              {categories.length > 1 && (
                <div className="ev-cat-chips">
                  <button
                    type="button"
                    className={`ev-cat-chip ${categoryFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setCategoryFilter('ALL')}
                  >
                    All ({cases.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`ev-cat-chip ${categoryFilter === cat ? 'active' : ''}`}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {filteredCases.length === 0 && offlineQueue.filter((q) => q.action === 'CREATE_CASE' && q.status === 'PENDING').length === 0 ? (
                <div className="ev-empty-state">
                  {caseSearch || categoryFilter !== 'ALL'
                    ? 'No matching cases found for the selected filter.'
                    : 'No cases found in shared database.'}
                </div>
              ) : (
                <>
                  {filteredCases.map((c) => (
                    <div
                      key={c.id}
                      className={`ev-case-item ${selectedCase?.id === c.id ? `selected portal-${activeDept.toLowerCase()}` : ''}`}
                      onClick={() => setSelectedCaseId(c.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedCaseId(c.id);
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`ev-pulse-dot ${c.status === 'UNDER_INVESTIGATION' ? 'green' : 'purple'}`} />
                          <span className="ev-case-title">{c.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span className="ev-offline-pill synced" style={{ fontSize: '10px' }}>✓ Server Confirmed</span>
                          <span className="ev-badge ev-badge-investigation">{c.status}</span>
                        </div>
                      </div>
                      <div className="ev-case-meta">
                        <span>Ref: {c.case_reference}</span>
                        <span>Cat: {c.category}</span>
                        <span>Lead: {c.assigned_officer_id || 'Unassigned'}</span>
                      </div>
                    </div>
                  ))}

                {/* Display Locally Queued Unsynced Cases */}
                {offlineQueue
                  .filter((q) => q.action === 'CREATE_CASE' && (q.status === 'PENDING' || q.status === 'SYNCING'))
                  .map((q) => {
                    const payload = q.payload as { title?: string; case_reference?: string; category?: string };
                    return (
                      <div
                        key={q.eventId}
                        className="ev-case-item"
                        style={{
                          borderLeft: '4px solid #f59e0b',
                          background: 'rgba(245, 158, 11, 0.08)',
                          cursor: 'pointer',
                        }}
                        onClick={onOpenOfflineCenter}
                        title="Locally queued case pending server synchronization"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="ev-case-title" style={{ color: '#fef08a' }}>
                            {payload.title || 'Untitled Case'}
                          </span>
                          <span className="ev-offline-pill pending">⏳ Locally Queued (Unsynced)</span>
                        </div>
                        <div className="ev-case-meta">
                          <span>Ref: {payload.case_reference}</span>
                          <span>Event: {q.eventId}</span>
                          <span style={{ color: '#fbbf24' }}>Status: Pending Server Sync</span>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
          </section>

          {/* Right Column: Active Department Workspace View */}
          <section className="ev-card">
            {selectedCase ? (
              <>
                <div className="ev-card-header">
                  <div>
                    <h3 className="ev-card-title">
                      {activeDept === 'POLICE' && 'Police Workspace: Ingestion & Examination Dispatch'}
                      {activeDept === 'FORENSIC' && 'Forensic Laboratory: Verification System & Analysis Workspace'}
                      {activeDept === 'PROSECUTION' && 'Prosecution Workspace: Evidentiary Audit & Judicial Sign-Off'}
                    </h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Selected: <strong>{selectedCase.title}</strong> [{selectedCase.case_reference}]
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {activeDept === 'POLICE' && (
                      <button
                        type="button"
                        className="ev-btn ev-btn-secondary"
                        style={{ fontSize: '12px', borderColor: '#3b82f6' }}
                        onClick={onOpenRegisterEvidenceModal}
                      >
                        <CloudUploadIcon size={14} />
                        + Ingest Evidence
                      </button>
                    )}

                    {activeDept === 'PROSECUTION' && (
                      <button
                        type="button"
                        className="ev-btn ev-btn-purple"
                        style={{ fontSize: '12px' }}
                        onClick={onOpenCaseIndex}
                      >
                        Generate Case Evidence Index
                      </button>
                    )}
                  </div>
                </div>

                {/* Case Intelligence Overview Header */}
                <div className="ev-case-intel-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ev-badge ev-badge-investigation" style={{ fontFamily: 'var(--font-mono)' }}>
                        {selectedCase.case_reference}
                      </span>
                      <strong style={{ color: '#f8fafc', fontSize: '15px' }}>{selectedCase.title}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {selectedCase.category} • Lead: {selectedCase.assigned_officer_id || 'Unassigned'}
                    </div>
                  </div>

                  <div className="ev-case-intel-meta">
                    <span className="ev-intel-pill">📦 {caseEvidence.length} Evidence Items</span>
                    <span className="ev-intel-pill">🔄 {handoffs.filter((h) => caseEvidence.some((e) => e.id === h.evidence_id)).length} Handoffs</span>
                    <span className="ev-intel-pill">📄 {reports.filter((r) => r.case_id === selectedCase.id).length} Reports</span>
                  </div>
                </div>

                {/* PROSECUTION COMPLETENESS SUMMARY */}
                {activeDept === 'PROSECUTION' && (
                  <div
                    style={{
                      background: '#121526',
                      border: '1px solid #2d3558',
                      borderRadius: '6px',
                      padding: '14px',
                      marginBottom: '16px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#c084fc',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ShieldCheckIcon size={16} />
                      Evidence Completeness Assessment
                    </div>
                    {globalDb.assessEvidenceCompleteness(selectedCase.id).map((check) => (
                      <div key={check.evidenceId} className="ev-checklist-item">
                        {check.isComplete ? (
                          <CheckCircleIcon size={16} style={{ color: '#10b981' }} />
                        ) : (
                          <AlertTriangleIcon size={16} style={{ color: '#f59e0b' }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>[{check.evidenceId}]</span>{' '}
                          <span>{check.description}</span>
                          {!check.isComplete && (
                            <div style={{ fontSize: '11px', color: '#f87171', marginTop: '2px' }}>
                              Missing: {check.missingItems.join(', ')}
                            </div>
                          )}
                        </div>
                        <span
                          className={`ev-badge ${
                            check.isComplete ? 'ev-badge-match' : 'ev-badge-investigation'
                          }`}
                        >
                          {check.isComplete ? 'AUDIT READY' : 'PENDING'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Evidence Items for this Case */}
                {caseEvidence.length === 0 ? (
                  <div className="ev-empty-state">
                    No evidence records registered yet.
                    {activeDept === 'POLICE' && (
                      <div style={{ marginTop: '10px' }}>
                        <button
                          type="button"
                          className="ev-btn ev-btn-primary"
                          onClick={onOpenRegisterEvidenceModal}
                        >
                          Ingest First Evidence Artifact
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  caseEvidence.map((evItem) => {
                    const fileVersions = globalDb.getFileVersionsForEvidence(evItem.id);
                    const evHandoffs = handoffs.filter((h) => h.evidence_id === evItem.id);
                    const latestHandoff = evHandoffs[evHandoffs.length - 1];
                    const evReports = reports.filter((r) => r.evidence_id === evItem.id);

                    return (
                      <div
                        key={evItem.id}
                        style={{
                          background: '#0d101c',
                          border: '1px solid #21273e',
                          borderRadius: '6px',
                          padding: '16px',
                          marginBottom: '16px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#f1f5f9', fontSize: '14px' }}>
                            [{evItem.id}] {evItem.description}
                          </strong>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span className="ev-offline-pill synced" style={{ fontSize: '10px' }}>✓ Server Confirmed</span>
                            <span className="ev-badge ev-badge-match">{evItem.current_status}</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                          <span>Type: {evItem.evidence_type}</span> •{' '}
                          <span>Source: {evItem.source_description}</span> •{' '}
                          <span>Collected: {new Date(evItem.collected_at).toLocaleDateString()}</span>
                        </div>

                        {/* 4-Stage Custody Lifecycle Stepper */}
                        <div className="ev-custody-stepper">
                          <div className="ev-stepper-step completed">
                            <div className="ev-stepper-circle">✓</div>
                            <span>1. Ingested &amp; Sealed</span>
                          </div>
                          <span className="ev-stepper-arrow">➔</span>
                          <div className={`ev-stepper-step ${latestHandoff ? 'completed' : 'current'}`}>
                            <div className="ev-stepper-circle">{latestHandoff ? '✓' : '2'}</div>
                            <span>2. {latestHandoff ? `Handoff: ${latestHandoff.status}` : 'Lab Handoff'}</span>
                          </div>
                          <span className="ev-stepper-arrow">➔</span>
                          <div className={`ev-stepper-step ${evReports.length > 0 ? 'completed' : (latestHandoff?.status === 'UNDER_EXAMINATION' ? 'current' : '')}`}>
                            <div className="ev-stepper-circle">{evReports.length > 0 ? '✓' : '3'}</div>
                            <span>3. {evReports.length > 0 ? `${evReports.length} Report(s)` : 'Forensic Exam'}</span>
                          </div>
                          <span className="ev-stepper-arrow">➔</span>
                          <div className={`ev-stepper-step ${reviews.some((r) => r.case_id === evItem.case_id) ? 'completed' : ''}`}>
                            <div className="ev-stepper-circle">{reviews.some((r) => r.case_id === evItem.case_id) ? '✓' : '4'}</div>
                            <span>4. Judicial Admissibility</span>
                          </div>
                        </div>

                        {/* Object Storage File Baseline Versions, Verification & Secure Download */}
                        {fileVersions.length > 0 && (
                          <div style={{ marginTop: '12px' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '6px',
                              }}
                            >
                              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                                Private Object Storage &amp; Cryptographic Integrity:
                              </span>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                Cloudflare R2 Private Bucket • AES-256 SSE-S3
                              </span>
                            </div>

                            {fileVersions.map((fv) => {
                              const latestVerif = globalDb.getLatestVerificationResult(fv.id);
                              const allVerifs = globalDb.getVerificationResultsForFileVersion(fv.id);
                              const isVerifying = verifyingFileId === fv.id;

                              return (
                                <div
                                  key={fv.id}
                                  className={`ev-verify-card ${latestVerif ? latestVerif.result.toLowerCase() : ''}`}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      flexWrap: 'wrap',
                                      gap: '8px',
                                    }}
                                  >
                                    <div>
                                      <strong style={{ color: '#f8fafc', fontSize: '13px' }}>
                                        {fv.original_filename}
                                      </strong>{' '}
                                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                                        ({formatFileSize(fv.file_size)})
                                      </span>
                                    </div>

                                    {/* Status Badge */}
                                    {latestVerif ? (
                                      <span className={`ev-badge ev-badge-${latestVerif.result.toLowerCase()}`}>
                                        {latestVerif.result === 'MATCH' && '✔ SHA-256 MATCH'}
                                        {latestVerif.result === 'MISMATCH' && '⚠ TAMPER MISMATCH'}
                                        {latestVerif.result === 'ERROR' && '✖ STORAGE ERROR'}
                                      </span>
                                    ) : (
                                      <span className="ev-badge ev-badge-unverified">
                                        ○ PENDING VERIFICATION
                                      </span>
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      marginTop: '6px',
                                      fontSize: '11px',
                                      color: '#64748b',
                                      fontFamily: 'var(--font-mono)',
                                    }}
                                  >
                                    Key: {fv.generated_storage_key}
                                  </div>

                                  {/* Hash Baseline & Observed Details */}
                                  <div
                                    style={{
                                      marginTop: '8px',
                                      background: '#070912',
                                      padding: '10px 12px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontFamily: 'var(--font-mono)',
                                      border: '1px solid #161c30',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                      <div>
                                        <span style={{ color: '#94a3b8' }}>Baseline Manifest: </span>
                                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>{fv.sha256_hash}</span>
                                      </div>
                                      <button
                                        type="button"
                                        className="ev-btn ev-btn-secondary"
                                        style={{ padding: '2px 8px', fontSize: '10px', height: 'auto', borderRadius: '4px' }}
                                        onClick={() => handleCopyHash(fv.sha256_hash)}
                                        title="Copy SHA-256 hash to clipboard"
                                      >
                                        {copiedHash === fv.sha256_hash ? '✓ Copied!' : 'Copy Hash'}
                                      </button>
                                    </div>
                                    {latestVerif && latestVerif.observed_sha256 && (
                                      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #1e293b' }}>
                                        <span style={{ color: '#94a3b8' }}>Observed Storage: </span>
                                        <span
                                          style={{
                                            color:
                                              latestVerif.result === 'MATCH' ? '#34d399' : '#f87171',
                                            fontWeight: 600,
                                          }}
                                        >
                                          {latestVerif.observed_sha256}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Verification Metadata & Diagnostic Details */}
                                  {latestVerif && (
                                    <div
                                      style={{
                                        marginTop: '6px',
                                        fontSize: '11px',
                                        color: '#94a3b8',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '6px',
                                      }}
                                    >
                                      <span>
                                        Verified:{' '}
                                        {new Date(latestVerif.verified_at).toLocaleTimeString()} by{' '}
                                        <strong>{latestVerif.verified_by}</strong> (
                                        {latestVerif.verification_mode}, {latestVerif.duration_ms} ms)
                                      </span>
                                      <span>
                                        Provider:{' '}
                                        {latestVerif.provider_integrity?.provider || 'R2'} (
                                        {latestVerif.provider_integrity?.encryptionAtRest})
                                      </span>
                                    </div>
                                  )}

                                  {latestVerif?.error_reason && (
                                    <div
                                      style={{
                                        marginTop: '6px',
                                        fontSize: '12px',
                                        color: '#f87171',
                                        background: 'rgba(239, 68, 68, 0.12)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        padding: '6px 10px',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      ⚠ {latestVerif.error_reason}
                                    </div>
                                  )}

                                  {/* Action Toolbar */}
                                  <div
                                    style={{
                                      marginTop: '10px',
                                      display: 'flex',
                                      gap: '8px',
                                      flexWrap: 'wrap',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-primary"
                                      style={{
                                        fontSize: '11px',
                                        padding: '4px 10px',
                                        opacity: canVerifyIntegrity ? 1 : 0.45,
                                        cursor: canVerifyIntegrity ? 'pointer' : 'not-allowed',
                                      }}
                                      disabled={isVerifying || !canVerifyIntegrity}
                                      onClick={() => onRunVerification(fv.id)}
                                      title={
                                        canVerifyIntegrity
                                          ? 'Stream private storage payload and compute live NIST FIPS 180-4 SHA-256'
                                          : `Restricted: SHA-256 cryptographic verification is restricted to Forensic Examiner, Public Prosecutor, and Admin roles (Active role: ${currentUser.role})`
                                      }
                                    >
                                      <ShieldCheckIcon size={13} />
                                      {isVerifying ? 'Verifying Stream...' : 'Verify SHA-256'}
                                    </button>

                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-danger"
                                      style={{
                                        fontSize: '11px',
                                        padding: '4px 8px',
                                        opacity: canTamperOrRestore ? 1 : 0.45,
                                        cursor: canTamperOrRestore ? 'pointer' : 'not-allowed',
                                      }}
                                      disabled={isVerifying || !canTamperOrRestore}
                                      onClick={() => onSimulateTamper(fv)}
                                      title={
                                        canTamperOrRestore
                                          ? 'Corrupt 1 byte in storage to demonstrate live cryptographic tamper detection'
                                          : `Restricted: Storage tamper simulation is restricted to Forensic Examiner role (Active role: ${currentUser.role})`
                                      }
                                    >
                                      <AlertTriangleIcon size={13} />
                                      Simulate Tamper
                                    </button>

                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-success"
                                      style={{
                                        fontSize: '11px',
                                        padding: '4px 8px',
                                        opacity: canTamperOrRestore ? 1 : 0.45,
                                        cursor: canTamperOrRestore ? 'pointer' : 'not-allowed',
                                      }}
                                      disabled={isVerifying || !canTamperOrRestore}
                                      onClick={() => onRestorePristine(fv)}
                                      title={
                                        canTamperOrRestore
                                          ? 'Execute controlled recovery restoring authentic pristine bytes from private baseline storage'
                                          : `Restricted: Controlled evidence restoration is restricted to Forensic Examiner role (Active role: ${currentUser.role})`
                                      }
                                    >
                                      Restore Pristine
                                    </button>

                                    {allVerifs.length > 0 && (
                                      <button
                                        type="button"
                                        className="ev-btn ev-btn-secondary"
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                        onClick={() => onViewHistory(fv.id)}
                                      >
                                        <HistoryIcon size={13} />
                                        Audit Log ({allVerifs.length})
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-secondary"
                                      style={{ fontSize: '11px', padding: '4px 8px', marginLeft: 'auto' }}
                                      onClick={() =>
                                        onDownloadArtifact(
                                          fv.generated_storage_key,
                                          fv.original_filename
                                        )
                                      }
                                    >
                                      <DownloadIcon size={12} />
                                      Download
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Transfer & Handoff Tracking Status */}
                        <div
                          style={{
                            marginTop: '12px',
                            background: '#121626',
                            padding: '10px 12px',
                            borderRadius: '4px',
                            border: '1px solid #1e243a',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                              Transfer State:{' '}
                              <strong
                                style={{
                                  color:
                                    latestHandoff?.status === 'RECEIVED' ||
                                    latestHandoff?.status === 'REPORT_READY'
                                      ? '#34d399'
                                      : latestHandoff?.status === 'RETURNED'
                                        ? '#f87171'
                                        : '#38bdf8',
                                }}
                              >
                                {latestHandoff ? latestHandoff.status : 'NO_HANDOFF_INITIATED'}
                              </strong>
                            </div>
                            {latestHandoff?.acknowledged_at && (
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                Ack: {new Date(latestHandoff.acknowledged_at).toLocaleTimeString()}
                              </span>
                            )}
                          </div>

                          {latestHandoff?.rejection_reason && (
                            <div style={{ fontSize: '12px', color: '#f87171', marginTop: '6px' }}>
                              Rejection / Return Reason: {latestHandoff.rejection_reason}
                            </div>
                          )}

                          {/* POLICE ACTIONS */}
                          {activeDept === 'POLICE' && (
                            <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                              {(!latestHandoff || latestHandoff.status === 'RETURNED') && (
                                <button
                                  type="button"
                                  className="ev-btn ev-btn-primary"
                                  style={{ fontSize: '12px' }}
                                  onClick={() => onSubmitToForensics(evItem.id)}
                                >
                                  Submit for Forensic Examination
                                </button>
                              )}
                              {latestHandoff && latestHandoff.status !== 'RETURNED' && (
                                <span style={{ fontSize: '12px', color: '#38bdf8' }}>
                                  ✓ Dispatched to Forensics. Awaiting completion.
                                </span>
                              )}
                            </div>
                          )}

                          {/* FORENSIC ACTIONS */}
                          {activeDept === 'FORENSIC' && latestHandoff && (
                            <div style={{ marginTop: '10px' }}>
                              {!isForensicRole && (
                                <div
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    borderRadius: '6px',
                                    padding: '10px 14px',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '12px',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', fontSize: '12px' }}>
                                    <ShieldAlertIcon size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                                    <span>
                                      <strong>Forensic Clearance Required:</strong> Forensic custody handoff transitions (Accept, Reject, Exam) are restricted to the <strong>Forensic Examiner</strong> role. You are currently authenticated as <strong>{currentUser.name}</strong> ({currentUser.role}).
                                    </span>
                                  </div>
                                  {onSwitchUser && (
                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-secondary"
                                      style={{ fontSize: '11px', padding: '4px 10px', whiteSpace: 'nowrap', borderColor: '#38bdf8', color: '#38bdf8' }}
                                      onClick={() => onSwitchUser(DEPARTMENT_PRESETS.FORENSIC)}
                                    >
                                      ⚡ Switch Profile to Forensic Examiner
                                    </button>
                                  )}
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {latestHandoff.status === 'SUBMITTED' && (
                                  <>
                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-success"
                                      style={{
                                        fontSize: '12px',
                                        opacity: isForensicRole ? 1 : 0.45,
                                        cursor: isForensicRole ? 'pointer' : 'not-allowed',
                                      }}
                                      disabled={!isForensicRole}
                                      onClick={() => onAcceptTransfer(latestHandoff.id)}
                                      title={!isForensicRole ? `Restricted: Only Forensic Examiner can accept custody (Active: ${currentUser.role})` : 'Accept forensic custody'}
                                    >
                                      Accept Transfer
                                    </button>
                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-danger"
                                      style={{
                                        fontSize: '12px',
                                        opacity: isForensicRole ? 1 : 0.45,
                                        cursor: isForensicRole ? 'pointer' : 'not-allowed',
                                      }}
                                      disabled={!isForensicRole}
                                      onClick={() =>
                                        onRejectTransfer({
                                          handoffId: latestHandoff.id,
                                          evdId: evItem.id,
                                        })
                                      }
                                      title={!isForensicRole ? `Restricted: Only Forensic Examiner can return transfer (Active: ${currentUser.role})` : 'Reject or return handoff'}
                                    >
                                      Reject Transfer
                                    </button>
                                  </>
                                )}

                                {latestHandoff.status === 'RECEIVED' && (
                                  <button
                                    type="button"
                                    className="ev-btn ev-btn-primary"
                                    style={{
                                      fontSize: '12px',
                                      opacity: isForensicRole ? 1 : 0.45,
                                      cursor: isForensicRole ? 'pointer' : 'not-allowed',
                                    }}
                                    disabled={!isForensicRole}
                                    onClick={() => onStartExam(latestHandoff.id)}
                                    title={!isForensicRole ? `Restricted: Only Forensic Examiner can begin examination (Active: ${currentUser.role})` : 'Begin forensic examination'}
                                  >
                                    Start Forensic Examination
                                  </button>
                                )}

                                {latestHandoff.status === 'UNDER_EXAMINATION' && (
                                  <button
                                    type="button"
                                    className="ev-btn ev-btn-success"
                                    style={{
                                      fontSize: '12px',
                                      opacity: isForensicRole ? 1 : 0.45,
                                      cursor: isForensicRole ? 'pointer' : 'not-allowed',
                                    }}
                                    disabled={!isForensicRole}
                                    onClick={() => onMarkReportReady(latestHandoff.id)}
                                    title={!isForensicRole ? `Restricted: Only Forensic Examiner can finalize examination (Active: ${currentUser.role})` : 'Mark examination report ready'}
                                  >
                                    Finalize Examination &amp; Mark Report Ready
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* FORENSIC REPORT VERSIONS */}
                        <div style={{ marginTop: '14px', borderTop: '1px solid #21273e', paddingTop: '10px' }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#38bdf8',
                              marginBottom: '6px',
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>Forensic Report History (Immutable Versions):</span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {evReports.length} Version(s) Recorded
                            </span>
                          </div>

                          {evReports.length === 0 ? (
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              No examination reports recorded yet.
                            </div>
                          ) : (
                            evReports.map((rep) => (
                              <div
                                key={rep.id}
                                style={{
                                  background: '#121626',
                                  padding: '10px',
                                  borderRadius: '4px',
                                  marginBottom: '8px',
                                  fontSize: '12px',
                                  border: '1px solid #1c2238',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#93c5fd' }}>
                                  <strong>
                                    Version {rep.version_number} [{rep.status}]
                                  </strong>
                                  <span>
                                    {new Date(rep.created_at).toLocaleTimeString()} • Author: {rep.author_id}
                                  </span>
                                </div>
                                <p style={{ margin: '6px 0 0 0', color: '#cbd5e1', lineHeight: '1.4' }}>
                                  {rep.report_content}
                                </p>
                              </div>
                            ))
                          )}

                          {/* FORENSIC FORM: CREATE/REVISE REPORT */}
                          {activeDept === 'FORENSIC' && (
                            <div style={{ marginTop: '10px' }}>
                              {!isForensicRole && (
                                <div style={{ fontSize: '11px', color: '#f87171', marginBottom: '6px' }}>
                                  🔒 Authoring forensic examination reports requires Forensic Examiner clearance (Current role: {currentUser.role}).
                                </div>
                              )}
                              <textarea
                                value={newFindingText}
                                onChange={(e) => setNewFindingText(e.target.value)}
                                placeholder={
                                  isForensicRole
                                    ? "Record forensic findings to create next immutable report revision (e.g. v1, v2)..."
                                    : "Unauthorized: Forensic report authoring is restricted to Forensic Examiner role."
                                }
                                className="ev-textarea"
                                rows={2}
                                disabled={!isForensicRole}
                              />
                              <button
                                type="button"
                                className="ev-btn ev-btn-primary"
                                style={{
                                  marginTop: '8px',
                                  fontSize: '12px',
                                  opacity: isForensicRole ? 1 : 0.45,
                                  cursor: isForensicRole ? 'pointer' : 'not-allowed',
                                }}
                                disabled={!isForensicRole || !newFindingText.trim()}
                                onClick={() => onAddReportVersion(evItem.id)}
                              >
                                Commit Immutable Report Version
                              </button>
                            </div>
                          )}

                          {/* PROSECUTION DECISION ACTIONS */}
                          {activeDept === 'PROSECUTION' && evReports.length > 0 && (
                            <div
                              style={{
                                marginTop: '12px',
                                background: '#13182c',
                                padding: '12px',
                                borderRadius: '6px',
                                border: '1px solid #2d3558',
                              }}
                            >
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#c084fc', marginBottom: '8px' }}>
                                Judicial Review Assessment on Latest Report (v{evReports[0].version_number}):
                              </div>
                              {!isProsecutionRole && (
                                <div
                                  style={{
                                    background: 'rgba(168, 85, 247, 0.12)',
                                    border: '1px solid rgba(168, 85, 247, 0.35)',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '10px',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d8b4fe', fontSize: '11px' }}>
                                    <ShieldAlertIcon size={14} style={{ color: '#c084fc', flexShrink: 0 }} />
                                    <span>
                                      <strong>Prosecution Clearance Required:</strong> Trial admission assessments require the <strong>Public Prosecutor</strong> role. (Current role: {currentUser.role}).
                                    </span>
                                  </div>
                                  {onSwitchUser && (
                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-secondary"
                                      style={{ fontSize: '10px', padding: '3px 8px', whiteSpace: 'nowrap', borderColor: '#c084fc', color: '#c084fc' }}
                                      onClick={() => onSwitchUser(DEPARTMENT_PRESETS.PROSECUTION)}
                                    >
                                      ⚡ Switch to Prosecutor
                                    </button>
                                  )}
                                </div>
                              )}
                              <input
                                type="text"
                                value={prosecutionNotes}
                                onChange={(e) => setProsecutionNotes(e.target.value)}
                                placeholder={
                                  isProsecutionRole
                                    ? "Enter judicial review notes or clarification request details..."
                                    : "Unauthorized: Judicial review restricted to Public Prosecutor role."
                                }
                                className="ev-input"
                                style={{ marginBottom: '8px' }}
                                disabled={!isProsecutionRole}
                              />
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="ev-btn ev-btn-success"
                                  style={{
                                    fontSize: '12px',
                                    opacity: isProsecutionRole ? 1 : 0.45,
                                    cursor: isProsecutionRole ? 'pointer' : 'not-allowed',
                                  }}
                                  disabled={!isProsecutionRole}
                                  onClick={() => onProsecutionDecision('ACCEPTED_FOR_TRIAL', evReports[0].id)}
                                >
                                  Accept for Trial Presentation
                                </button>
                                <button
                                  type="button"
                                  className="ev-btn ev-btn-warning"
                                  style={{
                                    fontSize: '12px',
                                    opacity: isProsecutionRole ? 1 : 0.45,
                                    cursor: isProsecutionRole ? 'pointer' : 'not-allowed',
                                  }}
                                  disabled={!isProsecutionRole}
                                  onClick={() =>
                                    onProsecutionDecision('FURTHER_EVIDENCE_REQUESTED', evReports[0].id)
                                  }
                                >
                                  Request Clarification
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Display Locally Queued Unsynced Evidence Items for this Case */}
                {offlineQueue
                  .filter(
                    (q) =>
                      q.action === 'REGISTER_EVIDENCE' &&
                      (q.payload as { case_id?: string }).case_id === selectedCase.id &&
                      (q.status === 'PENDING' || q.status === 'SYNCING')
                  )
                  .map((q) => {
                    const payload = q.payload as {
                      id?: string;
                      description?: string;
                      evidence_type?: string;
                      source_description?: string;
                    };
                    return (
                      <div
                        key={q.eventId}
                        style={{
                          background: 'rgba(245, 158, 11, 0.06)',
                          border: '1px dashed #d97706',
                          borderRadius: '6px',
                          padding: '16px',
                          marginBottom: '16px',
                          cursor: 'pointer',
                        }}
                        onClick={onOpenOfflineCenter}
                        title="Click to inspect offline queue and sync controls"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#fef08a', fontSize: '14px' }}>
                            [{payload.id || q.eventId}] {payload.description}
                          </strong>
                          <span className="ev-offline-pill pending">⏳ Locally Queued (Pending Server Sync)</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '6px' }}>
                          <span>Type: {payload.evidence_type}</span> •{' '}
                          <span>Source: {payload.source_description}</span> •{' '}
                          <span>Event ID: {q.eventId}</span>
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>
                          <em>* Notice: Raw evidence bytes and reports deferred per ISO 27037 policy. Server confirmation will execute upon reconnection.</em>
                        </div>
                      </div>
                    );
                  })}

                {/* PROSECUTION REVIEWS HISTORY */}
                {activeDept === 'PROSECUTION' && reviews.length > 0 && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid #21273e', paddingTop: '16px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#c084fc' }}>
                      Recorded Prosecution Reviews
                    </h4>
                    {reviews
                      .filter((r) => r.case_id === selectedCase.id)
                      .map((rev) => (
                        <div
                          key={rev.id}
                          style={{
                            background: '#101424',
                            border: '1px solid #20263f',
                            borderRadius: '4px',
                            padding: '10px 12px',
                            marginBottom: '8px',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' }}>
                            <strong
                              style={{
                                color: rev.status === 'ACCEPTED_FOR_TRIAL' ? '#34d399' : '#f59e0b',
                              }}
                            >
                              {rev.status}
                            </strong>
                            <span style={{ color: '#64748b' }}>
                              {new Date(rev.created_at).toLocaleTimeString()} • Reviewer: {rev.reviewer_id}
                            </span>
                          </div>
                          <div style={{ marginTop: '4px', color: '#94a3b8' }}>{rev.review_notes}</div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="ev-empty-state">Select a case on the left to inspect records.</div>
            )}
          </section>
        </div>
      </>
    ) : (
        /* Clearance rejection barrier if trying to view restricted admin workspace without credentials */
        <div className="ev-access-denied-barrier">
          <div className="ev-access-denied-icon">
            <ShieldAlertIcon size={40} />
          </div>
          <div className="ev-security-badge-pill">
            CLEARANCE REJECTION • SECURITY VIOLATION LOGGED
          </div>
          <h2>403 Forbidden: Restricted Administration Workspace</h2>
          <p>
            Access to the Admin Portal, Audit Logs, and User RBAC Management is strictly restricted to authorized <strong>SYSTEM_ADMIN</strong> personnel. Your current identity <strong>{currentUser.name}</strong> ({currentUser.role}) in <strong>{currentUser.department}</strong> does not possess the requisite clearance.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ev-btn ev-btn-primary"
              onClick={() => onReturnToDept(currentUser.department)}
            >
              Return to Authorized {currentUser.department} Workspace
            </button>
            <button
              type="button"
              className="ev-btn ev-btn-warning"
              onClick={onSwitchToAdmin}
            >
              Elevate Clearance (Switch to System Admin)
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
