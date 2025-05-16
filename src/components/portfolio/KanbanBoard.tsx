
import React, { useState } from 'react';
import {
  DndContext, 
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KanbanItem {
  id: string;
  title: string;
  description?: string;
  status: 'Idea' | 'Planned' | 'In Progress' | 'Completed';
}

interface KanbanColumnProps {
  title: string;
  items: KanbanItem[];
  columnId: string;
}

interface KanbanBoardProps {
  items: KanbanItem[];
  onItemMove: (items: KanbanItem[]) => void;
}

// Sortable Item Component
const SortableItem = ({ item }: { item: KanbanItem }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-3 cursor-grab active:cursor-grabbing"
    >
      <Card className="shadow-sm hover:shadow transition-shadow duration-200">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-medium truncate">{item.title}</CardTitle>
        </CardHeader>
        {item.description && (
          <CardContent className="p-3 pt-0">
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{item.description}</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

// Kanban Column Component
const KanbanColumn = ({ title, items, columnId }: KanbanColumnProps) => {
  return (
    <div className="flex flex-col w-full h-full min-h-[300px] bg-gray-100 dark:bg-gray-800/50 rounded-md p-3">
      <h3 className="font-medium text-sm mb-3 text-gray-700 dark:text-gray-300">
        {title} <span className="text-xs text-gray-500 dark:text-gray-400">({items.length})</span>
      </h3>
      
      <SortableContext items={items.map(item => item.id)}>
        <div className="flex-1">
          {items.map((item) => (
            <SortableItem key={item.id} item={item} />
          ))}
          {items.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center mt-5">
              Drop items here
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

// Main Kanban Board Component
const KanbanBoard = ({ items, onItemMove }: KanbanBoardProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const activeItem = items.find(item => item.id === active.id);
      const overItem = items.find(item => item.id === over.id);
      
      if (activeItem && overItem) {
        const activeIndex = items.findIndex(item => item.id === active.id);
        const overIndex = items.findIndex(item => item.id === over.id);
        
        // Update the order of items
        const newItems = arrayMove(items, activeIndex, overIndex);
        onItemMove(newItems);
      }
    }
  };

  // Group items by status
  const ideaItems = items.filter(item => item.status === 'Idea');
  const plannedItems = items.filter(item => item.status === 'Planned');
  const inProgressItems = items.filter(item => item.status === 'In Progress');
  const completedItems = items.filter(item => item.status === 'Completed');

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full overflow-auto">
        <KanbanColumn
          title="Ideas"
          columnId="Idea"
          items={ideaItems}
        />
        <KanbanColumn
          title="Planned"
          columnId="Planned"
          items={plannedItems}
        />
        <KanbanColumn
          title="In Progress"
          columnId="In Progress"
          items={inProgressItems}
        />
        <KanbanColumn
          title="Completed"
          columnId="Completed"
          items={completedItems}
        />
      </div>
    </DndContext>
  );
};

export default KanbanBoard;
