
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from '@/components/ui/rich-text-editor';
import {
  Plus,
  Trash2,
  FileText,
  Video,
  FileUp,
  Save,
  AlertTriangle,
  MoveUp,
  MoveDown
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';

interface ModuleContentEditorProps {
  moduleId: string;
  contents: any[];
  onAddContent: (content: any) => Promise<any>;
  onUpdateContent: (contentId: string, updates: any) => Promise<boolean>;
  onDeleteContent: (contentId: string) => Promise<boolean>;
}

const ModuleContentEditor = ({
  moduleId,
  contents,
  onAddContent,
  onUpdateContent,
  onDeleteContent
}: ModuleContentEditorProps) => {
  const [addingContentType, setAddingContentType] = useState<string>('text');
  const [editingContent, setEditingContent] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [contentTitle, setContentTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [aiGeneratedContent, setAiGeneratedContent] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  
  const { uploadFile, uploading, progress } = useStorageUpload();
  const { toast } = useToast();
  
  const resetForm = () => {
    setTextContent('');
    setContentTitle('');
    setVideoUrl('');
    setSelectedFile(null);
    setAddingContentType('text');
    setAiPrompt('');
    setAiGeneratedContent('');
  };
  
  const handleAddContent = async () => {
    try {
      setIsUploading(true);
      
      // Validate input
      if (!contentTitle.trim()) {
        toast({
          title: 'Error',
          description: 'Title is required',
          variant: 'destructive',
        });
        return;
      }
      
      let content = '';
      let type = addingContentType;
      
      if (type === 'text') {
        content = textContent;
        if (!content.trim()) {
          toast({
            title: 'Error',
            description: 'Content is required',
            variant: 'destructive',
          });
          return;
        }
      } else if (type === 'video') {
        content = videoUrl;
        if (!content.trim()) {
          toast({
            title: 'Error',
            description: 'Video URL is required',
            variant: 'destructive',
          });
          return;
        }
      } else if (type === 'file') {
        if (!selectedFile) {
          toast({
            title: 'Error',
            description: 'Please select a file',
            variant: 'destructive',
          });
          return;
        }
        
        // Upload file to storage
        const folderPath = `courses/${moduleId}`;
        const uploadResult = await uploadFile(selectedFile, 'course-materials', folderPath);
        
        if (!uploadResult) {
          throw new Error('File upload failed');
        }
        
        content = JSON.stringify({
          fileName: uploadResult.fileName,
          originalName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
          filePath: uploadResult.path,
          publicUrl: uploadResult.publicUrl
        });
      }
      
      // Create new content
      const newContent = {
        module_id: moduleId,
        type,
        content,
        position: contents.length,
        title: contentTitle,
        uploaded_by: '' // This will be filled in by the backend
      };
      
      await onAddContent(newContent);
      
      setIsAddModalOpen(false);
      resetForm();
      
      toast({
        title: 'Success',
        description: 'Content added successfully',
      });
    } catch (error) {
      console.error('Error adding content:', error);
      toast({
        title: 'Error',
        description: 'Failed to add content',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleUpdateContent = async () => {
    if (!editingContent) return;
    
    try {
      setIsUploading(true);
      
      // Validate input
      if (!contentTitle.trim()) {
        toast({
          title: 'Error',
          description: 'Title is required',
          variant: 'destructive',
        });
        return;
      }
      
      let content = editingContent.content;
      
      if (editingContent.type === 'text') {
        content = textContent;
        if (!content.trim()) {
          toast({
            title: 'Error',
            description: 'Content is required',
            variant: 'destructive',
          });
          return;
        }
      } else if (editingContent.type === 'video') {
        content = videoUrl;
        if (!content.trim()) {
          toast({
            title: 'Error',
            description: 'Video URL is required',
            variant: 'destructive',
          });
          return;
        }
      } else if (editingContent.type === 'file' && selectedFile) {
        // Upload new file if selected
        const folderPath = `courses/${moduleId}`;
        const uploadResult = await uploadFile(selectedFile, 'course-materials', folderPath);
        
        if (!uploadResult) {
          throw new Error('File upload failed');
        }
        
        content = JSON.stringify({
          fileName: uploadResult.fileName,
          originalName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
          filePath: uploadResult.path,
          publicUrl: uploadResult.publicUrl
        });
      }
      
      // Update content
      const updates = {
        content,
        title: contentTitle
      };
      
      const success = await onUpdateContent(editingContent.id, updates);
      
      if (success) {
        setIsEditModalOpen(false);
        
        toast({
          title: 'Success',
          description: 'Content updated successfully',
        });
      }
    } catch (error) {
      console.error('Error updating content:', error);
      toast({
        title: 'Error',
        description: 'Failed to update content',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDeleteContent = async (contentId: string) => {
    try {
      const success = await onDeleteContent(contentId);
      
      if (success) {
        toast({
          title: 'Success',
          description: 'Content deleted successfully',
        });
      }
    } catch (error) {
      console.error('Error deleting content:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete content',
        variant: 'destructive',
      });
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };
  
  const startEditContent = (content: any) => {
    setEditingContent(content);
    setContentTitle(content.title);
    
    if (content.type === 'text') {
      setTextContent(content.content);
    } else if (content.type === 'video') {
      setVideoUrl(content.content);
    }
    
    setIsEditModalOpen(true);
  };
  
  const parseFileContent = (content: string) => {
    try {
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  };

  const generateContentWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a prompt for the AI',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingAi(true);
    
    try {
      // In a real implementation, this would call an AI service
      // For now, we'll simulate it with a simple response
      const simulatedResponse = `<h2>Generated Content for: ${aiPrompt}</h2>
<p>This is a sample AI-generated content for your module. In a real implementation, this would use OpenAI, Anthropic, or another AI service to generate the content based on your prompt.</p>
<ul>
  <li>Key point 1 about ${aiPrompt}</li>
  <li>Key point 2 about ${aiPrompt}</li>
  <li>Key point 3 about ${aiPrompt}</li>
</ul>
<p>You can edit this content further to match your exact needs.</p>`;
      
      // Wait a bit to simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setAiGeneratedContent(simulatedResponse);
      setTextContent(simulatedResponse);
      
      toast({
        title: 'Content Generated',
        description: 'AI has generated content based on your prompt.',
      });
    } catch (error) {
      console.error('Error generating content:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate content with AI',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };
  
  const moveContentUp = async (content: any, index: number) => {
    if (index === 0) return;
    
    try {
      const prevContent = contents[index - 1];
      
      // Swap positions
      const success1 = await onUpdateContent(content.id, { position: content.position - 1 });
      const success2 = await onUpdateContent(prevContent.id, { position: prevContent.position + 1 });
      
      if (success1 && success2) {
        toast({
          title: 'Success',
          description: 'Content order updated',
        });
      }
    } catch (error) {
      console.error('Error moving content:', error);
      toast({
        title: 'Error',
        description: 'Failed to update content order',
        variant: 'destructive',
      });
    }
  };
  
  const moveContentDown = async (content: any, index: number) => {
    if (index === contents.length - 1) return;
    
    try {
      const nextContent = contents[index + 1];
      
      // Swap positions
      const success1 = await onUpdateContent(content.id, { position: content.position + 1 });
      const success2 = await onUpdateContent(nextContent.id, { position: nextContent.position - 1 });
      
      if (success1 && success2) {
        toast({
          title: 'Success',
          description: 'Content order updated',
        });
      }
    } catch (error) {
      console.error('Error moving content:', error);
      toast({
        title: 'Error',
        description: 'Failed to update content order',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Module Content</h3>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Content
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Content</DialogTitle>
              <DialogDescription>
                Add content to this module. Choose the content type below.
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="text" value={addingContentType} onValueChange={setAddingContentType}>
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="text">Text Content</TabsTrigger>
                <TabsTrigger value="video">Video</TabsTrigger>
                <TabsTrigger value="file">File Upload</TabsTrigger>
              </TabsList>
              
              <div className="space-y-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="content-title">Title</Label>
                  <Input
                    id="content-title"
                    value={contentTitle}
                    onChange={(e) => setContentTitle(e.target.value)}
                    placeholder="Enter content title"
                  />
                </div>
                
                <TabsContent value="text" className="mt-0">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label htmlFor="ai-prompt">AI Prompt (Optional)</Label>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={generateContentWithAI}
                          disabled={isGeneratingAi || !aiPrompt.trim()}
                        >
                          {isGeneratingAi ? 'Generating...' : 'Generate with AI'}
                        </Button>
                      </div>
                      <Input
                        id="ai-prompt"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Enter a prompt to generate content, e.g. 'Write an introduction to data visualization'"
                        disabled={isGeneratingAi}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="text-content">Content</Label>
                      <RichTextEditor
                        value={textContent}
                        onChange={setTextContent}
                        minHeight="300px"
                        placeholder="Enter rich text content here..."
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="video" className="mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="video-url">Video URL</Label>
                    <Input
                      id="video-url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Enter YouTube or Vimeo URL"
                    />
                    <p className="text-sm text-muted-foreground">
                      Supported formats: YouTube, Vimeo, or any direct video URL.
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="file" className="mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="file-upload">File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      onChange={handleFileChange}
                    />
                    {selectedFile && (
                      <p className="text-sm">
                        Selected file: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Supported formats: PDF, DOCX, PPTX, or any other document type.
                    </p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
            
            {(uploading || isUploading) && (
              <div className="space-y-2">
                <Label>Upload Progress</Label>
                <Progress value={progress} className="w-full" />
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddModalOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddContent} disabled={uploading || isUploading}>
                {uploading || isUploading ? 'Adding...' : 'Add Content'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {contents.length === 0 ? (
        <div className="bg-muted p-6 text-center rounded-md">
          <div className="flex justify-center mb-4">
            <FileText className="h-12 w-12 text-muted-foreground opacity-50" />
          </div>
          <h3 className="font-medium mb-2">No content yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add your first content item to this module to get started.
          </p>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Content
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {contents.map((content, index) => (
            <Card key={content.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    {content.type === 'text' && <FileText className="h-5 w-5 mr-2 text-blue-500" />}
                    {content.type === 'video' && <Video className="h-5 w-5 mr-2 text-red-500" />}
                    {content.type === 'file' && <FileUp className="h-5 w-5 mr-2 text-green-500" />}
                    <CardTitle className="text-lg">{content.title}</CardTitle>
                  </div>
                  <div className="flex space-x-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => moveContentUp(content, index)}
                      disabled={index === 0}
                    >
                      <MoveUp className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => moveContentDown(content, index)}
                      disabled={index === contents.length - 1}
                    >
                      <MoveDown className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-blue-500"
                      onClick={() => startEditContent(content)}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this content item.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteContent(content.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {content.type === 'text' && (
                  <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: content.content }} />
                )}
                
                {content.type === 'video' && (
                  <div className="aspect-video">
                    <iframe
                      src={content.content}
                      className="w-full h-full rounded border"
                      allowFullScreen
                      title={content.title}
                    ></iframe>
                  </div>
                )}
                
                {content.type === 'file' && (
                  <div className="border rounded p-4 flex justify-between items-center">
                    <div>
                      {(() => {
                        const fileData = parseFileContent(content.content);
                        if (!fileData) return <div>Invalid file data</div>;
                        
                        return (
                          <>
                            <div className="font-medium">{fileData.originalName}</div>
                            <div className="text-sm text-muted-foreground">
                              {fileData.fileType} - {Math.round(fileData.fileSize / 1024)} KB
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <a
                      href={(() => {
                        const fileData = parseFileContent(content.content);
                        return fileData?.publicUrl || '#';
                      })()}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded"
                    >
                      Download
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Content</DialogTitle>
            <DialogDescription>
              Update this content item.
            </DialogDescription>
          </DialogHeader>
          
          {editingContent && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-content-title">Title</Label>
                <Input
                  id="edit-content-title"
                  value={contentTitle}
                  onChange={(e) => setContentTitle(e.target.value)}
                  placeholder="Enter content title"
                />
              </div>
              
              {editingContent.type === 'text' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-text-content">Content</Label>
                  <RichTextEditor
                    value={textContent}
                    onChange={setTextContent}
                    minHeight="300px"
                  />
                </div>
              )}
              
              {editingContent.type === 'video' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-video-url">Video URL</Label>
                  <Input
                    id="edit-video-url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Enter YouTube or Vimeo URL"
                  />
                </div>
              )}
              
              {editingContent.type === 'file' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-file-upload">Replace File (Optional)</Label>
                  <Input
                    id="edit-file-upload"
                    type="file"
                    onChange={handleFileChange}
                  />
                  {selectedFile ? (
                    <p className="text-sm">
                      New file: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Current file: {(() => {
                        const fileData = parseFileContent(editingContent.content);
                        return fileData?.originalName || 'Unknown file';
                      })()}
                    </p>
                  )}
                </div>
              )}
              
              {(uploading || isUploading) && (
                <div className="space-y-2">
                  <Label>Upload Progress</Label>
                  <Progress value={progress} className="w-full" />
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditModalOpen(false);
              setEditingContent(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateContent} disabled={uploading || isUploading}>
              {uploading || isUploading ? 'Updating...' : 'Update Content'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModuleContentEditor;
