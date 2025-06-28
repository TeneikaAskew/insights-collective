
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCreateThread } from '@/hooks/useForums';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

interface NewThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forumId: string;
}

const NewThreadDialog: React.FC<NewThreadDialogProps> = ({ open, onOpenChange, forumId }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const { user } = useAuth();
  const { mutate: createThread, isPending: isSubmitting } = useCreateThread(forumId);
  
  const handleCreateThread = () => {
    if (!user || !title.trim() || !content.trim()) return;
    
    createThread({
      title,
      content,
      userId: user.id
    }, {
      onSuccess: () => {
        setTitle('');
        setContent('');
        onOpenChange(false);
      }
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Thread</DialogTitle>
          <DialogDescription>
            Start a new discussion in this forum. Be sure to provide a clear title and initial post.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="thread-title">Thread Title</Label>
            <Input
              id="thread-title"
              placeholder="Enter a descriptive title for your thread"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="thread-content">Initial Post</Label>
            <Textarea
              id="thread-content"
              placeholder="Write the content of your first post here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px]"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateThread} 
            disabled={!title.trim() || !content.trim() || isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Thread'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewThreadDialog;
