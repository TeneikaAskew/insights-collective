
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Eye, Trash2, FileText, BarChart, Star } from 'lucide-react';
import { FormData } from '@/types/forms';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createFellowshipForm } from '@/components/forms/builder';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('FormList');

interface FormListProps {
  searchTerm: string;
}

export function FormList({ searchTerm }: FormListProps) {
  const [forms, setForms] = useState<FormData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<FormData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { navigateWithAuth } = useAuthenticatedNavigation();
  const { isAdmin } = useAuth();

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Check if the ai-fellowship form exists in the database
      const formsList = data || [];
      const fellowshipFormIndex = formsList.findIndex(form => form.slug === 'ai-fellowship');
      
      if (fellowshipFormIndex === -1) {
        // If not in database, create it
        try {
          logger.log("Creating fellowship form in FormList component...");
          const fellowshipFormTemplate = createFellowshipForm();
          
          logger.log("Fellowship form to be inserted:", fellowshipFormTemplate);
          
          const { data: insertedForm, error: insertError } = await supabase
            .from('forms')
            .insert(fellowshipFormTemplate)
            .select()
            .single();

          if (insertError) {
            logger.error("Error inserting fellowship form:", insertError);
            // Add to the list with required properties for FormData
            setForms([...formsList, {
              ...fellowshipFormTemplate,
              id: 'temp-' + Date.now(), // Generate a temporary ID
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as FormData]);
          } else if (insertedForm) {
            // Add to the list
            logger.log("Fellowship form inserted:", insertedForm);
            setForms([...formsList, insertedForm]);
          }
        } catch (insertErr) {
          logger.error("Exception inserting fellowship form:", insertErr);
          // Add to the list with required properties for FormData
          const fellowshipFormTemplate = createFellowshipForm();
          setForms([...formsList, {
            ...fellowshipFormTemplate,
            id: 'temp-' + Date.now(), // Generate a temporary ID
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as FormData]);
        }
      } else {
        // Form exists in database
        setForms(formsList);
      }
    } catch (error) {
      logger.error('Error fetching forms:', error);
      toast({
        title: "Error",
        description: "Failed to load forms",
        variant: "destructive"
      });
      
      // Fallback: Show at least the fellowship form template
      const fellowshipFormTemplate = createFellowshipForm();
      setForms([{
        ...fellowshipFormTemplate,
        id: 'temp-' + Date.now(), // Generate a temporary ID
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as FormData]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteForm = async () => {
    if (!formToDelete) return;
    
    // Don't allow deleting the fellowship form
    if (formToDelete.slug === 'ai-fellowship') {
      toast({
        title: "Cannot Delete",
        description: "The AI & Automation Skills Fellowship form cannot be deleted.",
        variant: "destructive"
      });
      setDeleteDialogOpen(false);
      setFormToDelete(null);
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', formToDelete.id);

      if (error) throw error;

      // Update the forms list
      setForms(forms.filter(form => form.id !== formToDelete.id));
      toast({
        title: "Success",
        description: "Form deleted successfully"
      });
    } catch (error) {
      logger.error('Error deleting form:', error);
      toast({
        title: "Error",
        description: "Failed to delete form",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setFormToDelete(null);
    }
  };

  const confirmDelete = (form: FormData) => {
    setFormToDelete(form);
    setDeleteDialogOpen(true);
  };

  const toggleFeatured = async (form: FormData) => {
    try {
      const { error } = await supabase
        .from('forms')
        .update({ featured: !form.featured })
        .eq('id', form.id);

      if (error) throw error;

      // Update the forms list
      setForms(forms.map(f => 
        f.id === form.id ? { ...f, featured: !f.featured } : f
      ));
      
      toast({
        title: "Success",
        description: form.featured ? "Form unfeatured successfully" : "Form featured successfully"
      });
    } catch (error) {
      logger.error('Error toggling featured status:', error);
      toast({
        title: "Error",
        description: "Failed to update featured status",
        variant: "destructive"
      });
    }
  };

  const handleEditForm = (form: FormData) => {
    const editUrl = `/survey/${form.slug}/edit`;
    
    // If we're already authenticated as admin, use normal navigation
    if (isAdmin) {
      navigate(editUrl);
    } else {
      // Otherwise use authenticated navigation to preserve the redirect path
      navigateWithAuth(editUrl, { 
        requireAuth: true,
        message: "You need to be logged in as an admin to edit forms",
        title: "Authentication Required"
      });
    }
  };

  const filteredForms = forms.filter(form => 
    form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (form.description && form.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (filteredForms.length === 0 && !loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No forms found</h3>
            <p className="text-muted-foreground mt-2">
              {searchTerm ? "No forms match your search criteria." : "Create your first form to get started."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Form Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Submissions</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredForms.map((form) => (
              <TableRow key={form.id}>
                <TableCell>
                  <div className="font-medium">{form.title}</div>
                  {form.description && (
                    <div className="text-sm text-muted-foreground line-clamp-1">{form.description}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={form.status ? "default" : "secondary"}>
                    {form.status ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {form.updated_at ? format(new Date(form.updated_at), 'MMM d, yyyy') : 'N/A'}
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex items-center gap-1"
                    onClick={() => navigate(`/admin/forms/submissions/${form.slug}`)}
                  >
                    <BarChart className="h-4 w-4" />
                    <span>View</span>
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant={form.featured ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => toggleFeatured(form)}
                      className="flex items-center gap-1"
                    >
                      <Star className={`h-4 w-4 ${form.featured ? 'fill-current' : ''}`} />
                      <span className="sr-only sm:not-sr-only sm:inline-block">
                        {form.featured ? 'Unfeature' : 'Feature'}
                      </span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEditForm(form)}
                      className="flex items-center gap-1"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only sm:inline-block">Edit</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`/survey/${form.slug}`, '_blank')}
                      className="flex items-center gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only sm:inline-block">Preview</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => confirmDelete(form)}
                      disabled={form.slug === 'ai-fellowship'}
                      className="flex items-center gap-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only sm:inline-block">Delete</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this form? This action cannot be undone, and all associated submissions will be deleted.
            </DialogDescription>
          </DialogHeader>
          
          {formToDelete && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                You are about to delete "{formToDelete.title}".
              </AlertDescription>
            </Alert>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteForm}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
