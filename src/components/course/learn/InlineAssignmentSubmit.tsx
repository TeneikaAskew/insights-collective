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
import { Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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

export function InlineAssignmentSubmit({ item, assignment, onCompleted }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<any>(null);
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);

  const submissionTypes = assignment.submission_types || ['online_text_entry'];
  const acceptsText = submissionTypes.includes('online_text_entry');
  const acceptsUrl = submissionTypes.includes('online_url');
  const maxAttempts = (assignment as any).max_attempts ?? 3;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      const [{ data: sub }, { data: rubricLinks }] = await Promise.all([
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
      setSubmission(sub || null);
      if (sub) {
        setBody(sub.body || '');
        setUrl(sub.url || '');
      }
      const rubricId = rubricLinks?.[0]?.rubric_id;
      if (rubricId) {
        const { data: crit } = await supabase
          .from('rubric_criteria')
          .select('*')
          .eq('rubric_id', rubricId)
          .order('order_index', { ascending: true });
        if (!cancelled) setCriteria((crit as any) || []);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [user?.id, assignment.id]);

  const isGraded = submission?.workflow_state === 'graded';
  const isSubmitted = submission?.workflow_state === 'submitted' || isGraded;
  const attemptsUsed = submission?.attempt ?? 0;
  const canResubmit = !isGraded && attemptsUsed < maxAttempts;

  const handleSubmit = async () => {
    if (!user) return;
    if (acceptsText && !body.trim() && !url.trim()) {
      toast({ title: 'Enter a response before submitting', variant: 'destructive' });
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
        submission_type: acceptsUrl && url.trim() ? 'online_url' : 'online_text_entry',
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

  const rubricScores: Record<string, RubricScore> = (submission?.rubric_scores as any) || {};

  return (
    <div className="space-y-4">
      {isSubmitted && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            {isGraded ? 'Graded' : 'Submitted'} · Attempt {attemptsUsed} of {maxAttempts}
            {typeof submission.score === 'number' && (
              <> · Score {submission.score}{assignment.points_possible ? ` / ${assignment.points_possible}` : ''}</>
            )}
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
                    <p className="mt-2 text-sm text-neutral-800">{score.comment}</p>
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
          <CardContent className="text-sm text-neutral-800">{submission.grader_comments}</CardContent>
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
                <AlertDescription>You've reached the maximum of {maxAttempts} attempts.</AlertDescription>
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
