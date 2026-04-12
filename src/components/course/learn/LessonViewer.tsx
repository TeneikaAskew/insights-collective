// ABOUTME: Renders a single content_item (lesson) for the learner.
// ABOUTME: Replaces the 100-line type switch in CanvasModuleDetail and adds lesson-level Prev/Next + Mark done.

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
}

export function LessonViewer({
  item,
  prevItem,
  nextItem,
  isCompleted = false,
  onNavigate,
  onMarkDone,
  actionBasePath,
}: LessonViewerProps) {
  const navigate = useNavigate();

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
              <Badge variant="outline">{item.type}</Badge>
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
        {(item.type === 'page' || item.type === 'assignment' || item.type === 'quiz') && (
          <div className="prose prose-lg max-w-none">
            <UnifiedCanvasEditor
              content={item.content || ''}
              onChange={() => {}}
              readOnly={true}
            />
          </div>
        )}

        {/* Assignment metadata + submit CTA */}
        {item.type === 'assignment' && item.assignment && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assignment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Points Possible:</span>
                <span>{item.assignment.points_possible || 'Not graded'}</span>
              </div>
              {item.assignment.submission_types?.length ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submission Types:</span>
                  <span>{item.assignment.submission_types.join(', ')}</span>
                </div>
              ) : null}
              <div className="pt-4">
                <Button
                  className="w-full"
                  onClick={() => navigate(`${actionBasePath}/assignments/${item.id}/submit`)}
                >
                  Submit Assignment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quiz metadata + take-quiz CTA */}
        {item.type === 'quiz' && item.quiz && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quiz Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Questions:</span>
                <span>{item.quiz.questions?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time Limit:</span>
                <span>{item.quiz.time_limit ? `${item.quiz.time_limit} minutes` : 'No limit'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attempts Allowed:</span>
                <span>{item.quiz.allowed_attempts}</span>
              </div>
              <div className="pt-4">
                <Button
                  className="w-full"
                  onClick={() => navigate(`${actionBasePath}/quizzes/${item.id}`)}
                >
                  Take Quiz
                </Button>
              </div>
            </CardContent>
          </Card>
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

        {/* Lesson-level Prev / Mark done / Next footer */}
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
            variant={isCompleted ? 'secondary' : 'default'}
            onClick={() => onMarkDone(item.id)}
            disabled={isCompleted}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {isCompleted ? 'Completed' : 'Mark as done'}
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
      </CardContent>
    </Card>
  );
}

export default LessonViewer;
