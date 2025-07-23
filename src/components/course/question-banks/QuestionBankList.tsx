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
import { Plus, Edit, Trash2, FileQuestion, FolderOpen, Share2 } from 'lucide-react';
import { useQuestionBanks } from '@/hooks/useQuestionBanks';
import { useAuth } from '@/hooks/useAuth';
import { QuestionBank } from '@/types/course';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface QuestionBankListProps {
  courseId: string;
  onSelectBank?: (bank: QuestionBank) => void;
}

export const QuestionBankList: React.FC<QuestionBankListProps> = ({ 
  courseId, 
  onSelectBank 
}) => {
  const { banks, isLoading, createBank, updateBank, deleteBank } = useQuestionBanks(courseId);
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    is_shared: false
  });

  const handleCreateOrUpdate = () => {
    if (!user?.id) return;
    
    if (editingBank) {
      updateBank({
        id: editingBank.id,
        updates: formData
      });
    } else {
      createBank({
        ...formData,
        course_id: courseId,
        created_by: user.id,
      });
    }
    
    handleCloseDialog();
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setEditingBank(null);
    setFormData({ title: '', description: '', is_shared: false });
  };

  const handleEdit = (bank: QuestionBank) => {
    setEditingBank(bank);
    setFormData({
      title: bank.title,
      description: bank.description || '',
      is_shared: bank.is_shared
    });
    setShowCreateDialog(true);
  };

  const handleDelete = (bankId: string) => {
    if (confirm('Are you sure you want to delete this question bank? All questions will be permanently deleted.')) {
      deleteBank(bankId);
    }
  };

  if (isLoading) {
    return <div>Loading question banks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Question Banks</h3>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Question Bank
        </Button>
      </div>

      {banks?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <FileQuestion className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-center">
              No question banks created yet. Create your first question bank to start building a reusable question library.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {banks?.map((bank) => (
            <Card 
              key={bank.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onSelectBank?.(bank)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{bank.title}</CardTitle>
                  {bank.is_shared && (
                    <Badge variant="secondary" className="ml-2">
                      <Share2 className="h-3 w-3 mr-1" />
                      Shared
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {bank.description && (
                  <p className="text-sm text-gray-600 mb-4">{bank.description}</p>
                )}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <FileQuestion className="h-4 w-4" />
                      {bank.question_count || 0} questions
                    </span>
                    {bank.categories && bank.categories.length > 0 && (
                      <span className="flex items-center gap-1">
                        <FolderOpen className="h-4 w-4" />
                        {bank.categories.length} categories
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(bank)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(bank.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBank ? 'Edit Question Bank' : 'Create New Question Bank'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter question bank title"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the purpose of this question bank..."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Share Across Courses</Label>
                <p className="text-sm text-gray-500">
                  Allow this question bank to be used in other courses
                </p>
              </div>
              <Switch
                checked={formData.is_shared}
                onCheckedChange={(checked) => setFormData({ ...formData, is_shared: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrUpdate} disabled={!formData.title.trim()}>
              {editingBank ? 'Update' : 'Create'} Question Bank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};