
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, Profile } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { enrichProfileWithRoles } from '@/utils/profileUtils';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useConversationMessages');

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
        // Fetch messages with sender profiles in a single query
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
            sender:profiles!sender_id(
              id,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Process messages to ensure proper typing and enrich profiles
        const messagesWithProfiles = (data || []).map(message => ({
          ...message,
          sender: message.sender ? enrichProfileWithRoles(message.sender) : null
        })) as Message[];

        setMessages(messagesWithProfiles);

        // Mark messages as read (read receipts are non-critical: warn on
        // failure but don't block the loaded messages).
        //
        // Only when there is something to mark. The thread was just fetched,
        // so the answer is already in hand and costs no round trip. Firing the
        // PATCH unconditionally sent a write on every visit to an already-read
        // thread, and PostgREST answered 204 with zero rows — which the
        // Supabase instrumentation reports as an empty write, correctly: from
        // the request alone, "nothing left to mark" and "RLS filtered every
        // row" are the same answer. /messages/:id showed "1 failed query" on a
        // healthy page because of this. Same shape as
        // NotificationsDropdown.handleMarkAllAsRead, which already checks first.
        const hasUnread = messagesWithProfiles.some(
          message => !message.read && message.sender_id !== user.id
        );

        if (hasUnread) {
          const { error: markReadError } = await supabase
            .from('messages')
            .update({ read: true })
            .eq('conversation_id', conversationId)
            .neq('sender_id', user.id)
            .eq('read', false);

          if (markReadError) {
            logger.warn('Failed to mark messages as read (non-critical):', markReadError);
          }
        }

      } catch (error) {
        logger.error('Error fetching messages:', error);
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
          logger.log('Received new message:', payload);
          
          try {
            // Fetch the sender profile for the new message
            const { data: senderData, error: senderError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', payload.new.sender_id)
              .maybeSingle();
            
            if (!senderError && senderData) {
              // Create new message with sender profile
              const newMessage: Message = {
                ...payload.new as any,
                sender: enrichProfileWithRoles(senderData)
              };
              
              // Update messages state
              setMessages(prevMessages => [...prevMessages, newMessage]);
            } else {
              // Fall back to adding the message without sender data
              const newMessage: Message = {
                ...payload.new as any,
                sender: {
                  id: payload.new.sender_id,
                  first_name: 'Unknown',
                  last_name: 'User',
                  roles: ['student'],
                } as Profile
              };
              setMessages(prevMessages => [...prevMessages, newMessage]);
            }
            
            // Mark message as read if it's not from the current user
            if (payload.new.sender_id !== user.id) {
              const { error: markReadError } = await supabase
                .from('messages')
                .update({ read: true })
                .eq('id', payload.new.id);

              if (markReadError) {
                logger.warn('Failed to mark incoming message as read (non-critical):', markReadError);
              }
            }
          } catch (error) {
            // Dropping the message here meant it simply never appeared in the
            // open thread — the recipient saw a conversation that looked
            // complete and current while missing a message, until something
            // else forced a reload. Re-reading the thread is the honest
            // recovery: whatever this handler failed to append is fetched with
            // everything else.
            logger.error('Error processing real-time message; refetching the thread:', error);
            void fetchMessages();
          }
        }
      )
      .subscribe((status) => {
        logger.log('Message real-time subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, toast]);

  return { messages, loading };
}
