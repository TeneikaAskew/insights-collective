
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { slugify } from '@/lib/utils';

import { createLogger } from '@/utils/logger';

const logger = createLogger('SurveyFormCreate');

export default function SurveyFormCreate() {
  const { user, isAdmin } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Only allow admin users to access this page
  if (!user || !isAdmin) {
    return <Navigate to="/" />;
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    // Auto-generate slug from title
    if (newTitle) {
      setSlug(slugify(newTitle));
    } else {
      setSlug('');
    }
  };

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !slug) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a title and slug for the form',
        variant: 'destructive'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Create the form
      const { data, error } = await supabase
        .from('forms')
        .insert({
          title,
          description,
          slug,
          form_link: `/survey/${slug}`,
          status: false,
          form_structure: {
            sections: [
              {
                id: crypto.randomUUID(),
                title: 'Section 1',
                fields: []
              }
            ]
          }
        })
        .select()
        .single();
        
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Form created successfully'
      });
      
      // Navigate to form editor
      navigate(`/survey/${slug}/edit`);
    } catch (error) {
      logger.error('Error creating form:', error);
      toast({
        title: 'Error',
        description: 'Failed to create form. Please try again.',
        variant: 'destructive'
      });
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-2xl py-10">
        <Card>
          <CardHeader>
            <CardTitle>Create New Form</CardTitle>
            <CardDescription>
              Set up basic information for your new form. You'll be able to add questions after creating it.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleCreateForm}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Form Title*</Label>
                <Input
                  id="title"
                  placeholder="Enter form title"
                  value={title}
                  onChange={handleTitleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug*</Label>
                <div className="flex items-center space-x-2">
                  <div className="bg-muted px-3 py-2 rounded-l-md text-sm text-muted-foreground whitespace-nowrap">
                    /survey/
                  </div>
                  <Input
                    id="slug"
                    placeholder="url-friendly-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="rounded-l-none"
                    required
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  This will be the URL of your form. Use lowercase letters, numbers, and hyphens only.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter a description for your form (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/forms')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Form'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
