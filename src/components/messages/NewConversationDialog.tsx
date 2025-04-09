
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUsers } from "@/hooks/useUsers";
import { Profile } from "@/types/supabase";
import { Check, ChevronsUpDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [openCombobox, setOpenCombobox] = useState(false);
  const { users, loading } = useUsers();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const filteredUsers = users.filter(user => user.id !== currentUser?.id);
  
  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) return;
    
    const conversationId = await onCreateConversation(subject, selectedUsers);
    
    if (conversationId) {
      onOpenChange(false);
      navigate(`/messages/${conversationId}`);
    }
  };
  
  const getUserDisplayName = (user: Profile) => {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.id;
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Create a new conversation with other users.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject (Optional)</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter conversation subject..."
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="recipients">Recipients</Label>
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="justify-between"
                  disabled={loading}
                >
                  {selectedUsers.length > 0 
                    ? `${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''} selected`
                    : "Select users..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Search user..." />
                  <CommandEmpty>No user found.</CommandEmpty>
                  <CommandGroup>
                    {filteredUsers.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={user.id}
                        onSelect={() => {
                          setSelectedUsers((prev) => {
                            if (prev.includes(user.id)) {
                              return prev.filter((id) => id !== user.id);
                            } else {
                              return [...prev, user.id];
                            }
                          });
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedUsers.includes(user.id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {getUserDisplayName(user)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedUsers.map((userId) => {
                  const user = users.find(u => u.id === userId);
                  if (!user) return null;
                  
                  return (
                    <div 
                      key={userId} 
                      className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs flex items-center"
                    >
                      {getUserDisplayName(user)}
                      <button 
                        className="ml-1 text-secondary-foreground/70 hover:text-secondary-foreground"
                        onClick={() => setSelectedUsers(prev => prev.filter(id => id !== userId))}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button 
            type="button" 
            onClick={handleCreateConversation}
            disabled={selectedUsers.length === 0}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationDialog;
