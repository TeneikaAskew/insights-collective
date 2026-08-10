// ABOUTME: Instructor grading interface (SpeedGrader). Polished for speed:
// ABOUTME: filter tabs, search, keyboard shortcuts, quick-fill grades, sticky save bar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import CourseErrorState from '@/components/course/CourseErrorState';
import { withCoursePermission } from '@/components/course/withCoursePermission';
import { SubmissionComments } from '@/components/course/grading/SubmissionComments';
import { SubmissionAttachments } from '@/components/course/grading/SubmissionAttachments';
import {
  CheckCircle,
  Save,
  ChevronLeft,
  ChevronRight,
  User,
  Search,
  Keyboard,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import type { ContentItem, AssignmentSubmission } from '@/types/canvas';
import { createLogger } from '@/utils/logger';
import { Hint } from '@/components/ui/hint';
import { formatProfileName } from '@/lib/utils';

const logger = createLogger('gradingSubmissions');

interface GradingSubmission extends AssignmentSubmission {
  user: { id: string; first_name: string | null; last_name: string | null; avatar_url?: string | null };
  grader_comments?: string;
  graded_at?: string;
}

type FilterKey = 'needs' | 'graded' | 'all';

function CanvasGradingInterface() {
  const { courseId, contentItemId } = useParams();
  const { toast } = useToast();

  const [contentItem, setContentItem] = useState<ContentItem | null>(null);
  const [submissions, setSubmissions] = useState<GradingSubmission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('needs');
  const [search, setSearch] = useState('');
  const [commentSeed, setCommentSeed] = useState<{ text: string; nonce: number } | undefined>();


  const [grade, setGrade] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const gradeInputRef = useRef<HTMLInputElement>(null);

  const pointsPossible = contentItem?.assignment?.points_possible ?? 100;

  useEffect(() => { loadGradingData(); }, [contentItemId]);

  const loadGradingData = async () => {
    if (!contentItemId) return;
    try {
      setLoading(true);
      setLoadError(null);
      const item = await CanvasContentService.getContentItem(contentItemId);
      if (!item || item.type !== 'assignment') throw new Error('Assignment not found');
      setContentItem(item);

      const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`*, user:profiles!user_id (id, first_name, last_name, avatar_url)`)
        .eq('assignment_id', item.assignment?.id)
        .order('submitted_at', { ascending: false });
      if (error) throw error;

      const gs = (data || []).map((sub: any) => ({
        ...sub,
        user: sub.user || { id: sub.user_id, first_name: null, last_name: null },
      }));
      setSubmissions(gs);
      const firstNeeds = gs.find((s) => s.workflow_state !== 'graded') || gs[0];
      setSelectedId(firstNeeds?.id ?? null);
    } catch (e: any) {
      logger.error('Error loading grading data:', e);
      setLoadError(e?.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  const selectedSubmission = useMemo(
    () => submissions.find((s) => s.id === selectedId) ?? null,
    [submissions, selectedId],
  );

  useEffect(() => {
    if (selectedSubmission) {
      setGrade(selectedSubmission.grade?.toString() ?? '');
      setFeedback(selectedSubmission.grader_comments || '');
    } else {
      setGrade('');
      setFeedback('');
    }
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (filter === 'needs' && s.workflow_state === 'graded') return false;
      if (filter === 'graded' && s.workflow_state !== 'graded') return false;
      if (q && !formatProfileName(s.user).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [submissions, filter, search]);

  const counts = useMemo(() => {
    const graded = submissions.filter((s) => s.workflow_state === 'graded').length;
    return { total: submissions.length, graded, needs: submissions.length - graded };
  }, [submissions]);

  const currentIndex = filtered.findIndex((s) => s.id === selectedId);

  const goTo = useCallback(
    (delta: number) => {
      if (filtered.length === 0) return;
      const base = currentIndex === -1 ? 0 : currentIndex;
      const next = Math.max(0, Math.min(filtered.length - 1, base + delta));
      setSelectedId(filtered[next].id);
    },
    [filtered, currentIndex],
  );

  const handleGradeSubmit = useCallback(
    async (advance = true) => {
      if (!selectedSubmission || !contentItem?.assignment) return;
      const gradeNum = parseFloat(grade);
      if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > pointsPossible) {
        toast({
          title: 'Invalid grade',
          description: `Enter a value between 0 and ${pointsPossible}.`,
          variant: 'destructive',
        });
        return;
      }
      try {
        setSaving(true);
        const { error } = await supabase
          .from('assignment_submissions')
          .update({
            // assignment_submissions has no grader_id column; grader attribution
            // is modelled on grades.graded_by / grade_history.changed_by. Sending
            // it here made PostgREST reject the whole update, so saving a grade
            // failed outright.
            grade: gradeNum,
            grader_comments: feedback,
            graded_at: new Date().toISOString(),
            workflow_state: 'graded',
          })
          .eq('id', selectedSubmission.id);
        if (error) throw error;

        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === selectedSubmission.id
              ? { ...s, grade: gradeNum, grader_comments: feedback, workflow_state: 'graded', graded_at: new Date().toISOString() }
              : s,
          ),
        );
        toast({ title: 'Grade published', description: `${formatProfileName(selectedSubmission.user)}: ${gradeNum}/${pointsPossible}` });

        if (advance) {
          // Move to next ungraded in current filter view
          const remaining = filtered.filter((s) => s.id !== selectedSubmission.id && s.workflow_state !== 'graded');
          if (remaining.length > 0) setSelectedId(remaining[0].id);
          else goTo(1);
        }
      } catch (e: any) {
        logger.error('Error saving grade:', e);
        toast({ title: 'Error saving grade', description: e.message, variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    },
    [grade, feedback, selectedSubmission, contentItem, pointsPossible, filtered, toast, goTo],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGradeSubmit(true);
        return;
      }
      if (inField) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); goTo(1); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); goTo(-1); }
      else if (e.key === 'g') { e.preventDefault(); gradeInputRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goTo, handleGradeSubmit]);

  const statusPill = (s: GradingSubmission) => {
    if (s.workflow_state === 'graded')
      return <Badge className="bg-ss-good-chip text-ss-good hover:bg-ss-good-chip">Graded</Badge>;
    if (s.late) return <Badge className="bg-ss-warn-chip text-ss-warn hover:bg-ss-warn-chip">Late</Badge>;
    if (s.missing) return <Badge variant="secondary">Missing</Badge>;
    return <Badge variant="outline">Needs grading</Badge>;
  };

  const renderSubmissionContent = () => {
    if (!selectedSubmission) return null;
    switch (selectedSubmission.submission_type) {
      case 'online_text_entry':
        return (
          <div className="prose prose-lg max-w-none">
            <UnifiedCanvasEditor content={selectedSubmission.body || 'No submission'} onChange={() => {}} readOnly />
          </div>
        );
      case 'online_url':
        return (
          <div className="p-6 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Submitted URL</p>
            <a href={selectedSubmission.url || '#'} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
              {selectedSubmission.url}
            </a>
          </div>
        );
      case 'online_upload':
      default:
        // The assignment_submissions schema stores `url` and `body` — there is
        // no separate file-storage table, so render whichever the row has.
        if (selectedSubmission.url) {
          return (
            <div className="p-6 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Submitted file link</p>
              <a
                href={selectedSubmission.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all"
              >
                {selectedSubmission.url}
              </a>
            </div>
          );
        }
        if (selectedSubmission.body) {
          return (
            <div className="p-6 bg-muted rounded-lg text-sm whitespace-pre-wrap">
              {selectedSubmission.body}
            </div>
          );
        }
        return <p className="text-sm text-muted-foreground">No submission content available</p>;
    }
  };

  if (loading) {
    return (
      <CourseLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </CourseLayout>
    );
  }

  if (loadError) {
    return (
      <CourseLayout>
        <div className="max-w-3xl mx-auto py-8">
          <CourseErrorState
            title="Error loading submissions"
            error={loadError}
            onRetry={loadGradingData}
          />
        </div>
      </CourseLayout>
    );
  }

  if (!contentItem) {
    return (
      <CourseLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Assignment not found</h1>
        </div>
      </CourseLayout>
    );
  }

  const progressPct = counts.total ? Math.round((counts.graded / counts.total) * 100) : 0;

  return (
    <CourseLayout>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              to={`/courses/${courseId}/assignments`}
              className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline"
            >
              <ArrowLeft className="h-3 w-3" /> Back to assignments
            </Link>
            <h1 className="text-2xl font-bold mt-1">{contentItem.title}</h1>
            <p className="text-sm text-muted-foreground">
              {counts.graded} of {counts.total} graded • {counts.needs} still needs grading • {pointsPossible} pts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground border rounded-md px-2 py-1">
              <Keyboard className="h-3 w-3" />
              <span><kbd className="font-mono">J</kbd>/<kbd className="font-mono">K</kbd> nav • <kbd className="font-mono">G</kbd> grade • <kbd className="font-mono">⌘↵</kbd> save</span>
            </div>
            <Button variant="outline" asChild size="sm">
              <Link to={`/courses/${courseId}/gradebook`}>Gradebook</Link>
            </Button>
          </div>
        </div>

        {/* Progress strip */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Submissions list */}
          <Card className="lg:col-span-1 h-fit lg:sticky lg:top-4">
            <CardHeader className="pb-3 space-y-3">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="needs">Needs ({counts.needs})</TabsTrigger>
                  <TabsTrigger value="graded">Graded ({counts.graded})</TabsTrigger>
                  <TabsTrigger value="all">All ({counts.total})</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search student…"
                  className="pl-8 h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {filter === 'needs' ? 'All caught up 🎉' : 'No matching submissions.'}
                </div>
              ) : (
                <div className="divide-y">
                  {filtered.map((s) => {
                    const active = s.id === selectedId;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedId(s.id)}
                        className={`w-full text-left p-3 transition-colors border-l-2 ${
                          active ? 'bg-muted border-primary' : 'border-transparent hover:bg-muted/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{formatProfileName(s.user)}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {s.submitted_at ? format(new Date(s.submitted_at), 'MMM d, h:mm a') : 'Not submitted'}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {statusPill(s)}
                            {s.grade !== null && s.grade !== undefined && (
                              <span className="text-xs font-semibold tabular-nums">
                                {s.grade}/{pointsPossible}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Main grading area */}
          <Card className="lg:col-span-2">
            {selectedSubmission ? (
              <>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{formatProfileName(selectedSubmission.user)}</CardTitle>
                        {statusPill(selectedSubmission)}
                      </div>
                      <CardDescription>
                        {selectedSubmission.submitted_at
                          ? `Submitted ${format(new Date(selectedSubmission.submitted_at), "MMM d, yyyy 'at' h:mm a")}`
                          : 'Not submitted'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hint label="Previous submission (K)">
                        <Button variant="outline" size="icon" onClick={() => goTo(-1)} disabled={currentIndex <= 0} aria-label="Previous submission">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </Hint>
                      <span className="text-sm text-muted-foreground tabular-nums min-w-[70px] text-center">
                        {currentIndex === -1 ? '—' : currentIndex + 1} of {filtered.length}
                      </span>
                      <Hint label="Next submission (J)">
                        <Button variant="outline" size="icon" onClick={() => goTo(1)} disabled={currentIndex === filtered.length - 1} aria-label="Next submission">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Hint>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Submission</h3>
                    {renderSubmissionContent()}
                    <SubmissionAttachments
                      submissionId={selectedSubmission.id}
                      onCommentOnFile={(filename) =>
                        setCommentSeed({ text: `Re: ${filename} — `, nonce: Date.now() })
                      }
                    />
                  </div>


                  <div className="border-t pt-5 space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[180px]">
                        <Label htmlFor="grade">Score</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            ref={gradeInputRef}
                            id="grade"
                            type="number"
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            placeholder="0"
                            min={0}
                            max={pointsPossible}
                            className="text-lg font-semibold tabular-nums w-28"
                          />
                          <span className="text-muted-foreground">/ {pointsPossible}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground self-center mr-1">Quick:</span>
                        {[0, 0.5, 0.7, 0.85, 1].map((f) => {
                          const v = Math.round(pointsPossible * f * 100) / 100;
                          const label = f === 0 ? '0' : f === 1 ? 'Full' : `${Math.round(f * 100)}%`;
                          return (
                            <Hint key={f} label={`Fill score with ${v} / ${pointsPossible} points`}>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setGrade(String(v))}
                                className="h-8"
                              >
                                {label}
                              </Button>
                            </Hint>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="feedback">Feedback</Label>
                      <div className="mt-1">
                        <UnifiedCanvasEditor
                          content={feedback}
                          onChange={setFeedback}
                          placeholder="Give the student specific, actionable feedback…"
                          minHeight="180px"
                        />
                      </div>
                    </div>
                  </div>

                  {selectedSubmission.graded_at && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Previously graded on {format(new Date(selectedSubmission.graded_at), "MMM d, yyyy 'at' h:mm a")}
                      </AlertDescription>
                    </Alert>
                  )}

                  {selectedSubmission && (
                    <SubmissionComments
                      submissionId={selectedSubmission.id}
                      submissionType="assignment"
                    />
                  )}
                </CardContent>

                {/* Sticky save bar */}
                <div className="sticky bottom-0 border-t bg-card/95 backdrop-blur px-6 py-3 flex flex-wrap gap-2 justify-end rounded-b-lg">
                  <Button variant="outline" onClick={() => handleGradeSubmit(false)} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                  <Button onClick={() => handleGradeSubmit(true)} disabled={saving}>
                    {saving ? 'Saving…' : 'Save & next'} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            ) : (
              <CardContent className="text-center py-16">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a submission to begin grading.</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </CourseLayout>
  );
}

export default withCoursePermission(CanvasGradingInterface, { requiredRoles: ['instructor', 'admin'] });
