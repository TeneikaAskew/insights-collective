// ABOUTME: Shared types for the Teachable-style instructor builder.
// ABOUTME: Kept small — richer schemas live in canvas/course types.

import type { ContentItem, Module } from '@/types/canvas';

export interface CourseSettings {
  theme?: {
    accent?: string; // hex color
    preset?: string;
  };
  certificate?: {
    enabled?: boolean;
    title?: string;
    body?: string;
  };
  discussions?: {
    /** Undefined means on — a course created before this setting existed still has discussions. */
    enabled?: boolean;
  };
}

export interface BuilderCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  image_url?: string | null;
  published: boolean;
  category?: string | null;
  level?: string | null;
  tags?: string[] | null;
  duration?: number | null;
  estimated_hours?: number | null;
  difficulty_level?: string | null;
  settings?: CourseSettings | null;
}

export type BuilderView = 'setup' | 'curriculum' | 'lesson' | 'placeholder';

export interface BuilderModule extends Module {
  items: ContentItem[];
}
