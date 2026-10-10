import React from 'react';
import type {
  Case,
  AuditDashboardFinding,
  WeeklyAuditSummary,
  ProsecutionCaseEvidenceIndexReport,
  SecurityContext,
} from '../../types.ts';
import { globalDb } from '../../data/db.ts';
import { AuditReviewEngine } from '../../utils/auditReview.ts';
import {
  CalendarIcon,
  DownloadIcon,
  XIcon,
  FilterIcon,
  HistoryIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  FileTextIcon,
  ClockIcon,
  CheckCircleIcon,
} from '../icons.tsx';

export interface WeeklyAuditDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditDashboardTab: 'ALL' | 'CONFIRMED' | 'WARNINGS' | 'SUSPICIONS' | 'CASE_INDEX' | 'AUTOMATION';
  setAuditDashboardTab: (tab: 'ALL' | 'CONFIRMED' | 'WARNINGS' | 'SUSPICIONS' | 'CASE_INDEX' | 'AUTOMATION') => void;
  auditDatePreset: '7_DAYS' | '30_DAYS' | '90_DAYS' | 'CUSTOM';
  setAuditDatePreset: (p: '7_DAYS' | '30_DAYS' | '90_DAYS' | 'CUSTOM') => void;
  auditStartDate: string;
  setAuditStartDate: (d: string) => void;
  auditEndDate: string;
  setAuditEndDate: (d: string) => void;
  auditSelectedCaseId: string;
  setAuditSelectedCaseId: (id: string) => void;
  cases: Case[];
  auditFindings: AuditDashboardFinding[];
  auditWeeklySummary: WeeklyAuditSummary | null;
  auditCaseEvidenceIndex: ProsecutionCaseEvidenceIndexReport | null;
  setAuditCaseEvidenceIndex: (index: ProsecutionCaseEvidenceIndexReport | null) => void;
  auditIsGenerating: boolean;
  auditExportFeedback: string | null;
  auditSchedulerInfo: {
    isIntervalActive: boolean;
    lastRunAt: string | null;
    mode: string;
  };
  currentUserId?: string;
  currentUserRole?: string;
  onRunAuditReview: () => void;
  onExportWeeklySummaryCsv: () => void;
  onExportCaseIndexCsv: () => void;
  onToggleSchedulerTimer: () => void;
}

export const WeeklyAuditDashboardModal: React.FC<WeeklyAuditDashboardModalProps> = ({
  isOpen,
  onClose,
  auditDashboardTab,
  setAuditDashboardTab,
  auditDatePreset,
  setAuditDatePreset,
  auditStartDate,
  setAuditStartDate,
  auditEndDate,
  setAuditEndDate,
  auditSelectedCaseId,
  setAuditSelectedCaseId,
  cases,
  auditFindings,
  auditWeeklySummary,
  auditCaseEvidenceIndex,
  setAuditCaseEvidenceIndex,
  auditIsGenerating,
  auditExportFeedback,
  auditSchedulerInfo,
  currentUserId,
  currentUserRole,
  onRunAuditReview,
  onExportWeeklySummaryCsv,
  onExportCaseIndexCsv,
  onToggleSchedulerTimer,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="ev-audit-modal-overlay"
      onClick={onClose}
    >
      <div
        className="ev-audit-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="ev-audit-modal-header">
          <div className="ev-audit-modal-title">
            <div style={{ background: '#0284c7', color: '#fff', padding: '8px', borderRadius: '8px', display: 'flex' }}>
              <CalendarIcon size={20} />
            </div>
            <div>
              <h2>Weekly Audit Review &amp; Prosecution Index</h2>
              <p>
                Cryptographic Integrity Verification • SLA Handoff Monitoring • BNSS Section 65B Prosecution Index
              </p>
            </div>
          </div>

          <div className="ev-audit-header-actions">
            <button
              type="button"
              className="ev-btn ev-btn-secondary"
              onClick={onExportWeeklySummaryCsv}
              disabled={!auditWeeklySummary}
              title="Export Weekly Audit Compliance Report as CSV"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
            >
              <DownloadIcon size={14} />
              <span>Export Weekly CSV</span>
            </button>
            <button
              type="button"
              className="ev-login-modal-close"
              onClick={onClose}
              title="Close Audit Dashboard"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="ev-audit-modal-body">
          {/* Feedback toast */}
          {auditExportFeedback && (
            <div className="ev-audit-feedback-toast">
              {auditExportFeedback}
            </div>
          )}

          {/* Date Filter & Execution Control Bar */}
          <div className="ev-audit-control-bar">
            <div className="ev-audit-filter-cluster">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
                <FilterIcon size={14} />
                <span>Observation Window:</span>
              </div>

              <div className="ev-audit-preset-group">
                <button
                  type="button"
                  className={`ev-audit-preset-btn ${auditDatePreset === '7_DAYS' ? 'active' : ''}`}
                  onClick={() => {
                    setAuditDatePreset('7_DAYS');
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    setAuditStartDate(d.toISOString().split('T')[0]);
                    setAuditEndDate(new Date().toISOString().split('T')[0]);
                  }}
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  className={`ev-audit-preset-btn ${auditDatePreset === '30_DAYS' ? 'active' : ''}`}
                  onClick={() => {
                    setAuditDatePreset('30_DAYS');
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    setAuditStartDate(d.toISOString().split('T')[0]);
                    setAuditEndDate(new Date().toISOString().split('T')[0]);
                  }}
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  className={`ev-audit-preset-btn ${auditDatePreset === '90_DAYS' ? 'active' : ''}`}
                  onClick={() => {
                    setAuditDatePreset('90_DAYS');
                    const d = new Date();
                    d.setDate(d.getDate() - 90);
                    setAuditStartDate(d.toISOString().split('T')[0]);
                    setAuditEndDate(new Date().toISOString().split('T')[0]);
                  }}
                >
                  Quarter (90d)
                </button>
                <button
                  type="button"
                  className={`ev-audit-preset-btn ${auditDatePreset === 'CUSTOM' ? 'active' : ''}`}
                  onClick={() => setAuditDatePreset('CUSTOM')}
                >
                  Custom
                </button>
              </div>

              <div className="ev-audit-date-inputs">
                <input
                  type="date"
                  value={auditStartDate}
                  onChange={(e) => {
                    setAuditStartDate(e.target.value);
                    setAuditDatePreset('CUSTOM');
                  }}
                />
                <span>to</span>
                <input
                  type="date"
                  value={auditEndDate}
                  onChange={(e) => {
                    setAuditEndDate(e.target.value);
                    setAuditDatePreset('CUSTOM');
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              className="ev-btn ev-btn-primary"
              onClick={onRunAuditReview}
              disabled={auditIsGenerating}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}
            >
              <HistoryIcon size={14} />
              <span>{auditIsGenerating ? 'Auditing Vault...' : 'Run Audit Review'}</span>
            </button>
          </div>

          {/* Cryptographic Audit Chain Verification Status Banner */}
          <div
            className={`ev-audit-chain-banner ${
              auditWeeklySummary?.auditChainIntegrityStatus === 'COMPROMISED' ? 'compromised' : 'intact'
            }`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {auditWeeklySummary?.auditChainIntegrityStatus === 'COMPROMISED' ? (
                <ShieldAlertIcon size={20} />
              ) : (
                <ShieldCheckIcon size={20} />
              )}
              <div>
                <strong style={{ fontSize: '13px' }}>
                  {auditWeeklySummary?.auditChainIntegrityStatus === 'COMPROMISED'
                    ? 'CRITICAL ALERT: Audit Ledger Hash Chain Broken / Compromised!'
                    : 'Audit Ledger Cryptographically Verified Intact'}
                </strong>
                <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>
                  {auditWeeklySummary?.auditChainIntegrityStatus === 'COMPROMISED'
                    ? 'One or more cryptographic blocks have mismatched previous hashes. Data integrity cannot be legally guaranteed.'
                    : `Verified unbroken SHA-256 chain across ${auditWeeklySummary?.totalAuditBlocksEvaluated || 0} blocks. Zero cryptographic tampering detected.`}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: '11px', opacity: 0.85 }}>
              <div>Audit Timestamp: {auditWeeklySummary ? new Date(auditWeeklySummary.generatedAt).toLocaleTimeString() : 'Pending'}</div>
              <div>Auditor: {auditWeeklySummary?.generatedBy || 'System'}</div>
            </div>
          </div>

          {/* Weekly Rollup Metric Cards */}
          <div className="ev-audit-stat-grid">
            <div className="ev-audit-stat-card">
              <span className="ev-audit-stat-label">Total Findings</span>
              <span className="ev-audit-stat-val">{auditWeeklySummary?.totalFindingsCount ?? 0}</span>
            </div>
            <div className="ev-audit-stat-card confirmed">
              <span className="ev-audit-stat-label">Confirmed Findings</span>
              <span className="ev-audit-stat-val">{auditWeeklySummary?.confirmedFindingsCount ?? 0}</span>
            </div>
            <div className="ev-audit-stat-card warnings">
              <span className="ev-audit-stat-label">Warnings</span>
              <span className="ev-audit-stat-val">{auditWeeklySummary?.warningsCount ?? 0}</span>
            </div>
            <div className="ev-audit-stat-card suspicions">
              <span className="ev-audit-stat-label">Suspicions</span>
              <span className="ev-audit-stat-val">{auditWeeklySummary?.unverifiedSuspicionsCount ?? 0}</span>
            </div>
            <div className="ev-audit-stat-card">
              <span className="ev-audit-stat-label">Bit Mismatches</span>
              <span className="ev-audit-stat-val" style={{ color: (auditWeeklySummary?.mismatchedIntegrityCount || 0) > 0 ? '#ef4444' : '#10b981' }}>
                {auditWeeklySummary?.mismatchedIntegrityCount ?? 0}
              </span>
            </div>
            <div className="ev-audit-stat-card">
              <span className="ev-audit-stat-label">Security Blocks</span>
              <span className="ev-audit-stat-val" style={{ color: (auditWeeklySummary?.securityViolationAttempts || 0) > 0 ? '#f59e0b' : '#94a3b8' }}>
                {auditWeeklySummary?.securityViolationAttempts ?? 0}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="ev-audit-tabs-row">
            <button
              type="button"
              className={`ev-audit-tab-btn ${auditDashboardTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setAuditDashboardTab('ALL')}
            >
              <span>All Findings</span>
              <span className="ev-badge-count">{auditFindings.length}</span>
            </button>
            <button
              type="button"
              className={`ev-audit-tab-btn ${auditDashboardTab === 'CONFIRMED' ? 'active' : ''}`}
              onClick={() => setAuditDashboardTab('CONFIRMED')}
            >
              <span>Confirmed Findings</span>
              <span className="ev-badge-count" style={{ background: '#7f1d1d' }}>
                {auditFindings.filter((f) => f.classification === 'CONFIRMED_FINDING').length}
              </span>
            </button>
            <button
              type="button"
              className={`ev-audit-tab-btn ${auditDashboardTab === 'WARNINGS' ? 'active' : ''}`}
              onClick={() => setAuditDashboardTab('WARNINGS')}
            >
              <span>Warnings</span>
              <span className="ev-badge-count" style={{ background: '#78350f' }}>
                {auditFindings.filter((f) => f.classification === 'WARNING').length}
              </span>
            </button>
            <button
              type="button"
              className={`ev-audit-tab-btn ${auditDashboardTab === 'SUSPICIONS' ? 'active' : ''}`}
              onClick={() => setAuditDashboardTab('SUSPICIONS')}
            >
              <span>Suspicions</span>
              <span className="ev-badge-count" style={{ background: '#4c1d95' }}>
                {auditFindings.filter((f) => f.classification === 'UNVERIFIED_SUSPICION').length}
              </span>
            </button>
            <button
              type="button"
              className={`ev-audit-tab-btn ${auditDashboardTab === 'CASE_INDEX' ? 'active' : ''}`}
              onClick={() => setAuditDashboardTab('CASE_INDEX')}
            >
              <FileTextIcon size={14} />
              <span>Prosecution Case Index</span>
            </button>
            <button
              type="button"
              className={`ev-audit-tab-btn ${auditDashboardTab === 'AUTOMATION' ? 'active' : ''}`}
              onClick={() => setAuditDashboardTab('AUTOMATION')}
            >
              <ClockIcon size={14} />
              <span>Weekly Automation</span>
            </button>
          </div>

          {/* Tab 1-4: Findings Table */}
          {(auditDashboardTab === 'ALL' ||
            auditDashboardTab === 'CONFIRMED' ||
            auditDashboardTab === 'WARNINGS' ||
            auditDashboardTab === 'SUSPICIONS') && (
            <div>
              <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: '#090e1a', borderRadius: '6px', border: '1px solid #1e293d', marginBottom: '12px', fontSize: '11px', color: '#94a3b8' }}>
                <div style={{ fontWeight: 600, color: '#cbd5e1' }}>Classification Rigor:</div>
                <div>
                  <strong style={{ color: '#f87171' }}>Confirmed Findings:</strong> Deterministically verified by cryptographic math or system error logs. |{' '}
                  <strong style={{ color: '#fbbf24' }}>Warnings:</strong> Operational SLA handoff delays or pending documentation. |{' '}
                  <strong style={{ color: '#a78bfa' }}>Suspicions:</strong> Unverified anomalies flagged for cross-departmental inquiry.
                </div>
              </div>

              {(() => {
                const filtered = auditFindings.filter((f) => {
                  if (auditDashboardTab === 'CONFIRMED') return f.classification === 'CONFIRMED_FINDING';
                  if (auditDashboardTab === 'WARNINGS') return f.classification === 'WARNING';
                  if (auditDashboardTab === 'SUSPICIONS') return f.classification === 'UNVERIFIED_SUSPICION';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ padding: '36px', textAlign: 'center', background: '#090e1a', borderRadius: '8px', border: '1px solid #1e293d', color: '#64748b' }}>
                      <CheckCircleIcon size={32} />
                      <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>
                        Zero findings recorded for this classification filter
                      </div>
                      <div style={{ fontSize: '11px', marginTop: '4px' }}>
                        All items within observation window {auditStartDate} to {auditEndDate} comply with cryptographic and operational standards.
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="ev-findings-table-wrap">
                    <table className="ev-findings-table">
                      <thead>
                        <tr>
                          <th>Classification</th>
                          <th>Severity</th>
                          <th>Category</th>
                          <th>Description &amp; Detail</th>
                          <th>Target Case &amp; Event</th>
                          <th>Timestamp</th>
                          <th>Recommended Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((finding) => (
                          <tr key={finding.findingId}>
                            <td>
                              <span
                                className={`ev-finding-badge ${
                                  finding.classification === 'CONFIRMED_FINDING'
                                    ? 'confirmed'
                                    : finding.classification === 'WARNING'
                                      ? 'warning'
                                      : 'suspicion'
                                }`}
                              >
                                {finding.classification === 'CONFIRMED_FINDING'
                                  ? 'CONFIRMED'
                                  : finding.classification === 'WARNING'
                                    ? 'WARNING'
                                    : 'SUSPICION'}
                              </span>
                            </td>
                            <td>
                              <span className={`ev-severity-pill ${finding.severity.toLowerCase()}`}>
                                {finding.severity}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#93c5fd' }}>
                                {finding.category}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{finding.title}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                {finding.description}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#38bdf8' }}>
                                {finding.caseId || 'GLOBAL'}
                              </div>
                              {finding.eventId && (
                                <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b' }}>
                                  Event: {finding.eventId}
                                </div>
                              )}
                              {finding.sourceRecordId && (
                                <div style={{ fontSize: '10px', color: '#475569' }}>
                                  {finding.sourceRecordType}: {finding.sourceRecordId}
                                </div>
                              )}
                            </td>
                            <td>
                              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                                {new Date(finding.timestamp).toLocaleString()}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic' }}>
                                {finding.recommendedAction}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tab 5: Prosecution Case Evidence Index & Section 65B Certification */}
          {auditDashboardTab === 'CASE_INDEX' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111827', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>
                    Target Judicial Case:
                  </label>
                  <select
                    value={auditSelectedCaseId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setAuditSelectedCaseId(newId);
                      const actorCtx: SecurityContext = {
                        actorId: currentUserId || 'USR-PROSECUTOR-01',
                        role: (currentUserRole as any) || 'PUBLIC_PROSECUTOR',
                      };
                      const newIndex = AuditReviewEngine.generateProsecutionEvidenceIndex(
                        globalDb,
                        newId,
                        actorCtx
                      );
                      setAuditCaseEvidenceIndex(newIndex);
                    }}
                    style={{ background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', outline: 'none' }}
                  >
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.case_reference} — {c.title} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="ev-btn ev-btn-primary"
                  onClick={onExportCaseIndexCsv}
                  disabled={!auditCaseEvidenceIndex}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
                >
                  <DownloadIcon size={14} />
                  <span>Export Case Index CSV (RFC-4180)</span>
                </button>
              </div>

              {auditCaseEvidenceIndex && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#090e1a', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1e293d' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Case Reference</span>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{auditCaseEvidenceIndex.caseReference}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Title</span>
                    <div style={{ fontSize: '13px', color: '#93c5fd' }}>{auditCaseEvidenceIndex.caseTitle}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Integrity Status</span>
                    <div style={{ fontSize: '13px', color: '#a7f3d0' }}>
                      Verified: {auditCaseEvidenceIndex.verifiedIntegrityCount} / {auditCaseEvidenceIndex.totalEvidenceItems}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Evidence Items</span>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>{auditCaseEvidenceIndex.totalEvidenceItems} registered</div>
                  </div>
                </div>
              )}

              <div className="ev-findings-table-wrap">
                <table className="ev-findings-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th>Baseline SHA-256</th>
                      <th>Integrity Status</th>
                      <th>Transfers</th>
                      <th>Forensic Report</th>
                      <th>BNSS 65B Admissibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditCaseEvidenceIndex?.entries.map((entry) => (
                      <tr key={entry.evidenceId}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#38bdf8' }}>
                          {entry.evidenceCode}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{entry.description}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            Key: {entry.storageObjectKey || 'Physical Item'}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: '#cbd5e1' }}>{entry.category}</span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
                          {entry.baselineSha256 ? `${entry.baselineSha256.slice(0, 16)}...` : 'NONE'}
                        </td>
                        <td>
                          <span
                            className={`ev-severity-pill ${
                              entry.currentVerificationOutcome === 'MATCH'
                                ? 'low'
                                : entry.currentVerificationOutcome === 'MISMATCH'
                                  ? 'critical'
                                  : 'info'
                            }`}
                          >
                            {entry.currentVerificationOutcome}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{entry.custodyTransferCount} transfers</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: entry.hasForensicReport ? '#34d399' : '#f59e0b' }}>
                            {entry.hasForensicReport ? 'Complete' : 'Pending'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: entry.courtAdmissibilityStatus === 'ADMISSIBLE_CERTIFIED_65B' ? '#34d399' : '#fbbf24' }}>
                            {entry.courtAdmissibilityStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                  BNSS Section 65B Electronic Record Admissibility Certification
                </div>
                <div className="ev-cert-statement-box">
                  {auditCaseEvidenceIndex?.judicialCertificationSection65B}
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: Automation & Scheduler Architecture Status */}
          {auditDashboardTab === 'AUTOMATION' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#090e1a', padding: '16px', borderRadius: '8px', border: '1px solid #1e293d' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#f8fafc' }}>
                  Audit Automation &amp; Periodic Scheduling Engine
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Strict Architectural Requirement: To maintain authentic verifiable compliance without phantom metrics, automated recurring schedules must be backed by a real server-side timer daemon or cron task. In standalone frontend mode, manual on-demand triggers guarantee exact ledger state.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ background: '#111827', padding: '14px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Scheduler Operational Mode</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                    {auditSchedulerInfo.mode}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    Manual on-demand audits are authoritative. An in-process interval timer is available for dev simulation.
                  </div>
                </div>

                <div style={{ background: '#111827', padding: '14px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>In-Process Background Interval</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: auditSchedulerInfo.isIntervalActive ? '#34d399' : '#f59e0b', marginTop: '4px' }}>
                    {auditSchedulerInfo.isIntervalActive ? 'ACTIVE (7-Day Simulated Cadence)' : 'INACTIVE (Manual Trigger Only)'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    Last Run: {auditSchedulerInfo.lastRunAt ? new Date(auditSchedulerInfo.lastRunAt).toLocaleString() : 'Never'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111827', padding: '14px 18px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                <div>
                  <strong style={{ fontSize: '13px', color: '#f8fafc' }}>Toggle In-Process Weekly Audit Scheduler</strong>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Starts or stops the local in-process timer. Logs audit execution to database ledger automatically.
                  </div>
                </div>

                <button
                  type="button"
                  className={`ev-btn ${auditSchedulerInfo.isIntervalActive ? 'ev-btn-secondary' : 'ev-btn-primary'}`}
                  onClick={onToggleSchedulerTimer}
                >
                  {auditSchedulerInfo.isIntervalActive ? 'Stop In-Process Scheduler' : 'Start In-Process Scheduler'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '14px 24px', background: '#0a0e1c', borderTop: '1px solid #1e263d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            EvidenceVault 360 Phase 9 • ISO 27037 / FIPS 180-4 / BNSS Section 65B Audit Standard
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="ev-btn ev-btn-secondary"
              onClick={onExportWeeklySummaryCsv}
              disabled={!auditWeeklySummary}
            >
              Export Compliance CSV
            </button>
            <button
              type="button"
              className="ev-btn ev-btn-primary"
              onClick={onClose}
            >
              Close Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
