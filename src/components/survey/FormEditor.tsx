import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FormSection, FormField, FormStructure } from '@/types/forms';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from 'uuid';
import { PlusCircle, Trash2, GripVertical, Save, ArrowLeft, Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

interface FormEditorProps {
  initialFormData?: {
    id: string;
    title: string;
    description: string;
    status: boolean;
    form_structure?: FormStructure;
  } | null;
}

export default function FormEditor({ initialFormData }: FormEditorProps) {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(!initialFormData);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<{
    id: string;
    title: string;
    description: string;
    status: boolean;
  } | null>(null);

  const [formStructure, setFormStructure] = useState<FormStructure>({
    sections: []
  });

  useEffect(() => {
    if (initialFormData) {
      setFormData({
        id: initialFormData.id,
        title: initialFormData.title || '',
        description: initialFormData.description || '',
        status: Boolean(initialFormData.status),
      });

      // Safely initialize the form structure
      const safeFormStructure: FormStructure = {
        sections: Array.isArray(initialFormData.form_structure?.sections) ? 
          initialFormData.form_structure.sections : []
      };
      
      setFormStructure(safeFormStructure);
      setLoading(false);
    } else if (slug) {
      const fetchForm = async () => {
        try {
          console.log("Fetching form data for slug:", slug);
          const { data, error } = await supabase
            .from('forms')
            .select('*')
            .eq('slug', slug)
            .single();

          if (error) {
            console.error("Error fetching form:", error);
            throw error;
          }

          if (!data) {
            console.error("No data returned for slug:", slug);
            throw new Error(`Form with slug "${slug}" not found`);
          }

          console.log("Form data received:", data);

          setFormData({
            id: data.id,
            title: data.title || '',
            description: data.description || '',
            status: Boolean(data.status)
          });

          // Safely initialize the form structure
          const formStructData: FormStructure = {
            sections: Array.isArray(data.form_structure?.sections) ? 
              data.form_structure.sections : []
          };
          
          console.log("Form structure initialized:", formStructData);
          setFormStructure(formStructData);
        } catch (error: any) {
          console.error('Error fetching form:', error);
          toast({
            title: 'Error',
            description: 'Could not load form data: ' + (error.message || 'Unknown error'),
            variant: 'destructive'
          });
        } finally {
          setLoading(false);
        }
      };

      fetchForm();
    } else {
      // Handle case where there's no initialFormData and no slug
      console.log("No initial form data or slug provided");
      setLoading(false);
    }
  }, [initialFormData, slug, toast]);

  const handleSaveForm = async () => {
    if (!formData?.id) {
      console.error("No form ID available for saving");
      toast({
        title: 'Error',
        description: 'Cannot save: Form ID is missing',
        variant: 'destructive'
      });
      return;
    }
    
    setSaving(true);
    try {
      console.log("Saving form structure:", formStructure);
      const { error } = await supabase
        .from('forms')
        .update({
          form_structure: formStructure
        })
        .eq('id', formData.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Form structure saved successfully'
      });
    } catch (error: any) {
      console.error('Error saving form:', error);
      toast({
        title: 'Error',
        description: 'Failed to save form structure: ' + (error.message || 'Unknown error'),
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const addSection = () => {
    setFormStructure(prevStructure => {
      const newSections = Array.isArray(prevStructure.sections) ? [...prevStructure.sections] : [];
      return {
        sections: [
          ...newSections,
          {
            id: uuidv4(),
            title: `Section ${newSections.length + 1}`,
            fields: []
          }
        ]
      };
    });
  };

  const updateSection = (sectionId: string, data: Partial<FormSection>) => {
    setFormStructure(prev => {
      if (!prev || !Array.isArray(prev.sections)) {
        return { sections: [] };
      }
      
      return {
        ...prev,
        sections: prev.sections.map(section => 
          section.id === sectionId ? { ...section, ...data } : section
        )
      };
    });
  };

  const removeSection = (sectionId: string) => {
    setFormStructure(prev => {
      if (!prev || !Array.isArray(prev.sections)) {
        return { sections: [] };
      }
      
      return {
        ...prev,
        sections: prev.sections.filter(section => section.id !== sectionId)
      };
    });
  };

  const addField = (sectionId: string) => {
    const newField: FormField = {
      id: uuidv4(),
      label: 'New Question',
      type: 'short_text',
      required: false
    };

    setFormStructure(prev => {
      if (!prev || !Array.isArray(prev.sections)) {
        return { sections: [] };
      }
      
      return {
        ...prev,
        sections: prev.sections.map(section => {
          if (section.id === sectionId) {
            const fields = Array.isArray(section.fields) ? [...section.fields] : [];
            return {
              ...section,
              fields: [...fields, newField]
            };
          }
          return section;
        })
      };
    });
  };

  const updateField = (sectionId: string, fieldId: string, data: Partial<FormField>) => {
    setFormStructure(prev => {
      if (!prev || !Array.isArray(prev.sections)) {
        return { sections: [] };
      }
      
      return {
        ...prev,
        sections: prev.sections.map(section => {
          if (section.id === sectionId) {
            if (!Array.isArray(section.fields)) {
              return { ...section, fields: [] };
            }
            
            return {
              ...section,
              fields: section.fields.map(field => 
                field.id === fieldId ? { ...field, ...data } : field
              )
            };
          }
          return section;
        })
      };
    });
  };

  const removeField = (sectionId: string, fieldId: string) => {
    setFormStructure(prev => {
      if (!prev || !Array.isArray(prev.sections)) {
        return { sections: [] };
      }
      
      return {
        ...prev,
        sections: prev.sections.map(section => {
          if (section.id === sectionId) {
            if (!Array.isArray(section.fields)) {
              return { ...section, fields: [] };
            }
            
            return {
              ...section,
              fields: section.fields.filter(field => field.id !== fieldId)
            };
          }
          return section;
        })
      };
    });
  };

  const onDragEnd = (result: any) => {
    const { source, destination, type } = result;
    
    // If there is no destination or source is the same as destination, do nothing
    if (!destination || 
      (source.droppableId === destination.droppableId && source.index === destination.index)) {
      return;
    }

    // Make sure formStructure exists and sections is an array
    if (!formStructure || !Array.isArray(formStructure.sections)) {
      console.error("Invalid form structure for drag and drop");
      return;
    }

    // Handle section drag and drop
    if (type === 'section') {
      const sections = Array.from(formStructure.sections);
      if (sections.length > 0) {
        const [removed] = sections.splice(source.index, 1);
        sections.splice(destination.index, 0, removed);
        
        setFormStructure({
          sections: sections
        });
      }
      return;
    }
    
    // Handle field drag and drop
    const sections = formStructure.sections;
    const sourceSection = sections.find(s => s.id === source.droppableId);
    const destSection = sections.find(s => s.id === destination.droppableId);
    
    if (!sourceSection || !destSection) {
      console.error("Source or destination section not found");
      return;
    }
    
    // Ensure fields arrays exist
    const sourceFields = Array.isArray(sourceSection.fields) ? [...sourceSection.fields] : [];
    // FIX: Define destFields properly before using it
    const destFields = Array.isArray(destSection.fields) ? [...destSection.fields] : [];

    if (source.droppableId === destination.droppableId) {
      // Moving within the same section
      if (sourceFields.length > 0) {
        const [removed] = sourceFields.splice(source.index, 1);
        sourceFields.splice(destination.index, 0, removed);
        
        setFormStructure({
          sections: sections.map(section => 
            section.id === source.droppableId ? { ...section, fields: sourceFields } : section
          )
        });
      }
    } else {
      // Moving between different sections
      if (sourceFields.length > 0) {
        const [removed] = sourceFields.splice(source.index, 1);
        destFields.splice(destination.index, 0, removed);
        
        setFormStructure({
          sections: sections.map(section => {
            if (section.id === source.droppableId) {
              return { ...section, fields: sourceFields };
            }
            if (section.id === destination.droppableId) {
              return { ...section, fields: destFields };
            }
            return section;
          })
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="container py-10">
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <p className="text-muted-foreground">Loading form data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Form Not Found</CardTitle>
            <CardDescription>The form you are looking for does not exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/admin/forms')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Forms
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ensure sections is always a valid array
  const sections = Array.isArray(formStructure?.sections) ? formStructure.sections : [];
  console.log("Rendering form with sections:", sections);

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/admin/forms')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {formData.title || 'Untitled Form'}
          </h1>
          <p className="text-muted-foreground mt-2">{formData.description || 'No description'}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => navigate(`/survey/${slug}`)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button 
            onClick={handleSaveForm}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Form
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-center mb-4">
        <Label htmlFor="published" className="mr-2">Published:</Label>
        <Switch
          id="published"
          checked={formData.status}
          onCheckedChange={async (checked) => {
            try {
              const { error } = await supabase
                .from('forms')
                .update({ status: checked })
                .eq('id', formData.id);
              
              if (error) throw error;
              
              setFormData({
                ...formData,
                status: checked
              });
              
              toast({
                title: 'Success',
                description: `Form is now ${checked ? 'published' : 'unpublished'}`
              });
            } catch (error: any) {
              console.error('Error updating form status:', error);
              toast({
                title: 'Error',
                description: 'Failed to update form status: ' + (error.message || 'Unknown error'),
                variant: 'destructive'
              });
            }
          }}
        />
        <span className="ml-2 text-sm text-muted-foreground">
          {formData.status ? 'Form is visible to users' : 'Form is hidden from users'}
        </span>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="space-y-6">
          <Droppable droppableId="sections" type="section">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-8"
              >
                {sections && sections.length > 0 ? (
                  sections.map((section, index) => (
                    <Draggable key={section.id} draggableId={section.id} index={index}>
                      {(provided) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="border rounded-lg p-4 bg-white shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                              <div {...provided.dragHandleProps} className="mr-2 cursor-grab">
                                <GripVertical />
                              </div>
                              <Input
                                value={section.title || ''}
                                onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                className="text-xl font-medium bg-transparent border-none focus-visible:ring-0 focus-visible:border-b focus-visible:rounded-none"
                                placeholder="Section Title"
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeSection(section.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <Textarea
                            value={section.description || ''}
                            onChange={(e) => updateSection(section.id, { description: e.target.value })}
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
                                                onChange={(e) => updateField(section.id, field.id, { label: e.target.value })}
                                                className="bg-transparent"
                                                placeholder="Question Label"
                                              />
                                            </div>
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              onClick={() => removeField(section.id, field.id)}
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
                                                  
                                                  let updates: Partial<FormField> = { type: value };
                                                  
                                                  if (needsOptions && !hadOptions) {
                                                    updates.options = ['Option 1', 'Option 2', 'Option 3'];
                                                  }
                                                  
                                                  updateField(section.id, field.id, updates);
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
                                                onCheckedChange={(checked) => updateField(section.id, field.id, { required: checked })}
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
                                                              updateField(section.id, field.id, { options: newOptions });
                                                            }}
                                                            placeholder={`Option ${optionIndex + 1}`}
                                                            className="flex-1"
                                                          />
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                              const newOptions = Array.isArray(field.options) ? 
                                                                [...field.options, `Option ${(field.options.length || 0) + 1}`] : 
                                                                [`Option 1`];
                                                              updateField(section.id, field.id, { options: newOptions });
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
                                                          updateField(section.id, field.id, { options: newOptions });
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
                                                            const validation = field.validation || {};
                                                            updateField(section.id, field.id, { 
                                                              validation: {
                                                                ...validation,
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
                                                            const validation = field.validation || {};
                                                            updateField(section.id, field.id, { 
                                                              validation: {
                                                                ...validation,
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
                                                          const validation = field.validation || {};
                                                          updateField(section.id, field.id, { 
                                                            validation: {
                                                              ...validation,
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
                                                          const validation = field.validation || {};
                                                          updateField(section.id, field.id, { 
                                                            validation: {
                                                              ...validation,
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
                                  onClick={() => addField(section.id)}
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
                  ))
                ) : (
                  <div className="text-center py-8 border rounded-lg">
                    <p className="text-muted-foreground">No sections added yet</p>
                    <Button 
                      variant="outline" 
                      onClick={addSection}
                      className="mt-4"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add First Section
                    </Button>
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          
          {sections && sections.length > 0 && (
            <Button
              variant="outline"
              onClick={addSection}
              className="w-full"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Section
            </Button>
          )}
        </div>
      </DragDropContext>

      <div className="mt-8 flex justify-end">
        <Button 
          onClick={handleSaveForm}
          disabled={saving}
        >
          {saving ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Form
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
