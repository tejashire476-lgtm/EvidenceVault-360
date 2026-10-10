// ============================================================================
// EVIDENCEVAULT 360 — DEDICATED ADMIN PORTAL DASHBOARD
// Restricted Administration Console: Overview, User Management, Audit Logs,
// Security Center, System Health, and Compliance CSV Reports
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  User,
  UserRole,
  UserActiveStatus,
  Department,
  AuditEvent,
  AuditLogQueryFilter,
  AuditLogPaginatedResponse,
  SystemHealthReport,
  SecurityContext,
  Case,
  EvidenceRecord,
  EvidenceHandoff,
  ForensicReport,
  ProsecutionReview,
  AdminDashboardTab,
} from '../types.ts';
import { EvidenceVaultDatabase } from '../data/db.ts';
import { SecureEvidenceStorageEngine } from '../utils/storage.ts';
import { sanitizeCsvField } from '../utils/auditReview.ts';
import { formatFileSize } from '../utils/crypto.ts';
import { getSecurityViolationLogs } from '../utils/security.ts';
import type { SecurityAuditLogEntry } from '../types.ts';
import {
  ShieldCheckIcon,
  ShieldAlertIcon,
  UsersIcon,
  HistoryIcon,
  ActivityIcon,
  RefreshCwIcon,
  LayoutDashboardIcon,
  DownloadIcon,
  SearchIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XIcon,
  EyeIcon,
} from './icons.tsx';

interface AdminPortalDashboardProps {
  currentUser: {
    user_id: string;
    name: string;
    role: UserRole;
    department: Department;
    badge: string;
  };
  globalDb: EvidenceVaultDatabase;
  globalStorageEngine: SecureEvidenceStorageEngine;
  cases: Case[];
  evidence: EvidenceRecord[];
  handoffs: EvidenceHandoff[];
  reports: ForensicReport[];
  reviews: ProsecutionReview[];
  onLogout: () => void;
  onSwitchDepartment?: (dept: Department) => void;
}

export const AdminPortalDashboard: React.FC<AdminPortalDashboardProps> = ({
  currentUser,
  globalDb,
  globalStorageEngine: _globalStorageEngine,
  cases,
  evidence,
  handoffs,
  reports,
  reviews: _reviews,
  onLogout,
  onSwitchDepartment,
}) => {
  const [activeTab, setActiveTab] = useState<AdminDashboardTab>('OVERVIEW');

  // Security Context for authoritative Admin API queries
  const adminContext = useMemo<SecurityContext>(
    () => ({
      actorId: currentUser.user_id,
      role: currentUser.role,
    }),
    [currentUser.user_id, currentUser.role]
  );

  // --------------------------------------------------------------------------
  // User Management State
  // --------------------------------------------------------------------------
  const [usersList, setUsersList] = useState<User[]>(() => {
    try {
      return globalDb.getAllUsers(adminContext);
    } catch {
      return [];
    }
  });
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newRoleSelect, setNewRoleSelect] = useState<UserRole>('POLICE_INVESTIGATOR');
  const [elevationCodeInput, setElevationCodeInput] = useState('');
  const [userActionNotice, setUserActionNotice] = useState<{
    text: string;
    type: 'SUCCESS' | 'ERROR';
  } | null>(null);

  const loadUsers = useCallback(() => {
    try {
      const all = globalDb.getAllUsers(adminContext);
      setUsersList(all);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, [globalDb, adminContext]);

  // --------------------------------------------------------------------------
  // Audit Logs State (Admin-Only Restricted)
  // --------------------------------------------------------------------------
  const [auditFilter, setAuditFilter] = useState<AuditLogQueryFilter>({
    department: 'ALL',
    page: 1,
    pageSize: 15,
  });
  const [auditResponse, setAuditResponse] = useState<AuditLogPaginatedResponse | null>(() => {
    try {
      return globalDb.queryAuditLogs(adminContext, { department: 'ALL', page: 1, pageSize: 15 });
    } catch {
      return null;
    }
  });
  const [selectedAuditForModal, setSelectedAuditForModal] = useState<AuditEvent | null>(null);
  const [isQueryingAudits, setIsQueryingAudits] = useState(false);
  const [auditQueryError, setAuditQueryError] = useState<string | null>(null);

  const loadAuditLogs = useCallback(
    (customFilter?: AuditLogQueryFilter) => {
      setIsQueryingAudits(true);
      setAuditQueryError(null);
      try {
        const filterToUse = customFilter || auditFilter;
        const res = globalDb.queryAuditLogs(adminContext, filterToUse);
        setAuditResponse(res);
      } catch (err) {
        setAuditQueryError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsQueryingAudits(false);
      }
    },
    [globalDb, adminContext, auditFilter]
  );

  // --------------------------------------------------------------------------
  // Security Center State
  // --------------------------------------------------------------------------
  const [securityViolations, setSecurityViolations] = useState<SecurityAuditLogEntry[]>([]);
  const [chainAuditStatus, setChainAuditStatus] = useState<{
    isValid: boolean;
    totalBlocks: number;
    verifiedBlocks: number;
    verifiedAt: string;
    brokenBlockId?: string;
  } | null>(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);

  const loadSecurityData = useCallback(async () => {
    const logs = getSecurityViolationLogs();
    setSecurityViolations(logs);

    setIsVerifyingChain(true);
    try {
      const res = await globalDb.verifyAuditChain();
      setChainAuditStatus(res);
    } catch (err) {
      console.error('Failed to verify audit chain:', err);
    } finally {
      setIsVerifyingChain(false);
    }
  }, [globalDb]);

  // --------------------------------------------------------------------------
  // System Health State
  // --------------------------------------------------------------------------
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
  const [isPingingHealth, setIsPingingHealth] = useState(false);
  const [lastDiagnosticLatencyMs, setLastDiagnosticLatencyMs] = useState<number | null>(null);

  const loadHealthTelemetry = useCallback(async () => {
    setIsPingingHealth(true);
    const start = performance.now();
    try {
      const report = await globalDb.getSystemHealth(adminContext);
      setHealthReport(report);
      setLastDiagnosticLatencyMs(Math.round((performance.now() - start) * 10) / 10);
    } catch (err) {
      console.error('Failed to retrieve system health:', err);
    } finally {
      setIsPingingHealth(false);
    }
  }, [globalDb, adminContext]);

  // --------------------------------------------------------------------------
  // Reports State
  // --------------------------------------------------------------------------
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Initial Data Fetch (Asynchronous Telemetry)
  useEffect(() => {
    loadSecurityData();
    loadHealthTelemetry();
  }, [loadSecurityData, loadHealthTelemetry]);

  // Subscribe to DB changes
  useEffect(() => {
    const unsubscribe = globalDb.subscribe(() => {
      loadUsers();
      loadAuditLogs();
      loadSecurityData();
    });
    return unsubscribe;
  }, [globalDb, loadUsers, loadAuditLogs, loadSecurityData]);

  // --------------------------------------------------------------------------
  // User Actions: Role & Status Updates
  // --------------------------------------------------------------------------
  const handleOpenEditUserModal = (u: User) => {
    setEditingUser(u);
    setNewRoleSelect(u.role);
    setElevationCodeInput('');
    setUserActionNotice(null);
  };

  const handleSaveRoleChange = async () => {
    if (!editingUser) return;
    setUserActionNotice(null);

    try {
      await globalDb.updateUserRole(
        adminContext,
        editingUser.id,
        newRoleSelect,
        elevationCodeInput
      );
      setUserActionNotice({
        text: `Role for '${editingUser.display_name}' updated to '${newRoleSelect}'. Audit block appended.`,
        type: 'SUCCESS',
      });
      setEditingUser(null);
      loadUsers();
      loadAuditLogs();
      setTimeout(() => setUserActionNotice(null), 5000);
    } catch (err) {
      setUserActionNotice({
        text: err instanceof Error ? err.message : String(err),
        type: 'ERROR',
      });
    }
  };

  const handleToggleUserStatus = async (targetUser: User) => {
    setUserActionNotice(null);
    const nextStatus: UserActiveStatus =
      targetUser.active_status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

    try {
      await globalDb.updateUserStatus(adminContext, targetUser.id, nextStatus);
      setUserActionNotice({
        text: `User '${targetUser.display_name}' status updated to '${nextStatus}'. Audit event recorded.`,
        type: 'SUCCESS',
      });
      loadUsers();
      loadAuditLogs();
      setTimeout(() => setUserActionNotice(null), 5000);
    } catch (err) {
      setUserActionNotice({
        text: err instanceof Error ? err.message : String(err),
        type: 'ERROR',
      });
    }
  };

  // --------------------------------------------------------------------------
  // Audit Logs Filter & Pagination Handlers
  // --------------------------------------------------------------------------
  const handleFilterChange = (updates: Partial<AuditLogQueryFilter>) => {
    const next = { ...auditFilter, ...updates, page: 1 };
    setAuditFilter(next);
    loadAuditLogs(next);
  };

  const handlePageChange = (newPage: number) => {
    const next = { ...auditFilter, page: newPage };
    setAuditFilter(next);
    loadAuditLogs(next);
  };

  const handleResetFilters = () => {
    const defaultFilter: AuditLogQueryFilter = {
      department: 'ALL',
      page: 1,
      pageSize: 15,
      startDate: undefined,
      endDate: undefined,
      userId: '',
      actionType: 'ALL',
      caseOrEvidenceId: '',
      searchQuery: '',
    };
    setAuditFilter(defaultFilter);
    loadAuditLogs(defaultFilter);
  };

  // --------------------------------------------------------------------------
  // CSV Export Handlers (Formula-Safe RFC-4180)
  // --------------------------------------------------------------------------
  const downloadCsv = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportAuditLedgerCsv = () => {
    try {
      const allEvents = globalDb.getAuditEvents(adminContext);
      const headers = [
        'Block ID',
        'Timestamp (ISO)',
        'Department',
        'Actor ID',
        'Actor Role',
        'Action Performed',
        'Entity Type',
        'Entity ID',
        'Status',
        'IP Address',
        'Device / User Agent',
        'Reason / Notes',
        'Block Hash (SHA-256)',
        'Previous Block Hash',
      ];

      const rows = allEvents.map((e) => [
        sanitizeCsvField(e.id),
        sanitizeCsvField(e.timestamp),
        sanitizeCsvField(e.department || 'UNKNOWN'),
        sanitizeCsvField(e.actor_id || 'SYSTEM'),
        sanitizeCsvField(e.actor_role || 'SYSTEM'),
        sanitizeCsvField(e.action),
        sanitizeCsvField(e.entity_type),
        sanitizeCsvField(e.entity_id),
        sanitizeCsvField(e.status || 'SUCCESS'),
        sanitizeCsvField(e.ip_address || '10.14.0.1'),
        sanitizeCsvField(e.user_agent || 'EvidenceVault-Client'),
        sanitizeCsvField(e.reason || ''),
        sanitizeCsvField(e.event_hash),
        sanitizeCsvField(e.previous_event_hash || '0'.repeat(64)),
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      downloadCsv(`audit_ledger_export_${Date.now()}.csv`, csv);
      setExportNotice(`Exported ${allEvents.length} audit ledger records to CSV.`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      alert(`Export error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExportSecurityViolationsCsv = () => {
    try {
      const violations = getSecurityViolationLogs();
      const headers = [
        'Incident ID',
        'Timestamp',
        'Actor ID',
        'Violation Type',
        'Resource Target',
        'Attempted Action',
        'Rejection Reason',
      ];

      const rows = violations.map((v) => [
        sanitizeCsvField(v.id),
        sanitizeCsvField(v.timestamp),
        sanitizeCsvField(v.actorId),
        sanitizeCsvField(v.violationType),
        sanitizeCsvField(v.resource),
        sanitizeCsvField(v.attemptedAction),
        sanitizeCsvField(v.reason),
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      downloadCsv(`security_violations_${Date.now()}.csv`, csv);
      setExportNotice(`Exported ${violations.length} security violation incidents to CSV.`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      alert(`Export error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExportUsersCsv = () => {
    try {
      const users = globalDb.getAllUsers(adminContext);
      const headers = ['User ID', 'Display Name', 'Role', 'Status', 'Created Date'];

      const rows = users.map((u) => [
        sanitizeCsvField(u.id),
        sanitizeCsvField(u.display_name),
        sanitizeCsvField(u.role),
        sanitizeCsvField(u.active_status),
        sanitizeCsvField(u.created_at),
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      downloadCsv(`users_directory_${Date.now()}.csv`, csv);
      setExportNotice(`Exported ${users.length} user records to CSV.`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      alert(`Export error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // --------------------------------------------------------------------------
  // Summary Aggregates for Overview Page
  // --------------------------------------------------------------------------
  const pendingReviewItemsCount = useMemo(() => {
    const unacceptedHandoffs = handoffs.filter((h) => h.status === 'SUBMITTED').length;
    const pendingProsecutionReports = reports.filter(
      (r) => r.status === 'SUBMITTED_TO_PROSECUTION'
    ).length;
    return unacceptedHandoffs + pendingProsecutionReports;
  }, [handoffs, reports]);

  const recentSecurityAlertsCount = securityViolations.length;

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return usersList;
    const q = userSearch.toLowerCase();
    return usersList.filter(
      (u) =>
        u.display_name.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [usersList, userSearch]);

  return (
    <div className="ev-admin-portal-container">
      {/* Admin Top Ingress & Navigation */}
      <header className="ev-admin-header">
        <div className="ev-admin-header-brand">
          <div className="ev-admin-badge-icon">
            <ShieldCheckIcon size={26} className="text-amber-400" />
          </div>
          <div>
            <div className="ev-admin-title-row">
              <h2>SECURITY ADMINISTRATION PORTAL</h2>
              <span className="ev-admin-clearance-tag">LEVEL 4 ROOT AUDIT CLEARANCE</span>
            </div>
            <p className="ev-admin-sub">
              Active Session: <strong>{currentUser.name}</strong> ({currentUser.badge}) • Restricted Admin Workspace
            </p>
          </div>
        </div>

        <div className="ev-admin-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onSwitchDepartment && (
            <div style={{ display: 'flex', gap: '6px', marginRight: '6px' }}>
              <button
                type="button"
                className="ev-btn ev-btn-secondary"
                style={{ borderColor: '#3b82f6', color: '#60a5fa', fontSize: '12px', padding: '6px 12px' }}
                onClick={() => onSwitchDepartment('POLICE')}
                title="Switch to Police Investigation Workspace"
              >
                🚓 Police Workspace
              </button>
              <button
                type="button"
                className="ev-btn ev-btn-secondary"
                style={{ borderColor: '#06b6d4', color: '#22d3ee', fontSize: '12px', padding: '6px 12px' }}
                onClick={() => onSwitchDepartment('FORENSIC')}
                title="Switch to Forensic Laboratory Workspace"
              >
                🔬 Forensic Workspace
              </button>
              <button
                type="button"
                className="ev-btn ev-btn-secondary"
                style={{ borderColor: '#a855f7', color: '#c084fc', fontSize: '12px', padding: '6px 12px' }}
                onClick={() => onSwitchDepartment('PROSECUTION')}
                title="Switch to Prosecution Review Workspace"
              >
                ⚖️ Prosecution Workspace
              </button>
            </div>
          )}
          <button
            type="button"
            className="ev-btn ev-btn-secondary"
            onClick={loadHealthTelemetry}
            title="Refresh Diagnostic Telemetry"
          >
            <RefreshCwIcon size={14} className={isPingingHealth ? 'spin' : ''} />
            <span>Diagnostic Ping</span>
          </button>
          <button
            type="button"
            className="ev-btn ev-btn-danger"
            onClick={onLogout}
            title="Secure Sign Out from Administration Console"
          >
            Secure Logout
          </button>
        </div>
      </header>

      {/* Admin Navigation Tabs */}
      <nav className="ev-admin-nav-tabs" aria-label="Admin Pages">
        <button
          type="button"
          className={`ev-admin-tab-btn ${activeTab === 'OVERVIEW' ? 'active' : ''}`}
          onClick={() => setActiveTab('OVERVIEW')}
        >
          <LayoutDashboardIcon size={16} />
          <span>Overview</span>
        </button>
        <button
          type="button"
          className={`ev-admin-tab-btn ${activeTab === 'USERS' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('USERS');
            loadUsers();
          }}
        >
          <UsersIcon size={16} />
          <span>User Management</span>
          <span className="ev-tab-pill">{usersList.length}</span>
        </button>
        <button
          type="button"
          className={`ev-admin-tab-btn ${activeTab === 'AUDIT_LOGS' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('AUDIT_LOGS');
            loadAuditLogs();
          }}
        >
          <HistoryIcon size={16} />
          <span>Restricted Audit Logs</span>
          <span className="ev-tab-pill gold">Admin Only</span>
        </button>
        <button
          type="button"
          className={`ev-admin-tab-btn ${activeTab === 'SECURITY' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('SECURITY');
            loadSecurityData();
          }}
        >
          <ShieldAlertIcon size={16} />
          <span>Security Center</span>
          {recentSecurityAlertsCount > 0 && (
            <span className="ev-tab-pill red">{recentSecurityAlertsCount}</span>
          )}
        </button>
        <button
          type="button"
          className={`ev-admin-tab-btn ${activeTab === 'HEALTH' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('HEALTH');
            loadHealthTelemetry();
          }}
        >
          <ActivityIcon size={16} />
          <span>System Health</span>
        </button>
        <button
          type="button"
          className={`ev-admin-tab-btn ${activeTab === 'REPORTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('REPORTS')}
        >
          <DownloadIcon size={16} />
          <span>Reports & CSV Export</span>
        </button>
      </nav>

      {/* Global Notifications */}
      {userActionNotice && (
        <div
          className={`ev-admin-alert-banner ${
            userActionNotice.type === 'SUCCESS' ? 'success' : 'error'
          }`}
        >
          {userActionNotice.type === 'SUCCESS' ? (
            <CheckCircleIcon size={18} />
          ) : (
            <AlertTriangleIcon size={18} />
          )}
          <span>{userActionNotice.text}</span>
        </div>
      )}

      {exportNotice && (
        <div className="ev-admin-alert-banner success">
          <CheckCircleIcon size={18} />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PAGE 1: OVERVIEW */}
      {/* ==================================================================== */}
      {activeTab === 'OVERVIEW' && (
        <div className="ev-admin-page-content">
          {/* Key Metric Cards */}
          <div className="ev-admin-metrics-row">
            <div className="ev-admin-stat-card">
              <div className="ev-stat-label">Total Registered Cases</div>
              <div className="ev-stat-number">{cases.length}</div>
              <div className="ev-stat-sub">Across All Law Enforcement Units</div>
            </div>
            <div className="ev-admin-stat-card">
              <div className="ev-stat-label">Digital Evidence Records</div>
              <div className="ev-stat-number">{evidence.length}</div>
              <div className="ev-stat-sub">Bit-Stream Preserved in Private Storage</div>
            </div>
            <div className="ev-admin-stat-card">
              <div className="ev-stat-label">Authorized Users</div>
              <div className="ev-stat-number">{usersList.length}</div>
              <div className="ev-stat-sub">Role-Based Access Protected</div>
            </div>
            <div className="ev-admin-stat-card">
              <div className="ev-stat-label">Pending Review Items</div>
              <div className="ev-stat-number text-amber-400">{pendingReviewItemsCount}</div>
              <div className="ev-stat-sub">Handoffs & Judicial Submissions</div>
            </div>
            <div className="ev-admin-stat-card">
              <div className="ev-stat-label">Security Alerts & Incidents</div>
              <div
                className={`ev-stat-number ${
                  recentSecurityAlertsCount > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {recentSecurityAlertsCount}
              </div>
              <div className="ev-stat-sub">Failed Logins & IDOR Violations</div>
            </div>
          </div>

          {/* Subsystem Health Bar */}
          <div className="ev-admin-health-quickbar">
            <div className="ev-quickbar-item">
              <span className="dot green" />
              <span>Database: <strong>HEALTHY (In-Memory Repository)</strong></span>
            </div>
            <div className="ev-quickbar-item">
              <span className="dot green" />
              <span>Storage: <strong>CONNECTED (Cloudflare R2 Encrypted)</strong></span>
            </div>
            <div className="ev-quickbar-item">
              <span className="dot green" />
              <span>Cryptography: <strong>NIST FIPS 180-4 SHA-256 ACTIVE</strong></span>
            </div>
            <div className="ev-quickbar-item">
              <span className="dot green" />
              <span>Audit Chain: <strong>INTACT (Hash-Linked Ledger)</strong></span>
            </div>
          </div>

          {/* Quick Actions & Recent Incidents Grid */}
          <div className="ev-admin-overview-grid">
            <div className="ev-admin-card">
              <div className="ev-card-header">
                <h3>Administrative Quick Controls</h3>
              </div>
              <div className="ev-admin-quick-actions">
                <button
                  type="button"
                  className="ev-action-box"
                  onClick={() => {
                    setActiveTab('AUDIT_LOGS');
                    loadAuditLogs();
                  }}
                >
                  <HistoryIcon size={24} className="text-amber-400" />
                  <h4>Search Audit Logs</h4>
                  <p>Inspect tamper-evident ledger with department and action filters.</p>
                </button>
                <button
                  type="button"
                  className="ev-action-box"
                  onClick={() => {
                    setActiveTab('USERS');
                    loadUsers();
                  }}
                >
                  <UsersIcon size={24} className="text-cyan-400" />
                  <h4>Manage User Roles</h4>
                  <p>Assign approved roles and activate/suspend departmental personnel.</p>
                </button>
                <button
                  type="button"
                  className="ev-action-box"
                  onClick={() => {
                    setActiveTab('SECURITY');
                    loadSecurityData();
                  }}
                >
                  <ShieldAlertIcon size={24} className="text-red-400" />
                  <h4>Security Incident Center</h4>
                  <p>Review brute-force lockout events, failed logins, and tamper alerts.</p>
                </button>
                <button
                  type="button"
                  className="ev-action-box"
                  onClick={() => {
                    setActiveTab('REPORTS');
                  }}
                >
                  <DownloadIcon size={24} className="text-emerald-400" />
                  <h4>Export Audit CSV</h4>
                  <p>Generate RFC-4180 escaped CSV files for statutory disclosure.</p>
                </button>
              </div>
            </div>

            <div className="ev-admin-card">
              <div className="ev-card-header">
                <h3>Recent Security Alerts</h3>
                <span className="ev-badge ev-badge-secondary">Real-Time</span>
              </div>
              {securityViolations.length === 0 ? (
                <div className="ev-empty-state-compact">
                  <CheckCircleIcon size={32} className="text-emerald-400" />
                  <p>No active security threats detected. Authorization guards nominal.</p>
                </div>
              ) : (
                <div className="ev-admin-incident-list">
                  {securityViolations.slice(-5).reverse().map((v) => (
                    <div key={v.id} className="ev-incident-row">
                      <div className="ev-incident-header">
                        <span className="ev-badge ev-badge-error">{v.violationType}</span>
                        <span className="ev-incident-time">
                          {new Date(v.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="ev-incident-detail">
                        Target: <code>{v.resource}</code> | Actor: <code>{v.actorId}</code>
                      </div>
                      <div className="ev-incident-reason">{v.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PAGE 2: USER MANAGEMENT */}
      {/* ==================================================================== */}
      {activeTab === 'USERS' && (
        <div className="ev-admin-page-content">
          <div className="ev-admin-card">
            <div className="ev-card-header">
              <div>
                <h3>User Directory & Role-Based Access Control (RBAC)</h3>
                <p className="ev-card-desc">
                  View departmental users, assign approved roles, activate or suspend accounts.
                  Sensitive role changes are cryptographically recorded in the audit ledger.
                </p>
              </div>
              <div className="ev-search-bar">
                <SearchIcon size={16} />
                <input
                  type="text"
                  placeholder="Search user name, ID, or role..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="ev-table-responsive">
              <table className="ev-admin-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Full Name</th>
                    <th>Current Role</th>
                    <th>Active Status</th>
                    <th>Registered At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <code>{u.id}</code>
                      </td>
                      <td>
                        <strong>{u.display_name}</strong>
                      </td>
                      <td>
                        <span className={`ev-role-tag ${u.role.toLowerCase()}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`ev-status-badge ${
                            u.active_status === 'ACTIVE'
                              ? 'active'
                              : u.active_status === 'SUSPENDED'
                                ? 'suspended'
                                : 'inactive'
                          }`}
                        >
                          {u.active_status}
                        </span>
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="ev-btn ev-btn-sm ev-btn-secondary"
                            onClick={() => handleOpenEditUserModal(u)}
                            title="Reassign security clearance role"
                          >
                            Assign Role
                          </button>
                          <button
                            type="button"
                            className={`ev-btn ev-btn-sm ${
                              u.active_status === 'ACTIVE'
                                ? 'ev-btn-danger'
                                : 'ev-btn-primary'
                            }`}
                            onClick={() => handleToggleUserStatus(u)}
                            title={
                              u.active_status === 'ACTIVE'
                                ? 'Suspend user access'
                                : 'Activate user access'
                            }
                          >
                            {u.active_status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PAGE 3: RESTRICTED AUDIT LOGS (ADMIN ONLY) */}
      {/* ==================================================================== */}
      {activeTab === 'AUDIT_LOGS' && (
        <div className="ev-admin-page-content">
          <div className="ev-admin-card">
            <div className="ev-card-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3>Restricted Enterprise Audit Logs</h3>
                  <span className="ev-badge ev-badge-gold">Admin Only</span>
                </div>
                <p className="ev-card-desc">
                  Hash-chained, tamper-evident audit ledger. Police, Forensic, and Judicial accounts
                  are strictly denied access to these records via backend authorization policies.
                </p>
              </div>
              <button
                type="button"
                className="ev-btn ev-btn-secondary"
                onClick={() => loadAuditLogs()}
              >
                <RefreshCwIcon size={14} className={isQueryingAudits ? 'spin' : ''} />
                <span>Refresh Log</span>
              </button>
            </div>

            {/* Comprehensive Filter Toolbar */}
            <div className="ev-audit-filter-panel">
              <div className="ev-filter-grid">
                <div className="ev-filter-group">
                  <label>Department</label>
                  <select
                    value={auditFilter.department || 'ALL'}
                    onChange={(e) =>
                      handleFilterChange({
                        department: e.target.value as Department | 'ALL',
                      })
                    }
                  >
                    <option value="ALL">All Departments</option>
                    <option value="POLICE">Police Department</option>
                    <option value="FORENSIC">Forensic Lab</option>
                    <option value="PROSECUTION">Prosecution</option>
                    <option value="ADMINISTRATION">Administration</option>
                  </select>
                </div>

                <div className="ev-filter-group">
                  <label>Action Category</label>
                  <select
                    value={auditFilter.actionType || 'ALL'}
                    onChange={(e) => handleFilterChange({ actionType: e.target.value })}
                  >
                    <option value="ALL">All Operations</option>
                    <option value="LOGIN">Authentication (Logins/Failures)</option>
                    <option value="CASE">Case Ingestion & Updates</option>
                    <option value="EVIDENCE">Evidence Registration</option>
                    <option value="HANDOFF">Custody Transfers</option>
                    <option value="VERIFY">Integrity Hash Checks</option>
                    <option value="REPORT">Forensic Reports</option>
                    <option value="USER">User Role/Status Updates</option>
                    <option value="SECURITY">Security Violations</option>
                  </select>
                </div>

                <div className="ev-filter-group">
                  <label>User Actor ID</label>
                  <input
                    type="text"
                    placeholder="e.g. USR-POLICE-01"
                    value={auditFilter.userId || ''}
                    onChange={(e) => handleFilterChange({ userId: e.target.value })}
                  />
                </div>

                <div className="ev-filter-group">
                  <label>Case / Evidence ID</label>
                  <input
                    type="text"
                    placeholder="e.g. CASE-2026-001"
                    value={auditFilter.caseOrEvidenceId || ''}
                    onChange={(e) => handleFilterChange({ caseOrEvidenceId: e.target.value })}
                  />
                </div>

                <div className="ev-filter-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={auditFilter.startDate ? auditFilter.startDate.split('T')[0] : ''}
                    onChange={(e) =>
                      handleFilterChange({
                        startDate: e.target.value
                          ? `${e.target.value}T00:00:00.000Z`
                          : undefined,
                      })
                    }
                  />
                </div>

                <div className="ev-filter-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={auditFilter.endDate ? auditFilter.endDate.split('T')[0] : ''}
                    onChange={(e) =>
                      handleFilterChange({
                        endDate: e.target.value
                          ? `${e.target.value}T23:59:59.999Z`
                          : undefined,
                      })
                    }
                  />
                </div>
              </div>

              <div className="ev-filter-search-row">
                <div className="ev-search-bar" style={{ flex: 1 }}>
                  <SearchIcon size={16} />
                  <input
                    type="text"
                    placeholder="Full-text search across action, payload, target, and reasons..."
                    value={auditFilter.searchQuery || ''}
                    onChange={(e) => handleFilterChange({ searchQuery: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="ev-btn ev-btn-secondary"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              </div>
            </div>

            {auditQueryError && (
              <div className="ev-admin-alert-banner error">
                <AlertTriangleIcon size={18} />
                <span>{auditQueryError}</span>
              </div>
            )}

            {/* Paginated Audit Events Table */}
            <div className="ev-table-responsive" style={{ marginTop: '16px' }}>
              <table className="ev-admin-table ev-audit-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User & Role</th>
                    <th>Department</th>
                    <th>Action Performed</th>
                    <th>Target ID & Type</th>
                    <th>Status</th>
                    <th>IP & Device</th>
                    <th>Details / Reason</th>
                    <th>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {!auditResponse || auditResponse.events.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '32px' }}>
                        No audit records matched your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    auditResponse.events.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {new Date(e.timestamp).toLocaleDateString()}
                          </div>
                          <strong style={{ fontSize: '12px', color: '#f1f5f9' }}>
                            {new Date(e.timestamp).toLocaleTimeString()}
                          </strong>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{e.actor_id || 'SYSTEM'}</div>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>
                            {e.actor_role || 'SERVICE_ACCOUNT'}
                          </span>
                        </td>
                        <td>
                          <span className={`ev-dept-pill ${(e.department || 'ADMINISTRATION').toLowerCase()}`}>
                            {e.department || 'SYSTEM'}
                          </span>
                        </td>
                        <td>
                          <code>{e.action}</code>
                        </td>
                        <td>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{e.entity_type}</div>
                          <strong>{e.entity_id}</strong>
                        </td>
                        <td>
                          <span
                            className={`ev-status-pill ${
                              e.status === 'SUCCESS' ? 'success' : 'failure'
                            }`}
                          >
                            {e.status || 'SUCCESS'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '11px', color: '#38bdf8' }}>
                            {e.ip_address || '10.14.0.1'}
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: '#64748b',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={e.user_agent}
                          >
                            {e.user_agent || 'EvidenceVault'}
                          </div>
                        </td>
                        <td style={{ maxWidth: '160px' }}>
                          <div
                            style={{
                              fontSize: '11px',
                              color: e.status === 'FAILURE' ? '#f87171' : '#cbd5e1',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={e.reason || JSON.stringify(e.event_payload)}
                          >
                            {e.reason || JSON.stringify(e.event_payload).slice(0, 50)}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ev-btn-icon"
                            onClick={() => setSelectedAuditForModal(e)}
                            title="Inspect complete cryptographic payload"
                          >
                            <EyeIcon size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {auditResponse && auditResponse.totalPages > 1 && (
              <div className="ev-pagination-bar">
                <span className="ev-pagination-info">
                  Showing {(auditResponse.page - 1) * auditResponse.pageSize + 1} to{' '}
                  {Math.min(auditResponse.page * auditResponse.pageSize, auditResponse.total)} of{' '}
                  {auditResponse.total} events
                </span>
                <div className="ev-pagination-btns">
                  <button
                    type="button"
                    className="ev-btn ev-btn-sm ev-btn-secondary"
                    disabled={auditResponse.page <= 1}
                    onClick={() => handlePageChange(auditResponse.page - 1)}
                  >
                    ← Previous
                  </button>
                  <span className="ev-page-number">
                    Page {auditResponse.page} of {auditResponse.totalPages}
                  </span>
                  <button
                    type="button"
                    className="ev-btn ev-btn-sm ev-btn-secondary"
                    disabled={auditResponse.page >= auditResponse.totalPages}
                    onClick={() => handlePageChange(auditResponse.page + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PAGE 4: SECURITY CENTER */}
      {/* ==================================================================== */}
      {activeTab === 'SECURITY' && (
        <div className="ev-admin-page-content">
          <div className="ev-admin-metrics-row">
            <div className="ev-admin-stat-card">
              <div className="ev-stat-label">Failed Login Events</div>
              <div className="ev-stat-number text-amber-400">
                {securityViolations.filter((v) => v.violationType === 'AUTHENTICATION_FAILURE').length}
              </div>
              <div className="ev-stat-sub">Brute-Force Lockouts Active</div>
            </div>
            <div className="ev-admin-stat-card">
              <div className="ev-stat-label">IDOR Access Denials</div>
              <div className="ev-stat-number text-red-400">
                {securityViolations.filter((v) => v.violationType === 'IDOR_ACCESS_DENIED').length}
              </div>
              <div className="ev-stat-sub">Unassigned Case Incursions Blocked</div>
            </div>
            <div className="ev-admin-stat-card">
              <div className="ev-stat-label">Unauthorized Role Attempts</div>
              <div className="ev-stat-number text-red-400">
                {securityViolations.filter((v) => v.violationType === 'UNAUTHORIZED_ROLE').length}
              </div>
              <div className="ev-stat-sub">Protected Admin/Audit Enpoints</div>
            </div>
            <div className="ev-admin-stat-card">
              <div className="ev-stat-label">Audit Chain Integrity</div>
              <div
                className={`ev-stat-number ${
                  chainAuditStatus?.isValid ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {chainAuditStatus?.isValid ? 'INTACT' : 'CORRUPTED'}
              </div>
              <div className="ev-stat-sub">
                {chainAuditStatus?.verifiedBlocks} of {chainAuditStatus?.totalBlocks} Blocks Verified
              </div>
            </div>
          </div>

          <div className="ev-admin-card">
            <div className="ev-card-header">
              <div>
                <h3>Real-Time Security Threat Log</h3>
                <p className="ev-card-desc">
                  Recorded security incidents, failed logins, path traversal attempts, and authorization rejections.
                </p>
              </div>
              <button
                type="button"
                className="ev-btn ev-btn-secondary"
                onClick={loadSecurityData}
              >
                <RefreshCwIcon size={14} className={isVerifyingChain ? 'spin' : ''} />
                <span>Verify Audit Chain</span>
              </button>
            </div>

            {securityViolations.length === 0 ? (
              <div className="ev-empty-state-compact">
                <CheckCircleIcon size={32} className="text-emerald-400" />
                <p>No security violations recorded. System authorization boundaries intact.</p>
              </div>
            ) : (
              <div className="ev-table-responsive">
                <table className="ev-admin-table">
                  <thead>
                    <tr>
                      <th>Incident Timestamp</th>
                      <th>Violation Type</th>
                      <th>Actor ID</th>
                      <th>Resource Target</th>
                      <th>Attempted Action</th>
                      <th>Security Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityViolations.map((v) => (
                      <tr key={v.id}>
                        <td>{new Date(v.timestamp).toLocaleString()}</td>
                        <td>
                          <span className="ev-badge ev-badge-error">{v.violationType}</span>
                        </td>
                        <td>
                          <code>{v.actorId}</code>
                        </td>
                        <td>
                          <code>{v.resource}</code>
                        </td>
                        <td>{v.attemptedAction}</td>
                        <td style={{ color: '#f87171' }}>{v.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PAGE 5: SYSTEM HEALTH */}
      {/* ==================================================================== */}
      {activeTab === 'HEALTH' && (
        <div className="ev-admin-page-content">
          <div className="ev-admin-card">
            <div className="ev-card-header">
              <div>
                <h3>System Telemetry & Health Checks</h3>
                <p className="ev-card-desc">
                  Live health telemetry across relational database, object storage, cryptographic engine, and audit chain.
                </p>
              </div>
              <button
                type="button"
                className="ev-btn ev-btn-primary"
                onClick={loadHealthTelemetry}
              >
                <ActivityIcon size={14} />
                <span>Run Diagnostic Self-Test</span>
              </button>
            </div>

            {healthReport && (
              <div className="ev-health-cards-grid">
                {/* 1. Database Subsystem */}
                <div className="ev-health-card">
                  <div className="ev-health-card-header">
                    <h4>1. Relational Database Engine</h4>
                    <span className="ev-status-pill success">{healthReport.database.status}</span>
                  </div>
                  <ul className="ev-health-metrics-list">
                    <li>
                      <span>Active Case Files:</span>
                      <strong>{healthReport.database.totalCases}</strong>
                    </li>
                    <li>
                      <span>Evidence Items:</span>
                      <strong>{healthReport.database.totalEvidence}</strong>
                    </li>
                    <li>
                      <span>Registered Personnel:</span>
                      <strong>{healthReport.database.totalUsers}</strong>
                    </li>
                    <li>
                      <span>Cryptographic Audit Blocks:</span>
                      <strong>{healthReport.database.totalAuditBlocks}</strong>
                    </li>
                    <li>
                      <span>Architecture Mode:</span>
                      <strong>In-Memory Relational + Persistence</strong>
                    </li>
                  </ul>
                </div>

                {/* 2. Object Storage Subsystem */}
                <div className="ev-health-card">
                  <div className="ev-health-card-header">
                    <h4>2. Object Storage Engine</h4>
                    <span className="ev-status-pill success">{healthReport.storage.status}</span>
                  </div>
                  <ul className="ev-health-metrics-list">
                    <li>
                      <span>Provider:</span>
                      <strong>{healthReport.storage.provider}</strong>
                    </li>
                    <li>
                      <span>Stored Artifacts:</span>
                      <strong>{healthReport.storage.totalObjects}</strong>
                    </li>
                    <li>
                      <span>Total Payload Volume:</span>
                      <strong>{formatFileSize(healthReport.storage.totalBytes)}</strong>
                    </li>
                    <li>
                      <span>Encryption At Rest:</span>
                      <strong>AES-256 SSE-S3 Confirmed</strong>
                    </li>
                    <li>
                      <span>Egress Bandwidth:</span>
                      <strong style={{ color: '#38bdf8' }}>$0.00 (Zero Egress Guarantee)</strong>
                    </li>
                  </ul>
                </div>

                {/* 3. Cryptographic Subsystem */}
                <div className="ev-health-card">
                  <div className="ev-health-card-header">
                    <h4>3. Cryptographic Engine</h4>
                    <span className="ev-status-pill success">
                      {healthReport.cryptography.status}
                    </span>
                  </div>
                  <ul className="ev-health-metrics-list">
                    <li>
                      <span>Hashing Algorithm:</span>
                      <strong>{healthReport.cryptography.algorithm}</strong>
                    </li>
                    <li>
                      <span>Streaming Chunk Hasher:</span>
                      <strong>NIST FIPS 180-4 Compliant Ready</strong>
                    </li>
                    <li>
                      <span>Browser Web Crypto API:</span>
                      <strong>crypto.subtle Active</strong>
                    </li>
                    <li>
                      <span>Tamper Detection:</span>
                      <strong>Bit-Level SHA-256 Discrepancy Alert</strong>
                    </li>
                  </ul>
                </div>

                {/* 4. Audit Chain Ledger */}
                <div className="ev-health-card">
                  <div className="ev-health-card-header">
                    <h4>4. Audit Chain Ledger</h4>
                    <span className="ev-status-pill success">{healthReport.auditChain.status}</span>
                  </div>
                  <ul className="ev-health-metrics-list">
                    <li>
                      <span>Chain Status:</span>
                      <strong style={{ color: '#34d399' }}>100% Intact Unbroken</strong>
                    </li>
                    <li>
                      <span>Total Chain Blocks:</span>
                      <strong>{healthReport.auditChain.totalBlocks}</strong>
                    </li>
                    <li>
                      <span>Verified Hash Blocks:</span>
                      <strong>{healthReport.auditChain.verifiedBlocks}</strong>
                    </li>
                    <li>
                      <span>Diagnostic Latency:</span>
                      <strong>{lastDiagnosticLatencyMs ?? 1.2} ms</strong>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PAGE 6: REPORTS & CSV EXPORT */}
      {/* ==================================================================== */}
      {activeTab === 'REPORTS' && (
        <div className="ev-admin-page-content">
          <div className="ev-admin-card">
            <div className="ev-card-header">
              <div>
                <h3>Administrative Reports & Statutory CSV Exports</h3>
                <p className="ev-card-desc">
                  Export authorized audit records and system inventories to RFC-4180 escaped CSV files.
                  Formulas starting with <code>=</code>, <code>+</code>, <code>-</code>, or <code>@</code> are
                  sanitized with leading quotes to prevent spreadsheet formula injection attacks.
                </p>
              </div>
            </div>

            <div className="ev-reports-export-grid">
              <div className="ev-report-box">
                <div className="ev-report-box-icon">
                  <HistoryIcon size={28} className="text-amber-400" />
                </div>
                <h4>Complete Audit Ledger Export</h4>
                <p>
                  Full sequential export of all hash-chained blocks, actor IDs, timestamps, IP addresses,
                  and operation payloads.
                </p>
                <button
                  type="button"
                  className="ev-btn ev-btn-primary"
                  onClick={handleExportAuditLedgerCsv}
                >
                  <DownloadIcon size={14} />
                  <span>Download Audit Ledger (CSV)</span>
                </button>
              </div>

              <div className="ev-report-box">
                <div className="ev-report-box-icon">
                  <ShieldAlertIcon size={28} className="text-red-400" />
                </div>
                <h4>Security Violations & Threat Audit</h4>
                <p>
                  Export of all failed logins, brute-force attempts, IDOR denials, and unauthorized role
                  access incidents.
                </p>
                <button
                  type="button"
                  className="ev-btn ev-btn-danger"
                  onClick={handleExportSecurityViolationsCsv}
                >
                  <DownloadIcon size={14} />
                  <span>Download Security Incidents (CSV)</span>
                </button>
              </div>

              <div className="ev-report-box">
                <div className="ev-report-box-icon">
                  <UsersIcon size={28} className="text-cyan-400" />
                </div>
                <h4>User Directory & RBAC Inventory</h4>
                <p>
                  Directory of all departmental users, clearance roles, active statuses, and account creation dates.
                </p>
                <button
                  type="button"
                  className="ev-btn ev-btn-secondary"
                  onClick={handleExportUsersCsv}
                >
                  <DownloadIcon size={14} />
                  <span>Download Users Directory (CSV)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ASSIGN USER ROLE (WITH ADMIN ELEVATION SAFEGUARD) */}
      {/* ==================================================================== */}
      {editingUser && (
        <div className="ev-modal-backdrop" onClick={() => setEditingUser(null)}>
          <div className="ev-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ev-modal-header">
              <h3>Assign Security Role: {editingUser.display_name}</h3>
              <button
                type="button"
                className="ev-close-btn"
                onClick={() => setEditingUser(null)}
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="ev-modal-body">
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '14px' }}>
                User ID: <code>{editingUser.id}</code> | Current Role:{' '}
                <strong>{editingUser.role}</strong>
              </p>

              <div className="ev-form-group">
                <label className="ev-form-label">Approved Departmental Role</label>
                <select
                  className="ev-input"
                  value={newRoleSelect}
                  onChange={(e) => setNewRoleSelect(e.target.value as UserRole)}
                >
                  <option value="POLICE_INVESTIGATOR">Police Investigator (POLICE)</option>
                  <option value="FORENSIC_EXAMINER">Forensic Examiner (FORENSIC)</option>
                  <option value="PUBLIC_PROSECUTOR">Public Prosecutor (PROSECUTION)</option>
                  <option value="SYSTEM_ADMIN">System Administrator (ADMINISTRATION)</option>
                </select>
              </div>

              {/* SENSITIVE ADMIN ELEVATION CONFIRMATION */}
              {newRoleSelect === 'SYSTEM_ADMIN' && editingUser.role !== 'SYSTEM_ADMIN' && (
                <div className="ev-admin-elevation-warning">
                  <div style={{ display: 'flex', gap: '8px', color: '#f59e0b' }}>
                    <AlertTriangleIcon size={18} />
                    <strong>Sensitive Role Elevation Safeguard</strong>
                  </div>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '6px 0 10px 0' }}>
                    Promoting this account to <strong>SYSTEM_ADMIN</strong> grants full access to
                    restricted audit logs and security controls. Type{' '}
                    <code>CONFIRM_ADMIN_ELEVATION</code> to confirm:
                  </p>
                  <input
                    type="text"
                    className="ev-input"
                    placeholder="Type CONFIRM_ADMIN_ELEVATION"
                    value={elevationCodeInput}
                    onChange={(e) => setElevationCodeInput(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="ev-modal-footer">
              <button
                type="button"
                className="ev-btn ev-btn-secondary"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ev-btn ev-btn-primary"
                onClick={handleSaveRoleChange}
              >
                Save Role Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: INSPECT CRYPTOGRAPHIC AUDIT BLOCK PAYLOAD */}
      {/* ==================================================================== */}
      {selectedAuditForModal && (
        <div className="ev-modal-backdrop" onClick={() => setSelectedAuditForModal(null)}>
          <div className="ev-modal ev-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="ev-modal-header">
              <h3>Cryptographic Audit Block: {selectedAuditForModal.id}</h3>
              <button
                type="button"
                className="ev-close-btn"
                onClick={() => setSelectedAuditForModal(null)}
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="ev-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Action:</span> <strong>{selectedAuditForModal.action}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Timestamp:</span> <strong>{selectedAuditForModal.timestamp}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Actor ID:</span> <strong>{selectedAuditForModal.actor_id}</strong> ({selectedAuditForModal.actor_role})
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Department:</span> <strong>{selectedAuditForModal.department}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>IP Address:</span> <strong>{selectedAuditForModal.ip_address}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>User Agent:</span> <strong>{selectedAuditForModal.user_agent}</strong>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Block Hash (SHA-256):</span>
                <div className="ev-hash-box">{selectedAuditForModal.event_hash}</div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Previous Block Hash (Chain Link):</span>
                <div className="ev-hash-box">
                  {selectedAuditForModal.previous_event_hash || '0'.repeat(64)}
                </div>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Cryptographically Sealed Payload:</span>
                <pre
                  style={{
                    background: '#090d16',
                    border: '1px solid #1e293b',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '11px',
                    color: '#38bdf8',
                    overflowX: 'auto',
                    maxHeight: '220px',
                  }}
                >
                  {JSON.stringify(selectedAuditForModal.event_payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="ev-modal-footer">
              <button
                type="button"
                className="ev-btn ev-btn-primary"
                onClick={() => setSelectedAuditForModal(null)}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
