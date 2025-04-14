
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
    if (!user) return;

    const loadConversations = async () => {
      setLoading(true);
      setError(null);
      try {
        const conversationsData = await fetchUserConversations(user.id);
        setConversations(conversationsData as Conversation[]);
      } catch (error) {
        console.error('Error loading conversations:', error);
        setError(error);
        toast({
          title: 'Error',
          description: 'Could not load your conversations. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadConversations();
    
    // Set up real-time listener for various conversation-related changes
    const channel = supabase
      .channel('conversation-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'conversations',
          filter: `created_by=eq.${user.id}`
        }, 
        (payload) => {
          console.log('Conversation change detected:', payload);
          loadConversations();
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`
        }, 
        (payload) => {
          console.log('Participant change detected:', payload);
          loadConversations();
        }
      )
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages'
        }, 
        (payload) => {
          // We'll reload all conversations when a new message is detected
          // to ensure last_message and updated_at are refreshed
          console.log('New message detected:', payload);
          loadConversations();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);
  
  return { 
    conversations, 
    loading,
    error
  };
}
