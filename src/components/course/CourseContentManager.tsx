// ABOUTME: Comprehensive course content manager for editing modules, assignments, and quizzes
// ABOUTME: Provides tabbed interface for managing different types of course content with full CRUD operations

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  BookOpen, 
  FileText, 
  HelpCircle, 
  GripVertical,
  AlertCircle,
  Clock,
  Users
} from 'lucide-react';

interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  course_id: string;
  created_at: string;
  updated_at: string;
  content_blocks?: any[];
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  points: number;
  submission_type: string;
  course_id: string;
  created_at: string;
  updated_at: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  time_limit: number;
  total_points: number;
  attempts_allowed: number;
  course_id: string;
  created_at: string;
  updated_at: string;
}

interface CourseContentManagerProps {
  courseId: string;
  contentType: 'modules' | 'assignments' | 'quizzes';
}

export function CourseContentManager({ courseId, contentType }: CourseContentManagerProps) {
  const [items, setItems] = useState<(Module | Assignment | Quiz)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<(Module | Assignment | Quiz) | null>(null);
  const [formData, setFormData] = useState<any>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchItems();
  }, [courseId, contentType]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(contentType)
        .select('*')
        .eq('course_id', courseId)
        .order(contentType === 'modules' ? 'week' : 'created_at', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        const { error } = await supabase
          .from(contentType)
          .update(formData)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        
        toast({
          title: 'Updated successfully',
          description: `${contentType.slice(0, -1)} has been updated.`,
        });
      } else {
        const { error } = await supabase
          .from(contentType)
          .insert({ ...formData, course_id: courseId });
        
        if (error) throw error;
        
        toast({
          title: 'Created successfully',
          description: `New ${contentType.slice(0, -1)} has been created.`,
        });
      }
      
      setDialogOpen(false);
      setEditingItem(null);
      setFormData({});
      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from(contentType)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Deleted successfully',
        description: `${contentType.slice(0, -1)} has been deleted.`,
      });
      
      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openDialog = (item?: any) => {
    setEditingItem(item || null);
    setFormData(item || getDefaultFormData());
    setDialogOpen(true);
  };

  const getDefaultFormData = () => {
    switch (contentType) {
      case 'modules':
        return { title: '', description: '', week: 1 };
      case 'assignments':
        return { title: '', description: '', due_date: '', points: 100, submission_type: 'text' };
      case 'quizzes':
        return { title: '', description: '', time_limit: 60, total_points: 100, attempts_allowed: 1 };
      default:
        return {};
    }
  };

  const getIcon = () => {
    switch (contentType) {
      case 'modules':
        return <BookOpen className="h-5 w-5" />;
      case 'assignments':
        return <FileText className="h-5 w-5" />;
      case 'quizzes':
        return <HelpCircle className="h-5 w-5" />;
      default:
        return <BookOpen className="h-5 w-5" />;
    }
  };

  const renderFormFields = () => {
    switch (contentType) {
      case 'modules':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Module Title</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Introduction to Python"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="week">Week</Label>
                <Input
                  id="week"
                  type="number"
                  value={formData.week || 1}
                  onChange={(e) => setFormData({...formData, week: parseInt(e.target.value)})}
                  min="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe what students will learn in this module..."
                rows={3}
              />
            </div>
          </>
        );
      case 'assignments':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="title">Assignment Title</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g., Data Analysis Project"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  value={formData.points || 100}
                  onChange={(e) => setFormData({...formData, points: parseInt(e.target.value)})}
                  min="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="submission_type">Submission Type</Label>
              <Select
                value={formData.submission_type || 'text'}
                onValueChange={(value) => setFormData({...formData, submission_type: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text Entry</SelectItem>
                  <SelectItem value="file">File Upload</SelectItem>
                  <SelectItem value="url">Website URL</SelectItem>
                  <SelectItem value="media">Media Recording</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Instructions</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Provide detailed instructions for this assignment..."
                rows={4}
              />
            </div>
          </>
        );
      case 'quizzes':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="title">Quiz Title</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g., Module 1 Quiz"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="time_limit">Time Limit (minutes)</Label>
                <Input
                  id="time_limit"
                  type="number"
                  value={formData.time_limit || 60}
                  onChange={(e) => setFormData({...formData, time_limit: parseInt(e.target.value)})}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_points">Total Points</Label>
                <Input
                  id="total_points"
                  type="number"
                  value={formData.total_points || 100}
                  onChange={(e) => setFormData({...formData, total_points: parseInt(e.target.value)})}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attempts_allowed">Attempts Allowed</Label>
                <Input
                  id="attempts_allowed"
                  type="number"
                  value={formData.attempts_allowed || 1}
                  onChange={(e) => setFormData({...formData, attempts_allowed: parseInt(e.target.value)})}
                  min="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe what this quiz covers..."
                rows={3}
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const renderItem = (item: any) => {
    switch (contentType) {
      case 'modules':
        return (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                    {item.week}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">Week {item.week}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {item.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  <span>{item.content_blocks?.length || 0} items</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Est. 2-3 hours</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'assignments':
        return (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Due: {new Date(item.due_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.points} pts</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {item.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>{item.submission_type}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>0 submissions</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'quizzes':
        return (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.total_points} points • {item.time_limit} minutes
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.attempts_allowed} attempts</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {item.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  <span>0 questions</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>0 attempts</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {getIcon()}
            {contentType.charAt(0).toUpperCase() + contentType.slice(1)}
          </h2>
          <p className="text-muted-foreground">
            Manage your course {contentType} - create, edit, and organize content.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add {contentType.slice(0, -1)}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit' : 'Create'} {contentType.slice(0, -1)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {renderFormFields()}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map(renderItem)}
        </div>
      ) : (
        <div className="text-center p-8 border rounded-lg bg-muted/20">
          {getIcon()}
          <h3 className="text-lg font-semibold mt-4">No {contentType} yet</h3>
          <p className="text-muted-foreground mt-2">
            Create your first {contentType.slice(0, -1)} to get started with your course content.
          </p>
        </div>
      )}
    </div>
  );
}