import React from 'react';
import type {
  AuthenticatedSession,
  Department,
  NetworkSyncStatus,
  OfflineQueueItem,
} from '../types.ts';
import { DEPARTMENT_PRESETS } from '../types.ts';
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
  onSwitchUser?: (session: AuthenticatedSession) => void;
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
  onSwitchUser,
}) => {
  const pendingCount = offlineQueue.filter(
    (q) => q.status === 'PENDING' || q.status === 'CONFLICT'
  ).length;

  return (
    <>
      {/* Logged-In Department Ingress Bar */}
      <div className="ev-auth-ingress-bar">
        <div className="ev-auth-user-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className={`ev-auth-role-tag ${currentUser.department.toLowerCase()}`}>
            {currentUser.department} PORTAL
          </span>
          <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
            {currentUser.name} (<strong>{currentUser.role}</strong>)
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1>EvidenceVault 360</h1>
                <span className="ev-version-badge">ENTERPRISE v2.4</span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    textTransform: 'uppercase',
                  }}
                >
                  ISO 27037 / FIPS 180-4
                </span>
              </div>
              <div className="ev-tagline">
                One Case. Three Departments. Traceable Evidence. Cryptographically Verified.
              </div>
            </div>
          </div>

          <div className="ev-header-stats">
            <div className="ev-stat-pill">
              <DatabaseIcon size={14} />
              <span>Active Cases:</span>
              <span className="ev-stat-value">{caseCount}</span>
            </div>
            <div className="ev-stat-pill">
              <FolderLockIcon size={14} />
              <span>Evidence Items:</span>
              <span className="ev-stat-value">{evidenceCount}</span>
            </div>
            <div className="ev-stat-pill" style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: '#34d399' }}>
              <ShieldCheckIcon size={14} />
              <span>Audit Chain:</span>
              <span className="ev-stat-value" style={{ color: '#34d399' }}>VERIFIED</span>
            </div>
            <div className="ev-stat-pill" style={{ borderColor: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' }}>
              <span style={{ fontSize: '11px', fontWeight: 600 }}>☁️ R2 Zero-Egress</span>
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

      {/* Dedicated Isolated Department Portal Banner */}
      <div className={`ev-portal-banner portal-${activeDept.toLowerCase()}`}>
        <div className="ev-portal-info">
          <div className="ev-portal-icon-box">
            {activeDept === 'POLICE' && <FolderLockIcon size={22} />}
            {activeDept === 'FORENSIC' && <FileCodeIcon size={22} />}
            {activeDept === 'PROSECUTION' && <ShieldCheckIcon size={22} />}
            {activeDept === 'STORAGE' && <DatabaseIcon size={22} />}
          </div>
          <div className="ev-portal-text">
            <h2>
              {activeDept === 'POLICE' && 'Police Investigation Portal'}
              {activeDept === 'FORENSIC' && 'Forensic Laboratory & Verification System'}
              {activeDept === 'PROSECUTION' && 'Prosecution & Judicial Review Portal'}
              {activeDept === 'STORAGE' && 'Object Storage Telemetry & Cost Console'}
              <span className="ev-portal-badge-active">
                {activeDept === 'POLICE' && 'Police Custody Active'}
                {activeDept === 'FORENSIC' && 'Forensic Verification Active'}
                {activeDept === 'PROSECUTION' && 'Judicial Review Active'}
                {activeDept === 'STORAGE' && 'Storage Metrics Active'}
              </span>
            </h2>
            <p>
              {activeDept === 'POLICE' &&
                'First responder case intake, digital evidence ingestion and custodial transfer dispatch.'}
              {activeDept === 'FORENSIC' &&
                'Independent forensic custody, bit-stream SHA-256 verification, tamper detection and laboratory reports.'}
              {activeDept === 'PROSECUTION' &&
                'Court-admissible evidentiary audit, Section 65B electronic certificates and judicial trial sign-off.'}
              {activeDept === 'STORAGE' &&
                'Cloudflare R2 zero-egress object storage metrics, quota monitoring, and cost benchmarks.'}
            </p>
          </div>
        </div>

        <div className="ev-portal-switch-group">
          <span className="ev-portal-switch-label">Choose Portal:</span>
          <button
            type="button"
            className={`ev-portal-choice-btn ${activeDept === 'POLICE' ? 'active-choice-police' : ''}`}
            onClick={() => {
              if (onSwitchUser) {
                onSwitchUser(DEPARTMENT_PRESETS.POLICE);
              } else {
                setActiveDept('POLICE');
              }
            }}
            title="Switch to Police Department Portal"
          >
            <FolderLockIcon size={14} />
            Police Portal
          </button>
          <button
            type="button"
            className={`ev-portal-choice-btn ${activeDept === 'FORENSIC' ? 'active-choice-forensic' : ''}`}
            onClick={() => {
              if (onSwitchUser) {
                onSwitchUser(DEPARTMENT_PRESETS.FORENSIC);
              } else {
                setActiveDept('FORENSIC');
              }
            }}
            title="Switch to Forensic Laboratory & Verification System"
          >
            <FileCodeIcon size={14} />
            Forensic Portal
          </button>
          <button
            type="button"
            className={`ev-portal-choice-btn ${activeDept === 'PROSECUTION' ? 'active-choice-prosecution' : ''}`}
            onClick={() => {
              if (onSwitchUser) {
                onSwitchUser(DEPARTMENT_PRESETS.PROSECUTION);
              } else {
                setActiveDept('PROSECUTION');
              }
            }}
            title="Switch to Prosecution & Judicial Review Portal"
          >
            <ShieldCheckIcon size={14} />
            Prosecution Portal
          </button>
        </div>
      </div>
    </>
  );
};
