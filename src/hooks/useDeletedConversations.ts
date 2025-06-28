
import { useState, useEffect } from 'react';
import { Conversation } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { fetchDeletedUserConversations } from '@/services/conversationService';

/**
 * Hook for fetching deleted conversations
 */
export function useDeletedConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadConversations = async () => {
      setLoading(true);
      setError(null);
      try {
        const deletedConversations = await fetchDeletedUserConversations(user.id);
        setConversations(deletedConversations);
      } catch (error) {
        console.error('Error loading deleted conversations:', error);
        setError(error);
        toast({
          title: 'Error',
          description: 'Could not load your deleted conversations. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [user, toast]);

  const refreshConversations = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const deletedConversations = await fetchDeletedUserConversations(user.id);
      setConversations(deletedConversations);
    } catch (error) {
      console.error('Error refreshing deleted conversations:', error);
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  return {
    conversations,
    loading,
    error,
    refreshConversations
  };
}
