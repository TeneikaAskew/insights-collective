
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConversation: (subject: string, recipientIds: string[]) => Promise<string | null>;
}

const NewConversationDialog: React.FC<NewConversationDialogProps> = ({ 
  open, 
  onOpenChange,
  onCreateConversation
}) => {
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch available users
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .not('id', 'eq', (await supabase.auth.getUser()).data.user?.id);
        
        if (error) throw error;
        
        setAvailableUsers(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({
          title: 'Error',
          description: 'Could not load users. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoadingUsers(false);
      }
    };
    
    if (open) {
      fetchUsers();
    }
  }, [open, toast]);

  const handleCreateConversation = async () => {
    if (!subject.trim() || recipients.length === 0) {
      toast({
        title: 'Invalid input',
        description: 'Please enter a subject and select at least one recipient.',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const recipientIds = recipients.map(r => r.id);
      const conversationId = await onCreateConversation(subject, recipientIds);
      
      if (conversationId) {
        onOpenChange(false);
        navigate(`/messages/${conversationId}`);
        setSubject('');
        setRecipients([]);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create conversation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = (user: User) => {
    if (!recipients.find(r => r.id === user.id)) {
      setRecipients([...recipients, user]);
    }
    setOpenCombobox(false);
    setSearchValue('');
  };

  const removeRecipient = (userId: string) => {
    setRecipients(recipients.filter(r => r.id !== userId));
  };

  const filteredUsers = availableUsers.filter(user => 
    !recipients.some(r => r.id === user.id) && 
    ((user.first_name && user.first_name.toLowerCase().includes(searchValue.toLowerCase())) || 
     (user.last_name && user.last_name.toLowerCase().includes(searchValue.toLowerCase())))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter conversation subject"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Recipients</Label>
            
            <div className="flex flex-wrap gap-2 mb-2">
              {recipients.map(recipient => (
                <div key={recipient.id} className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded">
                  <span>{recipient.first_name} {recipient.last_name}</span>
                  <button 
                    onClick={() => removeRecipient(recipient.id)}
                    className="text-amber-800 hover:text-amber-950"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between"
                >
                  {searchValue || "Select recipients..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput 
                    placeholder="Search users..." 
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  <CommandList>
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandGroup>
                      {loadingUsers ? (
                        <div className="flex justify-center p-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        filteredUsers.map(user => (
                          <CommandItem
                            key={user.id}
                            value={user.id}
                            onSelect={() => addRecipient(user)}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={user.avatar_url || ''} />
                                <AvatarFallback className="bg-amber-100 text-amber-800">
                                  {user.first_name?.[0] || ''}
                                </AvatarFallback>
                              </Avatar>
                              <span>{user.first_name} {user.last_name}</span>
                            </div>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                recipients.some(r => r.id === user.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateConversation}
            disabled={loading || !subject.trim() || recipients.length === 0}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationDialog;
