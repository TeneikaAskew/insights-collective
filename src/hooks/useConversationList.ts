
import { useState, useEffect, useRef } from 'react';
import { Conversation } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { fetchUserConversations } from '@/services/conversationService';
import { supabase } from '@/integrations/supabase/client';

export function useConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const channelRef = useRef<any>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const loadConversations = async () => {
    // Throttle fetches to prevent excessive API calls
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 1000) {
      return; // Don't fetch more than once per second
    }
    lastFetchTimeRef.current = now;

    if (!user) {
      console.log('[useConversationList] No user found, skipping load.');
      setLoading(false);
      return;
    }

    console.log('[useConversationList] Loading conversations for user:', user.id);
    setLoading(true);
    setError(null);
    try {
      const conversationsData = await fetchUserConversations(user.id);
      
      // Ensure component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      console.log('[useConversationList] Conversations fetched:', conversationsData);
      // Filter out archived and deleted conversations
      const activeConversations = conversationsData.filter(
        c => !c.archived && !c.deleted_at
      );
      setConversations(activeConversations);
    } catch (error) {
      console.error('[useConversationList] Error loading conversations:', error);
      
      // Ensure component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      setError(error);
      toast({
        title: 'Error',
        description: 'Could not load your conversations. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      // Ensure component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      setLoading(false);
      console.log('[useConversationList] Finished loading');
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    // Only load conversations and set up subscriptions if user exists
    if (user?.id) {
      loadConversations();

      // Clean up existing channel before creating a new one
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Create a single channel with multiple listeners
      channelRef.current = supabase
        .channel(`conversation-changes-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
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
          console.log(`[useConversationList] Channel subscription status: ${status}`);
        });
    }

    return () => {
      isMountedRef.current = false;
      
      if (channelRef.current) {
        console.log('[useConversationList] Cleaning up channel...');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]); // Only recreate subscription when user ID changes, not on every render

  return {
    conversations,
    loading,
    error,
    refresh: loadConversations
  };
}
