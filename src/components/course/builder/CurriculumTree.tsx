// ABOUTME: Teachable/Kajabi-style left-rail curriculum tree for the course builder.
// ABOUTME: Drag to reorder modules + lessons, inline rename, inline add, click to select.

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
  ChevronRight,
  FileText,
  ClipboardList,
  HelpCircle,
  ExternalLink,
  Plus,
  GripVertical,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ContentItem, Module } from '@/types/canvas';

export interface CurriculumModule extends Module {
  items: ContentItem[];
}

export interface CurriculumTreeProps {
  modules: CurriculumModule[];
  /** The currently selected lesson, if any. */
  selectedItemId?: string | null;
  /** Which modules are expanded in the UI. */
  expandedModuleIds?: Set<string>;
  /** Lesson ids that have been completed (only relevant in learner mode). */
  completedItemIds?: Set<string>;
  /** Read-only mode disables drag, add, delete, rename. Used by the learner view. */
  readOnly?: boolean;
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
      return <FileText className="h-4 w-4" />;
    case 'assignment':
      return <ClipboardList className="h-4 w-4" />;
    case 'quiz':
      return <HelpCircle className="h-4 w-4" />;
    case 'external_url':
      return <ExternalLink className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

export function CurriculumTree(props: CurriculumTreeProps) {
  const {
    modules,
    selectedItemId,
    expandedModuleIds,
    completedItemIds,
    readOnly = false,
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
    const next = arrayMove(moduleIds, oldIndex, newIndex);
    onReorderModules(next);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Curriculum
        </span>
        {!readOnly && onAddModule && (
          <Button size="sm" variant="ghost" onClick={onAddModule}>
            <Plus className="h-4 w-4 mr-1" />
            Module
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {modules.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No modules yet.
            {!readOnly && onAddModule && (
              <Button
                className="mt-3 block mx-auto"
                size="sm"
                variant="outline"
                onClick={onAddModule}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add your first module
              </Button>
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
      </div>
    </div>
  );
}

// --- Module row ------------------------------------------------------------
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
    <div ref={setNodeRef} style={style} className="rounded-md border bg-card">
      <div className="flex items-center gap-1 px-2 py-1.5 group">
        {!readOnly && (
          <button
            type="button"
            className="cursor-grab text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder module"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onToggleExpand(module.id)}
          aria-label={isExpanded ? 'Collapse module' : 'Expand module'}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {editing && !readOnly ? (
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm font-medium outline-none focus:ring-2 focus:ring-primary rounded px-1"
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
            className="flex-1 text-left text-sm font-medium truncate"
            onClick={() => (readOnly ? onToggleExpand(module.id) : setEditing(true))}
            title={module.title}
          >
            {module.title || 'Untitled module'}
          </button>
        )}

        {!readOnly && onAddItem && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
            onClick={() => onAddItem(module.id)}
            aria-label="Add lesson to module"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        {!readOnly && onDeleteModule && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
            onClick={() => onDeleteModule(module.id)}
            aria-label="Delete module"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="pb-1">
          {module.items.length === 0 ? (
            <div className="pl-8 pr-2 pb-2 text-xs text-muted-foreground">
              No lessons yet.
              {!readOnly && onAddItem && (
                <button
                  type="button"
                  className="ml-1 underline"
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

// --- Lesson row ------------------------------------------------------------
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1 pl-6 pr-2 py-1 text-sm group cursor-pointer',
        isSelected && 'bg-primary/10 text-primary',
      )}
      onClick={() => onSelectItem(moduleId, item.id)}
    >
      {!readOnly && (
        <button
          type="button"
          className="cursor-grab text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder lesson"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}

      <span className="text-muted-foreground">{typeIcon(item.type)}</span>

      {editing && !readOnly ? (
        <input
          autoFocus
          className="flex-1 bg-transparent outline-none focus:ring-2 focus:ring-primary rounded px-1"
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
          className="flex-1 truncate"
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

      {isCompleted && (
        <CheckCircle2 className="h-3 w-3 text-green-600" aria-label="Completed" />
      )}

      {!readOnly && onDeleteItem && (
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteItem(item.id);
          }}
          aria-label="Delete lesson"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default CurriculumTree;
