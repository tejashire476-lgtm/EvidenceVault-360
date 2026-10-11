import React from 'react';
import { getSecurityViolationLogs } from '../../utils/security.ts';
import { XIcon } from '../icons.tsx';

export interface SecurityViolationLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityViolationLogsModal: React.FC<SecurityViolationLogsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const secLogs = getSecurityViolationLogs();

  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal ev-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="ev-modal-header">
          <h3 className="ev-modal-title">Security & RBAC Incident Ledger</h3>
          <button type="button" className="ev-close-btn" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>

        <div>
          <div style={{ marginBottom: '12px', fontSize: '13px', color: '#cbd5e1' }}>
            Security Incidents Recorded: <strong>{secLogs.length}</strong> (Passwords and private keys permanently redacted)
          </div>
          {secLogs.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              No unauthorized access attempts or security violations detected in this session.
            </div>
          ) : (
            <table className="ev-history-table">
              <thead>
                <tr>
                  <th>Incident ID</th>
                  <th>Violation Type</th>
                  <th>Actor / Role</th>
                  <th>Action / Resource</th>
                  <th>Timestamp</th>
                  <th>Sanitized Reason</th>
                </tr>
              </thead>
              <tbody>
                {secLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace' }}>{log.id}</td>
                    <td>
                      <span className="ev-badge ev-badge-error">{log.violationType}</span>
                    </td>
                    <td>
                      {log.actorId || 'UNKNOWN'}
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{log.actorRole || 'N/A'}</div>
                    </td>
                    <td>
                      <strong>{log.attemptedAction}</strong>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{log.resource}</div>
                    </td>
                    <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td style={{ color: '#fca5a5', fontSize: '11px' }}>{log.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="ev-form-actions" style={{ marginTop: '16px' }}>
            <button
              type="button"
              className="ev-btn ev-btn-primary"
              onClick={onClose}
            >
              Close Security Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
