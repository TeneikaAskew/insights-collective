// ABOUTME: Renders a single content_item (lesson) for the learner.
// ABOUTME: Replaces the 100-line type switch in CanvasModuleDetail and adds lesson-level Prev/Next + Mark done.

import { useEffect, useRef, useState } from 'react';
import { isAssessedContentType, type CompletionSource } from '@/utils/progressionStates';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Calendar,
  Clock,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { format } from 'date-fns';
import type { ContentItem } from '@/types/canvas';
import { InlineQuizPlayer } from '@/components/course/learn/InlineQuizPlayer';
import { InlineAssignmentSubmit } from '@/components/course/learn/InlineAssignmentSubmit';
import { InlineDiscussionWidget } from '@/components/course/discussions/InlineDiscussionWidget';

export interface LessonViewerProps {
  item: ContentItem | null;
  /** Previous content item in the module (for the Prev button). Undefined = disabled. */
  prevItem?: ContentItem | null;
  /** Next content item in the module (for the Next button). Undefined = disabled. */
  nextItem?: ContentItem | null;
  /** Whether the current item has been marked read/completed by the learner. */
  isCompleted?: boolean;
  /** Called when user clicks Prev/Next. Receives the target item's id. */
  onNavigate: (itemId: string) => void;
  /** Called when user clicks "Mark as done". Should upsert content_item_progressions. */
  onMarkDone: (itemId: string, source?: CompletionSource) => unknown;
  /** Base path used for Submit/Take-quiz buttons, e.g. `/courses/:courseId/learn/:moduleId`. */
  actionBasePath: string;
  /** When true, hide the internal Prev/Mark done/Next footer (parent renders its own). */
  hideFooter?: boolean;
  /**
   * Whether this course allows discussion threads under lessons — the Settings
   * tab in the course builder (courses.settings.discussions.enabled).
   * Defaults to true so a course created before the setting existed keeps them.
   */
  discussionsEnabled?: boolean;
  /**
   * Signed-in learner whose watch progress the lesson's first playable video
   * reports (video_analytics). Omitted or null: videos play untracked.
   */
  watchUserId?: string | null;
}

export function LessonViewer({
  item,
  prevItem,
  nextItem,
  isCompleted = false,
  onNavigate,
  onMarkDone,
  actionBasePath,
  hideFooter = false,
  discussionsEnabled = true,
  watchUserId = null,
}: LessonViewerProps) {
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const autoCompletedRef = useRef<string | null>(null);
  const [autoCompleted, setAutoCompleted] = useState(false);

  const isAssessed = isAssessedContentType(item?.type);

  // Auto-mark informational content as complete when the user scrolls to the
  // bottom. Assignments and quizzes only complete through a real submission.
  useEffect(() => {
    if (!item || isAssessedContentType(item.type) || isCompleted) return;
    // Reset when item changes
    if (autoCompletedRef.current !== item.id) {
      setAutoCompleted(false);
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && autoCompletedRef.current !== item.id) {
          // Delay to avoid accidental triggers on fast scrolls
          timer = setTimeout(() => {
            autoCompletedRef.current = item.id;
            setAutoCompleted(true);
            void onMarkDone(item.id);
          }, 1500);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [item?.id, item?.type, isCompleted, onMarkDone]);

  if (!item) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Select an activity from the module to view its content.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="truncate">{item.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {item.assignment?.due_at && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Due {format(new Date(item.assignment.due_at), 'MMM d, yyyy')}
                </div>
              )}
              {item.quiz?.time_limit && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {item.quiz.time_limit} minutes
                </div>
              )}
              {isCompleted && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Completed
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Rendered body for page/assignment/quiz (reuses the rich-text editor read-only) */}
        {(item.type === 'page' || item.type === 'assignment' || item.type === 'quiz') && item.content && (
          <div className="prose prose-lg max-w-none">
            <UnifiedCanvasEditor
              // The tracking identity is read when the editor is created.
              key={`${item.id}:${watchUserId ?? ''}`}
              content={item.content}
              onChange={() => {}}
              readOnly={true}
              minHeight="auto"
              videoWatchTracking={watchUserId ? { userId: watchUserId, contentItemId: item.id } : null}
            />
          </div>
        )}

        {/* Assignment metadata + submit CTA */}
        {item.type === 'assignment' && item.assignment && (
          <InlineAssignmentSubmit item={item} assignment={item.assignment} onCompleted={async (id) => { await onMarkDone(id, 'submission'); }} />
        )}

        {/* Quiz player */}
        {item.type === 'quiz' && item.quiz && (
          // Forward onMarkDone's result: CourseLearn resolves false when the
          // progress write fails, and the player reports that separately from
          // the (already final) quiz submission.
          <InlineQuizPlayer item={item} quiz={item.quiz} onCompleted={(id) => onMarkDone(id, 'submission')} />
        )}

        {/* External URL */}
        {item.type === 'external_url' && (
          <div className="text-center py-8">
            <ExternalLink className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">This links to an external resource.</p>
            <Button asChild>
              <a
                href={(item.settings as any)?.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open External Link
              </a>
            </Button>
          </div>
        )}

        {/* Scroll sentinel for auto-completion */}
        {!isAssessed && <div ref={sentinelRef} className="h-1" aria-hidden />}

        {/*
          Discussion thread for this lesson.
          The widget and its service were fully built but never mounted anywhere,
          so the feature existed only in the codebase. Not shown on quizzes: the
          player is a timed, single-focus surface and a comment thread under a
          question invites exactly the wrong thing.
        */}
        {discussionsEnabled && item.type !== 'quiz' && (
          <div className="pt-6 border-t">
            <InlineDiscussionWidget contentItemId={item.id} />
          </div>
        )}

        {/* Lesson-level Prev / Mark done / Next footer */}
        {!hideFooter && (
          <div className="flex items-center justify-between gap-3 pt-4 border-t">
            <Button
              variant="outline"
              disabled={!prevItem}
              onClick={() => prevItem && onNavigate(prevItem.id)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant={isCompleted || autoCompleted ? 'secondary' : 'default'}
              onClick={() => onMarkDone(item.id, 'view')}
              disabled={isCompleted || autoCompleted || isAssessed}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {isCompleted || autoCompleted
                ? 'Completed'
                : isAssessed
                  ? 'Submit to complete'
                  : 'Mark as done'}
            </Button>
            <Button
              variant="outline"
              disabled={!nextItem}
              onClick={() => nextItem && onNavigate(nextItem.id)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LessonViewer;
