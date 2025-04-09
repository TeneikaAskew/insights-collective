
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
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const loadConversations = async () => {
      setLoading(true);
      try {
        const conversationsData = await fetchUserConversations(user.id);
        setConversations(conversationsData);
      } catch (error) {
        console.error('Error loading conversations:', error);
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
    
    // Set up real-time listener for conversation updates
    const channel = supabase
      .channel('conversation-changes')
      .on('postgres_changes', 
        {
          event: 'INSERT', 
          schema: 'public', 
          table: 'conversations',
        }, 
        () => {
          // Refresh conversations when a new one is created
          loadConversations();
        }
      )
      .on('postgres_changes', 
        {
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
        }, 
        () => {
          // Refresh conversations when a new message is received
          loadConversations();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);
  
  return { 
    conversations, 
    loading
  };
}
