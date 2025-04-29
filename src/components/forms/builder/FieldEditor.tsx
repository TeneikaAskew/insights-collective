
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
import { GripVertical, Trash2, Plus, X, List, SlidersHorizontal, ListCheck } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [activeTab, setActiveTab] = useState('basic');

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
    
    // Add min/max values for sliders
    if (fieldType === 'slider') {
      updatedField.min = field.min !== undefined ? field.min : 0;
      updatedField.max = field.max !== undefined ? field.max : 100;
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

  const renderValidationOptions = () => {
    if (['short_text', 'long_text'].includes(field.type)) {
      return (
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`field-validation-type-${field.id}`}>Validation Type</Label>
            <Select 
              value={field.validation?.type || ''} 
              onValueChange={(value) => {
                const validation = { ...(field.validation || {}), type: value as any };
                onUpdateField(sectionId, field.id, { validation });
              }}
            >
              <SelectTrigger id={`field-validation-type-${field.id}`}>
                <SelectValue placeholder="Select validation type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                <SelectItem value="numeric_only">Numbers only</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="url">URL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col gap-2">
            <Label htmlFor={`field-min-length-${field.id}`}>Minimum Length</Label>
            <Input
              id={`field-min-length-${field.id}`}
              type="number"
              min={0}
              value={field.validation?.minLength || ''}
              onChange={(e) => {
                const minLength = e.target.value ? parseInt(e.target.value, 10) : undefined;
                const validation = { ...(field.validation || {}), minLength };
                onUpdateField(sectionId, field.id, { validation });
              }}
              placeholder="No minimum"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <Label htmlFor={`field-max-length-${field.id}`}>Maximum Length</Label>
            <Input
              id={`field-max-length-${field.id}`}
              type="number"
              min={0}
              value={field.validation?.maxLength || ''}
              onChange={(e) => {
                const maxLength = e.target.value ? parseInt(e.target.value, 10) : undefined;
                const validation = { ...(field.validation || {}), maxLength };
                onUpdateField(sectionId, field.id, { validation });
              }}
              placeholder="No maximum"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <Label htmlFor={`field-pattern-${field.id}`}>Regex Pattern (advanced)</Label>
            <Input
              id={`field-pattern-${field.id}`}
              value={field.validation?.pattern || ''}
              onChange={(e) => {
                const pattern = e.target.value || undefined;
                const validation = { ...(field.validation || {}), pattern };
                onUpdateField(sectionId, field.id, { validation });
              }}
              placeholder="e.g., ^[0-9]{5}$ for 5-digit zip"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <Label htmlFor={`field-validation-message-${field.id}`}>Error Message</Label>
            <Input
              id={`field-validation-message-${field.id}`}
              value={field.validation?.message || ''}
              onChange={(e) => {
                const message = e.target.value || undefined;
                const validation = { ...(field.validation || {}), message };
                onUpdateField(sectionId, field.id, { validation });
              }}
              placeholder="e.g., Please enter a valid 5-digit zip code"
            />
          </div>
        </div>
      );
    }
    
    return (
      <div className="p-4 text-center text-muted-foreground">
        No validation options available for this field type.
      </div>
    );
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

                  <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="basic">Options</TabsTrigger>
                      <TabsTrigger value="validation">Validation</TabsTrigger>
                    </TabsList>
                    <TabsContent value="basic" className="mt-2">
                      {/* Options Editor for Select/Radio/Checkbox Types */}
                      {['dropdown', 'radio', 'checkbox', 'multi_select'].includes(field.type) && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <Label className="mb-2 block">Options</Label>
                          <ScrollArea className="h-[200px] border rounded p-2">
                            <div className="space-y-2 pr-4">
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

                      {/* Slider Options */}
                      {field.type === 'slider' && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`field-min-${field.id}`} className="mb-2 block">Minimum Value</Label>
                              <Input
                                id={`field-min-${field.id}`}
                                type="number"
                                value={field.min !== undefined ? field.min : 0}
                                onChange={(e) => onUpdateField(sectionId, field.id, { min: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`field-max-${field.id}`} className="mb-2 block">Maximum Value</Label>
                              <Input
                                id={`field-max-${field.id}`}
                                type="number"
                                value={field.max !== undefined ? field.max : 100}
                                onChange={(e) => onUpdateField(sectionId, field.id, { max: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                          <div className="mt-4">
                            <Label htmlFor={`field-step-${field.id}`} className="mb-2 block">Step (optional)</Label>
                            <Input
                              id={`field-step-${field.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={field.step || ''}
                              onChange={(e) => {
                                const value = e.target.value ? Number(e.target.value) : undefined;
                                onUpdateField(sectionId, field.id, { step: value });
                              }}
                              placeholder="Default: 1"
                            />
                          </div>
                        </div>
                      )}

                      {/* File Upload Options */}
                      {field.type === 'file_upload' && (
                        <div className="border border-gray-200 rounded-lg p-4">
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
                          <ScrollArea className="h-[200px] border rounded p-2">
                            <div className="space-y-2 pr-4">
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
                    </TabsContent>
                    <TabsContent value="validation" className="mt-2">
                      <div className="border border-gray-200 rounded-lg p-4">
                        {renderValidationOptions()}
                      </div>
                    </TabsContent>
                  </Tabs>
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
