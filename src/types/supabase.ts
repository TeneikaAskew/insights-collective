export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
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
  roles?: string[]; // Array of roles
  enrolledCourses?: string[]; // From enrollments
  user_metadata?: {
    avatar_url?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
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

// The `Database` generic used to live here as a hand-written 12-table subset,
// and `src/integrations/supabase/client.ts` passed *that* to createClient — so
// a 214-line hand-maintained declaration typed every `.from()` call in the app
// while the 6,000-line generated file sat beside it, imported by two services.
//
// Two competing declarations of one schema is a defect on its own, and it also
// put the drift gate on the wrong file: `npm run audit:types` validated the
// generated types against the database while the compiler applied these.
//
// The client now imports Database from `@/integrations/supabase/types`, which
// is generated from the live schema and is what the gate checks. This file
// keeps only the domain interfaces above, which are hand-written on purpose and
// used by nine modules. (Caught in review on PR #30.)
