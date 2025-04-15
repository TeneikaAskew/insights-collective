import { useState, useEffect } from 'react';
import { Conversation } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { fetchUserConversations } from '@/services/conversationService';
import { supabase } from '@/integrations/supabase/client';

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

/**
 * Hook for fetching and subscribing to conversations
 */
export function useConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    console.log('[useConversationList] useEffect fired');
    if (!user) {
      console.log('[useConversationList] No user found, skipping load.');
      setLoading(false);
      return;
    }

    const loadConversations = async () => {
      console.log('[useConversationList] Loading conversations for user:', user.id);
      setLoading(true);
      setError(null);
      try {
        const conversationsData = await fetchUserConversations(user.id);
        console.log('[useConversationList] Conversations fetched:', conversationsData);
        setConversations(conversationsData as Conversation[]);
      } catch (error) {
        console.error('[useConversationList] Error loading conversations:', error);
        setError(error);
        toast({
          title: 'Error',
          description: 'Could not load your conversations. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
        console.log('[useConversationList] Finished loading');
      }
    };

    loadConversations();

    console.log('[useConversationList] Setting up realtime channel...');
    const channel = supabase
      .channel('conversation-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `created_by=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useConversationList] Conversation change detected:', payload);
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useConversationList] Participant change detected:', payload);
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('[useConversationList] New message detected:', payload);
          loadConversations();
        }
      )
      .subscribe((status) => {
        console.log('[useConversationList] Realtime subscription status:', status);
        if (status !== 'SUBSCRIBED') {
          console.error('[useConversationList] Failed to subscribe to realtime changes:', status);
        }
      });

    return () => {
      console.log('[useConversationList] Cleaning up channel...');
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  return {
    conversations,
    loading,
    error,
  };
}
