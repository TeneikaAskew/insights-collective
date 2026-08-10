// ABOUTME: Inline assignment submission form + rubric-based feedback viewer shown inside a module lesson.
// ABOUTME: Persists to public.assignment_submissions and renders assignment rubric criteria with instructor scores/comments.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send, CheckCircle2, AlertCircle, Paperclip, X, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFileUpload } from '@/hooks/useFileUpload';
import CourseErrorState from '@/components/course/CourseErrorState';
import type { ContentItem, Assignment } from '@/types/canvas';


interface Props {
  item: ContentItem;
  assignment: Assignment;
  onCompleted?: (itemId: string) => void | Promise<void>;
}

type RubricCriterion = {
  id: string;
  title: string;
  description: string | null;
  points: number;
  order_index: number;
  levels: Array<{ name?: string; points?: number; description?: string }> | null;
};

type RubricScore = { points?: number; level?: string; comment?: string };

type AttachmentRow = {
  id: string;
  filename: string;
  content_type: string | null;
  size: number | null;
  url: string;
};

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;


export function InlineAssignmentSubmit({ item, assignment, onCompleted }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  // Load ERROR for the submission/rubric-link queries: the form must not
  // render (a failed submission lookup would otherwise cause a duplicate
  // insert with a wrong attempt number).
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [rubricError, setRubricError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<any>(null);
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  // Files chosen but not yet uploaded — they are uploaded on submit, because an
  // attachment row needs the submission id.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const { uploadFile, uploading } = useFileUpload();

  const submissionTypes = assignment.submission_types || ['online_text_entry'];
  const acceptsText = submissionTypes.includes('online_text_entry');
  const acceptsUrl = submissionTypes.includes('online_url');
  const acceptsFiles =
    submissionTypes.includes('online_upload') || submissionTypes.includes('file_upload');
  // No configured limit means unlimited attempts — do not invent a policy.
  const maxAttempts: number | null = (assignment as any).max_attempts ?? null;


  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      setLoadError(null);
      setRubricError(false);
      const [subRes, rubricRes] = await Promise.all([
        supabase
          .from('assignment_submissions')
          .select('*')
          .eq('assignment_id', assignment.id)
          .eq('user_id', user.id)
          .order('attempt', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('assignment_rubrics')
          .select('rubric_id')
          .eq('assignment_id', assignment.id),
      ]);
      if (cancelled) return;
      const firstError = subRes.error ?? rubricRes.error;
      if (firstError) {
        setLoadError(new Error(firstError.message));
        setLoading(false);
        return;
      }
      const sub = subRes.data;
      setSubmission(sub || null);
      if (sub) {
        setBody(sub.body || '');
        setUrl(sub.url || '');
        const { data: files } = await supabase
          .from('submission_attachments')
          .select('id, filename, content_type, size, url')
          .eq('submission_id', sub.id)
          .order('created_at', { ascending: true });
        if (!cancelled) setAttachments((files as AttachmentRow[]) || []);
      } else {
        setAttachments([]);
      }

      const rubricId = rubricRes.data?.[0]?.rubric_id;
      if (rubricId) {
        const { data: crit, error: critError } = await supabase
          .from('rubric_criteria')
          .select('*')
          .eq('rubric_id', rubricId)
          .order('order_index', { ascending: true });
        if (!cancelled) {
          if (critError) {
            // Rubric details are supplementary — surface an inline notice
            // instead of silently hiding the rubric.
            setRubricError(true);
            setCriteria([]);
          } else {
            setCriteria((crit as any) || []);
          }
        }
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [user?.id, assignment.id, reloadKey]);

  const isGraded = submission?.workflow_state === 'graded';
  const isSubmitted = submission?.workflow_state === 'submitted' || isGraded;
  const attemptsUsed = submission?.attempt ?? 0;
  const canResubmit = !isGraded && (maxAttempts == null || attemptsUsed < maxAttempts);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: File[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast({
          title: 'File too large',
          description: `${f.name} exceeds the 25 MB limit.`,
          variant: 'destructive',
        });
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length) setPendingFiles((prev) => [...prev, ...accepted]);
  };

  const removeAttachment = async (attachmentId: string) => {
    const { error } = await supabase
      .from('submission_attachments')
      .delete()
      .eq('id', attachmentId);
    if (error) {
      toast({ title: 'Could not remove file', description: error.message, variant: 'destructive' });
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  // Attachment rows store the object path; the buckets are private so a URL is
  // signed at click time with the viewer's session.
  const openAttachment = async (att: AttachmentRow) => {
    const { data, error } = await supabase.storage
      .from('course-documents')
      .createSignedUrl(att.url, 60 * 10);
    if (error || !data?.signedUrl) {
      toast({
        title: 'Could not open file',
        description: error?.message || 'The file link could not be created.',
        variant: 'destructive',
      });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async () => {
    if (!user) return;
    const hasContent =
      body.trim() || url.trim() || pendingFiles.length > 0 || attachments.length > 0;
    if (!hasContent) {
      toast({ title: 'Add a response or a file before submitting', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const nextAttempt = (attemptsUsed || 0) + 1;
      const payload: any = {
        assignment_id: assignment.id,
        user_id: user.id,
        body: body.trim() || null,
        url: url.trim() || null,
        submission_type:
          acceptsFiles && (pendingFiles.length > 0 || attachments.length > 0)
            ? 'online_upload'
            : acceptsUrl && url.trim()
              ? 'online_url'
              : 'online_text_entry',
        submitted_at: new Date().toISOString(),
        workflow_state: 'submitted',
        attempt: nextAttempt,
      };
      let saved: any = null;
      if (submission?.id && submission.workflow_state !== 'graded') {
        const { data, error } = await supabase
          .from('assignment_submissions')
          .update(payload)
          .eq('id', submission.id)
          .select()
          .single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from('assignment_submissions')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        saved = data;
      }
      setSubmission(saved);

      // Upload attachments only after the submission row exists — the RLS
      // policy on submission_attachments checks ownership through it.
      if (pendingFiles.length > 0) {
        const rows: Array<Omit<AttachmentRow, 'id'> & { submission_id: string }> = [];
        for (const file of pendingFiles) {
          const uploaded = await uploadFile(file, 'course-documents', item.course_id, {
            submissionUserId: user.id,
          });
          if (!uploaded) throw new Error(`Failed to upload ${file.name}`);
          rows.push({
            submission_id: saved.id,
            filename: file.name,
            content_type: file.type || null,
            size: file.size,
            url: uploaded.path,
          });
        }
        const { data: inserted, error: attError } = await supabase
          .from('submission_attachments')
          .insert(rows)
          .select('id, filename, content_type, size, url');
        if (attError) throw attError;
        setAttachments((prev) => [...prev, ...((inserted as AttachmentRow[]) || [])]);
        setPendingFiles([]);
      }

      toast({ title: 'Assignment submitted', description: 'Your instructor will review it shortly.' });
      await onCompleted?.(item.id);
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading assignment…
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <CourseErrorState
        title="Couldn't load your submission"
        error={loadError}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  const rubricScores: Record<string, RubricScore> = (submission?.rubric_scores as any) || {};

  return (
    <div className="space-y-4">
      {isSubmitted && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            {isGraded ? 'Graded' : 'Submitted'}
            {maxAttempts != null ? <> · Attempt {attemptsUsed} of {maxAttempts}</> : <> · Attempt {attemptsUsed}</>}
            {typeof submission.score === 'number' && (
              <> · Score {submission.score}{assignment.points_possible ? ` / ${assignment.points_possible}` : ''}</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {rubricError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Rubric unavailable — we couldn't load the rubric for this assignment.
          </AlertDescription>
        </Alert>
      )}

      {/* Rubric-based feedback (shown after grading) */}
      {isGraded && criteria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rubric feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criteria.map((c) => {
              const score = rubricScores[c.id];
              return (
                <div key={c.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{c.title}</p>
                      {c.description && (
                        <p className="text-sm text-muted-foreground">{c.description}</p>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {score?.points ?? '—'} / {c.points}
                    </Badge>
                  </div>
                  {score?.level && (
                    <p className="mt-2 text-sm"><span className="text-muted-foreground">Level: </span>{score.level}</p>
                  )}
                  {score?.comment && (
                    <p className="mt-2 text-sm text-foreground">{score.comment}</p>
                  )}
                </div>
              );
            })}
            {submission?.grader_comments && (
              <div className="rounded-md bg-muted/60 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Instructor comments</p>
                <p>{submission.grader_comments}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isGraded && criteria.length === 0 && submission?.grader_comments && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Instructor feedback</CardTitle></CardHeader>
          <CardContent className="text-sm text-foreground">{submission.grader_comments}</CardContent>
        </Card>
      )}

      {/* Submission form */}
      {(!isGraded) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isSubmitted ? 'Update your submission' : 'Submit your work'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {acceptsText && (
              <div>
                <label className="text-sm font-medium">Response</label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your response here…"
                  rows={6}
                  maxLength={20000}
                  disabled={submitting || !canResubmit}
                />
              </div>
            )}
            {acceptsUrl && (
              <div>
                <label className="text-sm font-medium">Link</label>
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  maxLength={500}
                  disabled={submitting || !canResubmit}
                />
              </div>
            )}
            {!canResubmit ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {maxAttempts != null
                    ? `You've reached the maximum of ${maxAttempts} attempts.`
                    : 'This assignment is not accepting further submissions.'}
                </AlertDescription>
              </Alert>
            ) : (
              <Button onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {isSubmitted ? 'Resubmit' : 'Submit assignment'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default InlineAssignmentSubmit;
