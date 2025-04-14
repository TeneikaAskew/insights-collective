
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

// import { useState, useEffect } from "react"
// import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog"
// import { Button } from "@/components/ui/button"
// import { ScrollArea } from "@/components/ui/scroll-area"
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command"
// import { User } from "@/types"
// import { useUsers } from "@/hooks/useUsers"
// import { cn } from "@/lib/utils"

// type NewConversationDialogProps = {
//   open: boolean
//   setOpen: (open: boolean) => void
//   onCreateConversation: (recipientIds: string[]) => void
// }

// export function NewConversationDialog({ open, setOpen, onCreateConversation }: NewConversationDialogProps) {
//   const [recipients, setRecipients] = useState<User[]>([])
//   const { users: availableUsers, searchQuery, setSearchQuery, loading } = useUsers()

//   // Debugging log to track state
//   useEffect(() => {
//     if (open) {
//       console.log("Available users:", availableUsers);
//       console.log("Loading state:", loading);
//       console.log("Search query:", searchQuery);
//     }
//   }, [availableUsers, loading, searchQuery, open]);

//   // Reset state when dialog closes
//   useEffect(() => {
//     if (!open) {
//       setRecipients([])
//       setSearchQuery("")
//     }
//   }, [open, setSearchQuery]);

//   const toggleRecipient = (user: User) => {
//     setRecipients(prev => {
//       const exists = prev.find((u) => u.id === user.id)
//       if (exists) {
//         return prev.filter((u) => u.id !== user.id)
//       } else {
//         return [...prev, user]
//       }
//     })
//   }

//   const isSelected = (user: User) => recipients.some((u) => u.id === user.id)

//   const handleCreate = () => {
//     if (recipients.length === 0) return
//     onCreateConversation(recipients.map((u) => u.id))
//     setRecipients([])
//     setSearchQuery("")
//     setOpen(false)
//   }

//   return (
//     <Dialog open={open} onOpenChange={setOpen}>
//       <DialogContent className="sm:max-w-md">
//         <DialogHeader>
//           <DialogTitle>Start a New Conversation</DialogTitle>
//           <p className="text-sm text-muted-foreground">Find a user to start chatting with.</p>
//         </DialogHeader>

//         {recipients.length > 0 && (
//           <div className="flex flex-wrap gap-2 mb-2">
//             {recipients.map(recipient => (
//               <div key={recipient.id} className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
//                 <span>{recipient.first_name} {recipient.last_name}</span>
//                 <button 
//                   onClick={() => toggleRecipient(recipient)}
//                   className="ml-1 hover:text-destructive"
//                   type="button"
//                 >
//                   ×
//                 </button>
//               </div>
//             ))}
//           </div>
//         )}

//         <div className="relative">
//           <Command className="rounded-lg border shadow-md overflow-visible">
//             <CommandInput
//               placeholder="Search by name..."
//               value={searchQuery}
//               onValueChange={setSearchQuery}
//               className="text-sm"
//             />
//             <CommandList>
//               {loading ? (
//                 <div className="p-2 text-center text-sm text-muted-foreground">Loading...</div>
//               ) : availableUsers.length === 0 ? (
//                 <div className="p-2 text-center text-sm text-muted-foreground">No users found</div>
//               ) : (
//                 <ScrollArea className="max-h-[250px]">
//                   {availableUsers.map((user) => (
//                     <CommandItem
//                       key={user.id}
//                       onSelect={() => toggleRecipient(user)}
//                       className={cn(
//                         "cursor-pointer", 
//                         isSelected(user) ? "bg-muted" : ""
//                       )}
//                     >
//                       <div className="flex items-center gap-2 w-full">
//                         <Avatar className="h-6 w-6">
//                           <AvatarImage src={user.avatar_url} alt={`${user.first_name} ${user.last_name}`} />
//                           <AvatarFallback>{user.first_name?.[0]}{user.last_name?.[0]}</AvatarFallback>
//                         </Avatar>
//                         <span>{user.first_name} {user.last_name}</span>
//                       </div>
//                     </CommandItem>
//                   ))}
//                 </ScrollArea>
//               )}
//             </CommandList>
//           </Command>
//         </div>

//         <DialogFooter className="pt-4">
//           <Button variant="outline" onClick={() => setOpen(false)} type="button">
//             Cancel
//           </Button>
//           <Button 
//             onClick={handleCreate} 
//             disabled={recipients.length === 0}
//             type="button"
//           >
//             Start Conversation
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   )
// }


// import { useState } from "react"
// import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog"
// import { Button } from "@/components/ui/button"
// import { ScrollArea } from "@/components/ui/scroll-area"
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
// import { User } from "@/types"
// import { useUsers } from "@/hooks/useUsers"
// import { cn } from "@/lib/utils"

// type NewConversationDialogProps = {
//   open: boolean
//   setOpen: (open: boolean) => void
//   onCreateConversation: (recipientIds: string[]) => void
// }

// export function NewConversationDialog({ open, setOpen, onCreateConversation }: NewConversationDialogProps) {
//   const [recipients, setRecipients] = useState<User[]>([])
//   const { users: availableUsers, searchQuery, setSearchQuery, loading } = useUsers()
//   const [searchTerm, setSearchTerm] = useState('');

//   const toggleRecipient = (user: User) => {
//     const exists = recipients.find((u) => u.id === user.id)
//     if (exists) {
//       setRecipients(recipients.filter((u) => u.id !== user.id))
//     } else {
//       setRecipients([...recipients, user])
//     }
//   }

//   const isSelected = (user: User) => recipients.some((u) => u.id === user.id)

//   const handleCreate = () => {
//     if (recipients.length === 0) return
//     onCreateConversation(recipients.map((u) => u.id))
//     setRecipients([])
//     setSearchQuery("")
//     setOpen(false)
//   }

//   return (
//     <Dialog open={open} onOpenChange={setOpen}>
//       <DialogContent className="sm:max-w-md">
//         <DialogHeader>
//           <DialogTitle>Start a New Conversation</DialogTitle>
//           <p className="text-sm text-muted-foreground">Find a user to start chatting with.</p>
//         </DialogHeader>

//         <Command>
//           <CommandInput
//             placeholder="Search by name..."
//             value={searchQuery}
//             onValueChange={setSearchQuery}
//             className="text-sm"
//           />
//           <CommandList>
//             {loading && <div className="p-2 text-muted-foreground text-sm">Loading...</div>}
//             {!loading && availableUsers.length === 0 && (
//               <div className="p-2 text-muted-foreground text-sm">No users found</div>
//             )}
//             <ScrollArea className="max-h-[250px]">
//               {availableUsers.map((user) => (
//                 <CommandItem
//                   key={user.id}
//                   value={`${user.first_name} ${user.last_name}`}
//                   onSelect={() => toggleRecipient(user)}
//                   className={cn("cursor-pointer", isSelected(user) && "bg-muted")}
//                 >
//                   <Avatar className="h-6 w-6 mr-2">
//                     <AvatarImage src={user.avatar_url} />
//                     <AvatarFallback>{user.first_name?.[0]}{user.last_name?.[0]}</AvatarFallback>
//                   </Avatar>
//                   {user.first_name} {user.last_name}
//                 </CommandItem>
//               ))}
//             </ScrollArea>
//           </CommandList>
//         </Command>
// {/* <Command>
//   <CommandInput 
   
//     placeholder="Search by name..."
//     value={searchQuery}
//     onValueChange={setSearchQuery}
//     className="text-sm"
//   />
//   <CommandEmpty>No user found.</CommandEmpty>
//   <CommandGroup>
//     {filteredUsers
//       .filter(user =>
//         getUserDisplayName(user).toLowerCase().includes(searchTerm.toLowerCase())
//       )
//       .map((user) => (
//         <CommandItem
//           key={user.id}
//           value={user.id}
//           onSelect={() => {
//             setSelectedUsers((prev) =>
//               prev.includes(user.id)
//                 ? prev.filter((id) => id !== user.id)
//                 : [...prev, user.id]
//             );
//           }}
//         >
//           <Check
//             className={cn(
//               "mr-2 h-4 w-4",
//               selectedUsers.includes(user.id) ? "opacity-100" : "opacity-0"
//             )}
//           />
//           {getUserDisplayName(user)}
//         </CommandItem>
//       ))}
//   </CommandGroup>
// </Command> */}
//         <DialogFooter className="pt-4">
//           <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
//           <Button onClick={handleCreate} disabled={recipients.length === 0}>Start Conversation</Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   )
// }

// // import React, { useState, useEffect } from 'react';
// // import { useNavigate } from 'react-router-dom';
// // import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
// // import { Button } from '@/components/ui/button';
// // import { Input } from '@/components/ui/input';
// // import { Label } from '@/components/ui/label';
// // import { useToast } from '@/hooks/use-toast';
// // import { supabase } from '@/integrations/supabase/client';
// // import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
// // import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
// // import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
// // import { cn } from '@/lib/utils';
// // import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// // interface User {
// //   id: string;
// //   first_name: string | null;
// //   last_name: string | null;
// //   avatar_url: string | null;
// // }

// // interface NewConversationDialogProps {
// //   open: boolean;
// //   onOpenChange: (open: boolean) => void;
// //   onCreateConversation: (subject: string, recipientIds: string[]) => Promise<string | null>;
// // }

// // const NewConversationDialog: React.FC<NewConversationDialogProps> = ({ 
// //   open, 
// //   onOpenChange,
// //   onCreateConversation
// // }) => {
// //   const [subject, setSubject] = useState('');
// //   const [recipients, setRecipients] = useState<User[]>([]);
// //   const [availableUsers, setAvailableUsers] = useState<User[]>([]);
// //   const [loading, setLoading] = useState(false);
// //   const [loadingUsers, setLoadingUsers] = useState(false);
// //   const [openCombobox, setOpenCombobox] = useState(false);
// //   const [searchValue, setSearchValue] = useState('');
// //   const navigate = useNavigate();
// //   const { toast } = useToast();

// //   // Fetch available users
// //   useEffect(() => {
// //     const fetchUsers = async () => {
// //       setLoadingUsers(true);
// //       try {
// //         const { data, error } = await supabase
// //           .from('profiles')
// //           .select('id, first_name, last_name, avatar_url')
// //           .not('id', 'eq', (await supabase.auth.getUser()).data.user?.id);
        
// //         if (error) throw error;
        
// //         setAvailableUsers(data || []);
// //       } catch (error) {
// //         console.error('Error fetching users:', error);
// //         toast({
// //           title: 'Error',
// //           description: 'Could not load users. Please try again.',
// //           variant: 'destructive',
// //         });
// //       } finally {
// //         setLoadingUsers(false);
// //       }
// //     };
    
// //     if (open) {
// //       fetchUsers();
// //     }
// //   }, [open, toast]);

// //   const handleCreateConversation = async () => {
// //     if (!subject.trim() || recipients.length === 0) {
// //       toast({
// //         title: 'Invalid input',
// //         description: 'Please enter a subject and select at least one recipient.',
// //         variant: 'destructive',
// //       });
// //       return;
// //     }
    
// //     setLoading(true);
    
// //     try {
// //       const recipientIds = recipients.map(r => r.id);
// //       const conversationId = await onCreateConversation(subject, recipientIds);
      
// //       if (conversationId) {
// //         onOpenChange(false);
// //         navigate(`/messages/${conversationId}`);
// //         setSubject('');
// //         setRecipients([]);
// //       }
// //     } catch (error) {
// //       console.error('Error creating conversation:', error);
// //       toast({
// //         title: 'Error',
// //         description: 'Failed to create conversation. Please try again.',
// //         variant: 'destructive',
// //       });
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const addRecipient = (user: User) => {
// //     if (!recipients.find(r => r.id === user.id)) {
// //       setRecipients([...recipients, user]);
// //     }
// //     setOpenCombobox(false);
// //     setSearchValue('');
// //   };

// //   const removeRecipient = (userId: string) => {
// //     setRecipients(recipients.filter(r => r.id !== userId));
// //   };

// //   const filteredUsers = availableUsers.filter(user => 
// //     !recipients.some(r => r.id === user.id) && 
// //     ((user.first_name && user.first_name.toLowerCase().includes(searchValue.toLowerCase())) || 
// //      (user.last_name && user.last_name.toLowerCase().includes(searchValue.toLowerCase())))
// //   );

// //   return (
// //     <Dialog open={open} onOpenChange={onOpenChange}>
// //       <DialogContent className="sm:max-w-[525px]">
// //         <DialogHeader>
// //           <DialogTitle>New Conversation</DialogTitle>
// //         </DialogHeader>
        
// //         <div className="space-y-4">
// //           <div className="space-y-2">
// //             <Label htmlFor="subject">Subject</Label>
// //             <Input
// //               id="subject"
// //               value={subject}
// //               onChange={(e) => setSubject(e.target.value)}
// //               placeholder="Enter conversation subject"
// //             />
// //           </div>
          
// //           <div className="space-y-2">
// //             <Label>Recipients</Label>
            
// //             <div className="flex flex-wrap gap-2 mb-2">
// //               {recipients.map(recipient => (
// //                 <div key={recipient.id} className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded">
// //                   <span>{recipient.first_name} {recipient.last_name}</span>
// //                   <button 
// //                     onClick={() => removeRecipient(recipient.id)}
// //                     className="text-amber-800 hover:text-amber-950"
// //                   >
// //                     ×
// //                   </button>
// //                 </div>
// //               ))}
// //             </div>
            
// //             <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
// //               <PopoverTrigger asChild>
// //                 <Button
// //                   variant="outline"
// //                   role="combobox"
// //                   aria-expanded={openCombobox}
// //                   className="w-full justify-between"
// //                 >
// //                   {searchValue || "Select recipients..."}
// //                   <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
// //                 </Button>
// //               </PopoverTrigger>
// //               <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
// //                 <Command>
// //                   <CommandInput 
// //                     placeholder="Search users..." 
// //                     value={searchValue}
// //                     onValueChange={setSearchValue}
// //                   />
// //                   <CommandList>
// //                     <CommandEmpty>No users found.</CommandEmpty>
// //                     <CommandGroup>
// //                       {loadingUsers ? (
// //                         <div className="flex justify-center p-2">
// //                           <Loader2 className="h-4 w-4 animate-spin" />
// //                         </div>
// //                       ) : (
// //                         filteredUsers.map(user => (
// //                           <CommandItem
// //                             key={user.id}
// //                             value={user.id}
// //                             onSelect={() => addRecipient(user)}
// //                           >
// //                             <div className="flex items-center gap-2">
// //                               <Avatar className="h-6 w-6">
// //                                 <AvatarImage src={user.avatar_url || ''} />
// //                                 <AvatarFallback className="bg-amber-100 text-amber-800">
// //                                   {user.first_name?.[0] || ''}
// //                                 </AvatarFallback>
// //                               </Avatar>
// //                               <span>{user.first_name} {user.last_name}</span>
// //                             </div>
// //                             <Check
// //                               className={cn(
// //                                 "ml-auto h-4 w-4",
// //                                 recipients.some(r => r.id === user.id) ? "opacity-100" : "opacity-0"
// //                               )}
// //                             />
// //                           </CommandItem>
// //                         ))
// //                       )}
// //                     </CommandGroup>
// //                   </CommandList>
// //                 </Command>
// //               </PopoverContent>
// //             </Popover>
// //           </div>
// //         </div>
        
// //         <DialogFooter>
// //           <Button 
// //             variant="outline" 
// //             onClick={() => onOpenChange(false)}
// //           >
// //             Cancel
// //           </Button>
// //           <Button 
// //             onClick={handleCreateConversation}
// //             disabled={loading || !subject.trim() || recipients.length === 0}
// //             className="bg-amber-600 hover:bg-amber-700"
// //           >
// //             {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
// //             Create
// //           </Button>
// //         </DialogFooter>
// //       </DialogContent>
// //     </Dialog>
// //   );
// // };

// // export default NewConversationDialog;
