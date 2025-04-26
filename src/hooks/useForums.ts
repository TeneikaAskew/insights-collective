
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Forum, Thread, Post } from '@/types/forum';
import { useToast } from '@/hooks/use-toast';

export const useForums = (courseId: string | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Always create the query, but only enable it when courseId exists
  const { data: forums, isLoading: isLoadingForums } = useQuery({
    queryKey: ['forums', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      
      const { data, error } = await supabase
        .from('forums')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      return data as Forum[];
    },
    // Use enabled option to control when the query runs
    enabled: Boolean(courseId)
  });
  
  return {
    forums: forums || [],
    isLoadingForums,
  };
};

export const useForumThreads = (forumId: string) => {
  const { data: threads, isLoading: isLoadingThreads } = useQuery({
    queryKey: ['threads', forumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select(`
          *,
          author:user_id(
            first_name, 
            last_name,
            avatar_url
          ),
          post_count:posts(count),
          last_post:posts(
            id,
            created_at,
            author:user_id(
              first_name,
              last_name
            )
          )
        `)
        .eq('forum_id', forumId)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
        
      if (error) throw error;
      
      // Process the threads to extract post count and last post
      return data.map(thread => ({
        ...thread,
        post_count: thread.post_count?.[0]?.count || 0,
        last_post: thread.last_post?.[0] || null,
        is_read: true, // We'll update this with read status later
      })) as Thread[];
    }
  });
  
  return {
    threads,
    isLoadingThreads,
  };
};

export const useThreadPosts = (threadId: string) => {
  const { data: posts, isLoading: isLoadingPosts } = useQuery({
    queryKey: ['posts', threadId],
    queryFn: async () => {
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
        
      if (error) throw error;
      return data as Post[];
    }
  });
  
  return {
    posts,
    isLoadingPosts,
  };
};

export const useThreadSubscription = (threadId: string | null, forumId: string | null, userId: string | null) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Query to check if user is subscribed
  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription', threadId, forumId, userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const query = supabase.from('thread_subscriptions').select('*');
      
      if (threadId) {
        query.eq('thread_id', threadId);
      } else if (forumId) {
        query.eq('forum_id', forumId);
      } else {
        return null;
      }
      
      query.eq('user_id', userId);
      
      const { data, error } = await query;
      if (error) throw error;
      return data.length > 0 ? data[0] : null;
    },
    enabled: !!userId && (!!threadId || !!forumId),
  });
  
  // Mutation to subscribe
  const { mutate: subscribe } = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated");
      
      const { data, error } = await supabase
        .from('thread_subscriptions')
        .insert({
          thread_id: threadId,
          forum_id: forumId,
          user_id: userId
        });
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Subscribed successfully",
        description: threadId ? "You'll receive email notifications for new posts in this thread" : "You'll receive email notifications for new threads in this forum",
      });
      queryClient.invalidateQueries({ queryKey: ['subscription', threadId, forumId, userId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to subscribe",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Mutation to unsubscribe
  const { mutate: unsubscribe } = useMutation({
    mutationFn: async () => {
      if (!userId || !subscription) throw new Error("User not authenticated or not subscribed");
      
      const { error } = await supabase
        .from('thread_subscriptions')
        .delete()
        .eq('id', subscription.id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Unsubscribed successfully",
        description: threadId ? "You'll no longer receive notifications for this thread" : "You'll no longer receive notifications for this forum",
      });
      queryClient.invalidateQueries({ queryKey: ['subscription', threadId, forumId, userId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to unsubscribe",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  return {
    subscription,
    isLoadingSubscription,
    isSubscribed: !!subscription,
    subscribe,
    unsubscribe,
  };
};

export const useCreateThread = (forumId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ title, content, userId }: { title: string; content: string; userId: string }) => {
      // First create the thread
      const { data: threadData, error: threadError } = await supabase
        .from('threads')
        .insert({
          forum_id: forumId,
          user_id: userId,
          title
        })
        .select()
        .single();
        
      if (threadError) throw threadError;
      
      // Then create the initial post in the thread
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          thread_id: threadData.id,
          user_id: userId,
          content
        });
        
      if (postError) throw postError;
      
      return threadData;
    },
    onSuccess: () => {
      toast({
        title: "Thread created successfully",
        description: "Your thread has been posted to the forum",
      });
      queryClient.invalidateQueries({ queryKey: ['threads', forumId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to create thread",
        description: error.message,
        variant: "destructive"
      });
    }
  });
};

export const useCreatePost = (threadId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ content, userId, parentId = null }: { content: string; userId: string; parentId?: string | null }) => {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          thread_id: threadId,
          user_id: userId,
          content,
          parent_id: parentId
        });
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Reply posted successfully",
        description: "Your reply has been added to the thread",
      });
      queryClient.invalidateQueries({ queryKey: ['posts', threadId] });
      
      // Also update the thread list as the last post has changed
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to post reply",
        description: error.message,
        variant: "destructive"
      });
    }
  });
};

export const useMarkThreadAsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ threadId, userId }: { threadId: string, userId: string }) => {
      // First check if a read status exists
      const { data: existingStatus, error: checkError } = await supabase
        .from('thread_read_status')
        .select('*')
        .eq('thread_id', threadId)
        .eq('user_id', userId);
        
      if (checkError) throw checkError;
      
      if (existingStatus && existingStatus.length > 0) {
        // Update existing status
        const { error } = await supabase
          .from('thread_read_status')
          .update({ last_read_at: new Date().toISOString() })
          .eq('id', existingStatus[0].id);
          
        if (error) throw error;
      } else {
        // Create new status
        const { error } = await supabase
          .from('thread_read_status')
          .insert({
            thread_id: threadId,
            user_id: userId,
            last_read_at: new Date().toISOString()
          });
          
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    }
  });
};
