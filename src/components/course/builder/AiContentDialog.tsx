// ABOUTME: Approval dialog for AI-generated lesson content. Streams a preview,
// ABOUTME: lets the author add feedback and regenerate (default/verbose/compact),
// ABOUTME: then Insert or Replace into the editor.

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeHTML } from '@/utils/sanitize';

export type AiVariant = 'default' | 'verbose' | 'compact';

export interface AiContentContext {
  lessonTitle: string;
  lessonType?: string;
  courseTitle?: string;
  courseDescription?: string;
  sectionTitle?: string;
  sectionSummary?: string;
  siblingLessonTitles?: string[];
}

interface AiContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current editor content — enables the Append button. */
  existingContent: string;
  context: AiContentContext;
  /** Called with the approved HTML plus whether to replace or append. */
  onApply: (html: string, mode: 'replace' | 'append') => void;
}

export function AiContentDialog({
  open,
  onOpenChange,
  existingContent,
  context,
  onApply,
}: AiContentDialogProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [variant, setVariant] = useState<AiVariant>('default');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Kick off the first generation whenever the dialog opens.
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    setHtml('');
    setFeedback('');
    setError(null);
    void generate({ nextVariant: 'default', usePrev: false, feedbackText: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function generate(opts: {
    nextVariant: AiVariant;
    usePrev: boolean;
    feedbackText: string;
  }) {
    if (!context.lessonTitle?.trim()) {
      const msg = 'Add a lesson title first — the AI uses it as the main prompt.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    setError(null);
    // Console breadcrumbs so authors can see progress in devtools.
    // eslint-disable-next-line no-console
    console.log('[AI lesson content] generating', {
      variant: opts.nextVariant,
      usePrev: opts.usePrev,
      feedback: opts.feedbackText,
      lessonTitle: context.lessonTitle,
      sectionTitle: context.sectionTitle,
      courseTitle: context.courseTitle,
    });

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'generate-lesson-content',
        {
          body: {
            lessonTitle: context.lessonTitle,
            lessonType: context.lessonType,
            courseTitle: context.courseTitle,
            courseDescription: context.courseDescription,
            sectionTitle: context.sectionTitle,
            sectionSummary: context.sectionSummary,
            siblingLessonTitles: context.siblingLessonTitles,
            variant: opts.nextVariant,
            feedback: opts.feedbackText || undefined,
            previousHtml: opts.usePrev && html ? html : undefined,
          },
        },
      );
      if (fnError) throw fnError;
      if ((data as any)?.error) throw new Error((data as any).error);
      const nextHtml = (data as any)?.html as string | undefined;
      if (!nextHtml) throw new Error('No content returned');

      // eslint-disable-next-line no-console
      console.log('[AI lesson content] done', { chars: nextHtml.length });
      setHtml(nextHtml);
      setVariant(opts.nextVariant);
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate content';
      // eslint-disable-next-line no-console
      console.error('[AI lesson content] error', err);
      setError(msg);
      toast.error('Could not generate content', { description: msg });
    } finally {
      setLoading(false);
    }
  }

  function handleRegenerate() {
    void generate({ nextVariant: variant, usePrev: Boolean(feedback), feedbackText: feedback });
  }

  function handleVariant(next: AiVariant) {
    void generate({ nextVariant: next, usePrev: true, feedbackText: feedback });
  }

  function handleInsert(mode: 'replace' | 'append') {
    if (!html) return;
    onApply(html, mode);
    onOpenChange(false);
  }

  const hasExisting = Boolean(existingContent && existingContent.replace(/<[^>]+>/g, '').trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate content with AI
          </DialogTitle>
          <DialogDescription>
            Review the draft below. Ask for changes, adjust the length, or regenerate before
            adding it to your lesson.
          </DialogDescription>
        </DialogHeader>

        {/* Context summary */}
        <div className="rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground space-y-0.5">
          <div><span className="font-semibold text-foreground">Lesson:</span> {context.lessonTitle || '(untitled)'}</div>
          {context.sectionTitle && (
            <div><span className="font-semibold text-foreground">Section:</span> {context.sectionTitle}</div>
          )}
          {context.courseTitle && (
            <div><span className="font-semibold text-foreground">Course:</span> {context.courseTitle}</div>
          )}
        </div>

        {/* Preview */}
        <div className="flex-1 min-h-[220px] max-h-[45vh] overflow-y-auto rounded-md border bg-background p-4">
          {loading && !html ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground gap-2 py-16">
              <Loader2 className="h-4 w-4 animate-spin" />
              Drafting with AI — this usually takes 5-15 seconds…
            </div>
          ) : error && !html ? (
            <div className="text-sm text-destructive py-8 text-center">{error}</div>
          ) : html ? (
            <div
              className="prose prose-sm max-w-none"
              // Sanitized before render.
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(html) }}
            />
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              Nothing generated yet.
            </div>
          )}
          {loading && html && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Updating draft…
            </div>
          )}
        </div>

        {/* Feedback + variant controls */}
        <div className="space-y-2">
          <Label htmlFor="ai-feedback" className="text-xs">
            Not quite right? Tell the AI what to change
          </Label>
          <Textarea
            id="ai-feedback"
            placeholder="e.g. Focus more on beginner traders, add a worked example, remove the intro…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            disabled={loading}
          />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Regenerate
            </Button>
            <Button
              type="button"
              variant={variant === 'compact' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleVariant('compact')}
              disabled={loading}
              title="Shorter, tighter draft"
            >
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              More compact
            </Button>
            <Button
              type="button"
              variant={variant === 'verbose' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleVariant('verbose')}
              disabled={loading}
              title="Longer, deeper draft"
            >
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              More verbose
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          {hasExisting && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleInsert('append')}
              disabled={loading || !html}
            >
              Append to lesson
            </Button>
          )}
          <Button
            type="button"
            onClick={() => handleInsert('replace')}
            disabled={loading || !html}
          >
            {hasExisting ? 'Replace lesson content' : 'Insert into lesson'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AiContentDialog;
