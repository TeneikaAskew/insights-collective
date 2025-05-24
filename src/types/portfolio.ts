export interface PortfolioProject {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  required_skills?: string[];
  effort_level?: string;
  impact?: string;
  roadmap?: {
    milestones: string[];
  };
  created_at?: string;
  updated_at?: string;
  status?: ProjectStatus;
  github_url?: string;
  live_url?: string;
  project_images?: string[];
}

export type ProjectStatus = 'Idea' | 'Planned' | 'In Progress' | 'Completed';

export interface ProjectStatusRecord {
  project_id: string;
  status: ProjectStatus;
  updated_at?: string;
}

export interface QuestionnaireAnswers {
  interests: string;
  currentRole: string;
  hobbies: string;
}

export interface SkillGap {
  skill: string;
  resources: string[];
}

export interface PortfolioInsightData {
  strengths: string[];
  skills: string[];
  targetRoles: TargetRole[];
  skillGaps: {
    missingSkills: string[];
    learningResources: SkillGap[];
  };
}

export interface TargetRole {
  title: string;
  coreSkills: string[];
  commonDeliverables: string[];
  projectIdeas: ProjectIdea[];
}

export interface ProjectIdea {
  title: string;
  description: string;
  requiredSkills: string[];
  effortLevel: string;
  impact: string;
  roadmap: string[];
}

// Profile data interface
export interface ProfileData {
  avatar_url?: string;
  professional_summary?: string;
  skills?: string[];
  location?: string; // Keep for backward compatibility
  location_details?: {
    city?: string;
    state?: string;
    country?: string;
  };
  email?: string;
  github_url?: string;
  linkedin_url?: string;
  experience?: Array<{
    id: string;
    role: string;
    company: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  education?: Array<{
    id: string;
    institution: string;
    degree: string;
    graduationYear: string;
  }>;
}

// New types for Portfolio Pages feature
export interface PortfolioPage {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  theme: string;
  layout?: string;
  is_public: boolean;
  custom_url?: string;
  created_at?: string;
  updated_at?: string;
  projects?: PortfolioPageProject[];
  profile_data?: ProfileData;
}

export interface PortfolioPageProject {
  id: string;
  portfolio_page_id: string;
  project_id: string;
  display_order: number;
  custom_description?: string;
  project?: PortfolioProject;
}

export type PortfolioTheme = 'default' | 'minimal' | 'professional' | 'creative' | 'modern' | 'elegant';

// Add missing layout type
export type PortfolioLayout = 'classic' | 'sidebar' | 'hero-timeline' | 'grid' | 'split' | 'hero-focus';
