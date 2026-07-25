// ABOUTME: Teachable-style curriculum editor — sections with drag handles, per-lesson publish, section actions.
// ABOUTME: Uses dnd-kit for reorder of both sections and lessons within each section.

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  GripVertical,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hint } from '@/components/ui/hint';
import { sanitizeHTML } from '@/utils/sanitize';
import type { ContentItem } from '@/types/canvas';
import type { BuilderModule } from './types';
import { TeachableBreadcrumb } from './TeachableBreadcrumb';

function htmlToPlainText(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '').trim();
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

interface CurriculumViewProps {
  courseId?: string;
  courseTitle: string;
  modules: BuilderModule[];
  onAddModule: () => void;
  onRenameModule: (moduleId: string, title: string) => void;
  onUpdateModuleDescription?: (moduleId: string, description: string) => void;
  onDeleteModule: (moduleId: string) => void;
  onReorderModules: (orderedIds: string[]) => void;
  onAddLesson: (moduleId: string) => void;
  onRenameLesson: (lessonId: string, title: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onTogglePublishLesson: (lessonId: string, published: boolean) => void;
  onReorderLessons: (moduleId: string, orderedIds: string[]) => void;
  onSelectLesson: (lessonId: string) => void;
}

export function CurriculumView(props: CurriculumViewProps) {
  const {
    courseId,
    courseTitle,
    modules,
    onAddModule,
    onRenameModule,
    onUpdateModuleDescription,
    onDeleteModule,
    onReorderModules,
    onAddLesson,
    onRenameLesson,
    onDeleteLesson,
    onTogglePublishLesson,
    onReorderLessons,
    onSelectLesson,
  } = props;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moduleIds = useMemo(() => modules.map((m) => m.id), [modules]);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = moduleIds.indexOf(String(active.id));
    const newIndex = moduleIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderModules(arrayMove(moduleIds, oldIndex, newIndex));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1200px] mx-auto">
      <TeachableBreadcrumb
        courseId={courseId}
        courseTitle={courseTitle}
        current="Curriculum"
      />


      <div className="flex items-center justify-between gap-4 mb-8">
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl">Curriculum</h2>
        <button
          type="button"
          onClick={onAddModule}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold rounded-md shrink-0"
          style={{
            background: 'hsl(var(--tw-accent))',
            color: 'hsl(var(--tw-accent-ink))',
          }}
        >
          <Plus className="h-4 w-4" />
          New section
        </button>
      </div>

      {modules.length === 0 ? (
        <div
          className="rounded-xl bg-white p-16 text-center"
          style={{ border: '1px dashed hsl(var(--tw-border))' }}
        >
          <p className="text-gray-500 mb-4">No sections yet</p>
          <button
            type="button"
            onClick={onAddModule}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-md"
            style={{
              background: 'hsl(var(--tw-accent))',
              color: 'hsl(var(--tw-accent-ink))',
            }}
          >
            <Plus className="h-4 w-4" />
            Add your first section
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={moduleIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-5">
              {modules.map((m) => (
                <SectionCard
                  key={m.id}
                  module={m}
                  onRenameModule={onRenameModule}
                  onUpdateModuleDescription={onUpdateModuleDescription}
                  onDeleteModule={onDeleteModule}
                  onAddLesson={onAddLesson}
                  onRenameLesson={onRenameLesson}
                  onDeleteLesson={onDeleteLesson}
                  onTogglePublishLesson={onTogglePublishLesson}
                  onReorderLessons={onReorderLessons}
                  onSelectLesson={onSelectLesson}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// --- Section card ---
interface SectionCardProps {
  module: BuilderModule;
  onRenameModule: (id: string, title: string) => void;
  onUpdateModuleDescription?: (id: string, description: string) => void;
  onDeleteModule: (id: string) => void;
  onAddLesson: (moduleId: string) => void;
  onRenameLesson: (id: string, title: string) => void;
  onDeleteLesson: (id: string) => void;
  onTogglePublishLesson: (id: string, published: boolean) => void;
  onReorderLessons: (moduleId: string, orderedIds: string[]) => void;
  onSelectLesson: (id: string) => void;
}

function SectionCard({
  module,
  onRenameModule,
  onUpdateModuleDescription,
  onDeleteModule,
  onAddLesson,
  onRenameLesson,
  onDeleteLesson,
  onTogglePublishLesson,
  onReorderLessons,
  onSelectLesson,
}: SectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(module.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [descDraft, setDescDraft] = useState(module.description ?? '');
  const [descEditing, setDescEditing] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== module.title) onRenameModule(module.id, draft.trim());
    else setDraft(module.title);
  };

  const beginEditDesc = () => {
    const existing = module.description ?? '';
    setDescDraft(looksLikeHtml(existing) ? htmlToPlainText(existing) : existing);
    setDescEditing(true);
  };

  const commitDesc = () => {
    setDescEditing(false);
    const next = descDraft.trim();
    const currentPlain = looksLikeHtml(module.description ?? '')
      ? htmlToPlainText(module.description ?? '')
      : (module.description ?? '');
    if (currentPlain !== next && onUpdateModuleDescription) {
      onUpdateModuleDescription(module.id, next);
    }
  };

  const itemIds = useMemo(() => module.items.map((i) => i.id), [module.items]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleItemsDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderLessons(module.id, arrayMove(itemIds, oldIndex, newIndex));
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl bg-white"
    >
      <div
        className="flex items-center gap-3 px-5 py-4 rounded-t-xl"
        style={{ background: '#FAFAFA', borderBottom: '1px solid hsl(var(--tw-border))' }}
      >
        <Hint label="Drag to reorder sections">
          <button
            type="button"
            className="cursor-grab text-gray-400 hover:text-gray-700"
            {...attributes}
            {...listeners}
            aria-label="Reorder section"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        </Hint>
        {editing ? (
          <input
            autoFocus
            className="flex-1 font-display text-2xl bg-transparent outline-none focus:ring-2 focus:ring-yellow-300 rounded px-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setEditing(false);
                setDraft(module.title);
              }
            }}
          />
        ) : (
          <h3
            className="flex-1 font-display text-2xl truncate cursor-text"
            onDoubleClick={() => setEditing(true)}
            title={module.title}
          >
            {module.title || 'Untitled section'}
          </h3>
        )}
        <Hint label="Content is released on a schedule instead of all at once">
          <span
            className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded cursor-help"
            style={{ background: '#EDEDED', color: '#333' }}
          >
            Drip
          </span>
        </Hint>
        <Hint label="Rename or delete this section">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="relative p-1.5 rounded hover:bg-gray-200 text-gray-600"
            aria-label="Section actions"
          >
            <div className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 border rounded"
              style={{ borderColor: 'hsl(var(--tw-border))' }}
            >
              Quick actions
              <ChevronDown className="h-3 w-3" />
            </div>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 min-w-[180px] rounded-md bg-white shadow-lg z-10 py-1 text-left"
              style={{ border: '1px solid hsl(var(--tw-border))' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50"
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                }}
              >
                Rename section
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDeleteOpen(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete section
              </button>
            </div>
          )}
          </button>
        </Hint>
      </div>

      {/* Section summary (shown to students on the course page) */}
      {onUpdateModuleDescription && (
        <div
          className="px-5 py-3"
          style={{ borderBottom: '1px solid hsl(var(--tw-border))' }}
        >
          {descEditing ? (
            <textarea
              autoFocus
              className="w-full text-sm bg-transparent outline-none focus:ring-2 focus:ring-primary/40 rounded p-2 min-h-[64px] resize-y"
              style={{ border: '1px solid hsl(var(--tw-border))' }}
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={commitDesc}
              placeholder="Add a short summary students see on the course page…"
            />
          ) : (
            <button
              type="button"
              onClick={beginEditDesc}
              className="w-full text-left text-sm text-gray-600 hover:text-black cursor-text px-1 py-1 rounded"
              title="Click to edit section summary"
            >
              {module.description?.trim() ? (
                looksLikeHtml(module.description) ? (
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(module.description) }}
                  />
                ) : (
                  <span className="whitespace-pre-wrap">{module.description}</span>
                )
              ) : (
                <span className="text-gray-400 italic">
                  + Add a section summary students will see on the course page
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Lessons */}

      {module.items.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-gray-400">
          No lessons yet. Add one below.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemsDragEnd}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <ul>
              {module.items.map((it) => (
                <LessonRow
                  key={it.id}
                  item={it}
                  onRename={onRenameLesson}
                  onDelete={onDeleteLesson}
                  onTogglePublish={onTogglePublishLesson}
                  onSelect={onSelectLesson}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* Section footer actions */}
      <div
        className="flex items-center gap-6 px-5 py-3 rounded-b-xl"
        style={{ borderTop: '1px solid hsl(var(--tw-border))' }}
      >
        <button
          type="button"
          onClick={() => onAddLesson(module.id)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-black"
        >
          <Plus className="h-4 w-4" />
          New lesson
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-black"
          disabled
          title="Coming soon"
        >
          <Upload className="h-4 w-4" />
          Bulk upload
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-black"
          disabled
          title="Coming soon"
        >
          <Sparkles className="h-4 w-4" />
          Section summary
        </button>
      </div>
    </div>
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this section?"
        description="This will remove the section and all its lessons. This cannot be undone."
        confirmLabel="Delete section"
        onConfirm={() => {
          onDeleteModule(module.id);
          setConfirmDeleteOpen(false);
        }}
      />
    </>
  );
}

// --- Lesson row ---
interface LessonRowProps {
  item: ContentItem;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (id: string, published: boolean) => void;
  onSelect: (id: string) => void;
}

function LessonRow({ item, onRename, onDelete, onTogglePublish, onSelect }: LessonRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [menuOpen, setMenuOpen] = useState(false);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== item.title) onRename(item.id, draft.trim());
    else setDraft(item.title);
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('flex items-center gap-3 px-5 py-4 border-b last:border-b-0 group')}
    >
      <button
        type="button"
        className="cursor-grab text-gray-300 hover:text-gray-600"
        {...attributes}
        {...listeners}
        aria-label="Reorder lesson"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            className="w-full text-sm font-semibold bg-transparent outline-none focus:ring-2 focus:ring-yellow-300 rounded px-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setEditing(false);
                setDraft(item.title);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className="text-sm font-semibold underline underline-offset-2 hover:text-black text-left truncate w-full"
          >
            {item.title || 'Untitled lesson'}
          </button>
        )}
        <div className="text-[11px] text-gray-500 mt-0.5">1 {contentLabel(item.type)}</div>
      </div>

      <Hint label={item.published ? 'Hide this lesson from students' : 'Make this lesson visible to students'}>
        <button
          type="button"
          onClick={() => onTogglePublish(item.id, !item.published)}
          className={cn(
            'text-xs font-bold px-3 py-1.5 rounded border transition-colors',
            item.published
              ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50',
          )}
        >
          {item.published ? 'Unpublish' : 'Publish'}
        </button>
      </Hint>

      <div className="relative">
        <Hint label="Rename or delete this lesson">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Lesson actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </Hint>
        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 min-w-[160px] rounded-md bg-white shadow-lg z-10 py-1 text-left"
            style={{ border: '1px solid hsl(var(--tw-border))' }}
          >
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50"
              onClick={() => {
                setMenuOpen(false);
                setEditing(true);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50"
              onClick={() => {
                setMenuOpen(false);
                onSelect(item.id);
              }}
            >
              Edit content
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
              onClick={() => {
                setMenuOpen(false);
                if (confirm('Delete this lesson?')) onDelete(item.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
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

export default CurriculumView;
