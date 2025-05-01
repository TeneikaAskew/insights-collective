
    import { useState, useEffect, useRef, useCallback } from 'react'; // Import useCallback
    // Make sure Message and ConversationParticipant are imported here
    import { Conversation, Message, ConversationParticipant } from '@/types/supabase';
    import { useAuth } from '@/contexts/AuthContext';
    import { useToast } from './use-toast';
    import { fetchUserConversations } from '@/services/conversationService';
    import { supabase } from '@/integrations/supabase/client';
    // Make sure REALTIME_SUBSCRIBE_STATES is imported for type annotation
    import { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

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
      const loadConversations = useCallback(async () => {
        if (!user) {
          console.log('[useConversationList] No user for loadConversations, clearing state.');
          setLoading(false);
          loadingRef.current = false;
          setConversations([]);
          return; // Exit if no user
        }

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

          // Enhanced logging for the specific problematic conversation
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
      }, [user, toast]); // Dependencies for useCallback

      useEffect(() => {
        console.log('[useConversationList] useEffect fired. User:', user?.id);
        if (!user) {
          console.log('[useConversationList] No user found, skipping initial load and realtime setup.');
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

        // Initial load
        loadConversations();

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

           console.log(`[useConversationList] Realtime change detected from ${source}:`, {
             event: eventType,
             table: payload.table,
             newId: newId,
             oldId: oldId,
             conversationId: conversationId,
             directConversationId: directConversationId,
             newArchived: (newRecord as Partial<Conversation>)?.archived,
             newDeleted: (newRecord as Partial<Conversation>)?.deleted_at,
           });


           const PROBLEM_ID = '10fb00f9-a8e1-4c84-ae72-3f332cfc8b88';
           let isRelevantToProblem = false;

           if (directConversationId === PROBLEM_ID) {
             isRelevantToProblem = true;
             console.warn(`[useConversationList] Realtime event directly on conversation ${PROBLEM_ID} from ${source}. Reloading inbox.`);
           } else if (conversationId === PROBLEM_ID) {
             isRelevantToProblem = true;
             console.warn(`[useConversationList] Realtime event (participant/message) related to conversation ${PROBLEM_ID} from ${source}. Reloading inbox.`);
           } else {
             console.log(`[useConversationList] Realtime event from ${source} detected (Not ${PROBLEM_ID}). Reloading inbox.`);
           }

           loadConversations(); // Reload inbox on any relevant change for simplicity for now
         };


        console.log('[useConversationList] Setting up realtime channel...');
        // Ensure only one channel instance exists per user ID
        const channelKey = `conversation-changes-${user.id}`;

        // If channel exists for this key, it might be reused, but listeners need careful handling.
        // Safest approach: Remove old channel completely and create a new one ensures clean state.
        if (channelRef.current) {
            console.log('[useConversationList] Removing previous channel before creating new one:', channelRef.current.topic);
            supabase.removeChannel(channelRef.current);
            channelRef.current = null; // Clear the ref
        }

        console.log('[useConversationList] Creating new channel:', channelKey);
        channelRef.current = supabase.channel(channelKey);

        const currentChannel = channelRef.current; // Use a stable variable inside the effect

         // Subscribe to changes
        currentChannel.on<any>( // Use <any> for payload type flexibility
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'conversations',
              // No user_id filter here, we check participation below
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
              filter: `user_id=eq.${user.id}`, // Filter directly for efficiency
            },
            (payload) => handleRealtimeChange(payload, 'conversation_participants table')
          )
           .on<any>(
             'postgres_changes',
             {
               event: 'INSERT',
               schema: 'public',
               table: 'messages',
               // No conversation_id filter here, check participation below
             },
              (payload) => {
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
                         // Check if the conversation is currently visible in the inbox (not archived/deleted)
                         // We use the local state `conversations` which `loadConversations` will update
                         // This check prevents reloading if a message arrives for an already archived/deleted convo
                         // Need to use a function to get current state inside this async callback
                         setConversations(currentConvos => {
                           const currentConvoState = currentConvos.find(c => c.id === convId);
                           if (currentConvoState) { // Only proceed if the convo is currently in the inbox list
                              console.log('[useConversationList] New message detected for inbox conversation:', convId);
                              handleRealtimeChange(payload, 'messages table (INSERT)');
                           } else {
                               console.log('[useConversationList] New message for conversation not currently in inbox (archived/deleted/filtered?):', convId);
                           }
                           return currentConvos; // Return unchanged state
                         });
                     } else {
                        console.log('[useConversationList] Ignoring new message (user not participant):', convId);
                     }
                   });
              }
           )
          .subscribe((status: REALTIME_SUBSCRIBE_STATES, err?: Error) => { // Explicit type annotation for status
            console.log(`[useConversationList] Realtime subscription status: ${status}`);

            // Compare status by casting string literals to the REALTIME_SUBSCRIBE_STATES type
            if (status === ('SUBSCRIPTION_ERROR' as REALTIME_SUBSCRIBE_STATES)) {
              console.error('[useConversationList] Realtime subscription error:', err);
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
                 console.warn(`[useConversationList] Realtime channel issue: ${status}`, err);
                 // Optionally attempt to resubscribe or notify user
            } else if (status !== ('SUBSCRIBED' as REALTIME_SUBSCRIBE_STATES)) {
                 console.log('[useConversationList] Realtime status:', status);
            }
          });

        // Cleanup function
        return () => {
          console.log('[useConversationList] useEffect cleanup running...');
          if (currentChannel) {
            console.log('[useConversationList] Removing channel during cleanup:', currentChannel.topic);
            supabase.removeChannel(currentChannel)
              .catch(removeError => {
                 console.error('[useConversationList] Error removing channel during cleanup:', removeError);
              });
            // Important: Clear the ref only if it matches the channel being removed
            if (channelRef.current === currentChannel) {
               channelRef.current = null;
            }
          }
        };
        // Dependencies: user and toast. loadConversations depends on user.id and toast.
      }, [user, toast, loadConversations]); // Added loadConversations to deps


      return {
        conversations,
        loading,
        error,
        refreshConversations: loadConversations // Expose the function
      };
    }
    