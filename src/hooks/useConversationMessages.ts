
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, Profile } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';

/**
 * Fetches messages for a specific conversation and sets up real-time updates
 */
export function useConversationMessages(conversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!conversationId || !user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      try {
        // First fetch messages
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select(`
            id,
            sender_id,
            conversation_id,
            content,
            attachment_url,
            read,
            created_at
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        // For each message, fetch the sender profile separately
        const messagesWithSenders: Message[] = [];

        for (const message of messagesData) {
          // Fetch sender profile
          const { data: senderData, error: senderError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', message.sender_id)
            .single();

          // Add message with sender profile
          messagesWithSenders.push({
            ...message,
            sender: senderError ? null : (senderData as Profile)
          });
        }

        setMessages(messagesWithSenders);

        // Mark messages as read
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', user.id)
          .eq('read', false);

      } catch (error) {
        console.error('Error fetching messages:', error);
        toast({
          title: 'Error',
          description: 'Could not load messages. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Set up real-time listener for new messages
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', 
        {
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        }, 
        async (payload) => {
          try {
            // Fetch the sender profile for the new message
            const { data: senderData, error: senderError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', payload.new.sender_id)
              .single();
            
            // Create new message with sender profile  
            const newMessage: Message = {
              ...payload.new as any,
              sender: senderError ? null : (senderData as Profile)
            };
            
            // Update messages state
            setMessages(prevMessages => [...prevMessages, newMessage]);
            
            // Mark message as read if it's not from the current user
            if (newMessage.sender_id !== user.id) {
              await supabase
                .from('messages')
                .update({ read: true })
                .eq('id', newMessage.id);
            }
          } catch (error) {
            console.error('Error processing real-time message:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, toast]);

  return { messages, loading };
}
