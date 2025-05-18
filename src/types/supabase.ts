
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
      job_descriptions: {
        Row: {
          id: string;
          user_id: string;
          source_type: string;
          source_url?: string;
          raw_text: string;
          parsed_fields: any;
          created_at: string;
        };
      };
      study_guides: {
        Row: {
          id: string;
          job_description_id: string;
          user_id: string;
          competencies: any;
          questions: any;
          technical_checklist: any;
          created_at: string;
        };
      };
      star_responses: {
        Row: {
          id: string;
          question_id: string;
          user_id: string;
          situation?: string;
          task?: string;
          action?: string;
          result?: string;
          ai_feedback?: any;
          submitted_at: string;
        };
      };
      code_challenges: {
        Row: {
          id: string;
          title: string;
          prompt: string;
          test_cases: any;
          topic_tags?: string[];
          difficulty: string;
          created_at: string;
        };
      };
      code_attempts: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string;
          code: string;
          language: string;
          duration?: number;
          passed_tests?: boolean;
          ai_review?: any;
          created_at: string;
        };
      };
      availability_slots: {
        Row: {
          id: string;
          user_id: string;
          weekday: number;
          time_block: string;
          is_available: boolean;
          created_at: string;
        };
      };
      mock_sessions: {
        Row: {
          id: string;
          user1_id: string;
          user2_id: string;
          role1: string;
          role2: string;
          session_time: string;
          type: string;
          status: string;
          study_guide_id?: string;
          created_at: string;
        };
      };
      peer_reviews: {
        Row: {
          id: string;
          session_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rubric_scores: any;
          notes?: string;
          created_at: string;
        };
      };
    };
  };
};
