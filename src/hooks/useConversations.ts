
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation, Message, Profile } from '@/types/supabase';
import { useToast } from './use-toast';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      setLoading(true);
      
      try {
        // Get all conversations where the user is a participant
        const { data: participantData, error: participantError } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', user.id);
        
        if (participantError) throw participantError;
        
        if (participantData.length === 0) {
          setConversations([]);
          setLoading(false);
          return;
        }
        
        const conversationIds = participantData.map(p => p.conversation_id);
        
        // Get conversation details
        const { data, error } = await supabase
          .from('conversations')
          .select(`
            id, 
            subject, 
            is_group, 
            created_by,
            created_at,
            updated_at
          `)
          .in('id', conversationIds)
          .order('updated_at', { ascending: false });
          
        if (error) throw error;
        
        // Get all participants for these conversations
        const { data: allParticipants, error: participantsError } = await supabase
          .from('conversation_participants')
          .select(`
            id,
            conversation_id,
            user_id,
            added_at,
            profile:profiles!user_id(
              id,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .in('conversation_id', conversationIds);
          
        if (participantsError) throw participantsError;
        
        // Get latest message for each conversation
        const { data: latestMessages, error: messagesError } = await supabase
          .from('messages')
          .select(`
            id,
            sender_id,
            conversation_id,
            content,
            read,
            created_at
          `)
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false });
          
        if (messagesError) throw messagesError;
        
        // Enrich conversations with participants and last message
        const enrichedConversations = data.map(conversation => {
          const participants = allParticipants
            .filter(p => p.conversation_id === conversation.id)
            .map(p => ({
              ...p,
              profile: p.profile
            }));
            
          const lastMessage = latestMessages.find(m => m.conversation_id === conversation.id);
          
          return {
            ...conversation,
            participants,
            last_message: lastMessage
          };
        });
        
        setConversations(enrichedConversations);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        toast({
          title: 'Error',
          description: 'Could not load your conversations. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchConversations();
    
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
          fetchConversations();
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
          fetchConversations();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);
  
  const createConversation = async (subject: string, recipientIds: string[]) => {
    if (!user) return null;
    
    try {
      // Create conversation
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .insert({
          subject,
          is_group: recipientIds.length > 1,
          created_by: user.id
        })
        .select('id')
        .single();
      
      if (conversationError) throw conversationError;
      
      if (!conversationData) {
        throw new Error('Failed to create conversation');
      }
      
      // Add current user as participant
      await supabase
        .from('conversation_participants')
        .insert({
          conversation_id: conversationData.id,
          user_id: user.id
        });
      
      // Add all recipients as participants
      const participantInserts = recipientIds.map(recipientId => ({
        conversation_id: conversationData.id,
        user_id: recipientId
      }));
      
      await supabase
        .from('conversation_participants')
        .insert(participantInserts);
      
      return conversationData.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create conversation. Please try again.',
        variant: 'destructive',
      });
      return null;
    }
  };
  
  const sendMessage = async (conversationId: string, content: string, attachmentUrl?: string) => {
    if (!user) return false;
    
    try {
      // Send message
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          attachment_url: attachmentUrl || null
        });
      
      if (error) throw error;
      
      // Update conversation updated_at timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };
  
  return { 
    conversations, 
    loading, 
    createConversation,
    sendMessage
  };
}
