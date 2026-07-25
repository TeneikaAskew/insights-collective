// ABOUTME: Right-pane editor for a single content_item in the course builder.
// ABOUTME: Title, type, rich editor, debounced auto-save. No modal dialogs.

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Sparkles } from 'lucide-react';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { QuizContentEditor } from '@/components/course/builder/QuizContentEditor';
import type { ContentItem, ContentItemType } from '@/types/canvas';
import { AiContentDialog, type AiContentContext } from '@/components/course/builder/AiContentDialog';

export interface LessonDraft {
  title: string;
  type: ContentItemType;
  content: string;
}

export interface LessonEditorPaneProps {
  item: ContentItem | null;
  /** Debounce window (ms) before firing onSave after a change. */
  autoSaveDelayMs?: number;
  onSave: (itemId: string, draft: LessonDraft) => Promise<void> | void;
  onDelete?: (itemId: string) => void;
  onSavingChange?: (saving: boolean) => void;
  /** Optional context that gives the AI generator richer prompts. */
  aiContext?: Omit<AiContentContext, 'lessonTitle' | 'lessonType'>;
}

const LESSON_TYPES: { value: ContentItemType; label: string }[] = [
  { value: 'page', label: 'Page' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'external_url', label: 'External Link' },
];

export function LessonEditorPane({
  item,
  autoSaveDelayMs = 800,
  onSave,
  onDelete,
  onSavingChange,
  aiContext,
}: LessonEditorPaneProps) {
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [aiOpen, setAiOpen] = useState(false);


  const savedSnapshotRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate the draft when the selected item changes.
  useEffect(() => {
    if (!item) {
      setDraft(null);
      savedSnapshotRef.current = '';
      return;
    }
    const next: LessonDraft = {
      title: item.title,
      type: item.type,
      content: item.content ?? '',
    };
    setDraft(next);
    savedSnapshotRef.current = JSON.stringify(next);
  }, [item?.id]);

  // Debounced auto-save whenever the draft changes.
  useEffect(() => {
    if (!item || !draft) return;
    const serialized = JSON.stringify(draft);
    if (serialized === savedSnapshotRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      onSavingChange?.(true);
      try {
        await onSave(item.id, draft);
        savedSnapshotRef.current = serialized;
      } finally {
        onSavingChange?.(false);
      }
    }, autoSaveDelayMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, item?.id, autoSaveDelayMs, onSave, onSavingChange]);

  if (!item || !draft) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full py-24 text-muted-foreground">
          Select a lesson from the curriculum on the left, or add a new one.
        </CardContent>
      </Card>
    );
  }

  const setField = <K extends keyof LessonDraft>(key: K, value: LessonDraft[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <Card className="h-full">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="lesson-title">Title</Label>
            <Input
              id="lesson-title"
              value={draft.title}
              placeholder="Untitled lesson"
              onChange={(e) => setField('title', e.target.value)}
            />
          </div>
          <div className="space-y-2 w-48">
            <Label htmlFor="lesson-type">Type</Label>
            <Select
              value={draft.type}
              onValueChange={(v) => setField('type', v as ContentItemType)}
            >
              <SelectTrigger id="lesson-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LESSON_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="mt-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(item.id)}
              aria-label="Delete lesson"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {draft.type === 'quiz' ? (
          <div className="space-y-2">
            <Label>Quiz questions</Label>
            <QuizContentEditor key={`quiz-${item.id}`} contentItemId={item.id} />
            <div className="pt-4 space-y-2">
              <Label>Instructions (optional)</Label>
              <UnifiedCanvasEditor
                key={`instructions-${item.id}`}
                content={draft.content}
                onChange={(content) => setField('content', content)}
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
            <UnifiedCanvasEditor
              key={`content-${item.id}`}
              content={draft.content}
              onChange={(content) => setField('content', content)}
              placeholder="Start writing your lesson…"
              minHeight="320px"
            />
          </div>
        )}

        <AiContentDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          existingContent={draft.content || ''}
          context={{
            lessonTitle: draft.title,
            lessonType: draft.type,
            ...(aiContext || {}),
          }}
          onApply={(html, mode) => {
            const existing = (draft.content || '').replace(/<p>\s*<\/p>/gi, '').trim();
            const next = mode === 'append' && existing ? `${existing}\n${html}` : html;
            setField('content', next);
          }}
        />


      </CardContent>
    </Card>
  );
}

export default LessonEditorPane;
