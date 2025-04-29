
import React, { useState } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, SelectContent, SelectGroup, 
  SelectItem, SelectLabel, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FormField } from '@/types/forms';
import { GripVertical, Trash2, Plus, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FieldEditorProps {
  field: FormField;
  index: number;
  sectionId: string;
  onUpdateField: (sectionId: string, fieldId: string, data: Partial<FormField>) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
}

const FieldEditor: React.FC<FieldEditorProps> = ({ 
  field, 
  index, 
  sectionId,
  onUpdateField,
  onRemoveField
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newOption, setNewOption] = useState('');

  const handleFieldTypeChange = (value: string) => {
    // Convert string value to the appropriate FormField type
    const fieldType = value as FormField['type'];
    
    let updatedField: Partial<FormField> = { type: fieldType };
    
    // Add default options for select types
    if (['dropdown', 'radio', 'checkbox', 'multi_select'].includes(fieldType)) {
      updatedField.options = field.options?.length ? field.options : ['Option 1', 'Option 2', 'Option 3'];
    }
    
    // Add file types for file uploads
    if (fieldType === 'file_upload') {
      updatedField.file_types = field.file_types?.length ? field.file_types : ['.pdf', '.docx', '.doc'];
      updatedField.max_size_mb = field.max_size_mb || 5;
    }
    
    onUpdateField(sectionId, field.id, updatedField);
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    
    const updatedOptions = [...(field.options || []), newOption.trim()];
    onUpdateField(sectionId, field.id, { options: updatedOptions });
    setNewOption('');
  };

  const removeOption = (index: number) => {
    const updatedOptions = field.options?.filter((_, i) => i !== index);
    onUpdateField(sectionId, field.id, { options: updatedOptions });
  };

  const addFileType = () => {
    if (!newOption.trim()) return;
    
    let fileType = newOption.trim();
    // Add dot prefix if missing
    if (!fileType.startsWith('.')) {
      fileType = '.' + fileType;
    }
    
    const updatedFileTypes = [...(field.file_types || []), fileType];
    onUpdateField(sectionId, field.id, { file_types: updatedFileTypes });
    setNewOption('');
  };

  const removeFileType = (index: number) => {
    const updatedFileTypes = field.file_types?.filter((_, i) => i !== index);
    onUpdateField(sectionId, field.id, { file_types: updatedFileTypes });
  };

  return (
    <Draggable draggableId={field.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="mb-4"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div {...provided.dragHandleProps} className="flex items-center cursor-grab">
                  <GripVertical className="h-6 w-6 text-gray-400" />
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <Label htmlFor={`field-label-${field.id}`} className="mb-2 block">Question Text</Label>
                      <Input
                        id={`field-label-${field.id}`}
                        value={field.label}
                        onChange={(e) => onUpdateField(sectionId, field.id, { label: e.target.value })}
                        placeholder="Enter question text"
                      />
                    </div>
                    
                    <div className="w-full sm:w-1/3">
                      <Label htmlFor={`field-type-${field.id}`} className="mb-2 block">Field Type</Label>
                      <Select 
                        value={field.type} 
                        onValueChange={handleFieldTypeChange}
                      >
                        <SelectTrigger id={`field-type-${field.id}`}>
                          <SelectValue placeholder="Select field type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Text Fields</SelectLabel>
                            <SelectItem value="short_text">Short Text</SelectItem>
                            <SelectItem value="long_text">Long Text</SelectItem>
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Choice Fields</SelectLabel>
                            <SelectItem value="dropdown">Dropdown</SelectItem>
                            <SelectItem value="radio">Radio Buttons</SelectItem>
                            <SelectItem value="checkbox">Checkboxes</SelectItem>
                            <SelectItem value="multi_select">Multi-select</SelectItem>
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Other Fields</SelectLabel>
                            <SelectItem value="date_picker">Date Picker</SelectItem>
                            <SelectItem value="slider">Slider</SelectItem>
                            <SelectItem value="file_upload">File Upload</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id={`field-required-${field.id}`}
                      checked={field.required}
                      onCheckedChange={(checked) => onUpdateField(sectionId, field.id, { required: checked })}
                    />
                    <Label htmlFor={`field-required-${field.id}`}>Required field</Label>
                  </div>

                  {/* Options Editor for Select/Radio/Checkbox Types */}
                  {['dropdown', 'radio', 'checkbox', 'multi_select'].includes(field.type) && (
                    <div className="mt-4 border border-gray-200 rounded-lg p-4">
                      <Label className="mb-2 block">Options</Label>
                      <ScrollArea className="max-h-[200px]">
                        <div className="space-y-2">
                          {field.options?.map((option, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const updatedOptions = [...(field.options || [])];
                                  updatedOptions[i] = e.target.value;
                                  onUpdateField(sectionId, field.id, { options: updatedOptions });
                                }}
                              />
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => removeOption(i)}
                                type="button"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <div className="flex gap-2 mt-4">
                        <Input
                          value={newOption}
                          onChange={(e) => setNewOption(e.target.value)}
                          placeholder="Add new option"
                          className="flex-1"
                        />
                        <Button onClick={addOption} size="sm" type="button">
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* File Upload Options */}
                  {field.type === 'file_upload' && (
                    <div className="mt-4 border border-gray-200 rounded-lg p-4">
                      <div className="mb-4">
                        <Label htmlFor={`field-max-size-${field.id}`} className="mb-2 block">Max File Size (MB)</Label>
                        <Input
                          id={`field-max-size-${field.id}`}
                          type="number"
                          value={field.max_size_mb || 5}
                          onChange={(e) => onUpdateField(sectionId, field.id, { max_size_mb: Number(e.target.value) })}
                        />
                      </div>
                      
                      <Label className="mb-2 block">Allowed File Types</Label>
                      <ScrollArea className="max-h-[200px]">
                        <div className="space-y-2">
                          {field.file_types?.map((fileType, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                value={fileType}
                                onChange={(e) => {
                                  const updatedFileTypes = [...(field.file_types || [])];
                                  updatedFileTypes[i] = e.target.value;
                                  onUpdateField(sectionId, field.id, { file_types: updatedFileTypes });
                                }}
                              />
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => removeFileType(i)}
                                type="button"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <div className="flex gap-2 mt-4">
                        <Input
                          value={newOption}
                          onChange={(e) => setNewOption(e.target.value)}
                          placeholder="Add file type (e.g., .pdf)"
                          className="flex-1"
                        />
                        <Button onClick={addFileType} size="sm" type="button">
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Additional field settings could go here */}
                  {field.type === 'long_text' && (
                    <div className="mt-4">
                      <Label htmlFor={`field-max-words-${field.id}`}>Maximum Words (optional)</Label>
                      <Input
                        id={`field-max-words-${field.id}`}
                        type="number"
                        min={0}
                        value={field.max_words || ''}
                        onChange={(e) => {
                          const value = e.target.value ? Number(e.target.value) : undefined;
                          onUpdateField(sectionId, field.id, { max_words: value });
                        }}
                        placeholder="No limit"
                      />
                    </div>
                  )}
                  
                  {field.type === 'checkbox' && !field.options?.length && (
                    <div className="mt-4">
                      <Label htmlFor={`field-text-${field.id}`}>Checkbox Label Text</Label>
                      <Textarea
                        id={`field-text-${field.id}`}
                        value={field.text || ''}
                        onChange={(e) => onUpdateField(sectionId, field.id, { text: e.target.value })}
                        placeholder="Enter checkbox label text"
                        rows={3}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    type="button"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this field and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onRemoveField(sectionId, field.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </Draggable>
  );
};

export default FieldEditor;
