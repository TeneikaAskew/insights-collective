// Canvas-style module content manager
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { 
  Plus,
  MoreVertical,
  FileText,
  ClipboardList,
  HelpCircle,
  Link,
  ExternalLink,
  Tool,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  Calendar,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CanvasContentService from '@/services/canvasContentService';
import type { ContentItem, ContentItemType } from '@/types/canvas';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format } from 'date-fns';

interface CanvasModuleContentProps {
  moduleId: string;
  courseId: string;
  isInstructor?: boolean;
}

export function CanvasModuleContent({ 
  moduleId, 
  courseId, 
  isInstructor = false 
}: CanvasModuleContentProps) {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [newItemType, setNewItemType] = useState<ContentItemType>('page');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadContentItems();
  }, [moduleId]);

  const loadContentItems = async () => {
    try {
      setLoading(true);
      const items = await CanvasContentService.getContentItems(moduleId);
      setContentItems(items);
    } catch (error: any) {
      toast({
        title: 'Error loading content',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for the content item',
        variant: 'destructive'
      });
      return;
    }

    try {
      const newItem = await CanvasContentService.createContentItem({
        course_id: courseId,
        module_id: moduleId,
        type: newItemType,
        title,
        content
      });

      setContentItems([...contentItems, newItem]);
      setShowAddDialog(false);
      resetForm();

      toast({
        title: 'Content created',
        description: `${newItemType} "${title}" has been created.`
      });
    } catch (error: any) {
      toast({
        title: 'Error creating content',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      const updated = await CanvasContentService.updateContentItem(
        editingItem.id,
        { title, content }
      );

      setContentItems(contentItems.map(item => 
        item.id === updated.id ? updated : item
      ));
      setEditingItem(null);
      resetForm();

      toast({
        title: 'Content updated',
        description: 'Your changes have been saved.'
      });
    } catch (error: any) {
      toast({
        title: 'Error updating content',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content item?')) return;

    try {
      await CanvasContentService.deleteContentItem(id);
      setContentItems(contentItems.filter(item => item.id !== id));
      
      toast({
        title: 'Content deleted',
        description: 'The content item has been removed.'
      });
    } catch (error: any) {
      toast({
        title: 'Error deleting content',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handlePublishToggle = async (item: ContentItem) => {
    try {
      if (item.published) {
        await CanvasContentService.unpublishContentItem(item.id);
      } else {
        await CanvasContentService.publishContentItem(item.id);
      }

      setContentItems(contentItems.map(i => 
        i.id === item.id ? { ...i, published: !i.published } : i
      ));

      toast({
        title: item.published ? 'Content unpublished' : 'Content published',
        description: `"${item.title}" is now ${item.published ? 'unpublished' : 'published'}.`
      });
    } catch (error: any) {
      toast({
        title: 'Error updating publish status',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(contentItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setContentItems(items);

    try {
      await CanvasContentService.reorderContentItems(
        moduleId,
        items.map(item => item.id)
      );
    } catch (error: any) {
      toast({
        title: 'Error reordering content',
        description: error.message,
        variant: 'destructive'
      });
      // Reload to get correct order
      loadContentItems();
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setNewItemType('page');
  };

  const openEditDialog = (item: ContentItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setContent(item.content || '');
    setShowAddDialog(true);
  };

  const getContentIcon = (type: ContentItemType) => {
    switch (type) {
      case 'page': return <FileText className="h-4 w-4" />;
      case 'assignment': return <ClipboardList className="h-4 w-4" />;
      case 'quiz': return <HelpCircle className="h-4 w-4" />;
      case 'discussion': return <FileText className="h-4 w-4" />;
      case 'external_url': return <ExternalLink className="h-4 w-4" />;
      case 'external_tool': return <Tool className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getContentBadgeColor = (type: ContentItemType) => {
    switch (type) {
      case 'page': return 'default';
      case 'assignment': return 'blue';
      case 'quiz': return 'purple';
      case 'discussion': return 'green';
      case 'external_url': return 'orange';
      case 'external_tool': return 'red';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isInstructor && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Module Content</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Content
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => {
                setNewItemType('page');
                setShowAddDialog(true);
              }}>
                <FileText className="h-4 w-4 mr-2" />
                Page
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setNewItemType('assignment');
                setShowAddDialog(true);
              }}>
                <ClipboardList className="h-4 w-4 mr-2" />
                Assignment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setNewItemType('quiz');
                setShowAddDialog(true);
              }}>
                <HelpCircle className="h-4 w-4 mr-2" />
                Quiz
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                setNewItemType('external_url');
                setShowAddDialog(true);
              }}>
                <ExternalLink className="h-4 w-4 mr-2" />
                External URL
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setNewItemType('external_tool');
                setShowAddDialog(true);
              }}>
                <Tool className="h-4 w-4 mr-2" />
                External Tool
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {contentItems.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No content in this module yet.
            </p>
            {isInstructor && (
              <p className="text-sm text-muted-foreground mt-2">
                Click "Add Content" to get started.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="content-items">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {contentItems.map((item, index) => (
                  <Draggable
                    key={item.id}
                    draggableId={item.id}
                    index={index}
                    isDragDisabled={!isInstructor}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`mb-2 ${snapshot.isDragging ? 'opacity-50' : ''}`}
                      >
                        <Card className={!item.published && isInstructor ? 'opacity-60' : ''}>
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {isInstructor && (
                                  <div {...provided.dragHandleProps}>
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                {getContentIcon(item.type)}
                                <div>
                                  <CardTitle className="text-base">
                                    {item.title}
                                  </CardTitle>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge 
                                      variant={getContentBadgeColor(item.type) as any}
                                      className="text-xs"
                                    >
                                      {item.type}
                                    </Badge>
                                    {!item.published && (
                                      <Badge variant="secondary" className="text-xs">
                                        Unpublished
                                      </Badge>
                                    )}
                                    {item.assignment?.due_at && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        Due {format(new Date(item.assignment.due_at), 'MMM d')}
                                      </div>
                                    )}
                                    {item.quiz?.time_limit && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {item.quiz.time_limit} min
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isInstructor && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditDialog(item)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePublishToggle(item)}>
                                      {item.published ? (
                                        <>
                                          <EyeOff className="h-4 w-4 mr-2" />
                                          Unpublish
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="h-4 w-4 mr-2" />
                                          Publish
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </CardHeader>
                        </Card>
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

      {/* Add/Edit Content Dialog */}
      <Dialog 
        open={showAddDialog} 
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) {
            setEditingItem(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit' : 'Create'} {newItemType === 'page' ? 'Page' : newItemType}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Enter ${newItemType} title`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <UnifiedCanvasEditor
                content={content}
                onChange={setContent}
                placeholder={`Write your ${newItemType} content here...`}
                minHeight="400px"
              />
            </div>

            {/* Type-specific fields would go here */}
            {newItemType === 'assignment' && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Assignment Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Assignment-specific settings like due dates, points, and submission types will be added here.
                </p>
              </div>
            )}

            {newItemType === 'quiz' && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Quiz Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Quiz questions and settings will be managed here.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={editingItem ? handleUpdateItem : handleCreateItem}>
              {editingItem ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CanvasModuleContent;