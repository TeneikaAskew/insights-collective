
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, GripVertical } from 'lucide-react';
import { useContentBlocks } from '@/hooks/useContentBlocks';
import { ContentBlock, ContentBlockInput } from '@/types/moduleContent';
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
  SortableContext as SortableContextType,
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

interface EnhancedModuleContentEditorProps {
  moduleId?: string;
  lessonId?: string;
}

const EnhancedModuleContentEditor: React.FC<EnhancedModuleContentEditorProps> = ({
  moduleId,
  lessonId
}) => {
  const { blocks, loading, addBlock, updateBlock, deleteBlock, reorderBlocks } = useContentBlocks(moduleId, lessonId);
  const [showEditor, setShowEditor] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const activeIndex = blocks.findIndex((block) => block.id === active.id);
      const overIndex = blocks.findIndex((block) => block.id === over?.id);

      const reorderedBlocks = arrayMove(blocks, activeIndex, overIndex);
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

  const handleSaveBlock = async (blockData: ContentBlockInput) => {
    if (editingBlock) {
      await updateBlock(editingBlock.id, blockData);
    } else {
      await addBlock(blockData);
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
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">
            {lessonId ? 'Lesson Content' : 'Module Content'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {lessonId 
              ? 'Create content blocks for this specific lesson'
              : 'Create content blocks at the module level or organize into lessons'
            }
          </p>
        </div>
        <Button onClick={handleAddBlock} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Add Content Block
        </Button>
      </div>

      {showEditor && (
        <ContentBlockEditor
          block={editingBlock || undefined}
          position={blocks.length}
          onSave={handleSaveBlock}
          onCancel={handleCancelEdit}
        />
      )}

      {blocks.length === 0 && !showEditor ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="text-4xl">📚</div>
              <h3 className="text-lg font-medium">
                {lessonId ? 'No lesson content yet' : 'No content blocks yet'}
              </h3>
              <p className="text-muted-foreground max-w-md">
                {lessonId 
                  ? 'Start building this lesson by adding content blocks like text, images, videos, and quizzes.'
                  : 'Start building your module by adding content blocks. You can add text, images, videos, quizzes, and more to create an engaging learning experience.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
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
                  onEdit={handleEditBlock}
                  onDelete={(blockId) => {
                    // Show confirmation dialog before deleting
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

export default EnhancedModuleContentEditor;
