
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Conversation } from '@/types/supabase';

export function useArchivedConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchArchivedConversations = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      if (!participantData || participantData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participantData.map(p => p.conversation_id);

      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select(`
          id,
          subject,
          is_group,
          created_by,
          updated_at,
          created_at,
          archived,
          deleted_at,
          participants:conversation_participants(
            user_id,
            profile:profiles(
              first_name,
              last_name,
              avatar_url
            )
          ),
          last_message:messages(
            id,
            sender_id,
            content,
            read,
            created_at
          )
        `)
        .in('id', conversationIds)
        .eq('archived', true)
        .order('updated_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      setConversations(conversationsData as Conversation[]);
    } catch (error) {
      console.error('Error fetching archived conversations:', error);
      setError(error);
      toast({
        title: 'Error',
        description: 'Could not load archived conversations.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const restoreConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ archived: false })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.filter(c => c.id !== conversationId));

      return true;
    } catch (error) {
      console.error('Error restoring conversation:', error);
      throw error;
    }
  };

  return {
    archivedConversations: conversations,
    loading,
    error,
    fetchArchivedConversations,
    restoreConversation
  };
}
