
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, GripVertical } from 'lucide-react';
import { Draggable, Droppable } from 'react-beautiful-dnd';
import { SectionEditorProps } from './types';
import FieldEditor from './FieldEditor';

const SectionEditor: React.FC<SectionEditorProps> = ({
  section,
  sectionIndex,
  onUpdateSection,
  onRemoveSection,
  onAddField,
  onUpdateField,
  onRemoveField
}) => {
  return (
    <Draggable key={section.id} draggableId={section.id} index={sectionIndex}>
      {(provided) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="border rounded-lg p-4 bg-card shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div {...provided.dragHandleProps} className="mr-2 cursor-grab">
                <GripVertical />
              </div>
              <Input
                value={section.title || ''}
                onChange={(e) => onUpdateSection(section.id, { title: e.target.value })}
                className="text-xl font-medium bg-transparent border-none focus-visible:ring-0 focus-visible:border-b focus-visible:rounded-none"
                placeholder="Section Title"
              />
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onRemoveSection(section.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <Textarea
            value={section.description || ''}
            onChange={(e) => onUpdateSection(section.id, { description: e.target.value })}
            placeholder="Section Description (optional)"
            className="mb-4"
          />

          <Droppable droppableId={section.id} type="field">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-4"
              >
                {Array.isArray(section.fields) && section.fields.length > 0 ? (
                  section.fields.map((field, fieldIndex) => (
                    <FieldEditor
                      key={field.id}
                      field={field}
                      sectionId={section.id}
                      index={fieldIndex}
                      onUpdateField={onUpdateField}
                      onRemoveField={onRemoveField}
                    />
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No questions added yet
                  </div>
                )}
                {provided.placeholder}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddField(section.id)}
                  className="w-full"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </div>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
};

export default SectionEditor;
