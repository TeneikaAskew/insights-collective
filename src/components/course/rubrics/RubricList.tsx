import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Copy, FileText } from 'lucide-react';
import { useRubrics } from '@/hooks/useRubrics';
import { useAuth } from '@/hooks/useAuth';
import { Rubric } from '@/types/course';

interface RubricListProps {
  courseId: string;
  onSelectRubric?: (rubric: Rubric) => void;
  selectable?: boolean;
}

export const RubricList: React.FC<RubricListProps> = ({ 
  courseId, 
  onSelectRubric,
  selectable = false 
}) => {
  const { rubrics, isLoading, createRubric, deleteRubric } = useRubrics(courseId);
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRubric, setNewRubric] = useState({ title: '', description: '' });

  const handleCreateRubric = () => {
    if (!user?.id) return;
    
    createRubric({
      course_id: courseId,
      title: newRubric.title,
      description: newRubric.description,
      created_by: user.id,
    });
    
    setShowCreateDialog(false);
    setNewRubric({ title: '', description: '' });
  };

  const handleDuplicateRubric = (rubric: Rubric) => {
    if (!user?.id) return;
    
    createRubric({
      course_id: courseId,
      title: `${rubric.title} (Copy)`,
      description: rubric.description,
      created_by: user.id,
    });
  };

  if (isLoading) {
    return <div>Loading rubrics...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Course Rubrics</h3>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Rubric
        </Button>
      </div>

      {rubrics?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-center">
              No rubrics created yet. Create your first rubric to start grading assignments consistently.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rubrics?.map((rubric) => (
            <Card key={rubric.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">{rubric.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {rubric.description && (
                  <p className="text-sm text-gray-600 mb-4">{rubric.description}</p>
                )}
                <div className="text-sm text-gray-500 mb-4">
                  {rubric.criteria?.length || 0} criteria
                </div>
                <div className="flex gap-2">
                  {selectable ? (
                    <Button
                      size="sm"
                      onClick={() => onSelectRubric?.(rubric)}
                      className="flex-1"
                    >
                      Select
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = `/courses/${courseId}/rubrics/${rubric.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDuplicateRubric(rubric)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteRubric(rubric.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Rubric</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newRubric.title}
                onChange={(e) => setNewRubric({ ...newRubric, title: e.target.value })}
                placeholder="Enter rubric title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={newRubric.description}
                onChange={(e) => setNewRubric({ ...newRubric, description: e.target.value })}
                placeholder="Describe the purpose of this rubric..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRubric} disabled={!newRubric.title.trim()}>
              Create Rubric
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};