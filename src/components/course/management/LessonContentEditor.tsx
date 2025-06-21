// ABOUTME: Component for editing content blocks within a lesson with drag and drop functionality
// ABOUTME: Provides lesson-level completion tracking and content block management

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, GripVertical, CheckCircle } from 'lucide-react';
import { useContentBlocks, ContentBlock } from '@/hooks/useContentBlocks';
import { useLessonProgress } from '@/hooks/useLessonProgress';
import { Lesson } from '@/hooks/useLessons';
import ContentBlockEditor from '../content/ContentBlockEditor';
import ContentBlockRenderer from '../content/ContentBlockRenderer';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface LessonContentEditorProps {
  lesson: Lesson;
}

interface SortableBlockProps {
  block: ContentBlock;
  onEdit: (block: ContentBlock) => void;
  onDelete: (blockId: string) => void;
}

const SortableBlock: React.FC<SortableBlockProps> = ({ block, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="absolute left-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      </div>
      <ContentBlockRenderer
        block={block}
        onEdit={() => onEdit(block)}
        onDelete={() => onDelete(block.id)}
        showControls={true}
      />
    </div>
  );
};

const LessonContentEditor: React.FC<LessonContentEditorProps> = ({ lesson }) => {
  const { blocks, loading, addBlock, updateBlock, deleteBlock, reorderBlocks } = useContentBlocks(undefined, lesson.id);
  const { progress, markLessonComplete, calculateLessonCompletion } = useLessonProgress(lesson.id);
  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((block) => block.id === active.id);
      const newIndex = blocks.findIndex((block) => block.id === over.id);

      const reorderedBlocks = arrayMove(blocks, oldIndex, newIndex);
      reorderBlocks(reorderedBlocks);
    }
  };

  const handleAddBlock = async (blockData: Omit<ContentBlock, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    const result = await addBlock({
      ...blockData,
      position: blocks.length
    });
    if (result) {
      setShowAddBlock(false);
    }
  };

  const handleUpdateBlock = async (blockData: any) => {
    if (!editingBlock) return;
    
    const result = await updateBlock(editingBlock.id, blockData);
    if (result) {
      setEditingBlock(null);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    const success = await deleteBlock(blockId);
    if (success && editingBlock?.id === blockId) {
      setEditingBlock(null);
    }
  };

  const handleMarkLessonComplete = async () => {
    const completion = await calculateLessonCompletion();
    if (completion && completion.completed) {
      await markLessonComplete();
    } else {
      // Show warning that not all content is completed
      alert('Please complete all content blocks before marking this lesson as complete.');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              {lesson.title}
              {progress?.completed && (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{lesson.description}</p>
            {progress && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-muted rounded-full h-2 max-w-xs">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${progress.completion_percentage}%` }}
                  />
                </div>
                <Badge variant="outline">
                  {progress.completion_percentage}% Complete
                </Badge>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!progress?.completed && blocks.length > 0 && (
              <Button onClick={handleMarkLessonComplete} variant="outline">
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
            <Button onClick={() => setShowAddBlock(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Content
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {blocks.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-sm">No content blocks yet.</p>
            <p className="text-xs mt-1">Add your first content block to get started.</p>
            <Button className="mt-4" onClick={() => setShowAddBlock(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Content Block
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {blocks.map((block) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    onEdit={setEditingBlock}
                    onDelete={handleDeleteBlock}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add Block Dialog */}
        {showAddBlock && (
          <div className="mt-4">
            <ContentBlockEditor
              position={blocks.length}
              onSave={handleAddBlock}
              onCancel={() => setShowAddBlock(false)}
            />
          </div>
        )}

        {/* Edit Block Dialog */}
        {editingBlock && (
          <div className="mt-4">
            <ContentBlockEditor
              block={editingBlock}
              position={editingBlock.position}
              onSave={handleUpdateBlock}
              onCancel={() => setEditingBlock(null)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LessonContentEditor;