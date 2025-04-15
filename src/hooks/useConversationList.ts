
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
  const [activeTab, setActiveTab] = useState<'all' | 'archived'>('all');

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
        
        // Add current_user_id to each conversation object if not present
        const enrichedConversations = conversationsData.map(conv => ({
          ...conv,
          current_user_id: conv.current_user_id || user.id
        }));
        
        setConversations(enrichedConversations);
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

  const restoreConversation = async (id: string) => {
    try {
      await supabase
        .from('conversations')
        .update({ archived: false })
        .eq('id', id);
        
      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === id ? { ...conv, archived: false } : conv
        )
      );
      
      toast({
        title: 'Success',
        description: 'Conversation restored from archive',
      });
    } catch (error) {
      console.error('Error restoring conversation:', error);
      toast({
        title: 'Error',
        description: 'Could not restore conversation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return {
    conversations,
    loading,
    error,
    activeTab,
    setActiveTab,
    restoreConversation
  };
}
