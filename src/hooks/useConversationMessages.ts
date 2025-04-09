
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';

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
        const { data, error } = await supabase
          .from('messages')
          .select(`
            id,
            sender_id,
            conversation_id,
            content,
            attachment_url,
            read,
            created_at,
            profiles:sender_id(
              id,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const messagesWithSender = data.map(message => ({
          ...message,
          sender: message.profiles
        }));

        setMessages(messagesWithSender);

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
          // Fetch the complete message with sender info
          const { data, error } = await supabase
            .from('messages')
            .select(`
              id,
              sender_id,
              conversation_id,
              content,
              attachment_url,
              read,
              created_at,
              profiles:sender_id(
                id,
                first_name,
                last_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();
            
          if (!error && data) {
            const newMessage = {
              ...data,
              sender: data.profiles
            };
            
            setMessages(prevMessages => [...prevMessages, newMessage]);
            
            // Mark message as read if it's not from the current user
            if (data.sender_id !== user.id) {
              await supabase
                .from('messages')
                .update({ read: true })
                .eq('id', data.id);
            }
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
