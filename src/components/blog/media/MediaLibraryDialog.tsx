import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDropzone } from 'react-dropzone';
import { Upload, Search, Grid, List, Trash2, Edit, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MediaItem {
  id: string;
  url: string;
  alt_text?: string;
  caption?: string;
  file_name: string;
  file_size: number;
  file_type: string;
  width?: number;
  height?: number;
  created_at: string;
}

interface MediaLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: MediaItem) => void;
}

export function MediaLibraryDialog({ open, onOpenChange, onSelect }: MediaLibraryDialogProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MediaItem | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadMedia();
    }
  }, [open]);

  useEffect(() => {
    const filtered = media.filter(item => 
      item.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.alt_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.caption?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredMedia(filtered);
  }, [searchQuery, media]);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_media')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedia(data || []);
      setFilteredMedia(data || []);
    } catch (error) {
      console.error('Error loading media:', error);
      toast({
        title: 'Error',
        description: 'Failed to load media library',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    setUploading(true);
    const uploadPromises = acceptedFiles.map(async (file) => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('User not authenticated');

        const fileExt = file.name.split('.').pop();
        const fileName = `${userData.user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('blog-media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('blog-media')
          .getPublicUrl(fileName);

        // Get image dimensions if it's an image
        let width, height;
        if (file.type.startsWith('image/')) {
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = resolve;
            img.src = URL.createObjectURL(file);
          });
          width = img.width;
          height = img.height;
        }

        const { data: mediaData, error: dbError } = await supabase
          .from('blog_media')
          .insert({
            url: publicUrl,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            width,
            height,
            author_id: userData.user.id,
          })
          .select()
          .single();

        if (dbError) throw dbError;
        return mediaData;
      } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      setMedia(prev => [...results, ...prev]);
      toast({
        title: 'Success',
        description: `Uploaded ${results.length} file(s) successfully`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload some files',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.ogg'],
    },
    disabled: uploading,
  });

  const handleUpdate = async () => {
    if (!editingMedia) return;

    try {
      const { error } = await supabase
        .from('blog_media')
        .update({
          alt_text: editingMedia.alt_text,
          caption: editingMedia.caption,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingMedia.id);

      if (error) throw error;

      setMedia(prev => prev.map(item => 
        item.id === editingMedia.id ? editingMedia : item
      ));
      setEditingMedia(null);
      toast({
        title: 'Success',
        description: 'Media details updated successfully',
      });
    } catch (error) {
      console.error('Error updating media:', error);
      toast({
        title: 'Error',
        description: 'Failed to update media details',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const { error } = await supabase
        .from('blog_media')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      // Delete from storage
      const path = deleteConfirm.url.split('/').slice(-2).join('/');
      await supabase.storage.from('blog-media').remove([path]);

      setMedia(prev => prev.filter(item => item.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      toast({
        title: 'Success',
        description: 'Media deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete media',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Media Library</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="library" className="flex-1 flex flex-col">
          <TabsList>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="flex-1 flex flex-col gap-4">
            {/* Search and View Controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Media Grid/List */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className={cn(
                  viewMode === 'grid' 
                    ? 'grid grid-cols-4 gap-4' 
                    : 'space-y-2'
                )}>
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className={cn(
                      viewMode === 'grid' ? 'aspect-square' : 'h-16'
                    )} />
                  ))}
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-4 gap-4">
                  {filteredMedia.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'relative group cursor-pointer rounded-lg overflow-hidden border',
                        selectedMedia?.id === item.id && 'ring-2 ring-primary'
                      )}
                      onClick={() => setSelectedMedia(item)}
                    >
                      {item.file_type.startsWith('image/') ? (
                        <img
                          src={item.url}
                          alt={item.alt_text || item.file_name}
                          className="w-full h-full object-cover aspect-square"
                        />
                      ) : (
                        <div className="aspect-square flex items-center justify-center bg-muted">
                          <span className="text-sm text-muted-foreground">
                            {item.file_type.split('/')[1].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="icon"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMedia(item);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(item);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMedia.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center gap-4 p-4 rounded-lg border hover:bg-accent cursor-pointer',
                        selectedMedia?.id === item.id && 'ring-2 ring-primary'
                      )}
                      onClick={() => setSelectedMedia(item)}
                    >
                      {item.file_type.startsWith('image/') ? (
                        <img
                          src={item.url}
                          alt={item.alt_text || item.file_name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded flex items-center justify-center bg-muted">
                          <span className="text-xs text-muted-foreground">
                            {item.file_type.split('/')[1].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{item.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(item.file_size)} • {item.file_type}
                          {item.width && item.height && ` • ${item.width}×${item.height}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMedia(item);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(item);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Selected Media Actions */}
            {selectedMedia && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedMedia.file_name}
                </div>
                <Button onClick={() => {
                  onSelect(selectedMedia);
                  onOpenChange(false);
                }}>
                  Insert Media
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="flex-1 flex items-center justify-center">
            <div
              {...getRootProps()}
              className={cn(
                'w-full max-w-2xl h-64 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors',
                isDragActive && 'border-primary bg-primary/10',
                uploading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Supported formats: PNG, JPG, JPEG, GIF, WEBP, MP4, WEBM, OGG
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Edit Media Dialog */}
      {editingMedia && (
        <Dialog open={!!editingMedia} onOpenChange={() => setEditingMedia(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Media Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="alt-text">Alt Text</Label>
                <Input
                  id="alt-text"
                  value={editingMedia.alt_text || ''}
                  onChange={(e) => setEditingMedia({
                    ...editingMedia,
                    alt_text: e.target.value,
                  })}
                  placeholder="Describe this media for accessibility"
                />
              </div>
              <div>
                <Label htmlFor="caption">Caption</Label>
                <Input
                  id="caption"
                  value={editingMedia.caption || ''}
                  onChange={(e) => setEditingMedia({
                    ...editingMedia,
                    caption: e.target.value,
                  })}
                  placeholder="Add a caption"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingMedia(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.file_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}