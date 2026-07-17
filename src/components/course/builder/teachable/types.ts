// ABOUTME: Shared types for the Teachable-style instructor builder.
// ABOUTME: Kept small — richer schemas live in canvas/course types.

import type { ContentItem, Module } from '@/types/canvas';

export interface BuilderCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  published: boolean;
}

export type BuilderView = 'setup' | 'curriculum' | 'lesson' | 'placeholder';

export interface BuilderModule extends Module {
  items: ContentItem[];
}
