
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, Profile } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { enrichProfileWithRoles } from '@/utils/profileUtils';

/**
 * Fetches messages for a specific conversation and sets up real-time updates
 */
export function useConversationMessages(conversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const channelRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    
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
              avatar_url,
              role
            )
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Ensure component is still mounted before updating state
        if (!isMountedRef.current) return;

        // Process messages to ensure proper typing and enrich profiles
        const messagesWithProfiles = (data || []).map(message => ({
          ...message,
          sender: message.sender ? enrichProfileWithRoles(message.sender) : null
        })) as Message[];

        setMessages(messagesWithProfiles);

        // Mark messages as read
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', user.id)
          .eq('read', false);

      } catch (error) {
        console.error('Error fetching messages:', error);
        if (isMountedRef.current) {
          toast({
            title: 'Error',
            description: 'Could not load messages. Please try again later.',
            variant: 'destructive',
          });
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchMessages();

    // Cleanup old subscription if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Set up real-time listener for new messages
    channelRef.current = supabase
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
          
          if (!isMountedRef.current) return;
          
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
              if (isMountedRef.current) {
                setMessages(prevMessages => [...prevMessages, newMessage]);
              }
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
              
              if (isMountedRef.current) {
                setMessages(prevMessages => [...prevMessages, newMessage]);
              }
            }
            
            // Mark message as read if it's not from the current user
            if (payload.new.sender_id !== user.id) {
              await supabase
                .from('messages')
                .update({ read: true })
                .eq('id', payload.new.id);
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
      isMountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, user, toast]);

  return { messages, loading };
}
