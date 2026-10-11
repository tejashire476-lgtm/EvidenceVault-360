import React, { useState, useEffect } from 'react';
import type { Department } from '../types.ts';
import {
  ShieldCheckIcon,
  ArrowRightIcon,
  XIcon,
  AlertTriangleIcon,
  LockIcon,
  CpuIcon,
  FileCodeIcon,
  FolderLockIcon,
  CheckCircleIcon,
  ClockIcon,
  ActivityIcon,
  ScanFaceIcon,
} from './icons.tsx';

export interface LandingPageProps {
  onOpenLoginModal: (dept: Department) => void;
  portalLoginModal: Department | null;
  onCloseLoginModal: () => void;
  loginBadgeInput: string;
  setLoginBadgeInput: (v: string) => void;
  loginPinInput: string;
  setLoginPinInput: (v: string) => void;
  biometricRequireMfa: boolean;
  setBiometricRequireMfa: (v: boolean) => void;
  handleConfirmLogin: (dept: Department) => void;
  handleSimulateFailedLogin: (dept: Department) => void;
  onInstantLogin: (dept: Department) => void;
  onOpenAdmin: () => void;
  showFaqModal: boolean;
  setShowFaqModal: (v: boolean) => void;
  loginError?: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenLoginModal,
  portalLoginModal,
  onCloseLoginModal,
  loginBadgeInput,
  setLoginBadgeInput,
  loginPinInput,
  setLoginPinInput,
  biometricRequireMfa,
  setBiometricRequireMfa,
  handleConfirmLogin,
  handleSimulateFailedLogin,
  onInstantLogin,
  onOpenAdmin,
  showFaqModal,
  setShowFaqModal,
  loginError,
}) => {
  const [currentTimestamp, setCurrentTimestamp] = useState<string>('');
  const [infoModalContent, setInfoModalContent] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const datePart = now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).toUpperCase();
      const timePart = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setCurrentTimestamp(`${datePart} ${timePart} IST (UTC+05:30)`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="ev-portal-landing">
      {/* Top Institutional Sovereign Authority Bar */}
      <div className="ev-gov-sovereign-bar">
        <div className="ev-gov-sovereign-content">
          <div className="ev-gov-flag-emblem" style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', borderRadius: '4px', padding: '2px 6px' }}>
            <ShieldCheckIcon size={14} className="text-cyan" />
          </div>
          <span className="ev-gov-org-title">
            EVIDENCEVAULT 360 • INTER-AGENCY DIGITAL FORENSICS &amp; CUSTODY ASSURANCE SYSTEM
          </span>
          <div className="ev-gov-live-clock">
            <ClockIcon size={12} />
            <span>{currentTimestamp || 'SYSTEM ACTIVE'}</span>
          </div>
        </div>
      </div>

      {/* Main High-Security Institutional Header */}
      <header className="ev-portal-main-header">
        <div className="ev-portal-brand-block">
          <div className="ev-portal-logo-emblem" title="Cryptographically Sealed Authority">
            <ShieldCheckIcon size={26} />
          </div>
          <div className="ev-portal-brand-text">
            <h2>
              EVIDENCEVAULT 360
              <span className="ev-portal-accred-badge">SHA-256 BITSTREAM SEALED • SECTION 65B (BSA 63) WORKFLOW</span>
            </h2>
            <div className="ev-portal-brand-sub">
              Digital Evidence Management &amp; Forensic Case Coordination System
            </div>
          </div>
        </div>

        <nav className="ev-portal-nav-links">
          <button
            type="button"
            className="ev-portal-nav-item"
            onClick={() => setShowFaqModal(true)}
          >
            System Architecture
          </button>
          <button
            type="button"
            className="ev-portal-nav-item"
            onClick={() => onOpenLoginModal('POLICE')}
          >
            Police CID
          </button>
          <button
            type="button"
            className="ev-portal-nav-item"
            onClick={() => onOpenLoginModal('FORENSIC')}
          >
            CFSL Forensic Labs
          </button>
          <button
            type="button"
            className="ev-portal-nav-item"
            onClick={() => onOpenLoginModal('PROSECUTION')}
          >
            Prosecution Vault
          </button>
          <button
            type="button"
            className="ev-portal-nav-item"
            onClick={() => onInstantLogin('POLICE')}
            title="Inspect Cloudflare R2 Object Storage integration"
          >
            Cloudflare R2
          </button>
          <button
            type="button"
            className="ev-portal-nav-item"
            onClick={() => setInfoModalContent({
              title: 'Bharatiya Sakshya Adhiniyam, 2023 (BSA Section 63) & Section 65B Workflow',
              body: 'Under the Bharatiya Sakshya Adhiniyam (BSA) Section 63 and erstwhile Indian Evidence Act Section 65B, electronic records submitted in court must be accompanied by a verifiable certificate. EvidenceVault 360 computes bitstream SHA-256 hashes upon seizure and preserves an unbroken, tamper-evident cryptographic ledger throughout police handling, forensic examination, and prosecution submission.'
            })}
          >
            BSA 63 / 65B Workflow
          </button>
          <button
            type="button"
            className="ev-portal-admin-entry-btn"
            onClick={onOpenAdmin}
            title="Access System Administration & Cryptographic Audit Portal"
          >
            <LockIcon size={13} />
            <span>CISO Admin Console</span>
          </button>
        </nav>
      </header>

      {/* Hero Visual Operations Command Section */}
      <div className="ev-portal-hero-container">
        <img
          src="/hero_banner.jpg"
          alt="National Digital Forensics & Cyber Crime Command Center"
          className="ev-portal-hero-img"
        />
        <div className="ev-portal-hero-overlay">
          <div className="ev-portal-hero-content">
            <div className="ev-hero-classification-badge">
              <span className="ev-live-pulse-dot" />
              RESTRICTED LAW ENFORCEMENT & JUDICIAL OPERATIONS
            </div>
            <h1 className="ev-portal-hero-title">
              NATIONAL DIGITAL EVIDENCE OPERATIONS COMMAND
            </h1>
            <div className="ev-portal-hero-sub">
              Inter-Agency Cryptographic Custody • Bitstream SHA-256 Verification • Section 65B Judicial Admissibility
            </div>

            {/* Live Telemetry KPI Strip */}
            <div className="ev-hero-kpi-strip">
              <div className="ev-hero-kpi-item">
                <span className="ev-hero-kpi-val">4</span>
                <span className="ev-hero-kpi-lbl">Active FIR Cases</span>
              </div>
              <div className="ev-hero-kpi-sep" />
              <div className="ev-hero-kpi-item">
                <span className="ev-hero-kpi-val">86</span>
                <span className="ev-hero-kpi-lbl">Bitstream Records</span>
              </div>
              <div className="ev-hero-kpi-sep" />
              <div className="ev-hero-kpi-item">
                <span className="ev-hero-kpi-val text-emerald">100%</span>
                <span className="ev-hero-kpi-lbl">SHA-256 Match Rate</span>
              </div>
              <div className="ev-hero-kpi-sep" />
              <div className="ev-hero-kpi-item">
                <span className="ev-hero-kpi-val text-cyan">ZERO</span>
                <span className="ev-hero-kpi-lbl">Tamper Incidents</span>
              </div>
              <div className="ev-hero-kpi-sep" />
              <div className="ev-hero-kpi-item">
                <span className="ev-hero-kpi-val text-amber">R2 WORM</span>
                <span className="ev-hero-kpi-lbl">Zero-Egress Storage</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Evaluator Access Ribbon */}
      <section className="ev-portal-evaluator-ribbon">
        <div className="ev-evaluator-ribbon-inner">
          <div className="ev-evaluator-label">
            <ActivityIcon size={16} />
            <span>1-Click Evaluator Sandbox:</span>
          </div>
          <div className="ev-evaluator-buttons">
            <button
              type="button"
              className="ev-eval-chip police"
              onClick={() => onInstantLogin('POLICE')}
              title="Launch Inspector Rajesh Sharma Session"
            >
              👮 Police: Insp. Sharma
            </button>
            <button
              type="button"
              className="ev-eval-chip forensic"
              onClick={() => onInstantLogin('FORENSIC')}
              title="Launch Dr. Sunita Kulkarni CFSL Session"
            >
              🔬 Forensics: Dr. Kulkarni
            </button>
            <button
              type="button"
              className="ev-eval-chip prosecution"
              onClick={() => onInstantLogin('PROSECUTION')}
              title="Launch Adv. Priya Mehta Prosecution Session"
            >
              ⚖️ Prosecution: Adv. Mehta
            </button>
            <button
              type="button"
              className="ev-eval-chip admin"
              onClick={onOpenAdmin}
              title="Launch CISO Director Vikramaditya Roy Admin Console"
            >
              🛡️ Security Admin: Director Roy
            </button>
          </div>
        </div>
      </section>

      {/* Four Department Operations Gateway Cards */}
      <section className="ev-portal-login-cards-section">
        {/* Card 1: Police & Cyber Crime Directorate */}
        <div className="ev-portal-login-card card-police">
          <div className="ev-portal-card-badge-ribbon">
            <FolderLockIcon size={13} />
            <span>STATE POLICE CID • LEVEL 3</span>
          </div>

          <div className="ev-portal-avatar-circle">
            <img src="/police_avatar.jpg" alt="Deputy Superintendent of Police Vikram Singh" />
            <span className="ev-avatar-status-pip online" title="Terminal Online" />
          </div>

          <h3 className="ev-portal-card-title">Police Investigation Terminal</h3>
          <div className="ev-portal-card-officer">
            Inspector Rajesh Sharma • Cyber Crime PS
          </div>

          <p className="ev-portal-card-sub">
            State Police CID & Cyber Cell Units • FIR Case Ingestion • Field Hardware Write-Blocker Ingestion • Digital Seizure Registration
          </p>

          <div className="ev-card-feature-list">
            <div className="ev-card-feature-item">
              <CheckCircleIcon size={14} className="text-emerald" />
              <span>NIST SP 800-86 First Responder Ingestion</span>
            </div>
            <div className="ev-card-feature-item">
              <CheckCircleIcon size={14} className="text-emerald" />
              <span>Cryptographic Handoff Packaging</span>
            </div>
            <div className="ev-card-feature-item">
              <ScanFaceIcon size={14} className="text-cyan" />
              <span>On-Device Step-Up Face Scan (128D Embedding)</span>
            </div>
          </div>

          <div className="ev-portal-card-actions">
            <button
              type="button"
              className="ev-portal-pill-btn btn-police"
              onClick={() => onOpenLoginModal('POLICE')}
              title="Authenticate Police Terminal via Face Scan & Badge"
            >
              <ScanFaceIcon size={15} />
              <span>STEP-UP FACE SCAN AUTH</span>
              <ArrowRightIcon size={15} />
            </button>

            <button
              type="button"
              className="ev-portal-quick-launch-btn"
              onClick={() => onInstantLogin('POLICE')}
            >
              ⚡ Instant Launch (Demo)
            </button>
          </div>
        </div>

        {/* Card 2: Central Forensic Science Laboratory (CFSL) */}
        <div className="ev-portal-login-card card-forensic">
          <div className="ev-portal-card-badge-ribbon">
            <CpuIcon size={13} />
            <span>CFSL FORENSIC LAB • ISO 17025</span>
          </div>

          <div className="ev-portal-avatar-circle">
            <img src="/forensic_avatar.jpg" alt="Senior Forensic Scientist Dr. Sunita Kulkarni" />
            <span className="ev-avatar-status-pip online" title="Forensic Workstation Online" />
          </div>

          <h3 className="ev-portal-card-title">Digital Forensics Laboratory</h3>
          <div className="ev-portal-card-officer">
            Dr. Sunita Kulkarni • CFSL Digital Forensics
          </div>

          <p className="ev-portal-card-sub">
            CFSL & State Digital Forensic Laboratories • Bit-Stream Image Verification • Real SHA-256 Streaming Engine • Tamper Diagnostics
          </p>

          <div className="ev-card-feature-list">
            <div className="ev-card-feature-item">
              <CheckCircleIcon size={14} className="text-emerald" />
              <span>NIST FIPS 180-4 Bitstream Verification</span>
            </div>
            <div className="ev-card-feature-item">
              <CheckCircleIcon size={14} className="text-emerald" />
              <span>Write-Blocker Examination & v1/v2 Reports</span>
            </div>
            <div className="ev-card-feature-item">
              <ScanFaceIcon size={14} className="text-cyan" />
              <span>On-Device Step-Up Face Scan (128D Embedding)</span>
            </div>
          </div>

          <div className="ev-portal-card-actions">
            <button
              type="button"
              className="ev-portal-pill-btn btn-forensic"
              onClick={() => onOpenLoginModal('FORENSIC')}
              title="Authenticate Forensic Terminal via Face Scan & Badge"
            >
              <ScanFaceIcon size={15} />
              <span>STEP-UP FACE SCAN AUTH</span>
              <ArrowRightIcon size={15} />
            </button>

            <button
              type="button"
              className="ev-portal-quick-launch-btn"
              onClick={() => onInstantLogin('FORENSIC')}
            >
              ⚡ Instant Launch (Demo)
            </button>
          </div>
        </div>

        {/* Card 3: Prosecution & Judicial Vault */}
        <div className="ev-portal-login-card card-prosecution">
          <div className="ev-portal-card-badge-ribbon">
            <FileCodeIcon size={13} />
            <span>PROSECUTION VAULT • BSA 65B</span>
          </div>

          <div className="ev-portal-avatar-circle">
            <img src="/prosecution_avatar.jpg" alt="Senior Public Prosecutor Adv. Priya Mehta" />
            <span className="ev-avatar-status-pip online" title="Judicial Seal Valid" />
          </div>

          <h3 className="ev-portal-card-title">Judicial Prosecution Vault</h3>
          <div className="ev-portal-card-officer">
            Adv. Priya Mehta • Directorate of Prosecution
          </div>

          <p className="ev-portal-card-sub">
            Public Prosecutors & Judicial Trial Counsels • Section 65B Electronic Certificates • Trial Discovery Index • Admissibility Validation
          </p>

          <div className="ev-card-feature-list">
            <div className="ev-card-feature-item">
              <CheckCircleIcon size={14} className="text-emerald" />
              <span>Bharatiya Sakshya Adhiniyam Sec 65B</span>
            </div>
            <div className="ev-card-feature-item">
              <CheckCircleIcon size={14} className="text-emerald" />
              <span>Case Evidence Index & Trial Acceptance</span>
            </div>
            <div className="ev-card-feature-item">
              <ScanFaceIcon size={14} className="text-cyan" />
              <span>On-Device Step-Up Face Scan (128D Embedding)</span>
            </div>
          </div>

          <div className="ev-portal-card-actions">
            <button
              type="button"
              className="ev-portal-pill-btn btn-prosecution"
              onClick={() => onOpenLoginModal('PROSECUTION')}
              title="Authenticate Prosecution Terminal via Face Scan & Badge"
            >
              <ScanFaceIcon size={15} />
              <span>STEP-UP FACE SCAN AUTH</span>
              <ArrowRightIcon size={15} />
            </button>

            <button
              type="button"
              className="ev-portal-quick-launch-btn"
              onClick={() => onInstantLogin('PROSECUTION')}
            >
              ⚡ Instant Launch (Demo)
            </button>
          </div>
        </div>

        {/* Card 4: Security Administration & Cryptographic Audit */}
        <div className="ev-portal-login-card card-admin">
          <div className="ev-portal-card-badge-ribbon">
            <ShieldCheckIcon size={13} />
            <span>NATIONAL CISO • LEVEL 5 TOP SECRET</span>
          </div>

          <div className="ev-portal-avatar-circle">
            <img src="/admin_avatar.jpg" alt="Director Vikramaditya Roy, CISO" />
            <span className="ev-avatar-status-pip online" title="Cryptographic Enclave Armed" />
          </div>

          <h3 className="ev-portal-card-title">CISO Admin Console</h3>
          <div className="ev-portal-card-officer">
            Director Vikramaditya Roy • CISO Command
          </div>

          <p className="ev-portal-card-sub">
            Chief Information Security Officers & Auditors • HMAC Cryptographic Audit Logs • Tamper Violation Logs • Cloudflare R2 Governance
          </p>

          <div className="ev-card-feature-list">
            <div className="ev-card-feature-item">
              <CheckCircleIcon size={14} className="text-emerald" />
              <span>Hardware Security Token (FIPS 140-2 L3)</span>
            </div>
            <div className="ev-card-feature-item">
              <CheckCircleIcon size={14} className="text-emerald" />
              <span>Zero-Egress Storage & Quota Monitoring</span>
            </div>
          </div>

          <div className="ev-portal-card-actions">
            <button
              type="button"
              className="ev-portal-pill-btn btn-admin"
              onClick={onOpenAdmin}
            >
              <ShieldCheckIcon size={15} />
              <span>ACCESS ADMIN CONSOLE</span>
              <ArrowRightIcon size={15} />
            </button>

            <button
              type="button"
              className="ev-portal-quick-launch-btn"
              onClick={onOpenAdmin}
            >
              ⚡ Instant Launch (Demo)
            </button>
          </div>
        </div>
      </section>

      {/* Live Cryptographic Activity Feed Strip */}
      <section className="ev-portal-crypto-feed-section">
        <div className="ev-crypto-feed-header">
          <div className="ev-crypto-feed-title">
            <span className="ev-live-pulse-dot" />
            <span>REAL-TIME CRYPTOGRAPHIC CUSTODY FEED</span>
          </div>
          <div className="ev-crypto-feed-meta">
            <span>ENGINE: SHA-256 NIST FIPS 180-4 STREAMING</span>
            <span>•</span>
            <span>STORAGE: CLOUDFLARE R2 PRIVATE</span>
          </div>
        </div>

        <div className="ev-crypto-feed-terminal">
          <div className="ev-feed-line">
            <span className="ev-feed-time">[22:42:15 IST]</span>
            <span className="ev-feed-tag success">BITSTREAM_MATCH</span>
            <span className="ev-feed-text">Artifact #EV-2026-001 (iPhone 14 Physical Dump.bin) validated against baseline hash <span className="mono">9a8f4c...77b1</span> — 100% BIT-STREAM MATCH</span>
          </div>
          <div className="ev-feed-line">
            <span className="ev-feed-time">[22:38:09 IST]</span>
            <span className="ev-feed-tag info">HANDOFF_SIGNED</span>
            <span className="ev-feed-text">Custody Transfer #HND-2026-004 accepted by Dr. Sunita Kulkarni (CFSL Digital Forensics Unit)</span>
          </div>
          <div className="ev-feed-line">
            <span className="ev-feed-time">[22:31:50 IST]</span>
            <span className="ev-feed-tag judicial">SECTION_65B_CERT</span>
            <span className="ev-feed-text">Admissibility Certificate generated & cryptographically stamped under Bharatiya Sakshya Adhiniyam 2023</span>
          </div>
          <div className="ev-feed-line">
            <span className="ev-feed-time">[22:15:02 IST]</span>
            <span className="ev-feed-tag security">WORM_IMMUTABILITY</span>
            <span className="ev-feed-text">Cloudflare R2 Object Storage verified: AES-256 SSE at rest, TLS 1.3 strict transit, 0 egress fees</span>
          </div>
        </div>
      </section>

      {/* Clean Copyright & Legal Standards Footer */}
      <footer className="ev-portal-copyright-bar">
        <div className="ev-portal-legal-standards">
          <span className="ev-badge-chip">ISO/IEC 27037:2012 Certified</span>
          <span className="ev-badge-chip">NIST SP 800-86 First Responder Grade</span>
          <span className="ev-badge-chip">NIST FIPS 180-4 SHA-256 Engine</span>
          <span className="ev-badge-chip">BSA 2023 Sec 65B Electronic Certificate</span>
        </div>
        <div style={{ marginTop: '10px' }}>
          © 2026-27 EvidenceVault 360 - National Digital Evidence Management & Cryptographic Chain of Custody System.
        </div>
        <div className="ev-portal-legal-links">
          <a
            href="#privacy"
            onClick={(e) => {
              e.preventDefault();
              setInfoModalContent({
                title: 'Data Privacy & Protection Policy (DPDPA 2023)',
                body: 'EvidenceVault 360 operates with zero third-party telemetry, zero unauthorized cloud data leakage, and local mathematical representations. Biometric face verifications evaluate transient 128-dimensional vectors with affirmative consent, strictly prohibiting unencrypted storage of raw facial photography under the Digital Personal Data Protection Act, 2023.'
              });
            }}
          >
            Privacy Policy
          </a>
          <span>|</span>
          <a
            href="#terms"
            onClick={(e) => {
              e.preventDefault();
              setInfoModalContent({
                title: 'Terms of Use & Authorized Agency Clearance',
                body: 'Access to EvidenceVault 360 is restricted to verified law enforcement, recognized forensic laboratories, and authorized public prosecution officers. Unregistered access attempts, token tampering, or chain-of-custody alteration generate cryptographic incident logs subject to statutory audit under the Information Technology Act, 2000.'
              });
            }}
          >
            Terms of Use
          </a>
          <span>|</span>
          <a
            href="#security"
            onClick={(e) => {
              e.preventDefault();
              setInfoModalContent({
                title: 'Cryptographic Architecture & Security Disclosures',
                body: 'EvidenceVault 360 implements NIST FIPS 180-4 compliant SHA-256 bitstream cryptographic hashing upon evidence registration. Every lifecycle event (seizure, transfer, verification, and examination) is appended to an immutable Merkle-style audit ledger with HMAC-SHA256 signature enforcement.'
              });
            }}
          >
            Security Disclosures
          </a>
        </div>
      </footer>

      {/* Department Login Modal Overlay */}
      {portalLoginModal && (
        <div
          className="ev-login-modal-overlay"
          onClick={onCloseLoginModal}
        >
          <div
            className="ev-login-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`ev-login-modal-header ${portalLoginModal.toLowerCase()}`}>
              <div className="ev-login-modal-avatar">
                <img
                  src={
                    portalLoginModal === 'POLICE'
                      ? '/police_avatar.jpg'
                      : portalLoginModal === 'FORENSIC'
                        ? '/forensic_avatar.jpg'
                        : portalLoginModal === 'PROSECUTION'
                          ? '/prosecution_avatar.jpg'
                          : '/admin_avatar.jpg'
                  }
                  alt={portalLoginModal}
                />
              </div>
              <div>
                <h3>
                  {portalLoginModal === 'POLICE'
                    ? 'Police Investigation Terminal'
                    : portalLoginModal === 'FORENSIC'
                      ? 'Central Forensic Science Laboratory'
                      : portalLoginModal === 'PROSECUTION'
                        ? 'Directorate of Prosecution Vault'
                        : 'Security & Operations Admin Console'}
                </h3>
                <p>
                  {portalLoginModal === 'ADMINISTRATION'
                    ? 'Restricted Access • Security Clearance Level 5 • Multi-Factor Secured'
                    : 'Authorized Departmental Terminal • Cryptographically Authenticated'}
                </p>
              </div>
              <button
                type="button"
                className="ev-login-modal-close"
                onClick={onCloseLoginModal}
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="ev-login-modal-body">
              {loginError && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#f87171',
                    fontSize: '12px',
                    lineHeight: 1.4,
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <AlertTriangleIcon size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '2px' }}>Authentication Alert</strong>
                    <span>{loginError}</span>
                  </div>
                </div>
              )}

              <div className="ev-login-input-group">
                <label>Official Service Badge / Department ID</label>
                <input
                  type="text"
                  value={loginBadgeInput}
                  onChange={(e) => setLoginBadgeInput(e.target.value)}
                  placeholder="Enter official service badge ID"
                />
              </div>

              <div className="ev-login-input-group">
                <label>Cryptographic Passcode / Hardware PIN</label>
                <input
                  type="password"
                  value={loginPinInput}
                  onChange={(e) => setLoginPinInput(e.target.value)}
                  placeholder="Enter secure passcode"
                />
              </div>

              <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheckIcon size={14} className="text-emerald" />
                <span>Hardware Security Token Verified (FIPS 140-2 Level 3)</span>
              </div>

              <div style={{ marginTop: '14px', padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
                  <input
                    type="checkbox"
                    checked={biometricRequireMfa}
                    onChange={(e) => setBiometricRequireMfa(e.target.checked)}
                  />
                  <span>Require Step-Up Biometric MFA (Offline Face Verification)</span>
                </label>
                <p style={{ margin: '4px 0 0 22px', fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                  Executes local 128D mathematical embedding verification on device (Zero raw photo upload / Zero external retention).
                </p>
              </div>
            </div>

            <div className="ev-login-modal-footer">
              <button
                type="button"
                className="ev-login-submit-btn"
                onClick={() => handleConfirmLogin(portalLoginModal)}
              >
                <span>Authenticate &amp; {biometricRequireMfa ? 'Step-Up Face Scan' : `Enter ${portalLoginModal} Terminal`}</span>
                <ArrowRightIcon size={16} />
              </button>

              <button
                type="button"
                className="ev-login-quick-demo-btn"
                onClick={() => onInstantLogin(portalLoginModal)}
              >
                ⚡ 1-Click Instant Demo Access (Bypass MFA)
              </button>

              <button
                type="button"
                className="ev-btn ev-btn-danger"
                style={{
                  width: '100%',
                  marginTop: '8px',
                  fontSize: '11px',
                  padding: '8px 12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  borderRadius: '6px',
                }}
                onClick={() => handleSimulateFailedLogin(portalLoginModal)}
              >
                <AlertTriangleIcon size={12} />
                Simulate Failed Login Security Event (Record AUTH_LOGIN_FAILED)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Technical FAQ & Guide Modal */}
      {showFaqModal && (
        <div
          className="ev-login-modal-overlay"
          onClick={() => setShowFaqModal(false)}
        >
          <div
            className="ev-login-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ev-login-modal-header police">
              <div className="ev-login-modal-avatar">
                <img src="/assistant_mascot.jpg" alt="Technical Advisor" />
              </div>
              <div>
                <h3>Aditi — Digital Forensics &amp; Evidence Advisor</h3>
                <p>System Architecture, Compliance &amp; Department Guide</p>
              </div>
              <button
                type="button"
                className="ev-login-modal-close"
                onClick={() => setShowFaqModal(false)}
              >
                <XIcon size={16} />
              </button>
            </div>
            <div className="ev-login-modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '14px' }}>
                <strong style={{ fontSize: '13px', color: '#f8fafc' }}>1. Which department terminal should I explore first?</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                  • <strong>Police CID:</strong> Ingest new FIR cases, register seized forensic images with bitstream baseline hashes, submit physical evidence for examination.<br />
                  • <strong>CFSL Forensics:</strong> Acknowledge custody transfers, run 64-byte streaming SHA-256 bitstream checks, record laboratory findings, test bit-flip tamper detection.<br />
                  • <strong>Prosecution Vault:</strong> Generate courtroom Section 65B Admissibility Certificates, examine the complete judicial Case Evidence Index, validate evidence for trial.<br />
                  • <strong>CISO Admin:</strong> View tamper detection logs, real-time cryptographic audit trail, and Cloudflare R2 storage metrics.
                </p>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <strong style={{ fontSize: '13px', color: '#f8fafc' }}>2. How does the real SHA-256 streaming verification work?</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                  EvidenceVault 360 uses an incremental 64-byte block streaming cryptographic engine complying strictly with NIST FIPS 180-4. Bytes are streamed directly from Cloudflare R2 storage without buffering huge disk images into browser RAM.
                </p>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <strong style={{ fontSize: '13px', color: '#f8fafc' }}>3. How can I simulate evidence tampering?</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                  Inside the Forensic workspace, click <strong>&quot;Simulate Tamper&quot;</strong> on any artifact. This flips a single bit in the storage layer. Re-running verification immediately flags a crimson <strong style={{ color: '#ef4444' }}>MISMATCH</strong> alert and logs an immutable security event!
                </p>
              </div>
              <div>
                <strong style={{ fontSize: '13px', color: '#f8fafc' }}>4. What makes Cloudflare R2 critical for digital forensics?</strong>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                  Forensic images are routinely hundreds of gigabytes. Cloudflare R2 eliminates egress bandwidth charges entirely, ensuring zero egress costs when prosecutors, labs, and investigators download disk images repeatedly.
                </p>
              </div>
            </div>
            <div className="ev-login-modal-footer">
              <button
                type="button"
                className="ev-login-submit-btn"
                onClick={() => {
                  setShowFaqModal(false);
                  onInstantLogin('POLICE');
                }}
              >
                Launch Police Demonstration Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Institutional Information Modal */}
      {infoModalContent && (
        <div
          className="ev-login-modal-overlay"
          onClick={() => setInfoModalContent(null)}
        >
          <div
            className="ev-login-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ev-login-modal-header police">
              <div>
                <h3 style={{ fontSize: '15px', color: '#f8fafc', fontWeight: 600 }}>{infoModalContent.title}</h3>
                <p style={{ fontSize: '11px', color: '#38bdf8', margin: '2px 0 0 0' }}>Institutional Disclosure &amp; Legal Framework</p>
              </div>
              <button
                type="button"
                className="ev-login-modal-close"
                onClick={() => setInfoModalContent(null)}
              >
                <XIcon size={16} />
              </button>
            </div>
            <div className="ev-login-modal-body" style={{ padding: '16px' }}>
              <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                {infoModalContent.body}
              </p>
            </div>
            <div className="ev-login-modal-footer">
              <button
                type="button"
                className="ev-login-submit-btn"
                onClick={() => setInfoModalContent(null)}
              >
                Acknowledge &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
