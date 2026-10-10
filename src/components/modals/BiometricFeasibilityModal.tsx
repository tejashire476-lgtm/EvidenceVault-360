import React from 'react';
import { BIOMETRIC_FEASIBILITY_SPEC } from '../../utils/biometric.ts';
import { ShieldCheckIcon, AlertTriangleIcon, XIcon } from '../icons.tsx';

export interface BiometricFeasibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  biometricReportTab:
    | 'OVERVIEW'
    | 'BROWSERS_DEVICES'
    | 'ON_DEVICE_MODELS'
    | 'PRIVACY_STORAGE'
    | 'LIVENESS_SPOOFING'
    | 'FAR_FRR_RISK'
    | 'FALLBACK_A11Y'
    | 'TEST_MATRIX';
  setBiometricReportTab: (
    tab:
      | 'OVERVIEW'
      | 'BROWSERS_DEVICES'
      | 'ON_DEVICE_MODELS'
      | 'PRIVACY_STORAGE'
      | 'LIVENESS_SPOOFING'
      | 'FAR_FRR_RISK'
      | 'FALLBACK_A11Y'
      | 'TEST_MATRIX'
  ) => void;
  onRunMatrixTest: (testType: 'PERMITTED' | 'DENIED' | 'SPOOF' | 'FALLBACK') => void;
  biometricTestMatrixLog: string[];
  setBiometricTestMatrixLog: React.Dispatch<React.SetStateAction<string[]>>;
}

export const BiometricFeasibilityModal: React.FC<BiometricFeasibilityModalProps> = ({
  isOpen,
  onClose,
  biometricReportTab,
  setBiometricReportTab,
  onRunMatrixTest,
  biometricTestMatrixLog,
  setBiometricTestMatrixLog,
}) => {
  if (!isOpen) return null;

  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal ev-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="ev-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#312e81', color: '#c7d2fe', padding: '8px', borderRadius: '8px' }}>
              <ShieldCheckIcon size={24} />
            </div>
            <div>
              <h3 className="ev-modal-title">Offline Face Verification Feasibility & Privacy Specification</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                EvidenceVault 360 • Multi-Department Forensic Biometric MFA Assessment (Score: {BIOMETRIC_FEASIBILITY_SPEC.feasibilityScore}/100)
              </span>
            </div>
          </div>
          <button
            type="button"
            className="ev-modal-close"
            onClick={onClose}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="ev-tabs" style={{ padding: '0 24px', borderBottom: '1px solid #1e263d', background: '#0a0e1c' }}>
          <button
            type="button"
            className={`ev-tab ${biometricReportTab === 'OVERVIEW' ? 'active' : ''}`}
            onClick={() => setBiometricReportTab('OVERVIEW')}
          >
            1. Overview & Score
          </button>
          <button
            type="button"
            className={`ev-tab ${biometricReportTab === 'BROWSERS_DEVICES' ? 'active' : ''}`}
            onClick={() => setBiometricReportTab('BROWSERS_DEVICES')}
          >
            2. Browsers & Devices
          </button>
          <button
            type="button"
            className={`ev-tab ${biometricReportTab === 'ON_DEVICE_MODELS' ? 'active' : ''}`}
            onClick={() => setBiometricReportTab('ON_DEVICE_MODELS')}
          >
            3. On-Device Models
          </button>
          <button
            type="button"
            className={`ev-tab ${biometricReportTab === 'PRIVACY_STORAGE' ? 'active' : ''}`}
            onClick={() => setBiometricReportTab('PRIVACY_STORAGE')}
          >
            4. Zero-Retention & Storage
          </button>
          <button
            type="button"
            className={`ev-tab ${biometricReportTab === 'LIVENESS_SPOOFING' ? 'active' : ''}`}
            onClick={() => setBiometricReportTab('LIVENESS_SPOOFING')}
          >
            5. Liveness & Spoofing
          </button>
          <button
            type="button"
            className={`ev-tab ${biometricReportTab === 'FAR_FRR_RISK' ? 'active' : ''}`}
            onClick={() => setBiometricReportTab('FAR_FRR_RISK')}
          >
            6. FAR / FRR Risks
          </button>
          <button
            type="button"
            className={`ev-tab ${biometricReportTab === 'FALLBACK_A11Y' ? 'active' : ''}`}
            onClick={() => setBiometricReportTab('FALLBACK_A11Y')}
          >
            7. Fallback & A11y
          </button>
          <button
            type="button"
            className={`ev-tab ${biometricReportTab === 'TEST_MATRIX' ? 'active' : ''}`}
            onClick={() => setBiometricReportTab('TEST_MATRIX')}
          >
            8. Live Test Matrix
          </button>
        </div>

        <div className="ev-modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
          {/* TAB 1: OVERVIEW */}
          {biometricReportTab === 'OVERVIEW' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div style={{ background: '#0c1222', border: '1px solid #1e3a8a', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', fontWeight: 700 }}>
                    Feasibility Assessment Score
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
                    88 <span style={{ fontSize: '16px', color: '#64748b' }}>/ 100</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px' }}>
                    ● Condition: Step-Up MFA Only
                  </div>
                </div>

                <div style={{ background: '#0c1222', border: '1px solid #1e3a8a', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', fontWeight: 700 }}>
                    Architectural Status
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24', marginTop: '8px' }}>
                    {BIOMETRIC_FEASIBILITY_SPEC.status}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    Prohibited as sole authentication factor
                  </div>
                </div>

                <div style={{ background: '#0c1222', border: '1px solid #1e3a8a', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', fontWeight: 700 }}>
                    Privacy Guarantee
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399', marginTop: '8px' }}>
                    Zero Raw Image Retention
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    128D Unit Mathematical Vectors Only
                  </div>
                </div>
              </div>

              <div style={{ background: '#090d19', border: '1px solid #1e263d', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <h4 style={{ color: '#f8fafc', fontSize: '14px', margin: '0 0 10px 0' }}>
                  Executive Engineering & Legal Assessment
                </h4>
                <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 10px 0' }}>
                  The EvidenceVault 360 engineering panel evaluated whether on-device, offline facial verification can be safely deployed across law enforcement, forensic laboratories, and public prosecutors.
                </p>
                <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 10px 0' }}>
                  <strong>Conclusion:</strong> Offline face verification is <strong>FEASIBLE AND BENEFICIAL</strong> when implemented strictly as an auxiliary <strong>Step-Up Multi-Factor Authentication (MFA)</strong> factor. It is <strong>NOT FEASIBLE</strong> as a sole primary factor or without interactive challenge-response liveness due to presentation attack vulnerabilities inherent in consumer RGB webcams.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                  <span className="ev-bio-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #0284c7' }}>
                    ✓ ISO/IEC 27037:2012 Forensics
                  </span>
                  <span className="ev-bio-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid #059669' }}>
                    ✓ DPDP Act 2023 Explicit Consent
                  </span>
                  <span className="ev-bio-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid #7e22ce' }}>
                    ✓ GDPR Article 9 Biometric Safety
                  </span>
                  <span className="ev-bio-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid #b45309' }}>
                    ✓ FIPS 180-4 SHA-256 HMAC Enclave
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BROWSERS & DEVICES */}
          {biometricReportTab === 'BROWSERS_DEVICES' && (
            <div>
              <h4 style={{ color: '#f8fafc', fontSize: '14px', margin: '0 0 12px 0' }}>
                Supported Browsers & Client Device Hardware Matrix
              </h4>
              <table className="ev-table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Platform / Browser</th>
                    <th>Min Version</th>
                    <th>WASM SIMD</th>
                    <th>Camera API</th>
                    <th>Offline Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Google Chrome</strong> (Windows, macOS, Linux, Android)</td>
                    <td>v90+</td>
                    <td><span style={{ color: '#34d399' }}>✓ Hardware Accelerated</span></td>
                    <td>WebRTC getUserMedia</td>
                    <td><span className="ev-badge match">FULL COMPATIBILITY</span></td>
                  </tr>
                  <tr>
                    <td><strong>Microsoft Edge</strong> (Windows 10/11, macOS)</td>
                    <td>v90+</td>
                    <td><span style={{ color: '#34d399' }}>✓ Hardware Accelerated</span></td>
                    <td>WebRTC getUserMedia</td>
                    <td><span className="ev-badge match">FULL COMPATIBILITY</span></td>
                  </tr>
                  <tr>
                    <td><strong>Mozilla Firefox</strong> (Linux, macOS, Windows)</td>
                    <td>v90+</td>
                    <td><span style={{ color: '#34d399' }}>✓ SIMD Enabled</span></td>
                    <td>WebRTC getUserMedia</td>
                    <td><span className="ev-badge match">FULL COMPATIBILITY</span></td>
                  </tr>
                  <tr>
                    <td><strong>Apple Safari</strong> (macOS 11+, iOS 14.3+)</td>
                    <td>v14.3+</td>
                    <td><span style={{ color: '#fbbf24' }}>✓ Standard WASM</span></td>
                    <td>WebKit getUserMedia</td>
                    <td><span className="ev-badge match">COMPATIBLE</span></td>
                  </tr>
                  <tr>
                    <td><strong>Legacy Browsers (IE11, Pre-Chromium Edge)</strong></td>
                    <td>&lt; v89</td>
                    <td><span style={{ color: '#f87171' }}>✗ Missing WASM</span></td>
                    <td>Unsupported</td>
                    <td><span className="ev-badge mismatch">FALLBACK REQUIRED</span></td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: '16px', background: '#0a0d18', padding: '14px', borderRadius: '6px', border: '1px solid #1e263d' }}>
                <strong style={{ color: '#38bdf8', fontSize: '13px' }}>Client Hardware Requirements:</strong>
                <ul style={{ margin: '8px 0 0 18px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>
                  <li><strong>Processor:</strong> 1.2 GHz dual-core 64-bit CPU or higher (SIMD instruction set support).</li>
                  <li><strong>RAM:</strong> 250 MB free application memory allocated to WebAssembly linear memory heap.</li>
                  <li><strong>Camera:</strong> Standard 720p 30fps optical webcam (USB 2.0 or integrated CMOS sensor).</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: ON-DEVICE MODELS */}
          {biometricReportTab === 'ON_DEVICE_MODELS' && (
            <div>
              <h4 style={{ color: '#f8fafc', fontSize: '14px', margin: '0 0 12px 0' }}>
                On-Device Machine Learning Pipeline (100% In-Browser Execution)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div style={{ background: '#0c1222', border: '1px solid #1e3a8a', borderRadius: '8px', padding: '14px' }}>
                  <strong style={{ color: '#38bdf8', fontSize: '13px' }}>1. Face Detector: BlazeFace / MediaPipe</strong>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: '6px 0 8px 0' }}>
                    Quantized lightweight sub-millisecond neural network running via WebAssembly / WebGL shaders.
                  </p>
                  <ul style={{ margin: '0 0 0 16px', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    <li><strong>Model Size:</strong> ~390 KB quantized binary</li>
                    <li><strong>Landmarks:</strong> 68 3D facial coordinate anchors</li>
                    <li><strong>Inference Latency:</strong> ~12ms per frame</li>
                    <li><strong>Execution:</strong> 100% Client-side sandbox</li>
                  </ul>
                </div>

                <div style={{ background: '#0c1222', border: '1px solid #1e3a8a', borderRadius: '8px', padding: '14px' }}>
                  <strong style={{ color: '#38bdf8', fontSize: '13px' }}>2. Feature Extractor: MobileFaceNet 128D</strong>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: '6px 0 8px 0' }}>
                    Convolutional deep metric learning network outputting normalized 128D mathematical embeddings.
                  </p>
                  <ul style={{ margin: '0 0 0 16px', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    <li><strong>Model Size:</strong> ~4.1 MB ONNX format</li>
                    <li><strong>Embedding Space:</strong> 128-dimensional unit hypersphere</li>
                    <li><strong>Inference Latency:</strong> ~35ms – 48ms</li>
                    <li><strong>Network Traffic:</strong> 0 bytes (zero cloud upload)</li>
                  </ul>
                </div>
              </div>

              <div style={{ background: '#090d19', padding: '14px', borderRadius: '6px', border: '1px solid #1e263d', fontSize: '12px', color: '#cbd5e1' }}>
                <strong style={{ color: '#34d399' }}>Zero-Cloud Compute Guarantee:</strong> At no point during face detection, landmark extraction, or vector comparison does biometric data leave the user’s local workstation. No external API keys or cloud vision endpoints are invoked.
              </div>
            </div>
          )}

          {/* TAB 4: ZERO-RETENTION & STORAGE */}
          {biometricReportTab === 'PRIVACY_STORAGE' && (
            <div>
              <h4 style={{ color: '#f8fafc', fontSize: '14px', margin: '0 0 12px 0' }}>
                Zero Raw Image Retention & Cryptographic Template Storage
              </h4>
              <div style={{ background: '#0c1222', border: '1px solid #059669', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700, fontSize: '13px' }}>
                  <ShieldCheckIcon size={18} />
                  <span>Zero Raw Photographic Image Retention Policy</span>
                </div>
                <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '8px 0 0 0', lineHeight: 1.6 }}>
                  {BIOMETRIC_FEASIBILITY_SPEC.zeroRawImageRetentionNotice}
                </p>
              </div>

              <h5 style={{ color: '#93c5fd', fontSize: '13px', margin: '14px 0 8px 0' }}>
                Stored Template Data Structure (JSON Schema)
              </h5>
              <pre style={{ background: '#080c18', padding: '12px', borderRadius: '6px', border: '1px solid #1e263d', color: '#38bdf8', fontSize: '11px', overflowX: 'auto' }}>
{`{
  "templateId": "TMPL-USR-POLICE-01-177292",
  "userId": "USR-POLICE-01",
  "algorithm": "EVIDENCEVAULT_FACENET_EMBEDDING_128D",
  "vectorValues": [-0.0821, 0.1429, -0.0093, ... 128 float values ...],
  "embeddingDigest": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
  "hardwareSalt": "ENCLAVE-SALT-177292-x9k2p",
  "enrolledAt": "2026-10-01T00:00:00.000Z",
  "consentTimestamp": "2026-10-01T00:00:00.000Z",
  "consentVersion": "v1.0-CONSENT-VERIFIED",
  "qualityScore": 0.95
}`}
              </pre>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                Note: A 128D mathematical vector is mathematically non-invertible; the original human facial photograph cannot be reconstructed from the vector.
              </p>
            </div>
          )}

          {/* TAB 5: LIVENESS & SPOOFING */}
          {biometricReportTab === 'LIVENESS_SPOOFING' && (
            <div>
              <h4 style={{ color: '#f8fafc', fontSize: '14px', margin: '0 0 12px 0' }}>
                Presentation Attack Detection (PAD) & RGB Webcam Limitations
              </h4>
              <div style={{ background: '#1c1010', border: '1px solid #dc2626', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: 700, fontSize: '13px' }}>
                  <AlertTriangleIcon size={18} />
                  <span>CRITICAL FORENSIC LIMITATION NOTICE</span>
                </div>
                <p style={{ fontSize: '12px', color: '#fecaca', margin: '8px 0 0 0', lineHeight: 1.6 }}>
                  {BIOMETRIC_FEASIBILITY_SPEC.livenessLimitationsDisclaimer}
                </p>
              </div>

              <table className="ev-table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Attack Vector</th>
                    <th>RGB Camera Resistance</th>
                    <th>Mitigation Deployed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Static Printed Photograph</strong></td>
                    <td><span style={{ color: '#34d399' }}>HIGH (Blocked)</span></td>
                    <td>Interactive micro-blink & landmark optical challenge</td>
                  </tr>
                  <tr>
                    <td><strong>Pre-Recorded Video Replay</strong></td>
                    <td><span style={{ color: '#fbbf24' }}>MEDIUM (Challenge-Bound)</span></td>
                    <td>Random challenge-response sequences (blink left, blink right)</td>
                  </tr>
                  <tr>
                    <td><strong>4K OLED Screen Replay</strong></td>
                    <td><span style={{ color: '#f87171' }}>LOW (Vulnerable)</span></td>
                    <td><strong>MFA Enforcement:</strong> Officer must possess Service Badge & PIN</td>
                  </tr>
                  <tr>
                    <td><strong>3D Silicone Prosthetic Mask</strong></td>
                    <td><span style={{ color: '#f87171' }}>LOW (Requires 3D IR Sensor)</span></td>
                    <td><strong>Step-Up Only:</strong> Face verification is NEVER the sole factor</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 6: FAR / FRR RISKS */}
          {biometricReportTab === 'FAR_FRR_RISK' && (
            <div>
              <h4 style={{ color: '#f8fafc', fontSize: '14px', margin: '0 0 12px 0' }}>
                False Acceptance Rate (FAR) vs. False Rejection Rate (FRR) Trade-Offs
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div style={{ background: '#0c1222', border: '1px solid #1e3a8a', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', fontWeight: 700 }}>
                    Expected False Acceptance Rate (FAR)
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
                    0.08%
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    ~1 in 1,250 trials at Cosine Similarity threshold ≥ 0.85
                  </div>
                </div>

                <div style={{ background: '#0c1222', border: '1px solid #1e3a8a', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', fontWeight: 700 }}>
                    Expected False Rejection Rate (FRR)
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>
                    2.4%
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    Caused by low ambient light, head pitch &gt; 25°, or heavy eyewear
                  </div>
                </div>
              </div>

              <div style={{ background: '#0a0d18', padding: '14px', borderRadius: '6px', border: '1px solid #1e263d', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>
                <strong style={{ color: '#38bdf8' }}>Threshold Calibration Decision (τ = 0.85):</strong>
                <p style={{ margin: '6px 0 0 0' }}>
                  In evidence custody architectures, minimizing False Acceptance (impersonation) takes strict precedence over False Rejection. If an authorized examiner experiences a False Rejection due to adverse field lighting, they immediately utilize the <strong>Passcode Fallback Pathway</strong>, ensuring operational continuity without compromising vault security.
                </p>
              </div>
            </div>
          )}

          {/* TAB 7: FALLBACK & ACCESSIBILITY */}
          {biometricReportTab === 'FALLBACK_A11Y' && (
            <div>
              <h4 style={{ color: '#f8fafc', fontSize: '14px', margin: '0 0 12px 0' }}>
                Non-Biometric Fallback Authentication & Universal Accessibility
              </h4>
              <div style={{ background: '#0c1222', border: '1px solid #0284c7', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 700, fontSize: '13px' }}>
                  <ShieldCheckIcon size={18} />
                  <span>Inclusive Fallback Mandate (Section 508 / WCAG 2.1 AA)</span>
                </div>
                <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '8px 0 0 0', lineHeight: 1.6 }}>
                  Biometric technology can fail or be unavailable due to camera damage, low-bandwidth field laptops, facial trauma, medical dressings, or religious facial coverings. Under EvidenceVault 360 policy, officers always retain the guaranteed right to authenticate via their Cryptographic Security PIN without administrative penalty.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ background: '#090d19', padding: '14px', borderRadius: '6px', border: '1px solid #1e263d' }}>
                  <strong style={{ color: '#34d399', fontSize: '13px' }}>Permitted Fallback Scenarios</strong>
                  <ul style={{ margin: '8px 0 0 16px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    <li>Damaged or disconnected USB webcam</li>
                    <li>Dim field environment (&lt; 20 lux lighting)</li>
                    <li>Temporary facial injury or medical dressing</li>
                    <li>User withdrawal of biometric consent</li>
                  </ul>
                </div>

                <div style={{ background: '#090d19', padding: '14px', borderRadius: '6px', border: '1px solid #1e263d' }}>
                  <strong style={{ color: '#fbbf24', fontSize: '13px' }}>Audit Chain Recording</strong>
                  <ul style={{ margin: '8px 0 0 16px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    <li>Fallback events recorded with reason tag</li>
                    <li>Zero penalty or lockout on fallback PIN</li>
                    <li>Cryptographic hash chain updated seamlessly</li>
                    <li>No biometric template created or leaked</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: LIVE TEST MATRIX */}
          {biometricReportTab === 'TEST_MATRIX' && (
            <div>
              <h4 style={{ color: '#f8fafc', fontSize: '14px', margin: '0 0 12px 0' }}>
                Automated Biometric Test Matrix & Event Telemetry
              </h4>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 14px 0' }}>
                Execute permitted and denied flows interactively to verify engine performance against mathematical models.
              </p>

              <div className="ev-bio-test-btn-group" style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  className="ev-bio-test-btn permitted"
                  onClick={() => onRunMatrixTest('PERMITTED')}
                >
                  <span>▶ Test Permitted Flow (≥ 0.85)</span>
                </button>
                <button
                  type="button"
                  className="ev-bio-test-btn denied"
                  onClick={() => onRunMatrixTest('DENIED')}
                >
                  <span>▶ Test Denied Flow (&lt; 0.85)</span>
                </button>
                <button
                  type="button"
                  className="ev-bio-test-btn spoof"
                  onClick={() => onRunMatrixTest('SPOOF')}
                >
                  <span>▶ Test Presentation Attack</span>
                </button>
                <button
                  type="button"
                  className="ev-bio-test-btn fallback"
                  onClick={() => onRunMatrixTest('FALLBACK')}
                >
                  <span>▶ Test Fallback Passcode</span>
                </button>
              </div>

              <div style={{ background: '#070a14', border: '1px solid #1e263d', borderRadius: '6px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Live Telemetry Ledger
                  </strong>
                  <button
                    type="button"
                    style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer' }}
                    onClick={() => setBiometricTestMatrixLog([])}
                  >
                    Clear
                  </button>
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' }}>
                  {biometricTestMatrixLog.length === 0 ? (
                    <div style={{ color: '#64748b', fontStyle: 'italic' }}>No test runs executed yet.</div>
                  ) : (
                    biometricTestMatrixLog.map((log, idx) => (
                      <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid #111827' }}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="ev-form-actions" style={{ padding: '16px 24px', borderTop: '1px solid #1e263d', background: '#0a0e1c' }}>
          <button
            type="button"
            className="ev-btn ev-btn-primary"
            onClick={onClose}
          >
            Close Feasibility Specification
          </button>
        </div>
      </div>
    </div>
  );
};
