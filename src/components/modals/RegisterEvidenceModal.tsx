import React from 'react';
import type { EvidenceType, UploadProgressEvent } from '../../types.ts';
import { VALID_EVIDENCE_TYPES } from '../../data/db.ts';
import { formatFileSize } from '../../utils/crypto.ts';
import { XIcon, CloudUploadIcon } from '../icons.tsx';

export interface RegisterEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isUploading: boolean;
  uploadProgress: UploadProgressEvent | null;
  onCancelUpload: () => void;
  newEvDescription: string;
  setNewEvDescription: (v: string) => void;
  newEvType: EvidenceType;
  setNewEvType: (v: EvidenceType) => void;
  newEvSource: string;
  setNewEvSource: (v: string) => void;
  selectedLocalFile: File | null;
  setSelectedLocalFile: (f: File | null) => void;
  newEvFilename: string;
  setNewEvFilename: (v: string) => void;
  newEvFileSize: string;
  setNewEvFileSize: (v: string) => void;
  error: string | null;
}

export const RegisterEvidenceModal: React.FC<RegisterEvidenceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isUploading,
  uploadProgress,
  onCancelUpload,
  newEvDescription,
  setNewEvDescription,
  newEvType,
  setNewEvType,
  newEvSource,
  setNewEvSource,
  selectedLocalFile,
  setSelectedLocalFile,
  newEvFilename,
  setNewEvFilename,
  newEvFileSize,
  setNewEvFileSize,
  error,
}) => {
  if (!isOpen) return null;

  return (
    <div className="ev-modal-backdrop" onClick={() => !isUploading && onClose()}>
      <div className="ev-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ev-modal-header">
          <h3 className="ev-modal-title">Secure Object Ingestion (Cloudflare R2 Compatible)</h3>
          {!isUploading && (
            <button type="button" className="ev-close-btn" onClick={onClose}>
              <XIcon size={18} />
            </button>
          )}
        </div>
        {error && (
          <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '10px' }}>
            {error}
          </div>
        )}
        <form onSubmit={onSubmit}>
          <div className="ev-form-group">
            <label className="ev-form-label">Evidence Description</label>
            <input
              type="text"
              className="ev-input"
              value={newEvDescription}
              onChange={(e) => setNewEvDescription(e.target.value)}
              placeholder="e.g. Bit-stream physical forensic image of secondary NVMe drive"
              required
              disabled={isUploading}
            />
          </div>

          <div className="ev-form-group">
            <label className="ev-form-label">Evidence Category</label>
            <select
              className="ev-select"
              value={newEvType}
              onChange={(e) => setNewEvType(e.target.value as EvidenceType)}
              disabled={isUploading}
            >
              {VALID_EVIDENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="ev-form-group">
            <label className="ev-form-label">Seizure / Acquisition Location Source</label>
            <input
              type="text"
              className="ev-input"
              value={newEvSource}
              onChange={(e) => setNewEvSource(e.target.value)}
              placeholder="e.g. Server Room B, Rack 12, Main Office"
              disabled={isUploading}
            />
          </div>

          {/* Local File Selection / Drag-Drop */}
          <div className="ev-form-group">
            <label className="ev-form-label">Select Binary Artifact (Real File Reading)</label>
            <div className="ev-dropzone" onClick={() => document.getElementById('ev-file-input')?.click()}>
              <input
                id="ev-file-input"
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    setSelectedLocalFile(file);
                    setNewEvFilename(file.name);
                    setNewEvFileSize(String(file.size));
                  }
                }}
                disabled={isUploading}
              />
              <CloudUploadIcon size={32} style={{ color: '#06b6d4', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', color: '#f1f5f9' }}>
                {selectedLocalFile ? (
                  <strong>Selected: {selectedLocalFile.name} ({formatFileSize(selectedLocalFile.size)})</strong>
                ) : (
                  'Click to browse file or drop forensic image here'
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Whitelisted: .raw, .dd, .img, .e01, .pcap, .dmp, .log, .pdf, .zip, .tar, .bin
              </div>
            </div>
          </div>

          {!selectedLocalFile && (
            <>
              <div className="ev-form-group">
                <label className="ev-form-label">Or Specify Filename (Simulated Upload)</label>
                <input
                  type="text"
                  className="ev-input"
                  value={newEvFilename}
                  onChange={(e) => setNewEvFilename(e.target.value)}
                  placeholder="e.g. disk-image-nvme0.raw"
                  required
                  disabled={isUploading}
                />
              </div>
              <div className="ev-form-group">
                <label className="ev-form-label">File Size (Bytes)</label>
                <input
                  type="number"
                  className="ev-input"
                  value={newEvFileSize}
                  onChange={(e) => setNewEvFileSize(e.target.value)}
                  placeholder="10485760"
                  disabled={isUploading}
                />
              </div>
            </>
          )}

          {/* Live Upload Progress */}
          {isUploading && uploadProgress && (
            <div style={{ background: '#080a13', border: '1px solid #1f2742', padding: '12px', borderRadius: '6px', margin: '14px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#38bdf8' }}>
                  Streaming Part {uploadProgress.activeChunkIndex} of {uploadProgress.totalChunks} to Object Storage...
                </span>
                <strong style={{ color: '#f1f5f9' }}>{uploadProgress.percent}%</strong>
              </div>
              <div className="ev-progress-bar-container">
                <div className="ev-progress-bar-fill" style={{ width: `${uploadProgress.percent}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                <span>Uploaded: {formatFileSize(uploadProgress.loadedBytes)} / {formatFileSize(uploadProgress.totalBytes)}</span>
                <span>Rate: {(uploadProgress.speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s</span>
              </div>
            </div>
          )}

          <div className="ev-form-actions">
            {isUploading ? (
              <button type="button" className="ev-btn ev-btn-danger" onClick={onCancelUpload}>
                Abort Upload
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="ev-btn ev-btn-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button type="submit" className="ev-btn ev-btn-primary">
                  Ingest & Cryptographically Register
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
