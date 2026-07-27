
import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, FileText, MessageSquare, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { cn, slugify } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CreateFormDialog');

const FORM_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Form',
    description: 'Start with an empty form',
    icon: FileText,
  },
  {
    id: 'feedback',
    name: 'Feedback Survey',
    description: 'Collect user feedback',
    icon: MessageSquare,
    structure: {
      sections: [
        {
          id: "section-1",
          title: "Feedback Survey",
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
    id: 'registration',
    name: 'Event Registration',
    description: 'Sign up for events',
    icon: CalendarDays,
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
  }
];

interface CreateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateFormDialog: React.FC<CreateFormDialogProps> = ({ open, onOpenChange }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formLink, setFormLink] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (title) {
      setFormLink(slugify(title));
    }
  }, [title]);

  const handleCreateForm = async () => {
    if (!title || !formLink) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const slug = formLink;
      
      // Find the selected template
      const template = FORM_TEMPLATES.find(t => t.id === selectedTemplate);
      
      // Use the template structure or an empty structure
      const formStructure = template?.structure || { sections: [] };

      const { data, error } = await supabase
        .from('forms')
        .insert({
          title,
          description,
          form_link: `/survey/${slug}`,
          slug,
          status: false,
          form_structure: formStructure,
          // The deadline picker's value used to be silently dropped from the
          // payload even though forms.deadline exists.
          deadline: deadline ? deadline.toISOString() : null
        })
        .select('id, slug')
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Form created successfully",
      });
      
      // Redirect to form edit page
      if (data) {
        navigate(`/survey/${data.slug}/edit`);
      }
      
      setTitle('');
      setDescription('');
      setFormLink('');
      setDeadline(null);
      setSelectedTemplate('blank');
      onOpenChange(false);
    } catch (error) {
      logger.error("Error creating form:", error);
      toast({
        title: "Error",
        description: "Failed to create form",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="soft-studio sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Form</DialogTitle>
          <DialogDescription>
            Create a new form that users can fill out. Choose a template or start from scratch.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="template">Choose Template</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Title<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter form title"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter form description"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="formLink" className="text-right">
                  Form Slug<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="formLink"
                  value={formLink}
                  onChange={(e) => setFormLink(e.target.value)}
                  placeholder="Enter form slug (e.g., ai-fellowship)"
                  className="col-span-3"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="template">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {FORM_TEMPLATES.map(template => (
                <Card 
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary",
                    selectedTemplate === template.id ? "border-2 border-primary" : ""
                  )}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-center mb-2"><template.icon className="h-8 w-8 text-primary" /></div>
                    <h3 className="font-semibold text-center">{template.name}</h3>
                    <p className="text-sm text-muted-foreground text-center mt-1">{template.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="deadline" className="text-right">
                  Deadline
                </Label>
                <div className="col-span-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !deadline && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deadline ? format(deadline, "PPP") : <span>No deadline (optional)</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={deadline || undefined}
                        onSelect={setDeadline}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateForm} disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
                Creating...
              </>
            ) : (
              'Create Form'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFormDialog;
