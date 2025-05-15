
import { ResumeAnalysis } from "@/components/assistants/types";

export interface ResumeData {
  id?: string;
  user_id?: string;
  text?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  created_at?: string;
  updated_at?: string;
  analysis?: ResumeAnalysis;
  enhanced_analysis?: any[];
}

export type Resume = ResumeData;
