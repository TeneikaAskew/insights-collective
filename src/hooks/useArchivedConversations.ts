
import { useState } from 'react';
import { Conversation } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
import { enrichProfileWithRoles } from '@/utils/profileUtils';

export function useArchivedConversations() {
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
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
        setArchivedConversations([]);
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
            id,
            user_id, 
            conversation_id,
            added_at,
            profile:profiles(
              id,
              first_name,
              last_name,
              avatar_url,
              role
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
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      // Transform and type the conversations data properly
      const typedConversations = conversationsData.map((conv: any) => ({
        ...conv,
        participants: conv.participants.map((p: any) => ({
          ...p,
          profile: p.profile ? enrichProfileWithRoles(p.profile) : undefined
        })),
        last_message: conv.last_message[0] || null
      })) as Conversation[];

      setArchivedConversations(typedConversations);
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

      setArchivedConversations(prev => prev.filter(c => c.id !== conversationId));

      return true;
    } catch (error) {
      console.error('Error restoring conversation:', error);
      throw error;
    }
  };

  return {
    archivedConversations,
    loading,
    error,
    fetchArchivedConversations,
    restoreConversation
  };
}
