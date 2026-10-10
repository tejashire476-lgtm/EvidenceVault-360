import React from 'react';
import type { ComplianceAuditReport } from '../../types.ts';
import { XIcon } from '../icons.tsx';

export interface ComplianceAuditReportModalProps {
  complianceReportData: ComplianceAuditReport | null;
  onClose: () => void;
}

export const ComplianceAuditReportModal: React.FC<ComplianceAuditReportModalProps> = ({
  complianceReportData,
  onClose,
}) => {
  if (!complianceReportData) return null;

  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ev-modal-header">
          <h3 className="ev-modal-title">Formal Compliance Audit Assessment</h3>
          <button type="button" className="ev-close-btn" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
          <div style={{ marginBottom: '12px' }}>
            Report ID: <strong>{complianceReportData.id}</strong> | Status:{' '}
            <strong style={{ color: '#34d399' }}>{complianceReportData.auditChainStatus}</strong>
          </div>
          <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
            {complianceReportData.findings.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
        <div className="ev-form-actions">
          <button
            type="button"
            className="ev-btn ev-btn-primary"
            onClick={onClose}
          >
            Acknowledge Compliance Findings
          </button>
        </div>
      </div>
    </div>
  );
};
