// Canvas-style module content manager
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { sanitizeHTML } from '@/utils/sanitize';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus,
  MoreVertical,
  FileText,
  ClipboardList,
  HelpCircle,
  Link,
  ExternalLink,
  Settings,
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
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  // Assignment-specific state
  const [assignmentSettings, setAssignmentSettings] = useState({
    points_possible: 100,
    due_at: '',
    unlock_at: '',
    lock_at: '',
    submission_types: ['online_text_entry'],
    allowed_attempts: 1,
    grading_type: 'points'
  });
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
      const settings: any = {};
      
      // Add assignment-specific settings
      if (newItemType === 'assignment') {
        settings.assignment = assignmentSettings;
      }

      const newItem = await CanvasContentService.createContentItem({
        course_id: courseId,
        module_id: moduleId,
        type: newItemType,
        title,
        content,
        settings
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
      const updates: any = { title, content };
      
      // Add assignment-specific updates
      if (editingItem.type === 'assignment') {
        updates.settings = { assignment: assignmentSettings };
      }

      const updated = await CanvasContentService.updateContentItem(
        editingItem.id,
        updates
      );

      setContentItems(contentItems.map(item => 
        item.id === updated.id ? updated : item
      ));
      setShowAddDialog(false);
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
    setActiveTab('editor');
    setAssignmentSettings({
      points_possible: 100,
      due_at: '',
      unlock_at: '',
      lock_at: '',
      submission_types: ['online_text_entry'],
      allowed_attempts: 1,
      grading_type: 'points'
    });
  };

  const openEditDialog = (item: ContentItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setContent(item.content || '');
    setNewItemType(item.type);
    
    // Load assignment settings if editing an assignment
    if (item.type === 'assignment' && item.assignment) {
      setAssignmentSettings({
        points_possible: item.assignment.points_possible || 100,
        due_at: item.assignment.due_at || '',
        unlock_at: item.assignment.unlock_at || '',
        lock_at: item.assignment.lock_at || '',
        submission_types: item.assignment.submission_types || ['online_text_entry'],
        allowed_attempts: item.assignment.allowed_attempts || 1,
        grading_type: item.assignment.grading_type || 'points'
      });
    }
    
    setShowAddDialog(true);
  };

  const getContentIcon = (type: ContentItemType) => {
    switch (type) {
      case 'page': return <FileText className="h-4 w-4" />;
      case 'assignment': return <ClipboardList className="h-4 w-4" />;
      case 'quiz': return <HelpCircle className="h-4 w-4" />;
      case 'discussion': return <FileText className="h-4 w-4" />;
      case 'external_url': return <ExternalLink className="h-4 w-4" />;
      case 'external_tool': return <Settings className="h-4 w-4" />;
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
                <Settings className="h-4 w-4 mr-2" />
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

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'editor' | 'preview')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="editor" className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <UnifiedCanvasEditor
                  content={content}
                  onChange={setContent}
                  placeholder={`Write your ${newItemType} content here...`}
                  minHeight="400px"
                />
              </TabsContent>
              
              <TabsContent value="preview" className="space-y-2">
                <div className="border rounded-lg p-6 min-h-[400px] bg-background">
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">
                        {title || `Untitled ${newItemType}`}
                      </h2>
                      <div className="flex items-center gap-2">
                        <Badge variant={getContentBadgeColor(newItemType) as any}>
                          {newItemType}
                        </Badge>
                        {newItemType === 'assignment' && assignmentSettings.points_possible > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {assignmentSettings.points_possible} points
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="prose prose-sm max-w-none">
                      {content ? (
                        <div 
                          dangerouslySetInnerHTML={{ __html: sanitizeHTML(content) }}
                          className="leading-relaxed"
                        />
                      ) : (
                        <p className="text-muted-foreground italic">
                          No content to preview. Start writing in the editor tab.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Assignment Settings */}
            {(newItemType === 'assignment' || editingItem?.type === 'assignment') && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">Assignment Settings</h4>
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="submission">Submission</TabsTrigger>
                    <TabsTrigger value="availability">Availability</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="details" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="points">Points Possible</Label>
                        <Input
                          id="points"
                          type="number"
                          value={assignmentSettings.points_possible}
                          onChange={(e) => setAssignmentSettings({
                            ...assignmentSettings,
                            points_possible: parseInt(e.target.value) || 0
                          })}
                          min="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="grading-type">Grading Type</Label>
                        <Select
                          value={assignmentSettings.grading_type}
                          onValueChange={(value) => setAssignmentSettings({
                            ...assignmentSettings,
                            grading_type: value
                          })}
                        >
                          <SelectTrigger id="grading-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="points">Points</SelectItem>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="letter_grade">Letter Grade</SelectItem>
                            <SelectItem value="pass_fail">Pass/Fail</SelectItem>
                            <SelectItem value="not_graded">Not Graded</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="submission" className="space-y-4">
                    <div>
                      <Label>Submission Types</Label>
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="text-entry"
                            checked={assignmentSettings.submission_types.includes('online_text_entry')}
                            onCheckedChange={(checked) => {
                              const types = [...assignmentSettings.submission_types];
                              if (checked) {
                                if (!types.includes('online_text_entry')) types.push('online_text_entry');
                              } else {
                                const index = types.indexOf('online_text_entry');
                                if (index > -1) types.splice(index, 1);
                              }
                              setAssignmentSettings({ ...assignmentSettings, submission_types: types });
                            }}
                          />
                          <Label htmlFor="text-entry" className="font-normal">Text Entry</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="url"
                            checked={assignmentSettings.submission_types.includes('online_url')}
                            onCheckedChange={(checked) => {
                              const types = [...assignmentSettings.submission_types];
                              if (checked) {
                                if (!types.includes('online_url')) types.push('online_url');
                              } else {
                                const index = types.indexOf('online_url');
                                if (index > -1) types.splice(index, 1);
                              }
                              setAssignmentSettings({ ...assignmentSettings, submission_types: types });
                            }}
                          />
                          <Label htmlFor="url" className="font-normal">Website URL</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="upload"
                            checked={assignmentSettings.submission_types.includes('online_upload')}
                            onCheckedChange={(checked) => {
                              const types = [...assignmentSettings.submission_types];
                              if (checked) {
                                if (!types.includes('online_upload')) types.push('online_upload');
                              } else {
                                const index = types.indexOf('online_upload');
                                if (index > -1) types.splice(index, 1);
                              }
                              setAssignmentSettings({ ...assignmentSettings, submission_types: types });
                            }}
                          />
                          <Label htmlFor="upload" className="font-normal">File Upload</Label>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="attempts">Allowed Attempts</Label>
                      <Input
                        id="attempts"
                        type="number"
                        value={assignmentSettings.allowed_attempts}
                        onChange={(e) => setAssignmentSettings({
                          ...assignmentSettings,
                          allowed_attempts: parseInt(e.target.value) || 1
                        })}
                        min="1"
                        max="100"
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="availability" className="space-y-4">
                    <div>
                      <Label htmlFor="due-date">Due Date</Label>
                      <Input
                        id="due-date"
                        type="datetime-local"
                        value={assignmentSettings.due_at ? new Date(assignmentSettings.due_at).toISOString().slice(0, 16) : ''}
                        onChange={(e) => setAssignmentSettings({
                          ...assignmentSettings,
                          due_at: e.target.value ? new Date(e.target.value).toISOString() : ''
                        })}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="unlock-date">Available From</Label>
                      <Input
                        id="unlock-date"
                        type="datetime-local"
                        value={assignmentSettings.unlock_at ? new Date(assignmentSettings.unlock_at).toISOString().slice(0, 16) : ''}
                        onChange={(e) => setAssignmentSettings({
                          ...assignmentSettings,
                          unlock_at: e.target.value ? new Date(e.target.value).toISOString() : ''
                        })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Students cannot submit before this date
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="lock-date">Available Until</Label>
                      <Input
                        id="lock-date"
                        type="datetime-local"
                        value={assignmentSettings.lock_at ? new Date(assignmentSettings.lock_at).toISOString().slice(0, 16) : ''}
                        onChange={(e) => setAssignmentSettings({
                          ...assignmentSettings,
                          lock_at: e.target.value ? new Date(e.target.value).toISOString() : ''
                        })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Students cannot submit after this date
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
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