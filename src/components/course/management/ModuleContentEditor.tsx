
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { sanitizeHTML } from '@/utils/sanitize';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Video, Image, Trash2, Plus, Edit, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AIContentGenerator from '@/components/ai/AIContentGenerator';
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

interface ModuleContent {
  id: string;
  module_id: string;
  type: 'text' | 'video' | 'image';
  content: string;
  position: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

interface ModuleContentEditorProps {
  moduleId: string;
  contents: ModuleContent[];
  onAddContent: (content: Omit<ModuleContent, 'id' | 'created_at' | 'updated_at'>) => Promise<ModuleContent | null>;
  onUpdateContent: (id: string, updates: Partial<Omit<ModuleContent, 'id' | 'created_at' | 'updated_at'>>) => Promise<ModuleContent | null>;
  onDeleteContent: (id: string) => Promise<boolean>;
}

const ModuleContentEditor: React.FC<ModuleContentEditorProps> = ({
  moduleId,
  contents,
  onAddContent,
  onUpdateContent,
  onDeleteContent
}) => {
  const { user } = useAuth();
  const [contentType, setContentType] = useState<'text' | 'video' | 'image'>('text');
  const [newContent, setNewContent] = useState('');
  const [editingContent, setEditingContent] = useState<ModuleContent | null>(null);
  const [editedContent, setEditedContent] = useState('');
  
  const handleAddContent = async () => {
    if (!newContent.trim() || !user) return;
    
    const content = {
      module_id: moduleId,
      type: contentType,
      content: newContent,
      position: contents.length,
      uploaded_by: user.id
    };
    
    await onAddContent(content);
    setNewContent('');
  };
  
  const handleUpdateContent = async () => {
    if (!editingContent || !editedContent.trim()) return;
    
    await onUpdateContent(editingContent.id, {
      content: editedContent
    });
    
    setEditingContent(null);
    setEditedContent('');
  };
  
  const startEditing = (content: ModuleContent) => {
    setEditingContent(content);
    setEditedContent(content.content);
  };
  
  const cancelEditing = () => {
    setEditingContent(null);
    setEditedContent('');
  };
  
  const handleAIContentGenerated = (content: string) => {
    if (editingContent) {
      setEditedContent(content);
    } else {
      setNewContent(content);
    }
  };
  
  const renderContentItem = (content: ModuleContent) => {
    if (editingContent && editingContent.id === content.id) {
      return (
        <Card key={content.id} className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {content.type === 'text' ? 'Text Content' : 
               content.type === 'video' ? 'Video Content' : 'Image Content'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label>Content</Label>
                  <AIContentGenerator 
                    onContentGenerated={handleAIContentGenerated}
                    contextType="lesson"
                    buttonSize="sm"
                  />
                </div>
                {content.type === 'text' ? (
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={6}
                  />
                ) : (
                  <Input
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    placeholder={content.type === 'video' ? 'YouTube or Vimeo URL' : 'Image URL'}
                  />
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={cancelEditing}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateContent}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card key={content.id} className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center">
              {content.type === 'text' ? (
                <FileText className="h-4 w-4 mr-2" />
              ) : content.type === 'video' ? (
                <Video className="h-4 w-4 mr-2" />
              ) : (
                <Image className="h-4 w-4 mr-2" />
              )}
              {content.type === 'text' ? 'Text Content' : 
               content.type === 'video' ? 'Video Content' : 'Image Content'}
            </CardTitle>
            <div className="flex space-x-1">
              <Button variant="ghost" size="sm" onClick={() => startEditing(content)}>
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Content</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this content? This action cannot be undone.
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
          </div>
        </CardHeader>
        <CardContent>
          {content.type === 'text' && (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHTML(content.content) }} />
          )}
          {content.type === 'video' && (
            <div className="aspect-w-16 aspect-h-9">
              <iframe
                src={content.content}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-64 rounded-md"
              ></iframe>
            </div>
          )}
          {content.type === 'image' && (
            <img src={content.content} alt="Module content" className="max-w-full h-auto rounded-md" />
          )}
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Module Content</h3>
        <div className="space-y-4">
          {contents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No content added to this module yet.</p>
          ) : (
            contents.map(renderContentItem)
          )}
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Add New Content</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="text" onValueChange={(value) => setContentType(value as 'text' | 'video' | 'image')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text" className="flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Text
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center">
                <Video className="h-4 w-4 mr-2" />
                Video
              </TabsTrigger>
              <TabsTrigger value="image" className="flex items-center">
                <Image className="h-4 w-4 mr-2" />
                Image
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="text" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <div className="flex justify-between items-center">
                  <Label>Text Content</Label>
                  <AIContentGenerator 
                    onContentGenerated={handleAIContentGenerated}
                    contextType="lesson"
                  />
                </div>
                <Textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Enter rich text content for this module..."
                  rows={6}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="video" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label>Video URL</Label>
                <Input
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Enter YouTube or Vimeo URL..."
                />
                <p className="text-sm text-muted-foreground">
                  Paste the full URL to a YouTube or Vimeo video
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="image" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label>Image URL</Label>
                <Input
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Enter image URL..."
                />
                <p className="text-sm text-muted-foreground">
                  Paste the full URL to an image
                </p>
              </div>
            </TabsContent>
            
            <div className="mt-4">
              <Button onClick={handleAddContent} disabled={!newContent.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Content
              </Button>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModuleContentEditor;
