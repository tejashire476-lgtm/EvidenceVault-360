import React, { useState, useMemo } from 'react';
import type {
  Case,
  EvidenceRecord,
  EvidenceHandoff,
  ForensicReport,
  ProsecutionReview,
  EvidenceFileVersion,
  AuthenticatedSession,
} from '../../types.ts';
import { globalDb } from '../../data/db.ts';
import {
  FileCodeIcon,
  ShieldCheckIcon,
  SearchIcon,
  SlidersIcon,
  ClockIcon,
  BellIcon,
  MoonIcon,
  SunIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  UserIcon,
  LayoutDashboardIcon,
  CpuIcon,
  DatabaseIcon,
  FileTextIcon,
  HistoryIcon,
  SendIcon,
} from '../icons.tsx';

export interface ForensicPortalProps {
  currentUser: AuthenticatedSession;
  cases: Case[];
  evidence: EvidenceRecord[];
  handoffs: EvidenceHandoff[];
  reports: ForensicReport[];
  reviews: ProsecutionReview[];
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  verifyingFileId: string | null;
  onRunVerification: (fileVersionId: string) => void;
  onSimulateTamper: (fv: EvidenceFileVersion) => void;
  onRestorePristine: (fv: EvidenceFileVersion) => void;
  onViewHistory: (fileVersionId: string) => void;
  onDownloadArtifact: (key: string, filename: string) => void;
  onAcceptTransfer: (handoffId: string) => void;
  onRejectTransfer: (data: { handoffId: string; evdId: string }) => void;
  onStartExam: (handoffId: string) => void;
  onMarkReportReady: (handoffId: string) => void;
  newFindingText: string;
  setNewFindingText: (v: string) => void;
  onAddReportVersion: (evId: string) => void;
  forensicResponseDraft?: Record<string, string>;
  setForensicResponseDraft?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onRespondToClarification?: (reviewId: string, notes: string, amendedReport?: string) => void;
  isSubmittingReview?: boolean;
  onOpenCaseIndex: () => void;
  onOpenOfflineCenter: () => void;
  onLogout: () => void;
  onOpenCyberDashboard?: () => void;
}

export type ForensicNavTab =
  | 'DASHBOARD'
  | 'INCOMING_EVIDENCE'
  | 'EXAMINATION_QUEUE'
  | 'EVIDENCE_VAULT'
  | 'INTEGRITY_VERIFICATION'
  | 'FORENSIC_ANALYSIS'
  | 'CLARIFICATION_REQUESTS'
  | 'REPORT_BUILDER'
  | 'REPORT_VERSIONS'
  | 'CHAIN_OF_CUSTODY'
  | 'NOTIFICATIONS'
  | 'PROFILE';

export const ForensicPortal: React.FC<ForensicPortalProps> = ({
  currentUser,
  cases: _cases,
  evidence,
  handoffs,
  reports,
  reviews,
  selectedCaseId: _selectedCaseId,
  setSelectedCaseId: _setSelectedCaseId,
  verifyingFileId,
  onRunVerification,
  onSimulateTamper,
  onRestorePristine,
  onViewHistory: _onViewHistory,
  onDownloadArtifact: _onDownloadArtifact,
  onAcceptTransfer,
  onRejectTransfer,
  onStartExam,
  onMarkReportReady,
  newFindingText,
  setNewFindingText,
  onAddReportVersion,
  forensicResponseDraft = {},
  setForensicResponseDraft,
  onRespondToClarification,
  isSubmittingReview,
  onOpenCaseIndex,
  onOpenOfflineCenter,
  onLogout,
  onOpenCyberDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<ForensicNavTab>('DASHBOARD');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Filter clarification inquiries from prosecution
  const clarificationRequests = useMemo(() => {
    return reviews.filter(
      (r) => r.status === 'FURTHER_EVIDENCE_REQUESTED' || r.clarification_status === 'PENDING'
    );
  }, [reviews]);

  const pendingClarifications = clarificationRequests.filter(
    (r) => r.clarification_status !== 'RESPONDED'
  );

  // Incoming vs in-analysis handoffs
  const incomingAwaitingAck = useMemo(() => {
    return handoffs.filter((h) => h.status === 'DRAFT' || h.status === 'SUBMITTED');
  }, [handoffs]);

  const underAnalysis = useMemo(() => {
    return handoffs.filter((h) => h.status === 'RECEIVED' || h.status === 'UNDER_EXAMINATION');
  }, [handoffs]);

  // Handlers with instant feedback
  const handleAckTransfer = (handoffId: string) => {
    try {
      onAcceptTransfer(handoffId);
      setActionFeedback(`Custody acknowledged for Handoff #${handoffId.slice(0, 8)}. Physical & digital custody transferred to CFSL.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message || 'Failed'}`);
    }
  };

  const handleStartExamination = (handoffId: string) => {
    try {
      onStartExam(handoffId);
      setActionFeedback(`Forensic examination started for Handoff #${handoffId.slice(0, 8)}.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message || 'Failed'}`);
    }
  };

  const handleFinalizeReport = (handoffId: string) => {
    try {
      onMarkReportReady(handoffId);
      setActionFeedback(`Forensic report marked ready for Handoff #${handoffId.slice(0, 8)}.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message || 'Failed'}`);
    }
  };

  return (
    <div className={`ev-cyber-layout ${isDarkMode ? 'dark-mode' : 'tactical-mode'}`}>
      {/* 1. Left Sidebar Navigation */}
      <aside className="ev-cyber-sidebar">
        <div className="ev-cyber-brand">
          <div className="ev-cyber-logo-icon" style={{ background: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)' }}>
            <FileCodeIcon size={24} />
          </div>
          <div className="ev-cyber-brand-text">
            <h2>CFSL FORENSICS</h2>
            <span style={{ color: '#22d3ee' }}>Laboratory Analysis</span>
          </div>
        </div>

        <nav className="ev-cyber-nav">
          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'DASHBOARD' ? 'active' : ''}`}
            onClick={() => setActiveTab('DASHBOARD')}
          >
            <LayoutDashboardIcon size={18} />
            <span>Forensic Dashboard</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'INCOMING_EVIDENCE' ? 'active' : ''}`}
            onClick={() => setActiveTab('INCOMING_EVIDENCE')}
          >
            <ClockIcon size={18} />
            <span>Incoming Evidence</span>
            {incomingAwaitingAck.length > 0 && (
              <span className="ev-cyber-badge-chip" style={{ marginLeft: 'auto', background: '#f59e0b', color: '#000' }}>
                {incomingAwaitingAck.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'EXAMINATION_QUEUE' ? 'active' : ''}`}
            onClick={() => setActiveTab('EXAMINATION_QUEUE')}
          >
            <CpuIcon size={18} />
            <span>Examination Queue</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'EVIDENCE_VAULT' ? 'active' : ''}`}
            onClick={() => setActiveTab('EVIDENCE_VAULT')}
          >
            <DatabaseIcon size={18} />
            <span>Evidence Vault</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'INTEGRITY_VERIFICATION' ? 'active' : ''}`}
            onClick={() => setActiveTab('INTEGRITY_VERIFICATION')}
          >
            <ShieldCheckIcon size={18} />
            <span>SHA-256 Verification</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'FORENSIC_ANALYSIS' ? 'active' : ''}`}
            onClick={() => setActiveTab('FORENSIC_ANALYSIS')}
          >
            <SearchIcon size={18} />
            <span>Forensic Analysis</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'CLARIFICATION_REQUESTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('CLARIFICATION_REQUESTS')}
          >
            <AlertTriangleIcon size={18} />
            <span>Clarification Requests</span>
            {pendingClarifications.length > 0 && (
              <span className="ev-cyber-badge-chip" style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff' }}>
                {pendingClarifications.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'REPORT_BUILDER' ? 'active' : ''}`}
            onClick={() => setActiveTab('REPORT_BUILDER')}
          >
            <FileTextIcon size={18} />
            <span>Forensic Report Builder</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'REPORT_VERSIONS' ? 'active' : ''}`}
            onClick={() => setActiveTab('REPORT_VERSIONS')}
          >
            <HistoryIcon size={18} />
            <span>Report Versions</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'CHAIN_OF_CUSTODY' ? 'active' : ''}`}
            onClick={() => setActiveTab('CHAIN_OF_CUSTODY')}
          >
            <ShieldCheckIcon size={18} />
            <span>Chain of Custody</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'NOTIFICATIONS' ? 'active' : ''}`}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <BellIcon size={18} />
            <span>Notifications</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'PROFILE' ? 'active' : ''}`}
            onClick={() => setActiveTab('PROFILE')}
          >
            <UserIcon size={18} />
            <span>Scientist Profile</span>
          </button>

          {onOpenCyberDashboard && (
            <button
              type="button"
              className="ev-cyber-nav-item"
              onClick={onOpenCyberDashboard}
              style={{ borderColor: 'rgba(6, 182, 212, 0.4)', background: 'rgba(6, 182, 212, 0.08)' }}
              title="Open Cyber Command Center"
            >
              <LayoutDashboardIcon size={18} className="text-cyan" />
              <span>Cyber Command Center</span>
            </button>
          )}
        </nav>

        <div className="ev-cyber-quote-card" style={{ borderColor: 'rgba(6, 182, 212, 0.3)' }}>
          <div className="ev-cyber-quote-icon">
            <CpuIcon size={18} />
          </div>
          <p className="ev-cyber-quote-text">
            &ldquo;Science Does Not Lie. Hashes Do Not Lie.&rdquo;
          </p>
          <span className="ev-cyber-quote-author">— Central Forensic Science Lab</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="ev-cyber-main-wrapper">
        <header className="ev-cyber-topbar">
          <div className="ev-cyber-search-box">
            <SearchIcon size={16} className="ev-cyber-search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evidence hashes, exam notes, lab case reference..."
            />
          </div>

          <div className="ev-cyber-topbar-controls">
            <div className="ev-cyber-control-btn-wrapper">
              <button
                type="button"
                className="ev-cyber-icon-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                title="Forensic Lab Alerts"
              >
                <BellIcon size={18} />
                {(incomingAwaitingAck.length > 0 || pendingClarifications.length > 0) && (
                  <span className="ev-cyber-badge-dot" />
                )}
              </button>

              {showNotifications && (
                <div className="ev-cyber-dropdown-menu notifications">
                  <div className="ev-cyber-dropdown-header">
                    <h4>Lab Queue Notifications</h4>
                    <span className="ev-cyber-badge-chip">{pendingClarifications.length + incomingAwaitingAck.length} Pending</span>
                  </div>
                  {pendingClarifications.map((r) => (
                    <div key={r.id} className="ev-cyber-dropdown-item">
                      <AlertTriangleIcon size={14} className="text-amber" />
                      <div>
                        <strong>Judicial Clarification Notice</strong>
                        <p>{r.review_notes.slice(0, 60)}...</p>
                        <small>From: {r.reviewer_id}</small>
                      </div>
                    </div>
                  ))}
                  {incomingAwaitingAck.map((h) => (
                    <div key={h.id} className="ev-cyber-dropdown-item">
                      <ClockIcon size={14} className="text-cyan" />
                      <div>
                        <strong>Incoming Custody Transfer</strong>
                        <p>Evidence ID: {h.evidence_id}</p>
                        <small>From Police: {h.submitted_by}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="ev-cyber-icon-btn"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="Toggle Theme"
            >
              {isDarkMode ? <MoonIcon size={18} /> : <SunIcon size={18} />}
            </button>

            <button
              type="button"
              className="ev-cyber-icon-btn"
              onClick={onOpenOfflineCenter}
              title="Offline Field Mode"
            >
              <SlidersIcon size={18} />
            </button>

            <div className="ev-cyber-user-pill-wrapper">
              <button
                type="button"
                className="ev-cyber-user-profile-btn"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <div className="ev-cyber-user-avatar" style={{ background: '#0891b2' }}>
                  <UserIcon size={18} />
                </div>
                <div className="ev-cyber-user-details">
                  <span className="ev-cyber-user-name">{currentUser.name || 'Dr. Sunita Kulkarni'}</span>
                  <span className="ev-cyber-user-role" style={{ color: '#22d3ee' }}>
                    FORENSIC EXAMINER • {currentUser.badge}
                  </span>
                </div>
              </button>

              {showProfileMenu && (
                <div className="ev-cyber-dropdown-menu profile">
                  <div className="ev-cyber-dropdown-header">
                    <h4>CFSL Examiner Session</h4>
                    <small>Cyber Forensics Division</small>
                  </div>
                  <div className="ev-cyber-dropdown-item">
                    <div>
                      <strong>Badge:</strong> {currentUser.badge}
                      <br />
                      <strong>Role:</strong> {currentUser.role}
                      <br />
                      <strong>Lab:</strong> CFSL Digital Forensics Unit
                    </div>
                  </div>
                  <div className="ev-cyber-dropdown-divider" />
                  <button
                    type="button"
                    className="ev-cyber-role-switch-item logout"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout();
                    }}
                  >
                    <span>Secure Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Forensic Workspace Body */}
        <main className="ev-cyber-content">
          {/* Welcome Banner */}
          <section className="ev-cyber-welcome-banner" style={{ borderLeft: '4px solid #06b6d4' }}>
            <div className="ev-cyber-welcome-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="ev-cyber-badge-chip" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee' }}>
                  FORENSIC ANALYSIS PORTAL
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>NIST FIPS 180-4 Bitstream Integrity</span>
              </div>
              <h1 className="ev-cyber-welcome-title">
                Welcome, {currentUser.name || 'Dr. Sunita Kulkarni'}
              </h1>
              <p className="ev-cyber-welcome-sub">
                Evidence Acknowledgment • Bitstream SHA-256 Verification • Versioned Laboratory Reports
              </p>

              {/* Forensic Statistics Cards */}
              <div className="ev-cyber-stats-row">
                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon amber">
                    <ClockIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Awaiting Examination</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number" style={{ color: '#f59e0b' }}>{incomingAwaitingAck.length}</span>
                      <span className="ev-cyber-stat-trend">Intake</span>
                    </div>
                  </div>
                </div>

                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon cyan">
                    <CpuIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Under Active Analysis</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number" style={{ color: '#38bdf8' }}>{underAnalysis.length}</span>
                      <span className="ev-cyber-stat-trend">Bench</span>
                    </div>
                  </div>
                </div>

                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon red">
                    <AlertTriangleIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Prosecution Clarifications</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number" style={{ color: '#f87171' }}>{pendingClarifications.length}</span>
                      <span className="ev-cyber-stat-trend">Pending Response</span>
                    </div>
                  </div>
                </div>

                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon teal">
                    <FileTextIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Completed Reports</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number">{reports.length}</span>
                      <span className="ev-cyber-stat-trend">Sealed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ev-cyber-welcome-right">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="ev-btn ev-btn-primary"
                  onClick={() => setActiveTab('INCOMING_EVIDENCE')}
                  style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0284c7 100%)' }}
                >
                  <ClockIcon size={16} />
                  <span>Acknowledge Evidence ({incomingAwaitingAck.length})</span>
                </button>
                <button
                  type="button"
                  className="ev-btn ev-btn-secondary"
                  onClick={() => setActiveTab('CLARIFICATION_REQUESTS')}
                  style={{ borderColor: '#f87171', color: '#f87171' }}
                >
                  <AlertTriangleIcon size={16} />
                  <span>Answer Clarifications ({pendingClarifications.length})</span>
                </button>
                <button
                  type="button"
                  className="ev-btn ev-btn-secondary"
                  onClick={onOpenCaseIndex}
                >
                  <FileTextIcon size={16} />
                  <span>Section 65B Electronic Index</span>
                </button>
              </div>
            </div>
          </section>

          {actionFeedback && (
            <div style={{ background: 'rgba(6, 182, 212, 0.15)', border: '1px solid #06b6d4', borderRadius: '8px', padding: '12px 18px', color: '#67e8f9', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircleIcon size={18} />
              <span>{actionFeedback}</span>
            </div>
          )}

          {/* Section: Clarification Requests from Prosecution (Highlighted Priority) */}
          {pendingClarifications.length > 0 && (
            <section className="ev-cyber-card" style={{ borderColor: '#ef4444', marginBottom: '24px' }}>
              <div className="ev-cyber-card-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div className="ev-cyber-card-title-group">
                  <AlertTriangleIcon size={18} className="text-red" />
                  <h3 style={{ color: '#f87171' }}>
                    Active Judicial Clarification Notices from Public Prosecution ({pendingClarifications.length})
                  </h3>
                </div>
                <span className="ev-cyber-badge-chip" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
                  Response Required for Trial
                </span>
              </div>

              <div style={{ padding: '16px' }}>
                {pendingClarifications.map((rev) => {
                  const draftText = forensicResponseDraft[rev.id] || '';
                  return (
                    <div
                      key={rev.id}
                      style={{
                        background: '#0d1020',
                        border: '1px solid #33202e',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 600 }}>JUDICIAL QUERY ID: {rev.id}</span>
                          <h4 style={{ margin: '4px 0', fontSize: '14px', color: '#f1f5f9' }}>
                            Prosecutor Inquiry: &ldquo;{rev.review_notes}&rdquo;
                          </h4>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            Submitted by {rev.reviewer_id} on {new Date(rev.created_at).toLocaleString()}
                          </span>
                        </div>
                        <span className="ev-cyber-badge-chip" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
                          AWAITING FORENSIC CLARIFICATION
                        </span>
                      </div>

                      <div style={{ marginTop: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                          Forensic Scientific Clarification &amp; Resolution:
                        </label>
                        <textarea
                          rows={3}
                          value={draftText}
                          onChange={(e) => {
                            if (setForensicResponseDraft) {
                              setForensicResponseDraft((prev) => ({
                                ...prev,
                                [rev.id]: e.target.value,
                              }));
                            }
                          }}
                          placeholder="Provide forensic methodology details, corroborating bitstream proof, or amended report notes..."
                          style={{
                            width: '100%',
                            background: '#070a14',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            padding: '10px',
                            color: '#f8fafc',
                            fontSize: '12px',
                            marginBottom: '10px',
                          }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          <button
                            type="button"
                            className="ev-btn ev-btn-primary"
                            disabled={!draftText.trim() || isSubmittingReview}
                            onClick={() => {
                              if (onRespondToClarification) {
                                onRespondToClarification(rev.id, draftText);
                                setActionFeedback(`Clarification response logged and dispatched to Prosecution for Query #${rev.id}`);
                                setTimeout(() => setActionFeedback(null), 4000);
                              }
                            }}
                            style={{ background: 'linear-gradient(135deg, #0891b2 0%, #059669 100%)' }}
                          >
                            <SendIcon size={14} />
                            <span>Transmit Clarification Response to Prosecution</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section: Incoming Evidence Transfers (Awaiting Custody Acknowledgment) */}
          <section className="ev-cyber-card" style={{ marginBottom: '24px' }}>
            <div className="ev-cyber-card-header">
              <div className="ev-cyber-card-title-group">
                <ClockIcon size={16} className="text-cyan" />
                <h3>Incoming Evidence Intake &amp; Custody Transfers ({incomingAwaitingAck.length})</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Acknowledge transfer to record chain-of-custody reception
              </span>
            </div>

            <div className="ev-cyber-table-responsive">
              <table className="ev-cyber-table">
                <thead>
                  <tr>
                    <th>Handoff ID</th>
                    <th>Evidence ID</th>
                    <th>Dispatched By</th>
                    <th>Dispatch Date</th>
                    <th>Current Status</th>
                    <th>Forensic Action</th>
                  </tr>
                </thead>
                <tbody>
                  {incomingAwaitingAck.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No pending evidence transfers awaiting acknowledgment.
                      </td>
                    </tr>
                  ) : (
                    incomingAwaitingAck.map((h) => (
                      <tr key={h.id}>
                        <td className="mono text-cyan">{h.id.slice(0, 12)}</td>
                        <td className="mono">{h.evidence_id.slice(0, 12)}</td>
                        <td>{h.submitted_by}</td>
                        <td style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {new Date(h.submitted_at).toLocaleString()}
                        </td>
                        <td>
                          <span className="ev-case-status-badge status-underreview">{h.status}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="ev-btn ev-btn-primary"
                              style={{ fontSize: '11px', padding: '3px 10px', background: '#0891b2' }}
                              onClick={() => handleAckTransfer(h.id)}
                            >
                              ✓ Acknowledge &amp; Receive
                            </button>
                            <button
                              type="button"
                              className="ev-btn ev-btn-secondary"
                              style={{ fontSize: '11px', padding: '3px 8px', borderColor: '#ef4444', color: '#f87171' }}
                              onClick={() => onRejectTransfer({ handoffId: h.id, evdId: h.evidence_id })}
                            >
                              Return
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section: Active Examination Queue & Report Finalization */}
          <section className="ev-cyber-card" style={{ marginBottom: '24px' }}>
            <div className="ev-cyber-card-header">
              <div className="ev-cyber-card-title-group">
                <CpuIcon size={16} className="text-cyan" />
                <h3>Active Forensic Examination Queue ({underAnalysis.length})</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                In-Progress Bitstream Carving &amp; Digital Forensics
              </span>
            </div>

            <div className="ev-cyber-table-responsive">
              <table className="ev-cyber-table">
                <thead>
                  <tr>
                    <th>Handoff ID</th>
                    <th>Evidence ID</th>
                    <th>Assigned Examiner</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {underAnalysis.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No evidence items currently in active examination queue.
                      </td>
                    </tr>
                  ) : (
                    underAnalysis.map((h) => (
                      <tr key={h.id}>
                        <td className="mono text-cyan">{h.id.slice(0, 12)}</td>
                        <td className="mono">{h.evidence_id.slice(0, 12)}</td>
                        <td>{currentUser.name || 'Dr. Sunita Kulkarni'}</td>
                        <td>
                          <span className="ev-case-status-badge status-inprogress">{h.status}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {h.status === 'RECEIVED' ? (
                              <button
                                type="button"
                                className="ev-btn ev-btn-primary"
                                style={{ fontSize: '11px', padding: '4px 10px' }}
                                onClick={() => handleStartExamination(h.id)}
                              >
                                Begin Examination
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ev-btn ev-btn-primary"
                                style={{ fontSize: '11px', padding: '4px 10px', background: '#059669' }}
                                onClick={() => handleFinalizeReport(h.id)}
                              >
                                ✓ Mark Report Ready
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section: Evidence Vault & SHA-256 Bitstream Integrity Table */}
          <section className="ev-cyber-card" style={{ marginBottom: '24px' }}>
            <div className="ev-cyber-card-header">
              <div className="ev-cyber-card-title-group">
                <ShieldCheckIcon size={16} className="text-cyan" />
                <h3>Evidence Vault &amp; Cryptographic Verification ({evidence.length} Items)</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Strict SHA-256 Bitstream Verification (Never Claims Verified without Genuine Match)
              </span>
            </div>

            <div style={{ padding: '16px' }}>
              <div className="ev-cyber-table-responsive">
                <table className="ev-cyber-table">
                  <thead>
                    <tr>
                      <th>Evidence ID</th>
                      <th>Case</th>
                      <th>Description</th>
                      <th>File &amp; Hash Baseline</th>
                      <th>Tamper Testing</th>
                      <th>Integrity Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.map((ev) => {
                      const fvs = globalDb.getFileVersionsForEvidence(ev.id);
                      const fv = fvs && fvs[0];
                      const isVerifying = fv && verifyingFileId === fv.id;
                      return (
                        <tr key={ev.id}>
                          <td className="mono text-cyan" style={{ fontSize: '12px' }}>{ev.id.slice(0, 12)}</td>
                          <td className="mono" style={{ fontSize: '12px' }}>{ev.case_id.slice(0, 10)}</td>
                          <td style={{ fontSize: '12px' }}>{ev.description}</td>
                          <td>
                            {fv ? (
                              <div>
                                <span style={{ fontSize: '12px', color: '#f1f5f9', display: 'block' }}>{fv.original_filename}</span>
                                <code style={{ fontSize: '10px', color: '#38bdf8' }}>{fv.sha256_hash.slice(0, 18)}...</code>
                              </div>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '11px' }}>No binary file</span>
                            )}
                          </td>
                          <td>
                            {fv && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="ev-btn ev-btn-secondary"
                                  style={{ fontSize: '10px', padding: '2px 6px', borderColor: '#ef4444', color: '#f87171' }}
                                  onClick={() => onSimulateTamper(fv)}
                                  title="Simulate bit-flip tamper in laboratory sandbox"
                                >
                                  Test Tamper
                                </button>
                                <button
                                  type="button"
                                  className="ev-btn ev-btn-secondary"
                                  style={{ fontSize: '10px', padding: '2px 6px', borderColor: '#10b981', color: '#34d399' }}
                                  onClick={() => onRestorePristine(fv)}
                                  title="Restore pristine baseline"
                                >
                                  Restore
                                </button>
                              </div>
                            )}
                          </td>
                          <td>
                            {fv ? (
                              <button
                                type="button"
                                className="ev-btn ev-btn-primary"
                                style={{ fontSize: '11px', padding: '3px 10px' }}
                                disabled={isVerifying}
                                onClick={() => onRunVerification(fv.id)}
                              >
                                {isVerifying ? 'Verifying...' : 'Verify SHA-256'}
                              </button>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '11px' }}>N/A</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section: Forensic Report Builder */}
          <section className="ev-cyber-card">
            <div className="ev-cyber-card-header">
              <div className="ev-cyber-card-title-group">
                <FileTextIcon size={16} className="text-cyan" />
                <h3>Forensic Report Builder &amp; Revision Console</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Creates Section 65B Certified Forensic Findings
              </span>
            </div>

            <div style={{ padding: '16px' }}>
              <label style={{ fontSize: '12px', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                Laboratory Findings &amp; Technical Analysis Summary:
              </label>
              <textarea
                rows={4}
                value={newFindingText}
                onChange={(e) => setNewFindingText(e.target.value)}
                placeholder="Document device partition tables, recovered deleted files, timeline analysis, and hash match confirmations..."
                style={{
                  width: '100%',
                  background: '#070a14',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '10px',
                  color: '#f8fafc',
                  fontSize: '12px',
                  marginBottom: '12px',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="ev-btn ev-btn-primary"
                  disabled={!newFindingText.trim() || evidence.length === 0}
                  onClick={() => {
                    if (evidence.length > 0) {
                      onAddReportVersion(evidence[0].id);
                      setActionFeedback('New forensic report revision generated and sealed with SHA-256 hash.');
                      setTimeout(() => setActionFeedback(null), 4000);
                    }
                  }}
                  style={{ background: 'linear-gradient(135deg, #0891b2 0%, #0284c7 100%)' }}
                >
                  Seal &amp; Publish Forensic Report Version
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="ev-cyber-footer">
          <div className="ev-cyber-footer-left">
            <span className="font-semibold text-white">CFSL FORENSIC LABORATORY</span>
            <span className="text-slate-400">EvidenceVault 360 • Forensic Analysis Workspace</span>
          </div>
          <div className="ev-cyber-footer-right">
            <div className="ev-cyber-system-status">
              <span className="ev-pulse-dot-green" />
              <span>Bitstream Enclave Armed</span>
            </div>
            <span className="ev-footer-sep">•</span>
            <div className="ev-cyber-footer-badges">
              <ShieldCheckIcon size={14} className="text-cyan" />
              <span>FIPS 180-4 Cryptographic Authority</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
