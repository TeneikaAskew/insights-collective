
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Eye, PlusCircle, Save } from 'lucide-react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from 'uuid';
import { FormBuilderProps } from './types';
import { FormField, FormSection, FormStructure } from '@/types/forms';
import SectionEditor from './SectionEditor';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { createLogger } from '@/utils/logger';

const logger = createLogger('addSection');

const FormBuilder: React.FC<FormBuilderProps> = ({ initialFormData, viewMode = false }) => {
  const [loading, setLoading] = useState(!initialFormData);
  const [saving, setSaving] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<{
    id: string;
    title: string;
    description: string;
    status: boolean;
    slug?: string;
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
        slug: initialFormData.slug,
      });

      // Safely initialize the form structure
      const safeFormStructure: FormStructure = {
        sections: Array.isArray(initialFormData.form_structure?.sections) ? 
          initialFormData.form_structure.sections : []
      };
      
      setFormStructure(safeFormStructure);
      setLoading(false);
    }
  }, [initialFormData]);

  useEffect(() => {
    // Load submissions if in viewMode and we have a form ID
    if (viewMode && formData?.id) {
      fetchSubmissions();
    }
  }, [viewMode, formData?.id]);

  const fetchSubmissions = async () => {
    if (!formData?.id) return;
    
    setLoadingSubmissions(true);
    try {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', formData.id)
        .eq('draft', false)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setSubmissions(data || []);
    } catch (error) {
      logger.error('Error fetching submissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load form submissions',
        variant: 'destructive'
      });
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleSaveForm = async () => {
    if (!formData?.id) {
      logger.error("No form ID available for saving");
      toast({
        title: 'Error',
        description: 'Cannot save: Form ID is missing',
        variant: 'destructive'
      });
      return;
    }
    
    setSaving(true);
    try {
      logger.log("Saving form structure:", formStructure);
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
      logger.error('Error saving form:', error);
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

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    
    // If there is no destination or source is the same as destination, do nothing
    if (!destination || 
      (source.droppableId === destination.droppableId && source.index === destination.index)) {
      return;
    }

    // Make sure formStructure exists and sections is an array
    if (!formStructure || !Array.isArray(formStructure.sections)) {
      logger.error("Invalid form structure for drag and drop");
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
      logger.error("Source or destination section not found");
      return;
    }
    
    // Ensure fields arrays exist
    const sourceFields = Array.isArray(sourceSection.fields) ? [...sourceSection.fields] : [];
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
      <div className="flex justify-center py-10">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-muted-foreground">Loading form data...</p>
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

  if (viewMode) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Button variant="ghost" onClick={() => navigate('/admin/forms')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {formData.title || 'Untitled Form'} - Submissions
            </h1>
            <p className="text-muted-foreground mt-2">{formData.description || 'No description'}</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => navigate(`/survey/${formData.slug}/edit`)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Edit Form
            </Button>
          </div>
        </div>

        {loadingSubmissions ? (
          <div className="flex justify-center py-10">
            <div className="flex flex-col items-center gap-4">
              <Spinner size="lg" />
              <p className="text-muted-foreground">Loading submissions...</p>
            </div>
          </div>
        ) : submissions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p>No submissions yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <Card key={submission.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <div className="flex justify-between">
                    <CardTitle className="text-lg">
                      Submission #{submission.id.slice(0, 8)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date(submission.created_at).toLocaleString()}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm overflow-auto max-h-96">
                    {JSON.stringify(submission.submission_data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Ensure sections is always a valid array
  const sections = Array.isArray(formStructure?.sections) ? formStructure.sections : [];

  return (
    <div className="space-y-6">
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
          {formData.slug && (
            <Button 
              variant="outline"
              onClick={() => navigate(`/survey/${formData.slug}`)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
          )}
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
              logger.error('Error updating form status:', error);
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
                    <SectionEditor
                      key={section.id}
                      section={section}
                      sectionIndex={index}
                      onUpdateSection={updateSection}
                      onRemoveSection={removeSection}
                      onAddField={addField}
                      onUpdateField={updateField}
                      onRemoveField={removeField}
                    />
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
};

export default FormBuilder;
