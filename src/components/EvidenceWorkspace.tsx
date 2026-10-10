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
}) => {
  const selectedCase: Case | undefined = cases.find((c) => c.id === selectedCaseId) || cases[0];
  const caseEvidence: EvidenceRecord[] = selectedCase
    ? evidence.filter((e) => e.case_id === selectedCase.id)
    : [];

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
        <div className="ev-grid-two-col">
          {/* Left Column: Shared Case Selector */}
          <section className="ev-card">
            <div className="ev-card-header">
              <div>
                <h3 className="ev-card-title">Shared Case Register (Single Source of Truth)</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  All 3 departments reference this exact record.
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

            {cases.length === 0 && offlineQueue.filter((q) => q.action === 'CREATE_CASE' && q.status === 'PENDING').length === 0 ? (
              <div className="ev-empty-state">No cases found in shared database.</div>
            ) : (
              <>
                {cases.map((c) => (
                  <div
                    key={c.id}
                    className={`ev-case-item ${selectedCase?.id === c.id ? 'selected' : ''}`}
                    onClick={() => setSelectedCaseId(c.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedCaseId(c.id);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="ev-case-title">{c.title}</span>
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
                      {activeDept === 'FORENSIC' && 'Forensic Workspace: Intake, Triage & Versioned Reports'}
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
                                      fontFamily: 'monospace',
                                    }}
                                  >
                                    Key: {fv.generated_storage_key}
                                  </div>

                                  {/* Hash Baseline & Observed Details */}
                                  <div
                                    style={{
                                      marginTop: '6px',
                                      background: '#070912',
                                      padding: '8px 10px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontFamily: 'monospace',
                                      border: '1px solid #161c30',
                                    }}
                                  >
                                    <div>
                                      <span style={{ color: '#94a3b8' }}>Baseline Manifest: </span>
                                      <span style={{ color: '#38bdf8' }}>{fv.sha256_hash}</span>
                                    </div>
                                    {latestVerif && latestVerif.observed_sha256 && (
                                      <div style={{ marginTop: '4px' }}>
                                        <span style={{ color: '#94a3b8' }}>Observed Storage: </span>
                                        <span
                                          style={{
                                            color:
                                              latestVerif.result === 'MATCH' ? '#34d399' : '#f87171',
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
                                      style={{ fontSize: '11px', padding: '4px 10px' }}
                                      disabled={isVerifying}
                                      onClick={() => onRunVerification(fv.id)}
                                    >
                                      <ShieldCheckIcon size={13} />
                                      {isVerifying ? 'Verifying Stream...' : 'Verify SHA-256'}
                                    </button>

                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-danger"
                                      style={{ fontSize: '11px', padding: '4px 8px' }}
                                      disabled={isVerifying}
                                      onClick={() => onSimulateTamper(fv)}
                                      title="Corrupt 1 byte in storage to demonstrate live tamper detection"
                                    >
                                      <AlertTriangleIcon size={13} />
                                      Simulate Tamper
                                    </button>

                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-success"
                                      style={{ fontSize: '11px', padding: '4px 8px' }}
                                      disabled={isVerifying}
                                      onClick={() => onRestorePristine(fv)}
                                      title="Restore original uncorrupted bytes"
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
                            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {latestHandoff.status === 'SUBMITTED' && (
                                <>
                                  <button
                                    type="button"
                                    className="ev-btn ev-btn-success"
                                    style={{ fontSize: '12px' }}
                                    onClick={() => onAcceptTransfer(latestHandoff.id)}
                                  >
                                    Accept Transfer
                                  </button>
                                  <button
                                    type="button"
                                    className="ev-btn ev-btn-danger"
                                    style={{ fontSize: '12px' }}
                                    onClick={() =>
                                      onRejectTransfer({
                                        handoffId: latestHandoff.id,
                                        evdId: evItem.id,
                                      })
                                    }
                                  >
                                    Reject Transfer
                                  </button>
                                </>
                              )}

                              {latestHandoff.status === 'RECEIVED' && (
                                <button
                                  type="button"
                                  className="ev-btn ev-btn-primary"
                                  style={{ fontSize: '12px' }}
                                  onClick={() => onStartExam(latestHandoff.id)}
                                >
                                  Start Forensic Examination
                                </button>
                              )}

                              {latestHandoff.status === 'UNDER_EXAMINATION' && (
                                <button
                                  type="button"
                                  className="ev-btn ev-btn-success"
                                  style={{ fontSize: '12px' }}
                                  onClick={() => onMarkReportReady(latestHandoff.id)}
                                >
                                  Finalize Examination &amp; Mark Report Ready
                                </button>
                              )}
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
                              <textarea
                                value={newFindingText}
                                onChange={(e) => setNewFindingText(e.target.value)}
                                placeholder="Record forensic findings to create next immutable report revision (e.g. v1, v2)..."
                                className="ev-textarea"
                                rows={2}
                              />
                              <button
                                type="button"
                                className="ev-btn ev-btn-primary"
                                style={{ marginTop: '8px', fontSize: '12px' }}
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
                              <input
                                type="text"
                                value={prosecutionNotes}
                                onChange={(e) => setProsecutionNotes(e.target.value)}
                                placeholder="Enter judicial review notes or clarification request details..."
                                className="ev-input"
                                style={{ marginBottom: '8px' }}
                              />
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="ev-btn ev-btn-success"
                                  style={{ fontSize: '12px' }}
                                  onClick={() => onProsecutionDecision('ACCEPTED_FOR_TRIAL', evReports[0].id)}
                                >
                                  Accept for Trial Presentation
                                </button>
                                <button
                                  type="button"
                                  className="ev-btn ev-btn-warning"
                                  style={{ fontSize: '12px' }}
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
