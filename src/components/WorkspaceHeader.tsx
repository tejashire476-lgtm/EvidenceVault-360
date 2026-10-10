import React from 'react';
import type {
  AuthenticatedSession,
  Department,
  NetworkSyncStatus,
  OfflineQueueItem,
} from '../types.ts';
import {
  ShieldCheckIcon,
  ShieldAlertIcon,
  DatabaseIcon,
  FolderLockIcon,
  FileCodeIcon,
  AlertTriangleIcon,
  ClockIcon,
} from './icons.tsx';

export interface WorkspaceHeaderProps {
  currentUser: AuthenticatedSession;
  networkStatus: NetworkSyncStatus;
  offlineQueue: OfflineQueueItem[];
  onOpenOfflineCenter: () => void;
  onToggleNetwork: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
  caseCount: number;
  evidenceCount: number;
  offlineNotice: string | null;
  seedNotice: string | null;
  verificationFeedback: {
    text: string;
    result: 'MATCH' | 'MISMATCH' | 'ERROR';
  } | null;
  activeDept: Department | 'AUDIT' | 'STORAGE';
  setActiveDept: (dept: Department | 'AUDIT' | 'STORAGE') => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  currentUser,
  networkStatus,
  offlineQueue,
  onOpenOfflineCenter,
  onToggleNetwork,
  onOpenAdmin,
  onLogout,
  caseCount,
  evidenceCount,
  offlineNotice,
  seedNotice,
  verificationFeedback,
  activeDept,
  setActiveDept,
}) => {
  const pendingCount = offlineQueue.filter(
    (q) => q.status === 'PENDING' || q.status === 'CONFLICT'
  ).length;

  return (
    <>
      {/* Logged-In Department Ingress Bar */}
      <div className="ev-auth-ingress-bar">
        <div className="ev-auth-user-pill">
          <span className={`ev-auth-role-tag ${currentUser.department.toLowerCase()}`}>
            {currentUser.department} WORKSPACE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Network Status Badge */}
          <div
            className={`ev-network-badge ${networkStatus.toLowerCase()}`}
            onClick={onOpenOfflineCenter}
            style={{ cursor: 'pointer' }}
            title="Click to open Offline & Safe Synchronization Center"
          >
            <span>
              {networkStatus === 'ONLINE'
                ? '🟢'
                : networkStatus === 'OFFLINE'
                  ? '🟠'
                  : networkStatus === 'SYNCING'
                    ? '🔄'
                    : '⚠️'}
            </span>
            <span>{networkStatus}</span>
          </div>

          {/* Pending Offline Items Pill */}
          {pendingCount > 0 && (
            <span
              className="ev-offline-pill pending"
              onClick={onOpenOfflineCenter}
              style={{ cursor: 'pointer' }}
              title="Click to view unsynced offline operations"
            >
              📥 {pendingCount} Pending Sync
            </span>
          )}

          {/* Quick Offline Simulation Toggle */}
          <button
            type="button"
            className="ev-switch-portal-btn"
            style={{
              borderColor: networkStatus === 'OFFLINE' ? '#34d399' : '#f59e0b',
              color: networkStatus === 'OFFLINE' ? '#34d399' : '#fbbf24',
            }}
            onClick={onToggleNetwork}
            title="Toggle between Online server connected and Offline disconnected field mode"
          >
            {networkStatus === 'OFFLINE' ? '⚡ Restore Connection' : '📡 Go Offline (Field Sim)'}
          </button>

          {/* Open Offline Center Modal */}
          <button
            type="button"
            className="ev-switch-portal-btn"
            style={{ borderColor: '#38bdf8', color: '#38bdf8' }}
            onClick={onOpenOfflineCenter}
            title="Open Offline Queue, Concurrency Conflict Resolution & Cache Manager"
          >
            ⚙ Offline & Sync Center
          </button>

          {/* Admin Portal Switcher */}
          <button
            type="button"
            className="ev-switch-portal-btn"
            style={{
              borderColor: '#f59e0b',
              color: '#fbbf24',
              background: 'rgba(245, 158, 11, 0.08)',
              fontWeight: 600,
            }}
            onClick={onOpenAdmin}
            title="Open Administration Console & Cryptographic Audit Ledger"
          >
            🛡️ Admin Portal
          </button>

          <button
            type="button"
            className="ev-switch-portal-btn"
            onClick={onLogout}
            title="Return to the 4-Portal Login page"
          >
            ← Switch Department / Back to Portal Home
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="ev-header">
        <div className="ev-header-top">
          <div className="ev-brand">
            <div className="ev-logo-icon">
              <ShieldCheckIcon size={24} />
            </div>
            <div className="ev-title-group">
              <h1>EvidenceVault 360</h1>
              <div className="ev-tagline">
                One Case. Three Departments. Traceable Evidence. Cryptographically Verified.
              </div>
            </div>
          </div>

          <div className="ev-header-stats">
            <div className="ev-stat-pill">
              <DatabaseIcon size={14} />
              <span>Cases:</span>
              <span className="ev-stat-value">{caseCount}</span>
            </div>
            <div className="ev-stat-pill">
              <FolderLockIcon size={14} />
              <span>Evidence:</span>
              <span className="ev-stat-value">{evidenceCount}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Offline Air-Gapped Banner */}
      {networkStatus === 'OFFLINE' && (
        <div className="ev-offline-banner">
          <div className="ev-offline-banner-content">
            <AlertTriangleIcon size={18} />
            <span>
              <strong>OFFLINE AIR-GAPPED FIELD MODE ACTIVE:</strong> Disconnected from authoritative server.
              Operating strictly on minimally cached non-sensitive metadata (ISO 27037). Original evidence binary files
              and finalized forensic reports are protected and never cached locally. Field actions are stored locally with{' '}
              <em>[Locally Queued (Unsynced)]</em> status until verified reconciliation.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="ev-btn ev-btn-primary"
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={onOpenOfflineCenter}
            >
              Inspect Queue ({offlineQueue.filter((q) => q.status === 'PENDING').length} Pending)
            </button>
            <button
              type="button"
              className="ev-btn ev-btn-secondary"
              style={{ fontSize: '11px', padding: '4px 10px', borderColor: '#34d399', color: '#34d399' }}
              onClick={onToggleNetwork}
            >
              ⚡ Reconnect Online
            </button>
          </div>
        </div>
      )}

      {/* Offline Action Notifications */}
      {offlineNotice && (
        <div
          style={{
            background: '#1e1b4b',
            border: '1px solid #6366f1',
            color: '#e0e7ff',
            padding: '10px 24px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ClockIcon size={16} />
          <span>{offlineNotice}</span>
        </div>
      )}

      {/* Synthetic Demo Notice */}
      <div className="ev-notice-bar">
        <AlertTriangleIcon size={16} />
        <span>
          DEMONSTRATION PROTOTYPE: All data shown is synthetic mock forensic data for hackathon evaluation.
          {seedNotice && ` — [${seedNotice}]`}
        </span>
      </div>

      {/* Verification Live Feedback Banner */}
      {verificationFeedback && (
        <div
          style={{
            background:
              verificationFeedback.result === 'MATCH'
                ? 'rgba(16, 185, 129, 0.18)'
                : verificationFeedback.result === 'MISMATCH'
                  ? 'rgba(239, 68, 68, 0.22)'
                  : 'rgba(245, 158, 11, 0.22)',
            border: `1px solid ${
              verificationFeedback.result === 'MATCH'
                ? '#10b981'
                : verificationFeedback.result === 'MISMATCH'
                  ? '#ef4444'
                  : '#f59e0b'
            }`,
            color:
              verificationFeedback.result === 'MATCH'
                ? '#34d399'
                : verificationFeedback.result === 'MISMATCH'
                  ? '#f87171'
                  : '#fbbf24',
            padding: '12px 18px',
            margin: '0 24px 14px 24px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {verificationFeedback.result === 'MATCH' ? (
            <ShieldCheckIcon size={20} />
          ) : (
            <ShieldAlertIcon size={20} />
          )}
          <span>{verificationFeedback.text}</span>
        </div>
      )}

      {/* Department Tabs */}
      <nav className="ev-department-nav" aria-label="Department Workspaces">
        <button
          type="button"
          className={`ev-dept-tab ${activeDept === 'POLICE' ? 'active-police' : ''}`}
          onClick={() => setActiveDept('POLICE')}
        >
          <FolderLockIcon size={18} />
          1. Police Department (Case &amp; Evidence Ingestion)
        </button>
        <button
          type="button"
          className={`ev-dept-tab ${activeDept === 'FORENSIC' ? 'active-forensic' : ''}`}
          onClick={() => setActiveDept('FORENSIC')}
        >
          <FileCodeIcon size={18} />
          2. Forensic Department (Handoffs &amp; Examination)
        </button>
        <button
          type="button"
          className={`ev-dept-tab ${activeDept === 'PROSECUTION' ? 'active-prosecution' : ''}`}
          onClick={() => setActiveDept('PROSECUTION')}
        >
          <ShieldCheckIcon size={18} />
          3. Prosecution Department (Judicial Review &amp; Index)
        </button>
      </nav>
    </>
  );
};
