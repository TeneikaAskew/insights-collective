// ABOUTME: Content block type definitions for the Supabase content_blocks table
// ABOUTME: Provides TypeScript interfaces for content blocks that can belong to modules or lessons

export interface ContentBlock {
  id: string;
  module_id: string;
  lesson_id: string | null;
  block_type: 'text' | 'video' | 'image' | 'quiz' | 'assignment' | 'file' | 'quote' | 'code' | 'embed';
  title: string | null;
  content: string | null;
  file_url: string | null;
  file_path: string | null;
  file_type: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
  position: number;
  duration: number | null;
  is_interactive: boolean;
  completion_required: boolean;
  metadata: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContentBlockInput {
  module_id: string;
  lesson_id?: string | null;
  block_type: 'text' | 'video' | 'image' | 'quiz' | 'assignment' | 'file' | 'quote' | 'code' | 'embed';
  title?: string;
  content?: string;
  file_url?: string;
  file_path?: string;
  file_type?: string;
  file_size?: number;
  thumbnail_url?: string;
  position?: number;
  duration?: number;
  is_interactive?: boolean;
  completion_required?: boolean;
  metadata?: Record<string, any>;
}

// Legacy module content interface for backward compatibility
export interface ModuleContent {
  id: string;
  module_id: string;
  content: string;
  type: 'text' | 'video' | 'image';
  position: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface ModuleContentInput {
  module_id: string;
  content: string;
  type: 'text' | 'video' | 'image';
  position?: number;
  uploaded_by: string;
}