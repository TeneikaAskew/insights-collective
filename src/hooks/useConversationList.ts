import { useState, useEffect, useRef, useCallback } from 'react'; // Import useCallback
// Make sure Message and ConversationParticipant are imported here
import { Conversation, Message, ConversationParticipant } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { fetchUserConversations } from '@/services/conversationService';
import { supabase } from '@/integrations/supabase/client';
// Make sure REALTIME_SUBSCRIBE_STATES is imported for type annotation
import { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useConversationList');

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

  // Define loadConversations using useCallback for stability
  const loadConversations = useCallback(async (source = 'unknown') => { // Add source for logging
    if (!user) {
      logger.log(`[useConversationList] No user for loadConversations (triggered by ${source}), clearing state.`);
      setLoading(false);
      loadingRef.current = false;
      setConversations([]);
      return; // Exit if no user
    }

    // Avoid concurrent loads using ref
    if (loadingRef.current) {
        logger.log(`[useConversationList] Load already in progress, skipping load triggered by ${source}.`);
        return;
    }
    logger.log(`[useConversationList] Loading inbox conversations (triggered by ${source}) for user:`, user.id);
    setLoading(true);
    loadingRef.current = true; // Set loading flag
    setError(null);
    try {
      const conversationsData = await fetchUserConversations(user.id);
      logger.log('[useConversationList] Raw conversations received from fetchUserConversations:',
        conversationsData.map(c => ({ id: c.id, archived: !!c.archived, deleted: !!c.deleted_at }))
      );

      // Enhanced logging for the specific problematic conversation
      const problematicConvo = conversationsData.find(c => c.id === '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88');
      if (problematicConvo) {
          logger.warn(`[useConversationList] PROBLEM: Conversation 10fb00f9... (Archived: ${!!problematicConvo.archived}, Deleted: ${!!problematicConvo.deleted_at}) received from fetchUserConversations!`, problematicConvo);
      } else {
           logger.log('[useConversationList] Conversation 10fb00f9... not found in received inbox data.');
      }

      logger.log('[useConversationList] Setting state with conversations count:', conversationsData.length);
      setConversations(conversationsData as Conversation[]);
    } catch (error) {
      logger.error(`[useConversationList] Error loading conversations (triggered by ${source}):`, error);
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
      logger.log(`[useConversationList] Finished loading inbox (triggered by ${source})`);
    }
  }, [user, toast]); // Dependencies for useCallback

  useEffect(() => {
    logger.log('[useConversationList] useEffect fired. User:', user?.id);
    if (!user) {
      logger.log('[useConversationList] No user found, skipping initial load and realtime setup.');
      setLoading(false);
      loadingRef.current = false;
      setConversations([]); // Clear conversations if no user
      // Clean up existing channel if user logs out
      if (channelRef.current) {
        logger.log('[useConversationList] Removing channel due to user logout.');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Initial load
    loadConversations('initial mount');

    // Realtime handler
     const handleRealtimeChange = (payload: RealtimePostgresChangesPayload<any>, source: string) => {
       // Apply imported types correctly
       const newRecord = payload.new as Partial<Conversation & Message & ConversationParticipant>;
       const oldRecord = payload.old as Partial<Conversation & Message & ConversationParticipant>;
       const eventType = payload.eventType;

       const newId = newRecord?.id;
       const oldId = oldRecord?.id;
       // For messages or participants, the relevant conversation ID is on the record itself
       const conversationId = newRecord?.conversation_id || oldRecord?.conversation_id;
       // For conversation updates, the ID is directly on the record
       const directConversationId = newId || oldId;

       logger.log(`[useConversationList] Realtime change detected from ${source}:`, {
         event: eventType,
         table: payload.table,
         schema: payload.schema,
         newId: newId,
         oldId: oldId,
         conversationId: conversationId,
         directConversationId: directConversationId,
         newArchived: (newRecord as Partial<Conversation>)?.archived,
         newDeleted: (newRecord as Partial<Conversation>)?.deleted_at,
         newReadStatus: (newRecord as Partial<Message>)?.read, // Log read status changes
         oldReadStatus: (oldRecord as Partial<Message>)?.read,
       });


       const PROBLEM_ID = '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88';
       let isRelevantToProblem = false;

       if (directConversationId === PROBLEM_ID) {
         isRelevantToProblem = true;
         logger.warn(`[useConversationList] Realtime event directly on conversation ${PROBLEM_ID} from ${source}. Reloading inbox.`);
       } else if (conversationId === PROBLEM_ID) {
         isRelevantToProblem = true;
         logger.warn(`[useConversationList] Realtime event (participant/message) related to conversation ${PROBLEM_ID} from ${source}. Reloading inbox.`);
       } else {
         logger.log(`[useConversationList] Realtime event from ${source} detected (Not ${PROBLEM_ID}). Reloading inbox.`);
       }

       // Always reload for simplicity for now, pass the source
       loadConversations(`realtime ${source}`);
     };


    logger.log('[useConversationList] Setting up realtime channel...');
    // Ensure only one channel instance exists per user ID
    const channelKey = `conversation-changes-${user.id}`;

    // If channel exists for this key, it might be reused, but listeners need careful handling.
    // Safest approach: Remove old channel completely and create a new one ensures clean state.
    if (channelRef.current) {
        logger.log('[useConversationList] Removing previous channel before creating new one:', channelRef.current.topic);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null; // Clear the ref
    }

    logger.log('[useConversationList] Creating new channel:', channelKey);
    channelRef.current = supabase.channel(channelKey);

    const currentChannel = channelRef.current; // Use a stable variable inside the effect

     // Subscribe to CONVERSATIONS changes
    currentChannel.on<any>(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'conversations',
        },
         (payload) => {
            // Safe access to IDs
            const convId = (payload.new as any)?.id || (payload.old as any)?.id;
            if (!convId) return;

            // Check if the current user is still a participant
            supabase
              .from('conversation_participants')
              .select('user_id', { count: 'exact', head: true })
              .eq('conversation_id', convId)
              .eq('user_id', user.id)
              .then(({ count }) => {
                if (count && count > 0) {
                  handleRealtimeChange(payload, 'conversations table (*)');
                } else {
                   logger.log('[useConversationList] Ignoring conversation change (user not participant):', convId);
                }
              });
         }
      )
      // Subscribe to PARTICIPANT changes
      .on<any>(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`, // Filter directly for efficiency
        },
        (payload) => handleRealtimeChange(payload, 'conversation_participants table (*)')
      )
      // Subscribe to MESSAGE inserts
       .on<any>(
         'postgres_changes',
         {
           event: 'INSERT', // Only new messages
           schema: 'public',
           table: 'messages',
         },
          (payload) => {
             // Safe access to IDs
             const convId = (payload.new as any)?.conversation_id;
             if (!convId) return;

             // Check if the user is a participant in the message's conversation
             supabase
               .from('conversation_participants')
               .select('user_id', { count: 'exact', head: true })
               .eq('conversation_id', convId)
               .eq('user_id', user.id)
               .then(({ count }) => {
                 if (count && count > 0) {
                     setConversations(currentConvos => {
                       const currentConvoState = currentConvos.find(c => c.id === convId);
                       if (currentConvoState) {
                          logger.log('[useConversationList] New message detected for inbox conversation:', convId);
                          handleRealtimeChange(payload, 'messages table (INSERT)');
                       } else {
                           logger.log('[useConversationList] New message for conversation not currently in inbox (archived/deleted/filtered?):', convId);
                       }
                       return currentConvos; // Return unchanged state if not triggering reload
                     });
                 } else {
                    logger.log('[useConversationList] Ignoring new message (user not participant):', convId);
                 }
               });
          }
       )
       // Subscribe to MESSAGE updates (for read status changes)
       .on<any>(
         'postgres_changes',
         {
           event: 'UPDATE', // Listen for updates
           schema: 'public',
           table: 'messages',
           // We need to filter/check participation like with inserts
         },
          (payload) => {
             const convId = (payload.new as any)?.conversation_id;
             const messageId = (payload.new as any)?.id;
             const oldReadStatus = (payload.old as any)?.read;
             const newReadStatus = (payload.new as any)?.read;

             // Only proceed if 'read' status actually changed, and changed to true
             if (!convId || oldReadStatus === newReadStatus || newReadStatus !== true) return;

             logger.log(`[useConversationList] Message UPDATE detected for convo ${convId}, msg ${messageId}. Read status changed: ${oldReadStatus} -> ${newReadStatus}`);

             // Check if the user is a participant in the message's conversation
             supabase
               .from('conversation_participants')
               .select('user_id', { count: 'exact', head: true })
               .eq('conversation_id', convId)
               .eq('user_id', user.id)
               .then(({ count }) => {
                 if (count && count > 0) {
                    // Check if this update makes the *last* message read (or if any change should trigger refresh)
                    // For simplicity, let's just trigger a reload if the conversation is currently visible
                    setConversations(currentConvos => {
                      const currentConvoState = currentConvos.find(c => c.id === convId);
                      if (currentConvoState) {
                         logger.log('[useConversationList] Message update (likely read status) detected for inbox conversation:', convId);
                         handleRealtimeChange(payload, 'messages table (UPDATE)');
                      } else {
                          logger.log('[useConversationList] Message update for conversation not currently in inbox:', convId);
                      }
                      return currentConvos; // Return unchanged state if not triggering reload
                    });
                 } else {
                    logger.log('[useConversationList] Ignoring message update (user not participant):', convId);
                 }
               });
          }
       )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES, err?: Error) => { // Explicit type annotation for status
        logger.log(`[useConversationList] Realtime subscription status: ${status}`);

        // Compare status by casting string literals to the REALTIME_SUBSCRIBE_STATES type
        if (status === ('SUBSCRIPTION_ERROR' as REALTIME_SUBSCRIBE_STATES)) {
          logger.error('[useConversationList] Realtime subscription error:', err);
           toast({
             title: 'Connection Issue',
             description: 'Could not connect to live message updates. Please refresh.',
             variant: 'destructive',
           });
        } else if (
            status === ('CHANNEL_ERROR' as REALTIME_SUBSCRIBE_STATES) ||
            status === ('TIMED_OUT' as REALTIME_SUBSCRIBE_STATES) ||
            status === ('CLOSED' as REALTIME_SUBSCRIBE_STATES)
            ) {
             logger.warn(`[useConversationList] Realtime channel issue: ${status}`, err);
             // Optionally attempt to resubscribe or notify user
        } else if (status === ('SUBSCRIBED' as REALTIME_SUBSCRIBE_STATES)) {
             logger.log('[useConversationList] Realtime successfully SUBSCRIBED.');
             // Optionally trigger a load on successful subscribe to ensure consistency
             // loadConversations('realtime subscribed'); // Maybe too aggressive?
        } else {
             logger.log('[useConversationList] Realtime status:', status);
        }
      });

    // Cleanup function
    return () => {
      logger.log('[useConversationList] useEffect cleanup running...');
      if (currentChannel) {
        logger.log('[useConversationList] Removing channel during cleanup:', currentChannel.topic);
        supabase.removeChannel(currentChannel)
          .catch(removeError => {
             logger.error('[useConversationList] Error removing channel during cleanup:', removeError);
          });
        // Important: Clear the ref only if it matches the channel being removed
        if (channelRef.current === currentChannel) {
           channelRef.current = null;
        }
      }
    };
  }, [user, toast, loadConversations]); // Added loadConversations to deps


  return {
    conversations,
    loading,
    error,
    refreshConversations: () => loadConversations('manual refresh') // Wrap manual refresh with source
  };
}
