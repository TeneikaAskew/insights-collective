
import { useState, useEffect } from 'react';
import { Conversation } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { fetchUserConversations } from '@/services/conversationService';
import { supabase } from '@/integrations/supabase/client';

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
    console.log('[useConversationList] useEffect fired. User:', user?.id);
    if (!user) {
      console.log('[useConversationList] No user found, skipping load.');
      setLoading(false);
      setConversations([]); // Clear conversations if no user
      return;
    }

    const loadConversations = async () => {
      // Avoid concurrent loads
      if (loading) {
          console.log('[useConversationList] Load already in progress, skipping.');
          return;
      }
      console.log('[useConversationList] Loading inbox conversations for user:', user.id);
      setLoading(true);
      setError(null);
      try {
        const conversationsData = await fetchUserConversations(user.id);
        // ADDED: Log received conversation IDs and their archived/deleted status
        console.log('[useConversationList] Raw conversations received from fetchUserConversations:',
          conversationsData.map(c => ({ id: c.id, archived: !!c.archived, deleted: !!c.deleted_at }))
        );

        // Check if the problematic conversation is present *before* setting state
        const problematicConvo = conversationsData.find(c => c.id === '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88');
        if (problematicConvo) {
            console.warn(`[useConversationList] PROBLEM: Conversation 10fb00f9... (Archived: ${!!problematicConvo.archived}) received from fetchUserConversations!`, problematicConvo);
        } else {
             console.log('[useConversationList] Conversation 10fb00f9... not found in received inbox data.');
        }

        console.log('[useConversationList] Setting state with conversations count:', conversationsData.length);
        setConversations(conversationsData as Conversation[]);
      } catch (error) {
        console.error('[useConversationList] Error loading conversations:', error);
        setError(error);
        // Avoid toast for auth errors handled elsewhere
        if (!(error instanceof Error && error.message.includes('JWT'))) {
          toast({
            title: 'Error',
            description: 'Could not load your conversations. Please try again later.',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
        console.log('[useConversationList] Finished loading inbox');
      }
    };

    loadConversations();

    // Realtime handler
     const handleRealtimeChange = (payload: any, source: string) => {
       console.log(`[useConversationList] Realtime change detected from ${source}:`, { event: payload.eventType, table: payload.table, id: payload.new?.id || payload.old?.id });

       // Check if the change involves the problematic conversation ID for debugging
       let relevantId: string | null = null;
       if (payload.new?.id === '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88' || payload.old?.id === '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88') {
           relevantId = '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88';
           console.warn(`[useConversationList] Realtime event related to conversation ${relevantId} detected from ${source}. Reloading inbox.`);
       } else if (payload.new?.conversation_id === '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88') {
            relevantId = '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88';
            console.warn(`[useConversationList] Realtime event (participant/message) related to conversation ${relevantId} detected from ${source}. Reloading inbox.`);
       } else {
           console.log(`[useConversationList] Realtime event from ${source} detected. Reloading inbox.`);
       }

       loadConversations(); // Reload inbox on any relevant change
     };


    console.log('[useConversationList] Setting up realtime channel...');
    // Ensure only one channel instance exists
    const channelKey = `conversation-changes-${user.id}`;
    let channel = supabase.channel(channelKey);

     // Remove existing listeners before adding new ones
    channel.off('postgres_changes');


    channel = channel.on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'conversations',
          // Filter for conversations where the user IS a participant (more reliable than created_by)
          // This requires checking the participants table, ideally via a function or by reloading on any change and filtering client-side/service-side
          // Let's refine this: listen to updates and check participation in the handler
        },
         (payload) => {
            // Check if user is involved *before* calling handler
            supabase
              .from('conversation_participants')
              .select('user_id', { count: 'exact', head: true })
              .eq('conversation_id', payload.new?.id || payload.old?.id)
              .eq('user_id', user.id)
              .then(({ count }) => {
                if (count && count > 0) {
                  handleRealtimeChange(payload, 'conversations table (*)');
                } else {
                   console.log('[useConversationList] Ignoring conversation change (user not participant):', payload.new?.id || payload.old?.id);
                }
              });
         }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, DELETE (UPDATE handled by conversation listener)
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`, // User added or removed
        },
        (payload) => handleRealtimeChange(payload, 'conversation_participants table')
      )
       .on(
         'postgres_changes',
         {
           event: 'INSERT', // Only care about new messages for inbox update trigger
           schema: 'public',
           table: 'messages',
           // Cannot filter by participant directly here, filter in handler
         },
          (payload) => {
             // Check if the message belongs to a conversation the user is part of
             supabase
               .from('conversation_participants')
               .select('user_id', { count: 'exact', head: true })
               .eq('conversation_id', payload.new?.conversation_id)
               .eq('user_id', user.id)
               .then(({ count }) => {
                 if (count && count > 0) {
                     // Only reload if the conversation *should* be in the inbox (not archived/deleted)
                     const currentConvoState = conversations.find(c => c.id === payload.new?.conversation_id);
                     if (!currentConvoState || (!currentConvoState.archived && !currentConvoState.deleted_at)) {
                        console.log('[useConversationList] New message detected for relevant conversation:', payload.new?.conversation_id);
                        handleRealtimeChange(payload, 'messages table (INSERT)');
                     } else {
                         console.log('[useConversationList] New message for conversation not currently in inbox:', payload.new?.conversation_id);
                         // Potentially trigger refresh of archived/deleted lists if needed elsewhere
                     }
                 } else {
                    console.log('[useConversationList] Ignoring new message (user not participant):', payload.new?.conversation_id);
                 }
               });
          }
       )
      .subscribe((status, err) => {
        console.log(`[useConversationList] Realtime subscription status: ${status}`);
        if (status === 'SUBSCRIPTION_ERROR') {
          console.error('[useConversationList] Realtime subscription error:', err);
          // Maybe add a toast here
           toast({
             title: 'Connection Issue',
             description: 'Could not connect to live message updates. Please refresh.',
             variant: 'destructive',
           });
        }
         if (status !== 'SUBSCRIBED' && status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT' && status !== 'CLOSED') {
            console.warn('[useConversationList] Unexpected realtime status:', status);
         }
      });

    return () => {
      console.log('[useConversationList] Cleaning up channel...');
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
    // Add conversations to dependency array if used inside checks (like message insert check)
    // Add loading to prevent concurrent loads triggered by dependency changes
  }, [user, toast, loading]); // Removed 'conversations' from deps to avoid loop, filtering logic improved


  return {
    conversations,
    loading,
    error,
  };
}
