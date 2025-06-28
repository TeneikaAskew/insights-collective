
export interface Forum {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  allow_create_threads: boolean;
  allow_email_subscription: boolean;
  created_at: string;
  updated_at: string;
}

export interface Thread {
  id: string;
  forum_id: string;
  user_id: string;
  title: string;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
  post_count?: number;
  last_post?: Post;
  is_read?: boolean;
}

export interface Post {
  id: string;
  thread_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
  replies?: Post[];
}

export interface ThreadSubscription {
  id: string;
  thread_id: string | null;
  forum_id: string | null;
  user_id: string;
  created_at: string;
}

export interface ThreadReadStatus {
  id: string;
  thread_id: string;
  user_id: string;
  last_read_at: string;
}

export type ForumViewType = 'list' | 'tree';
