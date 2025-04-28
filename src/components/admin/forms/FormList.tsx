
import React, { useState } from 'react';
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
import { Edit, Trash2, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface Form {
  id: string;
  title: string;
  status: boolean;
  form_link: string;
  description?: string;
  deadline: string | null;
}

export function FormList() {
  const [forms, setForms] = React.useState<Form[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [date, setDate] = React.useState<Date | undefined>();

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

  const openEditDialog = (form: Form) => {
    setEditingForm(form);
    setTitle(form.title);
    setDescription(form.description || '');
    setFormLink(form.form_link);
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
      const { error } = await supabase
        .from('forms')
        .update({
          title,
          description,
          form_link: formLink,
          deadline: deadline ? deadline.toISOString() : null
        })
        .eq('id', editingForm.id);

      if (error) throw error;

      setForms(forms.map(form => 
        form.id === editingForm.id ? { 
          ...form, 
          title, 
          description, 
          form_link: formLink, 
          deadline: deadline ? deadline.toISOString() : null 
        } : form
      ));

      toast({
        title: "Success",
        description: "Form updated successfully",
      });
      
      setEditDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update form",
        variant: "destructive",
      });
    }
  };

  React.useEffect(() => {
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
          {forms.map((form) => (
            <TableRow key={form.id}>
              <TableCell className="font-medium">{form.title}</TableCell>
              <TableCell>
                <Switch
                  checked={form.status}
                  onCheckedChange={() => toggleStatus(form.id, form.status)}
                />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" asChild>
                  <a href={form.form_link} target="_blank" rel="noopener noreferrer">
                    <LinkIcon className="h-4 w-4" />
                  </a>
                </Button>
              </TableCell>
              <TableCell>
                {form.deadline ? format(new Date(form.deadline), 'PPP') : 'No deadline'}
              </TableCell>
              <TableCell className="space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => openEditDialog(form)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => deleteForm(form.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
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
                Form Link*
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
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={deadline || undefined}
                      onSelect={(date) => setDeadline(date)}
                      initialFocus
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
