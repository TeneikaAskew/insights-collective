// ABOUTME: Type definitions for lessons in the learning management system
// ABOUTME: Includes interfaces for lesson data, progress tracking, and content management

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string;
  content: string;
  order_num: number;
  duration?: string;
  estimated_duration?: number;
  completion_required: boolean;
  completion_criteria: Record<string, any>;
  content_blocks_count: number;
  created_at: string;
  updated_at: string;
}

export interface LessonInput {
  module_id: string;
  title: string;
  description: string;
  content: string;
  order_num: number;
  duration?: string;
  estimated_duration?: number;
  completion_required?: boolean;
  completion_criteria?: Record<string, any>;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  completion_percentage: number;
  time_spent: number;
  started_at: string;
  completed_at?: string;
  last_accessed_at: string;
}