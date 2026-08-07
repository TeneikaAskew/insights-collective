// ABOUTME: Instructor quiz editor for a `quiz`-type content_item. Manages quiz + questions + answer options.
// ABOUTME: Writes to the quizzes and quiz_questions tables with answers as JSONB QuizAnswer[] so InlineQuizPlayer renders them.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { QuizQuestion, QuizAnswer } from '@/types/canvas';
import { createLogger } from '@/utils/logger';

const logger = createLogger('QuizContentEditor');

type QType = QuizQuestion['question_type'];

interface QuizContentEditorProps {
  contentItemId: string;
}

interface DraftQuestion {
  id?: string;
  question_type: QType;
  question_text: string;
  points: number;
  position: number;
  answers: QuizAnswer[];
}

function newId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`
  );
}

function emptyAnswer(overrides: Partial<QuizAnswer> = {}): QuizAnswer {
  return { id: newId(), text: '', correct: false, ...overrides };
}

function seedAnswers(type: QType): QuizAnswer[] {
  if (type === 'true_false') {
    return [
      { id: newId(), text: 'True', correct: true },
      { id: newId(), text: 'False', correct: false },
    ];
  }
  if (type === 'multiple_choice' || type === 'multiple_answers') {
    return [emptyAnswer({ correct: true }), emptyAnswer(), emptyAnswer(), emptyAnswer()];
  }
  return [];
}

export function QuizContentEditor({ contentItemId }: QuizContentEditorProps) {
  const { toast } = useToast();
  const [quizId, setQuizId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);

  // --- Load or create quiz row ---
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // The answers key is not readable through a normal select any more
        // (20260728000000 hides it from `authenticated`), so authoring reads
        // it through the staff-gated RPC instead.
        const { data: existing, error } = await supabase
          .from('quizzes')
          .select('id')
          .eq('content_item_id', contentItemId)
          .maybeSingle();
        if (error) throw error;

        let qId = existing?.id;
        if (!qId) {
          const { data: created, error: cErr } = await supabase
            .from('quizzes')
            .insert({ content_item_id: contentItemId, quiz_type: 'assignment', title: 'Untitled Quiz' })
            .select('id')
            .single();
          if (cErr) throw cErr;
          qId = created.id;
        }

        if (cancelled) return;
        setQuizId(qId);

        // Staff-only RPC: returns full rows including the answers key.
        const { data: authored, error: qErr } = await supabase
          .rpc('get_quiz_questions_for_authoring', { p_quiz_id: qId });
        if (qErr) throw qErr;

        if (cancelled) return;
        const rows: any[] = authored || [];
        const drafts: DraftQuestion[] = rows
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((row) => ({
            id: row.id,
            question_type: row.question_type,
            question_text: row.question_text ?? '',
            points: row.points ?? 1,
            position: row.position ?? 0,
            answers: Array.isArray(row.answers) ? row.answers : [],
          }));
        setQuestions(drafts);
      } catch (err: any) {
        logger.error('Failed to load quiz', err);
        toast({
          title: 'Failed to load quiz',
          description: err.message,
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [contentItemId, toast]);

  // --- Mutators ---
  const setQuestion = useCallback(
    (idx: number, patch: Partial<DraftQuestion>) => {
      setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
    },
    [],
  );

  const setAnswer = useCallback(
    (qIdx: number, aIdx: number, patch: Partial<QuizAnswer>) => {
      setQuestions((prev) =>
        prev.map((q, i) =>
          i === qIdx
            ? {
                ...q,
                answers: q.answers.map((a, j) => (j === aIdx ? { ...a, ...patch } : a)),
              }
            : q,
        ),
      );
    },
    [],
  );

  const addAnswer = useCallback((qIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, answers: [...q.answers, emptyAnswer()] } : q)),
    );
  }, []);

  const removeAnswer = useCallback((qIdx: number, aIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, answers: q.answers.filter((_, j) => j !== aIdx) } : q,
      ),
    );
  }, []);

  const setCorrectSingle = useCallback((qIdx: number, aIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, answers: q.answers.map((a, j) => ({ ...a, correct: j === aIdx })) }
          : q,
      ),
    );
  }, []);

  const changeType = useCallback((qIdx: number, next: QType) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              question_type: next,
              answers:
                next === 'short_answer' || next === 'essay' || next === 'matching'
                  ? []
                  : q.answers.length > 0
                    ? next === 'true_false'
                      ? seedAnswers('true_false')
                      : q.answers
                    : seedAnswers(next),
            }
          : q,
      ),
    );
  }, []);

  const addQuestion = useCallback(() => {
    setQuestions((prev) => [
      ...prev,
      {
        question_type: 'multiple_choice',
        question_text: '',
        points: 1,
        position: prev.length,
        answers: seedAnswers('multiple_choice'),
      },
    ]);
  }, []);

  const removeQuestion = useCallback((idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, position: i })));
  }, []);

  // --- Save ---
  const save = useCallback(async () => {
    if (!quizId) return;
    setSaving(true);
    try {
      // Determine ids to keep and delete
      const existingIds = questions.filter((q) => q.id).map((q) => q.id!) as string[];

      // Delete removed questions
      const { data: onServer, error: listErr } = await supabase
        .from('quiz_questions')
        .select('id')
        .eq('quiz_id', quizId);
      if (listErr) throw listErr;
      const serverIds = (onServer || []).map((r) => r.id);
      const toDelete = serverIds.filter((id) => !existingIds.includes(id));
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('quiz_questions')
          .delete()
          .in('id', toDelete);
        if (delErr) throw delErr;
      }

      // Upsert each question in order (so we get real ids back)
      const nextIds: (string | undefined)[] = [];
      for (let i = 0; i < questions.length; i += 1) {
        const q = questions[i];
        const payload = {
          quiz_id: quizId,
          question_type: q.question_type,
          question_text: q.question_text || 'Untitled question',
          points: q.points ?? 1,
          position: i,
          answers: q.answers as any,
        };
        if (q.id) {
          const { error: upErr } = await supabase
            .from('quiz_questions')
            .update(payload)
            .eq('id', q.id);
          if (upErr) throw upErr;
          nextIds[i] = q.id;
        } else {
          const { data: ins, error: insErr } = await supabase
            .from('quiz_questions')
            .insert(payload)
            .select('id')
            .single();
          if (insErr) throw insErr;
          nextIds[i] = ins.id;
        }
      }

      // Update local state with server ids
      setQuestions((prev) => prev.map((q, i) => ({ ...q, id: nextIds[i], position: i })));

      toast({ title: 'Quiz saved' });
    } catch (err: any) {
      logger.error('Failed to save quiz', err);
      toast({
        title: 'Failed to save quiz',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [quizId, questions, toast]);

  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
    [questions],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading quiz…
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="quiz-content-editor">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {questions.length} question{questions.length === 1 ? '' : 's'} · {totalPoints} pt
          {totalPoints === 1 ? '' : 's'} total
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-1" /> Add question
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Save quiz
          </Button>
        </div>
      </div>

      {questions.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No questions yet. Add your first question to get started.
        </div>
      )}

      {questions.map((q, qIdx) => (
        <div key={q.id ?? `new-${qIdx}`} className="rounded-md border p-4 space-y-4 bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm font-semibold">Q{qIdx + 1}</div>
            <div className="flex items-center gap-2">
              <Select
                value={q.question_type}
                onValueChange={(v) => changeType(qIdx, v as QType)}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                  <SelectItem value="multiple_answers">Multiple answers</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                  <SelectItem value="short_answer">Short answer</SelectItem>
                  <SelectItem value="essay">Essay</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Label className="text-xs">Points</Label>
                <Input
                  type="number"
                  min={0}
                  value={q.points}
                  onChange={(e) =>
                    setQuestion(qIdx, { points: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="h-8 w-16"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeQuestion(qIdx)}
                aria-label="Delete question"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Question</Label>
            <Textarea
              value={q.question_text}
              onChange={(e) => setQuestion(qIdx, { question_text: e.target.value })}
              placeholder="Type your question…"
              rows={2}
            />
          </div>

          {(q.question_type === 'multiple_choice' || q.question_type === 'true_false') && (
            <div className="space-y-2">
              <Label className="text-xs">Answer options (select the correct one)</Label>
              <RadioGroup
                value={q.answers.find((a) => a.correct)?.id || ''}
                onValueChange={(val) => {
                  const idx = q.answers.findIndex((a) => a.id === val);
                  if (idx >= 0) setCorrectSingle(qIdx, idx);
                }}
              >
                <div className="space-y-2">
                  {q.answers.map((a, aIdx) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <RadioGroupItem value={a.id} id={`q${qIdx}-a${aIdx}`} />
                      <Input
                        value={a.text}
                        onChange={(e) => setAnswer(qIdx, aIdx, { text: e.target.value })}
                        placeholder={`Option ${aIdx + 1}`}
                        className="flex-1 h-9"
                        disabled={q.question_type === 'true_false'}
                      />
                      {q.question_type !== 'true_false' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeAnswer(qIdx, aIdx)}
                          aria-label="Remove option"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </RadioGroup>
              {q.question_type !== 'true_false' && (
                <Button variant="outline" size="sm" onClick={() => addAnswer(qIdx)}>
                  <Plus className="h-4 w-4 mr-1" /> Add option
                </Button>
              )}
            </div>
          )}

          {q.question_type === 'multiple_answers' && (
            <div className="space-y-2">
              <Label className="text-xs">Answer options (check all correct)</Label>
              <div className="space-y-2">
                {q.answers.map((a, aIdx) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={a.correct}
                      onCheckedChange={(v) => setAnswer(qIdx, aIdx, { correct: !!v })}
                      id={`q${qIdx}-a${aIdx}`}
                    />
                    <Input
                      value={a.text}
                      onChange={(e) => setAnswer(qIdx, aIdx, { text: e.target.value })}
                      placeholder={`Option ${aIdx + 1}`}
                      className="flex-1 h-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAnswer(qIdx, aIdx)}
                      aria-label="Remove option"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => addAnswer(qIdx)}>
                <Plus className="h-4 w-4 mr-1" /> Add option
              </Button>
            </div>
          )}

          {(q.question_type === 'short_answer' || q.question_type === 'essay') && (
            <div className="text-xs text-muted-foreground italic">
              Students will type a free-form response. Responses require manual review.
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Save quiz
        </Button>
      </div>
    </div>
  );
}

export default QuizContentEditor;
