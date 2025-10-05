// ABOUTME: Legacy module content types - DEPRECATED
// ABOUTME: This file is kept for backward compatibility only. Use Canvas types from @/types/canvas instead.

// All content blocks are now managed through the content_items table
// See src/types/canvas.ts for the current type definitions
// Legacy code should be migrated to use ContentItem type from canvas.ts

/**
 * @deprecated Use ContentItem from @/types/canvas instead
 */
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

/**
 * @deprecated Use CreateContentItemInput from @/types/canvas instead
 */
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

/**
 * @deprecated Legacy interface - no longer used
 */
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

/**
 * @deprecated Legacy interface - no longer used
 */
export interface ModuleContentInput {
  module_id: string;
  content: string;
  type: 'text' | 'video' | 'image';
  position?: number;
  uploaded_by: string;
}
