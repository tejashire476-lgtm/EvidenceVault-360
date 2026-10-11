// ============================================================================
// EVIDENCEVAULT 360 — BILINGUAL LOCALIZATION (ENGLISH & HINDI)
// Guidelines for Indian Government Websites and Apps (GIGW 3.0) Compliance
// ============================================================================

export type SupportedLanguage = 'en' | 'hi';

export const TRANSLATIONS = {
  en: {
    appTitle: 'EvidenceVault 360',
    tagline: 'One Case. Three Departments. Traceable Evidence.',
    institutionalHeader: 'EVIDENCEVAULT 360 • INTER-AGENCY DIGITAL FORENSICS & CUSTODY ASSURANCE SYSTEM',
    gigwNotice: 'GIGW 3.0 Accessible • Bharatiya Sakshya Adhiniyam Sec 65B Compliant',
    
    // Departments
    deptPolice: 'Police Investigation CID',
    deptForensic: 'Central Forensic Science Laboratory (CFSL)',
    deptProsecution: 'Directorate of Public Prosecution',
    deptAdmin: 'System Administration & Security Operations',

    // Roles
    rolePolice: 'Police Investigator',
    roleForensic: 'Forensic Examiner',
    roleProsecution: 'Public Prosecutor',
    roleAdmin: 'System Administrator',

    // Navigation & Tabs
    dashboard: 'Dashboard',
    caseRegister: 'Case Register',
    createCase: 'Register New Case (FIR)',
    evidenceCollection: 'Evidence Collection',
    uploadEvidence: 'Seize & Ingest Evidence',
    chainOfCustody: 'Chain of Custody',
    transferForensic: 'Transfer to Forensic',
    examinationQueue: 'Examination Queue',
    evidenceVault: 'Evidence Vault',
    sha256Verification: 'SHA-256 Bitstream Verification',
    forensicAnalysis: 'Forensic Analysis',
    clarificationRequests: 'Clarification Requests',
    reportBuilder: 'Forensic Report Builder',
    reportVersions: 'Report Version History',
    assignedCases: 'Assigned Cases',
    evidenceReview: 'Evidence Review',
    forensicReports: 'Forensic Reports',
    judicialReview: 'Judicial Review',
    admissibilityChecklist: 'Admissibility Checklist',
    courtPreparation: 'Court Presentation Prep',
    reviewHistory: 'Review History',
    systemAudit: 'Cryptographic Audit Ledger',
    timeline: 'Investigation Timeline',
    reports: 'Investigation Reports',
    notifications: 'Notifications',
    profile: 'Officer Profile',
    signOut: 'Secure Sign Out',
    cyberCommand: 'Cyber Command Center',
    backToPortal: 'Back to My Workspace',
    offlineMode: 'Offline Field Mode',

    // Actions & Buttons
    btnRegisterCase: '+ Register Police Case (FIR)',
    btnSeizeEvidence: '+ Seize & Seal Evidence',
    btnSection65B: 'Section 65B Electronic Index',
    btnVerifyHash: 'Verify SHA-256',
    btnSimulateTamper: 'Test Tamper',
    btnRestorePristine: 'Restore Pristine',
    btnAckReceive: '✓ Acknowledge & Receive',
    btnBeginExam: 'Begin Examination',
    btnMarkReady: '✓ Mark Report Ready',
    btnSubmitReport: 'Submit Report Version',
    btnAcceptTrial: 'Accept for Trial Presentation',
    btnRequestClarification: 'Request Clarification',
    btnTransmitResponse: 'Transmit Clarification Response',
    btnPrintManifest: 'Print Judicial Manifest',

    // Statuses
    statusOpen: 'OPEN',
    statusUnderInvestigation: 'UNDER INVESTIGATION',
    statusPendingForensics: 'PENDING FORENSICS',
    statusProsecutionReview: 'PROSECUTION REVIEW',
    statusSealed: 'SEALED',
    statusArchived: 'ARCHIVED',
    statusMatch: 'VERIFIED MATCH',
    statusMismatch: 'TAMPER MISMATCH',
    statusError: 'SYSTEM ERROR',
    statusDraft: 'DRAFT',
    statusSubmitted: 'SUBMITTED',
    statusReceived: 'RECEIVED',
    statusUnderExamination: 'UNDER EXAMINATION',
    statusReportReady: 'REPORT READY',

    // Disclaimers & Statutory Notices
    faceAuthDisclaimer: 'Client-side liveness demonstration. Does not constitute statutory Aadhaar biometric authentication.',
    tamperNotice: 'Tamper detection verified on physical bitstream bytes. Cryptographic ledger protects evidence integrity.',
    bsaSection65BNotice: 'Preserves cryptographic proof of authenticity required under Section 65B of Indian Evidence Law / Section 63 BSA 2023.',
  },

  hi: {
    appTitle: 'एविडेंसवॉल्ट 360',
    tagline: 'एक मामला। तीन विभाग। संदेहरहित साक्ष्य।',
    institutionalHeader: 'एविडेंसवॉल्ट 360 • अंतर-विभागीय डिजिटल साक्ष्य एवं अभिरक्षा श्रृंखला प्रणाली',
    gigwNotice: 'GIGW 3.0 सुलभ • भारतीय साक्ष्य अधिनियम धारा 65B (BSA 63) अनुपालन',

    // Departments
    deptPolice: 'पुलिस अनुसंधान सीआईडी',
    deptForensic: 'केंद्रीय फॉरेंसिक विज्ञान प्रयोगशाला (सीएफएसएल)',
    deptProsecution: 'लोक अभियोजन निदेशालय',
    deptAdmin: 'प्रणाली प्रशासन एवं सुरक्षा संचालन',

    // Roles
    rolePolice: 'पुलिस अनुसंधान अधिकारी',
    roleForensic: 'फॉरेंसिक परीक्षक',
    roleProsecution: 'लोक अभियोजक',
    roleAdmin: 'प्रणाली प्रशासक',

    // Navigation & Tabs
    dashboard: 'डैशबोर्ड',
    caseRegister: 'मामला पंजिका',
    createCase: 'नया मामला दर्ज करें (एफआईआर)',
    evidenceCollection: 'साक्ष्य संकलन',
    uploadEvidence: 'साक्ष्य जब्ती एवं प्रविष्टि',
    chainOfCustody: 'अभिरक्षा श्रृंखला',
    transferForensic: 'फॉरेंसिक को हस्तांतरण',
    examinationQueue: 'परीक्षण कार्यसूची',
    evidenceVault: 'साक्ष्य कोष',
    sha256Verification: 'SHA-256 हैश सत्यापन',
    forensicAnalysis: 'फॉरेंसिक विश्लेषण',
    clarificationRequests: 'स्पष्टीकरण अनुरोध',
    reportBuilder: 'फॉरेंसिक रिपोर्ट निर्माता',
    reportVersions: 'रिपोर्ट संस्करण इतिहास',
    assignedCases: 'आवंटित मामले',
    evidenceReview: 'साक्ष्य समीक्षा',
    forensicReports: 'फॉरेंसिक रिपोर्टें',
    judicialReview: 'न्यायिक समीक्षा',
    admissibilityChecklist: 'ग्राह्यता जांच सूची',
    courtPreparation: 'न्यायालय प्रस्तुति तैयारी',
    reviewHistory: 'समीक्षा इतिहास',
    systemAudit: 'क्रिप्टोग्राफ़िक ऑडिट बहीखाता',
    timeline: 'अनुसंधान घटनाक्रम',
    reports: 'अनुसंधान रिपोर्टें',
    notifications: 'सूचनाएं',
    profile: 'अधिकारी प्रोफ़ाइल',
    signOut: 'सुरक्षित लॉगआउट',
    cyberCommand: 'साइबर कमान केंद्र',
    backToPortal: 'मेरे कार्यक्षेत्र पर वापस जाएं',
    offlineMode: 'ऑफ़लाइन क्षेत्र मोड',

    // Actions & Buttons
    btnRegisterCase: '+ पुलिस मामला दर्ज करें (एफआईआर)',
    btnSeizeEvidence: '+ साक्ष्य जब्त एवं सील करें',
    btnSection65B: 'धारा 65B इलेक्ट्रॉनिक सूचकांक',
    btnVerifyHash: 'SHA-256 हैश सत्यापित करें',
    btnSimulateTamper: 'छेड़छाड़ परीक्षण',
    btnRestorePristine: 'मूल स्थिति बहाल करें',
    btnAckReceive: '✓ अभिरक्षा स्वीकारें एवं प्राप्त करें',
    btnBeginExam: 'परीक्षण आरंभ करें',
    btnMarkReady: '✓ रिपोर्ट तैयार चिह्नित करें',
    btnSubmitReport: 'रिपोर्ट संस्करण जमा करें',
    btnAcceptTrial: 'न्यायालय विचारण हेतु स्वीकारें',
    btnRequestClarification: 'स्पष्टीकरण मांगें',
    btnTransmitResponse: 'स्पष्टीकरण उत्तर भेजें',
    btnPrintManifest: 'न्यायिक सूचकांक प्रिंट करें',

    // Statuses
    statusOpen: 'सक्रिय',
    statusUnderInvestigation: 'अनुसंधानाधीन',
    statusPendingForensics: 'फॉरेंसिक लंबित',
    statusProsecutionReview: 'अभियोजन समीक्षा',
    statusSealed: 'सील बंद',
    statusArchived: 'अभिलेखागार',
    statusMatch: 'सत्यापित (अक्षुण्ण)',
    statusMismatch: 'छेड़छाड़ का पता चला',
    statusError: 'प्रणाली त्रुटि',
    statusDraft: 'प्रारूप',
    statusSubmitted: 'हस्तांतरित',
    statusReceived: 'प्राप्त',
    statusUnderExamination: 'परीक्षणाधीन',
    statusReportReady: 'रिपोर्ट तैयार',

    // Disclaimers & Statutory Notices
    faceAuthDisclaimer: 'क्लाइंट-साइड पहचान प्रदर्शन। यह आधार अधिनियम के तहत वैधानिक बायोमेट्रिक प्रमाणीकरण नहीं है।',
    tamperNotice: 'वास्तविक फ़ाइल बाइट्स पर हैश सत्यापन। क्रिप्टोग्राफिक बहीखाता साक्ष्य की अखंडता सुनिश्चित करता है।',
    bsaSection65BNotice: 'भारतीय साक्ष्य कानून धारा 65B / भारतीय साक्ष्य अधिनियम 2023 धारा 63 के तहत आवश्यक सत्यता प्रमाण सुरक्षित।',
  },
} as const;

let currentLang: SupportedLanguage = 'en';
const listeners: Array<(lang: SupportedLanguage) => void> = [];

export function getLanguage(): SupportedLanguage {
  return currentLang;
}

export function setLanguage(lang: SupportedLanguage): void {
  currentLang = lang;
  listeners.forEach((fn) => fn(lang));
}

export function subscribeLanguage(fn: (lang: SupportedLanguage) => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function t(key: keyof typeof TRANSLATIONS['en']): string {
  return TRANSLATIONS[currentLang][key] || TRANSLATIONS['en'][key] || String(key);
}
