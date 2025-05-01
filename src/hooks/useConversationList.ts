
import { useState, useEffect, useRef } from 'react';
import { Conversation } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { fetchUserConversations } from '@/services/conversationService';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Hook for fetching and subscribing to conversations
 */
export function useConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const loadingRef = useRef(false); // Use ref to prevent race conditions in load

  useEffect(() => {
    console.log('[useConversationList] useEffect fired. User:', user?.id);
    if (!user) {
      console.log('[useConversationList] No user found, skipping load.');
      setLoading(false);
      loadingRef.current = false;
      setConversations([]); // Clear conversations if no user
      // Clean up existing channel if user logs out
      if (channelRef.current) {
        console.log('[useConversationList] Removing channel due to user logout.');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const loadConversations = async () => {
      // Avoid concurrent loads using ref
      if (loadingRef.current) {
          console.log('[useConversationList] Load already in progress, skipping.');
          return;
      }
      console.log('[useConversationList] Loading inbox conversations for user:', user.id);
      setLoading(true);
      loadingRef.current = true; // Set loading flag
      setError(null);
      try {
        const conversationsData = await fetchUserConversations(user.id);
        console.log('[useConversationList] Raw conversations received from fetchUserConversations:',
          conversationsData.map(c => ({ id: c.id, archived: !!c.archived, deleted: !!c.deleted_at }))
        );

        const problematicConvo = conversationsData.find(c => c.id === '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88');
        if (problematicConvo) {
            console.warn(`[useConversationList] PROBLEM: Conversation 10fb00f9... (Archived: ${!!problematicConvo.archived}, Deleted: ${!!problematicConvo.deleted_at}) received from fetchUserConversations!`, problematicConvo);
        } else {
             console.log('[useConversationList] Conversation 10fb00f9... not found in received inbox data.');
        }

        console.log('[useConversationList] Setting state with conversations count:', conversationsData.length);
        setConversations(conversationsData as Conversation[]);
      } catch (error) {
        console.error('[useConversationList] Error loading conversations:', error);
        setError(error);
        if (!(error instanceof Error && error.message.includes('JWT'))) {
          toast({
            title: 'Error',
            description: 'Could not load your conversations. Please try again later.',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
        loadingRef.current = false; // Reset loading flag
        console.log('[useConversationList] Finished loading inbox');
      }
    };

    loadConversations();

    // Realtime handler
     const handleRealtimeChange = (payload: RealtimePostgresChangesPayload<any>, source: string) => {
       console.log(`[useConversationList] Realtime change detected from ${source}:`, { event: payload.eventType, table: payload.table, id: payload.new?.id || payload.old?.id });

       // Use optional chaining for safer access
       const newId = payload.new?.id;
       const oldId = payload.old?.id;
       const conversationId = payload.new?.conversation_id;

       let relevantId: string | null = null;
       if (newId === '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88' || oldId === '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88') {
           relevantId = '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88';
           console.warn(`[useConversationList] Realtime event related to conversation ${relevantId} detected from ${source}. Reloading inbox.`);
       } else if (conversationId === '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88') {
            relevantId = '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88';
            console.warn(`[useConversationList] Realtime event (participant/message) related to conversation ${relevantId} detected from ${source}. Reloading inbox.`);
       } else {
           console.log(`[useConversationList] Realtime event from ${source} detected. Reloading inbox.`);
       }

       loadConversations(); // Reload inbox on any relevant change
     };


    console.log('[useConversationList] Setting up realtime channel...');
    // Ensure only one channel instance exists per user ID
    const channelKey = `conversation-changes-${user.id}`;

    // If channel exists for this key, remove previous listeners before re-subscribing
    if (channelRef.current && channelRef.current.topic === channelKey) {
        console.log('[useConversationList] Removing old listeners from existing channel:', channelKey);
        channelRef.current.off('postgres_changes');
    } else {
        // If channel doesn't exist or key changed, remove old one (if any) and create new
        if (channelRef.current) {
            console.log('[useConversationList] Removing different channel:', channelRef.current.topic);
            supabase.removeChannel(channelRef.current);
        }
        console.log('[useConversationList] Creating new channel:', channelKey);
        channelRef.current = supabase.channel(channelKey);
    }

    const currentChannel = channelRef.current; // Use a stable variable inside the effect

     // Subscribe to changes
    currentChannel.on<any>( // Use <any> for payload type flexibility if specific types cause issues
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
         (payload) => {
            // Safe access to IDs
            const convId = payload.new?.id || payload.old?.id;
            if (!convId) return;

            supabase
              .from('conversation_participants')
              .select('user_id', { count: 'exact', head: true })
              .eq('conversation_id', convId)
              .eq('user_id', user.id)
              .then(({ count }) => {
                if (count && count > 0) {
                  handleRealtimeChange(payload, 'conversations table (*)');
                } else {
                   console.log('[useConversationList] Ignoring conversation change (user not participant):', convId);
                }
              });
         }
      )
      .on<any>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => handleRealtimeChange(payload, 'conversation_participants table')
      )
       .on<any>(
         'postgres_changes',
         {
           event: 'INSERT',
           schema: 'public',
           table: 'messages',
         },
          (payload) => {
             const convId = payload.new?.conversation_id;
             if (!convId) return;

             supabase
               .from('conversation_participants')
               .select('user_id', { count: 'exact', head: true })
               .eq('conversation_id', convId)
               .eq('user_id', user.id)
               .then(({ count }) => {
                 if (count && count > 0) {
                     const currentConvoState = conversations.find(c => c.id === convId);
                     // Check includes deleted_at
                     if (!currentConvoState || (!currentConvoState.archived && !currentConvoState.deleted_at)) {
                        console.log('[useConversationList] New message detected for relevant conversation:', convId);
                        handleRealtimeChange(payload, 'messages table (INSERT)');
                     } else {
                         console.log('[useConversationList] New message for conversation not currently in inbox (archived/deleted):', convId);
                     }
                 } else {
                    console.log('[useConversationList] Ignoring new message (user not participant):', convId);
                 }
               });
          }
       )
      .subscribe((status, err) => {
        console.log(`[useConversationList] Realtime subscription status: ${status}`);
        // status type is REALTIME_SUBSCRIBE_STATES which is a string enum
        if (status === 'SUBSCRIPTION_ERROR') { // This comparison is correct
          console.error('[useConversationList] Realtime subscription error:', err);
           toast({
             title: 'Connection Issue',
             description: 'Could not connect to live message updates. Please refresh.',
             variant: 'destructive',
           });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
             console.warn(`[useConversationList] Realtime channel issue: ${status}`, err);
             // Optionally attempt to resubscribe or notify user
        } else if (status !== 'SUBSCRIBED') {
             console.log('[useConversationList] Realtime status:', status);
        }
      });

    // Cleanup function
    return () => {
      console.log('[useConversationList] useEffect cleanup running...');
      if (currentChannel) {
        console.log('[useConversationList] Removing channel during cleanup:', currentChannel.topic);
        supabase.removeChannel(currentChannel);
        // Important: Clear the ref only if it matches the channel being removed
        if (channelRef.current === currentChannel) {
           channelRef.current = null;
        }
      }
    };
    // Ensure dependencies cover user changes and potentially toast function
    // Removed 'loading' and 'conversations' to prevent loops, managed loading with ref
  }, [user, toast]);


  return {
    conversations,
    loading,
    error,
  };
}
