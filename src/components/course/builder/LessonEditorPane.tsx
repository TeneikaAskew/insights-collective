// ABOUTME: Right-pane editor for a single content_item in the course builder.
// ABOUTME: Title and body edits go through the builder's LessonSaveQueue; save state is shown honestly.

import { useEffect, useLayoutEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Sparkles, Loader2, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { QuizContentEditor } from '@/components/course/builder/QuizContentEditor';
import type { ContentItem, ContentItemType } from '@/types/canvas';
import { AiContentDialog, type AiContentContext } from '@/components/course/builder/AiContentDialog';
import {
  useLessonSaveState,
  type LessonFields,
  type LessonSaveQueue,
  type LessonSaveSnapshot,
} from './lessonSaveQueue';

/** Fields the lesson editor can change. Type is fixed after creation. */
export type LessonDraft = LessonFields;

export interface LessonEditorPaneProps {
  item: ContentItem | null;
  /** Builder-level save coordinator; owns drafts so they outlive this pane. */
  saveQueue: LessonSaveQueue;
  onDelete?: (itemId: string) => void;
  /** Optional context that gives the AI generator richer prompts. */
  aiContext?: Omit<AiContentContext, 'lessonTitle' | 'lessonType'>;
}

const TYPE_LABELS: Record<string, string> = {
  page: 'Page',
  assignment: 'Assignment',
  quiz: 'Quiz',
  external_url: 'External Link',
};

function typeLabel(type: ContentItemType | string | undefined): string {
  return (type && TYPE_LABELS[type]) || String(type ?? 'Unknown');
}

export function LessonSaveStatusLine({
  state,
  onRetry,
  onKeepMine,
  onUseTheirs,
  onDiscardRecovered,
}: {
  state: LessonSaveSnapshot;
  onRetry: () => void;
  onKeepMine: () => void;
  onUseTheirs: () => void;
  onDiscardRecovered: () => void;
}) {
  if (state.status === 'conflict') {
    return (
      <div
        role="alert"
        data-testid="lesson-save-status"
        data-status="conflict"
        className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive flex-shrink-0" />
          <span>{state.error}</span>
        </div>
        {state.conflictWith && (
          <div className="text-xs text-muted-foreground pl-6">
            Saved version title: “{state.conflictWith.title || 'Untitled lesson'}”
          </div>
        )}
        <div className="flex flex-wrap gap-2 pl-6">
          <Button size="sm" onClick={onKeepMine}>
            Keep my version
          </Button>
          <Button size="sm" variant="outline" onClick={onUseTheirs}>
            Use the saved version
          </Button>
        </div>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div
        role="alert"
        data-testid="lesson-save-status"
        data-status="error"
        data-uncertain={state.uncertain ? 'true' : undefined}
        className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm flex flex-wrap items-center gap-2"
      >
        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
        <span className="flex-1 min-w-[12rem]">
          {state.uncertain ? (
            <>
              <strong>Save not confirmed.</strong> {state.error} Retry save checks the saved version first and
              never overwrites a change it cannot confirm.
            </>
          ) : (
            <>
              <strong>Not saved.</strong> {state.error} Your changes are still here.
            </>
          )}
          {!state.recoverable && (
            <> They are kept only while this page stays open; this browser tab cannot store them.</>
          )}
        </span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Retry save
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {state.recovered && (
        <div
          data-testid="lesson-recovered-notice"
          className="rounded-md border border-border bg-muted/50 p-3 text-sm flex flex-wrap items-center gap-2"
        >
          <span className="flex-1 min-w-[12rem]">
            Restored unsaved changes from your last visit to this lesson.
          </span>
          {state.status !== 'saving' && !state.uncertain && (
            <Button size="sm" variant="ghost" onClick={onDiscardRecovered}>
              Discard restored changes
            </Button>
          )}
        </div>
      )}
      <div
        role="status"
        aria-live="polite"
        data-testid="lesson-save-status"
        data-status={state.status}
        className="text-xs text-muted-foreground flex items-center gap-1.5"
      >
        {state.status === 'saving' && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
          </>
        )}
        {state.status === 'dirty' && <>Unsaved changes</>}
        {state.status === 'saved' && (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" /> All changes saved
          </>
        )}
      </div>
    </div>
  );
}

export function LessonEditorPane({ item, saveQueue, onDelete, aiContext }: LessonEditorPaneProps) {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiApplying, setAiApplying] = useState(false);
  const itemId = item?.id ?? null;

  // Register the lesson with the queue (idempotent; restores an unconfirmed
  // draft from a previous visit and never overwrites a dirty one).
  useLayoutEffect(() => {
    if (!item) return;
    saveQueue.track({
      id: item.id,
      title: item.title ?? '',
      content: item.content ?? '',
      updated_at: item.updated_at,
    });
  }, [itemId, saveQueue]);

  // Leaving this lesson (switching item or unmounting): send the latest draft
  // now instead of cancelling the debounce. The queue keeps the draft and any
  // failure, so it is visible again when the author comes back.
  useEffect(() => {
    if (!itemId) return;
    return () => {
      void saveQueue.flush(itemId);
    };
  }, [itemId, saveQueue]);

  const state = useLessonSaveState(saveQueue, itemId);

  if (!item || !state) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full py-24 text-muted-foreground">
          Select a lesson from the curriculum on the left, or add a new one.
        </CardContent>
      </Card>
    );
  }

  const draft = state.draft;
  const setField = <K extends keyof LessonDraft>(key: K, value: LessonDraft[K]) =>
    saveQueue.edit(item.id, { ...(saveQueue.get(item.id)?.draft ?? draft), [key]: value });
  const editorKey = `${item.id}:${state.revision}`;

  return (
    <Card className="h-full">
      <CardContent className="p-6 space-y-4">
        <LessonSaveStatusLine
          state={state}
          onRetry={() => void saveQueue.retry(item.id)}
          onKeepMine={() => void saveQueue.resolveConflict(item.id, 'keepMine')}
          onUseTheirs={() => void saveQueue.resolveConflict(item.id, 'useTheirs')}
          onDiscardRecovered={() => saveQueue.discard(item.id)}
        />
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="lesson-title">Title</Label>
            <Input
              id="lesson-title"
              value={draft.title}
              placeholder="Untitled lesson"
              onChange={(e) => setField('title', e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:w-48">
            <Label htmlFor="lesson-type">Type</Label>
            <Input
              id="lesson-type"
              value={typeLabel(item.type)}
              readOnly
              disabled
              aria-describedby="lesson-type-help"
            />
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="sm:mt-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(item.id)}
              aria-label="Delete lesson"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p id="lesson-type-help" className="text-xs text-muted-foreground -mt-2">
          The lesson type is set when the lesson is created and can't be changed yet. Quizzes and
          assignments keep their own questions, submissions and grades, and converting them is not
          supported. To use a different type, add a new lesson of that type.
        </p>

        {item.type === 'quiz' ? (
          <div className="space-y-2">
            <Label>Quiz questions</Label>
            <QuizContentEditor key={`quiz-${item.id}`} contentItemId={item.id} />
            <div className="pt-4 space-y-2">
              <Label>Instructions (optional)</Label>
              <UnifiedCanvasEditor
                key={`instructions-${editorKey}`}
                content={draft.content}
                onChange={(content) => setField('content', content)}
                courseId={item.course_id}
                placeholder="Instructions shown above the quiz…"
                minHeight="160px"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Label>Content</Label>
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="group inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 hover:border-primary/50"
                aria-label="Generate content with AI"
              >
                <Sparkles className="h-4 w-4" />
                <span>Generate content with AI</span>
              </button>
            </div>
            <div className="relative">
              <UnifiedCanvasEditor
                key={`content-${editorKey}`}
                content={draft.content}
                onChange={(content) => setField('content', content)}
                courseId={item.course_id}
                placeholder="Start writing your lesson…"
                minHeight="320px"
              />
              {aiApplying && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/70 backdrop-blur-sm">
                  <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium text-primary shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Inserting AI content…
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <AiContentDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          existingContent={draft.content || ''}
          context={{
            lessonTitle: draft.title,
            lessonType: item.type,
            ...(aiContext || {}),
          }}
          onApply={(html, mode) => {
            setAiApplying(true);
            const existing = (draft.content || '').replace(/<p>\s*<\/p>/gi, '').trim();
            const next = mode === 'append' && existing ? `${existing}\n${html}` : html;
            setField('content', next);
            // Clear the overlay once the editor has rendered the new content.
            setTimeout(() => setAiApplying(false), 700);
          }}
        />



      </CardContent>
    </Card>
  );
}

export default LessonEditorPane;
