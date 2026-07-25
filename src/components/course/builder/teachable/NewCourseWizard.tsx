// ABOUTME: 4-step Teachable-style new-course wizard with live previews.
// ABOUTME: Steps: About, Thumbnail (with image preview), Outline (AI-generated with regenerate/edit), Confirm (full preview).

import { useEffect, useMemo, useState } from 'react';
import { X, Upload, Check, RefreshCw, Loader2, Trash2, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface OutlineLesson {
  title: string;
  type: 'page' | 'assignment' | 'quiz' | 'external_url';
}
export interface OutlineSection {
  title: string;
  lessons: OutlineLesson[];
}

export interface NewCourseWizardResult {
  title: string;
  description: string;
  thumbnailFile?: File | null;
  outlineMethod: 'ai' | 'scratch' | 'bulk' | 'copy';
  aiDescription?: string;
  outline?: OutlineSection[];
}

interface NewCourseWizardProps {
  open: boolean;
  onCancel: () => void;
  onFinish: (result: NewCourseWizardResult) => Promise<void>;
}

const STEPS = ['About', 'Thumbnail', 'Outline', 'Confirm'] as const;

export function NewCourseWizard({ open, onCancel, onFinish }: NewCourseWizardProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [outlineMethod, setOutlineMethod] =
    useState<NewCourseWizardResult['outlineMethod']>('ai');
  const [aiDescription, setAiDescription] = useState('');

  const [outline, setOutline] = useState<OutlineSection[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Live thumbnail preview URL (created + revoked as file changes)
  const thumbnailUrl = useMemo(
    () => (thumbnailFile ? URL.createObjectURL(thumbnailFile) : null),
    [thumbnailFile],
  );
  useEffect(() => {
    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
  }, [thumbnailUrl]);

  if (!open) return null;

  const generateOutline = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-course-outline', {
        body: { title, description: aiDescription || description },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (Array.isArray(data?.sections)) {
        setOutline(data.sections);
      } else {
        throw new Error('No sections returned');
      }
    } catch (err: any) {
      setGenError(err?.message || 'Failed to generate outline');
    } finally {
      setGenerating(false);
    }
  };

  const seedScratchOutline = () => {
    setOutline([
      { title: 'Section 1', lessons: [{ title: 'Introduction', type: 'page' }] },
    ]);
  };

  const canContinue = () => {
    if (step === 0) return title.trim().length > 0;
    if (step === 2) {
      if (outlineMethod === 'ai') return aiDescription.trim().length > 10 && outline.length > 0;
      if (outlineMethod === 'scratch') return true;
      return true;
    }
    return true;
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Ensure a starter outline for scratch flow
      let finalOutline = outline;
      if (outlineMethod === 'scratch' && outline.length === 0) {
        finalOutline = [
          { title: 'Section 1', lessons: [{ title: 'Introduction', type: 'page' }] },
        ];
      }
      await onFinish({
        title: title.trim(),
        description: description.trim(),
        thumbnailFile,
        outlineMethod,
        aiDescription: aiDescription.trim(),
        outline: finalOutline,
      });
    } catch (err: any) {
      setSubmitError(
        err?.message || 'Something went wrong creating the course. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    // When leaving the Outline step for AI method, ensure we have generated content
    if (step === 2 && outlineMethod === 'ai' && outline.length === 0 && !generating) {
      await generateOutline();
    }
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else void handleFinish();
  };

  return (
    <div className="teachable-workspace fixed inset-0 z-50 bg-white flex flex-col">
      {/* Top bar */}
      <div
        className="h-14 px-6 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid hsl(var(--tw-border))' }}
      >
        <div className="text-xs text-gray-500 font-semibold">
          {step + 1}/{STEPS.length}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-md"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 py-4 flex-shrink-0">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn('h-1 rounded-full transition-all', i === step ? 'w-8' : 'w-4')}
            style={{ background: i <= step ? 'hsl(var(--tw-accent))' : '#E5E7EB' }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start pt-8 pb-10 px-6">
        <div className="w-full max-w-2xl">
          {step === 0 && (
            <div>
              <h2 className="font-display text-4xl text-center mb-2">Tell us about your course</h2>
              <p className="text-center text-sm text-gray-600 mb-8">
                We'll use this information to customize your course. You can change it any time.
              </p>
              <div className="space-y-5">
                <Field label="Course title" required>
                  <input
                    autoFocus
                    type="text"
                    className="w-full px-4 py-3 rounded-md border outline-none focus:ring-2 focus:ring-yellow-300"
                    style={{ borderColor: 'hsl(var(--tw-border))' }}
                    placeholder="Give it a name"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  {!title.trim() && (
                    <div className="text-xs text-red-600 mt-1">Course title is required</div>
                  )}
                </Field>
                <Field label="Describe your course">
                  <textarea
                    rows={5}
                    className="w-full px-4 py-3 rounded-md border outline-none focus:ring-2 focus:ring-yellow-300"
                    style={{ borderColor: 'hsl(var(--tw-border))' }}
                    placeholder="Write a thorough description of what your course will contain."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-display text-4xl text-center mb-2">Add a thumbnail image</h2>
              <p className="text-center text-sm text-gray-600 mb-8">
                The thumbnail is displayed at checkout and throughout the member experience.
              </p>

              {/* Live preview */}
              {thumbnailUrl ? (
                <div className="mb-6">
                  <div
                    className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-50"
                    style={{ border: '1px solid hsl(var(--tw-border))' }}
                  >
                    <img
                      src={thumbnailUrl}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-gray-500 truncate max-w-[70%]">
                      {thumbnailFile?.name}
                    </span>
                    <div className="flex gap-3">
                      <label className="font-semibold text-gray-700 hover:text-black cursor-pointer">
                        Replace
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setThumbnailFile(null)}
                        className="font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <label
                    className="rounded-lg p-8 text-center cursor-pointer transition-colors hover:bg-gray-50 flex flex-col items-center justify-center gap-3"
                    style={{ border: '2px solid #111' }}
                  >
                    <Upload className="h-6 w-6" />
                    <div className="font-bold text-sm">Upload an image</div>
                    <div className="text-xs text-gray-500">Aspect ratio 16:9 · 1024×576</div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <div
                    className="rounded-lg p-8 flex flex-col items-center justify-center gap-2 text-center"
                    style={{ border: '1px solid hsl(var(--tw-border))', background: '#F9F9F9' }}
                  >
                    <div className="font-sans text-lg">I don't have one</div>
                    <div className="text-xs text-gray-500">Skip this step for now</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-4xl text-center mb-2">Outline your course</h2>
              <p className="text-center text-sm text-gray-600 mb-8">
                Choose a method below to create your course curriculum.
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setOutlineMethod('ai')}
                  className="w-full rounded-lg px-5 py-4 text-left relative"
                  style={{
                    border:
                      outlineMethod === 'ai' ? '2px solid #111' : '1px solid hsl(var(--tw-border))',
                    background: '#FAFAFA',
                  }}
                >
                  {outlineMethod === 'ai' && (
                    <div
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: '#111', color: '#fff' }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  )}
                  <div className="font-sans text-xl">Generate with AI</div>
                  <div className="text-xs text-gray-500">
                    Describe your course below and we'll generate a full outline you can edit.
                  </div>
                </button>

                {outlineMethod === 'ai' && (
                  <div className="pl-1 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Describe your course
                      </label>
                      <textarea
                        rows={4}
                        className="w-full px-4 py-3 rounded-md border outline-none focus:ring-2 focus:ring-yellow-300 text-sm"
                        style={{ borderColor: 'hsl(var(--tw-border))' }}
                        placeholder="Add a strong course description. More detail helps generate a more accurate outline."
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-gray-500">
                          {aiDescription.trim().length < 11
                            ? 'At least 10 characters, please.'
                            : ' '}
                        </div>
                        <button
                          type="button"
                          disabled={aiDescription.trim().length < 11 || generating}
                          onClick={generateOutline}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold disabled:opacity-40"
                          style={{
                            background: 'hsl(var(--tw-accent))',
                            color: 'hsl(var(--tw-accent-ink))',
                          }}
                        >
                          {generating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : outline.length > 0 ? (
                            <RefreshCw className="h-3.5 w-3.5" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {outline.length > 0 ? 'Regenerate outline' : 'Generate outline'}
                        </button>
                      </div>
                    </div>

                    {genError && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md p-3">
                        {genError}
                      </div>
                    )}

                    {generating && outline.length === 0 && (
                      <div className="flex items-center justify-center py-10 text-sm text-gray-500 gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Drafting your outline…
                      </div>
                    )}

                    {outline.length > 0 && (
                      <OutlineEditor outline={outline} onChange={setOutline} />
                    )}
                  </div>
                )}

                {(['scratch', 'bulk', 'copy'] as const).map((m) => {
                  const active = outlineMethod === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setOutlineMethod(m);
                        if (m === 'scratch' && outline.length === 0) seedScratchOutline();
                      }}
                      className="w-full rounded-lg px-5 py-4 text-left"
                      style={{
                        border: active ? '2px solid #111' : '1px solid hsl(var(--tw-border))',
                        background: '#FAFAFA',
                      }}
                    >
                      <div className="font-sans text-xl">
                        {m === 'scratch' && 'Start from scratch'}
                        {m === 'bulk' && 'Bulk upload'}
                        {m === 'copy' && 'Copy from another course'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {m === 'scratch' && "I'll create my own outline in the builder."}
                        {m === 'bulk' && 'Upload multiple files to generate your outline.'}
                        {m === 'copy' && 'Copy sections and lessons from another course.'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-display text-4xl text-center mb-2">Review and create</h2>
              <p className="text-center text-sm text-gray-600 mb-8">
                Here's how your course will start out. You can change everything in the builder.
              </p>

              <div
                className="rounded-xl overflow-hidden mb-6"
                style={{ border: '1px solid hsl(var(--tw-border))' }}
              >
                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Course thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-xs text-gray-400">No thumbnail — you can add one later</div>
                  )}
                </div>
                <div className="p-5">
                  <div className="text-2xl font-semibold mb-1">{title || 'Untitled course'}</div>
                  {description && (
                    <div className="text-sm text-gray-600 whitespace-pre-wrap">{description}</div>
                  )}
                </div>
              </div>

              <div
                className="rounded-xl p-5"
                style={{ border: '1px solid hsl(var(--tw-border))', background: '#FAFAFA' }}
              >
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Starting curriculum
                </div>
                {outline.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    You'll start with an empty curriculum and can add sections in the builder.
                  </div>
                ) : (
                  <ol className="space-y-4">
                    {outline.map((s, i) => (
                      <li key={i}>
                        <div className="font-semibold text-sm">
                          {i + 1}. {s.title}
                        </div>
                        <ul className="pl-5 mt-1 space-y-1">
                          {s.lessons.map((l, j) => (
                            <li
                              key={j}
                              className="text-xs text-gray-600 flex items-center gap-2"
                            >
                              <span
                                className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
                                style={{ background: '#EEE', color: '#555' }}
                              >
                                {l.type}
                              </span>
                              {l.title}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex flex-col flex-shrink-0"
        style={{ borderTop: '1px solid hsl(var(--tw-border))' }}
      >
        {submitError && (
          <div
            role="alert"
            className="px-6 py-3 text-sm font-medium border-b border-red-200 bg-red-50 text-red-700 flex items-start gap-2"
          >
            <span aria-hidden>⚠</span>
            <span>
              <strong>Couldn't create your course.</strong> {submitError}
            </span>
          </div>
        )}
        <div className="h-16 px-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}
            className="text-sm font-semibold text-gray-600 hover:text-black"
          >
            {step === 0 ? 'Cancel' : '‹ Back'}
          </button>
          <button
            type="button"
            disabled={!canContinue() || submitting || generating}
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md text-sm font-bold disabled:opacity-40"
            style={{
              background: 'hsl(var(--tw-accent))',
              color: 'hsl(var(--tw-accent-ink))',
            }}
          >
            {submitting ? 'Creating…' : step === STEPS.length - 1 ? 'Create course' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OutlineEditor({
  outline,
  onChange,
}: {
  outline: OutlineSection[];
  onChange: (next: OutlineSection[]) => void;
}) {
  const updateSection = (i: number, patch: Partial<OutlineSection>) => {
    const next = outline.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const updateLesson = (si: number, li: number, patch: Partial<OutlineLesson>) => {
    const next = outline.slice();
    const lessons = next[si].lessons.slice();
    lessons[li] = { ...lessons[li], ...patch };
    next[si] = { ...next[si], lessons };
    onChange(next);
  };
  const removeSection = (i: number) => onChange(outline.filter((_, idx) => idx !== i));
  const removeLesson = (si: number, li: number) => {
    const next = outline.slice();
    next[si] = { ...next[si], lessons: next[si].lessons.filter((_, idx) => idx !== li) };
    onChange(next);
  };
  const addSection = () =>
    onChange([...outline, { title: `Section ${outline.length + 1}`, lessons: [] }]);
  const addLesson = (si: number) => {
    const next = outline.slice();
    next[si] = {
      ...next[si],
      lessons: [...next[si].lessons, { title: 'New lesson', type: 'page' }],
    };
    onChange(next);
  };

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ border: '1px solid hsl(var(--tw-border))', background: '#fff' }}
    >
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Generated outline · edit before creating
      </div>
      {outline.map((section, si) => (
        <div
          key={si}
          className="rounded-md p-3"
          style={{ border: '1px solid hsl(var(--tw-border))' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <input
              value={section.title}
              onChange={(e) => updateSection(si, { title: e.target.value })}
              className="flex-1 text-sm font-semibold px-2 py-1 rounded border outline-none focus:ring-2 focus:ring-yellow-300"
              style={{ borderColor: 'hsl(var(--tw-border))' }}
            />
            <button
              type="button"
              onClick={() => removeSection(si)}
              className="p-1.5 rounded hover:bg-red-50 text-red-600"
              aria-label="Remove section"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="pl-2 space-y-1.5">
            {section.lessons.map((lesson, li) => (
              <li key={li} className="flex items-center gap-2">
                <select
                  value={lesson.type}
                  onChange={(e) =>
                    updateLesson(si, li, { type: e.target.value as OutlineLesson['type'] })
                  }
                  className="text-[10px] uppercase font-bold px-1.5 py-1 rounded border bg-gray-50"
                  style={{ borderColor: 'hsl(var(--tw-border))' }}
                >
                  <option value="page">Page</option>
                  <option value="assignment">Assignment</option>
                  <option value="quiz">Quiz</option>
                  <option value="external_url">Link</option>
                </select>
                <input
                  value={lesson.title}
                  onChange={(e) => updateLesson(si, li, { title: e.target.value })}
                  className="flex-1 text-xs px-2 py-1 rounded border outline-none focus:ring-2 focus:ring-yellow-300"
                  style={{ borderColor: 'hsl(var(--tw-border))' }}
                />
                <button
                  type="button"
                  onClick={() => removeLesson(si, li)}
                  className="p-1 rounded hover:bg-red-50 text-red-500"
                  aria-label="Remove lesson"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => addLesson(si)}
                className="text-xs text-gray-600 hover:text-black inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add lesson
              </button>
            </li>
          </ul>
        </div>
      ))}
      <button
        type="button"
        onClick={addSection}
        className="text-xs font-semibold text-gray-700 hover:text-black inline-flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Add section
      </button>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default NewCourseWizard;
