
import React from 'react';
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

interface Form {
  id: string;
  title: string;
  status: boolean;
  form_link: string;
  deadline: string | null;
}

export function FormList() {
  const [forms, setForms] = React.useState<Form[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

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
                <Button variant="outline" size="sm">
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
    </div>
  );
}
