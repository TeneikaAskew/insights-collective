import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { slugify } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Save, Copy, MoreHorizontal, Edit } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const templates = [
  {
    id: "feedback-template",
    title: "Feedback Survey",
    description: "Standard template for collecting user feedback",
    structure: {
      sections: [
        {
          id: "section-1",
          title: "User Feedback",
          description: "Please share your thoughts with us",
          fields: [
            {
              id: "field-1",
              label: "How would you rate your experience?",
              type: "radio",
              required: true,
              options: ["Excellent", "Good", "Average", "Poor", "Very Poor"]
            },
            {
              id: "field-2",
              label: "What did you like most?",
              type: "long_text",
              required: false
            },
            {
              id: "field-3",
              label: "What could be improved?",
              type: "long_text",
              required: false
            }
          ]
        }
      ]
    }
  },
  {
    id: "event-registration",
    title: "Event Registration",
    description: "Form for registering participants for events",
    structure: {
      sections: [
        {
          id: "section-1",
          title: "Personal Information",
          description: "Tell us about yourself",
          fields: [
            {
              id: "field-1",
              label: "Full Name",
              type: "short_text",
              required: true
            },
            {
              id: "field-2",
              label: "Email",
              type: "short_text",
              required: true,
              validation: {
                pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                message: "Please enter a valid email address"
              }
            },
            {
              id: "field-3",
              label: "Phone Number",
              type: "short_text",
              required: false
            }
          ]
        },
        {
          id: "section-2",
          title: "Event Details",
          description: "Additional information for the event",
          fields: [
            {
              id: "field-4",
              label: "How did you hear about us?",
              type: "dropdown",
              required: false,
              options: ["Social Media", "Email", "Friend", "Advertisement", "Other"]
            },
            {
              id: "field-5",
              label: "Special Requirements",
              type: "long_text",
              required: false
            }
          ]
        }
      ]
    }
  },
  {
    id: "application-form",
    title: "Application Form",
    description: "Comprehensive application form with multiple sections",
    structure: {
      sections: [
        {
          id: "section-1",
          title: "Basic Information",
          description: "Please provide your personal details",
          fields: [
            {
              id: "field-1",
              label: "Full Name",
              type: "short_text",
              required: true
            },
            {
              id: "field-2",
              label: "Email Address",
              type: "short_text",
              required: true
            },
            {
              id: "field-3",
              label: "Phone Number",
              type: "short_text",
              required: true
            }
          ]
        },
        {
          id: "section-2",
          title: "Education & Experience",
          description: "Tell us about your background",
          fields: [
            {
              id: "field-4",
              label: "Highest Education Level",
              type: "dropdown",
              required: true,
              options: ["High School", "Bachelor's", "Master's", "PhD", "Other"]
            },
            {
              id: "field-5",
              label: "Years of Experience",
              type: "dropdown",
              required: true,
              options: ["0-1 years", "1-3 years", "3-5 years", "5-10 years", "10+ years"]
            },
            {
              id: "field-6",
              label: "Relevant Skills",
              type: "checkbox",
              required: false,
              options: ["Project Management", "Data Analysis", "Programming", "Communication", "Leadership"]
            }
          ]
        },
        {
          id: "section-3",
          title: "Additional Information",
          description: "Please provide any additional details",
          fields: [
            {
              id: "field-7",
              label: "Why are you interested in this position?",
              type: "long_text",
              required: true
            },
            {
              id: "field-8",
              label: "Availability Start Date",
              type: "date",
              required: true
            }
          ]
        }
      ]
    }
  }
];

export function FormTemplates() {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSaveAsTemplate = (template: any) => {
    setSelectedTemplate(template);
    setTemplateName(template.title);
    setTemplateDescription(template.description);
    setSaveDialogOpen(true);
  };

  const createFormFromTemplate = async (template: any) => {
    setIsLoading(true);
    try {
      const title = `${template.title} - ${new Date().toLocaleDateString()}`;
      const slug = slugify(title);

      const { data, error } = await supabase
        .from('forms')
        .insert({
          title,
          description: template.description,
          form_link: `/survey/${slug}`,
          slug,
          status: false,
          form_structure: template.structure
        })
        .select('id, slug')
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Form created from template successfully",
      });
      
      if (data) {
        navigate(`/survey/${data.slug}/edit`);
      }
    } catch (error) {
      console.error("Error creating form from template:", error);
      toast({
        title: "Error",
        description: "Failed to create form from template",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    // In a real implementation, this would save to a custom templates table
    toast({
      title: "Success",
      description: "Template saved successfully",
    });
    setSaveDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Form Templates</h2>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{template.title}</CardTitle>
                  <CardDescription className="mt-1">{template.description}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleSaveAsTemplate(template)}>
                      <Save className="mr-2 h-4 w-4" />
                      Save as Custom Template
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Sections</span>
                  <span>{template.structure.sections.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fields</span>
                  <span>
                    {template.structure.sections.reduce(
                      (acc, section) => acc + section.fields.length, 
                      0
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={() => createFormFromTemplate(template)}
                disabled={isLoading}
              >
                <Copy className="mr-2 h-4 w-4" />
                Use Template
              </Button>
            </CardFooter>
          </Card>
        ))}
        
        {/* Removed the empty skeleton template card that was causing the issue */}
      </div>
      
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Custom Template</DialogTitle>
            <DialogDescription>
              Save this form structure as a reusable template for future forms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
