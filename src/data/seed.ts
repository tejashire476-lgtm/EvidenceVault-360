// ============================================================================
// Repeatable Synthetic Seed Data Generator
// Synthetic demonstration data only — Never real law enforcement / citizen data
// ============================================================================

import type { EvidenceVaultDatabase } from './db.ts';
import type { User, Case, EvidenceRecord, EvidenceFileVersion, EvidenceHandoff } from '../types.ts';
import { globalStorageEngine } from '../utils/storage.ts';

export const getDemoUsers = (): User[] => [
  {
    id: 'USR-POLICE-01',
    display_name: 'Inspector Vikram Rathore (DFIR Unit)',
    role: 'POLICE_INVESTIGATOR',
    active_status: 'ACTIVE',
    created_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'USR-FORENSIC-01',
    display_name: 'Senior Analyst Maya Lin (Digital Forensics Lab)',
    role: 'FORENSIC_EXAMINER',
    active_status: 'ACTIVE',
    created_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'USR-PROSECUTOR-01',
    display_name: 'Advocate Rajesh Mehta (Public Prosecutor)',
    role: 'PUBLIC_PROSECUTOR',
    active_status: 'ACTIVE',
    created_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'USR-ADMIN-01',
    display_name: 'Security Admin Console',
    role: 'SYSTEM_ADMIN',
    active_status: 'ACTIVE',
    created_at: '2026-09-01T08:00:00.000Z',
  },
];

export const DEMO_USERS: User[] = getDemoUsers();

export const DEMO_CASE_01: Omit<Case, 'created_at' | 'updated_at'> = {
  id: 'CASE-2026-001',
  case_reference: 'EV-CASE-2026-001',
  title: 'Financial Ledger Exfiltration Inquiry',
  category: 'Cyber Financial Crime',
  incident_date: '2026-09-11T14:30:00.000Z',
  assigned_officer_id: 'USR-POLICE-01',
  status: 'UNDER_INVESTIGATION',
  created_by: 'USR-POLICE-01',
};

export const DEMO_EVIDENCE_01: Omit<EvidenceRecord, 'created_at'> = {
  id: 'EVD-2026-001',
  case_id: 'CASE-2026-001',
  description: 'Bit-stream forensic image of suspect accounting file server NVMe drive (SRV-FIN-02)',
  evidence_type: 'DISK_IMAGE',
  source_description: 'On-premise rackmount server enclosure, Room 402, Headquarters',
  collected_by: 'USR-POLICE-01',
  collected_at: '2026-09-12T10:15:00.000Z',
  current_status: 'IN_FORENSIC_CUSTODY',
  created_by: 'USR-POLICE-01',
};

export const DEMO_FILE_VERSION_01: Omit<EvidenceFileVersion, 'created_at'> = {
  id: 'FILE-2026-001-v1',
  evidence_id: 'EVD-2026-001',
  original_filename: 'srv-fin02-nvme0n1-physical.raw',
  generated_storage_key: 'cases/CASE-2026-001/evidence/EVD-2026-001/v1/srv-fin02-nvme0n1-physical.raw',
  content_type: 'application/octet-stream',
  file_size: 549755813888, // 512 GB
  sha256_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', // 'test' hash sample
  baseline_created_at: '2026-09-12T11:45:00.000Z',
  uploaded_by: 'USR-POLICE-01',
};

export const DEMO_HANDOFF_01: EvidenceHandoff = {
  id: 'HND-2026-001',
  evidence_id: 'EVD-2026-001',
  source_department: 'POLICE',
  destination_department: 'FORENSIC',
  submitted_by: 'USR-POLICE-01',
  received_by: 'USR-FORENSIC-01',
  status: 'RECEIVED',
  submitted_at: '2026-09-12T13:00:00.000Z',
  acknowledged_at: '2026-09-12T14:30:00.000Z',
  rejection_reason: null,
};

/**
 * Seeds the database idempotently.
 * Running this function multiple times will NOT create duplicate records.
 */
export async function seedDatabase(db: EvidenceVaultDatabase): Promise<{
  usersSeeded: number;
  casesSeeded: number;
  evidenceSeeded: number;
  handoffsSeeded: number;
}> {
  let usersSeeded = 0;
  let casesSeeded = 0;
  let evidenceSeeded = 0;
  let handoffsSeeded = 0;

  // 1. Seed Users (Idempotent)
  for (const user of getDemoUsers()) {
    if (!db.getUser(user.id)) {
      db.addUser({ ...user });
      usersSeeded++;
    }
  }

  // 2. Seed Demonstration Case (Idempotent)
  if (!db.getCase(DEMO_CASE_01.id)) {
    await db.createCase(DEMO_CASE_01);
    casesSeeded++;
  }

  // 3. Seed Demonstration Evidence (Idempotent)
  if (!db.getEvidence(DEMO_EVIDENCE_01.id)) {
    await db.createEvidence(DEMO_EVIDENCE_01);
    evidenceSeeded++;

    // Add baseline file version in database
    await db.addFileVersion(DEMO_FILE_VERSION_01);

    // Seed binary object into private object store (bytes = 'test')
    globalStorageEngine.seedObject(
      DEMO_FILE_VERSION_01.generated_storage_key,
      new TextEncoder().encode('test'),
      DEMO_FILE_VERSION_01.content_type
    );

    // Add initial handoff from Police to Forensics
    await db.createHandoff(DEMO_HANDOFF_01);
    handoffsSeeded++;

    // Create baseline Forensic Report v1
    await db.createOrReviseReport({
      case_id: DEMO_CASE_01.id,
      evidence_id: DEMO_EVIDENCE_01.id,
      author_id: 'USR-FORENSIC-01',
      report_content:
        'Preliminary triage report: Disk image verified against baseline hash manifest. Accounting database tables show anomalous off-hours export activity between 02:00 and 03:30 UTC.',
      status: 'DRAFT',
    });
  }

  return { usersSeeded, casesSeeded, evidenceSeeded, handoffsSeeded };
}
