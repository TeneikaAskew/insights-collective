// ABOUTME: Assignment management component for course editing interface
// ABOUTME: Handles listing, creating, editing, and deleting assignments within course context

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AssignmentForm } from '@/components/course/assignments/AssignmentForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { EnhancedAssignment } from '@/types/course';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  FileText, 
  MoreHorizontal,
  Eye,
  EyeOff
} from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Assignment {
  id: string;
  title: string;
  description?: string;
  content?: string;
  instructions?: string;
  points?: number;
  due_date?: string;
  module_id?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  course_id: string;
  submission_types?: string[];
  max_attempts?: number;
  peer_review_enabled?: boolean;
  anonymous_grading?: boolean;
  grading_type?: string;
}

interface AssignmentManagerProps {
  courseId: string;
}

export function AssignmentManager({ courseId }: AssignmentManagerProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [modules, setModules] = useState<Array<{ id: string; title: string }>>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchAssignments();
    fetchModules();
  }, [courseId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading assignments',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('id, title')
        .eq('course_id', courseId)
        .order('week', { ascending: true });

      if (error) throw error;
      setModules(data || []);
    } catch (error: any) {
      console.error('Error fetching modules:', error);
    }
  };

  const handleSave = async (values: any) => {
    try {
      const assignmentData = {
        ...values,
        course_id: courseId,
        points: values.points || 0,
      };

      if (editingAssignment) {
        const { error } = await supabase
          .from('assignments')
          .update(assignmentData)
          .eq('id', editingAssignment.id);

        if (error) throw error;

        toast({
          title: 'Assignment updated',
          description: 'Assignment has been updated successfully.',
        });
      } else {
        const { error } = await supabase
          .from('assignments')
          .insert(assignmentData);

        if (error) throw error;

        toast({
          title: 'Assignment created',
          description: 'New assignment has been created successfully.',
        });
      }

      setDialogOpen(false);
      setEditingAssignment(null);
      fetchAssignments();
    } catch (error: any) {
      toast({
        title: 'Error saving assignment',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Assignment deleted',
        description: 'Assignment has been deleted successfully.',
      });

      fetchAssignments();
    } catch (error: any) {
      toast({
        title: 'Error deleting assignment',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const togglePublished = async (assignment: Assignment) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ is_published: !assignment.is_published })
        .eq('id', assignment.id);

      if (error) throw error;

      toast({
        title: `Assignment ${!assignment.is_published ? 'published' : 'unpublished'}`,
        description: `Assignment has been ${!assignment.is_published ? 'published' : 'unpublished'} successfully.`,
      });

      fetchAssignments();
    } catch (error: any) {
      toast({
        title: 'Error updating assignment',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openDialog = (assignment?: Assignment) => {
    setEditingAssignment(assignment || null);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Course Assignments</h3>
          <p className="text-sm text-muted-foreground">
            {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Create Assignment
        </Button>
      </div>

      <div className="grid gap-4">
        {assignments.map((assignment) => (
          <Card key={assignment.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{assignment.title}</h4>
                    <Badge variant={assignment.is_published ? "default" : "secondary"}>
                      {assignment.is_published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  {assignment.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {assignment.description}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openDialog(assignment)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => togglePublished(assignment)}>
                      {assignment.is_published ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Publish
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(assignment.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {assignment.points && (
                  <div className="flex items-center gap-1">
                    <span>{assignment.points} pts</span>
                  </div>
                )}
                {assignment.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Due {format(new Date(assignment.due_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span>Created {format(new Date(assignment.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {assignments.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No assignments yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first assignment to get started.
              </p>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Assignment
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}
            </DialogTitle>
          </DialogHeader>
          <AssignmentForm
            assignment={editingAssignment as EnhancedAssignment}
            courseId={courseId}
            modules={modules}
            onSubmit={handleSave}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}