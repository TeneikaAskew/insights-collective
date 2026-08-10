// ABOUTME: Instructor "Settings" tab — course-level options and the delete-course action.
// ABOUTME: Persists into courses.settings JSON; deletion goes straight to the courses table.
//
// This replaces src/components/course/management/CourseSettings.tsx, which was
// deleted along with the rest of the pre-builder management UI. Two things about
// that component are worth keeping in mind here:
//
//   1. Its save was a placeholder. The write to a `course_settings` table was
//      commented out and replaced with `await new Promise(r => setTimeout(r, 1000))`
//      followed by a "Settings have been updated successfully" toast. The table
//      never existed. Every toggle it offered — discussions, auto-enrollment,
//      certificate-on-completion, feedback requests, enrollment notifications —
//      was discarded on save.
//   2. Its delete *did* work, and nothing replaced it. Until now there was no way
//      to delete a course anywhere in the live application.
//
// So this view deliberately offers less than the old one. Only settings with a
// real consumer are here; a switch that changes nothing is worse than a missing
// switch, because it looks like a promise. Discussions are honored by
// LessonViewer, and delete does what it says.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, MessageSquare, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logger';
import type { BuilderCourse, CourseSettings } from './types';
import { TeachableBreadcrumb } from './TeachableBreadcrumb';

const logger = createLogger('CourseSettingsView');

interface CourseSettingsViewProps {
  course: BuilderCourse;
  onSave: (patch: Partial<BuilderCourse>) => Promise<void>;
}

export function CourseSettingsView({ course, onSave }: CourseSettingsViewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Undefined means on: courses that predate this setting keep their discussions.
  const [discussionsEnabled, setDiscussionsEnabled] = useState(
    course.settings?.discussions?.enabled !== false,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirmText.trim() === course.title.trim();

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextSettings: CourseSettings = {
        ...(course.settings || {}),
        discussions: { enabled: discussionsEnabled },
      };
      await onSave({ settings: nextSettings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      // count=exact via the shared client's instrumentation: a delete that RLS
      // filters to zero rows still answers 204, and reporting "Course deleted"
      // for a course that is still there is the exact failure this codebase has
      // been chasing.
      const { error, count } = await supabase
        .from('courses')
        .delete({ count: 'exact' })
        .eq('id', course.id);

      if (error) throw error;
      if (!count) {
        throw new Error(
          'The course was not deleted. You may not have permission to delete it.',
        );
      }

      toast({ title: 'Course deleted', description: `“${course.title}” has been removed.` });
      navigate('/course-management');
    } catch (err) {
      logger.error('Failed to delete course', err);
      toast({
        title: 'Could not delete course',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[900px] mx-auto">
      <TeachableBreadcrumb courseId={course.id} courseTitle={course.title} current="Settings" />

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-md flex items-center justify-center bg-primary/15">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl">Settings</h2>
      </div>

      <div className="space-y-6 bg-card rounded-xl border border-border p-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={discussionsEnabled}
            onChange={(e) => setDiscussionsEnabled(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary"
            aria-describedby="discussions-help"
          />
          <span>
            <span className="flex items-center gap-2 font-semibold text-sm">
              <MessageSquare className="h-4 w-4" />
              Allow discussions on lessons
            </span>
            <span id="discussions-help" className="block text-xs text-muted-foreground mt-0.5">
              Students can comment and reply beneath each lesson. Turning this off hides the
              thread; existing comments are kept and reappear if you turn it back on.
            </span>
          </span>
        </label>

        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-primary font-medium">Saved</span>}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-destructive">Delete this course</h3>
            <p className="text-sm text-foreground/80 mt-1">
              This removes the course along with its modules, lessons, enrollments and
              submissions. Certificates already issued to students are kept. This cannot be
              undone.
            </p>

            <label className="block mt-4">
              <span className="block text-sm font-medium mb-1.5">
                Type <strong>{course.title}</strong> to confirm
              </span>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={course.title}
                aria-label="Confirm course title to delete"
                className="w-full max-w-md px-3 py-2 rounded-md border border-input text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={!canDelete || deleting}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-destructive text-destructive-foreground font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting…' : 'Delete course'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CourseSettingsView;
