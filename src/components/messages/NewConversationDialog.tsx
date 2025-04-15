
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, X, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Profile } from '@/types/supabase';
import { useUsers } from '@/hooks/useUsers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getOrCreateOneOnOneConversation, sendConversationMessage } from '@/services/conversationService';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewConversationDialog({ open, onOpenChange }: NewConversationDialogProps) {
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { users, loading, searchQuery, updateSearchQuery } = useUsers();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedUser(null);
      updateSearchQuery('');
    }
  }, [open, updateSearchQuery]);

  const handleSelectUser = (user: Profile) => {
    setSelectedUser(user);
  };

  const handleStartConversation = async () => {
    if (!selectedUser || !user) {
      toast({
        title: 'Error',
        description: 'Please select a user to start a conversation with.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);

      console.log("User: ", user.id, "Selected user to message: ", selectedUser.id)
      
      if (authUser?.user?.id !== userId) {
        throw new Error("Mismatch between auth.uid() and passed userId – RLS will fail.");
}
      
      // Get or create conversation
      const conversationId = await getOrCreateOneOnOneConversation(user.id, selectedUser.id);
      
      // Send an initial message
      const initialMessage = `Hello ${selectedUser.first_name || ''}!`;
      await sendConversationMessage(user.id, conversationId, initialMessage);
      
      // Close dialog and navigate to the conversation
      onOpenChange(false);
      navigate(`/messages/${conversationId}`);
      
      toast({
        title: 'Success',
        description: `Conversation with ${selectedUser.first_name} ${selectedUser.last_name} started.`,
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to start conversation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl">Start a New Conversation</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Find a user to start chatting with.
          </p>
        </DialogHeader>
        
        <div className="px-6 pb-2">
          <p className="text-sm font-medium mb-2">Find a user</p>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => updateSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto border-t border-b">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchQuery ? 'No users found' : 'Type to search for users'}
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 px-6 py-3 hover:bg-muted cursor-pointer ${
                    selectedUser?.id === user.id ? 'gray-400' : ''
                  }`}
                  onClick={() => handleSelectUser(user)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || ''} alt={`${user.first_name} ${user.last_name}`} />
                    <AvatarFallback className="bg-secondary text-primary">
                      {user.first_name?.[0] || ''}
                      {user.last_name?.[0] || ''}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-grow font-medium">{user.first_name} {user.last_name}</span>
                  {selectedUser?.id === user.id && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className="h-3 w-3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="p-6">
          <Button 
            variant="outline" 
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            type="button"
            onClick={handleStartConversation}
            disabled={!selectedUser || isCreating}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Start Conversation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
