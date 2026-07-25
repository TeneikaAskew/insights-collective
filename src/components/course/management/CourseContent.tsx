
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, ChevronDown, ChevronUp, Pencil, Trash2, Settings, Eye, FileText, Video, Link as LinkIcon } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseContent');

interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  position: number;
  content_count: number;
}

interface ModuleContent {
  id: string;
  title: string;
  content_type: string;
  description: string;
  position: number;
  url?: string;
  file_path?: string;
  is_free?: boolean;
  is_published?: boolean;
}

interface CourseContentProps {
  courseId?: string;
}

export default function CourseContent({ courseId }: CourseContentProps) {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [moduleContents, setModuleContents] = useState<ModuleContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [isAddContentOpen, setIsAddContentOpen] = useState(false);
  const [isEditModuleOpen, setIsEditModuleOpen] = useState(false);
  const [isEditContentOpen, setIsEditContentOpen] = useState(false);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [currentContent, setCurrentContent] = useState<ModuleContent | null>(null);
  const [newModuleData, setNewModuleData] = useState({
    title: '',
    description: '',
    week: 1,
    position: 0,
  });
  const [newContentData, setNewContentData] = useState({
    title: '',
    description: '',
    content_type: 'text',
    url: '',
    is_free: false,
    is_published: true,
    position: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (courseId) {
      fetchModules();
    }
  }, [courseId]);

  useEffect(() => {
    if (selectedModule) {
      fetchModuleContents(selectedModule);
    } else {
      setModuleContents([]);
    }
  }, [selectedModule]);

  const fetchModules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('id, title, description, week, position')
        .eq('course_id', courseId)
        .order('position', { ascending: true });

      if (error) throw error;
      
      // Get content count for each module
      if (data && data.length > 0) {
        const modulesWithContentCount: Module[] = await Promise.all(
          data.map(async (module) => {
            const { count, error: countError } = await supabase
              .from('module_content')
              .select('id', { count: 'exact', head: true })
              .eq('module_id', module.id);
              
            return {
              ...module,
              content_count: count || 0
            } as Module;
          })
        );
        
        setModules(modulesWithContentCount);
        
        // Select the first module by default
        if (!selectedModule) {
          setSelectedModule(modulesWithContentCount[0]?.id);
        }
      } else {
        setModules([]);
      }
    } catch (error: any) {
      logger.error('Error fetching modules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load course modules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchModuleContents = async (moduleId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('module_content')
        .select('*')
        .eq('module_id', moduleId)
        .order('position', { ascending: true });

      if (error) throw error;
      setModuleContents(data || []);
    } catch (error: any) {
      logger.error('Error fetching module contents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load module contents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddModule = async () => {
    try {
      const newPosition = modules.length;
      
      const { data, error } = await supabase
        .from('modules')
        .insert({
          title: newModuleData.title,
          description: newModuleData.description,
          week: newModuleData.week,
          course_id: courseId,
          position: newPosition,
        })
        .select()
        .single();

      if (error) throw error;

      const newModule: Module = {
        ...data,
        content_count: 0,
      };
      
      setModules([...modules, newModule]);
      setIsAddModuleOpen(false);
      setNewModuleData({
        title: '',
        description: '',
        week: modules.length + 1,
        position: 0,
      });
      
      toast({
        title: 'Success',
        description: 'Module added successfully',
      });
      
      // Select the newly created module
      setSelectedModule(newModule.id);
    } catch (error: any) {
      logger.error('Error adding module:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add module',
        variant: 'destructive',
      });
    }
  };

  const handleEditModule = async () => {
    if (!currentModule) return;
    
    try {
      const { error } = await supabase
        .from('modules')
        .update({
          title: newModuleData.title,
          description: newModuleData.description,
          week: newModuleData.week,
        })
        .eq('id', currentModule.id);

      if (error) throw error;
      
      const updatedModules = modules.map(module => 
        module.id === currentModule.id ? 
          { ...module, title: newModuleData.title, description: newModuleData.description, week: newModuleData.week } : 
          module
      );
      
      setModules(updatedModules);
      setIsEditModuleOpen(false);
      
      toast({
        title: 'Success',
        description: 'Module updated successfully',
      });
    } catch (error: any) {
      logger.error('Error updating module:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update module',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!(await confirm({ title: 'Delete module?', description: 'This also deletes all its contents.', destructive: true, confirmLabel: 'Delete' }))) {
      return;
    }
    
    try {
      // First delete all contents in this module
      await supabase
        .from('module_content')
        .delete()
        .eq('module_id', moduleId);
        
      // Then delete the module itself
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);

      if (error) throw error;
      
      const updatedModules = modules.filter(module => module.id !== moduleId);
      setModules(updatedModules);
      
      if (selectedModule === moduleId) {
        setSelectedModule(updatedModules.length > 0 ? updatedModules[0].id : null);
      }
      
      toast({
        title: 'Success',
        description: 'Module deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error deleting module:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete module',
        variant: 'destructive',
      });
    }
  };

  const handleAddContent = async () => {
    if (!selectedModule) return;
    
    try {
      const { data, error } = await supabase
        .from('module_content')
        .insert({
          module_id: selectedModule,
          title: newContentData.title,
          description: newContentData.description,
          content_type: newContentData.content_type,
          url: newContentData.url,
          is_free: newContentData.is_free,
          is_published: newContentData.is_published,
          position: moduleContents.length,
        })
        .select()
        .single();

      if (error) throw error;
      
      setModuleContents([...moduleContents, data]);
      setIsAddContentOpen(false);
      setNewContentData({
        title: '',
        description: '',
        content_type: 'text',
        url: '',
        is_free: false,
        is_published: true,
        position: 0,
      });
      
      // Update the content count in the modules list
      const updatedModules = modules.map(module => 
        module.id === selectedModule ? 
          { ...module, content_count: module.content_count + 1 } : 
          module
      );
      
      setModules(updatedModules);
      
      toast({
        title: 'Success',
        description: 'Content added successfully',
      });
    } catch (error: any) {
      logger.error('Error adding content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add content',
        variant: 'destructive',
      });
    }
  };

  const handleEditContent = async () => {
    if (!currentContent) return;
    
    try {
      const { error } = await supabase
        .from('module_content')
        .update({
          title: newContentData.title,
          description: newContentData.description,
          content_type: newContentData.content_type,
          url: newContentData.url,
          is_free: newContentData.is_free,
          is_published: newContentData.is_published,
        })
        .eq('id', currentContent.id);

      if (error) throw error;
      
      const updatedContents = moduleContents.map(content => 
        content.id === currentContent.id ? 
          { 
            ...content, 
            title: newContentData.title, 
            description: newContentData.description,
            content_type: newContentData.content_type,
            url: newContentData.url,
            is_free: newContentData.is_free,
            is_published: newContentData.is_published,
          } : 
          content
      );
      
      setModuleContents(updatedContents);
      setIsEditContentOpen(false);
      
      toast({
        title: 'Success',
        description: 'Content updated successfully',
      });
    } catch (error: any) {
      logger.error('Error updating content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update content',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!(await confirm({ title: 'Delete content?', description: 'This permanently removes this content.', destructive: true, confirmLabel: 'Delete' }))) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('module_content')
        .delete()
        .eq('id', contentId);

      if (error) throw error;
      
      const updatedContents = moduleContents.filter(content => content.id !== contentId);
      setModuleContents(updatedContents);
      
      // Update the content count in the modules list
      if (selectedModule) {
        const updatedModules = modules.map(module => 
          module.id === selectedModule ? 
            { ...module, content_count: module.content_count - 1 } : 
            module
        );
        
        setModules(updatedModules);
      }
      
      toast({
        title: 'Success',
        description: 'Content deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error deleting content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete content',
        variant: 'destructive',
      });
    }
  };

  const handleReorderModules = async (result: any) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;
    
    const newModules = Array.from(modules);
    const [reorderedModule] = newModules.splice(sourceIndex, 1);
    newModules.splice(destinationIndex, 0, reorderedModule);
    
    // Update positions
    const updatedModules = newModules.map((module, index) => ({
      ...module,
      position: index,
    }));
    
    setModules(updatedModules);
    
    // Update in database
    try {
      for (const module of updatedModules) {
        await supabase
          .from('modules')
          .update({ position: module.position })
          .eq('id', module.id);
      }
      
      toast({
        title: 'Success',
        description: 'Module order updated',
      });
    } catch (error: any) {
      logger.error('Error updating module positions:', error);
      toast({
        title: 'Error',
        description: 'Failed to update module order',
        variant: 'destructive',
      });
      fetchModules(); // Revert to original order
    }
  };

  const handleReorderContents = async (result: any) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;
    
    const newContents = Array.from(moduleContents);
    const [reorderedContent] = newContents.splice(sourceIndex, 1);
    newContents.splice(destinationIndex, 0, reorderedContent);
    
    // Update positions
    const updatedContents = newContents.map((content, index) => ({
      ...content,
      position: index,
    }));
    
    setModuleContents(updatedContents);
    
    // Update in database
    try {
      for (const content of updatedContents) {
        await supabase
          .from('module_content')
          .update({ position: content.position })
          .eq('id', content.id);
      }
      
      toast({
        title: 'Success',
        description: 'Content order updated',
      });
    } catch (error: any) {
      logger.error('Error updating content positions:', error);
      toast({
        title: 'Error',
        description: 'Failed to update content order',
        variant: 'destructive',
      });
      fetchModuleContents(selectedModule!); // Revert to original order
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'link':
        return <LinkIcon className="h-4 w-4" />;
      case 'text':
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (loading && modules.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Course Structure</h2>
        <Dialog open={isAddModuleOpen} onOpenChange={setIsAddModuleOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Module
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Module</DialogTitle>
              <DialogDescription>
                Create a new module for your course. Modules help organize your course content.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="module-title">Module Title</Label>
                <Input
                  id="module-title"
                  value={newModuleData.title}
                  onChange={(e) => setNewModuleData({ ...newModuleData, title: e.target.value })}
                  placeholder="Enter module title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="module-description">Description</Label>
                <Textarea
                  id="module-description"
                  value={newModuleData.description}
                  onChange={(e) => setNewModuleData({ ...newModuleData, description: e.target.value })}
                  placeholder="Enter module description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="module-week">Week Number</Label>
                <Input
                  id="module-week"
                  type="number"
                  min="1"
                  value={newModuleData.week}
                  onChange={(e) => setNewModuleData({ ...newModuleData, week: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddModuleOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddModule} disabled={!newModuleData.title}>
                Add Module
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {modules.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg font-medium mb-2">No Modules Yet</h3>
              <p className="text-gray-500 mb-4 mx-auto max-w-md">
                Start building your course by adding modules. Modules help organize your course content into logical sections.
              </p>
              <Button onClick={() => setIsAddModuleOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Module
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Card>
              <CardContent className="py-4">
                <h3 className="text-lg font-semibold mb-4">Modules</h3>
                <DragDropContext onDragEnd={handleReorderModules}>
                  <Droppable droppableId="modules">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {modules.map((module, index) => (
                          <Draggable key={module.id} draggableId={module.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`border rounded-md p-3 cursor-pointer ${
                                  selectedModule === module.id ? 'bg-primary-50 border-primary' : 'bg-white'
                                }`}
                                onClick={() => setSelectedModule(module.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium">{module.title}</div>
                                    <div className="text-sm text-gray-500 mt-1">
                                      Week {module.week} • {module.content_count} items
                                    </div>
                                  </div>
                                  <div className="flex space-x-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentModule(module);
                                        setNewModuleData({
                                          title: module.title,
                                          description: module.description,
                                          week: module.week,
                                          position: module.position,
                                        });
                                        setIsEditModuleOpen(true);
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-red-500 hover:text-red-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteModule(module.id);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </CardContent>
            </Card>

            <Dialog open={isEditModuleOpen} onOpenChange={setIsEditModuleOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Module</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-module-title">Module Title</Label>
                    <Input
                      id="edit-module-title"
                      value={newModuleData.title}
                      onChange={(e) => setNewModuleData({ ...newModuleData, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-module-description">Description</Label>
                    <Textarea
                      id="edit-module-description"
                      value={newModuleData.description}
                      onChange={(e) => setNewModuleData({ ...newModuleData, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-module-week">Week Number</Label>
                    <Input
                      id="edit-module-week"
                      type="number"
                      min="1"
                      value={newModuleData.week}
                      onChange={(e) => setNewModuleData({ ...newModuleData, week: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditModuleOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleEditModule} disabled={!newModuleData.title}>
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="md:col-span-2">
            {selectedModule ? (
              <Card>
                <CardContent className="py-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Module Content</h3>
                    <Dialog open={isAddContentOpen} onOpenChange={setIsAddContentOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Content
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Content</DialogTitle>
                          <DialogDescription>
                            Add new content to this module.
                          </DialogDescription>
                        </DialogHeader>
                        <Tabs defaultValue="details" className="w-full">
                          <TabsList className="grid grid-cols-3">
                            <TabsTrigger value="details">Basic Details</TabsTrigger>
                            <TabsTrigger value="content">Content</TabsTrigger>
                            <TabsTrigger value="settings">Settings</TabsTrigger>
                          </TabsList>
                          <TabsContent value="details" className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="content-title">Content Title</Label>
                              <Input
                                id="content-title"
                                value={newContentData.title}
                                onChange={(e) => setNewContentData({ ...newContentData, title: e.target.value })}
                                placeholder="Enter content title"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="content-description">Description</Label>
                              <Textarea
                                id="content-description"
                                value={newContentData.description}
                                onChange={(e) => setNewContentData({ ...newContentData, description: e.target.value })}
                                placeholder="Enter content description"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="content-type">Content Type</Label>
                              <Select
                                value={newContentData.content_type}
                                onValueChange={(value) => setNewContentData({ ...newContentData, content_type: value })}
                              >
                                <SelectTrigger id="content-type">
                                  <SelectValue placeholder="Select content type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text/HTML</SelectItem>
                                  <SelectItem value="video">Video</SelectItem>
                                  <SelectItem value="link">External Link</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TabsContent>
                          <TabsContent value="content" className="space-y-4 py-4">
                            {newContentData.content_type === 'video' || newContentData.content_type === 'link' ? (
                              <div className="space-y-2">
                                <Label htmlFor="content-url">URL</Label>
                                <Input
                                  id="content-url"
                                  value={newContentData.url || ''}
                                  onChange={(e) => setNewContentData({ ...newContentData, url: e.target.value })}
                                  placeholder={newContentData.content_type === 'video' ? 
                                    "Enter video URL (YouTube, Vimeo, etc)" : "Enter external link URL"}
                                />
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Label>Content Editor</Label>
                                <div className="border rounded-md p-4 bg-gray-50 h-40 flex items-center justify-center">
                                  <p className="text-gray-400">Rich text editor will be available here</p>
                                </div>
                              </div>
                            )}
                          </TabsContent>
                          <TabsContent value="settings" className="space-y-4 py-4">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="content-free"
                                checked={newContentData.is_free}
                                onCheckedChange={(checked) => setNewContentData({ ...newContentData, is_free: checked })}
                              />
                              <Label htmlFor="content-free">Free Preview</Label>
                            </div>
                            <p className="text-sm text-gray-500 ml-7">
                              Allow non-enrolled students to view this content as a preview
                            </p>
                            
                            <div className="flex items-center space-x-2 mt-4">
                              <Switch
                                id="content-published"
                                checked={newContentData.is_published}
                                onCheckedChange={(checked) => setNewContentData({ ...newContentData, is_published: checked })}
                              />
                              <Label htmlFor="content-published">Published</Label>
                            </div>
                            <p className="text-sm text-gray-500 ml-7">
                              Make this content available to students
                            </p>
                          </TabsContent>
                        </Tabs>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddContentOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleAddContent} disabled={!newContentData.title}>
                            Add Content
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {moduleContents.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="mb-4">
                        <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                          <FileText className="h-6 w-6 text-gray-400" />
                        </div>
                      </div>
                      <h4 className="text-base font-medium mb-2">No Content Yet</h4>
                      <p className="text-gray-500 mb-4 mx-auto max-w-sm">
                        Add lessons, videos, or other content to this module.
                      </p>
                      <Button size="sm" onClick={() => setIsAddContentOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Content
                      </Button>
                    </div>
                  ) : (
                    <DragDropContext onDragEnd={handleReorderContents}>
                      <Droppable droppableId="contents">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                            {moduleContents.map((content, index) => (
                              <Draggable key={content.id} draggableId={content.id} index={index}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="border rounded-md p-3 bg-white"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3">
                                        <div className="bg-gray-100 rounded-md p-2">
                                          {getContentIcon(content.content_type)}
                                        </div>
                                        <div>
                                          <div className="font-medium">{content.title}</div>
                                          <div className="text-sm text-gray-500 mt-1 line-clamp-1">{content.description || 'No description'}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        {content.is_free && (
                                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                            Free
                                          </Badge>
                                        )}
                                        {!content.is_published && (
                                          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                            Draft
                                          </Badge>
                                        )}
                                        <div className="flex space-x-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                              setCurrentContent(content);
                                              setNewContentData({
                                                title: content.title,
                                                description: content.description || '',
                                                content_type: content.content_type,
                                                url: content.url || '',
                                                is_free: Boolean(content.is_free),
                                                is_published: Boolean(content.is_published),
                                                position: content.position,
                                              });
                                              setIsEditContentOpen(true);
                                            }}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-600"
                                            onClick={() => handleDeleteContent(content.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  )}

                  <Dialog open={isEditContentOpen} onOpenChange={setIsEditContentOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Content</DialogTitle>
                      </DialogHeader>
                      <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid grid-cols-3">
                          <TabsTrigger value="details">Basic Details</TabsTrigger>
                          <TabsTrigger value="content">Content</TabsTrigger>
                          <TabsTrigger value="settings">Settings</TabsTrigger>
                        </TabsList>
                        <TabsContent value="details" className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-content-title">Content Title</Label>
                            <Input
                              id="edit-content-title"
                              value={newContentData.title}
                              onChange={(e) => setNewContentData({ ...newContentData, title: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-content-description">Description</Label>
                            <Textarea
                              id="edit-content-description"
                              value={newContentData.description}
                              onChange={(e) => setNewContentData({ ...newContentData, description: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-content-type">Content Type</Label>
                            <Select
                              value={newContentData.content_type}
                              onValueChange={(value) => setNewContentData({ ...newContentData, content_type: value })}
                            >
                              <SelectTrigger id="edit-content-type">
                                <SelectValue placeholder="Select content type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text/HTML</SelectItem>
                                <SelectItem value="video">Video</SelectItem>
                                <SelectItem value="link">External Link</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TabsContent>
                        <TabsContent value="content" className="space-y-4 py-4">
                          {newContentData.content_type === 'video' || newContentData.content_type === 'link' ? (
                            <div className="space-y-2">
                              <Label htmlFor="edit-content-url">URL</Label>
                              <Input
                                id="edit-content-url"
                                value={newContentData.url || ''}
                                onChange={(e) => setNewContentData({ ...newContentData, url: e.target.value })}
                              />
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Label>Content Editor</Label>
                              <div className="border rounded-md p-4 bg-gray-50 h-40 flex items-center justify-center">
                                <p className="text-gray-400">Rich text editor will be available here</p>
                              </div>
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="settings" className="space-y-4 py-4">
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="edit-content-free"
                              checked={newContentData.is_free}
                              onCheckedChange={(checked) => setNewContentData({ ...newContentData, is_free: checked })}
                            />
                            <Label htmlFor="edit-content-free">Free Preview</Label>
                          </div>
                          <p className="text-sm text-gray-500 ml-7">
                            Allow non-enrolled students to view this content as a preview
                          </p>
                          
                          <div className="flex items-center space-x-2 mt-4">
                            <Switch
                              id="edit-content-published"
                              checked={newContentData.is_published}
                              onCheckedChange={(checked) => setNewContentData({ ...newContentData, is_published: checked })}
                            />
                            <Label htmlFor="edit-content-published">Published</Label>
                          </div>
                          <p className="text-sm text-gray-500 ml-7">
                            Make this content available to students
                          </p>
                        </TabsContent>
                      </Tabs>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditContentOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleEditContent} disabled={!newContentData.title}>
                          Save Changes
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="mb-4">
                      <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                        <Settings className="h-8 w-8 text-gray-400" />
                      </div>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Select a Module</h3>
                    <p className="text-gray-500 mx-auto max-w-md">
                      Select a module from the list on the left to view or edit its contents.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
