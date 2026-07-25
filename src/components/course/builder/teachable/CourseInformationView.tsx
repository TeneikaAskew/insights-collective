// ABOUTME: Instructor course "Information" tab — category, level, tags, difficulty, and duration form.
// ABOUTME: Persists the metadata directly to the courses row via the provided onSave callback.

import { useEffect, useState } from 'react';
import { Info, Save, X } from 'lucide-react';
import type { BuilderCourse } from './types';
import { TeachableBreadcrumb } from './TeachableBreadcrumb';

interface CourseInformationViewProps {
  course: BuilderCourse;
  onSave: (patch: Partial<BuilderCourse>) => Promise<void>;
}

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

export function CourseInformationView({ course, onSave }: CourseInformationViewProps) {
  const [category, setCategory] = useState(course.category || '');
  const [level, setLevel] = useState(course.level || '');
  const [difficulty, setDifficulty] = useState(course.difficulty_level || '');
  const [estimatedHours, setEstimatedHours] = useState<string>(
    course.estimated_hours != null ? String(course.estimated_hours) : '',
  );
  const [duration, setDuration] = useState<string>(
    course.duration != null ? String(course.duration) : '',
  );
  const [description, setDescription] = useState(course.description || '');
  const [tags, setTags] = useState<string[]>(course.tags || []);
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCategory(course.category || '');
    setLevel(course.level || '');
    setDifficulty(course.difficulty_level || '');
    setEstimatedHours(course.estimated_hours != null ? String(course.estimated_hours) : '');
    setDuration(course.duration != null ? String(course.duration) : '');
    setDescription(course.description || '');
    setTags(course.tags || []);
  }, [course]);

  const addTag = () => {
    const t = tagDraft.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagDraft('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        category: category || null,
        level: level || null,
        difficulty_level: difficulty || null,
        estimated_hours: estimatedHours ? Number(estimatedHours) : null,
        duration: duration ? Number(duration) : null,
        description,
        tags: tags.length ? tags : null,
      } as Partial<BuilderCourse>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[900px] mx-auto">
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
        <span className="underline underline-offset-4">Courses</span>
        <span className="mx-2 opacity-50">|</span>
        <span>{course.title}</span>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-md flex items-center justify-center bg-primary/15">
          <Info className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl">Course information</h2>
      </div>

      <div className="space-y-6 bg-white rounded-xl border border-border p-6">
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What learners will get out of this course"
            className="w-full px-3 py-2 rounded-md border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Category">
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Analytics & BI"
              className="w-full px-3 py-2 rounded-md border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>

          <Field label="Level">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">—</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Difficulty">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">—</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Estimated hours">
            <input
              type="number"
              min={0}
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>

          <Field label="Duration (lessons)">
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
        </div>

        <Field label="Tags">
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                {t}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  aria-label={`Remove ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add a tag and press Enter"
              className="flex-1 px-3 py-2 rounded-md border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-3 py-2 rounded-md border border-input text-sm font-semibold hover:bg-muted"
            >
              Add
            </button>
          </div>
        </Field>

        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-primary font-medium">Saved</span>}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export default CourseInformationView;
