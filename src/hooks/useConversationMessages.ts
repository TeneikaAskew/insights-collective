
// Just fixing the specific typing issue in useConversationMessages.ts
// Find the problematic function where Profile type conversion happens and update it
// This is just a partial update focusing on the typing error

import { Profile } from '@/types/supabase';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Function to convert user data to Profile type
export const convertToProfile = (userData: any): Profile => {
  // Ensure type safety by explicitly constructing a Profile object
  return {
    id: userData.id,
    first_name: userData.first_name || null,
    last_name: userData.last_name || null,
    avatar_url: userData.avatar_url || null,
    bio: userData.bio || null,
    role: userData.role || null,
    roles: userData.roles || []
  };
};

// Export the hook that was missing
export const useConversationMessages = (conversationId?: string) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const fetchMessages = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            sender_id,
            read,
            attachment_url,
            sender:sender_id (
              id,
              first_name,
              last_name,
              avatar_url
            )
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Process messages if needed
        setMessages(data || []);
      } catch (err) {
        console.error('Error fetching messages:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Set up realtime subscription for new messages
    const subscription = supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        // Add new message to the state
        setMessages(current => [...current, payload.new]);
      })
      .subscribe();

    // Clean up subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId]);

  return { messages, loading, error };
};
