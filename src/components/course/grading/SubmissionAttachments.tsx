// ABOUTME: Lists files a student uploaded with a submission so graders can preview,
// ABOUTME: download, and start a comment about a specific file inside the grader.
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';
import {
  FileText,
  Download,
  Eye,
  MessageSquarePlus,
  Paperclip,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const logger = createLogger('submissionAttachments');

export interface SubmissionAttachmentRow {
  id: string;
  filename: string;
  content_type: string | null;
  size: number | null;
  url: string;
  created_at?: string | null;
}

interface SubmissionAttachmentsProps {
  submissionId: string;
  /** Optional hook so the grader can seed a comment about a specific file. */
  onCommentOnFile?: (filename: string) => void;
}

const BUCKET = 'course-documents';
const SIGNED_URL_TTL = 60 * 10;

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

const isPreviewable = (att: SubmissionAttachmentRow) => {
  const type = att.content_type || '';
  if (type.startsWith('image/') || type === 'application/pdf') return true;
  return /\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(att.filename);
};

const isImage = (att: SubmissionAttachmentRow) =>
  (att.content_type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.filename);

export function SubmissionAttachments({ submissionId, onCommentOnFile }: SubmissionAttachmentsProps) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<SubmissionAttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      setPreviewId(null);
      setPreviewUrl(null);
      const { data, error } = await supabase
        .from('submission_attachments')
        .select('id, filename, content_type, size, url, created_at')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        logger.error('Failed to load submission attachments', error);
        setLoadError(error.message);
        setAttachments([]);
      } else {
        setAttachments((data as SubmissionAttachmentRow[]) || []);
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  // Buckets are private, so every read is signed with the grader's own session;
  // storage RLS grants course staff access to submissions/<courseId>/<userId>/…
  const signUrl = useCallback(
    async (att: SubmissionAttachmentRow): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(att.url, SIGNED_URL_TTL);
      if (error || !data?.signedUrl) {
        toast({
          title: 'Could not open file',
          description: error?.message || 'The file link could not be created.',
          variant: 'destructive',
        });
        return null;
      }
      return data.signedUrl;
    },
    [toast],
  );

  // Non-image previews are framed, and the app's CSP frame-src allows only
  // 'self', blob: and the video hosts — so a Supabase signed URL in an <iframe>
  // is refused by the browser and the pane renders blank in production, not just
  // in headless Chromium. The bytes are therefore fetched with the grader's own
  // session and framed as a blob: URL, which needs no CSP change.
  const togglePreview = async (att: SubmissionAttachmentRow) => {
    if (previewId === att.id) {
      setPreviewId(null);
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    setBusyId(att.id);
    try {
      let url: string | null;
      if (isImage(att)) {
        url = await signUrl(att);
      } else {
        const { data, error } = await supabase.storage.from(BUCKET).download(att.url);
        if (error || !data) throw error || new Error('The file could not be opened.');
        url = URL.createObjectURL(data);
      }
      if (!url) return;
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      setPreviewId(att.id);
      setPreviewUrl(url);
    } catch (e: any) {
      logger.error('Attachment preview failed', e);
      toast({
        title: 'Could not open file',
        description: e?.message || 'The file could not be previewed.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };


  const openInTab = async (att: SubmissionAttachmentRow) => {
    setBusyId(att.id);
    const signed = await signUrl(att);
    setBusyId(null);
    if (signed) window.open(signed, '_blank', 'noopener,noreferrer');
  };

  const download = async (att: SubmissionAttachmentRow) => {
    setBusyId(att.id);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(att.url);
      if (error || !data) throw error || new Error('File could not be downloaded.');
      const href = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = href;
      link.download = att.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (e: any) {
      logger.error('Attachment download failed', e);
      toast({
        title: 'Download failed',
        description: e?.message || 'The file could not be downloaded.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="h-16 rounded-lg border bg-muted/40 animate-pulse" aria-label="Loading files" />
    );
  }

  if (loadError) {
    return (
      <p className="text-sm text-destructive">Could not load uploaded files: {loadError}</p>
    );
  }

  if (attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Uploaded files
        <Badge variant="secondary">{attachments.length}</Badge>
      </h4>
      <ul className="divide-y rounded-lg border">
        {attachments.map((att) => {
          const busy = busyId === att.id;
          const open = previewId === att.id;
          return (
            <li key={att.id} className="p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{att.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {[att.content_type, formatFileSize(att.size)].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isPreviewable(att) ? (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => togglePreview(att)}>
                      {open ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                      {open ? 'Hide' : 'Preview'}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => openInTab(att)}>
                      <Eye className="h-4 w-4 mr-1" /> Open
                    </Button>
                  )}
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => download(att)}>
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                  {onCommentOnFile && (
                    <Button variant="ghost" size="sm" onClick={() => onCommentOnFile(att.filename)}>
                      <MessageSquarePlus className="h-4 w-4 mr-1" /> Comment
                    </Button>
                  )}
                </div>
              </div>
              {open && previewUrl && (
                <div className="rounded-md border overflow-hidden bg-muted/40">
                  {isImage(att) ? (
                    <img src={previewUrl} alt={`Preview of ${att.filename}`} className="max-h-[520px] w-auto mx-auto" />
                  ) : (
                    <iframe src={previewUrl} title={`Preview of ${att.filename}`} className="w-full h-[520px]" />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SubmissionAttachments;
