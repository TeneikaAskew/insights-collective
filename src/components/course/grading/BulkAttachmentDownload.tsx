// ABOUTME: Instructor action that zips every student-uploaded file for one
// ABOUTME: assignment (week/module) grading view and downloads it in one click.
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logger';
import {
  buildSubmissionAttachmentsZip,
  fetchAttachmentsForSubmissions,
  saveBlob,
  type BulkDownloadStudent,
} from '@/services/submissionBulkDownloadService';
import { Download, Loader2, FolderArchive } from 'lucide-react';

const logger = createLogger('bulkAttachmentDownload');

interface BulkAttachmentDownloadProps {
  /** The submissions in view, with the student name used for zip folders. */
  students: BulkDownloadStudent[];
  /** Base name of the archive, e.g. the assignment or module title. */
  archiveName: string;
}

export function BulkAttachmentDownload({ students, archiveName }: BulkAttachmentDownloadProps) {
  const { toast } = useToast();
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const submissionKey = students.map((s) => s.submissionId).sort().join(',');

  // The button only claims files exist when they do — a zero-file zip is a
  // worse answer than a disabled button that says why.
  useEffect(() => {
    let cancelled = false;
    if (students.length === 0) {
      setFileCount(0);
      return;
    }
    (async () => {
      try {
        const rows = await fetchAttachmentsForSubmissions(students.map((s) => s.submissionId));
        if (!cancelled) setFileCount(rows.length);
      } catch (e) {
        logger.error('Could not count attachments for bulk download', e);
        if (!cancelled) setFileCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionKey]);

  const run = async () => {
    setBusy(true);
    setProgress({ done: 0, total: fileCount ?? 0 });
    try {
      const result = await buildSubmissionAttachmentsZip(students, {
        archiveName,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      if (result.fileCount === 0) {
        toast({
          title: 'Nothing to download',
          description:
            result.failures.length > 0
              ? `No files could be read (${result.failures.length} failed).`
              : 'No students have uploaded files for this assignment yet.',
          variant: result.failures.length > 0 ? 'destructive' : 'default',
        });
        return;
      }
      saveBlob(result.blob, result.filename);
      toast({
        title: 'Download ready',
        description:
          `${result.fileCount} file${result.fileCount === 1 ? '' : 's'} from ` +
          `${result.studentCount} student${result.studentCount === 1 ? '' : 's'}` +
          (result.failures.length > 0 ? ` • ${result.failures.length} could not be read` : ''),
        variant: result.failures.length > 0 ? 'destructive' : 'default',
      });
    } catch (e: any) {
      logger.error('Bulk attachment download failed', e);
      toast({
        title: 'Download failed',
        description: e?.message || 'The archive could not be created.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const disabled = busy || students.length === 0 || fileCount === 0;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={run}
      disabled={disabled}
      aria-label="Download all student files as a zip"
      title={
        fileCount === 0
          ? 'No students have uploaded files for this assignment yet'
          : 'Download every uploaded file, one folder per student'
      }
    >
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          {progress && progress.total > 0 ? `Zipping ${progress.done}/${progress.total}…` : 'Zipping…'}
        </>
      ) : (
        <>
          <FolderArchive className="h-4 w-4 mr-1.5" />
          Download all files
          {fileCount ? (
            <Badge variant="secondary" className="ml-1.5">
              {fileCount}
            </Badge>
          ) : null}
          <Download className="h-3.5 w-3.5 ml-1.5 opacity-60" />
        </>
      )}
    </Button>
  );
}

export default BulkAttachmentDownload;
