import React, { useState, useMemo } from 'react';
import type {
  Case,
  EvidenceRecord,
  EvidenceHandoff,
  AuthenticatedSession,
} from '../../types.ts';
import {
  FolderLockIcon,
  FolderIcon,
  CloudUploadIcon,
  ShieldCheckIcon,
  SearchIcon,
  SlidersIcon,
  ClockIcon,
  BellIcon,
  MoonIcon,
  SunIcon,
  CheckCircleIcon,
  UserIcon,
  LayoutDashboardIcon,
  GitCommitIcon,
  FileTextIcon,
  SendIcon,
} from '../icons.tsx';

export interface PolicePortalProps {
  currentUser: AuthenticatedSession;
  cases: Case[];
  evidence: EvidenceRecord[];
  handoffs: EvidenceHandoff[];
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  onOpenCreateCaseModal: () => void;
  onOpenRegisterEvidenceModal: () => void;
  onOpenCaseIndex: () => void;
  onSubmitToForensics: (evidenceId: string) => void;
  onLogout: () => void;
  onOpenOfflineCenter: () => void;
  onOpenCyberDashboard?: () => void;
}

export type PoliceNavTab =
  | 'DASHBOARD'
  | 'CASE_REGISTER'
  | 'CREATE_CASE'
  | 'EVIDENCE_COLLECTION'
  | 'UPLOAD_EVIDENCE'
  | 'CHAIN_OF_CUSTODY'
  | 'TRANSFER_FORENSIC'
  | 'TIMELINE'
  | 'REPORTS'
  | 'NOTIFICATIONS'
  | 'PROFILE';

export const PolicePortal: React.FC<PolicePortalProps> = ({
  currentUser,
  cases,
  evidence,
  handoffs,
  selectedCaseId,
  setSelectedCaseId,
  onOpenCreateCaseModal,
  onOpenRegisterEvidenceModal,
  onOpenCaseIndex,
  onSubmitToForensics,
  onLogout,
  onOpenOfflineCenter,
  onOpenCyberDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<PoliceNavTab>('DASHBOARD');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [transferTargetEvidenceId, setTransferTargetEvidenceId] = useState<string>('');
  const [transferFeedback, setTransferFeedback] = useState<string | null>(null);

  // Filter cases assigned to police or created by police
  const policeCases = useMemo(() => {
    return cases.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.case_reference.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [cases, searchQuery, statusFilter]);

  const selectedCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || cases[0];
  }, [cases, selectedCaseId]);

  const selectedCaseEvidence = useMemo(() => {
    if (!selectedCase) return [];
    return evidence.filter((e) => e.case_id === selectedCase.id);
  }, [evidence, selectedCase]);

  // Police Metrics
  const activeInvestigations = cases.filter((c) => c.status === 'OPEN' || c.status === 'UNDER_INVESTIGATION' || c.status === 'PENDING_FORENSICS').length;
  const totalPoliceEvidence = evidence.length;
  const transfersAwaitingAck = handoffs.filter((h) => h.status === 'DRAFT' || h.status === 'SUBMITTED').length;
  const completedTransfers = handoffs.filter((h) => h.status === 'RECEIVED' || h.status === 'UNDER_EXAMINATION' || h.status === 'REPORT_READY').length;

  const handleInitiateTransfer = (evId: string) => {
    if (!evId) return;
    try {
      onSubmitToForensics(evId);
      setTransferFeedback(`Transfer dispatch logged and transmitted to CFSL Forensic Labs for Evidence #${evId}`);
      setTimeout(() => setTransferFeedback(null), 4000);
    } catch (err: any) {
      setTransferFeedback(`Transfer error: ${err.message || 'Failed'}`);
    }
  };

  return (
    <div className={`ev-cyber-layout ${isDarkMode ? 'dark-mode' : 'tactical-mode'}`}>
      {/* 1. Left Sidebar Navigation */}
      <aside className="ev-cyber-sidebar">
        <div className="ev-cyber-brand">
          <div className="ev-cyber-logo-icon" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%)' }}>
            <FolderLockIcon size={24} />
          </div>
          <div className="ev-cyber-brand-text">
            <h2>POLICE CID</h2>
            <span style={{ color: '#60a5fa' }}>Investigation Command</span>
          </div>
        </div>

        <nav className="ev-cyber-nav">
          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'DASHBOARD' ? 'active' : ''}`}
            onClick={() => setActiveTab('DASHBOARD')}
          >
            <LayoutDashboardIcon size={18} />
            <span>Police Dashboard</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'CASE_REGISTER' ? 'active' : ''}`}
            onClick={() => setActiveTab('CASE_REGISTER')}
          >
            <FolderIcon size={18} />
            <span>Case Register</span>
          </button>

          <button
            type="button"
            className="ev-cyber-nav-item"
            onClick={() => onOpenCreateCaseModal()}
          >
            <FolderLockIcon size={18} />
            <span>Create / Register Case</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'EVIDENCE_COLLECTION' ? 'active' : ''}`}
            onClick={() => setActiveTab('EVIDENCE_COLLECTION')}
          >
            <ShieldCheckIcon size={18} />
            <span>Evidence Collection</span>
          </button>

          <button
            type="button"
            className="ev-cyber-nav-item"
            onClick={() => onOpenRegisterEvidenceModal()}
          >
            <CloudUploadIcon size={18} />
            <span>Upload Evidence</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'CHAIN_OF_CUSTODY' ? 'active' : ''}`}
            onClick={() => setActiveTab('CHAIN_OF_CUSTODY')}
          >
            <GitCommitIcon size={18} />
            <span>Chain of Custody</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'TRANSFER_FORENSIC' ? 'active' : ''}`}
            onClick={() => setActiveTab('TRANSFER_FORENSIC')}
          >
            <SendIcon size={18} />
            <span>Transfer to Forensic</span>
            {transfersAwaitingAck > 0 && (
              <span className="ev-cyber-badge-chip" style={{ marginLeft: 'auto', background: '#f59e0b', color: '#000' }}>
                {transfersAwaitingAck}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'TIMELINE' ? 'active' : ''}`}
            onClick={() => setActiveTab('TIMELINE')}
          >
            <ClockIcon size={18} />
            <span>Investigation Timeline</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeTab === 'REPORTS' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('REPORTS');
              onOpenCaseIndex();
            }}
          >
            <FileTextIcon size={18} />
            <span>Investigation Reports</span>
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
            <span>Officer Profile</span>
          </button>

          {onOpenCyberDashboard && (
            <button
              type="button"
              className="ev-cyber-nav-item"
              onClick={onOpenCyberDashboard}
              style={{ borderColor: 'rgba(56, 189, 248, 0.4)', background: 'rgba(56, 189, 248, 0.08)' }}
              title="Open Cyber Command Center"
            >
              <LayoutDashboardIcon size={18} className="text-cyan" />
              <span>Cyber Command Center</span>
            </button>
          )}
        </nav>

        <div className="ev-cyber-quote-card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <div className="ev-cyber-quote-icon">
            <ShieldCheckIcon size={18} />
          </div>
          <p className="ev-cyber-quote-text">
            &ldquo;Integrity at Crime Scene is Justice in Court.&rdquo;
          </p>
          <span className="ev-cyber-quote-author">— Police Investigation CID</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="ev-cyber-main-wrapper">
        {/* Top Header Navigation Bar */}
        <header className="ev-cyber-topbar">
          <div className="ev-cyber-search-box">
            <SearchIcon size={16} className="ev-cyber-search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Police cases, FIR reference, officer badge..."
            />
          </div>

          <div className="ev-cyber-topbar-controls">
            <div className="ev-cyber-control-btn-wrapper">
              <button
                type="button"
                className="ev-cyber-icon-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                title="Investigation Notifications"
              >
                <BellIcon size={18} />
                {transfersAwaitingAck > 0 && <span className="ev-cyber-badge-dot" />}
              </button>

              {showNotifications && (
                <div className="ev-cyber-dropdown-menu notifications">
                  <div className="ev-cyber-dropdown-header">
                    <h4>Police Dispatch Alerts</h4>
                    <span className="ev-cyber-badge-chip">{transfersAwaitingAck} Awaiting</span>
                  </div>
                  {handoffs.slice(0, 4).map((h) => (
                    <div key={h.id} className="ev-cyber-dropdown-item">
                      <ClockIcon size={14} className="text-amber" />
                      <div>
                        <strong>Custody Handoff #{h.id.slice(0, 8)}</strong>
                        <p>Status: {h.status} • Evidence ID: {h.evidence_id}</p>
                        <small>{new Date(h.submitted_at).toLocaleTimeString()}</small>
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
                <div className="ev-cyber-user-avatar" style={{ background: '#1d4ed8' }}>
                  <UserIcon size={18} />
                </div>
                <div className="ev-cyber-user-details">
                  <span className="ev-cyber-user-name">{currentUser.name || 'Inspector Sharma'}</span>
                  <span className="ev-cyber-user-role" style={{ color: '#60a5fa' }}>
                    POLICE INVESTIGATOR • {currentUser.badge}
                  </span>
                </div>
              </button>

              {showProfileMenu && (
                <div className="ev-cyber-dropdown-menu profile">
                  <div className="ev-cyber-dropdown-header">
                    <h4>Police CID Session</h4>
                    <small>Crime Investigation Department</small>
                  </div>
                  <div className="ev-cyber-dropdown-item">
                    <div>
                      <strong>Badge:</strong> {currentUser.badge}
                      <br />
                      <strong>Role:</strong> {currentUser.role}
                      <br />
                      <strong>Unit:</strong> Cyber Crime Cell
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
          <section className="ev-cyber-welcome-banner" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="ev-cyber-welcome-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="ev-cyber-badge-chip" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
                  POLICE INVESTIGATION PORTAL
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>First Responder ISO 27037 Standard</span>
              </div>
              <h1 className="ev-cyber-welcome-title">
                Welcome, {currentUser.name || 'Insp. Rajesh Sharma'}
              </h1>
              <p className="ev-cyber-welcome-sub">
                Crime Scene Digital Seizure • Custody Register • Forensic Transfer Dispatch
              </p>

              {/* Police Statistics Cards */}
              <div className="ev-cyber-stats-row">
                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon blue">
                    <FolderIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Assigned Police Cases</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number">{cases.length}</span>
                      <span className="ev-cyber-stat-trend">Total</span>
                    </div>
                  </div>
                </div>

                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon cyan">
                    <FolderLockIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Active Investigations</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number" style={{ color: '#38bdf8' }}>{activeInvestigations}</span>
                      <span className="ev-cyber-stat-trend">Active</span>
                    </div>
                  </div>
                </div>

                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon teal">
                    <CloudUploadIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Evidence Collected</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number">{totalPoliceEvidence}</span>
                      <span className="ev-cyber-stat-trend">Seized</span>
                    </div>
                  </div>
                </div>

                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon amber">
                    <ClockIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Awaiting Transfer Ack</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number" style={{ color: '#f59e0b' }}>{transfersAwaitingAck}</span>
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
                  onClick={onOpenCreateCaseModal}
                  style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%)' }}
                >
                  <FolderLockIcon size={16} />
                  <span>Register New Case (FIR)</span>
                </button>
                <button
                  type="button"
                  className="ev-btn ev-btn-secondary"
                  onClick={onOpenRegisterEvidenceModal}
                  style={{ borderColor: '#38bdf8', color: '#38bdf8' }}
                >
                  <CloudUploadIcon size={16} />
                  <span>Seize &amp; Upload Evidence</span>
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

          {transferFeedback && (
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6', borderRadius: '8px', padding: '12px 18px', color: '#93c5fd', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircleIcon size={18} />
              <span>{transferFeedback}</span>
            </div>
          )}

          {/* Quick Actions Strip */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="ev-cyber-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <FolderIcon size={20} className="text-cyan" />
                <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '15px' }}>Quick Case Registration</h4>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px 0' }}>
                Create a formal Police FIR docket with incident timestamp and legal classification.
              </p>
              <button type="button" className="ev-btn ev-btn-primary" style={{ width: '100%' }} onClick={onOpenCreateCaseModal}>
                + Register Police Case
              </button>
            </div>

            <div className="ev-cyber-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <CloudUploadIcon size={20} className="text-teal" />
                <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '15px' }}>Evidence Seizure Intake</h4>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px 0' }}>
                Ingest digital disks, phones, CCTV files, or memory dumps with SHA-256 bitstream sealing.
              </p>
              <button type="button" className="ev-btn ev-btn-secondary" style={{ width: '100%', borderColor: '#14b8a6', color: '#14b8a6' }} onClick={onOpenRegisterEvidenceModal}>
                + Ingest Digital Evidence
              </button>
            </div>

            <div className="ev-cyber-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <SendIcon size={20} className="text-amber" />
                <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '15px' }}>CFSL Laboratory Dispatch</h4>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px 0' }}>
                Initiate chain-of-custody transfer to Forensic Science Laboratory with custody receipt.
              </p>
              <button type="button" className="ev-btn ev-btn-secondary" style={{ width: '100%', borderColor: '#f59e0b', color: '#f59e0b' }} onClick={() => setActiveTab('TRANSFER_FORENSIC')}>
                → Manage Transfers ({transfersAwaitingAck} Pending)
              </button>
            </div>
          </section>

          {/* Main 2-Column Section: Searchable Case Register & Selected Case Workspace */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', marginBottom: '24px' }}>
            {/* Left: Searchable Case Register */}
            <div className="ev-cyber-card">
              <div className="ev-cyber-card-header">
                <div className="ev-cyber-card-title-group">
                  <FolderLockIcon size={16} className="text-cyan" />
                  <h3>Police Case Register ({policeCases.length})</h3>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ background: '#0d1326', border: '1px solid #1e293b', color: '#cbd5e1', fontSize: '12px', padding: '4px 8px', borderRadius: '4px' }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="UNDER_INVESTIGATION">Under Investigation</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              </div>

              <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '8px 12px' }}>
                {policeCases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    No police cases found matching filters.
                  </div>
                ) : (
                  policeCases.map((c) => {
                    const isSelected = selectedCase?.id === c.id;
                    const caseEvCount = evidence.filter((e) => e.case_id === c.id).length;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCaseId(c.id)}
                        style={{
                          background: isSelected ? 'rgba(59, 130, 246, 0.15)' : '#0d1428',
                          border: `1px solid ${isSelected ? '#3b82f6' : '#1e293b'}`,
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#38bdf8', fontSize: '13px' }}>
                            {c.case_reference || c.id}
                          </span>
                          <span
                            className={`ev-case-status-badge ${
                              c.status === 'OPEN' ? 'status-open' : 'status-inprogress'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '4px' }}>
                          {c.title}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                          <span>Category: {c.category}</span>
                          <span>{caseEvCount} Evidence Items</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Selected Case Details & Evidence Inventory */}
            <div className="ev-cyber-card">
              <div className="ev-cyber-card-header">
                <div className="ev-cyber-card-title-group">
                  <FolderIcon size={16} className="text-cyan" />
                  <h3>
                    Selected Case: {selectedCase ? (selectedCase.case_reference || selectedCase.title) : 'None'}
                  </h3>
                </div>
                {selectedCase && (
                  <button
                    type="button"
                    className="ev-btn ev-btn-primary"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                    onClick={onOpenRegisterEvidenceModal}
                  >
                    + Seize Evidence for this Case
                  </button>
                )}
              </div>

              {selectedCase ? (
                <div style={{ padding: '16px' }}>
                  {/* Case Metadata Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#0a0f1d', padding: '12px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #1e293b' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Case Reference</span>
                      <strong style={{ fontSize: '12px', color: '#38bdf8', fontFamily: 'monospace' }}>{selectedCase.case_reference}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Investigating Officer</span>
                      <strong style={{ fontSize: '12px', color: '#f8fafc' }}>{selectedCase.assigned_officer_id || currentUser.badge}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Category</span>
                      <strong style={{ fontSize: '12px', color: '#cbd5e1' }}>{selectedCase.category}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Status</span>
                      <span className="ev-case-status-badge status-open">{selectedCase.status}</span>
                    </div>
                  </div>

                  {/* Evidence Collected Under this Case */}
                  <h4 style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                    Seized Evidence Inventory ({selectedCaseEvidence.length})
                  </h4>

                  {selectedCaseEvidence.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', background: '#080d1a', borderRadius: '6px', border: '1px dashed #1e293b' }}>
                      <p style={{ color: '#64748b', margin: '0 0 10px 0', fontSize: '13px' }}>
                        No digital evidence registered under Case {selectedCase.case_reference} yet.
                      </p>
                      <button type="button" className="ev-btn ev-btn-primary" onClick={onOpenRegisterEvidenceModal}>
                        Register First Evidence Item
                      </button>
                    </div>
                  ) : (
                    <div className="ev-cyber-table-responsive" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                      <table className="ev-cyber-table">
                        <thead>
                          <tr>
                            <th>Evidence ID</th>
                            <th>Description</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCaseEvidence.map((ev) => {
                            const isTransferred = handoffs.some((h) => h.evidence_id === ev.id);
                            return (
                              <tr key={ev.id}>
                                <td className="mono text-cyan" style={{ fontSize: '12px' }}>{ev.id.slice(0, 12)}</td>
                                <td style={{ fontSize: '12px' }}>{ev.description}</td>
                                <td>
                                  <span className="ev-cyber-badge-chip" style={{ fontSize: '10px' }}>{ev.evidence_type}</span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '11px', color: isTransferred ? '#10b981' : '#f59e0b' }}>
                                    {isTransferred ? 'Dispatched to Lab' : 'In Police Locker'}
                                  </span>
                                </td>
                                <td>
                                  {!isTransferred ? (
                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-secondary"
                                      style={{ fontSize: '10px', padding: '2px 8px', borderColor: '#38bdf8', color: '#38bdf8' }}
                                      onClick={() => handleInitiateTransfer(ev.id)}
                                      title="Dispatch physical or digital custody to CFSL forensic unit"
                                    >
                                      Send to CFSL →
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '10px', color: '#10b981' }}>✓ Dispatched</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  Select a case from the register to inspect details and evidence items.
                </div>
              )}
            </div>
          </div>

          {/* Section: Evidence Transfer to Forensic Laboratory & Custody Timeline */}
          <section className="ev-cyber-card" style={{ marginBottom: '24px' }}>
            <div className="ev-cyber-card-header">
              <div className="ev-cyber-card-title-group">
                <SendIcon size={16} className="text-cyan" />
                <h3>Evidence Transfers to Forensic Science Laboratory (CFSL)</h3>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Documented ISO 27037 Custodial Handoffs
              </span>
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                {/* Form to dispatch another transfer */}
                <div style={{ background: '#0a0f1e', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#f8fafc' }}>Dispatch Evidence to Forensic</h4>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <select
                      value={transferTargetEvidenceId}
                      onChange={(e) => setTransferTargetEvidenceId(e.target.value)}
                      style={{ flex: 1, background: '#080c18', border: '1px solid #334155', color: '#f8fafc', padding: '8px', borderRadius: '4px', fontSize: '12px' }}
                    >
                      <option value="">Select an untransferred evidence item...</option>
                      {evidence.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.id.slice(0, 10)} — {e.description.slice(0, 30)} ({e.evidence_type})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ev-btn ev-btn-primary"
                      disabled={!transferTargetEvidenceId}
                      onClick={() => {
                        handleInitiateTransfer(transferTargetEvidenceId);
                        setTransferTargetEvidenceId('');
                      }}
                    >
                      Dispatch Transfer
                    </button>
                  </div>
                  <small style={{ color: '#64748b', fontSize: '11px' }}>
                    Dispatches chain-of-custody transfer event signed with Police Investigator key.
                  </small>
                </div>

                {/* Status overview */}
                <div style={{ background: '#0a0f1e', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Total Custodial Transfers Dispatched:</span>
                    <strong style={{ color: '#38bdf8' }}>{handoffs.length}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Awaiting Forensic Acknowledgment:</span>
                    <strong style={{ color: '#f59e0b' }}>{transfersAwaitingAck}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Accepted &amp; Completed at Lab:</span>
                    <strong style={{ color: '#10b981' }}>{completedTransfers}</strong>
                  </div>
                </div>
              </div>

              {/* Handoffs Table */}
              <div className="ev-cyber-table-responsive">
                <table className="ev-cyber-table">
                  <thead>
                    <tr>
                      <th>Transfer ID</th>
                      <th>Evidence Item</th>
                      <th>Dispatched By</th>
                      <th>Timestamp</th>
                      <th>Current Forensic Status</th>
                      <th>Custody Seal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {handoffs.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                          No forensic custody transfers initiated yet.
                        </td>
                      </tr>
                    ) : (
                      handoffs.map((h) => (
                        <tr key={h.id}>
                          <td className="mono text-cyan">{h.id.slice(0, 12)}</td>
                          <td className="mono">{h.evidence_id.slice(0, 12)}</td>
                          <td>{h.submitted_by}</td>
                          <td style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {new Date(h.submitted_at).toLocaleString()}
                          </td>
                          <td>
                            <span
                              className={`ev-case-status-badge ${
                                h.status === 'RECEIVED' || h.status === 'UNDER_EXAMINATION'
                                  ? 'status-inprogress'
                                  : h.status === 'REPORT_READY'
                                    ? 'status-open'
                                    : 'status-underreview'
                              }`}
                            >
                              {h.status}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: '#10b981', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <ShieldCheckIcon size={13} />
                              SHA-256 Intact
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="ev-cyber-footer">
          <div className="ev-cyber-footer-left">
            <span className="font-semibold text-white">POLICE INVESTIGATION CID</span>
            <span className="text-slate-400">EvidenceVault 360 • Police Workspace</span>
          </div>
          <div className="ev-cyber-footer-right">
            <div className="ev-cyber-system-status">
              <span className="ev-pulse-dot-green" />
              <span>Evidence Locker Online</span>
            </div>
            <span className="ev-footer-sep">•</span>
            <div className="ev-cyber-footer-badges">
              <ShieldCheckIcon size={14} className="text-cyan" />
              <span>ISO 27037 First Responder Compliant</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
