// ABOUTME: "Setup guide" landing view for the Teachable-style builder.
// ABOUTME: Two-column: curriculum preview list on the left, course info/thumbnail card on the right.

import { useEffect, useRef, useState } from 'react';
import { ClipboardList, LayoutGrid, Image as ImageIcon, Pencil, Eye, Trash2, Check, X } from 'lucide-react';
import type { BuilderCourse, BuilderModule } from './types';
import { TeachableBreadcrumb } from './TeachableBreadcrumb';

interface SetupGuideViewProps {
  course: BuilderCourse;
  modules: BuilderModule[];
  onGoToCurriculum: () => void;
  onSelectLesson: (lessonId: string) => void;
  onRenameCourse: (title: string) => Promise<void> | void;
  onUploadThumbnail: (file: File) => Promise<void>;
  onRemoveThumbnail: () => Promise<void> | void;
}

export function SetupGuideView({
  course,
  modules,
  onGoToCurriculum,
  onSelectLesson,
  onRenameCourse,
  onUploadThumbnail,
  onRemoveThumbnail,
}: SetupGuideViewProps) {
  const [uploading, setUploading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(course.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitleDraft(course.title);
  }, [course.title]);

  useEffect(() => {
    if (editingTitle) inputRef.current?.select();
  }, [editingTitle]);

  const thumbnailSrc = course.image_url || course.thumbnail || null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadThumbnail(file);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const commitTitle = async () => {
    const next = titleDraft.trim();
    if (next && next !== course.title) {
      await onRenameCourse(next);
    } else {
      setTitleDraft(course.title);
    }
    setEditingTitle(false);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1200px] mx-auto">
      <TeachableBreadcrumb
        courseId={course.id}
        courseTitle={course.title}
        current="Setup guide"
      />


      <div className="flex items-center gap-3 mb-10">
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl">Setup guide</h2>
        <span
          className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md ${
            course.published ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          {course.published ? 'Published' : 'Unpublished'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-10">
        {/* Left: create your curriculum */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-md flex items-center justify-center bg-primary/15">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-display text-xl sm:text-2xl lg:text-3xl">Create your curriculum</h3>
          </div>

          <div className="rounded-xl bg-white overflow-hidden border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h4 className="font-semibold text-sm">Curriculum Preview</h4>
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={onGoToCurriculum}
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-4 w-4" />
                  Preview curriculum
                </button>
                <button
                  onClick={onGoToCurriculum}
                  className="inline-flex items-center gap-1.5 font-semibold hover:underline"
                >
                  <Pencil className="h-4 w-4" />
                  Edit curriculum
                </button>
              </div>
            </div>

            {modules.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No sections yet.{' '}
                <button className="underline font-semibold" onClick={onGoToCurriculum}>
                  Add your first section
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {modules.map((m) => (
                  <li key={m.id} className="px-6 py-4">
                    <div className="font-sans text-lg mb-2">{m.title || 'Untitled section'}</div>
                    <ul className="space-y-1.5">
                      {m.items.length === 0 && (
                        <li className="text-xs text-muted-foreground italic">No lessons yet</li>
                      )}
                      {m.items.map((it) => (
                        <li
                          key={it.id}
                          className="flex items-center justify-between text-sm hover:bg-muted/40 -mx-2 px-2 py-1 rounded cursor-pointer"
                          onClick={() => onSelectLesson(it.id)}
                        >
                          <div>
                            <div className="font-medium">{it.title || 'Untitled lesson'}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              1 {contentLabel(it.type)}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                              it.published
                                ? 'bg-primary/15 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {it.published ? 'Published' : 'Draft'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Right: customize your course */}
        <aside className="space-y-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-md flex items-center justify-center bg-primary/15">
              <LayoutGrid className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-display text-xl sm:text-2xl lg:text-3xl">Customize your course</h3>
          </div>

          <div className="rounded-xl bg-white p-5 border border-border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Course title</h4>
              {!editingTitle && (
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit title
                </button>
              )}
            </div>
            {editingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitTitle();
                    if (e.key === 'Escape') {
                      setTitleDraft(course.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="flex-1 px-2 py-1.5 text-sm rounded border border-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => void commitTitle()}
                  className="p-1.5 rounded bg-primary text-primary-foreground hover:opacity-90"
                  aria-label="Save title"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(course.title);
                    setEditingTitle(false);
                  }}
                  className="p-1.5 rounded border border-input hover:bg-muted"
                  aria-label="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-foreground">{course.title}</p>
            )}
          </div>

          <div className="rounded-xl bg-white p-5 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Thumbnail</h4>
              <div className="flex items-center gap-3">
                {thumbnailSrc && (
                  <button
                    type="button"
                    onClick={() => void onRemoveThumbnail()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
                <label className="inline-flex items-center gap-1 text-xs font-semibold hover:underline cursor-pointer">
                  <ImageIcon className="h-3.5 w-3.5" />
                  {uploading ? 'Uploading…' : thumbnailSrc ? 'Replace' : 'Add an image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFile}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
            <div className="aspect-[16/9] rounded-md flex items-center justify-center overflow-hidden bg-muted border border-dashed border-border">
              {thumbnailSrc ? (
                <img
                  src={thumbnailSrc}
                  alt="Course thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-xs text-muted-foreground text-center px-4">
                  Recommended 1024×576 (16:9)
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function contentLabel(type: string): string {
  switch (type) {
    case 'page':
      return 'Text & Images';
    case 'assignment':
      return 'Assignment';
    case 'quiz':
      return 'Quiz';
    case 'external_url':
      return 'External Link';
    default:
      return 'Content';
  }
}

export default SetupGuideView;
