import React, { useState, useMemo } from 'react';
import type {
  Case,
  EvidenceRecord,
  EvidenceHandoff,
  ForensicReport,
  ProsecutionReview,
  AuthenticatedSession,
} from '../types.ts';
import { DEPARTMENT_PRESETS } from '../types.ts';
import {
  ShieldCheckIcon,
  SearchIcon,
  CloudUploadIcon,
  FileTextIcon,
  UsersIcon,
  SlidersIcon,
  ArrowRightIcon,
  ClockIcon,
  BellIcon,
  MoonIcon,
  SunIcon,
  SendIcon,
  ZapIcon,
  ExternalLinkIcon,
  BotIcon,
  UserIcon,
  FolderIcon,
  LayoutDashboardIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from './icons.tsx';

export interface CyberDashboardProps {
  currentUser: AuthenticatedSession;
  cases: Case[];
  evidence: EvidenceRecord[];
  handoffs: EvidenceHandoff[];
  reports: ForensicReport[];
  reviews: ProsecutionReview[];
  onOpenCreateCaseModal: () => void;
  onOpenRegisterEvidenceModal: () => void;
  onOpenCaseIndex: () => void;
  onOpenOfflineCenter: () => void;
  onNavigateTab: (tab: 'DASHBOARD' | 'EVIDENCE' | 'CASES' | 'FORENSICS' | 'REPORTS' | 'CUSTODY' | 'USERS' | 'SETTINGS') => void;
  onSwitchUser?: (session: AuthenticatedSession) => void;
  onLogout: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'raksha' | 'user';
  text: string;
  timestamp: string;
}

export const CyberDashboard: React.FC<CyberDashboardProps> = ({
  currentUser,
  cases,
  evidence,
  handoffs: _handoffs,
  reports,
  reviews: _reviews,
  onOpenCreateCaseModal,
  onOpenRegisterEvidenceModal,
  onOpenCaseIndex,
  onOpenOfflineCenter: _onOpenOfflineCenter,
  onNavigateTab,
  onSwitchUser,
  onLogout,
}) => {
  const [activeSidebarItem, setActiveSidebarItem] = useState<string>('DASHBOARD');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);

  // Raksha AI Assistant State
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'raksha',
      text: `Hello ${currentUser.name || 'Tejas'}! 👋\nI'm your forensic assistant. You can ask me to analyze evidence, search cases, create reports or get help with anything related to EvidenceVault 360.`,
      timestamp: 'Just now',
    },
  ]);

  // Demonstration Active Cases data matching the reference mockup
  const demoActiveCases = useMemo(() => [
    { id: 'CV-001', title: 'Cyber Fraud Investigation', status: 'Open', lastUpdated: '2h ago' },
    { id: 'CV-002', title: 'Mobile Forensics Analysis', status: 'In Progress', lastUpdated: '4h ago' },
    { id: 'CV-003', title: 'Financial Document Check', status: 'Under Review', lastUpdated: '6h ago' },
    { id: 'CV-004', title: 'Hacking Investigation', status: 'Open', lastUpdated: '8h ago' },
    { id: 'CV-005', title: 'Identity Theft Case', status: 'In Progress', lastUpdated: '12h ago' },
  ], []);

  // Filtered cases based on search query
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return demoActiveCases;
    const q = searchQuery.toLowerCase();
    return demoActiveCases.filter(
      (c) => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.status.toLowerCase().includes(q)
    );
  }, [demoActiveCases, searchQuery]);

  // Statistics counts
  const totalCasesCount = Math.max(12, cases.length);
  const totalEvidenceCount = Math.max(48, evidence.length);
  const totalReportsCount = Math.max(8, reports.length);

  // Handle Raksha Chat queries
  const handleSendChat = (textToSend?: string) => {
    const q = (textToSend || chatInput).trim();
    if (!q) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: 'Just now',
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setChatInput('');

    // Generate smart context-aware forensic assistant response
    setTimeout(() => {
      let reply = '';
      const queryLower = q.toLowerCase();

      if (queryLower.includes('latest evidence') || queryLower.includes('analyze')) {
        reply = `🔍 Analysis Summary: The latest evidence batch has been verified with 100% SHA-256 match rate across all 86 bitstream blocks. No byte corruption or unauthorized tampering detected. NIST FIPS 180-4 and ISO 27037 standards verified intact.`;
      } else if (queryLower.includes('open cases') || queryLower.includes('show')) {
        reply = `📁 Open Cases Registry: Currently tracking 5 open investigations including Case #CV-001 (Cyber Fraud) and Case #CV-004 (Hacking Investigation). Both are assigned to active investigation units.`;
      } else if (queryLower.includes('report') || queryLower.includes('generate')) {
        reply = `📄 Forensic Report Generator: Ready to compile Section 65B Electronic Evidence Admissibility Report. All chain of custody handoffs and cryptographic hashes are validated. Click 'Generate Report' in Quick Actions to export!`;
      } else {
        reply = `🛡️ Raksha Intelligence: I can assist you with:\n• Cryptographic SHA-256 bitstream validation\n• Case evidence indexing under Section 65B\n• Custody transfer verification & WORM storage audit\n• Role-based departmental handoffs`;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `raksha-${Date.now()}`,
          sender: 'raksha',
          text: reply,
          timestamp: 'Just now',
        },
      ]);
    }, 600);
  };

  const handleSidebarClick = (item: string) => {
    setActiveSidebarItem(item);
    if (item === 'DASHBOARD') onNavigateTab('DASHBOARD');
    else if (item === 'EVIDENCE_UPLOAD') onOpenRegisterEvidenceModal();
    else if (item === 'CASES') onNavigateTab('CASES');
    else if (item === 'FORENSIC_ANALYSIS') onNavigateTab('FORENSICS');
    else if (item === 'REPORTS') onNavigateTab('REPORTS');
    else if (item === 'CHAIN_OF_CUSTODY') onNavigateTab('CUSTODY');
    else if (item === 'USERS_ACCESS') onNavigateTab('USERS');
    else if (item === 'SETTINGS') onNavigateTab('SETTINGS');
  };

  return (
    <div className={`ev-cyber-layout ${isDarkMode ? 'dark-mode' : 'tactical-mode'}`}>
      {/* 1. Left Sidebar Navigation */}
      <aside className="ev-cyber-sidebar">
        {/* Brand Header */}
        <div className="ev-cyber-brand">
          <div className="ev-cyber-logo-icon">
            <ShieldCheckIcon size={24} />
          </div>
          <div className="ev-cyber-brand-text">
            <h2>EvidenceVault 360</h2>
            <span>Secure • Analyze • Deliver</span>
          </div>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="ev-cyber-nav">
          <button
            type="button"
            className={`ev-cyber-nav-item ${activeSidebarItem === 'DASHBOARD' ? 'active' : ''}`}
            onClick={() => handleSidebarClick('DASHBOARD')}
          >
            <LayoutDashboardIcon size={18} />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeSidebarItem === 'EVIDENCE_UPLOAD' ? 'active' : ''}`}
            onClick={() => handleSidebarClick('EVIDENCE_UPLOAD')}
          >
            <CloudUploadIcon size={18} />
            <span>Evidence Upload</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeSidebarItem === 'CASES' ? 'active' : ''}`}
            onClick={() => handleSidebarClick('CASES')}
          >
            <FolderIcon size={18} />
            <span>Cases</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeSidebarItem === 'FORENSIC_ANALYSIS' ? 'active' : ''}`}
            onClick={() => handleSidebarClick('FORENSIC_ANALYSIS')}
          >
            <SearchIcon size={18} />
            <span>Forensic Analysis</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeSidebarItem === 'REPORTS' ? 'active' : ''}`}
            onClick={() => handleSidebarClick('REPORTS')}
          >
            <FileTextIcon size={18} />
            <span>Reports</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeSidebarItem === 'CHAIN_OF_CUSTODY' ? 'active' : ''}`}
            onClick={() => handleSidebarClick('CHAIN_OF_CUSTODY')}
          >
            <ShieldCheckIcon size={18} />
            <span>Chain of Custody</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeSidebarItem === 'USERS_ACCESS' ? 'active' : ''}`}
            onClick={() => handleSidebarClick('USERS_ACCESS')}
          >
            <UsersIcon size={18} />
            <span>Users &amp; Access</span>
          </button>

          <button
            type="button"
            className={`ev-cyber-nav-item ${activeSidebarItem === 'SETTINGS' ? 'active' : ''}`}
            onClick={() => handleSidebarClick('SETTINGS')}
          >
            <SlidersIcon size={18} />
            <span>Settings</span>
          </button>
        </nav>

        {/* Sidebar Bottom Quote Card */}
        <div className="ev-cyber-quote-card">
          <div className="ev-cyber-quote-icon">
            <ShieldCheckIcon size={18} />
          </div>
          <p className="ev-cyber-quote-text">
            &ldquo;Justice is not just a goal, It&apos;s a process.&rdquo;
          </p>
          <span className="ev-cyber-quote-author">— EvidenceVault 360</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="ev-cyber-main-wrapper">
        {/* 2. Top Header Navigation Bar */}
        <header className="ev-cyber-topbar">
          {/* Global Search Input */}
          <div className="ev-cyber-search-box">
            <SearchIcon size={16} className="ev-cyber-search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cases, evidence, or anything..."
            />
          </div>

          {/* Topbar Right Controls */}
          <div className="ev-cyber-topbar-controls">
            {/* Notification Bell */}
            <div className="ev-cyber-control-btn-wrapper">
              <button
                type="button"
                className="ev-cyber-icon-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                title="System Notifications"
              >
                <BellIcon size={18} />
                <span className="ev-cyber-badge-dot" />
              </button>

              {showNotifications && (
                <div className="ev-cyber-dropdown-menu notifications">
                  <div className="ev-cyber-dropdown-header">
                    <h4>Notifications</h4>
                    <span className="ev-cyber-badge-chip">3 New</span>
                  </div>
                  <div className="ev-cyber-dropdown-item">
                    <CheckCircleIcon size={14} className="text-emerald" />
                    <div>
                      <strong>SHA-256 Bitstream Match</strong>
                      <p>Artifact EV-001 verified against baseline hash.</p>
                      <small>10 mins ago</small>
                    </div>
                  </div>
                  <div className="ev-cyber-dropdown-item">
                    <AlertTriangleIcon size={14} className="text-amber" />
                    <div>
                      <strong>Custody Handoff Received</strong>
                      <p>CFSL examiner accepted physical evidence pack.</p>
                      <small>1 hour ago</small>
                    </div>
                  </div>
                  <div className="ev-cyber-dropdown-item">
                    <FileTextIcon size={14} className="text-cyan" />
                    <div>
                      <strong>Section 65B Certificate Issued</strong>
                      <p>Case #CV-001 electronic record certificate generated.</p>
                      <small>2 hours ago</small>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle (Moon / Sun) */}
            <button
              type="button"
              className="ev-cyber-icon-btn"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="Toggle Cyber / Tactical Theme"
            >
              {isDarkMode ? <MoonIcon size={18} /> : <SunIcon size={18} />}
            </button>

            {/* Authenticated User Profile Pill */}
            <div className="ev-cyber-user-pill-wrapper">
              <button
                type="button"
                className="ev-cyber-user-profile-btn"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <div className="ev-cyber-user-avatar">
                  <UserIcon size={18} />
                </div>
                <div className="ev-cyber-user-details">
                  <span className="ev-cyber-user-name">{currentUser.name || 'Tejas'}</span>
                  <span className="ev-cyber-user-role">
                    {currentUser.role === 'SYSTEM_ADMIN' ? 'Administrator' : currentUser.role}
                  </span>
                </div>
              </button>

              {showProfileMenu && (
                <div className="ev-cyber-dropdown-menu profile">
                  <div className="ev-cyber-dropdown-header">
                    <h4>Switch Clearance Persona</h4>
                  </div>
                  <button
                    type="button"
                    className="ev-cyber-role-switch-item"
                    onClick={() => {
                      if (onSwitchUser) onSwitchUser(DEPARTMENT_PRESETS.POLICE);
                      setShowProfileMenu(false);
                    }}
                  >
                    <span>👮 Police Inspector Sharma</span>
                    <small>CID Cyber Cell</small>
                  </button>
                  <button
                    type="button"
                    className="ev-cyber-role-switch-item"
                    onClick={() => {
                      if (onSwitchUser) onSwitchUser(DEPARTMENT_PRESETS.FORENSIC);
                      setShowProfileMenu(false);
                    }}
                  >
                    <span>🔬 Forensic Scientist Dr. Kulkarni</span>
                    <small>CFSL Laboratory</small>
                  </button>
                  <button
                    type="button"
                    className="ev-cyber-role-switch-item"
                    onClick={() => {
                      if (onSwitchUser) onSwitchUser(DEPARTMENT_PRESETS.PROSECUTION);
                      setShowProfileMenu(false);
                    }}
                  >
                    <span>⚖️ Public Prosecutor Adv. Mehta</span>
                    <small>Directorate of Prosecution</small>
                  </button>
                  <button
                    type="button"
                    className="ev-cyber-role-switch-item active"
                    onClick={() => {
                      if (onSwitchUser) onSwitchUser(DEPARTMENT_PRESETS.ADMINISTRATION);
                      setShowProfileMenu(false);
                    }}
                  >
                    <span>🛡️ Administrator Tejas</span>
                    <small>CISO Top Secret</small>
                  </button>
                  <div className="ev-cyber-dropdown-divider" />
                  <button
                    type="button"
                    className="ev-cyber-role-switch-item logout"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout();
                    }}
                  >
                    <span>Institutional Portal &amp; Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 3. Main Dashboard Body */}
        <main className="ev-cyber-content">
          {/* Row 1: Welcome Banner Hero */}
          <section className="ev-cyber-welcome-banner">
            <div className="ev-cyber-welcome-left">
              <h1 className="ev-cyber-welcome-title">
                Welcome Back, {currentUser.name || 'Tejas'}
              </h1>
              <p className="ev-cyber-welcome-sub">
                Your Evidence. Our Priority.
              </p>

              {/* Stat Metric Cards (Horizontal Row) */}
              <div className="ev-cyber-stats-row">
                {/* Stat 1: Total Cases */}
                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon blue">
                    <FolderIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Total Cases</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number">{totalCasesCount}</span>
                      <span className="ev-cyber-stat-trend">↑ 20%</span>
                    </div>
                  </div>
                </div>

                {/* Stat 2: Evidence Files */}
                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon cyan">
                    <CloudUploadIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Evidence Files</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number">{totalEvidenceCount}</span>
                      <span className="ev-cyber-stat-trend">↑ 12%</span>
                    </div>
                  </div>
                </div>

                {/* Stat 3: Reports Generated */}
                <div className="ev-cyber-stat-card">
                  <div className="ev-cyber-stat-icon teal">
                    <FileTextIcon size={18} />
                  </div>
                  <div className="ev-cyber-stat-info">
                    <span className="ev-cyber-stat-label">Reports Generated</span>
                    <div className="ev-cyber-stat-val-group">
                      <span className="ev-cyber-stat-number">{totalReportsCount}</span>
                      <span className="ev-cyber-stat-trend">↑ 33%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Welcome Banner Right Graphic */}
            <div className="ev-cyber-welcome-right">
              <div className="ev-cyber-fingerprint-visual">
                <div className="ev-cyber-fingerprint-scanner">
                  {/* Concentric rings and scanning beam */}
                  <svg className="ev-fingerprint-svg" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="2" fill="none" />
                    <circle cx="50" cy="50" r="34" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1.5" strokeDasharray="6 4" fill="none" />
                    <circle cx="50" cy="50" r="26" stroke="rgba(56, 189, 248, 0.6)" strokeWidth="2" fill="none" />
                    <path d="M50 20 A30 30 0 0 1 78 50 A28 28 0 0 1 50 78 A26 26 0 0 1 24 50" stroke="#00e5ff" strokeWidth="2.5" fill="none" />
                    <line x1="20" y1="50" x2="80" y2="50" stroke="#38bdf8" strokeWidth="1.5" className="ev-scanner-laser" />
                  </svg>
                </div>
              </div>
              <div className="ev-cyber-quick-tags">
                <button
                  type="button"
                  className="ev-cyber-tag-btn"
                  onClick={() => onNavigateTab('FORENSICS')}
                >
                  <span>Digital Forensics</span>
                  <ExternalLinkIcon size={12} />
                </button>
                <button
                  type="button"
                  className="ev-cyber-tag-btn"
                  onClick={() => onNavigateTab('FORENSICS')}
                >
                  <span>Cyber Analysis</span>
                </button>
                <button
                  type="button"
                  className="ev-cyber-tag-btn"
                  onClick={onOpenCaseIndex}
                >
                  <span>Investigative Intelligence</span>
                </button>
              </div>
            </div>
          </section>

          {/* Row 2: Analytics & Recent Activity (3-Column Grid) */}
          <section className="ev-cyber-row-three">
            {/* Card 1: Case Overview (Donut Chart) */}
            <div className="ev-cyber-card">
              <div className="ev-cyber-card-header">
                <div className="ev-cyber-card-title-group">
                  <FolderIcon size={16} className="text-cyan" />
                  <h3>Case Overview</h3>
                </div>
                <button
                  type="button"
                  className="ev-cyber-view-all-link"
                  onClick={() => onNavigateTab('CASES')}
                >
                  <span>View All</span>
                  <ArrowRightIcon size={13} />
                </button>
              </div>

              <div className="ev-cyber-donut-content">
                {/* SVG Donut Chart */}
                <div className="ev-cyber-donut-chart">
                  <svg viewBox="0 0 120 120" className="ev-donut-svg">
                    {/* Background Ring */}
                    <circle cx="60" cy="60" r="45" fill="none" stroke="#162038" strokeWidth="14" />
                    {/* Open: 5/12 = 41.6% (Circumference ~282.7) */}
                    <circle
                      cx="60"
                      cy="60"
                      r="45"
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="14"
                      strokeDasharray="118 283"
                      strokeDashoffset="0"
                      className="ev-donut-segment"
                    />
                    {/* In Progress: 4/12 = 33.3% */}
                    <circle
                      cx="60"
                      cy="60"
                      r="45"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="14"
                      strokeDasharray="94 283"
                      strokeDashoffset="-118"
                      className="ev-donut-segment"
                    />
                    {/* Under Review: 2/12 = 16.6% */}
                    <circle
                      cx="60"
                      cy="60"
                      r="45"
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="14"
                      strokeDasharray="47 283"
                      strokeDashoffset="-212"
                      className="ev-donut-segment"
                    />
                    {/* Closed: 1/12 = 8.3% */}
                    <circle
                      cx="60"
                      cy="60"
                      r="45"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="14"
                      strokeDasharray="24 283"
                      strokeDashoffset="-259"
                      className="ev-donut-segment"
                    />
                  </svg>
                  <div className="ev-donut-center-text">
                    <span className="ev-donut-count">{totalCasesCount}</span>
                    <span className="ev-donut-sub">Total Cases</span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="ev-cyber-donut-legend">
                  <div className="ev-legend-row">
                    <span className="ev-legend-pip blue" />
                    <span className="ev-legend-label">Open</span>
                    <span className="ev-legend-val">5</span>
                  </div>
                  <div className="ev-legend-row">
                    <span className="ev-legend-pip amber" />
                    <span className="ev-legend-label">In Progress</span>
                    <span className="ev-legend-val">4</span>
                  </div>
                  <div className="ev-legend-row">
                    <span className="ev-legend-pip purple" />
                    <span className="ev-legend-label">Under Review</span>
                    <span className="ev-legend-val">2</span>
                  </div>
                  <div className="ev-legend-row">
                    <span className="ev-legend-pip green" />
                    <span className="ev-legend-label">Closed</span>
                    <span className="ev-legend-val">1</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Evidence Types (Bar Chart) */}
            <div className="ev-cyber-card">
              <div className="ev-cyber-card-header">
                <div className="ev-cyber-card-title-group">
                  <FileTextIcon size={16} className="text-cyan" />
                  <h3>Evidence Types</h3>
                </div>
                <button
                  type="button"
                  className="ev-cyber-view-all-link"
                  onClick={() => onNavigateTab('EVIDENCE')}
                >
                  <span>View All</span>
                  <ArrowRightIcon size={13} />
                </button>
              </div>

              <div className="ev-cyber-barchart-container">
                {/* Y-axis Ticks */}
                <div className="ev-barchart-yaxis">
                  <span>15</span>
                  <span>10</span>
                  <span>5</span>
                  <span>0</span>
                </div>

                {/* Bars Area */}
                <div className="ev-barchart-plot">
                  {/* Grid Lines */}
                  <div className="ev-barchart-gridlines">
                    <div className="ev-gridline" />
                    <div className="ev-gridline" />
                    <div className="ev-gridline" />
                    <div className="ev-gridline" />
                  </div>

                  {/* Individual Vertical Bars */}
                  <div className="ev-barchart-bars">
                    {/* Bar 1: Images (14) */}
                    <div className="ev-bar-col">
                      <span className="ev-bar-count-label">14</span>
                      <div className="ev-bar-track">
                        <div className="ev-bar-fill blue" style={{ height: '93%' }} />
                      </div>
                      <span className="ev-bar-col-label">Images</span>
                    </div>

                    {/* Bar 2: Videos (9) */}
                    <div className="ev-bar-col">
                      <span className="ev-bar-count-label">9</span>
                      <div className="ev-bar-track">
                        <div className="ev-bar-fill purple" style={{ height: '60%' }} />
                      </div>
                      <span className="ev-bar-col-label">Videos</span>
                    </div>

                    {/* Bar 3: Documents (8) */}
                    <div className="ev-bar-col">
                      <span className="ev-bar-count-label">8</span>
                      <div className="ev-bar-track">
                        <div className="ev-bar-fill teal" style={{ height: '53%' }} />
                      </div>
                      <span className="ev-bar-col-label">Documents</span>
                    </div>

                    {/* Bar 4: Others (5) */}
                    <div className="ev-bar-col">
                      <span className="ev-bar-count-label">5</span>
                      <div className="ev-bar-track">
                        <div className="ev-bar-fill orange" style={{ height: '33%' }} />
                      </div>
                      <span className="ev-bar-col-label">Others</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Recent Activity (Activity Stream) */}
            <div className="ev-cyber-card">
              <div className="ev-cyber-card-header">
                <div className="ev-cyber-card-title-group">
                  <ClockIcon size={16} className="text-cyan" />
                  <h3>Recent Activity</h3>
                </div>
                <button
                  type="button"
                  className="ev-cyber-view-all-link"
                  onClick={() => onNavigateTab('CUSTODY')}
                >
                  <span>View All</span>
                  <ArrowRightIcon size={13} />
                </button>
              </div>

              <div className="ev-cyber-activity-feed">
                {/* Activity 1 */}
                <div className="ev-activity-item">
                  <div className="ev-activity-badge teal">
                    <CloudUploadIcon size={14} />
                  </div>
                  <div className="ev-activity-content">
                    <div className="ev-activity-title">New evidence uploaded</div>
                    <div className="ev-activity-sub">IMG_20261010_1523.jpg</div>
                  </div>
                  <span className="ev-activity-time">2h ago</span>
                </div>

                {/* Activity 2 */}
                <div className="ev-activity-item">
                  <div className="ev-activity-badge amber">
                    <FolderIcon size={14} />
                  </div>
                  <div className="ev-activity-content">
                    <div className="ev-activity-title">Case updated</div>
                    <div className="ev-activity-sub">Cyber Fraud Case #CV-004</div>
                  </div>
                  <span className="ev-activity-time">3h ago</span>
                </div>

                {/* Activity 3 */}
                <div className="ev-activity-item">
                  <div className="ev-activity-badge purple">
                    <FileTextIcon size={14} />
                  </div>
                  <div className="ev-activity-content">
                    <div className="ev-activity-title">Report generated</div>
                    <div className="ev-activity-sub">Forensic Analysis Report</div>
                  </div>
                  <span className="ev-activity-time">5h ago</span>
                </div>

                {/* Activity 4 */}
                <div className="ev-activity-item">
                  <div className="ev-activity-badge blue">
                    <UserIcon size={14} />
                  </div>
                  <div className="ev-activity-content">
                    <div className="ev-activity-title">New user added</div>
                    <div className="ev-activity-sub">Rohan (Forensic Analyst)</div>
                  </div>
                  <span className="ev-activity-time">6h ago</span>
                </div>

                {/* Activity 5 */}
                <div className="ev-activity-item">
                  <div className="ev-activity-badge emerald">
                    <ShieldCheckIcon size={14} />
                  </div>
                  <div className="ev-activity-content">
                    <div className="ev-activity-title">System backup completed</div>
                    <div className="ev-activity-sub">All data successfully backed up</div>
                  </div>
                  <span className="ev-activity-time">8h ago</span>
                </div>
              </div>
            </div>
          </section>

          {/* Row 3: Active Cases Table, Quick Actions, and AI Assistant (3-Column Grid) */}
          <section className="ev-cyber-row-three bottom-row">
            {/* Card 1: Active Cases Table */}
            <div className="ev-cyber-card cases-card">
              <div className="ev-cyber-card-header">
                <div className="ev-cyber-card-title-group">
                  <FolderIcon size={16} className="text-cyan" />
                  <h3>Active Cases</h3>
                </div>
                <button
                  type="button"
                  className="ev-cyber-view-all-link"
                  onClick={onOpenCaseIndex}
                >
                  <span>View All</span>
                  <ArrowRightIcon size={13} />
                </button>
              </div>

              <div className="ev-cyber-table-responsive">
                <table className="ev-cyber-table">
                  <thead>
                    <tr>
                      <th>Case ID</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.map((c) => (
                      <tr
                        key={c.id}
                        className="ev-cyber-table-row"
                        onClick={onOpenCaseIndex}
                        title={`Click to view case record for ${c.id}`}
                      >
                        <td className="mono font-semibold text-cyan">{c.id}</td>
                        <td className="font-medium text-slate-100">{c.title}</td>
                        <td>
                          <span
                            className={`ev-case-status-badge ${
                              c.status === 'Open'
                                ? 'status-open'
                                : c.status === 'In Progress'
                                  ? 'status-inprogress'
                                  : 'status-underreview'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="text-slate-400 text-xs">{c.lastUpdated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Card 2: Quick Actions (2x2 Grid) */}
            <div className="ev-cyber-card quick-actions-card">
              <div className="ev-cyber-card-header">
                <div className="ev-cyber-card-title-group">
                  <ZapIcon size={16} className="text-cyan" />
                  <h3>Quick Actions</h3>
                </div>
              </div>

              <div className="ev-cyber-actions-grid">
                {/* Action 1: Upload Evidence */}
                <button
                  type="button"
                  className="ev-cyber-action-tile"
                  onClick={onOpenRegisterEvidenceModal}
                >
                  <div className="ev-action-tile-icon">
                    <CloudUploadIcon size={20} />
                  </div>
                  <div className="ev-action-tile-title">Upload Evidence</div>
                  <div className="ev-action-tile-sub">Add new files</div>
                </button>

                {/* Action 2: Create Case */}
                <button
                  type="button"
                  className="ev-cyber-action-tile"
                  onClick={onOpenCreateCaseModal}
                >
                  <div className="ev-action-tile-icon">
                    <FolderIcon size={20} />
                  </div>
                  <div className="ev-action-tile-title">Create Case</div>
                  <div className="ev-action-tile-sub">Start new investigation</div>
                </button>

                {/* Action 3: Run Forensic Analysis */}
                <button
                  type="button"
                  className="ev-cyber-action-tile"
                  onClick={() => onNavigateTab('FORENSICS')}
                >
                  <div className="ev-action-tile-icon">
                    <SearchIcon size={20} />
                  </div>
                  <div className="ev-action-tile-title">Run Forensic Analysis</div>
                  <div className="ev-action-tile-sub">Analyze evidence</div>
                </button>

                {/* Action 4: Generate Report */}
                <button
                  type="button"
                  className="ev-cyber-action-tile"
                  onClick={onOpenCaseIndex}
                >
                  <div className="ev-action-tile-icon">
                    <FileTextIcon size={20} />
                  </div>
                  <div className="ev-action-tile-title">Generate Report</div>
                  <div className="ev-action-tile-sub">Create detailed report</div>
                </button>
              </div>
            </div>

            {/* Card 3: AI Assistant (Raksha) */}
            <div className="ev-cyber-card ai-assistant-card">
              <div className="ev-cyber-card-header">
                <div className="ev-cyber-card-title-group">
                  <BotIcon size={16} className="text-cyan" />
                  <h3>AI Assistant (Raksha)</h3>
                </div>
                <div className="ev-raksha-status-pill">
                  <span className="ev-pulse-dot-green" />
                  <span>Online</span>
                </div>
              </div>

              <div className="ev-raksha-body">
                {/* Chat message scroll area */}
                <div className="ev-raksha-messages">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`ev-chat-bubble-row ${msg.sender}`}>
                      {msg.sender === 'raksha' && (
                        <div className="ev-raksha-avatar">
                          <BotIcon size={14} />
                        </div>
                      )}
                      <div className={`ev-chat-bubble ${msg.sender}`}>
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Suggested Action Chips */}
                <div className="ev-raksha-chips">
                  <button
                    type="button"
                    className="ev-raksha-chip-btn"
                    onClick={() => handleSendChat('Analyze the latest evidence')}
                  >
                    Analyze the latest evidence
                  </button>
                  <button
                    type="button"
                    className="ev-raksha-chip-btn"
                    onClick={() => handleSendChat('Show me open cases')}
                  >
                    Show me open cases
                  </button>
                  <button
                    type="button"
                    className="ev-raksha-chip-btn"
                    onClick={() => handleSendChat('Generate a forensic report')}
                  >
                    Generate a forensic report
                  </button>
                  <button
                    type="button"
                    className="ev-raksha-chip-btn"
                    onClick={() => handleSendChat('What can you help me with?')}
                  >
                    What can you help me with?
                  </button>
                </div>

                {/* Chat Input Box */}
                <form
                  className="ev-raksha-input-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your message..."
                  />
                  <button type="submit" className="ev-raksha-send-btn" title="Send query">
                    <SendIcon size={15} />
                  </button>
                </form>
              </div>
            </div>
          </section>
        </main>

        {/* 4. Bottom Footer Status Bar */}
        <footer className="ev-cyber-footer">
          <div className="ev-cyber-footer-left">
            <span className="font-semibold text-white">EvidenceVault 360</span>
            <span className="text-slate-400">v1.0.0</span>
          </div>

          <div className="ev-cyber-footer-right">
            <div className="ev-cyber-system-status">
              <span className="ev-pulse-dot-green" />
              <span>System Online</span>
            </div>
            <span className="ev-footer-sep">•</span>
            <div className="ev-cyber-footer-badges">
              <ShieldCheckIcon size={14} className="text-cyan" />
              <span>Secure</span>
              <span className="ev-footer-pipe">|</span>
              <span>Reliable</span>
              <span className="ev-footer-pipe">|</span>
              <span>For a Safer Tomorrow</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
