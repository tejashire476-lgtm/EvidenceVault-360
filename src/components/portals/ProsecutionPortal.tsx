import React, { useState, useMemo } from 'react';
import type {
  Case,
  EvidenceRecord,
  ForensicReport,
  ProsecutionReview,
  AuthenticatedSession,
} from '../../types.ts';
import {
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
  FileTextIcon,
  FolderIcon,
} from '../icons.tsx';

export interface ProsecutionPortalProps {
  currentUser: AuthenticatedSession;
  cases: Case[];
  evidence: EvidenceRecord[];
  reports: ForensicReport[];
  reviews: ProsecutionReview[];
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  prosecutionNotes: string;
  setProsecutionNotes: (v: string) => void;
  onProsecutionDecision: (status: 'ACCEPTED_FOR_TRIAL' | 'FURTHER_EVIDENCE_REQUESTED', reportId: string) => void;
  clarificationValidationError?: string | null;
  setClarificationValidationError?: (v: string | null) => void;
  clarificationFeedback?: { type: 'success' | 'error'; message: string } | null;
  setClarificationFeedback?: (v: { type: 'success' | 'error'; message: string } | null) => void;
  isSubmittingReview?: boolean;
  onOpenCaseIndex: () => void;
  onOpenOfflineCenter: () => void;
  onLogout: () => void;
  onOpenCyberDashboard?: () => void;
}

export type ProsecutionNavTab =
  | 'DASHBOARD'
  | 'ASSIGNED_CASES'
  | 'EVIDENCE_REVIEW'
  | 'FORENSIC_REPORTS'
  | 'JUDICIAL_REVIEW'
  | 'REQUEST_CLARIFICATION'
  | 'ADMISSIBILITY_CHECKLIST'
  | 'COURT_PREPARATION'
  | 'REVIEW_HISTORY'
  | 'NOTIFICATIONS'
  | 'PROFILE';

export const ProsecutionPortal: React.FC<ProsecutionPortalProps> = ({
  currentUser,
  cases,
  evidence,
  reports,
  reviews,
  selectedCaseId,
  setSelectedCaseId: _setSelectedCaseId,
  prosecutionNotes,
  setProsecutionNotes,
  onProsecutionDecision,
  clarificationValidationError,
  setClarificationValidationError,
  clarificationFeedback,
  setClarificationFeedback: _setClarificationFeedback,
  isSubmittingReview,
  onOpenCaseIndex,
  onOpenOfflineCenter,
  onLogout,
  onOpenCyberDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<ProsecutionNavTab>('DASHBOARD');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedReportId] = useState<string>('');

  // Selected case
  const selectedCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || cases[0];
  }, [cases, selectedCaseId]);

  const selectedCaseEvidence = useMemo(() => {
    if (!selectedCase) return [];
    return evidence.filter((e) => e.case_id === selectedCase.id);
  }, [evidence, selectedCase]);

  const selectedCaseReports = useMemo(() => {
    if (!selectedCase) return [];
    const evIds = new Set(selectedCaseEvidence.map((e) => e.id));
    return reports.filter((r) => evIds.has(r.evidence_id));
  }, [reports, selectedCase, selectedCaseEvidence]);

  // Target report for review
  const activeReport = useMemo(() => {
    if (selectedReportId) {
      return reports.find((r) => r.id === selectedReportId) || reports[0];
    }
    return selectedCaseReports[0] || reports[0];
  }, [reports, selectedReportId, selectedCaseReports]);

  // Clarification requests awaiting forensic response
  const pendingClarifications = useMemo(() => {
    return reviews.filter(
      (r) => r.status === 'FURTHER_EVIDENCE_REQUESTED' && r.clarification_status !== 'RESPONDED'
    );
  }, [reviews]);

  // Reports approved for court presentation
  const approvedReports = useMemo(() => {
    return reviews.filter((r) => r.status === 'ACCEPTED_FOR_TRIAL');
  }, [reviews]);

  // Reports pending judicial review
  const pendingReviewReports = useMemo(() => {
    const reviewedReportIds = new Set(reviews.map((r) => r.report_id));
    return reports.filter((r) => !reviewedReportIds.has(r.id));
  }, [reports, reviews]);

  return (
    <div className={`ev-cyber-layout ${isDarkMode ? 'dark-mode' : 'tactical-mode'}`}>
      {/* 1. Left Sidebar Navigation */}
      <aside className="ev-cyber-sidebar">
        <div className="ev-cyber-brand">
          <div className="ev-cyber-logo-icon" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }}>
            <ShieldCheckIcon size={24} />
          </div>
          <div className="ev-cyber-brand-text">
            <h2>PROSECUTION</h2>
            <span style={{ color: '#c084fc' }}>Judicial Review</span>
          </div>
        </div>

        <nav className="ev-cyber-nav">
          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'DASHBOARD' ? 'active' : ''}`}
            onClick={() => setActiveTab('DASHBOARD')}
          >
            <LayoutDashboardIcon size={18} />
            <span>Prosecution Dashboard</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'ASSIGNED_CASES' ? 'active' : ''}`}
            onClick={() => setActiveTab('ASSIGNED_CASES')}
          >
            <FolderIcon size={18} />
            <span>Assigned Cases</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'EVIDENCE_REVIEW' ? 'active' : ''}`}
            onClick={() => setActiveTab('EVIDENCE_REVIEW')}
          >
            <SearchIcon size={18} />
            <span>Evidence Review</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'FORENSIC_REPORTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('FORENSIC_REPORTS')}
          >
            <FileTextIcon size={18} />
            <span>Forensic Reports</span>
            {pendingReviewReports.length > 0 && (
              <span className="ev-cyber-badge-chip" style={{ marginLeft: 'auto', background: '#f59e0b', color: '#000' }}>
                {pendingReviewReports.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'JUDICIAL_REVIEW' ? 'active' : ''}`}
            onClick={() => setActiveTab('JUDICIAL_REVIEW')}
          >
            <ShieldCheckIcon size={18} />
            <span>Judicial Review</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'REQUEST_CLARIFICATION' ? 'active' : ''}`}
            onClick={() => setActiveTab('REQUEST_CLARIFICATION')}
          >
            <AlertTriangleIcon size={18} />
            <span>Request Clarification</span>
            {pendingClarifications.length > 0 && (
              <span className="ev-cyber-badge-chip" style={{ marginLeft: 'auto', background: '#f59e0b', color: '#000' }}>
                {pendingClarifications.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'ADMISSIBILITY_CHECKLIST' ? 'active' : ''}`}
            onClick={() => setActiveTab('ADMISSIBILITY_CHECKLIST')}
          >
            <CheckCircleIcon size={18} />
            <span>Admissibility Checklist</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'COURT_PREPARATION' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('COURT_PREPARATION');
              onOpenCaseIndex();
            }}
          >
            <FileTextIcon size={18} />
            <span>Court Presentation Prep</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'REVIEW_HISTORY' ? 'active' : ''}`}
            onClick={() => setActiveTab('REVIEW_HISTORY')}
          >
            <ClockIcon size={18} />
            <span>Review History</span>
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
            <span>Prosecutor Profile</span>
          </button>

          {onOpenCyberDashboard && (
            <button
              type="button"
              className="ev-cyber-nav-item"
              onClick={onOpenCyberDashboard}
              style={{ borderColor: 'rgba(168, 85, 247, 0.4)', background: 'rgba(168, 85, 247, 0.08)' }}
              title="Open Cyber Command Center"
            >
              <LayoutDashboardIcon size={18} className="text-purple" />
              <span>Cyber Command Center</span>
            </button>
          )}
        </nav>

        <div className="ev-cyber-quote-card" style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
          <div className="ev-cyber-quote-icon">
            <ShieldCheckIcon size={18} />
          </div>
          <p className="ev-cyber-quote-text">
            &ldquo;Evidence Must Stand the Test of Judicial Scrutiny.&rdquo;
          </p>
          <span className="ev-cyber-quote-author">— Directorate of Prosecution</span>
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
              placeholder="Search prosecution dockets, reports, trial exhibits..."
            />
          </div>

          <div className="ev-cyber-topbar-controls">
            <div className="ev-cyber-control-btn-wrapper">
              <button
                type="button"
                className="ev-cyber-icon-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                title="Prosecution Notifications"
              >
                <BellIcon size={18} />
                {(pendingReviewReports.length > 0 || pendingClarifications.length > 0) && (
                  <span className="ev-cyber-badge-dot" />
                )}
              </button>

              {showNotifications && (
                <div className="ev-cyber-dropdown-menu notifications">
                  <div className="ev-cyber-dropdown-header">
                    <h4>Judicial Docket Alerts</h4>
                    <span className="ev-cyber-badge-chip">{pendingReviewReports.length} Reports Ready</span>
                  </div>
                  {pendingReviewReports.slice(0, 4).map((r) => (
                    <div key={r.id} className="ev-cyber-dropdown-item">
                      <FileTextIcon size={14} className="text-purple" />
                      <div>
                        <strong>Forensic Report v{r.version_number} Pending</strong>
                        <p>Evidence ID: {r.evidence_id}</p>
                        <small>Submitted by: {r.author_id}</small>
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
                <div className="ev-cyber-user-avatar" style={{ background: '#7c3aed' }}>
                  <UserIcon size={18} />
                </div>
                <div className="ev-cyber-user-details">
                  <span className="ev-cyber-user-name">{currentUser.name || 'Adv. Priya Mehta'}</span>
                  <span className="ev-cyber-user-role" style={{ color: '#c084fc' }}>
                    PUBLIC PROSECUTOR • {currentUser.badge}
                  </span>
                </div>
              </button>

              {showProfileMenu && (
                <div className="ev-cyber-dropdown-menu profile">
                  <div className="ev-cyber-dropdown-header">
                    <h4>Prosecution Session</h4>
                    <small>Directorate of Public Prosecution</small>
                  </div>
                  <div className="ev-cyber-dropdown-item">
                    <div>
                      <strong>Badge:</strong> {currentUser.badge}
                      <br />
                      <strong>Role:</strong> {currentUser.role}
                      <br />
                      <strong>Judicial Jurisdiction:</strong> High Court / Sessions
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

        {/* Dashboard Body */}
        <main className="ev-cyber-content">
          {/* Welcome Banner */}
          <section className="ev-cyber-welcome-banner" style={{ borderLeft: '4px solid #a855f7' }}>
            <div className="ev-cyber-welcome-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="ev-cyber-badge-chip" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
                  PROSECUTION JUDICIAL REVIEW PORTAL
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Bharatiya Sakshya Adhiniyam Sec 65B</span>
              </div>
              <h1 className="ev-cyber-welcome-title">
                Welcome, {currentUser.name || 'Adv. Priya Mehta'}
              </h1>
              <p className="ev-cyber-welcome-sub">
                Evidentiary Assessment • Cryptographic Clarification Inquiries • Trial Presentation Acceptance
              </p>

              {/* Prosecution Statistics Cards */}
              <div className="ev-cyber-stats-row">
                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon purple">
                    <FolderIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Cases Awaiting Review</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number">{cases.length}</span>
                      <span className="ev-cyber-stat-trend">Docket</span>
                    </div>
                  </div>
                </div>

                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon amber">
                    <FileTextIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Reports Pending Review</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number" style={{ color: '#f59e0b' }}>{pendingReviewReports.length}</span>
                      <span className="ev-cyber-stat-trend">Unsigned</span>
                    </div>
                  </div>
                </div>

                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon green">
                    <CheckCircleIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Approved for Trial</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number" style={{ color: '#10b981' }}>{approvedReports.length}</span>
                      <span className="ev-cyber-stat-trend">Court Ready</span>
                    </div>
                  </div>
                </div>

                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon red">
                    <AlertTriangleIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Clarifications Awaiting Lab</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number" style={{ color: '#f87171' }}>{pendingClarifications.length}</span>
                      <span className="ev-cyber-stat-trend">Pending CFSL</span>
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
                  onClick={onOpenCaseIndex}
                  style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }}
                >
                  <FileTextIcon size={16} />
                  <span>Section 65B Admissibility Index</span>
                </button>
                <button
                  type="button"
                  className="ev-btn ev-btn-secondary"
                  onClick={() => setActiveTab('JUDICIAL_REVIEW')}
                  style={{ borderColor: '#c084fc', color: '#c084fc' }}
                >
                  <ShieldCheckIcon size={16} />
                  <span>Execute Judicial Review</span>
                </button>
              </div>
            </div>
          </section>

          {/* Validation & Feedback Banners */}
          {clarificationValidationError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '12px 18px', color: '#fca5a5', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangleIcon size={18} />
              <span>{clarificationValidationError}</span>
            </div>
          )}

          {clarificationFeedback && (
            <div style={{ background: clarificationFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${clarificationFeedback.type === 'success' ? '#10b981' : '#ef4444'}`, borderRadius: '8px', padding: '12px 18px', color: clarificationFeedback.type === 'success' ? '#6ee7b7' : '#fca5a5', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircleIcon size={18} />
              <span>{clarificationFeedback.message}</span>
            </div>
          )}

          {/* Section: Judicial Review Assessment on Latest Report */}
          <section className="ev-cyber-card" style={{ marginBottom: '24px' }}>
            <div className="ev-cyber-card-header">
              <div className="ev-cyber-card-title-group">
                <ShieldCheckIcon size={18} className="text-purple" />
                <h3>Judicial Review Assessment on Latest Report</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Section 65B Judicial Admissibility &amp; Evidentiary Scrutiny
              </span>
            </div>

            <div style={{ padding: '16px' }}>
              {activeReport ? (
                <div>
                  <div style={{ background: '#0a0d1a', border: '1px solid #1e293b', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'monospace', color: '#c084fc', fontWeight: 600 }}>
                        REPORT ID: {activeReport.id} (Version {activeReport.version_number})
                      </span>
                      <span className="ev-case-status-badge status-open">{activeReport.status}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#e2e8f0', marginBottom: '6px' }}>
                      <strong>Summary of Forensic Findings:</strong> {activeReport.report_content}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Examiner: {activeReport.author_id} • Target Evidence ID: {activeReport.evidence_id}
                    </div>
                  </div>

                  {/* Clarification Notes Textarea */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                      Judicial Review Notes / Clarification Inquiry for Forensics:
                    </label>
                    <textarea
                      rows={3}
                      value={prosecutionNotes}
                      onChange={(e) => {
                        setProsecutionNotes(e.target.value);
                        if (setClarificationValidationError) setClarificationValidationError(null);
                      }}
                      placeholder="Enter legal scrutiny notes, cross-examination inquiries, or request forensic clarification..."
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

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="ev-btn ev-btn-primary"
                        disabled={isSubmittingReview}
                        onClick={() => onProsecutionDecision('ACCEPTED_FOR_TRIAL', activeReport.id)}
                        style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
                      >
                        <CheckCircleIcon size={15} />
                        <span>Accept for Trial Presentation</span>
                      </button>

                      <button
                        type="button"
                        className="ev-btn ev-btn-secondary"
                        disabled={isSubmittingReview}
                        onClick={() => onProsecutionDecision('FURTHER_EVIDENCE_REQUESTED', activeReport.id)}
                        style={{ borderColor: '#f59e0b', color: '#fbbf24' }}
                      >
                        <AlertTriangleIcon size={15} />
                        <span>Request Clarification</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  No forensic reports currently available for review.
                </div>
              )}
            </div>
          </section>

          {/* Section: Section 65B Electronic Evidence Admissibility Checklist */}
          <section className="ev-cyber-card" style={{ marginBottom: '24px' }}>
            <div className="ev-cyber-card-header">
              <div className="ev-cyber-card-title-group">
                <CheckCircleIcon size={16} className="text-cyan" />
                <h3>Section 65B Electronic Evidence Admissibility Checklist</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Statutory Criteria under Bharatiya Sakshya Adhiniyam 2023
              </span>
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                <div style={{ background: '#0a0f1d', padding: '14px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <CheckCircleIcon size={16} className="text-emerald" />
                    <strong style={{ fontSize: '13px', color: '#f8fafc' }}>SHA-256 Bitstream Seal</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                    Authentic cryptographic hash computed at time of seizure matches current bitstream.
                  </p>
                </div>

                <div style={{ background: '#0a0f1d', padding: '14px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <CheckCircleIcon size={16} className="text-emerald" />
                    <strong style={{ fontSize: '13px', color: '#f8fafc' }}>Unbroken Chain of Custody</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                    Custody handoffs from Police Seizure to CFSL Examiner verified in audit ledger.
                  </p>
                </div>

                <div style={{ background: '#0a0f1d', padding: '14px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <CheckCircleIcon size={16} className="text-emerald" />
                    <strong style={{ fontSize: '13px', color: '#f8fafc' }}>Forensic Scientific Competence</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                    Report authored and digitally signed by authorized forensic examiner.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Prosecution Review & Clarification History */}
          <section className="ev-cyber-card">
            <div className="ev-cyber-card-header">
              <div className="ev-cyber-card-title-group">
                <ClockIcon size={16} className="text-cyan" />
                <h3>Prosecution Review &amp; Clarification History ({reviews.length})</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Complete Audit Ledger of Judicial Reviews
              </span>
            </div>

            <div className="ev-cyber-table-responsive">
              <table className="ev-cyber-table">
                <thead>
                  <tr>
                    <th>Review ID</th>
                    <th>Report ID</th>
                    <th>Reviewer</th>
                    <th>Judicial Assessment</th>
                    <th>Clarification Status</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No judicial reviews submitted yet.
                      </td>
                    </tr>
                  ) : (
                    reviews.map((rev) => (
                      <tr key={rev.id}>
                        <td className="mono text-purple">{rev.id.slice(0, 12)}</td>
                        <td className="mono">{rev.report_id.slice(0, 12)}</td>
                        <td>{rev.reviewer_id}</td>
                        <td>
                          <span
                            className={`ev-case-status-badge ${
                              rev.status === 'ACCEPTED_FOR_TRIAL'
                                ? 'status-open'
                                : 'status-underreview'
                            }`}
                          >
                            {rev.status}
                          </span>
                        </td>
                        <td>
                          {rev.clarification_status ? (
                            <span style={{ fontSize: '11px', color: rev.clarification_status === 'RESPONDED' ? '#10b981' : '#f59e0b' }}>
                              {rev.clarification_status === 'RESPONDED' ? '✓ Responded by Lab' : '⏳ Awaiting CFSL'}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '11px' }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {new Date(rev.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="ev-cyber-footer">
          <div className="ev-cyber-footer-left">
            <span className="font-semibold text-white">DIRECTORATE OF PROSECUTION</span>
            <span className="text-slate-400">EvidenceVault 360 • Judicial Review Workspace</span>
          </div>
          <div className="ev-cyber-footer-right">
            <div className="ev-cyber-system-status">
              <span className="ev-pulse-dot-green" />
              <span>Court Docket Online</span>
            </div>
            <span className="ev-footer-sep">•</span>
            <div className="ev-cyber-footer-badges">
              <ShieldCheckIcon size={14} className="text-cyan" />
              <span>Section 65B BSA Admissibility Verified</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
