// ABOUTME: Instructor "Design templates" tab — pick a course accent color and layout preset.
// ABOUTME: Persists into courses.settings.theme JSON so student-facing views can pick it up later.

import { useState } from 'react';
import { Palette, Check } from 'lucide-react';
import type { BuilderCourse, CourseSettings } from './types';
import { TeachableBreadcrumb } from './TeachableBreadcrumb';

interface CourseDesignViewProps {
  course: BuilderCourse;
  onSave: (patch: Partial<BuilderCourse>) => Promise<void>;
}

const ACCENTS = [
  { name: 'Brand purple', hex: '#7C3AED' },
  { name: 'Ocean blue', hex: '#2563EB' },
  { name: 'Forest', hex: '#059669' },
  { name: 'Sunset', hex: '#EA580C' },
  { name: 'Rose', hex: '#E11D48' },
  { name: 'Slate', hex: '#334155' },
];

const PRESETS = [
  { id: 'classic', label: 'Classic', description: 'Clean two-column player with sidebar navigation.' },
  { id: 'focus', label: 'Focus', description: 'Distraction-free reader with a collapsible outline.' },
  { id: 'workshop', label: 'Workshop', description: 'Split view showing lesson content beside notes.' },
];

export function CourseDesignView({ course, onSave }: CourseDesignViewProps) {
  const initial: CourseSettings['theme'] = course.settings?.theme || {};
  const [accent, setAccent] = useState(initial.accent || ACCENTS[0].hex);
  const [preset, setPreset] = useState(initial.preset || 'classic');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextSettings: CourseSettings = {
        ...(course.settings || {}),
        theme: { accent, preset },
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
      <TeachableBreadcrumb courseId={course.id} courseTitle={course.title} current="Design templates" />


      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-md flex items-center justify-center bg-primary/15">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl">Design templates</h2>
      </div>

      <div className="space-y-8 bg-card rounded-xl border border-border p-6">
        <section>
          <h3 className="text-sm font-semibold mb-3">Accent color</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {ACCENTS.map((c) => {
              const active = accent === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setAccent(c.hex)}
                  className={`relative rounded-lg h-16 border-2 transition-all ${
                    active ? 'border-foreground scale-[1.02]' : 'border-transparent hover:scale-[1.02]'
                  }`}
                  style={{ background: c.hex }}
                  title={c.name}
                  aria-label={c.name}
                >
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center text-white">
                      <Check className="h-5 w-5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-3">Layout preset</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PRESETS.map((p) => {
              const active = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-foreground/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{p.label}</span>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-primary font-medium">Saved</span>}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save design'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CourseDesignView;
