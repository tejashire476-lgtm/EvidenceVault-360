import React from 'react';
import { XIcon } from '../icons.tsx';

export interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  title: string;
  setTitle: (v: string) => void;
  caseRef: string;
  setCaseRef: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  error: string | null;
}

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  setTitle,
  caseRef,
  setCaseRef,
  category,
  setCategory,
  error,
}) => {
  if (!isOpen) return null;

  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ev-modal-header">
          <h3 className="ev-modal-title">Police Department: Register New Case</h3>
          <button type="button" className="ev-close-btn" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        {error && (
          <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '10px' }}>
            {error}
          </div>
        )}
        <form onSubmit={onSubmit}>
          <div className="ev-form-group">
            <label className="ev-form-label">Case Title</label>
            <input
              type="text"
              className="ev-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Credential Stuffing Incident"
              required
            />
          </div>
          <div className="ev-form-group">
            <label className="ev-form-label">Unique Case Reference Code</label>
            <input
              type="text"
              className="ev-input"
              value={caseRef}
              onChange={(e) => setCaseRef(e.target.value)}
              placeholder="e.g. EV-CASE-2026-088"
              required
            />
          </div>
          <div className="ev-form-group">
            <label className="ev-form-label">Category</label>
            <select
              className="ev-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Cyber Financial Crime">Cyber Financial Crime</option>
              <option value="Malware & Ransomware">Malware & Ransomware</option>
              <option value="Infrastructure Intrusion">Infrastructure Intrusion</option>
              <option value="Data Exfiltration">Data Exfiltration</option>
              <option value="Hardware Seizure">Hardware Seizure</option>
            </select>
          </div>
          <div className="ev-form-actions">
            <button
              type="button"
              className="ev-btn ev-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="ev-btn ev-btn-primary">
              Create Case Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
