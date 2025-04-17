import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, 
  Archive, 
  Mail,
  MoreHorizontal,
  Loader2 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface MessageActionsProps {
  conversationId: string;
  onSuccess?: () => void;
}

const MessageActions: React.FC<MessageActionsProps> = ({
  conversationId,
  onSuccess
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleMarkAsUnread = async () => {
    if (!user || !conversationId) return;
    
    setLoading('unread');
    try {
      console.log('Marking conversation as unread:', conversationId);
      
      // Find the latest message in the conversation
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      console.log('Latest message data:', messages);
      console.log('Latest message error:', messagesError);
      
      if (messagesError) {
        throw messagesError;
      }
      
      if (!messages || messages.length === 0) {
        throw new Error('No messages found in this conversation');
      }
      
      // Mark the latest message as unread
      const { data: updateData, error: updateError } = await supabase
        .from('messages')
        .update({ read: false })
        .eq('id', messages[0].id)
        .select();
      
      console.log('Update result:', updateData);
      console.log('Update error:', updateError);
      
      if (updateError) {
        throw updateError;
      }
      
      toast({
        title: 'Success',
        description: 'Conversation marked as unread',
      });
      
      // Navigate back to the inbox
      navigate('/messages');
    } catch (error) {
      console.error('Error marking conversation as unread:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark conversation as unread',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };
  
  const handleArchive = async () => {
    if (!user || !conversationId) return;
    
    setLoading('archive');
    try {
      console.log('Archiving conversation:', conversationId);
      
      // First, let's fetch the current conversation to see its state
      const { data: currentConversation, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      
      console.log('Current conversation data:', currentConversation);
      console.log('Fetch conversation error:', fetchError);
      
      if (fetchError) {
        throw fetchError;
      }
      
      // Update archived flag in the conversations table
      const { data: updateData, error: updateError } = await supabase
        .from('conversations')
        .update({ archived: true })
        .eq('id', conversationId)
        .select();
      
      console.log('Update result:', updateData);
      console.log('Update error:', updateError);
      
      if (updateError) {
        throw updateError;
      }
      
      // Verify the update was successful
      const { data: verifyData, error: verifyError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      
      console.log('Verification after update:', verifyData);
      console.log('Verification error:', verifyError);
      
      toast({
        title: 'Success',
        description: 'Conversation archived',
      });
      
      // Immediately navigate to archived tab
      navigate('/messages');
      // Use setTimeout to ensure the navigation completes before changing tabs
      setTimeout(() => {
        const archivedTab = document.querySelector('[value="archived"]');
        if (archivedTab && archivedTab instanceof HTMLElement) {
          archivedTab.click();
        }
      }, 100);
    } catch (error) {
      console.error('Error archiving conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive conversation',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };
  
  const handleDelete = async () => {
    if (!user || !conversationId) return;
    
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }
    
    setLoading('delete');
    try {
      console.log('Deleting conversation:', conversationId);
      
      // First, let's fetch the current conversation to see its state
      const { data: currentConversation, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      
      console.log('Current conversation data:', currentConversation);
      console.log('Fetch conversation error:', fetchError);
      
      if (fetchError) {
        throw fetchError;
      }
      
      // Soft delete the conversation
      const { data: updateData, error: updateError } = await supabase
        .from('conversations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', conversationId)
        .select();
      
      console.log('Update result:', updateData);
      console.log('Update error:', updateError);
      
      if (updateError) {
        throw updateError;
      }
      
      // Verify the update was successful
      const { data: verifyData, error: verifyError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      
      console.log('Verification after update:', verifyData);
      console.log('Verification error:', verifyError);
      
      toast({
        title: 'Success',
        description: 'Conversation deleted',
      });
      
      // Immediately navigate back to inbox
      navigate('/messages');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center justify-between p-2 border-b bg-gray-50">
      <div className="flex space-x-1">
        {/* Desktop view - buttons */}
        <div className="hidden md:flex space-x-1">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleMarkAsUnread}
            disabled={loading !== null}
            className="text-gray-600 hover:text-amber-600"
          >
            {loading === 'unread' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Mark unread
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleArchive}
            disabled={loading !== null}
            className="text-gray-600 hover:text-amber-600"
          >
            {loading === 'archive' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Archive className="h-4 w-4 mr-2" />
            )}
            Archive
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleDelete}
            disabled={loading !== null}
            className="text-gray-600 hover:text-amber-600"
          >
            {loading === 'delete' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete
          </Button>
        </div>
        
        {/* Mobile view - dropdown */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={loading !== null}>
                <MoreHorizontal className="h-4 w-4 mr-2" />
                Actions
                {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleMarkAsUnread} disabled={loading !== null}>
                <Mail className="h-4 w-4 mr-2" />
                Mark unread
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive} disabled={loading !== null}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} disabled={loading !== null}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="text-sm text-gray-500">
        <span onClick={() => console.log('Debug: ConversationId =', conversationId)} className="cursor-pointer">
          Debug
        </span>
      </div>
    </div>
  );
};

export default MessageActions;
// import React, { useState } from 'react';
// import { Button } from '@/components/ui/button';
// import { useNavigate } from 'react-router-dom';
// import { 
//   Trash2, 
//   Archive, 
//   Mail,
//   MoreHorizontal,
//   Loader2 
// } from 'lucide-react';
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from '@/components/ui/dropdown-menu';
// import { useToast } from '@/hooks/use-toast';
// import { useAuth } from '@/contexts/AuthContext';
// import { supabase } from '@/integrations/supabase/client';

// interface MessageActionsProps {
//   conversationId: string;
//   onSuccess?: () => void;
// }

// const MessageActions: React.FC<MessageActionsProps> = ({
//   conversationId,
//   onSuccess
// }) => {
//   const { toast } = useToast();
//   const { user } = useAuth();
//   const [loading, setLoading] = useState<string | null>(null);
//   const navigate = useNavigate();

//   const handleMarkAsUnread = async () => {
//     if (!user || !conversationId) return;
    
//     setLoading('unread');
//     try {
//       // Find the latest message in the conversation
//       const { data: messages, error: messagesError } = await supabase
//         .from('messages')
//         .select('id')
//         .eq('conversation_id', conversationId)
//         .order('created_at', { ascending: false })
//         .limit(1);
      
//       if (messagesError) {
//         throw messagesError;
//       }
      
//       if (!messages || messages.length === 0) {
//         throw new Error('No messages found in this conversation');
//       }
      
//       // Mark the latest message as unread
//       const { error: updateError } = await supabase
//         .from('messages')
//         .update({ read: false })
//         .eq('id', messages[0].id);
      
//       if (updateError) {
//         throw updateError;
//       }
      
//       toast({
//         title: 'Success',
//         description: 'Conversation marked as unread',
//       });
      
//       // Navigate back to the inbox
//       navigate('/messages');
//     } catch (error) {
//       console.error('Error marking conversation as unread:', error);
//       toast({
//         title: 'Error',
//         description: 'Failed to mark conversation as unread',
//         variant: 'destructive',
//       });
//     } finally {
//       setLoading(null);
//     }
//   };
  
//   const handleArchive = async () => {
//     if (!user || !conversationId) return;
    
//     setLoading('archive');
//     try {
//       // Check if the user is a participant
//       const { data: participant, error: participantError } = await supabase
//         .from('conversation_participants')
//         .select('id')
//         .eq('conversation_id', conversationId)
//         .eq('user_id', user.id)
//         .maybeSingle();
      
//       if (participantError) {
//         throw participantError;
//       }
      
//       if (!participant) {
//         throw new Error('You are not a participant in this conversation');
//       }
      
//       // Update archived flag in the conversations table
//       const { error: updateError } = await supabase
//         .from('conversations')
//         .update({ archived: true })
//         .eq('id', conversationId);
      
//       if (updateError) {
//         throw updateError;
//       }
      
//       toast({
//         title: 'Success',
//         description: 'Conversation archived',
//       });
      
//       // Immediately navigate to archived tab
//       navigate('/messages');
//       // Use setTimeout to ensure the navigation completes before changing tabs
//       setTimeout(() => {
//         const archivedTab = document.querySelector('[value="archived"]');
//         if (archivedTab && archivedTab instanceof HTMLElement) {
//           archivedTab.click();
//         }
//       }, 100);
//     } catch (error) {
//       console.error('Error archiving conversation:', error);
//       toast({
//         title: 'Error',
//         description: 'Failed to archive conversation',
//         variant: 'destructive',
//       });
//     } finally {
//       setLoading(null);
//     }
//   };
  
//   const handleDelete = async () => {
//     if (!user || !conversationId) return;
    
//     if (!window.confirm('Are you sure you want to delete this conversation?')) {
//       return;
//     }
    
//     setLoading('delete');
//     try {
//       // Check if the user is a participant
//       const { data: participant, error: participantError } = await supabase
//         .from('conversation_participants')
//         .select('id')
//         .eq('conversation_id', conversationId)
//         .eq('user_id', user.id)
//         .maybeSingle();
      
//       if (participantError) {
//         throw participantError;
//       }
      
//       if (!participant) {
//         throw new Error('You are not a participant in this conversation');
//       }
      
//       // Soft delete the conversation
//       const { error: updateError } = await supabase
//         .from('conversations')
//         .update({ deleted_at: new Date().toISOString() })
//         .eq('id', conversationId);
      
//       if (updateError) {
//         throw updateError;
//       }
      
//       toast({
//         title: 'Success',
//         description: 'Conversation deleted',
//       });
      
//       // Immediately navigate back to inbox
//       navigate('/messages');
//     } catch (error) {
//       console.error('Error deleting conversation:', error);
//       toast({
//         title: 'Error',
//         description: 'Failed to delete conversation',
//         variant: 'destructive',
//       });
//     } finally {
//       setLoading(null);
//     }
//   };

//   return (
//     <div className="flex items-center justify-between p-2 border-b bg-gray-50">
//       <div className="flex space-x-1">
//         {/* Desktop view - buttons */}
//         <div className="hidden md:flex space-x-1">
//           <Button 
//             variant="ghost" 
//             size="sm"
//             onClick={handleMarkAsUnread}
//             disabled={loading !== null}
//             className="text-gray-600 hover:text-amber-600"
//           >
//             {loading === 'unread' ? (
//               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
//             ) : (
//               <Mail className="h-4 w-4 mr-2" />
//             )}
//             Mark unread
//           </Button>
          
//           <Button 
//             variant="ghost" 
//             size="sm"
//             onClick={handleArchive}
//             disabled={loading !== null}
//             className="text-gray-600 hover:text-amber-600"
//           >
//             {loading === 'archive' ? (
//               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
//             ) : (
//               <Archive className="h-4 w-4 mr-2" />
//             )}
//             Archive
//           </Button>
          
//           <Button 
//             variant="ghost" 
//             size="sm"
//             onClick={handleDelete}
//             disabled={loading !== null}
//             className="text-gray-600 hover:text-amber-600"
//           >
//             {loading === 'delete' ? (
//               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
//             ) : (
//               <Trash2 className="h-4 w-4 mr-2" />
//             )}
//             Delete
//           </Button>
//         </div>
        
//         {/* Mobile view - dropdown */}
//         <div className="md:hidden">
//           <DropdownMenu>
//             <DropdownMenuTrigger asChild>
//               <Button variant="ghost" size="sm" disabled={loading !== null}>
//                 <MoreHorizontal className="h-4 w-4 mr-2" />
//                 Actions
//                 {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
//               </Button>
//             </DropdownMenuTrigger>
//             <DropdownMenuContent align="start">
//               <DropdownMenuItem onClick={handleMarkAsUnread} disabled={loading !== null}>
//                 <Mail className="h-4 w-4 mr-2" />
//                 Mark unread
//               </DropdownMenuItem>
//               <DropdownMenuItem onClick={handleArchive} disabled={loading !== null}>
//                 <Archive className="h-4 w-4 mr-2" />
//                 Archive
//               </DropdownMenuItem>
//               <DropdownMenuItem onClick={handleDelete} disabled={loading !== null}>
//                 <Trash2 className="h-4 w-4 mr-2" />
//                 Delete
//               </DropdownMenuItem>
//             </DropdownMenuContent>
//           </DropdownMenu>
//         </div>
//       </div>
      
//       <div className="text-sm text-gray-500">
//         {/* Conversation info could go here */}
//       </div>
//     </div>
//   );
// };

// export default MessageActions;

// // import React, { useState } from 'react';
// // import { Button } from '@/components/ui/button';
// // import { 
// //   Trash2, 
// //   Archive, 
// //   Mail,
// //   MoreHorizontal,
// //   Loader2 
// // } from 'lucide-react';
// // import {
// //   DropdownMenu,
// //   DropdownMenuContent,
// //   DropdownMenuItem,
// //   DropdownMenuTrigger,
// // } from '@/components/ui/dropdown-menu';
// // import { useToast } from '@/hooks/use-toast';
// // import { useAuth } from '@/contexts/AuthContext';
// // import { 
// //   markConversationAsUnread, 
// //   archiveConversation, 
// //   deleteConversation 
// // } from '@/services/conversationService';

// // interface MessageActionsProps {
// //   conversationId: string;
// //   onSuccess?: () => void;
// // }

// // const MessageActions: React.FC<MessageActionsProps> = ({
// //   conversationId,
// //   onSuccess
// // }) => {
// //   const { toast } = useToast();
// //   const { user } = useAuth();
// //   const [loading, setLoading] = useState<string | null>(null);

// //   const handleMarkAsUnread = async () => {
// //     if (!user || !conversationId) return;
    
// //     setLoading('unread');
// //     try {
// //       await markConversationAsUnread(conversationId, user.id);
      
// //       toast({
// //         title: 'Success',
// //         description: 'Conversation marked as unread',
// //       });
      
// //       if (onSuccess) onSuccess();
// //     } catch (error) {
// //       console.error('Error marking conversation as unread:', error);
// //       toast({
// //         title: 'Error',
// //         description: 'Failed to mark conversation as unread',
// //         variant: 'destructive',
// //       });
// //     } finally {
// //       setLoading(null);
// //     }
// //   };
  
// //   const handleArchive = async () => {
// //     if (!user || !conversationId) return;
    
// //     setLoading('archive');
// //     try {
// //       await archiveConversation(conversationId, user.id);
      
// //       toast({
// //         title: 'Success',
// //         description: 'Conversation archived',
// //       });
      
// //       if (onSuccess) onSuccess();
// //     } catch (error) {
// //       console.error('Error archiving conversation:', error);
// //       toast({
// //         title: 'Error',
// //         description: 'Failed to archive conversation',
// //         variant: 'destructive',
// //       });
// //     } finally {
// //       setLoading(null);
// //     }
// //   };
  
// //   const handleDelete = async () => {
// //     if (!user || !conversationId) return;
    
// //     if (!window.confirm('Are you sure you want to delete this conversation?')) {
// //       return;
// //     }
    
// //     setLoading('delete');
// //     try {
// //       await deleteConversation(conversationId, user.id);
      
// //       toast({
// //         title: 'Success',
// //         description: 'Conversation deleted',
// //       });
      
// //       if (onSuccess) onSuccess();
// //     } catch (error) {
// //       console.error('Error deleting conversation:', error);
// //       toast({
// //         title: 'Error',
// //         description: 'Failed to delete conversation',
// //         variant: 'destructive',
// //       });
// //     } finally {
// //       setLoading(null);
// //     }
// //   };

// //   return (
// //     <div className="flex items-center justify-between p-2 border-b bg-gray-50">
// //       <div className="flex space-x-1">
// //         {/* Desktop view - buttons */}
// //         <div className="hidden md:flex space-x-1">
// //           <Button 
// //             variant="ghost" 
// //             size="sm"
// //             onClick={handleMarkAsUnread}
// //             disabled={loading !== null}
// //             className="text-gray-600 hover:text-amber-600"
// //           >
// //             {loading === 'unread' ? (
// //               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
// //             ) : (
// //               <Mail className="h-4 w-4 mr-2" />
// //             )}
// //             Mark unread
// //           </Button>
          
// //           <Button 
// //             variant="ghost" 
// //             size="sm"
// //             onClick={handleArchive}
// //             disabled={loading !== null}
// //             className="text-gray-600 hover:text-amber-600"
// //           >
// //             {loading === 'archive' ? (
// //               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
// //             ) : (
// //               <Archive className="h-4 w-4 mr-2" />
// //             )}
// //             Archive
// //           </Button>
          
// //           <Button 
// //             variant="ghost" 
// //             size="sm"
// //             onClick={handleDelete}
// //             disabled={loading !== null}
// //             className="text-gray-600 hover:text-amber-600"
// //           >
// //             {loading === 'delete' ? (
// //               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
// //             ) : (
// //               <Trash2 className="h-4 w-4 mr-2" />
// //             )}
// //             Delete
// //           </Button>
// //         </div>
        
// //         {/* Mobile view - dropdown */}
// //         <div className="md:hidden">
// //           <DropdownMenu>
// //             <DropdownMenuTrigger asChild>
// //               <Button variant="ghost" size="sm" disabled={loading !== null}>
// //                 <MoreHorizontal className="h-4 w-4 mr-2" />
// //                 Actions
// //                 {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
// //               </Button>
// //             </DropdownMenuTrigger>
// //             <DropdownMenuContent align="start">
// //               <DropdownMenuItem onClick={handleMarkAsUnread} disabled={loading !== null}>
// //                 <Mail className="h-4 w-4 mr-2" />
// //                 Mark unread
// //               </DropdownMenuItem>
// //               <DropdownMenuItem onClick={handleArchive} disabled={loading !== null}>
// //                 <Archive className="h-4 w-4 mr-2" />
// //                 Archive
// //               </DropdownMenuItem>
// //               <DropdownMenuItem onClick={handleDelete} disabled={loading !== null}>
// //                 <Trash2 className="h-4 w-4 mr-2" />
// //                 Delete
// //               </DropdownMenuItem>
// //             </DropdownMenuContent>
// //           </DropdownMenu>
// //         </div>
// //       </div>
      
// //       <div className="text-sm text-gray-500">
// //         {/* Conversation info could go here */}
// //       </div>
// //     </div>
// //   );
// // };

// // export default MessageActions;

// // // import React from 'react';
// // // import { Button } from '@/components/ui/button';
// // // import { 
// // //   Trash2, 
// // //   Archive, 
// // //   Mail,
// // //   MoreHorizontal
// // // } from 'lucide-react';
// // // import {
// // //   DropdownMenu,
// // //   DropdownMenuContent,
// // //   DropdownMenuItem,
// // //   DropdownMenuTrigger,
// // // } from '@/components/ui/dropdown-menu';
// // // import { useToast } from '@/hooks/use-toast';

// // // interface MessageActionsProps {
// // //   conversationId: string;
// // //   onMarkUnread: () => void;
// // //   onArchive: () => void;
// // //   onDelete: () => void;
// // // }

// // // const MessageActions: React.FC<MessageActionsProps> = ({
// // //   conversationId,
// // //   onMarkUnread,
// // //   onArchive,
// // //   onDelete
// // // }) => {
// // //   const { toast } = useToast();

// // //   // Placeholder for actions not yet implemented
// // //   const handleAction = (action: string) => {
// // //     toast({
// // //       title: 'Action not implemented',
// // //       description: `The ${action} action will be available soon.`,
// // //     });
// // //   };

// // //   return (
// // //     <div className="flex items-center justify-between p-2 border-b bg-gray-50">
// // //       <div className="flex space-x-1">
// // //         {/* Desktop view - buttons */}
// // //         <div className="hidden md:flex space-x-1">
// // //           <Button 
// // //             variant="ghost" 
// // //             size="sm"
// // //             onClick={onMarkUnread || (() => handleAction('Mark unread'))}
// // //             className="text-gray-600 hover:text-amber-600"
// // //           >
// // //             <Mail className="h-4 w-4 mr-2" />
// // //             Mark unread
// // //           </Button>
          
// // //           <Button 
// // //             variant="ghost" 
// // //             size="sm"
// // //             onClick={onArchive || (() => handleAction('Archive'))}
// // //             className="text-gray-600 hover:text-amber-600"
// // //           >
// // //             <Archive className="h-4 w-4 mr-2" />
// // //             Archive
// // //           </Button>
          
// // //           <Button 
// // //             variant="ghost" 
// // //             size="sm"
// // //             onClick={onDelete || (() => handleAction('Delete'))}
// // //             className="text-gray-600 hover:text-amber-600"
// // //           >
// // //             <Trash2 className="h-4 w-4 mr-2" />
// // //             Delete
// // //           </Button>
// // //         </div>
        
// // //         {/* Mobile view - dropdown */}
// // //         <div className="md:hidden">
// // //           <DropdownMenu>
// // //             <DropdownMenuTrigger asChild>
// // //               <Button variant="ghost" size="sm">
// // //                 <MoreHorizontal className="h-4 w-4" />
// // //                 Actions
// // //               </Button>
// // //             </DropdownMenuTrigger>
// // //             <DropdownMenuContent align="start">
// // //               <DropdownMenuItem onClick={onMarkUnread || (() => handleAction('Mark unread'))}>
// // //                 <Mail className="h-4 w-4 mr-2" />
// // //                 Mark unread
// // //               </DropdownMenuItem>
// // //               <DropdownMenuItem onClick={onArchive || (() => handleAction('Archive'))}>
// // //                 <Archive className="h-4 w-4 mr-2" />
// // //                 Archive
// // //               </DropdownMenuItem>
// // //               <DropdownMenuItem onClick={onDelete || (() => handleAction('Delete'))}>
// // //                 <Trash2 className="h-4 w-4 mr-2" />
// // //                 Delete
// // //               </DropdownMenuItem>
// // //             </DropdownMenuContent>
// // //           </DropdownMenu>
// // //         </div>
// // //       </div>
      
// // //       <div className="text-sm text-gray-500">
// // //         {/* Conversation info could go here */}
// // //       </div>
// // //     </div>
// // //   );
// // // };

// // // export default MessageActions;
