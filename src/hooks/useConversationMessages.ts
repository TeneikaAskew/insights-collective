
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

        // For each message, fetch the sender profile separately with error handling
        const messagesWithSenders: Message[] = [];

        for (const message of messagesData || []) {
          try {
            // Fetch sender profile
            const { data: senderData, error: senderError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', message.sender_id)
              .maybeSingle();

            if (!senderError && senderData) {
              // Add message with sender profile, ensuring roles is set
              const profileWithRoles: Profile = {
                ...(senderData as any),
                roles: senderData?.roles || senderData?.role ? 
                  (Array.isArray(senderData.roles) ? senderData.roles : [senderData.role || 'student', 'student']) : 
                  ['student']
              };

              messagesWithSenders.push({
                ...message,
                sender: profileWithRoles
              });
            } else {
              // Still add the message even if sender profile couldn't be fetched
              console.warn('Could not fetch sender profile:', senderError);
              messagesWithSenders.push({
                ...message,
                sender: {
                  id: message.sender_id || '',
                  first_name: 'Unknown',
                  last_name: 'User',
                  roles: ['student'],
                } as Profile
              });
            }
          } catch (profileError) {
            console.error('Error processing profile for message:', profileError);
            // Add message with fallback profile
            messagesWithSenders.push({
              ...message,
              sender: {
                id: message.sender_id || '',
                first_name: 'Unknown',
                last_name: 'User',
                roles: ['student'],
              } as Profile
            });
          }
        }

        setMessages(messagesWithSenders);

        // Mark messages as read
        try {
          await supabase
            .from('messages')
            .update({ read: true })
            .eq('conversation_id', conversationId)
            .neq('sender_id', user.id)
            .eq('read', false);
        } catch (markReadError) {
          console.error('Error marking messages as read:', markReadError);
          // Don't throw here, we still want to show messages
        }

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
          console.log('Received new message:', payload);
          try {
            // Fetch the sender profile for the new message
            const { data: senderData, error: senderError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', payload.new.sender_id)
              .maybeSingle();
            
            if (!senderError && senderData) {
              // Create new message with sender profile, ensuring roles is set
              const profileWithRoles: Profile = {
                ...(senderData as any),
                roles: senderData?.roles || senderData?.role ? 
                  (Array.isArray(senderData.roles) ? senderData.roles : [senderData.role || 'student', 'student']) : 
                  ['student']
              };
              
              // Update messages state
              const newMessage: Message = {
                ...payload.new as any,
                sender: profileWithRoles
              };
              
              // Update messages state
              setMessages(prevMessages => [...(prevMessages || []), newMessage]);
            } else {
              // Still add the message even if sender profile couldn't be fetched
              console.warn('Could not fetch sender profile for real-time message:', senderError);
              const newMessage: Message = {
                ...payload.new as any,
                sender: {
                  id: payload.new.sender_id || '',
                  first_name: 'Unknown',
                  last_name: 'User',
                  roles: ['student'],
                } as Profile
              };
              setMessages(prevMessages => [...(prevMessages || []), newMessage]);
            }
            
            // Mark message as read if it's not from the current user
            if (payload.new.sender_id !== user.id) {
              try {
                await supabase
                  .from('messages')
                  .update({ read: true })
                  .eq('id', payload.new.id);
              } catch (markReadError) {
                console.error('Error marking real-time message as read:', markReadError);
              }
            }
          } catch (error) {
            console.error('Error processing real-time message:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('Message real-time subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, toast]);

  return { messages: messages || [], loading };
}
