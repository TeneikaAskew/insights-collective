
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
        setConversations(conversationsData || []);
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
    
    // Set up real-time listener for conversation updates
    const channel = supabase
      .channel('conversation-changes')
      .on('postgres_changes', 
        {
          event: 'INSERT', 
          schema: 'public', 
          table: 'conversations',
        }, 
        (payload) => {
          console.log('New conversation created:', payload);
          loadConversations();
        }
      )
      .on('postgres_changes', 
        {
          event: 'UPDATE', 
          schema: 'public', 
          table: 'conversations',
        }, 
        (payload) => {
          console.log('Conversation updated:', payload);
          loadConversations();
        }
      )
      .on('postgres_changes', 
        {
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
        }, 
        (payload) => {
          console.log('New message received:', payload);
          loadConversations();
        }
      )
      .on('postgres_changes', 
        {
          event: 'INSERT', 
          schema: 'public', 
          table: 'conversation_participants',
        }, 
        (payload) => {
          console.log('New participant added:', payload);
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
    conversations: conversations || [], 
    loading,
    error
  };
}
