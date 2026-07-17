// ABOUTME: "Setup guide" landing view for the Teachable-style builder.
// ABOUTME: Two-column: curriculum preview list on the left, course info/thumbnail card on the right.

import { useState } from 'react';
import { ClipboardList, LayoutGrid, Image as ImageIcon, Pencil, Eye } from 'lucide-react';
import type { BuilderCourse, BuilderModule } from './types';

interface SetupGuideViewProps {
  course: BuilderCourse;
  modules: BuilderModule[];
  onGoToCurriculum: () => void;
  onSelectLesson: (lessonId: string) => void;
  onEditTitle: () => void;
  onUploadThumbnail: (file: File) => Promise<void>;
}

export function SetupGuideView({
  course,
  modules,
  onGoToCurriculum,
  onSelectLesson,
  onEditTitle,
  onUploadThumbnail,
}: SetupGuideViewProps) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadThumbnail(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-10 py-10 max-w-[1200px] mx-auto">
      <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">
        <span className="underline underline-offset-4 cursor-pointer">Courses</span>
        <span className="mx-2 opacity-50">|</span>
        <span>{course.title}</span>
      </div>

      <div className="flex items-center gap-3 mb-10">
        <h2 className="tw-serif text-5xl">Setup guide</h2>
        <span
          className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md"
          style={{
            background: course.published ? 'hsl(var(--tw-accent) / 0.2)' : '#EDEDED',
            color: '#333',
          }}
        >
          {course.published ? 'Published' : 'Unpublished'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-10">
        {/* Left: create your curriculum */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center"
              style={{ background: 'hsl(var(--tw-accent) / 0.2)' }}
            >
              <ClipboardList className="h-5 w-5" />
            </div>
            <h3 className="tw-serif text-3xl">Create your curriculum</h3>
          </div>

          <div
            className="rounded-xl bg-white overflow-hidden"
            style={{ border: '1px solid hsl(var(--tw-border))' }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid hsl(var(--tw-border))' }}
            >
              <h4 className="font-semibold text-sm">Curriculum Preview</h4>
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={onGoToCurriculum}
                  className="inline-flex items-center gap-1.5 text-gray-600 hover:text-black"
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
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                No sections yet.{' '}
                <button className="underline font-semibold" onClick={onGoToCurriculum}>
                  Add your first section
                </button>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'hsl(var(--tw-border))' }}>
                {modules.map((m) => (
                  <li key={m.id} className="px-6 py-4">
                    <div className="tw-serif text-lg mb-2">{m.title || 'Untitled section'}</div>
                    <ul className="space-y-1.5">
                      {m.items.length === 0 && (
                        <li className="text-xs text-gray-400 italic">No lessons yet</li>
                      )}
                      {m.items.map((it) => (
                        <li
                          key={it.id}
                          className="flex items-center justify-between text-sm hover:bg-gray-50 -mx-2 px-2 py-1 rounded cursor-pointer"
                          onClick={() => onSelectLesson(it.id)}
                        >
                          <div>
                            <div className="font-medium">{it.title || 'Untitled lesson'}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              1 {contentLabel(it.type)}
                            </div>
                          </div>
                          <span
                            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
                            style={{
                              background: it.published ? 'hsl(var(--tw-accent) / 0.25)' : '#EDEDED',
                              color: '#333',
                            }}
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
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center"
              style={{ background: 'hsl(var(--tw-accent) / 0.2)' }}
            >
              <LayoutGrid className="h-5 w-5" />
            </div>
            <h3 className="tw-serif text-3xl">Customize your course</h3>
          </div>

          <div
            className="rounded-xl bg-white p-5"
            style={{ border: '1px solid hsl(var(--tw-border))' }}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Course title</h4>
              <button
                type="button"
                onClick={onEditTitle}
                className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit title
              </button>
            </div>
            <p className="text-sm text-gray-700">{course.title}</p>
          </div>

          <div
            className="rounded-xl bg-white p-5"
            style={{ border: '1px solid hsl(var(--tw-border))' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Thumbnail</h4>
              <label className="inline-flex items-center gap-1 text-xs font-semibold hover:underline cursor-pointer">
                <ImageIcon className="h-3.5 w-3.5" />
                {course.thumbnail ? 'Replace' : 'Add an image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                  disabled={uploading}
                />
              </label>
            </div>
            <div
              className="aspect-[16/9] rounded-md flex items-center justify-center overflow-hidden"
              style={{
                background: '#F3F3F3',
                border: '1px dashed hsl(var(--tw-border))',
              }}
            >
              {course.thumbnail ? (
                <img
                  src={course.thumbnail}
                  alt="Course thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-xs text-gray-400 text-center px-4">
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
