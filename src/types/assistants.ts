
import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

export type Assistant = {
  id: string;
  name: string;
  icon: { 
    component: LucideIcon; 
    props: any;
  };
  description: string;
  category: "analytics" | "coding" | "content" | "career";
  popular?: boolean;
  instructions: string; // Added this property
};
