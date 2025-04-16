
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
