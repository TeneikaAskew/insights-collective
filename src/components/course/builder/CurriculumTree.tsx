// ABOUTME: Teachable-style left-rail curriculum tree with drag-reorder, inline rename, progress dots.
// ABOUTME: Shared by the student learn player (readOnly) and the instructor course builder.

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
  FileText,
  ClipboardList,
  HelpCircle,
  ExternalLink,
  Plus,
  GripVertical,
  Trash2,
  Check,
  Play,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentItem, Module } from '@/types/canvas';

export interface CurriculumModule extends Module {
  items: ContentItem[];
}

export interface CurriculumTreeProps {
  modules: CurriculumModule[];
  selectedItemId?: string | null;
  expandedModuleIds?: Set<string>;
  completedItemIds?: Set<string>;
  readOnly?: boolean;
  /** Course-level percent complete (0-100), shown at top of tree in learner mode. */
  progressPercent?: number;
  onToggleExpand: (moduleId: string) => void;
  onSelectItem: (moduleId: string, itemId: string) => void;
  onAddModule?: () => void;
  onRenameModule?: (moduleId: string, title: string) => void;
  onDeleteModule?: (moduleId: string) => void;
  onAddItem?: (moduleId: string) => void;
  onRenameItem?: (itemId: string, title: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onReorderModules?: (orderedModuleIds: string[]) => void;
  onReorderItems?: (moduleId: string, orderedItemIds: string[]) => void;
}

const typeIcon = (type: string) => {
  switch (type) {
    case 'page':
      return <FileText className="h-3.5 w-3.5" />;
    case 'assignment':
      return <ClipboardList className="h-3.5 w-3.5" />;
    case 'quiz':
      return <HelpCircle className="h-3.5 w-3.5" />;
    case 'external_url':
      return <ExternalLink className="h-3.5 w-3.5" />;
    default:
      return <FileText className="h-3.5 w-3.5" />;
  }
};

export function CurriculumTree(props: CurriculumTreeProps) {
  const {
    modules,
    selectedItemId,
    expandedModuleIds,
    completedItemIds,
    readOnly = false,
    progressPercent,
    onToggleExpand,
    onSelectItem,
    onAddModule,
    onRenameModule,
    onDeleteModule,
    onAddItem,
    onRenameItem,
    onDeleteItem,
    onReorderModules,
    onReorderItems,
  } = props;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moduleIds = useMemo(() => modules.map((m) => m.id), [modules]);

  const handleModuleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderModules) return;
    const oldIndex = moduleIds.indexOf(String(active.id));
    const newIndex = moduleIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderModules(arrayMove(moduleIds, oldIndex, newIndex));
  };

  const showProgress = readOnly && typeof progressPercent === 'number';

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="p-6" style={{ borderBottom: '1px solid hsl(var(--cw-border))' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base tracking-tight">Curriculum</h2>
          {!readOnly && onAddModule && (
            <button
              type="button"
              onClick={onAddModule}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Module
            </button>
          )}
        </div>
        {showProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              <span>Progress</span>
              <span style={{ color: 'hsl(var(--cw-accent-strong))' }}>
                {Math.round(progressPercent!)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, progressPercent!))}%`,
                  background: 'hsl(var(--cw-accent))',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modules */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {modules.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No modules yet.
            {!readOnly && onAddModule && (
              <button
                onClick={onAddModule}
                className="mt-3 mx-auto inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add your first module
              </button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleModuleDragEnd}
          >
            <SortableContext items={moduleIds} strategy={verticalListSortingStrategy}>
              {modules.map((m) => (
                <SortableModule
                  key={m.id}
                  module={m}
                  isExpanded={expandedModuleIds?.has(m.id) ?? true}
                  selectedItemId={selectedItemId}
                  completedItemIds={completedItemIds}
                  readOnly={readOnly}
                  onToggleExpand={onToggleExpand}
                  onSelectItem={onSelectItem}
                  onRenameModule={onRenameModule}
                  onDeleteModule={onDeleteModule}
                  onAddItem={onAddItem}
                  onRenameItem={onRenameItem}
                  onDeleteItem={onDeleteItem}
                  onReorderItems={onReorderItems}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </nav>
    </div>
  );
}

// --- Module row ---
interface SortableModuleProps {
  module: CurriculumModule;
  isExpanded: boolean;
  selectedItemId?: string | null;
  completedItemIds?: Set<string>;
  readOnly: boolean;
  onToggleExpand: (moduleId: string) => void;
  onSelectItem: (moduleId: string, itemId: string) => void;
  onRenameModule?: (moduleId: string, title: string) => void;
  onDeleteModule?: (moduleId: string) => void;
  onAddItem?: (moduleId: string) => void;
  onRenameItem?: (itemId: string, title: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onReorderItems?: (moduleId: string, orderedItemIds: string[]) => void;
}

function SortableModule({
  module,
  isExpanded,
  selectedItemId,
  completedItemIds,
  readOnly,
  onToggleExpand,
  onSelectItem,
  onRenameModule,
  onDeleteModule,
  onAddItem,
  onRenameItem,
  onDeleteItem,
  onReorderItems,
}: SortableModuleProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
    disabled: readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(module.title);

  const commitRename = () => {
    setEditing(false);
    if (draftTitle.trim() && draftTitle !== module.title && onRenameModule) {
      onRenameModule(module.id, draftTitle.trim());
    } else {
      setDraftTitle(module.title);
    }
  };

  const itemIds = useMemo(() => module.items.map((i) => i.id), [module.items]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleItemsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderItems) return;
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderItems(module.id, arrayMove(itemIds, oldIndex, newIndex));
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      {/* Module Label */}
      <div className="flex items-center gap-2 px-2 group">
        {!readOnly && (
          <button
            type="button"
            className="cursor-grab text-gray-300 hover:text-gray-500"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder module"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        {editing && !readOnly ? (
          <input
            autoFocus
            className="flex-1 bg-transparent text-[11px] font-bold text-gray-500 uppercase tracking-widest outline-none focus:ring-2 focus:ring-teal-400 rounded px-1"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setEditing(false);
                setDraftTitle(module.title);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="flex-1 text-left text-[11px] font-bold text-gray-500 uppercase tracking-widest truncate hover:text-gray-800"
            onClick={() =>
              readOnly ? onToggleExpand(module.id) : setEditing(true)
            }
            title={module.title}
          >
            {module.title || 'Untitled module'}
          </button>
        )}
        {!readOnly && onAddItem && (
          <button
            type="button"
            onClick={() => onAddItem(module.id)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
            aria-label="Add lesson"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
        {!readOnly && onDeleteModule && (
          <button
            type="button"
            onClick={() => onDeleteModule(module.id)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"
            aria-label="Delete module"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Lessons */}
      {isExpanded && (
        <div className="space-y-1">
          {module.items.length === 0 ? (
            <div className="pl-4 pr-2 pb-1 text-xs text-gray-400">
              No lessons yet.
              {!readOnly && onAddItem && (
                <button
                  type="button"
                  className="ml-1 underline hover:text-gray-700"
                  onClick={() => onAddItem(module.id)}
                >
                  Add one
                </button>
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleItemsDragEnd}
            >
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                {module.items.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    moduleId={module.id}
                    isSelected={selectedItemId === item.id}
                    isCompleted={completedItemIds?.has(item.id) ?? false}
                    readOnly={readOnly}
                    onSelectItem={onSelectItem}
                    onRenameItem={onRenameItem}
                    onDeleteItem={onDeleteItem}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}

// --- Lesson row ---
interface SortableItemProps {
  item: ContentItem;
  moduleId: string;
  isSelected: boolean;
  isCompleted: boolean;
  readOnly: boolean;
  onSelectItem: (moduleId: string, itemId: string) => void;
  onRenameItem?: (itemId: string, title: string) => void;
  onDeleteItem?: (itemId: string) => void;
}

function SortableItem({
  item,
  moduleId,
  isSelected,
  isCompleted,
  readOnly,
  onSelectItem,
  onRenameItem,
  onDeleteItem,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(item.title);

  const commitRename = () => {
    setEditing(false);
    if (draftTitle.trim() && draftTitle !== item.title && onRenameItem) {
      onRenameItem(item.id, draftTitle.trim());
    } else {
      setDraftTitle(item.title);
    }
  };

  const activeBg = isSelected
    ? { background: 'hsl(var(--cw-accent) / 0.12)', color: 'hsl(var(--cw-accent-strong))' }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...activeBg }}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
        !isSelected && 'hover:bg-gray-50 text-gray-600',
      )}
      onClick={() => onSelectItem(moduleId, item.id)}
    >
      {!readOnly && (
        <button
          type="button"
          className="cursor-grab text-gray-300 hover:text-gray-500 -ml-1"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder lesson"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}

      {/* Progress indicator circle */}
      <div className="flex-shrink-0">
        {isCompleted ? (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white"
            style={{ background: 'hsl(var(--cw-accent))' }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </div>
        ) : isSelected ? (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white"
            style={{ background: 'hsl(var(--cw-accent))' }}
          >
            <Play className="h-3 w-3 ml-0.5" fill="currentColor" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-300">
            <Circle className="h-2 w-2" fill="none" strokeWidth={0} />
          </div>
        )}
      </div>

      <span
        className={cn(
          'text-gray-400 flex-shrink-0',
          isSelected && 'text-current opacity-70',
        )}
      >
        {typeIcon(item.type)}
      </span>

      {editing && !readOnly ? (
        <input
          autoFocus
          className="flex-1 min-w-0 bg-transparent text-sm outline-none focus:ring-2 focus:ring-teal-400 rounded px-1"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setEditing(false);
              setDraftTitle(item.title);
            }
          }}
        />
      ) : (
        <span
          className={cn('flex-1 text-sm truncate', isSelected && 'font-medium')}
          onDoubleClick={(e) => {
            if (readOnly) return;
            e.stopPropagation();
            setEditing(true);
          }}
          title={item.title}
        >
          {item.title || 'Untitled lesson'}
        </span>
      )}

      {!readOnly && onDeleteItem && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteItem(item.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"
          aria-label="Delete lesson"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default CurriculumTree;
