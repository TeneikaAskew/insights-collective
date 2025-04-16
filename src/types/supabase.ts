
export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  roles: string[];
}

export interface Conversation {
  id: string;
  subject: string | null;
  is_group: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  added_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  conversation_id: string;
  content: string;
  attachment_url: string | null;
  read: boolean;
  created_at: string;
  sender?: Profile | null;
}

export interface CourseWishlist {
  id: string;
  user_id: string;
  course_id: string;
  created_at: string;
}

export interface UserWithProfile {
  id: string;
  email: string;
  name?: string; // Computed from profile first_name + last_name
  avatar?: string; // Alias for profile avatar_url
  bio?: string; // From profile
  role?: string; // From profile
  roles?: string[]; // Array of roles
  enrolledCourses?: string[]; // From enrollments
  user_metadata?: {
    avatar_url?: string;
    name?: string;
  };
}

export interface ModuleContent {
  id: string;
  module_id: string;
  type: 'text' | 'video' | 'image' | 'file';
  content: string;
  position: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
      };
      conversations: {
        Row: Omit<Conversation, 'participants' | 'last_message'>;
      };
      conversation_participants: {
        Row: Omit<ConversationParticipant, 'profile'>;
      };
      messages: {
        Row: Omit<Message, 'sender'>;
      };
      courses: {
        Row: {
          id: string;
          title: string;
          description: string;
          category: string;
          level: string;
          image_url: string | null;
          thumbnail: string | null;
          instructor_id: string | null;
          published: boolean;
          enrollment_status: string | null;
          duration: string | null;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
      };
      enrollments: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          enrolled_at: string;
          completion_status: number;
        };
      };
      course_wishlists: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          created_at: string;
        };
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          file_path: string;
          analysis: any;
          career_alignment_score: number | null;
          target_role: string | null;
          uploaded_at: string;
          updated_at: string;
        };
      };
      modules: {
        Row: {
          id: string;
          title: string;
          description: string;
          week: number;
          course_id: string;
          created_at: string;
          updated_at: string;
        };
      };
      module_content: {
        Row: {
          id: string;
          module_id: string;
          type: 'text' | 'video' | 'image' | 'file';
          content: string;
          position: number;
          uploaded_by: string;
          created_at: string;
          updated_at: string;
        };
      };
      course_assignments: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          role: string;
          created_at: string;
        };
      };
    };
  };
};
