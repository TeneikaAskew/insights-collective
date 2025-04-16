
import { useState, useEffect } from 'react';
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

  const loadConversations = async () => {
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
      console.log('[useConversationList] Conversations fetched:', conversationsData);
      // Filter out archived and deleted conversations
      const activeConversations = conversationsData.filter(
        c => !c.archived && !c.deleted_at
      );
      setConversations(activeConversations);
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

  useEffect(() => {
    loadConversations();

    const channel = supabase
      .channel('conversation-changes')
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
          filter: `user_id=eq.${user?.id}`,
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
      .subscribe();

    return () => {
      console.log('[useConversationList] Cleaning up channel...');
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  return {
    conversations,
    loading,
    error,
    refresh: loadConversations
  };
}
