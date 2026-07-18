// ABOUTME: Renders a single content_item (lesson) for the learner.
// ABOUTME: Replaces the 100-line type switch in CanvasModuleDetail and adds lesson-level Prev/Next + Mark done.

import { useEffect, useRef, useState } from 'react';
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
  onMarkDone: (itemId: string) => void | Promise<void>;
  /** Base path used for Submit/Take-quiz buttons, e.g. `/courses/:courseId/learn/:moduleId`. */
  actionBasePath: string;
  /** When true, hide the internal Prev/Mark done/Next footer (parent renders its own). */
  hideFooter?: boolean;
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
}: LessonViewerProps) {
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const autoCompletedRef = useRef<string | null>(null);
  const [autoCompleted, setAutoCompleted] = useState(false);

  // Auto-mark content as complete when user scrolls to bottom (non-quiz items only)
  useEffect(() => {
    if (!item || item.type === 'quiz' || isCompleted) return;
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
              key={item.id}
              content={item.content}
              onChange={() => {}}
              readOnly={true}
              minHeight="auto"
            />
          </div>
        )}

        {/* Assignment metadata + submit CTA */}
        {item.type === 'assignment' && item.assignment && (
          <InlineAssignmentSubmit item={item} assignment={item.assignment} onCompleted={onMarkDone} />
        )}

        {/* Quiz player */}
        {item.type === 'quiz' && item.quiz && (
          <InlineQuizPlayer item={item} quiz={item.quiz} onCompleted={onMarkDone} />
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
        {item.type !== 'quiz' && <div ref={sentinelRef} className="h-1" aria-hidden />}

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
              onClick={() => onMarkDone(item.id)}
              disabled={isCompleted || autoCompleted}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {isCompleted || autoCompleted ? 'Completed' : 'Mark as done'}
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
