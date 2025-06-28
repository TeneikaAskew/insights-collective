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
  archived?: boolean;
  deleted_at?: string | null;
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
    first_name?: string;
    last_name?: string;
    role?: string;
    roles?: string[];
  };
}

// Add portfolio pages interfaces
export interface PortfolioPage {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  theme: string;
  is_public: boolean;
  custom_url: string | null;
  created_at: string;
  updated_at: string;
  projects?: PortfolioPageProject[];
}

export interface PortfolioPageProject {
  id: string;
  portfolio_page_id: string;
  project_id: string;
  display_order: number;
  custom_description: string | null;
  project?: PortfolioProject;
}

export interface PortfolioProject {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  required_skills: string[] | null;
  effort_level: string | null;
  impact: string | null;
  roadmap: any | null;
  created_at: string;
  updated_at: string;
  status: string | null;
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
          uploaded_at: string;
          updated_at: string;
          text: string | null;
        };
      };
      portfolio_projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description?: string;
          required_skills?: string[];
          effort_level?: string;
          impact?: string;
          roadmap?: any;
          created_at?: string;
          updated_at?: string;
          status?: string;
        };
      };
      portfolio_pages: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          theme: string;
          is_public: boolean;
          custom_url: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      portfolio_page_projects: {
        Row: {
          id: string;
          portfolio_page_id: string;
          project_id: string;
          display_order: number;
          custom_description: string | null;
        };
      };
      page_visibility: {
        Row: {
          id: string;
          page_path: string;
          page_name: string;
          visible_to_users: boolean;
          visible_to_instructors: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
