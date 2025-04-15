import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Archive, Trash, Dot } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ConversationListProps {
  conversations: any[];
  loading: boolean;
  error?: any;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({ conversations = [], loading, error, onDelete, onArchive }) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<'archive' | 'delete' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleClick = (id: string) => {
    navigate(`/messages/${id}`);
  };

  const handleConfirm = () => {
    if (!selectedId) return;
    if (confirmAction === 'archive') onArchive?.(selectedId);
    if (confirmAction === 'delete') onDelete?.(selectedId);
    setConfirmAction(null);
    setSelectedId(null);
  };

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading conversations</AlertTitle>
        <AlertDescription>
          {error.message || 'Please try again later.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.filter(c => !c.deleted_at && !c.archived).map((conv) => {
        const isActive = conversationId === conv.id;
        const lastMessage = conv.last_message;
        const unreadCount = conv.messages?.filter((msg: any) => !msg.read && msg.sender_id !== conv.current_user_id).length || 0;
        const participant = conv.participants.find((p: any) => p.user_id !== conv.current_user_id);
        const name = `${participant?.profile?.first_name || 'User'} ${participant?.profile?.last_name || ''}`;

        return (
          <Card
            key={conv.id}
            className={`p-3 cursor-pointer transition hover:bg-muted/50 relative ${isActive ? 'bg-muted' : ''}`}
            onClick={() => handleClick(conv.id)}
          >
            <div className="flex justify-between items-center">
              <div className="flex gap-3 items-start">
                <Avatar>
                  <AvatarImage src={participant?.profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {participant?.profile?.first_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium line-clamp-1">
                      {name || 'Unnamed'}
                    </span>
                    {unreadCount > 0 && <span className="text-xs text-blue-600">• {unreadCount} unread</span>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {lastMessage?.content || 'No messages yet'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedId(conv.id); setConfirmAction('archive'); }}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Archive Conversation?</DialogTitle>
                    </DialogHeader>
                    <p>This conversation will be moved to the archive. You can restore it later.</p>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
                      <Button onClick={handleConfirm}>Archive</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedId(conv.id); setConfirmAction('delete'); }}>
                      <Trash className="h-4 w-4 text-destructive" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Conversation?</DialogTitle>
                    </DialogHeader>
                    <p>This action cannot be undone. Are you sure you want to delete this conversation?</p>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
                      <Button onClick={handleConfirm} className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
            </p>
          </Card>
        );
      })}
    </div>
  );
};

export default ConversationList;


// import React from 'react';
// import { useNavigate, useParams } from 'react-router-dom';
// import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
// import { Card } from '@/components/ui/card';
// import { Skeleton } from '@/components/ui/skeleton';
// import { formatDistanceToNow } from 'date-fns';
// import { AlertCircle, Archive, Trash, Dot } from 'lucide-react';
// import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// import { Button } from '@/components/ui/button';

// interface ConversationListProps {
//   conversations: any[];
//   loading: boolean;
//   error?: any;
//   onDelete?: (id: string) => void;
//   onArchive?: (id: string) => void;
// }

// const ConversationList: React.FC<ConversationListProps> = ({ conversations = [], loading, error, onDelete, onArchive }) => {
//   const { conversationId } = useParams();
//   const navigate = useNavigate();

//   const handleClick = (id: string) => {
//     navigate(`/messages/${id}`);
//   };

//   if (error) {
//     return (
//       <Alert variant="destructive" className="mb-4">
//         <AlertCircle className="h-4 w-4" />
//         <AlertTitle>Error loading conversations</AlertTitle>
//         <AlertDescription>
//           {error.message || 'Please try again later.'}
//         </AlertDescription>
//       </Alert>
//     );
//   }

//   if (loading) {
//     return (
//       <div className="space-y-2">
//         {[1, 2, 3].map((i) => (
//           <Card key={i} className="p-4">
//             <div className="flex gap-3">
//               <Skeleton className="h-12 w-12 rounded-full" />
//               <div className="flex-1">
//                 <Skeleton className="h-4 w-3/4 mb-2" />
//                 <Skeleton className="h-3 w-1/2" />
//               </div>
//             </div>
//           </Card>
//         ))}
//       </div>
//     );
//   }

//   return (
//     {!conversation.last_message?.read && (
//   <span className="text-blue-500 text-xs ml-2">●</span>
// )}

//     <div className="space-y-2">
//       {conversations.filter(c => !c.deleted_at && !c.archived).map((conv) => {
//         const isActive = conversationId === conv.id;
//         const lastMessage = conv.last_message;
//         const unread = lastMessage && !lastMessage.read && lastMessage.sender_id !== conv.current_user_id;
//         const participant = conv.participants.find((p: any) => p.user_id !== conv.current_user_id);
//         const name = `${participant?.profile?.first_name || 'User'} ${participant?.profile?.last_name || ''}`;

//         return (
//           <Card
//             key={conv.id}
//             className={`p-3 cursor-pointer transition hover:bg-muted/50 relative ${isActive ? 'bg-muted' : ''}`}
//             onClick={() => handleClick(conv.id)}
//           >
//             <div className="flex justify-between items-center">
//               <div className="flex gap-3 items-start">
//                 <Avatar>
//                   <AvatarImage src={participant?.profile?.avatar_url || undefined} />
//                   <AvatarFallback>
//                     {participant?.profile?.first_name?.[0] || 'U'}
//                   </AvatarFallback>
//                 </Avatar>
//                 <div className="space-y-1">
//                   <div className="flex items-center gap-2">
//                     <span className="font-medium line-clamp-1">
//                       {name || 'Unnamed'}
//                     </span>
//                     {unread && <Dot className="h-4 w-4 text-primary animate-pulse" />}
//                   </div>
//                   <p className="text-sm text-muted-foreground line-clamp-1">
//                     {lastMessage?.content || 'No messages yet'}
//                   </p>
//                 </div>
//               </div>

//               <div className="flex gap-2">
//                 <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onArchive?.(conv.id); }}>
//                   <Archive className="h-4 w-4" />
//                 </Button>
//                 <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete?.(conv.id); }}>
//                   <Trash className="h-4 w-4 text-destructive" />
//                 </Button>
//               </div>
//             </div>

//             <p className="text-xs text-muted-foreground mt-1">
//               {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
//             </p>
//           </Card>
//         );
//       })}
//     </div>
//   );
// };

// export default ConversationList;

// // import { useState, useEffect } from 'react';
// // import { Conversation } from '@/types/supabase';
// // import { useAuth } from '@/contexts/AuthContext';
// // import { useToast } from './use-toast';
// // import { fetchUserConversations } from '@/services/conversationService';
// // import { supabase } from '@/integrations/supabase/client';

// // /**
// //  * Hook for fetching and subscribing to conversations
// //  */
// // export function useConversationList() {
// //   const [conversations, setConversations] = useState<Conversation[]>([]);
// //   const [loading, setLoading] = useState(true);
// //   const [error, setError] = useState<any>(null);
// //   const { user } = useAuth();
// //   const { toast } = useToast();

// //   useEffect(() => {
// //     console.log('[useConversationList] useEffect fired');
// //     if (!user) {
// //       console.log('[useConversationList] No user found, skipping load.');
// //       setLoading(false);
// //       return;
// //     }

// //     const loadConversations = async () => {
// //       console.log('[useConversationList] Loading conversations for user:', user.id);
// //       setLoading(true);
// //       setError(null);
// //       try {
// //         const conversationsData = await fetchUserConversations(user.id);
// //         console.log('[useConversationList] Conversations fetched:', conversationsData);
// //         setConversations(conversationsData as Conversation[]);
// //       } catch (error) {
// //         console.error('[useConversationList] Error loading conversations:', error);
// //         setError(error);
// //         toast({
// //           title: 'Error',
// //           description: 'Could not load your conversations. Please try again later.',
// //           variant: 'destructive',
// //         });
// //       } finally {
// //         setLoading(false);
// //         console.log('[useConversationList] Finished loading');
// //       }
// //     };

// //     loadConversations();

// //     console.log('[useConversationList] Setting up realtime channel...');
// //     const channel = supabase
// //       .channel('conversation-changes')
// //       .on(
// //         'postgres_changes',
// //         {
// //           event: '*',
// //           schema: 'public',
// //           table: 'conversations',
// //           filter: `created_by=eq.${user.id}`,
// //         },
// //         (payload) => {
// //           console.log('[useConversationList] Conversation change detected:', payload);
// //           loadConversations();
// //         }
// //       )
// //       .on(
// //         'postgres_changes',
// //         {
// //           event: '*',
// //           schema: 'public',
// //           table: 'conversation_participants',
// //           filter: `user_id=eq.${user.id}`,
// //         },
// //         (payload) => {
// //           console.log('[useConversationList] Participant change detected:', payload);
// //           loadConversations();
// //         }
// //       )
// //       .on(
// //         'postgres_changes',
// //         {
// //           event: 'INSERT',
// //           schema: 'public',
// //           table: 'messages',
// //         },
// //         (payload) => {
// //           console.log('[useConversationList] New message detected:', payload);
// //           loadConversations();
// //         }
// //       )
// //       .subscribe((status) => {
// //         console.log('[useConversationList] Realtime subscription status:', status);
// //         if (status !== 'SUBSCRIBED') {
// //           console.error('[useConversationList] Failed to subscribe to realtime changes:', status);
// //         }
// //       });

// //     return () => {
// //       console.log('[useConversationList] Cleaning up channel...');
// //       supabase.removeChannel(channel);
// //     };
// //   }, [user, toast]);

// //   return {
// //     conversations,
// //     loading,
// //     error,
// //   };
// // }
