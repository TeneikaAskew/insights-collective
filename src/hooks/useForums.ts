
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export const useForums = (courseId: string) => {
  const [mockForums, setMockForums] = useState([]);
  
  // Simple mock data for testing
  useEffect(() => {
    setMockForums([
      {
        id: '1',
        title: 'General Discussion',
        description: 'A place to discuss general topics related to this course.',
        course_id: courseId || '1'
      },
      {
        id: '2',
        title: 'Technical Questions',
        description: 'Ask and answer technical questions about the course content.',
        course_id: courseId || '1'
      }
    ]);
  }, [courseId]);
  
  const { data: forums, isLoading: isLoadingForums } = useQuery({
    queryKey: ['forums', courseId],
    queryFn: async () => {
      // For routes that don't have a courseId, use mock data
      if (!courseId) {
        console.log("No courseId provided, using mock forums");
        return mockForums;
      }
      
      try {
        const { data, error } = await supabase
          .from('forums')
          .select('*')
          .eq('course_id', courseId)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error("Error fetching forums:", error);
          return mockForums;
        }
        
        return data && data.length > 0 ? data : mockForums;
      } catch (err) {
        console.error("Exception while fetching forums:", err);
        return mockForums;
      }
    },
    // Always enabled to handle both course-specific and general forums
    enabled: true
  });
  
  return {
    forums,
    isLoadingForums
  };
};

// Add missing exports that are used in the components

export const useForumThreads = (forumId: string) => {
  const [mockThreads, setMockThreads] = useState([]);

  // Generate mock threads for testing
  useEffect(() => {
    if (!forumId) return;
    
    setMockThreads([
      {
        id: '1',
        title: 'Welcome to the Forum',
        user_id: '1',
        forum_id: forumId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_pinned: true,
        is_locked: false,
        is_read: false,
        post_count: 3,
        author: {
          first_name: 'John',
          last_name: 'Doe',
          avatar_url: ''
        }
      },
      {
        id: '2',
        title: 'How to ask good questions',
        user_id: '2',
        forum_id: forumId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_pinned: false,
        is_locked: false,
        is_read: true,
        post_count: 5,
        author: {
          first_name: 'Jane',
          last_name: 'Smith',
          avatar_url: ''
        }
      }
    ]);
  }, [forumId]);

  const { data: threads, isLoading: isLoadingThreads } = useQuery({
    queryKey: ['threads', forumId],
    queryFn: async () => {
      if (!forumId) return [];
      
      try {
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
          console.error("Error fetching threads:", error);
          return mockThreads;
        }
        
        return data && data.length > 0 ? data : mockThreads;
      } catch (err) {
        console.error("Exception while fetching threads:", err);
        return mockThreads;
      }
    },
    enabled: !!forumId
  });

  return {
    threads,
    isLoadingThreads
  };
};

export const useThreadPosts = (threadId: string) => {
  const [mockPosts, setMockPosts] = useState([]);

  // Generate mock posts for testing
  useEffect(() => {
    if (!threadId) return;
    
    setMockPosts([
      {
        id: '1',
        thread_id: threadId,
        user_id: '1',
        content: '<p>Welcome to the discussion! Please feel free to ask any questions.</p>',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        parent_id: null,
        author: {
          first_name: 'John',
          last_name: 'Doe',
          avatar_url: ''
        }
      },
      {
        id: '2',
        thread_id: threadId,
        user_id: '2',
        content: '<p>Thanks for starting this thread. I have a question about the course materials.</p>',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        parent_id: null,
        author: {
          first_name: 'Jane',
          last_name: 'Smith',
          avatar_url: ''
        }
      }
    ]);
  }, [threadId]);

  const { data: posts, isLoading: isLoadingPosts } = useQuery({
    queryKey: ['posts', threadId],
    queryFn: async () => {
      if (!threadId) return [];
      
      try {
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
          console.error("Error fetching posts:", error);
          return mockPosts;
        }
        
        return data && data.length > 0 ? data : mockPosts;
      } catch (err) {
        console.error("Exception while fetching posts:", err);
        return mockPosts;
      }
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
      
      // Also update the thread's updated_at timestamp
      await supabase
        .from('threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);
        
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', threadId] });
      toast.success('Reply posted successfully');
    },
    onError: (error) => {
      console.error('Error posting reply:', error);
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
      console.error('Error creating thread:', error);
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
      
      try {
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
          console.error("Error fetching subscription:", error);
          return null;
        }
        
        setIsSubscribed(data && data.length > 0);
        return data && data.length > 0 ? data[0] : null;
      } catch (err) {
        console.error("Exception while fetching subscription:", err);
        return null;
      }
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
      console.error("Error subscribing:", err);
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
      console.error("Error unsubscribing:", err);
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

      // Check if there's already a read status entry
      const { data: existingStatus } = await supabase
        .from('thread_read_status')
        .select('*')
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .maybeSingle();

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
      console.error('Error marking thread as read:', error);
      // No toast needed for this operation
    }
  });
};
