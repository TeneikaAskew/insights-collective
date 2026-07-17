// ABOUTME: Teachable-style lesson editor — center content pane + right Outline + Add content panels.
// ABOUTME: Wraps the existing LessonEditorPane for the content editing surface.

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { ContentItem, ContentItemType } from '@/types/canvas';
import { LessonEditorPane, type LessonDraft } from '../LessonEditorPane';
import { AddContentPanel } from './AddContentPanel';
import type { BuilderModule } from './types';

interface LessonEditViewProps {
  courseTitle: string;
  modules: BuilderModule[];
  currentItem: ContentItem | null;
  onSelectLesson: (lessonId: string) => void;
  onSaveLesson: (id: string, draft: LessonDraft) => Promise<void> | void;
  onDeleteLesson: (id: string) => void;
  onTogglePublishLesson: (id: string, published: boolean) => void;
  onAddContent: (type: ContentItemType, defaultTitle: string) => void;
  onSavingChange?: (saving: boolean) => void;
}

export function LessonEditView({
  courseTitle,
  modules,
  currentItem,
  onSelectLesson,
  onSaveLesson,
  onDeleteLesson,
  onTogglePublishLesson,
  onAddContent,
  onSavingChange,
}: LessonEditViewProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">
        <span className="underline underline-offset-4 cursor-pointer">Courses</span>
        <span className="mx-2 opacity-50">|</span>
        <span className="underline underline-offset-4 cursor-pointer">{courseTitle}</span>
        {currentItem && (
          <>
            <span className="mx-2 opacity-50">|</span>
            <span>{currentItem.title}</span>
          </>
        )}
      </div>

      <h2 className="font-display text-5xl mb-6">Curriculum</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* Center content */}
        <div>
          <div
            className="rounded-xl bg-white overflow-hidden"
            style={{ border: '1px solid hsl(var(--tw-border))' }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid hsl(var(--tw-border))' }}
            >
              <h3 className="font-display text-2xl truncate">
                {currentItem?.title || 'Select a lesson'}
              </h3>
              {currentItem && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onTogglePublishLesson(currentItem.id, !currentItem.published)
                    }
                    className={
                      currentItem.published
                        ? 'text-xs font-bold px-3 py-1.5 rounded border bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                        : 'text-xs font-bold px-3 py-1.5 rounded border bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                    }
                  >
                    {currentItem.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuOpen && (
                      <div
                        className="absolute right-0 top-full mt-1 min-w-[140px] rounded-md bg-white shadow-lg z-10 py-1"
                        style={{ border: '1px solid hsl(var(--tw-border))' }}
                      >
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setMenuOpen(false);
                            if (confirm('Delete this lesson?')) onDeleteLesson(currentItem.id);
                          }}
                        >
                          Delete lesson
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6">
              {currentItem ? (
                <LessonEditorPane
                  item={currentItem}
                  onSave={onSaveLesson}
                  onSavingChange={onSavingChange}
                />
              ) : (
                <div className="text-center py-20 text-sm text-gray-500">
                  Pick a lesson from the outline or add one from the panel to the right.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Outline + Add content */}
        <aside className="space-y-6">
          <div
            className="bg-white rounded-xl p-5"
            style={{ border: '1px solid hsl(var(--tw-border))' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-2xl">Outline</h3>
            </div>
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {modules.map((m) => (
                <div key={m.id}>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">
                    {m.title || 'Untitled section'}
                  </div>
                  <ul className="space-y-0.5">
                    {m.items.map((it) => {
                      const active = currentItem?.id === it.id;
                      return (
                        <li key={it.id}>
                          <button
                            type="button"
                            onClick={() => onSelectLesson(it.id)}
                            className={
                              active
                                ? 'w-full text-left text-sm px-2 py-1.5 rounded font-semibold'
                                : 'w-full text-left text-sm px-2 py-1.5 rounded text-gray-700 hover:bg-gray-50'
                            }
                            style={
                              active
                                ? { borderLeft: '2px solid hsl(var(--tw-accent))', paddingLeft: 10 }
                                : undefined
                            }
                          >
                            <span className="truncate block">{it.title || 'Untitled lesson'}</span>
                          </button>
                        </li>
                      );
                    })}
                    {m.items.length === 0 && (
                      <li className="text-xs text-gray-400 italic px-2">No lessons</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <AddContentPanel onAdd={onAddContent} />
        </aside>
      </div>
    </div>
  );
}

export default LessonEditView;
