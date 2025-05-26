
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { FormList } from '@/components/admin/forms/FormList';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { slugify } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

const LegacyFormManagement = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formLink, setFormLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const generateSlug = (title: string) => {
    return slugify(title);
  };

  useEffect(() => {
    if (title) {
      setFormLink(generateSlug(title));
    }
  }, [title]);

  const handleCreateForm = async () => {
    if (!title || !formLink) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const slug = formLink;
      
      const { data, error: supabaseError } = await supabase
        .from('forms')
        .insert({
          title,
          description,
          form_link: `/survey/${slug}`,
          slug,
          status: false,
          form_structure: { sections: [] }
        })
        .select('id, slug')
        .single();

      if (supabaseError) throw supabaseError;

      toast({
        title: "Success",
        description: "Form created successfully",
      });
      
      // Redirect to form edit page
      if (data) {
        navigate(`/survey/${data.slug}/edit`);
      }
      
      // Reset form
      setTitle('');
      setDescription('');
      setFormLink('');
      setOpen(false);
    } catch (error: any) {
      console.error("Error creating form:", error);
      setError(error.message || "Failed to create form. Please try again.");
      toast({
        title: "Error",
        description: "Failed to create form",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setTitle('');
    setDescription('');
    setFormLink('');
    setError(null);
  };

  return (
    <AppLayout>
      <div className="container py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Legacy Forms Management</h1>
            <p className="text-muted-foreground mt-2">
              Create, edit, and manage your forms. 
              <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/admin/forms')}>
                Switch to new forms interface
              </Button>
            </p>
          </div>
          <Button 
            onClick={() => setOpen(true)} 
            disabled={loading}
          >
            <Plus className="mr-2 h-4 w-4" /> New Form
          </Button>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Create New Form</DialogTitle>
              <DialogDescription>
                Create a new form that users can fill out. Click create when you're done.
              </DialogDescription>
            </DialogHeader>
            
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Title*
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter form title"
                  className="col-span-3"
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="formLink" className="text-right">
                  Form Slug*
                </Label>
                <Input
                  id="formLink"
                  value={formLink}
                  onChange={(e) => setFormLink(e.target.value)}
                  placeholder="Enter form slug (e.g., ai-fellowship)"
                  className="col-span-3"
                  disabled={loading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleCreateForm} disabled={loading}>
                {loading ? 'Creating...' : 'Create Form'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <FormList searchTerm="" />
      </div>
    </AppLayout>
  );
};

export default LegacyFormManagement;
