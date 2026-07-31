// ABOUTME: Instructor "Certificates" tab — toggle course completion certificate and edit its title/body.
// ABOUTME: Persists into courses.settings.certificate JSON.

import { useState } from 'react';
import { Award, Info } from 'lucide-react';
import type { BuilderCourse, CourseSettings } from './types';
import { TeachableBreadcrumb } from './TeachableBreadcrumb';

interface CourseCertificatesViewProps {
  course: BuilderCourse;
  onSave: (patch: Partial<BuilderCourse>) => Promise<void>;
}

export function CourseCertificatesView({ course, onSave }: CourseCertificatesViewProps) {
  const initial: CourseSettings['certificate'] = course.settings?.certificate || {};
  const [enabled, setEnabled] = useState(!!initial.enabled);
  const [title, setTitle] = useState(initial.title || `Certificate of Completion`);
  const [body, setBody] = useState(
    initial.body ||
      `This is to certify that {student_name} has successfully completed ${course.title}.`,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextSettings: CourseSettings = {
        ...(course.settings || {}),
        certificate: { enabled, title, body },
      };
      await onSave({ settings: nextSettings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[900px] mx-auto">
      <TeachableBreadcrumb courseId={course.id} courseTitle={course.title} current="Certificates" />


      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-md flex items-center justify-center bg-primary/15">
          <Award className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl">Certificates</h2>
      </div>

      <div className="space-y-6 bg-card rounded-xl border border-border p-6">
        {/* Persistent honesty notice: these settings save, but nothing consumes
            them yet — issuance is automatic and the issued PDF uses standard copy. */}
        <div
          role="note"
          className="flex items-start gap-3 rounded-lg border border-ss-warn bg-ss-warn-chip p-4 text-sm text-ss-warn"
        >
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Custom certificate text is not applied yet</p>
            <p className="mt-1">
              Certificates are issued automatically when a student completes every published
              item in this course. The title and body you save here are stored, but they are
              not yet applied to issued certificates — students currently receive the standard
              certificate design.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary"
          />
          <span>
            <span className="block font-semibold text-sm">Award a certificate on completion</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Learners who complete every lesson unlock a downloadable certificate.
            </span>
          </span>
        </label>

        <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
          <label className="block">
            <span className="block text-sm font-semibold mb-1.5">Certificate title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-semibold mb-1.5">Certificate body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-md border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="block text-xs text-muted-foreground mt-1">
              Use <code>{'{student_name}'}</code> to insert the learner's name.
            </span>
          </label>

          <div className="rounded-lg border border-dashed border-border p-6 bg-muted/30 text-center">
            <div className="uppercase tracking-widest text-[10px] text-muted-foreground mb-2">
              Preview
            </div>
            <div className="font-display text-2xl mb-3">{title}</div>
            <p className="text-sm text-foreground/80 max-w-md mx-auto">
              {body.replace('{student_name}', 'Jane Doe')}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-primary font-medium">Saved</span>}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save certificate'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CourseCertificatesView;
