import React, { useState, useEffect, useMemo } from 'react';
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
import { 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink, 
  MoreHorizontal, 
  ChevronDown, 
  Eye, 
  CheckCircle,
  BarChart2,
  FileDown,
  Clipboard,
  Clock,
  Check
} from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { FormListProps } from '@/components/forms/builder/types';

export function FormList({ searchTerm = '', legacy = false }: FormListProps) {
  const [forms, setForms] = useState<FormData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [editingForm, setEditingForm] = useState<FormData | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const navigate = useNavigate();
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formLink, setFormLink] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);

  const fetchForms = async () => {
    try {
      let query = supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (legacy) {
        query = query.eq('is_legacy', true);
      } else {
        query = query.or('is_legacy.eq.false, is_legacy.is.NULL');
      }

      const { data, error } = await query;

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

  const filteredForms = useMemo(() => {
    if (!searchTerm) return forms;
    
    return forms.filter(form => 
      form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (form.description && form.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      form.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [forms, searchTerm]);

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

  const deleteSelectedForms = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedForms.length} forms?`)) return;

    try {
      const { error } = await supabase
        .from('forms')
        .delete()
        .in('id', selectedForms);

      if (error) throw error;

      setForms(forms.filter(form => !selectedForms.includes(form.id)));
      setSelectedForms([]);
      
      toast({
        title: "Success",
        description: `${selectedForms.length} forms deleted successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete selected forms",
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

  const handleSelectForm = (formId: string) => {
    if (selectedForms.includes(formId)) {
      setSelectedForms(selectedForms.filter(id => id !== formId));
    } else {
      setSelectedForms([...selectedForms, formId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedForms.length === filteredForms.length) {
      setSelectedForms([]);
    } else {
      setSelectedForms(filteredForms.map(form => form.id));
    }
  };

  const viewSubmissions = (form: FormData) => {
    toast({
      title: "Coming Soon",
      description: "Form submissions view will be available soon",
    });
  };

  const exportFormData = (formId: string) => {
    toast({
      title: "Exporting Data",
      description: "Form data export will be available soon",
    });
  };

  const getSubmissionCount = (formId: string) => {
    return Math.floor(Math.random() * 50);
  };

  useEffect(() => {
    fetchForms();
  }, [legacy]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderBulkActions = () => {
    if (selectedForms.length === 0) return null;
    
    return (
      <div className="bg-muted p-2 rounded-md flex items-center justify-between mb-4 animate-fadeIn">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span>{selectedForms.length} forms selected</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedForms([])}>
            Cancel
          </Button>
          <Button variant="outline" size="sm">
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={deleteSelectedForms}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    );
  };

  const renderTableView = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox 
              checked={selectedForms.length === filteredForms.length && filteredForms.length > 0}
              onCheckedChange={handleSelectAll}
              aria-label="Select all forms"
            />
          </TableHead>
          <TableHead className="w-1/4">Form Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submissions</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredForms.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8">
              {searchTerm ? 'No forms found matching your search.' : 'No forms found. Create your first form by clicking "New Form".'}
            </TableCell>
          </TableRow>
        ) : (
          filteredForms.map((form) => {
            const submissionCount = getSubmissionCount(form.id);
            
            return (
              <TableRow key={form.id} className={selectedForms.includes(form.id) ? "bg-muted/50" : ""}>
                <TableCell>
                  <Checkbox 
                    checked={selectedForms.includes(form.id)} 
                    onCheckedChange={() => handleSelectForm(form.id)}
                    aria-label={`Select ${form.title}`}
                  />
                </TableCell>
                <TableCell>
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
                    <Badge variant={form.status ? "success" : "outline"}>
                      {form.status ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{submissionCount}</Badge>
                    {submissionCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-xs"
                        onClick={() => viewSubmissions(form)}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {form.deadline ? (
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(form.deadline), 'MMM d, yyyy')}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No deadline</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Form Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem onSelect={() => handleEditFormStructure(form.slug)}>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Edit Form Structure</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openEditDialog(form)}>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Edit Form Details</span>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem asChild>
                          <a href={form.form_link} target="_blank" rel="noopener noreferrer" className="flex items-center">
                            <Eye className="mr-2 h-4 w-4" />
                            <span>Preview Form</span>
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => copyLinkToClipboard(form.form_link)}>
                          <Clipboard className="mr-2 h-4 w-4" />
                          <span>Copy Link</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => viewSubmissions(form)}>
                          <BarChart2 className="mr-2 h-4 w-4" />
                          <span>View Responses</span>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem onSelect={() => duplicateForm(form)}>
                          <Copy className="mr-2 h-4 w-4" />
                          <span>Duplicate</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => exportFormData(form.id)}>
                          <FileDown className="mr-2 h-4 w-4" />
                          <span>Export Responses</span>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onSelect={() => deleteForm(form.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredForms.length === 0 ? (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          {searchTerm ? 'No forms found matching your search.' : 'No forms found. Create your first form by clicking "New Form".'}
        </div>
      ) : (
        filteredForms.map((form) => {
          const submissionCount = getSubmissionCount(form.id);
          
          return (
            <Card key={form.id} className="relative overflow-hidden">
              {form.status && (
                <div className="absolute top-0 right-0">
                  <Badge variant="success" className="rounded-tl-none rounded-br-none">
                    Active
                  </Badge>
                </div>
              )}
              <CardContent className="p-4">
                <div className="mb-4 flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold truncate pr-8">{form.title}</h3>
                    {form.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {form.description}
                      </p>
                    )}
                  </div>
                  <div className="flex">
                    <Checkbox 
                      checked={selectedForms.includes(form.id)} 
                      onCheckedChange={() => handleSelectForm(form.id)}
                      aria-label={`Select ${form.title}`}
                      className="ml-2"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Responses</span>
                    <Badge variant="secondary" className="mt-1 w-fit">
                      {submissionCount}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Deadline</span>
                    <span className="mt-1">
                      {form.deadline ? format(new Date(form.deadline), 'MMM d') : 'None'}
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={form.status}
                      onCheckedChange={() => toggleStatus(form.id, form.status)}
                    />
                    <span className="text-sm">{form.status ? 'Active' : 'Inactive'}</span>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <span>Actions</span>
                        <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => handleEditFormStructure(form.slug)}>
                        <Edit className="mr-2 h-4 w-4" />
                        <span>Edit Structure</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openEditDialog(form)}>
                        <Edit className="mr-2 h-4 w-4" />
                        <span>Edit Details</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <a href={form.form_link} target="_blank" rel="noopener noreferrer" className="flex items-center">
                          <Eye className="mr-2 h-4 w-4" />
                          <span>Preview</span>
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => copyLinkToClipboard(form.form_link)}>
                        <Clipboard className="mr-2 h-4 w-4" />
                        <span>Copy Link</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => deleteForm(form.id)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );

  return (
    <div className="w-full">
      {renderBulkActions()}
      
      <div className="mb-4 flex justify-end space-x-2">
        <Button 
          variant={viewMode === 'table' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => setViewMode('table')}
        >
          Table View
        </Button>
        <Button 
          variant={viewMode === 'grid' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setViewMode('grid')}
        >
          Grid View
        </Button>
      </div>
      
      {viewMode === 'table' ? renderTableView() : renderGridView()}

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
                      onSelect={(date) => setDeadline(date)}
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
