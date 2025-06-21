
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, GripVertical, ArrowLeft } from 'lucide-react';
import { useContentBlocks, ContentBlock } from '@/hooks/useContentBlocks';
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
      <div className="absolute left-2 top-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      </div>
      <div className="pl-10">
        <ContentBlockRenderer
          block={block}
          onEdit={onEdit}
          onDelete={onDelete}
          showControls={true}
        />
      </div>
    </div>
  );
};

interface LessonContentEditorProps {
  lessonId: string;
  lessonTitle: string;
  onBack: () => void;
}

const LessonContentEditor: React.FC<LessonContentEditorProps> = ({
  lessonId,
  lessonTitle,
  onBack
}) => {
  const { blocks, loading, addBlock, updateBlock, deleteBlock, reorderBlocks } = useContentBlocks(undefined, lessonId);
  const [showEditor, setShowEditor] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null);

  // All blocks are already filtered for this lesson by the hook
  const lessonBlocks = blocks;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const activeIndex = lessonBlocks.findIndex((block) => block.id === active.id);
      const overIndex = lessonBlocks.findIndex((block) => block.id === over?.id);

      const reorderedBlocks = arrayMove(lessonBlocks, activeIndex, overIndex);
      reorderBlocks(reorderedBlocks);
    }
  };

  const handleAddBlock = () => {
    setEditingBlock(null);
    setShowEditor(true);
  };

  const handleEditBlock = (block: ContentBlock) => {
    setEditingBlock(block);
    setShowEditor(true);
  };

  const handleSaveBlock = async (blockData: Omit<ContentBlock, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    const blockWithLesson = {
      ...blockData,
      lesson_id: lessonId,
      module_id: '', // This will be ignored since we're using lesson_id now
    };

    if (editingBlock) {
      await updateBlock(editingBlock.id, blockWithLesson);
    } else {
      await addBlock(blockWithLesson);
    }
    setShowEditor(false);
    setEditingBlock(null);
  };

  const handleDeleteBlock = async (blockId: string) => {
    await deleteBlock(blockId);
  };

  const handleCancelEdit = () => {
    setShowEditor(false);
    setEditingBlock(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lessons
          </Button>
          <div>
            <h3 className="text-lg font-medium">{lessonTitle}</h3>
            <p className="text-sm text-gray-600">
              Create content blocks for this lesson
            </p>
          </div>
        </div>
        <Button onClick={handleAddBlock}>
          <Plus className="h-4 w-4 mr-2" />
          Add Content Block
        </Button>
      </div>

      {showEditor && (
        <ContentBlockEditor
          block={editingBlock || undefined}
          position={lessonBlocks.length}
          onSave={handleSaveBlock}
          onCancel={handleCancelEdit}
        />
      )}

      {lessonBlocks.length === 0 && !showEditor ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="text-4xl">📚</div>
              <h3 className="text-lg font-medium">No content blocks yet</h3>
              <p className="text-gray-600 max-w-md">
                Start building this lesson by adding content blocks. You can add text, images, 
                videos, quizzes, and more to create an engaging learning experience.
              </p>
              <Button onClick={handleAddBlock}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Content Block
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={lessonBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {lessonBlocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  onEdit={handleEditBlock}
                  onDelete={(blockId) => {
                    if (window.confirm('Are you sure you want to delete this content block? This action cannot be undone.')) {
                      handleDeleteBlock(blockId);
                    }
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default LessonContentEditor;
