
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Trash2 } from 'lucide-react';
import { FieldEditorProps } from './types';
import { Draggable } from 'react-beautiful-dnd';
import { GripVertical } from 'lucide-react';

const FieldEditor: React.FC<FieldEditorProps> = ({ 
  field, 
  sectionId, 
  fieldIndex, 
  onUpdateField, 
  onRemoveField 
}) => {
  return (
    <Draggable key={field.id} draggableId={field.id} index={fieldIndex}>
      {(provided) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="border rounded-md p-4 bg-gray-50"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center flex-1">
              <div {...provided.dragHandleProps} className="mr-2 cursor-grab">
                <GripVertical className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                value={field.label || ''}
                onChange={(e) => onUpdateField(sectionId, field.id, { label: e.target.value })}
                className="bg-transparent"
                placeholder="Question Label"
              />
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onRemoveField(sectionId, field.id)}
              className="ml-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div>
              <Label htmlFor={`field-type-${field.id}`}>Question Type</Label>
              <Select
                value={field.type}
                onValueChange={(value: any) => {
                  const needsOptions = ['dropdown', 'radio', 'checkbox', 'multi_select'].includes(value);
                  const hadOptions = field.type && ['dropdown', 'radio', 'checkbox', 'multi_select'].includes(field.type);
                  
                  let updates: Partial<any> = { type: value };
                  
                  if (needsOptions && !hadOptions) {
                    updates.options = ['Option 1', 'Option 2', 'Option 3'];
                  }
                  
                  onUpdateField(sectionId, field.id, updates);
                }}
              >
                <SelectTrigger id={`field-type-${field.id}`}>
                  <SelectValue placeholder="Select field type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Text</SelectLabel>
                    <SelectItem value="short_text">Short Text</SelectItem>
                    <SelectItem value="long_text">Long Text</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Options</SelectLabel>
                    <SelectItem value="dropdown">Dropdown</SelectItem>
                    <SelectItem value="radio">Radio Buttons</SelectItem>
                    <SelectItem value="checkbox">Checkboxes</SelectItem>
                    <SelectItem value="multi_select">Multi-Select</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Other</SelectLabel>
                    <SelectItem value="date">Date Picker</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id={`required-${field.id}`}
                checked={!!field.required}
                onCheckedChange={(checked) => onUpdateField(sectionId, field.id, { required: checked })}
              />
              <Label htmlFor={`required-${field.id}`}>Required</Label>
            </div>
          </div>

          {field.type && ['dropdown', 'radio', 'checkbox', 'multi_select'].includes(field.type) && (
            <div className="mt-4">
              <Accordion type="single" collapsible defaultValue="options">
                <AccordionItem value="options">
                  <AccordionTrigger>Options</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {Array.isArray(field.options) && field.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center">
                          <Input
                            value={option}
                            onChange={(e) => {
                              const newOptions = Array.isArray(field.options) ? [...field.options] : [];
                              newOptions[optionIndex] = e.target.value;
                              onUpdateField(sectionId, field.id, { options: newOptions });
                            }}
                            placeholder={`Option ${optionIndex + 1}`}
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newOptions = Array.isArray(field.options) ? [...field.options] : [];
                              if (newOptions.length > 0) {
                                newOptions.splice(optionIndex, 1);
                                onUpdateField(sectionId, field.id, { options: newOptions });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newOptions = Array.isArray(field.options) ? 
                            [...field.options, `Option ${(field.options.length || 0) + 1}`] : 
                            [`Option 1`];
                          onUpdateField(sectionId, field.id, { options: newOptions });
                        }}
                        className="w-full mt-2"
                      >
                        Add Option
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
          
          <Accordion type="single" collapsible className="mt-2">
            <AccordionItem value="validation">
              <AccordionTrigger>Validation</AccordionTrigger>
              <AccordionContent>
                {field.type && ['short_text', 'long_text'].includes(field.type) && (
                  <div className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor={`min-length-${field.id}`}>Min Length</Label>
                        <Input
                          id={`min-length-${field.id}`}
                          type="number"
                          value={field.validation?.minLength || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            onUpdateField(sectionId, field.id, { 
                              validation: {
                                ...(field.validation || {}),
                                minLength: value
                              }
                            });
                          }}
                          min="0"
                          placeholder="No minimum"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`max-length-${field.id}`}>Max Length</Label>
                        <Input
                          id={`max-length-${field.id}`}
                          type="number"
                          value={field.validation?.maxLength || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            onUpdateField(sectionId, field.id, { 
                              validation: {
                                ...(field.validation || {}),
                                maxLength: value
                              }
                            });
                          }}
                          min="0"
                          placeholder="No maximum"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`pattern-${field.id}`}>Pattern (Regex)</Label>
                      <Input
                        id={`pattern-${field.id}`}
                        value={field.validation?.pattern || ''}
                        onChange={(e) => {
                          onUpdateField(sectionId, field.id, { 
                            validation: {
                              ...(field.validation || {}),
                              pattern: e.target.value || undefined
                            }
                          });
                        }}
                        placeholder="e.g., ^[A-Za-z0-9]+$"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`message-${field.id}`}>Error Message</Label>
                      <Input
                        id={`message-${field.id}`}
                        value={field.validation?.message || ''}
                        onChange={(e) => {
                          onUpdateField(sectionId, field.id, { 
                            validation: {
                              ...(field.validation || {}),
                              message: e.target.value
                            }
                          });
                        }}
                        placeholder="Custom error message"
                      />
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </Draggable>
  );
};

export default FieldEditor;
