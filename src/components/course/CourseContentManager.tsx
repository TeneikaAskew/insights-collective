// ABOUTME: Comprehensive course content manager for editing modules, assignments, and quizzes with rich text editing
// ABOUTME: Provides tabbed interface for managing different types of course content with full CRUD operations and WYSIWYG editing

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
import { ModernEditor } from '@/components/ui/modern-editor';
import { QuizEditor } from './QuizEditor';
import { InteractiveQuizBuilder } from '../quiz/InteractiveQuizBuilder';
import LessonManagerWithMigration from './management/LessonManagerWithMigration';
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
  Users,
  Upload,
  Video,
  Link
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
  contentType: 'modules' | 'assignments' | 'quizzes' | 'lessons';
  moduleId?: string; // Required when contentType is 'lessons'
}

// Rich text renderer component
const RichTextRenderer: React.FC<{ content: string }> = ({ content }) => {
  const processContent = (text: string): string => {
    if (!text) return '';
    
    // Enhanced YouTube detection and embedding
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?/g;
    let processedText = text.replace(youtubeRegex, (match, videoId) => {
      return `<div class="aspect-video mb-4"><iframe src="https://www.youtube.com/embed/${videoId}" class="w-full h-full rounded-lg" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    });

    // Convert markdown-style formatting to HTML
    processedText = processedText
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/~~(.*?)~~/gim, '<del>$1</del>')
      .replace(/`([^`]+)`/gim, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-muted-foreground pl-4 italic">$1</blockquote>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4" />')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li>$1. $2</li>')
      .replace(/\n/gim, '<br />');

    // Wrap consecutive <li> tags with <ul> or <ol>
    processedText = processedText.replace(/(<li>.*?<\/li>)/gis, '<ul class="list-disc list-inside space-y-1 my-2">$1</ul>');
    processedText = processedText.replace(/(<li>\d+\..*?<\/li>)/gis, '<ol class="list-decimal list-inside space-y-1 my-2">$1</ol>');

    return processedText;
  };

  return (
    <div 
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: processContent(content) }}
    />
  );
};

export function CourseContentManager({ courseId, contentType, moduleId }: CourseContentManagerProps) {
  // If we're in modules mode, show tabs for modules and lessons
  if (contentType === 'modules') {
    const [activeTab, setActiveTab] = useState('modules');
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Course Content</h2>
          </div>
        </div>
        
        <div className="border rounded-lg">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('modules')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'modules'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BookOpen className="h-4 w-4" />
                Modules
              </div>
            </button>
            <button
              onClick={() => setActiveTab('lessons')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'lessons'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BookOpen className="h-4 w-4" />
                Lessons
              </div>
            </button>
          </div>
          
          <div className="p-6">
            {activeTab === 'modules' && (
              <ModulesManager courseId={courseId} />
            )}
            {activeTab === 'lessons' && (
              <LessonsManager courseId={courseId} />
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // For other content types, use the original component logic
  return <OriginalCourseContentManager courseId={courseId} contentType={contentType} moduleId={moduleId} />;
}

function LessonsManager({ courseId }: { courseId: string }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchModules();
  }, [courseId]);

  const fetchModules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('week', { ascending: true });

      if (error) throw error;
      setModules(data || []);
      if (data && data.length > 0 && !selectedModuleId) {
        setSelectedModuleId(data[0].id);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
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

  if (modules.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted/20">
        <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mt-4">No modules found</h3>
        <p className="text-muted-foreground mt-2">
          Create modules first, then you can add lessons to them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Lessons by Module
          </h3>
          <p className="text-muted-foreground">
            Select a module to manage its lessons. Create, edit, and organize lesson content.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Module Selection Sidebar */}
        <div className="w-64 space-y-2">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            Select Module
          </div>
          {modules.map((module) => (
            <Button
              key={module.id}
              variant={selectedModuleId === module.id ? "default" : "outline"}
              onClick={() => setSelectedModuleId(module.id)}
              className="w-full justify-start text-left h-auto py-3"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                  {module.week}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{module.title}</div>
                  <div className="text-xs text-muted-foreground">Week {module.week}</div>
                </div>
              </div>
            </Button>
          ))}
        </div>

        {/* Lessons Manager for Selected Module */}
        <div className="flex-1">
          {selectedModuleId ? (
            <LessonManagerWithMigration moduleId={selectedModuleId} />
          ) : (
            <div className="text-center p-8 border rounded-lg bg-muted/20">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Select a Module</h3>
              <p className="text-muted-foreground mt-2">
                Choose a module from the sidebar to manage its lessons.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModulesManager({ courseId }: { courseId: string }) {
  const [items, setItems] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Module | null>(null);
  const [formData, setFormData] = useState<any>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchItems();
  }, [courseId]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('week', { ascending: true });

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
          .from('modules')
          .update(formData)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        
        toast({
          title: 'Updated successfully',
          description: 'Module has been updated.',
        });
      } else {
        const { error } = await supabase
          .from('modules')
          .insert({ ...formData, course_id: courseId });
        
        if (error) throw error;
        
        toast({
          title: 'Created successfully',
          description: 'New module has been created.',
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
        .from('modules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Deleted successfully',
        description: 'Module has been deleted.',
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

  const openDialog = (item?: Module) => {
    setEditingItem(item || null);
    setFormData(item || { title: '', description: '', week: 1 });
    setDialogOpen(true);
  };

  const renderItem = (item: Module) => {
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
          <div className="text-sm text-muted-foreground mb-3">
            <RichTextRenderer content={item.description} />
          </div>
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
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Modules
          </h3>
          <p className="text-muted-foreground">
            Manage your course modules - create, edit, and organize content.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Module
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit' : 'Create'} Module
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
                <Label htmlFor="description">Module Content</Label>
                <ModernEditor
                  value={formData.description || ''}
                  onChange={(value) => setFormData({...formData, description: value})}
                  placeholder="Describe what students will learn in this module. Use the rich text editor to format your content, add images, links, and videos..."
                  minHeight="300px"
                />
              </div>
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
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mt-4">No modules yet</h3>
          <p className="text-muted-foreground mt-2">
            Create your first module to get started with your course content.
          </p>
        </div>
      )}
    </div>
  );
}

// Original component for assignments and quizzes
function OriginalCourseContentManager({ courseId, contentType, moduleId }: CourseContentManagerProps) {
  const [items, setItems] = useState<(Module | Assignment | Quiz)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<(Module | Assignment | Quiz) | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [quizEditorOpen, setQuizEditorOpen] = useState<string | null>(null);
  const [quizBuilderOpen, setQuizBuilderOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchItems();
  }, [courseId, contentType]);

  const fetchItems = async () => {
    if (contentType === 'lessons') {
      setLoading(false);
      return;
    }

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
        if (contentType === 'quizzes') {
          setDialogOpen(false);
          setQuizBuilderOpen(true);
          return;
        } else {
          const { error } = await supabase
            .from(contentType)
            .insert({ ...formData, course_id: courseId });
          
          if (error) throw error;
        }
        
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
      case 'assignments':
        return { title: '', description: '', due_date: new Date().toISOString().split('T')[0], points: 100, submission_type: 'text' };
      case 'quizzes':
        return { title: '', description: '', time_limit: 30, total_points: 100, attempts_allowed: 1 };
      default:
        return {};
    }
  };

  const getIcon = () => {
    switch (contentType) {
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
      case 'assignments':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="title">Assignment Title</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g., Essay on Climate Change"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Assignment Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe the requirements for this assignment..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date || new Date().toISOString().split('T')[0]}
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
                  min="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="submission_type">Submission Type</Label>
              <Select onValueChange={(value) => setFormData({...formData, submission_type: value})} defaultValue={formData.submission_type || 'text'}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select submission type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="file">File Upload</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                </SelectContent>
              </Select>
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
                placeholder="e.g., Chapter 1 Quiz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Quiz Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Instructions or details about the quiz..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="time_limit">Time Limit (minutes)</Label>
                <Input
                  id="time_limit"
                  type="number"
                  value={formData.time_limit || 30}
                  onChange={(e) => setFormData({...formData, time_limit: parseInt(e.target.value)})}
                  min="1"
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
              <Label htmlFor="total_points">Total Points</Label>
              <Input
                id="total_points"
                type="number"
                value={formData.total_points || 100}
                onChange={(e) => setFormData({...formData, total_points: parseInt(e.target.value)})}
                min="1"
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
                    onClick={() => setQuizEditorOpen(item.id)}
                  >
                    <Edit className="h-4 w-4" />
                    Questions
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(item)}
                  >
                    <Edit className="h-4 w-4" />
                    Settings
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

  if (contentType === 'lessons') {
    if (!moduleId) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Module ID is required for managing lessons.</AlertDescription>
        </Alert>
      );
    }
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">
          Lessons require a module context. Please navigate to a specific module to manage lessons.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center p-8 border rounded-lg bg-muted/20">
        <h3 className="text-lg font-semibold mt-4">Feature Coming Soon</h3>
        <p className="text-muted-foreground mt-2">
          {contentType.charAt(0).toUpperCase() + contentType.slice(1)} management will be available soon.
        </p>
      </div>
    </div>
  );
}
