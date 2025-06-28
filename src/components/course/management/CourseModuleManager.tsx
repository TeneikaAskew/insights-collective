
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, BookOpen, Edit, Trash2 } from 'lucide-react';
import ModuleManager from './ModuleManager';

interface CourseModuleManagerProps {
  courseId: string;
}

interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  course_id: string;
}

const CourseModuleManager = ({ courseId }: CourseModuleManagerProps) => {
  const { toast } = useToast();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    week: 1
  });

  // Fetch modules for the course
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
    } catch (error) {
      console.error('Error fetching modules:', error);
      toast({
        title: "Error",
        description: "Failed to load modules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddModule = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a module title",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('modules')
        .insert({
          title: formData.title,
          description: formData.description,
          week: formData.week,
          course_id: courseId
        })
        .select()
        .single();

      if (error) throw error;

      setModules(prev => [...prev, data]);
      resetForm();
      setAddModuleOpen(false);
      toast({
        title: "Success",
        description: "Module added successfully",
      });
    } catch (error) {
      console.error('Error creating module:', error);
      toast({
        title: "Error",
        description: "Failed to create module",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      week: modules.length + 1
    });
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module? All content will be permanently removed.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);

      if (error) throw error;

      setModules(prev => prev.filter(m => m.id !== moduleId));
      if (selectedModule?.id === moduleId) {
        setSelectedModule(null);
      }
      toast({
        title: "Success",
        description: "Module deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting module:', error);
      toast({
        title: "Error",
        description: "Failed to delete module",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="h-32 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Course Modules</h3>
          <p className="text-sm text-muted-foreground">Organize your course content into weekly modules</p>
        </div>
        
        <Button onClick={() => { resetForm(); setAddModuleOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Module
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Modules ({modules.length})</CardTitle>
              <CardDescription>Select a module to manage its content</CardDescription>
            </CardHeader>
            <CardContent>
              {modules.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No modules yet.</p>
                  <p className="text-xs mt-1">Create your first module to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {modules.map((module) => (
                    <div 
                      key={module.id}
                      className={`p-3 border rounded-md cursor-pointer transition-colors ${
                        selectedModule?.id === module.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedModule(module)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium">Week {module.week}</div>
                          <div className="text-sm font-normal truncate">{module.title}</div>
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {module.description}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModule(module.id);
                          }}
                          className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-2">
          {selectedModule ? (
            <ModuleManager 
              courseId={courseId}
              moduleId={selectedModule.id}
              module={selectedModule}
              onUpdate={fetchModules}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Select a Module</CardTitle>
                <CardDescription>
                  Choose a module from the sidebar to manage its lessons and content
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a module to get started</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Module Dialog */}
      <Dialog open={addModuleOpen} onOpenChange={setAddModuleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Module</DialogTitle>
            <DialogDescription>
              Create a new module for this course.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="module-title">Module Title</Label>
                <Input
                  id="module-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter module title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="module-week">Week Number</Label>
                <Input
                  id="module-week"
                  type="number"
                  min="1"
                  value={formData.week}
                  onChange={(e) => setFormData(prev => ({ ...prev, week: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="module-description">Description</Label>
              <Textarea
                id="module-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter module description"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModuleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddModule}>
              Create Module
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseModuleManager;
