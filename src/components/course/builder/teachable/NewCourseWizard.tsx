// ABOUTME: 4-step Teachable-style new-course wizard.
// ABOUTME: Steps: about, thumbnail, outline method, confirm. (Pricing was removed — nothing consumed it.)

import { useState } from 'react';
import { X, Upload, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NewCourseWizardResult {
  title: string;
  description: string;
  thumbnailFile?: File | null;
  outlineMethod: 'ai' | 'scratch' | 'bulk' | 'copy';
  aiDescription?: string;
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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [outlineMethod, setOutlineMethod] =
    useState<NewCourseWizardResult['outlineMethod']>('ai');
  const [aiDescription, setAiDescription] = useState('');

  if (!open) return null;

  const canContinue = () => {
    if (step === 0) return title.trim().length > 0;
    if (step === 2 && outlineMethod === 'ai') return aiDescription.trim().length > 10;
    return true;
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await onFinish({
        title: title.trim(),
        description: description.trim(),
        thumbnailFile,
        outlineMethod,
        aiDescription: aiDescription.trim(),
      });
    } finally {
      setSubmitting(false);
    }
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
            className={cn(
              'h-1 rounded-full transition-all',
              i === step ? 'w-8' : 'w-4',
            )}
            style={{
              background: i <= step ? 'hsl(var(--tw-accent))' : '#E5E7EB',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start pt-8 px-6">
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
                Upload one now or choose one later.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <label
                  className="rounded-lg p-6 text-center cursor-pointer transition-colors hover:bg-gray-50 flex flex-col items-center justify-center gap-3"
                  style={{
                    border: thumbnailFile ? '2px solid #111' : '1px solid hsl(var(--tw-border))',
                  }}
                >
                  <Upload className="h-6 w-6" />
                  <div className="font-bold text-sm">Upload an image</div>
                  <div className="text-xs text-gray-500">Aspect ratio 16:9 · 1024×576</div>
                  {thumbnailFile && (
                    <div className="text-xs mt-2 truncate max-w-full">{thumbnailFile.name}</div>
                  )}
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
                  className="rounded-lg p-6 cursor-pointer transition-colors flex flex-col items-center justify-center gap-2"
                  style={{
                    border: thumbnailFile ? '1px solid hsl(var(--tw-border))' : '2px solid #111',
                    background: thumbnailFile ? '#fff' : '#F9F9F9',
                  }}
                >
                  <div className="font-sans text-xl">I don't have one</div>
                  <div className="text-xs text-gray-500">Skip this step for now</div>
                </button>
              </div>
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
                  className="w-full rounded-lg px-5 py-4 text-center relative"
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
                    Describe your course below and we'll generate an outline for you.
                  </div>
                </button>
                {outlineMethod === 'ai' && (
                  <div className="pl-1">
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
                  </div>
                )}
                {(['scratch', 'bulk', 'copy'] as const).map((m) => {
                  const active = outlineMethod === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOutlineMethod(m)}
                      className="w-full rounded-lg px-5 py-4 text-center"
                      style={{
                        border: active ? '2px solid #111' : '1px solid hsl(var(--tw-border))',
                        background: '#FAFAFA',
                      }}
                    >
                      <div className="font-sans text-xl">
                        {m === 'scratch' && 'Start from scratch'}
                        {m === 'bulk' && 'Bulk upload'}
                        {m === 'copy' && 'Copy from'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {m === 'scratch' && 'I will create my own outline.'}
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
            <div className="text-center">
              <h2 className="font-display text-4xl mb-4">You're all set</h2>
              <p className="text-sm text-gray-600 mb-8">
                We'll create <strong>{title}</strong> and take you into the builder.
              </p>
              <div
                className="rounded-lg p-5 text-left space-y-2 max-w-md mx-auto"
                style={{ border: '1px solid hsl(var(--tw-border))', background: '#FAFAFA' }}
              >
                <SummaryRow k="Title" v={title} />
                {description && <SummaryRow k="Description" v={truncate(description, 80)} />}
                <SummaryRow k="Thumbnail" v={thumbnailFile ? thumbnailFile.name : 'Add later'} />
                <SummaryRow k="Outline" v={prettyOutline(outlineMethod)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="h-16 px-6 flex items-center justify-between flex-shrink-0"
        style={{ borderTop: '1px solid hsl(var(--tw-border))' }}
      >
        <button
          type="button"
          onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}
          className="text-sm font-semibold text-gray-600 hover:text-black"
        >
          {step === 0 ? 'Cancel' : '‹ Back'}
        </button>
        <button
          type="button"
          disabled={!canContinue() || submitting}
          onClick={() => {
            if (step < STEPS.length - 1) setStep((s) => s + 1);
            else void handleFinish();
          }}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-md text-sm font-bold disabled:opacity-40"
          style={{
            background: 'hsl(var(--tw-accent))',
            color: 'hsl(var(--tw-accent-ink))',
          }}
        >
          {submitting
            ? 'Creating…'
            : step === STEPS.length - 1
            ? 'Create course'
            : step === 2
            ? 'Finish'
            : 'Continue'}
        </button>
      </div>
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

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-6 text-sm">
      <span className="text-gray-500">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function prettyOutline(o: NewCourseWizardResult['outlineMethod']) {
  switch (o) {
    case 'ai':
      return 'Generate with AI';
    case 'scratch':
      return 'Start from scratch';
    case 'bulk':
      return 'Bulk upload';
    case 'copy':
      return 'Copy from another course';
  }
}

export default NewCourseWizard;
