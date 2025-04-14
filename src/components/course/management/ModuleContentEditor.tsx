
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Type, 
  Video, 
  Image as ImageIcon, 
  Save, 
  Trash2,
  ExternalLink,
  MoveUp,
  MoveDown,
  Edit,
  FileText,
  Upload as UploadIcon
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import { Progress } from '@/components/ui/progress';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

interface ModuleContentEditorProps {
  moduleId: string;
  contents: any[];
  onAddContent: (content: any) => Promise<any>;
  onUpdateContent: (contentId: string, updates: any) => Promise<any>;
  onDeleteContent: (contentId: string) => Promise<boolean>;
  // Add these new props to fix the error in ModuleManager.tsx
  onActivate?: () => void;
  onDeactivate?: () => void;
  isActive?: boolean;
}

const ModuleContentEditor: React.FC<ModuleContentEditorProps> = ({ 
  moduleId,
  contents,
  onAddContent,
  onUpdateContent,
  onDeleteContent,
  onActivate,
  onDeactivate,
  isActive
}) => {
  const { user } = useAuth();
  const { uploadFile, uploading, progress } = useStorageUpload();
  const { canEdit } = useCoursePermissions(); // We don't need courseId here as it's already checked in parent
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contentType, setContentType] = useState<'text' | 'video' | 'image'>('text');
  const [editingContent, setEditingContent] = useState<{
    id?: string;
    content: string;
    type: 'text' | 'video' | 'image';
    position?: number;
    videoSourceType?: 'url' | 'upload';
  }>({
    content: '',
    type: 'text',
  });
  const [editMode, setEditMode] = useState<'add' | 'edit'>('add');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Call onActivate/onDeactivate when modal is opened/closed if provided
  useEffect(() => {
    if (isModalOpen && onActivate) {
      onActivate();
    } else if (!isModalOpen && onDeactivate) {
      onDeactivate();
    }
  }, [isModalOpen, onActivate, onDeactivate]);
  
  const handleAddContent = (type: 'text' | 'video' | 'image') => {
    setContentType(type);
    setEditingContent({
      content: '',
      type: type,
      videoSourceType: 'url'
    });
    setEditMode('add');
    setErrors({});
    setIsModalOpen(true);
  };
  
  const handleEditContent = (content: any) => {
    setContentType(content.type);
    setEditingContent({
      id: content.id,
      content: content.content,
      type: content.type,
      position: content.position,
      videoSourceType: 'url' // Default to URL for existing content
    });
    setEditMode('edit');
    setErrors({});
    setIsModalOpen(true);
  };
  
  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditingContent(prev => ({
      ...prev,
      content: e.target.value
    }));
    
    // Clear error when field is updated
    if (errors.content) {
      setErrors(prev => ({
        ...prev,
        content: ''
      }));
    }
  };
  
  const handleVideoTypeChange = (type: string) => {
    setEditingContent(prev => ({
      ...prev,
      videoSourceType: type as 'url' | 'upload'
    }));
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fileType = editingContent.type;
    const folderPath = `modules/${moduleId}/${fileType}s`;
    
    const result = await uploadFile(file, 'module-content', folderPath);
    if (result) {
      setEditingContent(prev => ({
        ...prev,
        content: result.publicUrl
      }));
    }
  };
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!editingContent.content.trim()) {
      newErrors.content = `${contentType === 'text' ? 'Content' : contentType === 'video' ? 'Video URL' : 'Image URL'} is required`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSaveContent = async () => {
    if (!validateForm()) return;
    
    try {
      if (editMode === 'edit' && editingContent.id) {
        // Update existing content
        await onUpdateContent(editingContent.id, {
          content: editingContent.content,
          type: editingContent.type
        });
      } else {
        // Create new content
        await onAddContent({
          module_id: moduleId,
          content: editingContent.content,
          type: editingContent.type,
          position: contents.length,
          uploaded_by: user?.id || ''
        });
      }
      
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving content:', error);
    }
  };
  
  const handleMoveContent = async (id: string, direction: 'up' | 'down') => {
    const contentIndex = contents.findIndex(c => c.id === id);
    if (contentIndex === -1) return;
    
    const newIndex = direction === 'up' ? contentIndex - 1 : contentIndex + 1;
    if (newIndex < 0 || newIndex >= contents.length) return;
    
    const newOrder = [...contents];
    const [movedItem] = newOrder.splice(contentIndex, 1);
    newOrder.splice(newIndex, 0, movedItem);
    
    // Update positions before sending to backend
    const updatedOrder = newOrder.map((content, index) => ({
      ...content,
      position: index
    }));
    
    // Update each item with new position
    for (const item of updatedOrder) {
      await onUpdateContent(item.id, { position: item.position });
    }
  };
  
  // Fixed: Using 'uploading' instead of 'loading'
  if (uploading) {
    return (
      <div className="py-4">
        <Progress value={30} className="w-full animate-pulse" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Module Content</h3>
        {canEdit && (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleAddContent('text')}
            >
              <Type className="mr-2 h-4 w-4" />
              Add Text
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleAddContent('video')}
            >
              <Video className="mr-2 h-4 w-4" />
              Add Video
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleAddContent('image')}
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Add Image
            </Button>
          </div>
        )}
      </div>
      
      {contents.length === 0 ? (
        <div className="text-center py-6 border rounded-md bg-muted/50">
          <p className="text-muted-foreground mb-4">No content has been added to this module yet.</p>
          {canEdit && (
            <div className="flex justify-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleAddContent('text')}
              >
                <Type className="mr-2 h-4 w-4" />
                Add Text
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleAddContent('video')}
              >
                <Video className="mr-2 h-4 w-4" />
                Add Video
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleAddContent('image')}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Add Image
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {contents.map((content, index) => (
            <Card key={content.id} className="overflow-hidden">
              <div className="bg-muted px-4 py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {content.type === 'text' && <FileText className="h-4 w-4" />}
                  {content.type === 'video' && <Video className="h-4 w-4" />}
                  {content.type === 'image' && <ImageIcon className="h-4 w-4" />}
                  <span className="font-medium capitalize">{content.type} Content</span>
                </div>
                {canEdit && (
                  <div className="flex items-center space-x-1">
                    {index > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleMoveContent(content.id, 'up')}
                      >
                        <MoveUp className="h-4 w-4" />
                        <span className="sr-only">Move Up</span>
                      </Button>
                    )}
                    {index < contents.length - 1 && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleMoveContent(content.id, 'down')}
                      >
                        <MoveDown className="h-4 w-4" />
                        <span className="sr-only">Move Down</span>
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditContent(content)}
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Content</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this content?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteContent(content.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                {content.type === 'text' && (
                  <div className="prose prose-sm max-w-none">
                    {content.content}
                  </div>
                )}
                {content.type === 'video' && (
                  <div className="aspect-video">
                    {content.content.includes('youtube.com') || content.content.includes('youtu.be') ? (
                      <iframe
                        src={content.content.replace('watch?v=', 'embed/')}
                        title="Video player"
                        className="w-full h-full"
                        allowFullScreen
                      ></iframe>
                    ) : content.content.includes('vimeo.com') ? (
                      <iframe
                        src={`https://player.vimeo.com/video/${content.content.split('/').pop()}`}
                        title="Video player"
                        className="w-full h-full"
                        allowFullScreen
                      ></iframe>
                    ) : (
                      <video 
                        src={content.content} 
                        controls 
                        className="w-full h-full"
                      />
                    )}
                  </div>
                )}
                {content.type === 'image' && (
                  <div className="flex justify-center">
                    <img 
                      src={content.content} 
                      alt="Module content" 
                      className="max-h-96 object-contain"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editMode === 'add' ? 'Add' : 'Edit'} {contentType === 'text' ? 'Text' : contentType === 'video' ? 'Video' : 'Image'}
            </DialogTitle>
            <DialogDescription>
              {contentType === 'text' 
                ? 'Add text content to your module.' 
                : contentType === 'video'
                ? 'Add a video to your module from a URL or upload a file.'
                : 'Add an image to your module.'}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue={contentType} value={contentType} onValueChange={(value) => setContentType(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="video">Video</TabsTrigger>
              <TabsTrigger value="image">Image</TabsTrigger>
            </TabsList>
            
            <TabsContent value="text" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="text-content" className={errors.content ? 'text-destructive' : ''}>
                  Text Content
                </Label>
                <Textarea
                  id="text-content"
                  value={editingContent.content}
                  onChange={handleContentChange}
                  placeholder="Enter your content here..."
                  className={`min-h-[200px] ${errors.content ? 'border-destructive' : ''}`}
                />
                {errors.content && (
                  <p className="text-sm text-destructive">{errors.content}</p>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="video" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="video-type">Video Source</Label>
                <Select 
                  defaultValue="url" 
                  value={editingContent.videoSourceType}
                  onValueChange={handleVideoTypeChange}
                >
                  <SelectTrigger id="video-type">
                    <SelectValue placeholder="Select video source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">URL (YouTube, Vimeo, etc.)</SelectItem>
                    <SelectItem value="upload">Upload Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(!editingContent.videoSourceType || editingContent.videoSourceType === 'url') ? (
                <div className="space-y-2">
                  <Label htmlFor="video-url" className={errors.content ? 'text-destructive' : ''}>
                    Video URL
                  </Label>
                  <Input
                    id="video-url"
                    value={editingContent.content}
                    onChange={handleContentChange}
                    placeholder="e.g., https://www.youtube.com/watch?v=..."
                    className={errors.content ? 'border-destructive' : ''}
                  />
                  {errors.content && (
                    <p className="text-sm text-destructive">{errors.content}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Supports YouTube, Vimeo, and direct video links.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="video-file">Upload Video</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="video-file"
                        type="file"
                        accept="video/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('video-file')?.click()}
                        disabled={uploading}
                      >
                        <UploadIcon className="mr-2 h-4 w-4" />
                        {uploading ? 'Uploading...' : 'Select Video'}
                      </Button>
                      {uploading && <Progress value={progress} className="w-[100px]" />}
                    </div>
                    {editingContent.content && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Badge variant="outline">File Selected</Badge>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="h-auto p-0"
                          asChild
                        >
                          <a href={editingContent.content} target="_blank" rel="noopener noreferrer">
                            Preview <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    )}
                    {errors.content && (
                      <p className="text-sm text-destructive">{errors.content}</p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="image" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="image-upload">Upload Image</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('image-upload')?.click()}
                    disabled={uploading}
                  >
                    <UploadIcon className="mr-2 h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Select Image'}
                  </Button>
                  {uploading && <Progress value={progress} className="w-[100px]" />}
                </div>
                {editingContent.content && (
                  <div className="mt-4 border rounded-md p-2 flex justify-center">
                    <img 
                      src={editingContent.content} 
                      alt="Preview" 
                      className="max-h-48 object-contain"
                    />
                  </div>
                )}
                {errors.content && (
                  <p className="text-sm text-destructive">{errors.content}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="image-url" className={errors.content && !editingContent.content ? 'text-destructive' : ''}>
                  Or Enter Image URL
                </Label>
                <Input
                  id="image-url"
                  value={editingContent.content}
                  onChange={handleContentChange}
                  placeholder="e.g., https://example.com/image.jpg"
                  className={errors.content && !editingContent.content ? 'border-destructive' : ''}
                />
                {errors.content && !editingContent.content && (
                  <p className="text-sm text-destructive">{errors.content}</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveContent}>
              <Save className="mr-2 h-4 w-4" />
              {editMode === 'add' ? 'Add Content' : 'Update Content'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModuleContentEditor;
