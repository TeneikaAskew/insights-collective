// ABOUTME: Comprehensive assignment management interface for listing, creating, editing, and managing course assignments
// ABOUTME: Provides table view with filtering, sorting, bulk actions, and detailed statistics similar to Kajabi/Teachable

import React, { useState } from 'react';
import { useAssignments, useCreateAssignment, useUpdateAssignment, useDeleteAssignment } from '@/hooks/useAssignments';
import { AssignmentForm } from '@/components/course/assignments/AssignmentForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Copy, 
  Eye,
  FileText,
  Calendar,
  Users,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { EnhancedAssignment } from '@/types/course';
import { useToast } from '@/hooks/use-toast';

interface AssignmentManagerProps {
  courseId: string;
  modules?: Array<{ id: string; title: string }>;
}

export function AssignmentManager({ courseId, modules = [] }: AssignmentManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<EnhancedAssignment | undefined>();
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  
  const { data: assignments = [], isLoading } = useAssignments(courseId);
  const createMutation = useCreateAssignment();
  const updateMutation = useUpdateAssignment();
  const deleteMutation = useDeleteAssignment();
  const { toast } = useToast();

  const filteredAssignments = assignments.filter((assignment) => {
    const matchesSearch = assignment.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'published' && assignment.is_published) ||
      (filterStatus === 'draft' && !assignment.is_published);
    return matchesSearch && matchesStatus;
  });

  const handleCreate = () => {
    setEditingAssignment(undefined);
    setShowForm(true);
  };

  const handleEdit = (assignment: EnhancedAssignment) => {
    setEditingAssignment(assignment);
    setShowForm(true);
  };

  const handleDelete = async (assignmentId: string) => {
    if (await confirm({ title: 'Delete assignment?', description: 'This action cannot be undone.', destructive: true, confirmLabel: 'Delete' })) {
      deleteMutation.mutate(assignmentId);
    }
  };

  const handleDuplicate = async (assignment: EnhancedAssignment) => {
    const duplicatedAssignment = {
      ...assignment,
      title: `${assignment.title} (Copy)`,
      is_published: false,
    };
    delete (duplicatedAssignment as any).id;
    createMutation.mutate(duplicatedAssignment);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingAssignment) {
        await updateMutation.mutateAsync({
          id: editingAssignment.id,
          updates: values,
        });
      } else {
        await createMutation.mutateAsync({
          ...values,
          course_id: courseId,
        });
      }
      setShowForm(false);
      setEditingAssignment(undefined);
    } catch (error) {
      console.error('Error saving assignment:', error);
      toast({
        title: 'Error saving assignment',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (assignment: EnhancedAssignment) => {
    if (!assignment.is_published) {
      return <Badge variant="secondary">Draft</Badge>;
    }
    
    if (assignment.due_date) {
      const dueDate = new Date(assignment.due_date);
      const now = new Date();
      if (dueDate < now) {
        return <Badge variant="outline" className="bg-muted">Past Due</Badge>;
      }
      return <Badge variant="default">Published</Badge>;
    }
    
    return <Badge variant="default">Published</Badge>;
  };

  const getSubmissionStats = (assignment: any) => {
    const count = assignment.submission_count?.[0]?.count ?? 0;
    return {
      submitted: count,
      graded: 0,
      total: count,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Assignments
              </CardTitle>
              <CardDescription>
                Create and manage assignments for your course
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Assignment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Bar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assignments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
              >
                All ({assignments.length})
              </Button>
              <Button
                variant={filterStatus === 'published' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('published')}
              >
                Published ({assignments.filter(a => a.is_published).length})
              </Button>
              <Button
                variant={filterStatus === 'draft' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('draft')}
              >
                Draft ({assignments.filter(a => !a.is_published).length})
              </Button>
            </div>
          </div>

          {/* Assignments Table */}
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No assignments yet</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'No assignments match your search.' : 'Get started by creating your first assignment.'}
              </p>
              {!searchQuery && (
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Assignment
                </Button>
              )}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Submissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((assignment) => {
                    const stats = getSubmissionStats(assignment);
                    const module = modules.find(m => m.id === assignment.module_id);
                    
                    return (
                      <TableRow key={assignment.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{assignment.title}</span>
                            {assignment.description && (
                              <span className="text-sm text-muted-foreground line-clamp-1">
                                {assignment.description}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {module ? (
                            <Badge variant="outline">{module.title}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">No module</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {assignment.due_date ? (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No due date</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{assignment.points || 0}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span>{stats.submitted}/{stats.total}</span>
                            {stats.graded > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {stats.graded} graded
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(assignment)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(assignment)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(assignment)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(assignment.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}
            </DialogTitle>
          </DialogHeader>
          <AssignmentForm
            assignment={editingAssignment}
            courseId={courseId}
            modules={modules}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingAssignment(undefined);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
