
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateOneOnOneConversation } from '@/services/conversationService';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

type User = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export function NewConversationButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Load initial users when dialog opens
  useEffect(() => {
    const loadInitialUsers = async () => {
      if (!user || !open) return;
      
      setLoading(true);
      try {
        // Simplified query to just get basic user profiles
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .neq('id', user.id)
          .limit(10);

        if (error) throw error;
        
        console.log("Loaded initial users:", data);
        setUsers(data || []);
      } catch (error) {
        console.error('Error loading initial users:', error);
        toast({
          title: 'Error',
          description: 'Could not load user list. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadInitialUsers();
    }
  }, [open, user, toast]);

  const searchUsers = async (query: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      let usersQuery = supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .neq('id', user.id);
      
      // Only filter by name if query has content
      if (query && query.length >= 2) {
        usersQuery = usersQuery.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`);
      }
      
      const { data, error } = await usersQuery.limit(10);

      if (error) throw error;
      
      console.log("Search results:", data);
      setUsers(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to search users. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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

    setLoading(true);
    try {
      console.log("Starting conversation with:", selectedUser);
      
      // Get or create conversation
      const conversationId = await getOrCreateOneOnOneConversation(user.id, selectedUser.id);
      
      if (!conversationId) {
        throw new Error("Failed to create conversation");
      }
      
      console.log("Created/found conversation:", conversationId);
      
      // Close dialog and navigate to the conversation
      setOpen(false);
      setSelectedUser(null);
      setSearchQuery('');
      navigate(`/messages/${conversationId}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to start conversation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    const user = users.find(u => u.id === userId);
    console.log("Selected user:", user);
    setSelectedUser(user || null);
  };

  return (
    <>
      <Button 
        onClick={() => setOpen(true)} 
        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700"
      >
        <Plus className="h-4 w-4" />
        New Conversation
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Start a New Conversation</DialogTitle>
            <DialogDescription>
              Find a user to start chatting with.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-search">Find a user</Label>
              <Command className="rounded-lg border shadow-md">
                <CommandInput
                  id="user-search"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onValueChange={(value) => {
                    setSearchQuery(value);
                    searchUsers(value);
                  }}
                />
                {loading && (
                  <div className="flex justify-center p-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                <CommandList>
                  <CommandEmpty>
                    {users.length === 0 && !loading ? 'No users found' : 'Type to search'}
                  </CommandEmpty>
                  <CommandGroup>
                    {users.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={user.id}
                        onSelect={() => handleUserSelect(user.id)}
                        className={`cursor-pointer ${selectedUser?.id === user.id ? 'bg-amber-100' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || ''} />
                            <AvatarFallback className="bg-amber-100 text-amber-800">
                              {user.first_name?.charAt(0) || ''}
                              {user.last_name?.charAt(0) || ''}
                            </AvatarFallback>
                          </Avatar>
                          <span>{user.first_name} {user.last_name}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            {selectedUser && (
              <div className="flex items-center gap-2 bg-amber-50 p-2 rounded-md">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={selectedUser.avatar_url || ''} />
                  <AvatarFallback className="bg-amber-100 text-amber-800">
                    {selectedUser.first_name?.charAt(0) || ''}
                    {selectedUser.last_name?.charAt(0) || ''}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1">
                  {selectedUser.first_name} {selectedUser.last_name}
                </span>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleStartConversation}
              disabled={loading || !selectedUser}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
