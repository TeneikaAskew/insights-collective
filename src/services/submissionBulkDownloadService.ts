// ABOUTME: Collects every file students uploaded for one assignment (a week/module's
// ABOUTME: grading view) into a single zip, auditing each file read on the way.
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';
import { recordSubmissionFileAccess } from '@/services/submissionAuditService';

const logger = createLogger('submissionBulkDownload');

const BUCKET = 'course-documents';

export interface BulkDownloadStudent {
  /** assignment_submissions.id */
  submissionId: string;
  /** Display name used for the folder inside the zip. */
  studentName: string;
}

export interface BulkAttachmentRow {
  id: string;
  submission_id: string;
  filename: string;
  size: number | null;
  url: string;
}

export interface BulkDownloadResult {
  blob: Blob;
  filename: string;
  fileCount: number;
  studentCount: number;
  /** Files that could not be read; the zip still contains everything else. */
  failures: Array<{ studentName: string; filename: string; reason: string }>;
}

/** Filesystem-safe segment for a zip folder or entry name. */
export function safeSegment(name: string, fallback: string): string {
  const cleaned = (name || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return cleaned || fallback;
}

/**
 * Read the attachment rows for a set of submissions. RLS already limits this to
 * course staff, so an instructor of another course sees nothing rather than an
 * error.
 */
export async function fetchAttachmentsForSubmissions(
  submissionIds: string[],
): Promise<BulkAttachmentRow[]> {
  if (submissionIds.length === 0) return [];
  const { data, error } = await supabase
    .from('submission_attachments')
    .select('id, submission_id, filename, size, url')
    .in('submission_id', submissionIds)
    .order('created_at', { ascending: true });
  if (error) {
    logger.error('Failed to load attachments for bulk download', error);
    throw error;
  }
  return (data as BulkAttachmentRow[]) || [];
}

/**
 * Download every attachment for the given submissions and zip them, one folder
 * per student. Each file read is recorded in the submission audit trail exactly
 * as a single download is, so a bulk grab is not a blind spot.
 *
 * A file that cannot be read is reported in `failures` instead of aborting the
 * whole archive — one bad object should not cost a grader every other file.
 */
export async function buildSubmissionAttachmentsZip(
  students: BulkDownloadStudent[],
  options: { archiveName: string; onProgress?: (done: number, total: number) => void } = {
    archiveName: 'submissions',
  },
): Promise<BulkDownloadResult> {
  const byId = new Map(students.map((s) => [s.submissionId, s]));
  const attachments = await fetchAttachmentsForSubmissions(students.map((s) => s.submissionId));

  const zip = new JSZip();
  const failures: BulkDownloadResult['failures'] = [];
  const usedNames = new Set<string>();
  const studentsWithFiles = new Set<string>();
  let added = 0;

  for (let i = 0; i < attachments.length; i += 1) {
    const att = attachments[i];
    const student = byId.get(att.submission_id);
    const studentName = student?.studentName || 'Unknown student';
    const folder = safeSegment(studentName, 'Unknown student');
    const base = safeSegment(att.filename, `file-${i + 1}`);
    let entry = `${folder}/${base}`;
    let dedupe = 1;
    while (usedNames.has(entry)) {
      const dot = base.lastIndexOf('.');
      const stem = dot > 0 ? base.slice(0, dot) : base;
      const ext = dot > 0 ? base.slice(dot) : '';
      entry = `${folder}/${stem} (${dedupe})${ext}`;
      dedupe += 1;
    }

    // The audit row is written before the bytes are fetched: an attempt that
    // then fails is still an attempt on the record.
    void recordSubmissionFileAccess({
      submissionId: att.submission_id,
      action: 'file_downloaded',
      attachmentId: att.id,
      filename: att.filename,
    });

    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(att.url);
      if (error || !data) throw error || new Error('The file could not be read.');
      zip.file(entry, data);
      usedNames.add(entry);
      studentsWithFiles.add(att.submission_id);
      added += 1;
    } catch (e: any) {
      logger.error('Bulk download skipped a file', { file: att.url, error: e });
      failures.push({
        studentName,
        filename: att.filename,
        reason: e?.message || 'The file could not be read.',
      });
    }
    options.onProgress?.(i + 1, attachments.length);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return {
    blob,
    filename: `${safeSegment(options.archiveName, 'submissions')}.zip`,
    fileCount: added,
    studentCount: studentsWithFiles.size,
    failures,
  };
}

/** Hand the built archive to the browser as a download. */
export function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export default { buildSubmissionAttachmentsZip, fetchAttachmentsForSubmissions, saveBlob, safeSegment };
