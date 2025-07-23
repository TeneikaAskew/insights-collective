import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, GripVertical, Save } from 'lucide-react';
import { useRubric } from '@/hooks/useRubrics';
import { RubricCriteria, RubricLevel } from '@/types/course';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';

interface RubricBuilderProps {
  rubricId: string;
  onSave?: () => void;
}

interface CriteriaItemProps {
  criteria: RubricCriteria;
  onUpdate: (updates: Partial<RubricCriteria>) => void;
  onDelete: () => void;
}

const CriteriaItem: React.FC<CriteriaItemProps> = ({ criteria, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [levels, setLevels] = useState<RubricLevel[]>(criteria.levels || []);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: criteria.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleAddLevel = () => {
    const newLevel: RubricLevel = {
      title: `Level ${levels.length + 1}`,
      description: '',
      points: 0,
    };
    setLevels([...levels, newLevel]);
  };

  const handleUpdateLevel = (index: number, updates: Partial<RubricLevel>) => {
    const updatedLevels = [...levels];
    updatedLevels[index] = { ...updatedLevels[index], ...updates };
    setLevels(updatedLevels);
  };

  const handleRemoveLevel = (index: number) => {
    setLevels(levels.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onUpdate({ levels });
    setIsEditing(false);
  };

  return (
    <Card ref={setNodeRef} style={style} className={`mb-4 ${isDragging ? 'cursor-move' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between p-4">
        <div className="flex items-center gap-2 flex-1">
          <div {...attributes} {...listeners} className="cursor-move">
            <GripVertical className="h-5 w-5 text-gray-400" />
          </div>
          {isEditing ? (
            <Input
              value={criteria.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="flex-1"
              placeholder="Criteria title"
            />
          ) : (
            <h4 className="font-medium flex-1">{criteria.title}</h4>
          )}
          <span className="text-sm text-gray-500">{criteria.points} points</span>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      {isEditing && (
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={criteria.description || ''}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Describe this criteria..."
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Total Points</label>
              <Input
                type="number"
                value={criteria.points}
                onChange={(e) => onUpdate({ points: parseFloat(e.target.value) || 0 })}
                placeholder="Points"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Performance Levels</label>
                <Button size="sm" onClick={handleAddLevel}>
                  <Plus className="h-4 w-4 mr-1" /> Add Level
                </Button>
              </div>
              <div className="space-y-2">
                {levels.map((level, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={level.title}
                        onChange={(e) => handleUpdateLevel(index, { title: e.target.value })}
                        placeholder="Level title"
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={level.points}
                        onChange={(e) => handleUpdateLevel(index, { points: parseFloat(e.target.value) || 0 })}
                        placeholder="Points"
                        className="w-24"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveLevel(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={level.description}
                      onChange={(e) => handleUpdateLevel(index, { description: e.target.value })}
                      placeholder="Level description..."
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export const RubricBuilder: React.FC<RubricBuilderProps> = ({ rubricId, onSave }) => {
  const { rubric, createCriteria, updateCriteria, deleteCriteria, reorderCriteria } = useRubric(rubricId);
  const [criteriaList, setCriteriaList] = useState<RubricCriteria[]>([]);

  React.useEffect(() => {
    if (rubric?.criteria) {
      setCriteriaList(rubric.criteria.sort((a, b) => a.order_index - b.order_index));
    }
  }, [rubric]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = criteriaList.findIndex((item) => item.id === active.id);
      const newIndex = criteriaList.findIndex((item) => item.id === over.id);
      
      const newOrder = arrayMove(criteriaList, oldIndex, newIndex);
      setCriteriaList(newOrder);
      
      // Update order in database
      reorderCriteria(newOrder.map(c => c.id));
    }
  };

  const handleAddCriteria = () => {
    const newCriteria: Omit<RubricCriteria, 'id' | 'created_at'> = {
      rubric_id: rubricId,
      title: 'New Criteria',
      description: '',
      points: 10,
      order_index: criteriaList.length,
      levels: [
        { title: 'Excellent', description: '', points: 10 },
        { title: 'Good', description: '', points: 7 },
        { title: 'Satisfactory', description: '', points: 5 },
        { title: 'Needs Improvement', description: '', points: 2 },
      ],
    };
    createCriteria(newCriteria);
  };

  const handleUpdateCriteria = (criteriaId: string, updates: Partial<RubricCriteria>) => {
    updateCriteria({ id: criteriaId, updates });
  };

  const handleDeleteCriteria = (criteriaId: string) => {
    deleteCriteria(criteriaId);
  };

  if (!rubric) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{rubric.title}</CardTitle>
          {rubric.description && (
            <p className="text-sm text-gray-500">{rubric.description}</p>
          )}
        </CardHeader>
        <CardContent>
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={criteriaList.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {criteriaList.map((criteria) => (
                <CriteriaItem
                  key={criteria.id}
                  criteria={criteria}
                  onUpdate={(updates) => handleUpdateCriteria(criteria.id, updates)}
                  onDelete={() => handleDeleteCriteria(criteria.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
          
          <Button onClick={handleAddCriteria} className="w-full mt-4">
            <Plus className="h-4 w-4 mr-2" /> Add Criteria
          </Button>
        </CardContent>
      </Card>
      
      {onSave && (
        <div className="flex justify-end">
          <Button onClick={onSave}>
            <Save className="h-4 w-4 mr-2" /> Save Rubric
          </Button>
        </div>
      )}
    </div>
  );
};