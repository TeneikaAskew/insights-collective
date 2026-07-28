// ABOUTME: Teachable-style lesson editor — center content pane + right Outline + Add content panels.
// ABOUTME: Wraps the existing LessonEditorPane for the content editing surface.

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { ContentItem, ContentItemType } from '@/types/canvas';
import { LessonEditorPane, type LessonDraft } from '../LessonEditorPane';
import { AddContentPanel } from './AddContentPanel';
import type { BuilderModule } from './types';
import { TeachableBreadcrumb } from './TeachableBreadcrumb';
import { ConfirmDialog } from './ConfirmDialog';

interface LessonEditViewProps {
  courseId?: string;
  courseTitle: string;
  modules: BuilderModule[];
  currentItem: ContentItem | null;
  onSelectLesson: (lessonId: string) => void;
  onSaveLesson: (id: string, draft: LessonDraft) => Promise<void> | void;
  onDeleteLesson: (id: string) => void;
  onTogglePublishLesson: (id: string, published: boolean) => void;
  onAddContent: (type: ContentItemType, defaultTitle: string, defaultContent?: string) => void;
  onSavingChange?: (saving: boolean) => void;
}

export function LessonEditView({
  courseId,
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-[1400px] mx-auto">
      <TeachableBreadcrumb
        courseId={courseId}
        courseTitle={courseTitle}
        current={currentItem?.title}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 mt-3">
        {/* Center content */}
        <div>
          <div className="rounded-xl bg-card overflow-hidden border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
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
                        : 'text-xs font-bold px-3 py-1.5 rounded border bg-card text-foreground border-border hover:bg-muted'
                    }
                  >
                    {currentItem.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 top-full mt-1 min-w-[140px] rounded-md bg-card shadow-lg z-10 py-1 border border-border">
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-ss-bad-chip"
                          onClick={() => {
                            setMenuOpen(false);
                            setConfirmDeleteOpen(true);
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
                (() => {
                  const parentModule = modules.find((m) =>
                    m.items.some((it) => it.id === currentItem.id),
                  );
                  const siblings = parentModule
                    ? parentModule.items
                        .filter((it) => it.id !== currentItem.id)
                        .map((it) => it.title)
                        .filter(Boolean)
                    : [];
                  return (
                    <LessonEditorPane
                      item={currentItem}
                      onSave={onSaveLesson}
                      onSavingChange={onSavingChange}
                      aiContext={{
                        courseTitle,
                        sectionTitle: parentModule?.title,
                        sectionSummary: (parentModule as any)?.summary,
                        siblingLessonTitles: siblings,
                      }}
                    />
                  );
                })()
              ) : (
                <div className="text-center py-20 text-sm text-muted-foreground">
                  Pick a lesson from the outline or add one from the panel to the right.
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right column: Outline + Add content */}
        <aside className="space-y-6">
          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-2xl">Outline</h3>
            </div>
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {modules.map((m) => (
                <div key={m.id}>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
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
                                ? 'w-full text-left text-sm py-1.5 rounded font-semibold border-l-2 border-primary pl-2.5 pr-2'
                                : 'w-full text-left text-sm px-2 py-1.5 rounded text-foreground hover:bg-muted'
                            }
                          >
                            <span className="truncate block">{it.title || 'Untitled lesson'}</span>
                          </button>
                        </li>
                      );
                    })}
                    {m.items.length === 0 && (
                      <li className="text-xs text-muted-foreground italic px-2">No lessons</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <AddContentPanel onAdd={onAddContent} />
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this lesson?"
        description="This will permanently remove the lesson and its content."
        confirmLabel="Delete lesson"
        onConfirm={() => {
          if (currentItem) onDeleteLesson(currentItem.id);
          setConfirmDeleteOpen(false);
        }}
      />
    </div>
  );
}

export default LessonEditView;
