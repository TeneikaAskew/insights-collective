
import { useState, useEffect } from 'react';
import { Conversation } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { fetchArchivedUserConversations } from '@/services/conversationService';

/**
 * Hook for fetching archived conversations
 */
export function useArchivedConversations() {
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
        const archivedConversations = await fetchArchivedUserConversations(user.id);
        setConversations(archivedConversations);
      } catch (error) {
        console.error('Error loading archived conversations:', error);
        setError(error);
        toast({
          title: 'Error',
          description: 'Could not load your archived conversations. Please try again later.',
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
      const archivedConversations = await fetchArchivedUserConversations(user.id);
      setConversations(archivedConversations);
    } catch (error) {
      console.error('Error refreshing archived conversations:', error);
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
