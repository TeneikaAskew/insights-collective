import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Save,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  FileText,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Image,
  Link,
  File,
  Sparkles
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface Module {
  id: string;
  title: string;
  description: string;
  week: number;
  course_id: string;
  created_at: string;
  updated_at: string;
  content?: string;
  attachments?: any[];
}

interface ModuleEditorProps {
  courseId: string;
}

const ModuleEditor = ({ courseId }: ModuleEditorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { uploadFile, uploading, progress } = useStorageUpload();
  
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('edit');
  const [currentContent, setCurrentContent] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  
  useEffect(() => {
    const fetchModules = async () => {
      setLoading(true);
      try {
        const { data: modulesData, error: modulesError } = await supabase
          .from('modules')
          .select('*')
          .eq('course_id', courseId)
          .order('week', { ascending: true });
        
        if (modulesError) throw modulesError;
        setModules(modulesData || []);
        
        if (modulesData && modulesData.length > 0) {
          fetchModuleContent(modulesData[0].id);
          setExpandedModule(modulesData[0].id);
        }
      } catch (error: any) {
        console.error('Error fetching modules:', error);
        toast({
          title: 'Error',
          description: 'Failed to load modules',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchModules();
  }, [courseId, toast]);
  
  const fetchModuleContent = async (moduleId: string) => {
    try {
      const { data: contentData, error: contentError } = await supabase
        .from('module_content')
        .select('*')
        .eq('module_id', moduleId)
        .order('position', { ascending: true });
      
      if (contentError) throw contentError;
      
      const combinedContent = contentData?.map(c => c.content).join('\n\n') || '';
      setCurrentContent(combinedContent);
      
      const { data: attachmentData, error: attachmentError } = await supabase
        .from('module_content')
        .select('*')
        .eq('module_id', moduleId)
        .eq('type', 'file')
        .order('position', { ascending: true });
      
      if (attachmentError) throw attachmentError;
      setAttachments(attachmentData || []);
    } catch (error: any) {
      console.error('Error fetching module content:', error);
      toast({
        title: 'Error',
        description: 'Failed to load module content',
        variant: 'destructive',
      });
    }
  };
  
  const handleModuleSelect = (moduleId: string) => {
    if (expandedModule === moduleId) {
      setExpandedModule(null);
    } else {
      setExpandedModule(moduleId);
      fetchModuleContent(moduleId);
      setActiveTab('edit');
    }
  };
  
  const handleAddModule = async () => {
    try {
      const nextWeek = modules.length > 0 
        ? Math.max(...modules.map(m => m.week)) + 1 
        : 1;
      
      const { data, error } = await supabase
        .from('modules')
        .insert({
          title: `Module ${nextWeek}`,
          description: 'Add your module description here.',
          week: nextWeek,
          course_id: courseId
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setModules([...modules, data]);
      setExpandedModule(data.id);
      setCurrentContent('');
      setAttachments([]);
      setActiveTab('edit');
      
      toast({
        title: 'Success',
        description: 'New module created successfully',
      });
    } catch (error: any) {
      console.error('Error adding module:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add module',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteModule = async (moduleId: string) => {
    if (!moduleId) return;
    
    try {
      const { error: contentError } = await supabase
        .from('module_content')
        .delete()
        .eq('module_id', moduleId);
      
      if (contentError) throw contentError;
      
      const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);
      
      if (error) throw error;
      
      setModules(modules.filter(m => m.id !== moduleId));
      if (expandedModule === moduleId) {
        setExpandedModule(null);
        setCurrentContent('');
        setAttachments([]);
      }
      
      toast({
        title: 'Success',
        description: 'Module deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting module:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete module',
        variant: 'destructive',
      });
    }
  };
  
  const handleUpdateModule = async (
    moduleId: string, 
    updates: Partial<Pick<Module, 'title' | 'description' | 'week'>>
  ) => {
    if (!moduleId) return;
    
    try {
      const { data, error } = await supabase
        .from('modules')
        .update(updates)
        .eq('id', moduleId)
        .select()
        .single();
      
      if (error) throw error;
      
      setModules(modules.map(m => m.id === moduleId ? { ...m, ...data } : m));
      
      toast({
        title: 'Success',
        description: 'Module updated successfully',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error updating module:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update module',
        variant: 'destructive',
      });
      return null;
    }
  };
  
  const handleUpdateModuleContent = async () => {
    if (!expandedModule || !currentContent.trim()) return;
    
    setSaving(true);
    
    try {
      const { error: clearError } = await supabase
        .from('module_content')
        .delete()
        .eq('module_id', expandedModule)
        .eq('type', 'text');
      
      if (clearError) throw clearError;
      
      const { data, error } = await supabase
        .from('module_content')
        .insert({
          module_id: expandedModule,
          type: 'text',
          content: currentContent,
          position: 0,
          uploaded_by: user?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Module content saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving module content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save module content',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!expandedModule || !user?.id) return;
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const result = await uploadFile(file, 'module-content', `courses/${courseId}/modules/${expandedModule}`);
      if (!result) {
        throw new Error('File upload failed');
      }
      
      const { data, error } = await supabase
        .from('module_content')
        .insert({
          module_id: expandedModule,
          type: 'file',
          content: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            url: result.publicUrl
          }),
          position: attachments.length,
          uploaded_by: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setAttachments([...attachments, data]);
      
      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    }
  };
  
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!attachmentId) return;
    
    try {
      const { error } = await supabase
        .from('module_content')
        .delete()
        .eq('id', attachmentId);
      
      if (error) throw error;
      
      setAttachments(attachments.filter(a => a.id !== attachmentId));
      
      toast({
        title: 'Success',
        description: 'Attachment deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete attachment',
        variant: 'destructive',
      });
    }
  };
  
  const generateModuleContentWithAI = async () => {
    if (!expandedModule) return;
    
    setAiGenerating(true);
    
    try {
      const currentModule = modules.find(m => m.id === expandedModule);
      if (!currentModule) throw new Error('Module not found');
      
      const prompt = `Generate educational content for a module titled "${currentModule.title}" in a ${courseId ? 'course' : 'data science course'}. The module is described as: "${currentModule.description}". Please provide comprehensive learning content that would be valuable for students.`;
      
      const response = await fetch('/api/generate-course-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          field: 'module_content',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate content');
      }
      
      const { content } = await response.json();
      setCurrentContent(content);
      
      toast({
        title: 'AI Generation Complete',
        description: 'Module content has been generated. Review and save to keep these changes.',
      });
    } catch (error: any) {
      console.error('Error generating content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate content',
        variant: 'destructive',
      });
    } finally {
      setAiGenerating(false);
    }
  };
  
  const handleTextFormat = (format: string) => {
    const textarea = document.getElementById('module-content') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentContent.substring(start, end);
    let formattedText = '';
    
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        break;
      case 'list':
        formattedText = `\n- ${selectedText}`;
        break;
      case 'ordered-list':
        formattedText = `\n1. ${selectedText}`;
        break;
      case 'link':
        formattedText = `[${selectedText}](url)`;
        break;
      case 'image':
        formattedText = `![${selectedText}](image_url)`;
        break;
      default:
        formattedText = selectedText;
    }
    
    const newContent = 
      currentContent.substring(0, start) + 
      formattedText + 
      currentContent.substring(end);
    
    setCurrentContent(newContent);
  };
  
  const getRenderedContent = () => {
    let html = currentContent;
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.*?)__/g, '<u>$1</u>');
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%;" />');
    
    const listItems = html.split('\n').map(line => {
      if (line.match(/^- (.*)/)) {
        return `<li>${line.replace(/^- (.*)/, '$1')}</li>`;
      }
      if (line.match(/^\d+\. (.*)/)) {
        return `<li>${line.replace(/^\d+\. (.*)/, '$1')}</li>`;
      }
      return line;
    });
    
    let inList = false;
    let inOrderedList = false;
    let result = '';
    
    for (const line of listItems) {
      if (line.startsWith('<li>')) {
        if (!inList) {
          const isOrdered = line.match(/^\d+\./);
          result += isOrdered ? '<ol>' : '<ul>';
          inList = true;
          inOrderedList = !!isOrdered;
        }
        result += line;
      } else {
        if (inList) {
          result += inOrderedList ? '</ol>' : '</ul>';
          inList = false;
        }
        result += `<p>${line}</p>`;
      }
    }
    
    if (inList) {
      result += inOrderedList ? '</ol>' : '</ul>';
    }
    
    html = html.replace(/\n\n/g, '</p><p>');
    
    return `<div class="prose prose-sm max-w-none">${result}</div>`;
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Module Editor</CardTitle>
          <CardDescription>
            Loading modules...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8">
            <Progress value={30} className="w-full animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Modules</h2>
        <Button onClick={handleAddModule}>
          <Plus className="mr-2 h-4 w-4" />
          Add Module
        </Button>
      </div>
      
      {modules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Modules Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first module to start adding content to your course.
            </p>
            <Button onClick={handleAddModule}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Module
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={expandedModule || ''}
          onValueChange={setExpandedModule || ''}
        >
          {modules.map((module, index) => (
            <AccordionItem key={module.id} value={module.id} className="border rounded-md mb-4">
              <AccordionTrigger className="px-4 py-2 hover:no-underline">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    <Badge variant="outline" className="mr-2">
                      Week {module.week}
                    </Badge>
                    <span className="font-medium">{module.title}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModuleSelect(module.id);
                      }}
                    >
                      {expandedModule === module.id ? 'Close' : 'Edit'}
                    </Button>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 py-2">
                {expandedModule === module.id && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`module-title-${module.id}`}>Module Title</Label>
                          <Input
                            id={`module-title-${module.id}`}
                            value={module.title}
                            onChange={(e) => {
                              const newModules = [...modules];
                              newModules[index].title = e.target.value;
                              setModules(newModules);
                            }}
                            onBlur={() => handleUpdateModule(module.id, { title: module.title })}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`module-week-${module.id}`}>Week Number</Label>
                          <Input
                            id={`module-week-${module.id}`}
                            type="number"
                            min="1"
                            value={module.week}
                            onChange={(e) => {
                              const newModules = [...modules];
                              newModules[index].week = parseInt(e.target.value);
                              setModules(newModules);
                            }}
                            onBlur={() => handleUpdateModule(module.id, { week: module.week })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`module-description-${module.id}`}>Description</Label>
                        <Textarea
                          id={`module-description-${module.id}`}
                          value={module.description}
                          onChange={(e) => {
                            const newModules = [...modules];
                            newModules[index].description = e.target.value;
                            setModules(newModules);
                          }}
                          onBlur={() => handleUpdateModule(module.id, { description: module.description })}
                          className="h-[104px]"
                        />
                      </div>
                    </div>
                    
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList>
                        <TabsTrigger value="edit">Edit Content</TabsTrigger>
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                        <TabsTrigger value="attachments">Attachments</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="edit" className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTextFormat('bold')}
                            >
                              <Bold className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTextFormat('italic')}
                            >
                              <Italic className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTextFormat('underline')}
                            >
                              <Underline className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTextFormat('list')}
                            >
                              <List className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTextFormat('ordered-list')}
                            >
                              <ListOrdered className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTextFormat('link')}
                            >
                              <Link className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTextFormat('image')}
                            >
                              <Image className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={generateModuleContentWithAI}
                            disabled={aiGenerating}
                            className="text-primary"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            {aiGenerating ? 'Generating...' : 'Generate with AI'}
                          </Button>
                        </div>
                        
                        <Textarea
                          id="module-content"
                          value={currentContent}
                          onChange={(e) => setCurrentContent(e.target.value)}
                          placeholder="Enter your module content here..."
                          className="min-h-[300px] font-mono"
                        />
                        
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            onClick={handleUpdateModuleContent}
                            disabled={saving || aiGenerating}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            {saving ? 'Saving...' : 'Save Content'}
                          </Button>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="preview">
                        <Card>
                          <CardHeader>
                            <CardTitle>Content Preview</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div 
                              className="prose max-w-none border rounded-md p-4 min-h-[300px] bg-white"
                              dangerouslySetInnerHTML={{ __html: getRenderedContent() }}
                            />
                          </CardContent>
                        </Card>
                      </TabsContent>
                      
                      <TabsContent value="attachments" className="space-y-4">
                        <div>
                          <Label>Module Attachments</Label>
                          <div className="mt-2">
                            {attachments.length > 0 ? (
                              <div className="space-y-2">
                                {attachments.map((attachment) => {
                                  const fileInfo = JSON.parse(attachment.content);
                                  return (
                                    <div
                                      key={attachment.id}
                                      className="flex items-center justify-between p-3 border rounded-md"
                                    >
                                      <div className="flex items-center">
                                        <File className="h-5 w-5 mr-2 text-muted-foreground" />
                                        <div>
                                          <p className="font-medium">{fileInfo.fileName}</p>
                                          <p className="text-sm text-muted-foreground">
                                            {(fileInfo.fileSize / 1024).toFixed(1)} KB
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex space-x-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          asChild
                                        >
                                          <a href={fileInfo.url} target="_blank" rel="noopener noreferrer">
                                            View
                                          </a>
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDeleteAttachment(attachment.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-8 border rounded-md">
                                <File className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-muted-foreground">No attachments yet</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor={`file-upload-${module.id}`}>Upload New Attachment</Label>
                          <div className="flex items-center mt-2 space-x-2">
                            <Input
                              id={`file-upload-${module.id}`}
                              type="file"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById(`file-upload-${module.id}`)?.click()}
                              disabled={uploading}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploading ? 'Uploading...' : 'Upload File'}
                            </Button>
                            {uploading && <Progress value={progress} className="w-[100px]" />}
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                    
                    <div className="flex justify-end pt-4">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteModule(module.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Module
                      </Button>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};

export default ModuleEditor;
