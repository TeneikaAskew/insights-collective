
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useForums');

export const useForums = (courseId: string) => {
  const { data: forums, isLoading: isLoadingForums } = useQuery({
    queryKey: ['forums', courseId],
    queryFn: async () => {
      if (!courseId) return [];

      const { data, error } = await supabase
        .from('forums')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error("Error fetching forums:", error);
        throw error;
      }

      return data ?? [];
    },
    enabled: !!courseId
  });
  
  return {
    forums,
    isLoadingForums
  };
};

// Add missing exports that are used in the components

export const useForumThreads = (forumId: string) => {
  const { data: threads, isLoading: isLoadingThreads } = useQuery({
    queryKey: ['threads', forumId],
    queryFn: async () => {
      if (!forumId) return [];

      const { data, error } = await supabase
        .from('threads')
        .select(`
          *,
          author:user_id(
            first_name,
            last_name,
            avatar_url
          ),
          post_count:posts(count)
        `)
        .eq('forum_id', forumId)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error("Error fetching threads:", error);
        throw error;
      }

      return data ?? [];
    },
    enabled: !!forumId
  });

  return {
    threads,
    isLoadingThreads
  };
};

export const useThreadPosts = (threadId: string) => {
  const { data: posts, isLoading: isLoadingPosts } = useQuery({
    queryKey: ['posts', threadId],
    queryFn: async () => {
      if (!threadId) return [];

      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:user_id(
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error("Error fetching posts:", error);
        throw error;
      }

      return data ?? [];
    },
    enabled: !!threadId
  });

  return {
    posts,
    isLoadingPosts
  };
};

export const useCreatePost = (threadId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, userId, parentId }: { content: string; userId: string; parentId: string | null }) => {
      if (!threadId || !content || !userId) {
        throw new Error("Missing required parameters");
      }

      const { data, error } = await supabase
        .from('posts')
        .insert([
          {
            thread_id: threadId,
            user_id: userId,
            content,
            parent_id: parentId
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Also update the thread's updated_at timestamp. The post already
      // exists at this point, so surface a partial-failure error naming the
      // thread-timestamp update instead of silently swallowing it.
      const { error: threadUpdateError } = await supabase
        .from('threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);

      if (threadUpdateError) {
        throw new Error(
          `Reply was posted, but updating the thread timestamp failed: ${threadUpdateError.message}`
        );
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', threadId] });
      toast.success('Reply posted successfully');
    },
    onError: (error) => {
      logger.error('Error posting reply:', error);
      toast.error('Failed to post reply. Please try again.');
    }
  });
};

export const useCreateThread = (forumId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, content, userId }: { title: string; content: string; userId: string }) => {
      if (!forumId || !title || !content || !userId) {
        throw new Error("Missing required parameters");
      }

      // First create the thread
      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .insert([
          {
            forum_id: forumId,
            user_id: userId,
            title
          }
        ])
        .select()
        .single();

      if (threadError) throw threadError;

      // Then create the initial post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert([
          {
            thread_id: thread.id,
            user_id: userId,
            content
          }
        ])
        .select();

      if (postError) throw postError;

      return { thread, post };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads', forumId] });
      toast.success('Thread created successfully');
    },
    onError: (error) => {
      logger.error('Error creating thread:', error);
      toast.error('Failed to create thread. Please try again.');
    }
  });
};

export const useThreadSubscription = (threadId: string | null, forumId: string | null, userId: string | null) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const queryClient = useQueryClient();

  const { data: subscription } = useQuery({
    queryKey: ['subscription', threadId, forumId, userId],
    queryFn: async () => {
      if (!userId) return null;

      const query = supabase
        .from('thread_subscriptions')
        .select('*');

      if (threadId) {
        query.eq('thread_id', threadId);
      } else if (forumId) {
        query.eq('forum_id', forumId);
      } else {
        return null;
      }

      query.eq('user_id', userId);

      const { data, error } = await query;

      if (error) {
        logger.error("Error fetching subscription:", error);
        throw error;
      }

      setIsSubscribed(!!(data && data.length > 0));
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!(userId && (threadId || forumId))
  });

  const subscribe = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('thread_subscriptions')
        .insert([
          {
            user_id: userId,
            thread_id: threadId,
            forum_id: forumId
          }
        ])
        .select();
        
      if (error) throw error;
      
      setIsSubscribed(true);
      queryClient.invalidateQueries({ queryKey: ['subscription', threadId, forumId, userId] });
      toast.success('Subscribed successfully');
      
      return data;
    } catch (err) {
      logger.error("Error subscribing:", err);
      toast.error('Failed to subscribe. Please try again.');
    }
  };

  const unsubscribe = async () => {
    if (!userId || !subscription) return;
    
    try {
      const query = supabase
        .from('thread_subscriptions')
        .delete();

      if (threadId) {
        query.eq('thread_id', threadId);
      } else if (forumId) {
        query.eq('forum_id', forumId);
      }
      
      query.eq('user_id', userId);
      
      const { error } = await query;
        
      if (error) throw error;
      
      setIsSubscribed(false);
      queryClient.invalidateQueries({ queryKey: ['subscription', threadId, forumId, userId] });
      toast.success('Unsubscribed successfully');
    } catch (err) {
      logger.error("Error unsubscribing:", err);
      toast.error('Failed to unsubscribe. Please try again.');
    }
  };

  return { subscription, isSubscribed, subscribe, unsubscribe };
};

export const useMarkThreadAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, userId }: { threadId: string; userId: string }) => {
      if (!threadId || !userId) {
        throw new Error("Missing required parameters");
      }

      // Check if there's already a read status entry. maybeSingle keeps
      // "no row" clean (null data, null error); a real probe error must throw
      // instead of being treated as "no entry" and triggering an insert.
      const { data: existingStatus, error: statusError } = await supabase
        .from('thread_read_status')
        .select('*')
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .maybeSingle();

      if (statusError) throw statusError;

      if (existingStatus) {
        // Update existing entry
        const { data, error } = await supabase
          .from('thread_read_status')
          .update({ last_read_at: new Date().toISOString() })
          .eq('id', existingStatus.id)
          .select();

        if (error) throw error;
        return data;
      } else {
        // Create new entry
        const { data, error } = await supabase
          .from('thread_read_status')
          .insert([
            {
              thread_id: threadId,
              user_id: userId,
              last_read_at: new Date().toISOString()
            }
          ])
          .select();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      // No toast needed since this is a background operation
    },
    onError: (error) => {
      logger.error('Error marking thread as read:', error);
      // No toast needed for this operation
    }
  });
};
