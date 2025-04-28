
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Link as LinkIcon, Copy, Copy2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn, slugify } from '@/lib/utils';
import { FormData } from '@/types/forms';
import { useNavigate } from 'react-router-dom';

export function FormList() {
  const [forms, setForms] = useState<FormData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [editingForm, setEditingForm] = useState<FormData | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formLink, setFormLink] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);

  const fetchForms = async () => {
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setForms(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load forms",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('forms')
        .update({ status: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setForms(forms.map(form => 
        form.id === id ? { ...form, status: !currentStatus } : form
      ));

      toast({
        title: "Success",
        description: `Form ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update form status",
        variant: "destructive",
      });
    }
  };

  const deleteForm = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this form?')) return;

    try {
      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setForms(forms.filter(form => form.id !== id));
      toast({
        title: "Success",
        description: "Form deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete form",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (form: FormData) => {
    setEditingForm(form);
    setTitle(form.title);
    setDescription(form.description || '');
    setFormLink(form.slug || '');
    setDeadline(form.deadline ? new Date(form.deadline) : null);
    setEditDialogOpen(true);
  };

  const handleUpdateForm = async () => {
    if (!editingForm) return;
    if (!title || !formLink) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const slug = slugify(formLink);
      
      const { error } = await supabase
        .from('forms')
        .update({
          title,
          description,
          form_link: `/survey/${slug}`,
          slug,
          deadline: deadline ? deadline.toISOString() : null
        })
        .eq('id', editingForm.id);

      if (error) throw error;

      setForms(forms.map(form => 
        form.id === editingForm.id ? { 
          ...form, 
          title, 
          description,
          slug,
          form_link: `/survey/${slug}`, 
          deadline: deadline ? deadline.toISOString() : null 
        } : form
      ));

      toast({
        title: "Success",
        description: "Form updated successfully",
      });
      
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating form:", error);
      toast({
        title: "Error",
        description: "Failed to update form",
        variant: "destructive",
      });
    }
  };

  const duplicateForm = async (form: FormData) => {
    try {
      // Create new form with same data but different title/slug
      const newTitle = `${form.title} (Copy)`;
      const newSlug = slugify(newTitle);
      
      const { data, error } = await supabase
        .from('forms')
        .insert({
          title: newTitle,
          description: form.description,
          form_link: `/survey/${newSlug}`,
          slug: newSlug,
          status: false,
          form_structure: form.form_structure || { sections: [] },
          deadline: form.deadline
        })
        .select()
        .single();

      if (error) throw error;

      // Add the new form to the list
      setForms([data, ...forms]);
      
      toast({
        title: "Success",
        description: "Form duplicated successfully",
      });
    } catch (error) {
      console.error("Error duplicating form:", error);
      toast({
        title: "Error",
        description: "Failed to duplicate form",
        variant: "destructive",
      });
    }
  };

  const handleEditFormStructure = (slug: string) => {
    navigate(`/survey/${slug}/edit`);
  };

  const copyLinkToClipboard = (link: string) => {
    const baseUrl = window.location.origin;
    const fullUrl = `${baseUrl}${link}`;
    navigator.clipboard.writeText(fullUrl);
    toast({
      title: "Link Copied",
      description: "Form link copied to clipboard",
    });
  };

  useEffect(() => {
    fetchForms();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Form Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Link</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {forms.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8">
                No forms found. Create your first form by clicking "New Form".
              </TableCell>
            </TableRow>
          ) : (
            forms.map((form) => (
              <TableRow key={form.id}>
                <TableCell className="font-medium">
                  <div>
                    <div className="font-medium">{form.title}</div>
                    {form.description && (
                      <div className="text-sm text-muted-foreground truncate max-w-xs">
                        {form.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={form.status}
                      onCheckedChange={() => toggleStatus(form.id, form.status)}
                    />
                    <span className={form.status ? "text-green-600" : "text-slate-500"}>
                      {form.status ? "Active" : "Inactive"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="rounded-full"
                      onClick={() => copyLinkToClipboard(form.form_link)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      <span className="hidden md:inline">{form.slug}</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      asChild
                    >
                      <a href={form.form_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  {form.deadline ? format(new Date(form.deadline), 'PPP') : 'No deadline'}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openEditDialog(form)}
                      title="Quick Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditFormStructure(form.slug)}
                      title="Edit Form Structure"
                    >
                      <span className="hidden md:inline mr-1">Edit Form</span>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => duplicateForm(form)}
                      title="Duplicate Form"
                    >
                      <Copy2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteForm(form.id)}
                      title="Delete Form"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Edit Form Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Edit Form</DialogTitle>
            <DialogDescription>
              Update the form details. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-title" className="text-right">
                Title*
              </Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-description" className="text-right">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-link" className="text-right">
                Form Slug*
              </Label>
              <Input
                id="edit-link"
                value={formLink}
                onChange={(e) => setFormLink(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-deadline" className="text-right">
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
                      {deadline ? format(deadline, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto">
                    <Calendar
                      mode="single"
                      selected={deadline || undefined}
                      onSelect={(date) => {
                        setDeadline(date);
                        // Don't close the popover
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateForm}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
